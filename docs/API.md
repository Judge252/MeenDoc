# API contract

Node route handlers dispatch through src/server/router.ts. All responses use `{data,requestId}` or `{error:{code,message},requestId}`, JSON content type and no-store/Vary Cookie. Cookies are sent with same-origin requests. Mutations require application-origin validation and JSON; bodies are capped at 24 KiB. Unknown fields are rejected by mutation schemas.

Business endpoints return 503 OFFLINE_MODE in explicit offline mode. Configuration failures return safe unavailable errors. Typical status codes: 400 validation, 401 missing live session, 403 role/ownership/origin, 404 inaccessible resource, 409 booking conflict, 413 oversized body/context, 429 quota, 503 integration failure. Database details, credentials and raw prompts are not returned.

## Public and auth

| Method | Path | Contract |
| --- | --- | --- |
| GET | /api/health | Mode; safe demo flag; database configured/readiness; auth/AI/email configuration indicators, no keys |
| GET | /api/specialties | Bilingual specialties and subspecialties with stable IDs/slugs |
| GET | /api/locations | Governorates/cities with parent IDs |
| GET | /api/announcements | Active scheduled bilingual announcements |
| GET | /api/doctors | Preferences + q, sort, lang, page and pageSize; doctors, total and matchCriteria |
| GET | /api/doctors/:id | Published accessible profile, clinics, prices and available slots; UUID or original doctor-1…doctor-16 slug |
| GET | /api/doctors/:id/availability | Future slots; optional clinicId UUID |
| POST | /api/assistant/message | language, message/action, bounded history, optional preferences/scenario and versioned consent |
| POST | /api/doctor-applications | name, specialty slug, governorate, area, registration, clinic, email contact, adultConsent=true, demoConsent=true |
| POST | /api/feedback | category usability/catalog/technical, rating 1–5, text ≤600, demoConsent=true |
| POST | /api/auth/login, /register | email, password 8–72, optional name/next; registration requires adultConsent |
| POST | /api/auth/logout | Global Supabase sign-out; no fake local-only success in demo mode |
| POST | /api/auth/recovery, /email-otp | email and optional safe next; requested/provider-dependent response does not claim delivery |
| POST | /api/auth/verify-otp | email, delivered 6–8 digit code, optional next; provider validates the code |
| POST | /api/auth/password | password 8–72; authenticated recovery session plus signed 15-minute recovery cookie required |
| GET | /auth/callback, /auth/confirm | PKCE code or email token_hash callback, constrained redirect |

Search preferences: specialty/subspecialty/governorate/area default all; maxFee 0–5000 (default 2000); gender all/female/male; timing all/morning/evening; maxDays 1–30; optional ISO date. q ≤100; sort availability/price/name; lang ar/en; page 1–1000; pageSize 1–100. Directory identifiers are validated against active database records. Filtering uses one matching provider-clinic association for fee, geography and availability.

Assistant actions are message, preferences, restart, scenario or scripted. Message ≤1000 characters, schema history ≤16 bounded messages; configured provider context normally uses the last 12. Consent is `{adult:true,fictional:true,google:true,version:"meendoc-ai-v1"}`. Output includes mode live/scripted, reply, preferences, phase, safetyStatus and actual database doctors. A model proposal cannot authorize an action.

## Patient

| Method | Path | Contract |
| --- | --- | --- |
| GET/PATCH | /api/me | Own user/roles/preferences; patch only name, Egyptian phone, language, location, reminders |
| GET/POST/DELETE | /api/favorites | Own doctor UUID list; write body doctorId |
| GET/POST | /api/appointments | Own appointments; book with slotId, UUID idempotencyKey, patient:{name,phone} |
| GET | /api/appointments/:recordId | Own appointment; recordId is UUID, distinct from human-readable MD reference |
| POST | /api/appointments/:recordId/cancel | Empty JSON object |
| POST | /api/appointments/:recordId/reschedule | New slotId UUID |
| GET/PATCH | /api/notifications | Own records; mark read with id UUID |
| POST | /api/privacy/request | Empty JSON object; saves pending review, does not delete data |

Booking contact is fictional demo contact only: name 2–80, phone normalized ASCII Egyptian mobile format. Requests contain no patient ID, price, doctor ID, clinical note or authorization role. Appointment DTOs include recordId/reference, doctor/clinic/slot, Cairo date/time, status and server feeSnapshot.

## Doctor and administrator

All paths below recheck roles and ownership on the server and in PostgreSQL.

| Method | Doctor path | Contract |
| --- | --- | --- |
| GET/PATCH | /api/doctor/profile | Linked profiles; permitted localized name/bio, fee, credentials/experience; no status, verification, role or account grants |
| GET/PATCH | /api/doctor/clinics | Owned associations; clinic name/address/active only when exclusively owned |
| GET/POST/PATCH/DELETE | /api/doctor/availability | List; add weekly rule; set day exception; delete rule by id+doctorClinicId |
| GET/PATCH | /api/doctor/appointments | Owned appointments; id+status cancelled/completed |
| GET | /api/doctor/applications | Own linked/submitted applications |

Weekly rule: doctorClinicId, dayOfWeek 0–6, startTime/endTime HH:mm, duration 15–120. Exception: doctorClinicId, ISO date, unavailable and optional override times/reason. Clinic/location values are checked against the directory.

| Method | Admin path | Contract |
| --- | --- | --- |
| GET | /api/admin/overview | Database counts, seven daily AI counter windows and configured request-limit warning |
| GET | /api/admin/accounts | First 100 auth accounts with confirmation indicator for linking; no passwords |
| GET/PATCH | /api/admin/applications | Review id, under_review/approved/rejected, notes, linkedUserId/doctorId |
| GET/POST/PATCH | /api/admin/doctors | Draft creation; permitted profile, specialties, location, account linking, publication and separate demo review |
| GET/POST/PATCH | /api/admin/specialties | Bilingual slug/name/active; optional parentId for subspecialty |
| GET/POST/PATCH | /api/admin/clinics | List/create; patch id with name/address/active |
| POST | /api/admin/doctor-clinics | doctorId, clinicId, fee; create/link or update fee |
| GET/PATCH | /api/admin/appointments | Overview and permitted cancellation/completion |
| GET/POST/PATCH | /api/admin/announcements | Localized content, active, optional ISO startsAt/endsAt |
| GET | /api/admin/audit-events | Minimal action records; page (50 rows/page) |
| GET/PATCH | /api/admin/feedback | Review status open/resolved |
| GET/PATCH | /api/admin/privacy-requests | Review status reviewed/completed; actual data-erasure process is manual |
| GET | /api/internal/slots/refresh | Bearer CRON_SECRET required; privileged slot generation |

Doctor/appointment/application lists and admin collection reads are bounded. The current admin UI does not provide comprehensive paging of every collection. Review terminal statuses cannot be rolled back into pending states through this endpoint.
