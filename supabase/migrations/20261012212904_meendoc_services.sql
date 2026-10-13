begin;
create function public.search_doctors(p_filters jsonb default '{}',p_search text default '',p_sort text default 'availability',p_page int default 1,p_page_size int default 16,p_language text default 'ar')
returns jsonb language sql stable security invoker set search_path='' as $$
with eligible as (
  select d.id doctor_id,dc.clinic_id,dc.fee_egp,d.name,sa.next_slot,
    row_number() over(partition by d.id order by sa.next_slot nulls last,dc.fee_egp,dc.id) clinic_rank
  from public.doctors d join public.doctor_clinics dc on dc.doctor_id=d.id
  join public.clinics c on c.id=dc.clinic_id join public.governorates g on g.id=c.governorate_id join public.cities city on city.id=c.city_id
  left join lateral (
    select min(s.starts_at) next_slot from public.appointment_slots s
    where s.doctor_clinic_id=dc.id and s.status='available' and s.starts_at>now()
      and s.starts_at<now()+make_interval(days=>least(30,greatest(1,coalesce((p_filters->>'maxDays')::int,30))))
      and (coalesce(p_filters->>'date','')='' or (s.starts_at at time zone 'Africa/Cairo')::date=(p_filters->>'date')::date)
      and (coalesce(p_filters->>'timing','all')='all' or (p_filters->>'timing'='morning' and extract(hour from s.starts_at at time zone 'Africa/Cairo')<12) or (p_filters->>'timing'='evening' and extract(hour from s.starts_at at time zone 'Africa/Cairo')>=12))
  ) sa on true
  where d.status='published' and d.is_demo and dc.active and dc.booking_enabled and c.active
    and dc.fee_egp<=coalesce((p_filters->>'maxFee')::numeric,2000)
    and (coalesce(p_filters->>'gender','all')='all' or d.gender=p_filters->>'gender')
    and (coalesce(p_filters->>'governorate','all')='all' or g.slug=p_filters->>'governorate')
    and (coalesce(p_filters->>'area','all')='all' or city.slug=p_filters->>'area')
    and exists(select 1 from public.doctor_specialties ds join public.specialties sp on sp.id=ds.specialty_id left join public.subspecialties sub on sub.id=ds.subspecialty_id
      where ds.doctor_id=d.id and sp.active
        and (coalesce(p_filters->>'specialty','all')='all' or sp.slug=p_filters->>'specialty')
        and (coalesce(p_filters->>'subspecialty','all')='all' or (sub.slug=p_filters->>'subspecialty' and sub.active))
        and (p_search='' or d.name->>'ar' ilike '%'||p_search||'%' or d.name->>'en' ilike '%'||p_search||'%' or sp.name_ar ilike '%'||p_search||'%' or sp.name_en ilike '%'||p_search||'%'))
    and ((coalesce(p_filters->>'timing','all')='all' and coalesce((p_filters->>'maxDays')::int,30)=30 and coalesce(p_filters->>'date','')='') or sa.next_slot is not null)
),ranked as (
  select * from eligible where clinic_rank=1
),paged as (
  select * from ranked order by
    case when p_sort='price' then fee_egp end,
    case when p_sort='name' then name->>case when p_language='en' then 'en' else 'ar' end end,
    next_slot nulls last,fee_egp,doctor_id
  limit least(100,greatest(1,p_page_size)) offset (greatest(1,p_page)-1)*least(100,greatest(1,p_page_size))
)
select jsonb_build_object('total',(select count(*) from ranked),'items',coalesce((select jsonb_agg(jsonb_build_object('doctorId',doctor_id,'clinicId',clinic_id)) from paged),'[]'::jsonb));
$$;
grant execute on function public.search_doctors(jsonb,text,text,int,int,text) to anon,authenticated;

create function private.save_availability(p_association uuid,p_data jsonb,p_exception boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_doctor uuid;
begin
  if not (private.owns_association(p_association) or private.has_role('admin')) then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
  select doctor_id into v_doctor from public.doctor_clinics where id=p_association;
  perform pg_advisory_xact_lock(hashtextextended('doctor:'||v_doctor::text,0));
  if p_exception then
    insert into public.availability_exceptions(doctor_clinic_id,date,unavailable,start_time,end_time,reason)
      values(p_association,(p_data->>'date')::date,coalesce((p_data->>'unavailable')::boolean,true),(p_data->>'start_time')::time,(p_data->>'end_time')::time,left(coalesce(p_data->>'reason','Demo schedule exception'),120))
      on conflict(doctor_clinic_id,date) do update set unavailable=excluded.unavailable,start_time=excluded.start_time,end_time=excluded.end_time,reason=excluded.reason returning id into v_id;
  else
    insert into public.availability_rules(doctor_clinic_id,day_of_week,start_time,end_time,duration_minutes)
      values(p_association,(p_data->>'day_of_week')::int,(p_data->>'start_time')::time,(p_data->>'end_time')::time,(p_data->>'duration_minutes')::int)
      on conflict(doctor_clinic_id,day_of_week,start_time) do update set end_time=excluded.end_time,duration_minutes=excluded.duration_minutes,active=true returning id into v_id;
  end if;
  perform private.generate_slots(14,p_association);
  return v_id;
end;$$;
create function public.save_availability(p_association uuid,p_data jsonb,p_exception boolean default false) returns uuid language sql security invoker set search_path='' as $$select private.save_availability(p_association,p_data,p_exception);$$;
grant execute on function public.save_availability(uuid,jsonb,boolean),private.save_availability(uuid,jsonb,boolean) to authenticated;

create function private.configure_doctor(p_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=p_id;v_admin boolean:=private.has_role('admin');v_clinic uuid;v_gov uuid;v_city uuid;v_specialty uuid;v_sub uuid;v_fields jsonb;v_assoc uuid;
begin
  if not(v_admin or (p_id is not null and private.owns_doctor(p_id))) then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
  if not v_admin and p_data ?| array['status','verification_status','linked_user_id','specialty','governorate','area','gender'] then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
  if v_id is not null then perform pg_advisory_xact_lock(hashtextextended('doctor:'||v_id::text,0));end if;
  v_fields=p_data-array['fee','specialty','governorate','area'];
  if v_id is null then
    v_fields=jsonb_build_object('name',p_data->'name','gender',coalesce(p_data->>'gender','female'),'bio',coalesce(p_data->'bio',jsonb_build_object('ar','ملف خيالي للتجربة','en','Fictional demonstration profile')),'status','draft')||v_fields;
    v_id=(private.admin_write('doctors',null,v_fields)->>'id')::uuid;
  elsif v_admin then
    if v_fields<>'{}'::jsonb then perform private.admin_write('doctors',v_id,v_fields);end if;
  else
    update public.doctors set name=coalesce(p_data->'name',name),bio=coalesce(p_data->'bio',bio),credentials=coalesce(p_data->'credentials',credentials),experience=coalesce(p_data->'experience',experience) where id=v_id;
  end if;
  if p_data ? 'specialty' then
    select id into v_specialty from public.specialties where slug=p_data->>'specialty' and active;
    if v_specialty is null then raise exception 'INVALID_SPECIALTY';end if;
    select id into v_sub from public.subspecialties where specialty_id=v_specialty and active order by slug limit 1;
    delete from public.doctor_specialties where doctor_id=v_id;
    insert into public.doctor_specialties(doctor_id,specialty_id,subspecialty_id) values(v_id,v_specialty,v_sub);
  end if;
  select id,clinic_id into v_assoc,v_clinic from public.doctor_clinics where doctor_id=v_id order by created_at,id limit 1;
  if p_data ? 'fee' and v_assoc is not null then update public.doctor_clinics set fee_egp=(p_data->>'fee')::numeric where id=v_assoc;end if;
  if v_admin and p_data ?| array['governorate','area'] and v_clinic is not null then
    select id into v_gov from public.governorates where slug=p_data->>'governorate';
    select id into v_city from public.cities where slug=p_data->>'area' and governorate_id=v_gov;
    if v_city is null then raise exception 'INVALID_LOCATION';end if;
    update public.clinics set governorate_id=v_gov,city_id=v_city where id=v_clinic;
  end if;
  if v_admin and p_data->>'linked_user_id' is not null then insert into public.user_roles(user_id,role) values((p_data->>'linked_user_id')::uuid,'doctor') on conflict do nothing;end if;
  perform private.emit_event(auth.uid(),'doctor.configure','doctors',v_id);
  if v_assoc is not null then perform private.generate_slots(14,v_assoc);end if;
  return v_id;
end;$$;
create function public.configure_doctor(p_id uuid,p_data jsonb) returns uuid language sql security invoker set search_path='' as $$select private.configure_doctor(p_id,p_data);$$;
grant execute on function public.configure_doctor(uuid,jsonb),private.configure_doctor(uuid,jsonb) to authenticated;

-- Internal chat state stores search filters and a safety latch, never raw messages.
create function public.assistant_session(p_id uuid,p_patch jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_record private.assistant_sessions;
begin
  if current_setting('role',true)<>'service_role' then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
  delete from private.assistant_sessions where expires_at<now();
  if p_id is null then insert into private.assistant_sessions default values returning * into v_record;
  else select * into v_record from private.assistant_sessions where id=p_id and expires_at>now() for update;
    if not found then insert into private.assistant_sessions default values returning * into v_record;end if;
  end if;
  if p_patch is not null then
    update private.assistant_sessions set preferences=coalesce(p_patch->'preferences',preferences),phase=coalesce(p_patch->>'phase',phase),emergency_locked=coalesce((p_patch->>'emergency_locked')::boolean,emergency_locked),consent_version=coalesce(p_patch->>'consent_version',consent_version),updated_at=now() where id=v_record.id returning * into v_record;
  end if;
  return to_jsonb(v_record);
end;$$;
grant execute on function public.assistant_session(uuid,jsonb) to service_role;
revoke execute on all functions in schema private from public;
commit;
