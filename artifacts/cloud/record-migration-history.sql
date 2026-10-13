begin;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key, name text, statements text[]);
insert into supabase_migrations.schema_migrations(version,name,statements) values
('20261012210158','meendoc_core',ARRAY[$meendoc_history$begin;
create schema if not exists private;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
revoke all on schema private from public;
grant usage on schema private to anon,authenticated,service_role;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check(length(display_name)<=80),
  phone text check(phone is null or phone ~ '^01[0125][0-9]{8}$'),
  language text not null default 'ar' check(language in ('ar','en')),
  preferred_governorate text, preferred_city text, reminders boolean not null default false,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check(role in ('patient','doctor','admin')),
  created_at timestamptz not null default now(), primary key(user_id,role)
);
create table public.specialties (
  id uuid primary key default gen_random_uuid(),slug text not null unique,
  name_ar text not null,name_en text not null,description jsonb not null default '{}',active boolean not null default true,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.subspecialties (
  id uuid primary key default gen_random_uuid(),specialty_id uuid not null references public.specialties(id) on delete restrict,
  slug text not null unique,name_ar text not null,name_en text not null,active boolean not null default true,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,specialty_id)
);
create table public.governorates (
  id uuid primary key default gen_random_uuid(),slug text not null unique,name_ar text not null,name_en text not null,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.cities (
  id uuid primary key default gen_random_uuid(),governorate_id uuid not null references public.governorates(id) on delete restrict,
  slug text not null unique,name_ar text not null,name_en text not null,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,governorate_id)
);
create table public.doctors (
  id uuid primary key default gen_random_uuid(),slug text unique,linked_user_id uuid references public.profiles(id) on delete set null,
  name jsonb not null check(jsonb_typeof(name)='object'),gender text not null check(gender in ('female','male')),
  bio jsonb not null default '{}',services jsonb not null default '[]',credentials jsonb not null default '[]',experience jsonb not null default '[]',
  portrait_index int not null default 0 check(portrait_index between 0 and 15),
  status text not null default 'draft' check(status in ('draft','published','inactive')),
  verification_status text not null default 'unverified' check(verification_status in ('unverified','verified')),
  is_demo boolean not null default true check(is_demo),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index doctors_provider_idx on public.doctors(linked_user_id);
create index doctors_published_idx on public.doctors(status) where status='published';
create table public.doctor_specialties (
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  specialty_id uuid not null references public.specialties(id) on delete restrict,
  subspecialty_id uuid,primary key(doctor_id,specialty_id),
  foreign key(subspecialty_id,specialty_id) references public.subspecialties(id,specialty_id) on delete restrict,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index doctor_specialties_specialty_idx on public.doctor_specialties(specialty_id);
create index doctor_specialties_sub_idx on public.doctor_specialties(subspecialty_id);
create table public.clinics (
  id uuid primary key default gen_random_uuid(),name jsonb not null,address jsonb not null default '{}',
  governorate_id uuid not null references public.governorates(id) on delete restrict,city_id uuid not null,
  latitude numeric,longitude numeric,metadata jsonb not null default '{}',active boolean not null default true,
  is_demo boolean not null default true check(is_demo),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  foreign key(city_id,governorate_id) references public.cities(id,governorate_id) on delete restrict
);
create index clinics_governorate_idx on public.clinics(governorate_id);
create index clinics_city_idx on public.clinics(city_id);
create table public.doctor_clinics (
  id uuid primary key default gen_random_uuid(),doctor_id uuid not null references public.doctors(id) on delete restrict,
  clinic_id uuid not null references public.clinics(id) on delete restrict,fee_egp numeric(8,2) not null check(fee_egp between 100 and 5000),
  active boolean not null default true,booking_enabled boolean not null default true,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(doctor_id,clinic_id)
);
create index doctor_clinics_clinic_idx on public.doctor_clinics(clinic_id);
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),doctor_clinic_id uuid not null references public.doctor_clinics(id) on delete cascade,
  day_of_week int not null check(day_of_week between 0 and 6),start_time time not null,end_time time not null,
  duration_minutes int not null check(duration_minutes between 15 and 120),timezone text not null default 'Africa/Cairo' check(timezone='Africa/Cairo'),
  active boolean not null default true,check(start_time<end_time),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(doctor_clinic_id,day_of_week,start_time)
);
create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),doctor_clinic_id uuid not null references public.doctor_clinics(id) on delete cascade,
  date date not null,unavailable boolean not null default true,start_time time,end_time time,
  reason text not null default 'Demo schedule exception' check(length(reason)<=120),
  check((start_time is null and end_time is null) or (start_time is not null and end_time is not null and start_time<end_time)),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(doctor_clinic_id,date)
);
create table public.appointment_slots (
  id uuid primary key default gen_random_uuid(),doctor_clinic_id uuid not null references public.doctor_clinics(id) on delete restrict,
  starts_at timestamptz not null,ends_at timestamptz not null,check(starts_at<ends_at),
  status text not null default 'available' check(status in ('available','booked','blocked')),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(doctor_clinic_id,starts_at)
);
create index slots_lookup_idx on public.appointment_slots(doctor_clinic_id,starts_at) where status='available';
create table public.appointments (
  id uuid primary key default gen_random_uuid(),reference text not null unique default ('MD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  patient_id uuid not null references public.profiles(id) on delete restrict,
  doctor_id uuid not null references public.doctors(id) on delete restrict,clinic_id uuid not null references public.clinics(id) on delete restrict,
  slot_id uuid not null references public.appointment_slots(id) on delete restrict,
  starts_at timestamptz not null,ends_at timestamptz not null,check(starts_at<ends_at),
  status text not null default 'confirmed' check(status in ('confirmed','cancelled','completed')),
  patient_name text not null check(length(patient_name) between 2 and 80),
  patient_phone text not null check(patient_phone ~ '^01[0125][0-9]{8}$'),
  fee_snapshot numeric(8,2) not null check(fee_snapshot between 100 and 5000),
  idempotency_key uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(patient_id,idempotency_key),
  exclude using gist(doctor_id extensions.gist_uuid_ops with =,tstzrange(starts_at,ends_at,'[)') with &&) where(status in ('confirmed','completed'))
);
create unique index appointments_occupied_slot_idx on public.appointments(slot_id) where status in ('confirmed','completed');
create index appointments_patient_idx on public.appointments(patient_id,starts_at desc);
create index appointments_doctor_idx on public.appointments(doctor_id,starts_at desc);
create index appointments_clinic_idx on public.appointments(clinic_id);
create table public.favorites (
  patient_id uuid not null references public.profiles(id) on delete cascade,doctor_id uuid not null references public.doctors(id) on delete cascade,
  created_at timestamptz not null default now(),primary key(patient_id,doctor_id)
);
create index favorites_doctor_idx on public.favorites(doctor_id);
create table public.doctor_applications (
  id uuid primary key default gen_random_uuid(),applicant_user_id uuid references public.profiles(id) on delete set null,
  name text not null check(length(name) between 2 and 80),specialty_id uuid not null references public.specialties(id) on delete restrict,
  governorate_id uuid not null references public.governorates(id) on delete restrict,city_text text not null check(length(city_text)<=80),
  registration_reference text not null check(length(registration_reference) between 3 and 120),
  clinic_information text not null check(length(clinic_information) between 3 and 500),contact_email text not null check(length(contact_email)<=160),
  status text not null default 'pending' check(status in ('pending','under_review','approved','rejected')),
  review_notes text not null default '',reviewer_id uuid references public.profiles(id) on delete set null,reviewed_at timestamptz,
  doctor_id uuid references public.doctors(id) on delete set null,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index applications_open_email_idx on public.doctor_applications(lower(contact_email)) where status in ('pending','under_review');
create index applications_applicant_idx on public.doctor_applications(applicant_user_id);
create index applications_specialty_idx on public.doctor_applications(specialty_id);
create index applications_governorate_idx on public.doctor_applications(governorate_id);
create index applications_doctor_idx on public.doctor_applications(doctor_id);
create index applications_reviewer_idx on public.doctor_applications(reviewer_id);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,content jsonb not null,read_at timestamptz,delivery_status text not null default 'in_app' check(delivery_status='in_app'),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications(recipient_id,created_at desc);
create table public.announcements (
  id uuid primary key default gen_random_uuid(),content jsonb not null,active boolean not null default true,
  starts_at timestamptz,ends_at timestamptz,check(ends_at is null or starts_at is null or starts_at<ends_at),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.feedback (
  id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id) on delete set null,
  category text not null check(category in ('usability','catalog','technical')),rating int not null check(rating between 1 and 5),
  text text not null default '' check(length(text)<=600),status text not null default 'open' check(status in ('open','resolved')),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index feedback_user_idx on public.feedback(user_id);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles(id) on delete set null,
  action text not null,target_entity text not null,target_id uuid,metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_actor_idx on public.audit_events(actor_id,created_at desc);
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id) on delete cascade,
  session_hash text,version text not null,scope text not null,created_at timestamptz not null default now(),
  check(user_id is not null or session_hash is not null)
);
create index consent_user_idx on public.consent_records(user_id);
create table public.ai_usage_counters (
  subject_hash text not null,scope text not null,window_start timestamptz not null,request_count int not null default 0 check(request_count>=0),
  token_count int not null default 0 check(token_count>=0),model text,updated_at timestamptz not null default now(),
  primary key(subject_hash,scope,window_start)
);
create table private.assistant_sessions (
  id uuid primary key default gen_random_uuid(),preferences jsonb not null default '{}',phase text not null default 'intro',
  emergency_locked boolean not null default false,consent_version text,created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '24 hours'),updated_at timestamptz not null default now()
);
create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','reviewed','completed')),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index privacy_user_idx on public.privacy_requests(user_id);

create function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end;$$;
do $$declare t text;begin
  for t in select tablename from pg_tables where schemaname='public' and tablename not in ('favorites','audit_events','consent_records','user_roles') loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t);
  end loop;
end;$$;
create function private.initialize_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),80)) on conflict do nothing;
  insert into public.user_roles(user_id,role) values(new.id,'patient') on conflict do nothing;
  return new;
end;$$;
create trigger meendoc_initialize_profile after insert on auth.users for each row execute function private.initialize_profile();
create function private.live_user() returns boolean language sql stable security definer set search_path='' as $$
  select current_setting('role',true)='authenticated' and exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id
    where u.id=(select auth.uid()) and coalesce(u.is_anonymous,false)=false
      and s.id::text=(select auth.jwt()->>'session_id'));
$$;
create function private.has_role(p_role text) returns boolean language sql stable security definer set search_path='' as $$
  select private.live_user() and exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role=p_role);
$$;
create function private.owns_doctor(p_doctor uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.has_role('doctor') and exists(select 1 from public.doctors where id=p_doctor and linked_user_id=(select auth.uid()));
$$;
create function private.owns_association(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.doctor_clinics dc where dc.id=p_id and private.owns_doctor(dc.doctor_id));
$$;
create function private.public_doctor(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.doctors d where d.id=p_id and d.status='published' and d.is_demo);
$$;
create function private.owns_exclusive_clinic(p_clinic uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.doctor_clinics dc where dc.clinic_id=p_clinic and private.owns_doctor(dc.doctor_id))
    and not exists(select 1 from public.doctor_clinics dc where dc.clinic_id=p_clinic and not private.owns_doctor(dc.doctor_id));
$$;
grant execute on function private.owns_exclusive_clinic(uuid) to authenticated;
grant execute on function private.live_user(),private.has_role(text),private.owns_doctor(uuid),private.owns_association(uuid),private.public_doctor(uuid) to anon,authenticated;
do $$declare t text;begin
  for t in select tablename from pg_tables where schemaname in ('public','private') loop
    execute format('alter table %I.%I enable row level security',(select schemaname from pg_tables where tablename=t and schemaname in ('public','private') limit 1),t);
  end loop;
end;$$;
revoke all on all tables in schema public from anon,authenticated;
revoke all on all tables in schema private from anon,authenticated;
grant all on all tables in schema public,private to service_role;
grant select on public.specialties,public.subspecialties,public.governorates,public.cities,public.doctors,public.doctor_specialties,public.clinics,public.doctor_clinics,public.appointment_slots,public.announcements to anon,authenticated;
grant select on public.profiles,public.user_roles,public.appointments,public.favorites,public.doctor_applications,public.notifications,public.feedback,public.audit_events,public.consent_records,public.privacy_requests,public.availability_rules,public.availability_exceptions to authenticated;
grant update(display_name,phone,language,preferred_governorate,preferred_city,reminders) on public.profiles to authenticated;
grant insert,delete on public.favorites to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant update(name,bio,services,credentials,experience) on public.doctors to authenticated;
grant update(fee_egp,active,booking_enabled) on public.doctor_clinics to authenticated;
grant insert,update,delete on public.availability_rules,public.availability_exceptions to authenticated;
grant update(name,address,active) on public.clinics to authenticated;
grant insert on public.privacy_requests to authenticated;
create policy own_profile on public.profiles for select to authenticated using(private.live_user() and (id=(select auth.uid()) or private.has_role('admin')));
create policy edit_profile on public.profiles for update to authenticated using(private.live_user() and id=(select auth.uid())) with check(private.live_user() and id=(select auth.uid()));
create policy own_roles on public.user_roles for select to authenticated using(private.live_user() and user_id=(select auth.uid()));
create policy directory_specialties on public.specialties for select to anon,authenticated using(active or private.has_role('admin'));
create policy directory_subspecialties on public.subspecialties for select to anon,authenticated using(active or private.has_role('admin'));
create policy directory_governorates on public.governorates for select to anon,authenticated using(true);
create policy directory_cities on public.cities for select to anon,authenticated using(true);
create policy directory_doctors on public.doctors for select to anon,authenticated using(status='published' or private.owns_doctor(id) or private.has_role('admin'));
create policy own_doctor_edit on public.doctors for update to authenticated using(private.owns_doctor(id)) with check(private.owns_doctor(id));
create policy directory_doctor_specialties on public.doctor_specialties for select to anon,authenticated using(private.public_doctor(doctor_id) or private.owns_doctor(doctor_id) or private.has_role('admin'));
create policy directory_doctor_clinics on public.doctor_clinics for select to anon,authenticated using((active and private.public_doctor(doctor_id)) or private.owns_doctor(doctor_id) or private.has_role('admin'));
create policy own_doctor_clinics on public.doctor_clinics for update to authenticated using(private.owns_doctor(doctor_id)) with check(private.owns_doctor(doctor_id));
create policy directory_clinics on public.clinics for select to anon,authenticated using(private.has_role('admin') or exists(select 1 from public.doctor_clinics dc where dc.clinic_id=clinics.id and ((active and dc.active and private.public_doctor(dc.doctor_id)) or private.owns_doctor(dc.doctor_id))));
create policy own_clinic_edit on public.clinics for update to authenticated using(private.owns_exclusive_clinic(id)) with check(private.owns_exclusive_clinic(id));
create policy own_rules on public.availability_rules for all to authenticated using(private.owns_association(doctor_clinic_id)) with check(private.owns_association(doctor_clinic_id));
create policy own_exceptions on public.availability_exceptions for all to authenticated using(private.owns_association(doctor_clinic_id)) with check(private.owns_association(doctor_clinic_id));
create policy directory_slots on public.appointment_slots for select to anon,authenticated using((status='available' and starts_at>now() and exists(select 1 from public.doctor_clinics dc where dc.id=doctor_clinic_id and dc.active and dc.booking_enabled and private.public_doctor(dc.doctor_id))) or private.owns_association(doctor_clinic_id) or private.has_role('admin'));
create policy own_appointments on public.appointments for select to authenticated using(private.live_user() and (patient_id=(select auth.uid()) or private.owns_doctor(doctor_id) or private.has_role('admin')));
create policy own_favorites on public.favorites for all to authenticated using(private.live_user() and patient_id=(select auth.uid())) with check(private.live_user() and patient_id=(select auth.uid()) and private.public_doctor(doctor_id));
create policy own_applications on public.doctor_applications for select to authenticated using(private.live_user() and (applicant_user_id=(select auth.uid()) or private.has_role('admin')));
create policy own_notifications on public.notifications for select to authenticated using(private.live_user() and recipient_id=(select auth.uid()));
create policy read_notifications on public.notifications for update to authenticated using(private.live_user() and recipient_id=(select auth.uid())) with check(private.live_user() and recipient_id=(select auth.uid()));
create policy public_announcements on public.announcements for select to anon,authenticated using((active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())) or private.has_role('admin'));
create policy own_feedback on public.feedback for select to authenticated using(private.live_user() and (user_id=(select auth.uid()) or private.has_role('admin')));
create policy admin_audit on public.audit_events for select to authenticated using(private.has_role('admin'));
create policy own_consent on public.consent_records for select to authenticated using(private.live_user() and user_id=(select auth.uid()));
create policy own_privacy on public.privacy_requests for all to authenticated using(private.live_user() and user_id=(select auth.uid())) with check(private.live_user() and user_id=(select auth.uid()) and status='pending');
commit;
$meendoc_history$]),
('20261012210203','meendoc_transactions',ARRAY[$meendoc_history$begin;
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
$meendoc_history$]),
('20261012212904','meendoc_services',ARRAY[$meendoc_history$begin;
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
$meendoc_history$])
on conflict (version) do nothing;
commit;
select version,name from supabase_migrations.schema_migrations order by version;