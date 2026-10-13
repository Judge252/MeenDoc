# Deployment and release verification

The user approved GitHub Judge252/MeenDoc and the existing Vercel project judge252s-projects/meendoc. The local CLI verified and linked project prj_70i615YEtWUoh73niKmLoPcNKGo7 under team_JkMVXzABIkxw16PkKKUvZJSh. The connector lacks this scope; no unrelated team was changed. Source is pushed to main and automatic Git-linked production builds reached READY. The canonical URL is https://meendoc.vercel.app. Hosted HTTP and controlled account/database checks passed; see PROJECT_STATUS.md for exact AI and SMTP results.

## Release sequence

1. Confirm the dedicated Supabase schema/migration history and apply reviewed migrations/seed. Verify hosted RLS, grants and advisors.
2. Configure controlled Auth accounts, exact redirect URLs, confirmed email delivery and private server keys. Exercise registration, login, refresh, logout and recovery.
3. Run unit/browser/type/lint/build checks. Verify two separate live patients competing for a slot, cancellation/rescheduling, linked doctor ownership and admin denial.
4. Select the approved Vercel account/project and import/upload this Next.js project. Do not add paid integrations. Install with npm ci; build with npm run build.
5. Add environment values through secure Vercel fields, selecting the correct Preview/Production environments. Use distinct random secrets and the correct HTTPS app URL.
6. Keep DEMO_SAFE_MODE=true. Enable real Gemini only with consent, quotas and an agreed test budget. All doctors and bookings remain visibly fictional.
7. Add the deployed host's callback URLs to Supabase. Test the deployed browser → API → Auth/Postgres → response journey. Only then describe it as deployed/verified.

Do not publish credentials, make private tables public, disable RLS, enable anonymous auth to bypass account setup or expose privileged functions to solve a deployment failure.

## Prepared runtime settings

- APIs run in Node.js; no separate backend host is needed.
- The deployed vercel.json schedules /api/internal/slots/refresh once daily at 02:00 UTC, with Production CRON_SECRET configured. Vercel supplies its Bearer credential. The scheduled execution itself remains unverified; slot generation was verified through the database/API workflows.
- The refresh endpoint generates BOOKING_WINDOW_DAYS slots (default 14) while preserving booked records.
- HTTP-only cookies use Secure on an HTTPS app URL, SameSite=Lax and the application path. Authenticated responses are private/no-store. Admin/doctor layouts are dynamic and server-gated in demo mode.
- next.config.ts security headers and the existing local asset/font pipeline are retained. Review any external host additions before changing policy.

For local production serving, stop the development process occupying port 3000, then:

```powershell
Set-Location -LiteralPath 'D:\my  business\MEENDOC'
npm run build
npm start
```

## Operational checks and rollback

Validate /api/health configuration indicators without interpreting them as provider delivery proof. Check safe errors and server logs, no-store behavior, public asset responses, correct RTL/LTR rendering and absence of server secrets in browser bundles.

Run Supabase security/performance advisors after migration. Monitor shared AI request counters and the provider's actual billing/quota dashboard; internal tokens are not exact spend. Configure backups and appropriate retention before live data use.

Revert a faulty app deployment to the previously verified version while preserving database data. Use a forward corrective migration for schema fixes. Backup restoration, data deletion, key rotation and any paid upgrade require their appropriate explicit authorization.

The production domain is https://meendoc.vercel.app. Framework/build/install settings are Next.js, npm run build and npm ci, with Node 24. Nineteen Production variables were configured through CLI stdin; Gemini/Supabase/rate/cron secrets use Secret type and private test files are excluded from Git and deployment uploads. Production rate/cron secrets are separate from local values. GEMINI_MAX_ATTEMPTS=1 ensures one provider attempt per hosted request; the local/example default allows at most two. There are no Preview/Development application variables. Supabase's production/local redirects are configured.

After each reviewed source push, inspect the exact deployment and wait for READY. Run node scripts/verify-http.mjs https://meendoc.vercel.app for read-only HTTP checks; npm run verify:deployment deliberately mutates the existing controlled fictional accounts/bookings and revokes their sessions. Neither script makes Gemini or email requests. Hosted verification passed 27 HTTP checks and eight controlled workflows, separately from the 27 local compiled-server checks. Protected Next pages may return a streamed 200 with verified login redirect metadata; their protected APIs return 401.
