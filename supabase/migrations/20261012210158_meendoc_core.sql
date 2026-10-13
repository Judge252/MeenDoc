begin;
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
