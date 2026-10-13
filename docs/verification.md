# MEENDOC verification

Verification checkpoint: 13 October 2026, Windows. APP_MODE=demo connects to the actual approved Supabase project. APP_MODE=offline is the distinct fixture prototype.

## Current results

| Check | Result and scope |
| --- | --- |
| Unit/security/PGlite | 50 passed; four actual migration files applied to a fresh local PostgreSQL engine with an auth shim |
| Automated browser | 20 isolated cases passed: 19 in the final full run plus the corrected technical accessibility case's targeted rerun |
| Hosted API/Auth/Postgres | 11 passed; actual GoTrue sessions, RLS, ownership, concurrency, persistence and revocation |
| Real Gemini | 4 SDK successes + 2 approved UI successes; 3 attempts for the UI cases, one timeout |
| Actual browser patient | Live Gemini result → database profile → sign-in → booking → confirmation → full reload → cancellation/favorites/read notification passed |
| Actual browser provider | Owned draft profile/clinic/schedule rendered; biography saved and recovered after full reload |
| Types/lint | Passed, including final Next production build; 27 compiled HTTP checks and zero private-key matches in 29 browser files |

The two UI Gemini cases reported 1,584 tokens and the SDK checks reported 2,606: total 4,190 known tokens across 6 successful generations. The timed-out attempt may have consumed unreported provider usage. No more Gemini calls are needed for the completed approved verification.

## Automated coverage

The 15 original offline checks cover Arabic/English patient journeys, input validation, deterministic matching, unknown-text/emergency stop, search/sort/filter/compare/favorites, voice fallback, enrollment/management, account privacy and schedules. Five technical API tests explicitly mock responses to cover consent/live-auth UI, database-shaped booking reload/favorites, quota/unavailable states, multiple clinics, empty availability and bilingual accessibility.

Tests start their own offline Next server at port 3100 with .next-test, independently of the connected local demo at port 3000. Google calls are disabled. MEENDOC_TEST_URL can deliberately point at an already-running compatible test server. Chromium is installed through Playwright's official distribution.

Offline accessibility: 28 axe scans (7 routes × 2 languages × 2 widths). Mocked technical accessibility: 12 scans. Both groups previously reported zero WCAG 2 A/AA, 2.1 AA and 2.2 AA violations. Responsive coverage checks 72 combinations at 320/360/390/768/1024/1440px, local fonts/portrait loads and horizontal document overflow. These are automated checks, not a complete accessibility certification.

## Hosted and actual browser evidence

artifacts/cloud/live-verification.json records the 11 live workflows. They include real HTTP-only/SameSite=Lax cookies, public database matching, 15 protected API resource denials, malicious metadata ignored, concurrent patient booking, idempotency, cross-patient denial, reschedule/cancel slot release, persistent accounts/favorites/notifications/privacy, approval and linked provider ownership, direct REST RLS and revoked sessions. Controlled test users are admin-confirmed fictional accounts; this does not verify mail delivery.

artifacts/cloud/gemini-verification.json records only usage/model metadata. Arabic preferences were correctly extracted. English matching returned actual Dr. Laila Adel/dermatology/New Cairo/EGP 500 after one timeout retry. No raw conversation was retained.

artifacts/cloud/live-browser-verification.json records observed browser workflow outcomes. Appointment MD-B5E39347C6E6 survived a full reload, was cancelled, and remains in the cancelled history. The UI test provider is draft and its test clinic inactive. Records/audits are retained; no broad cleanup or reset was run.

Screenshots in artifacts/qa include bilingual offline desktop/mobile views and actual live booking/reload proof. Screen captures are evidence of the visible UI; cloud persistence is separately established by reload/API checks.

## Verification limits

Auth email confirmation/OTP/recovery delivery, scheduled cron execution, real microphone/audio success, Firefox/Safari, real mobile hardware and screen-reader sessions are unverified. No real patient, actual medical diagnosis, professional credential approval, clinic appointment, payment or booking email/SMS is claimed.

Local compiled-production HTTP smoke passed 27 checks. Protected pages correctly emitted Next's streaming login redirect metadata; their protected APIs returned 401. Twenty-nine rebuilt browser files were scanned against the configured private keys/tokens with zero matches. The shared Supabase MCP account has unrelated ERP projects; authorized dashboard access was used only for the supplied MeenDoc project.

The supplied existing Vercel project and GitHub repository are now linked locally and configured for release. Hosted checks will be recorded separately from the local compiled-server results. Gmail SMTP remains blocked by unavailable App Password settings; no email delivery is claimed.

