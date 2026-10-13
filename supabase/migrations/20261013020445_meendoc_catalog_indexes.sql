-- Cover the four foreign keys flagged by the hosted Supabase advisor.
-- Keep existing indexes until real workload statistics justify removal.
create index if not exists subspecialties_parent_idx on public.subspecialties(specialty_id);
create index if not exists cities_governorate_idx on public.cities(governorate_id);
create index if not exists doctor_specialties_sub_parent_idx on public.doctor_specialties(subspecialty_id,specialty_id);
create index if not exists clinics_city_governorate_idx on public.clinics(city_id,governorate_id);
