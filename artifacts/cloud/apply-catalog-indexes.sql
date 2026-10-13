begin;
create index if not exists subspecialties_parent_idx on public.subspecialties(specialty_id);
create index if not exists cities_governorate_idx on public.cities(governorate_id);
create index if not exists doctor_specialties_sub_parent_idx on public.doctor_specialties(subspecialty_id,specialty_id);
create index if not exists clinics_city_governorate_idx on public.clinics(city_id,governorate_id);
insert into supabase_migrations.schema_migrations(version,name,statements)
values ('20261013020445','meendoc_catalog_indexes',array[$migration$-- Cover the four foreign keys flagged by the hosted Supabase advisor.
-- Keep existing indexes until real workload statistics justify removal.
create index if not exists subspecialties_parent_idx on public.subspecialties(specialty_id);
create index if not exists cities_governorate_idx on public.cities(governorate_id);
create index if not exists doctor_specialties_sub_parent_idx on public.doctor_specialties(subspecialty_id,specialty_id);
create index if not exists clinics_city_governorate_idx on public.clinics(city_id,governorate_id);
$migration$]) on conflict(version) do nothing;
commit;
select indexname from pg_indexes where schemaname='public' and indexname in ('subspecialties_parent_idx','cities_governorate_idx','doctor_specialties_sub_parent_idx','clinics_city_governorate_idx') order by indexname;
