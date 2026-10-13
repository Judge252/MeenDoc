# MEENDOC technical demonstration status

Checkpoint: 13 October 2026. The approved UI now uses real Next.js APIs, Supabase Auth/PostgreSQL and Gemini. Source is published to the approved GitHub repository and the Vercel production deployment is live. Hosted HTTP, controlled account/database workflows and actual browser booking/reload/cancellation passed. Two approved hosted English Gemini attempts failed; the last returned upstream HTTP 504. SMTP remains blocked. This is an adult-only, fictional, non-clinical demonstration.

## Connected infrastructure

- Supabase: MeenDoc organization, project `mofdzltldjwkalvkkbvk`, `https://mofdzltldjwkalvkkbvk.supabase.co`, Free/Nano, Ireland. The empty schema was inspected before changes; unrelated ERP projects were untouched.
- Four CLI-created migrations applied and their versions visibly verified in hosted migration history. All 23 public tables have RLS. The original seed contains 16 fictional providers and seven specialties; initial slot generation produced 672 slots.
- One additional controlled provider fixture remains draft/unverified and its test clinic is inactive. Cancelled test appointments/audits are retained.
- Existing publishable/server keys configured privately in ignored .env; no account password was used as an application credential. Auth requires confirmed email; anonymous sign-in/manual linking are disabled.
- Official @google/genai 2.28.0 with gemini-3.5-flash-lite; LIVE_AI_ENABLED=true, output cap 700, current timeout 30 seconds. Four SDK successes plus two approved live UI successes: 6 successful responses, 4,190 reported tokens. The UI cases used 3 attempts, including one timeout with unreported usage. No further provider requests are authorized by that completed test budget.
- Separately, the owner approved one hosted English case with at most two provider attempts. Both UI submissions failed; safe diagnostics on the last attempt confirmed Google HTTP 504. Production was reduced to one provider attempt per submission to prevent hidden retries. Timeout reporting and the misleading database-unavailable status label were corrected and regression-tested. The hosted English success remains BLOCKED; its allowance is exhausted and no additional Google request was sent.
- Vercel target is the existing judge252s-projects/meendoc project, prj_70i615YEtWUoh73niKmLoPcNKGo7, https://meendoc.vercel.app. The local CLI is authenticated to the intended owner; the connector account lacks that team. Framework is Next.js, Node 24, install npm ci and build npm run build. Nineteen Production variables are configured, including four Secret values; no paid upgrade was made. GEMINI_MAX_ATTEMPTS=1 prevents hidden provider retries during bounded hosted verification. The exact production/local Supabase Auth callbacks are saved. GitHub main at https://github.com/Judge252/MeenDoc is connected to automatic Vercel production builds; the implementation and subsequent diagnostic builds reached READY.

## Implementation and evidence

Modular server services cover accounts, catalog/matching, booking, applications, providers, administration, quotas and AI. Zod/origin/body checks, safe errors, HTTP-only SSR sessions/proxy, current database roles, RLS and ownership are enforced. Booking uses database fees, idempotency, doctor/slot locks and overlap constraints. Raw chat stays out of database/audit/request logs; minimal assistant preferences/latch expire after 24 hours.

Latest local unit/security/PGlite run: **53 passed**, including all four migrations and safe provider logging/attempt-limit checks. All 20 isolated browser cases passed: the final full run passed 19, and the one remaining technical accessibility/screenshot case passed its targeted rerun after changing a transient hidden-element selector to its accessible visible textbox. The configured-origin assertion was also fixed. Both complete bilingual journeys passed. Tests use a separate offline server at port 3100 and .next-test, with Google calls disabled.

Separate local-API-to-cloud verification passed **11 API/Auth/Postgres workflows**, including four controlled GoTrue accounts, 15 privileged resources denied to guests/patients, one winner/one conflict under concurrent bookings, idempotency, cancellation/rescheduling slot release, profile/favorites/notifications/privacy persistence, linked draft provider approval, owned updates, direct REST RLS and global-session revocation. The deployed HTTPS app also passed **27 public HTTP checks and eight controlled account/database workflows**, including Secure/HTTP-only/SameSite cookies, concurrency, persistence, ownership and revoked access. These are actual cloud checks; PGlite and mocked browser tests do not substitute for them.

Actual browser evidence: live English Gemini returned Dr. Laila Adel from the database at EGP 500; patient sign-in, clinic/date/time booking, MD reference, full-reload persistence, cancellation, favorites and notification-read mutation passed. A provider biography edit survived full reload, and the owned inactive clinic's actual fee (420) is displayed correctly. Administrator overview/usage counters and the approved application's confirmed account link were observed. Terminal application reviews are read-only.

On the public Vercel app, controlled patient sign-in, actual clinic/slot selection and booking returned MD-4B31F8D39A45 at EGP 500. That record survived a full /appointments reload and remained in cancelled history after browser cancellation. The test did not send an email or reserve a real clinic appointment.

Evidence files in artifacts/cloud include live-verification.json, gemini-verification.json, live-browser-verification.json, hosted-http-verification.json, hosted-workflow-verification.json, hosted-browser-verification.json, hosted-gemini-verification.json and deployment-verification.json. Ignored .meendoc-test-* fixtures contain synthetic test passwords/cookies; never publish them.

Supabase advisors flagged four missing catalog foreign-key indexes; the additive fourth migration fixed them and all four indexes were visibly verified. RLS-with-no-policy on ai_usage_counters/private.assistant_sessions is intentional deny-all client access. Fresh-database unused-index suggestions do not justify removing indexes. Leaked-password protection requires a paid plan and remains disabled; no upgrade was made.

## Acceptance criteria

| # | Brief criterion | Status / evidence |
| --- | --- | --- |
| 1 | Preserve visual identity | PASS — approved coral/white UI, local fonts and original portrait atlas retained |
| 2 | Guest entry and interaction | PASS — browser guest directory and assistant |
| 3 | Real Gemini reaches UI | PASS locally — approved Arabic extraction and English database result; separately BLOCKED hosted English case: upstream HTTP 504 |
| 4 | Gemini keys server-side | PASS — server-only adapter; 29 compiled client files scanned with zero server-secret matches |
| 5 | Validate AI structured output | PASS — Zod, canonical directory/evidence rules and tests |
| 6 | No autonomous unreviewed diagnosis/triage | PASS technical boundary — explicit specialty search; no clinical validation claimed |
| 7 | Search Supabase records | PASS — hosted matching and UI |
| 8 | No hallucinated provider cards | PASS — all cards loaded by actual database IDs |
| 9 | Database profile data | PASS — actual UUID profile/clinic/fee |
| 10 | Database availability | PASS — actual slot IDs/Cairo timestamps |
| 11 | Real Supabase Auth | PASS — GoTrue password login/cookies; email delivery separately unverified |
| 12 | Enforce roles/permissions | PASS — live denial/RLS tests |
| 13 | Bookings persist | PASS — live API plus full browser reload |
| 14 | Prevent double booking | PASS — two live patients: one success/one conflict |
| 15 | Favorites persist | PASS — live API and browser reload |
| 16 | Cancel/reschedule | PASS — live slot release; browser cancellation retained |
| 17 | Applications persist | PASS — hosted application record |
| 18 | Approval/provider onboarding | PASS — linked confirmed account, draft profile and doctor role |
| 19 | Provider ownership | PASS — allowed owned update; other-provider/verification writes denied |
| 20 | Protected admin pages | PASS — live API/server guard; production HTTP verifies the actual streaming login redirect |
| 21 | Disclose synthetic demo data | PASS — technical/offline/live/scripted/unavailable labels |
| 22 | No raw symptom persistence/logging | PASS — reviewed storage/log boundaries and tests; Google has separate processing terms |
| 23 | No exposed secrets | PASS — final 29-file browser scan; ignored source/upload exclusions |
| 24 | Automated key journeys | PASS — 53 unit/security/PostgreSQL checks and all 20 isolated browser cases |
| 25 | Types/build pass | PASS — final types/lint/build; local compiled production HTTP smoke passed 27 checks |
| 26 | Accurate documentation | PASS checkpoint — nine required documents/README record the implementation, hosted checks and explicit SMTP/Gemini limits |

## External and production requirements

- Auth signup/OTP/recovery delivery: **BLOCKED by usable SMTP configuration**. The owner authorized a test inbox and Gmail sender, but Google's App Password setting is unavailable. Custom SMTP is currently disabled; the prepared Gmail draft is unsaved. Synthetic test accounts were confirmed with the admin API. Next: enable eligible Google App Password access or configure a transactional SMTP provider in secure settings, then verify actual inbox/link/code/reset behavior.
- Public deployment: **LIVE** at the approved existing target, from GitHub main. Hosted public HTTP, controlled account/database workflows and actual browser booking/reload/cancellation passed. The separate English Gemini case is **BLOCKED by upstream HTTP 504** after the two approved attempts. Next: obtain a new bounded live-test allowance before checking provider recovery; the verified manual/scripted database search remains available.
- Booking email/SMS and scheduled reminder delivery: not implemented; actual in-app notifications and a saved preference are disclosed.
- Real clinician verification, clinical review, payments, automated privacy erasure/export, production retention/backups and operational monitoring are outside the verified fictional demo. Free project backups are not configured.
- Microphone transcription/playback, Safari/Firefox, physical mobile devices and screen-reader sessions remain unverified.
- Production dependency audit previously returned zero known vulnerabilities; five dev-tool advisory findings remain in the lint dependency chain.

Current verification: 53 unit/security/PostgreSQL tests; all 20 browser cases passed across recorded runs, including the AI-failure case's additional passing rerun after the status-copy fix; types/lint and the latest production build passed; 27 local compiled-production and 27 hosted HTTP checks; eight additional hosted controlled workflows; all 29 freshly rebuilt browser files scanned with zero private-key matches. GitHub main is published and linked to production CI. The connected local dev server is at http://127.0.0.1:3000. Remaining exact steps: the owner saves a usable SMTP credential, then delivered signup/OTP/recovery tests can run; another hosted Gemini generation requires a new bounded allowance to verify provider recovery.
