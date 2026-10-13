# Database

The four migrations passed fresh PostgreSQL/PGlite tests and were applied to the approved project `mofdzltldjwkalvkkbvk`. All 23 public tables have RLS. The original seed produced 16 fictional doctors, seven specialties and 672 slots at first application. A separate fictional onboarding fixture was created during live verification and returned to draft afterwards.

| Migration | Contents |
| --- | --- |
| `20261012210158_meendoc_core.sql` | Tables, constraints, indexes, profile initialization, roles, RLS and grants |
| `20261012210203_meendoc_transactions.sql` | Booking/status transactions, slot generation, admin/application transactions and shared quotas |
| `20261012212904_meendoc_services.sql` | Deterministic search, owned provider configuration, availability writes and ephemeral assistant state |

## Schema

| Tables | Relationships and purpose |
| --- | --- |
| profiles, user_roles | Auth user UUID; bounded profile preferences; separately controlled patient/doctor/admin roles |
| specialties, subspecialties | Stable bilingual slugs; subspecialty belongs to one specialty |
| governorates, cities | Bilingual Egyptian location directory; city belongs to a governorate |
| doctors, doctor_specialties | Fictional profiles with optional linked auth user; specialty associations and optional subspecialty; localized bio, credentials and experience arrays |
| clinics, doctor_clinics | Clinic location/address; provider-clinic fee and booking settings |
| availability_rules, availability_exceptions | Provider-clinic weekly times, duration, unavailable days or overrides |
| appointment_slots | Provider-clinic start/end timestamps and available/booked/blocked state |
| appointments | Patient, provider, clinic, slot, unique reference, contact, fee snapshot, status and idempotency key |
| favorites | Unique patient/provider association |
| doctor_applications | Pending/reviewed application, reviewer, confirmed linked provider account and resulting profile |
| notifications, announcements | Real in-app notification records and scheduled bilingual announcements |
| feedback, privacy_requests | Non-clinical product feedback and manually reviewed privacy requests |
| audit_events, consent_records, ai_usage_counters | Minimal action, consent-version and pseudonymous request/token metadata |
| private.assistant_sessions | Ephemeral preferences, status, consent version and emergency-example latch; no transcript |

All 23 public tables and the private assistant table have RLS. Primary/foreign keys, uniqueness/check constraints and update triggers enforce consistency. Financial amounts are EGP; timestamps are stored with time zone. Schedules and displayed slot dates use Africa/Cairo, including daylight-saving changes.

## RLS and privileges

Guests can read active directories, published fictional providers, active clinics/associations, future available slots and active announcements. Patients can read/update permitted own profile fields and manage own favorites; appointment mutations go through RPCs. Linked doctors see/edit owned permitted profile, clinic/schedule and appointment data. A shared clinic is editable by a provider only when all associations are exclusively owned; hidden providers do not bypass that check. Admins use guarded APIs and fixed database write allowlists.

Private SECURITY DEFINER helpers use an empty search_path, fully qualified references and revoked PUBLIC execution. Public transaction wrappers are SECURITY INVOKER with explicit grants. A live-user helper checks auth.sessions against the JWT session_id and rejects anonymous/deleted sessions. Service-role functions are not executable by public clients. Browser user metadata cannot assign a role.

## Booking consistency

`book_appointment` derives the patient, locks the idempotency scope and then the provider and slot. It rechecks the active provider/clinic/association, current schedule, future time and slot status under locks. Fee/status records are share-locked and the fee snapshot comes from PostgreSQL. A reused key with a different request is rejected.

A unique occupied-slot constraint and a provider time-range exclusion constraint prevent overlapping bookings, including different clinics. Cancellation/rescheduling/status transitions use the same ordering and release/claim slots atomically. Notification and audit records are written in the same transaction. Completed appointments cannot be rescheduled; repeatedly cancelling a cancelled appointment is idempotent.

Slot generation initially covers 14 days, configurable from 1 to 30. It uses weekly rules/exceptions, preserves existing booked slots, blocks stale free slots and upserts valid future slots. Schedule mutations regenerate affected slots. A daily secret-protected refresh route is prepared in vercel.json; it is not running in a deployment yet.

## Seed and types

`npm run db:seed` regenerates supabase/seed.sql from the original 16 fictional profiles. Stable seed UUIDs are intentional fixture identities; inserts use conflict-do-nothing and do not overwrite edited records. It includes seven specialties/subspecialties, three governorates, seven cities, clinics, schedules and generated slots. Professional credentials remain empty/unverified. No real clinician or patient is invented.

`npm run db:types` generates src/types/database.ts from locally applied migrations in the test engine: 23 tables and 11 public functions. It does not infer relationship metadata. Once connected, regenerate canonical Supabase types from the actual project. Domain DTOs remain separately typed; not every SDK query uses generated generic inference.

## Validation and rollback

`npm run db:verify` and the database test file apply all migrations and reseed a fresh PGlite database. The auth schema in that harness is a test shim, not GoTrue. Transaction tests verify committed constraints, RLS, ownership, status changes, idempotency, matching and revoked sessions. Separate live checks verified two hosted authenticated patients competing concurrently: one success and one conflict. Actual slot release, direct REST RLS, provider ownership and global session revocation also passed.

Before any remote migration, confirm the supplied project, inspect its schema/migration history and take an appropriate backup. Apply ordered migrations to the dedicated development project. Never reset an existing remote database. Rollback uses a reviewed forward corrective migration and a backup restore only with explicit authorization; the app contains no destructive automated down migration. Retained appointment/audit records must not be casually deleted.
