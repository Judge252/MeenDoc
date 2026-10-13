begin;
create function private.slot_is_current(p_slot uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.appointment_slots s
    join public.doctor_clinics dc on dc.id=s.doctor_clinic_id
    join public.doctors d on d.id=dc.doctor_id join public.clinics c on c.id=dc.clinic_id
    join public.availability_rules r on r.doctor_clinic_id=dc.id and r.active
    left join public.availability_exceptions e on e.doctor_clinic_id=dc.id and e.date=(s.starts_at at time zone 'Africa/Cairo')::date
    where s.id=p_slot and dc.active and dc.booking_enabled and c.active and d.status='published'
    and s.starts_at>now() and coalesce(e.unavailable,false)=false
    and r.day_of_week=extract(dow from s.starts_at at time zone 'Africa/Cairo')
    and (s.starts_at at time zone 'Africa/Cairo')::time>=coalesce(e.start_time,r.start_time)
    and extract(epoch from s.ends_at-s.starts_at)=r.duration_minutes*60
    and mod(extract(epoch from ((s.starts_at at time zone 'Africa/Cairo')::time-coalesce(e.start_time,r.start_time)))::numeric,r.duration_minutes*60)=0
    and (s.ends_at at time zone 'Africa/Cairo')::time<=coalesce(e.end_time,r.end_time));
$$;
create function private.release_slot(p_slot uuid) returns void language plpgsql security definer set search_path='' as $$
begin update public.appointment_slots set status=case when private.slot_is_current(p_slot) then 'available' else 'blocked' end
  where id=p_slot and not exists(select 1 from public.appointments where slot_id=p_slot and status in ('confirmed','completed'));end;$$;
create function private.emit_event(p_actor uuid,p_action text,p_target text,p_id uuid) returns void language sql security definer set search_path='' as $$
  insert into public.audit_events(actor_id,action,target_entity,target_id) values(p_actor,p_action,p_target,p_id);
$$;
create function private.notify_booking(p_patient uuid,p_category text,p_reference text) returns void language sql security definer set search_path='' as $$
  insert into public.notifications(recipient_id,category,content) values(p_patient,p_category,jsonb_build_object('ar','اتحدّث الحجز التجريبي: '||p_reference,'en','Demo booking updated: '||p_reference));
$$;
create function private.book_appointment(p_slot uuid,p_key uuid,p_name text,p_phone text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_patient uuid:=auth.uid();v_slot public.appointment_slots;v_dc public.doctor_clinics;v_appt public.appointments;
begin
  if not private.live_user() then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(v_patient::text||':'||p_key::text,0));
  select * into v_appt from public.appointments where patient_id=v_patient and idempotency_key=p_key;
  if found then
    if v_appt.slot_id<>p_slot or v_appt.patient_name<>p_name or v_appt.patient_phone<>p_phone then raise exception 'IDEMPOTENCY_CONFLICT';end if;
    return to_jsonb(v_appt);
  end if;
  select dc.* into v_dc from public.doctor_clinics dc join public.appointment_slots s on s.doctor_clinic_id=dc.id where s.id=p_slot;
  if not found then raise exception 'INVALID_SLOT';end if;
  perform pg_advisory_xact_lock(hashtextextended('doctor:'||v_dc.doctor_id::text,0));
  select * into v_dc from public.doctor_clinics where id=v_dc.id for share;
  perform id from public.doctors where id=v_dc.doctor_id for share;
  perform id from public.clinics where id=v_dc.clinic_id for share;
  select * into v_slot from public.appointment_slots where id=p_slot for update;
  if v_slot.status<>'available' or not private.slot_is_current(p_slot) then raise exception 'INVALID_SLOT';end if;
  if exists(select 1 from public.appointments where doctor_id=v_dc.doctor_id and status in ('confirmed','completed') and tstzrange(starts_at,ends_at,'[)')&&tstzrange(v_slot.starts_at,v_slot.ends_at,'[)')) then raise exception 'SLOT_CONFLICT';end if;
  insert into public.appointments(patient_id,doctor_id,clinic_id,slot_id,starts_at,ends_at,patient_name,patient_phone,fee_snapshot,idempotency_key)
    values(v_patient,v_dc.doctor_id,v_dc.clinic_id,v_slot.id,v_slot.starts_at,v_slot.ends_at,p_name,p_phone,v_dc.fee_egp,p_key) returning * into v_appt;
  update public.appointment_slots set status='booked' where id=p_slot;
  perform private.notify_booking(v_patient,'booking_confirmed',v_appt.reference);
  perform private.emit_event(v_patient,'booking.confirmed','appointments',v_appt.id);
  return to_jsonb(v_appt);
exception when unique_violation or exclusion_violation then raise exception 'SLOT_CONFLICT' using errcode='23505';
end;$$;
create function public.book_appointment(p_slot uuid,p_key uuid,p_name text,p_phone text) returns jsonb language sql security invoker set search_path='' as $$select private.book_appointment(p_slot,p_key,p_name,p_phone);$$;
grant execute on function public.book_appointment(uuid,uuid,text,text),private.book_appointment(uuid,uuid,text,text) to authenticated;

create function private.change_appointment(p_appointment uuid,p_action text,p_slot uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_appt public.appointments;v_new public.appointment_slots;v_dc public.doctor_clinics;v_old uuid;v_actor uuid:=auth.uid();
begin
  if not private.live_user() then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
  select * into v_appt from public.appointments where id=p_appointment;
  if not found or not (v_appt.patient_id=v_actor or private.has_role('admin') or (p_action in ('cancel','complete') and private.owns_doctor(v_appt.doctor_id))) then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended('doctor:'||v_appt.doctor_id::text,0));
  select * into v_appt from public.appointments where id=p_appointment for update;
  if p_action='cancel' and v_appt.status='cancelled' then return to_jsonb(v_appt);end if;
  if v_appt.status<>'confirmed' then raise exception 'INVALID_TRANSITION';end if;
  v_old=v_appt.slot_id;
  if p_action='cancel' then
    if v_appt.starts_at<=now() and not private.has_role('admin') then raise exception 'INVALID_TRANSITION';end if;
    update public.appointments set status='cancelled' where id=v_appt.id returning * into v_appt;
    perform private.release_slot(v_old);
  elsif p_action='complete' then
    if not (private.has_role('admin') or private.owns_doctor(v_appt.doctor_id)) or v_appt.starts_at>now() then raise exception 'INVALID_TRANSITION';end if;
    update public.appointments set status='completed' where id=v_appt.id returning * into v_appt;
  elsif p_action='reschedule' then
    if v_appt.patient_id<>v_actor or v_appt.starts_at<=now() then raise exception 'INVALID_TRANSITION';end if;
    if p_slot=v_old then return to_jsonb(v_appt);end if;
    perform id from public.appointment_slots where id in (v_old,p_slot) order by id for update;
    select * into v_new from public.appointment_slots where id=p_slot;
    if not found or v_new.status<>'available' or not private.slot_is_current(p_slot) then raise exception 'INVALID_SLOT';end if;
    select * into v_dc from public.doctor_clinics where id=v_new.doctor_clinic_id;
    if v_dc.doctor_id<>v_appt.doctor_id then raise exception 'INVALID_SLOT';end if;
    update public.appointments set slot_id=v_new.id,clinic_id=v_dc.clinic_id,starts_at=v_new.starts_at,ends_at=v_new.ends_at,fee_snapshot=v_dc.fee_egp where id=v_appt.id returning * into v_appt;
    update public.appointment_slots set status='booked' where id=p_slot;
    perform private.release_slot(v_old);
  else raise exception 'INVALID_TRANSITION';end if;
  perform private.notify_booking(v_appt.patient_id,'booking_'||p_action,v_appt.reference);
  perform private.emit_event(v_actor,'booking.'||p_action,'appointments',v_appt.id);
  return to_jsonb(v_appt);
exception when unique_violation or exclusion_violation then raise exception 'SLOT_CONFLICT' using errcode='23505';
end;$$;
create function public.change_appointment(p_appointment uuid,p_action text,p_slot uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.change_appointment(p_appointment,p_action,p_slot);$$;
grant execute on function public.change_appointment(uuid,text,uuid),private.change_appointment(uuid,text,uuid) to authenticated;

create function private.generate_slots(p_days int,p_association uuid default null) returns int language plpgsql security definer set search_path='' as $$
declare v_rule record;v_day date;v_cursor timestamp;v_end timestamp;v_exception public.availability_exceptions;v_count int:=0;
begin
  if p_days not between 1 and 30 then raise exception 'INVALID_WINDOW';end if;
  if not (private.has_role('admin') or (p_association is not null and private.owns_association(p_association)) or current_setting('role',true)='service_role' or (session_user='postgres' and current_setting('role',true) in ('none',''))) then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
  update public.appointment_slots set status='blocked' where status='available' and starts_at>now() and (p_association is null or doctor_clinic_id=p_association);
  for v_rule in select r.* from public.availability_rules r join public.doctor_clinics dc on dc.id=r.doctor_clinic_id join public.clinics c on c.id=dc.clinic_id join public.doctors d on d.id=dc.doctor_id where r.active and dc.active and dc.booking_enabled and c.active and d.status='published' and (p_association is null or r.doctor_clinic_id=p_association) loop
    for v_day in select (now() at time zone 'Africa/Cairo')::date+i from generate_series(0,p_days-1) i loop
      if extract(dow from v_day)<>v_rule.day_of_week then continue;end if;
      select * into v_exception from public.availability_exceptions where doctor_clinic_id=v_rule.doctor_clinic_id and date=v_day;
      if found and v_exception.unavailable then continue;end if;
      v_cursor=v_day+coalesce(v_exception.start_time,v_rule.start_time);v_end=v_day+coalesce(v_exception.end_time,v_rule.end_time);
      while v_cursor+make_interval(mins=>v_rule.duration_minutes)<=v_end loop
        if (v_cursor at time zone 'Africa/Cairo')>now() then
          insert into public.appointment_slots(doctor_clinic_id,starts_at,ends_at) values(v_rule.doctor_clinic_id,v_cursor at time zone 'Africa/Cairo',(v_cursor+make_interval(mins=>v_rule.duration_minutes)) at time zone 'Africa/Cairo')
          on conflict(doctor_clinic_id,starts_at) do update set status=case when public.appointment_slots.status='booked' then 'booked' else 'available' end,ends_at=case when public.appointment_slots.status='booked' then public.appointment_slots.ends_at else excluded.ends_at end;
          v_count=v_count+1;
        end if;
        v_cursor=v_cursor+make_interval(mins=>v_rule.duration_minutes);
      end loop;
    end loop;
  end loop;
  return v_count;
end;$$;
create function public.generate_appointment_slots(p_days int default 14,p_association uuid default null) returns int language sql security invoker set search_path='' as $$select private.generate_slots(p_days,p_association);$$;
grant execute on function public.generate_appointment_slots(int,uuid),private.generate_slots(int,uuid) to authenticated,service_role;

create function private.consume_limit(p_subject text,p_scope text,p_limit int,p_window_seconds int) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_start timestamptz;v_count int;
begin
  if current_setting('role',true)<>'service_role' then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
  if p_limit<1 or p_window_seconds not between 30 and 86400 then raise exception 'INVALID_LIMIT';end if;
  v_start=to_timestamp(floor(extract(epoch from now())/p_window_seconds)*p_window_seconds);
  insert into public.ai_usage_counters(subject_hash,scope,window_start,request_count) values(p_subject,p_scope,v_start,1)
  on conflict(subject_hash,scope,window_start) do update set request_count=public.ai_usage_counters.request_count+1,updated_at=now()
    where public.ai_usage_counters.request_count<p_limit returning request_count into v_count;
  if v_count is null then raise exception 'RATE_LIMIT';end if;
  return jsonb_build_object('used',v_count,'limit',p_limit,'warning',v_count>=p_limit*0.8);
end;$$;
create function public.consume_request_limit(p_subject text,p_scope text,p_limit int,p_window_seconds int) returns jsonb language sql security invoker set search_path='' as $$select private.consume_limit(p_subject,p_scope,p_limit,p_window_seconds);$$;
grant execute on function public.consume_request_limit(text,text,int,int),private.consume_limit(text,text,int,int) to service_role;
create function public.record_ai_tokens(p_subject text,p_model text,p_tokens int) returns void language sql security invoker set search_path='' as $$
  update public.ai_usage_counters set token_count=token_count+greatest(0,p_tokens),model=p_model where subject_hash=p_subject and scope='ai_global' and window_start=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
$$;
grant execute on function public.record_ai_tokens(text,text,int) to service_role;

create function private.review_application(p_id uuid,p_status text,p_notes text,p_user uuid,p_doctor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_app public.doctor_applications;v_doc public.doctors;
begin
  if not private.has_role('admin') then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
  if p_status not in ('under_review','approved','rejected') or length(p_notes)>1000 then raise exception 'INVALID_TRANSITION';end if;
  select * into v_app from public.doctor_applications where id=p_id for update;
  if not found then raise exception 'INVALID_APPLICATION';end if;
  if v_app.status in ('approved','rejected') and p_status<>v_app.status then raise exception 'INVALID_TRANSITION';end if;
  if p_status='approved' then
    p_doctor=coalesce(p_doctor,v_app.doctor_id);
    if p_user is null or not exists(select 1 from auth.users where id=p_user and not coalesce(is_anonymous,false)) then raise exception 'PROVIDER_ACCOUNT_REQUIRED';end if;
    if p_doctor is null then
      insert into public.doctors(linked_user_id,name,gender,bio,status,verification_status)
        values(p_user,jsonb_build_object('ar',v_app.name,'en',v_app.name),'female',jsonb_build_object('ar','ملف تجريبي قيد الإعداد','en','Demo profile being prepared'),'draft','unverified') returning * into v_doc;
      insert into public.doctor_specialties(doctor_id,specialty_id) values(v_doc.id,v_app.specialty_id);
    else
      select * into v_doc from public.doctors where id=p_doctor for update;
      if not found or (v_doc.linked_user_id is not null and v_doc.linked_user_id<>p_user) then raise exception 'PROVIDER_LINK_CONFLICT';end if;
      update public.doctors set linked_user_id=p_user where id=p_doctor returning * into v_doc;
    end if;
    insert into public.user_roles(user_id,role) values(p_user,'doctor') on conflict do nothing;
    update public.doctor_applications set applicant_user_id=p_user,doctor_id=v_doc.id where id=p_id;
  end if;
  update public.doctor_applications set status=p_status,review_notes=p_notes,reviewer_id=auth.uid(),reviewed_at=now() where id=p_id returning * into v_app;
  if v_app.applicant_user_id is not null then insert into public.notifications(recipient_id,category,content) values(v_app.applicant_user_id,'application_updated',jsonb_build_object('ar','اتحدّث طلب الانضمام التجريبي','en','Your demo application was updated'));end if;
  perform private.emit_event(auth.uid(),'application.'||p_status,'doctor_applications',p_id);
  return to_jsonb(v_app);
end;$$;
create function public.review_doctor_application(p_id uuid,p_status text,p_notes text default '',p_user uuid default null,p_doctor uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.review_application(p_id,p_status,p_notes,p_user,p_doctor);$$;
grant execute on function public.review_doctor_application(uuid,text,text,uuid,uuid),private.review_application(uuid,text,text,uuid,uuid) to authenticated;

-- This narrow administrative write gateway is never available to a patient/doctor.
-- Identifiers come from a fixed table/column allowlist; values remain SQL parameters.
create function private.admin_write(p_resource text,p_id uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_allowed text[];v_keys text[];v_columns text;v_projection text;v_result jsonb;v_id uuid:=coalesce(p_id,gen_random_uuid());
begin
  if not private.has_role('admin') then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
  v_allowed=case p_resource
    when 'doctors' then array['slug','linked_user_id','name','gender','bio','services','credentials','experience','portrait_index','status','verification_status']
    when 'specialties' then array['slug','name_ar','name_en','description','active']
    when 'subspecialties' then array['slug','name_ar','name_en','specialty_id','active']
    when 'clinics' then array['name','address','governorate_id','city_id','active']
    when 'doctor_clinics' then array['doctor_id','clinic_id','fee_egp','active','booking_enabled']
    when 'announcements' then array['content','active','starts_at','ends_at']
    when 'feedback' then array['status']
    when 'privacy_requests' then array['status']
    else null end;
  if v_allowed is null or jsonb_typeof(p_data)<>'object' then raise exception 'INVALID_RESOURCE';end if;
  select array_agg(k order by k) into v_keys from jsonb_object_keys(p_data) k;
  if v_keys is null or not v_keys<@v_allowed then raise exception 'INVALID_FIELDS';end if;
  select string_agg(format('%I',k),','),string_agg(format('x.%I',k),',') into v_columns,v_projection from unnest(v_keys) k;
  if p_id is null then
    execute format('insert into public.%I(id,%s) select $2,%s from jsonb_populate_record(null::public.%I,$1) x returning to_jsonb(%I.*)',p_resource,v_columns,v_projection,p_resource,p_resource) into v_result using p_data,v_id;
  else
    execute format('update public.%I set (%s)=(select %s from jsonb_populate_record(null::public.%I,$1) x) where id=$2 returning to_jsonb(%I.*)',p_resource,v_columns,v_projection,p_resource,p_resource) into v_result using p_data,v_id;
  end if;
  if v_result is null then raise exception 'RECORD_NOT_FOUND';end if;
  perform private.emit_event(auth.uid(),'admin.'||case when p_id is null then 'create' else 'update' end,p_resource,v_id);
  return v_result;
end;$$;
create function public.admin_write(p_resource text,p_id uuid,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.admin_write(p_resource,p_id,p_data);$$;
grant execute on function public.admin_write(text,uuid,jsonb),private.admin_write(text,uuid,jsonb) to authenticated;

create function private.audit_provider_write() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null then perform private.emit_event(auth.uid(),'provider.'||lower(tg_op),tg_table_name,coalesce(new.id,old.id));end if;
  return coalesce(new,old);
end;$$;
create trigger audit_doctor_update after update on public.doctors for each row execute function private.audit_provider_write();
create trigger audit_clinic_update after update on public.clinics for each row execute function private.audit_provider_write();
create trigger audit_association_update after update on public.doctor_clinics for each row execute function private.audit_provider_write();
create trigger audit_rule_mutations after insert or update or delete on public.availability_rules for each row execute function private.audit_provider_write();
create trigger audit_exception_mutations after insert or update or delete on public.availability_exceptions for each row execute function private.audit_provider_write();
revoke execute on all functions in schema private from public;
commit;
