# MEENDOC V1

Arabic-first RTL / English LTR healthcare-directory **technical demonstration**. The approved frontend now connects to modular Next.js APIs, Supabase Auth/PostgreSQL and the official Google Gemini SDK. Every provider and clinic booking remains fictional; the product is not approved for real patient care.

## Run

```powershell
Set-Location -LiteralPath 'D:\my  business\MEENDOC'
npm ci
npm run dev
```

Open [MEENDOC locally](http://127.0.0.1:3000). The current ignored .env is configured for the approved Supabase project `mofdzltldjwkalvkkbvk`. Server keys remain private. Do not replace it with .env.example.

The installed stack is Next.js 16.4.0, React 19.3.0, TypeScript, Tailwind 4, Lucide, @supabase/ssr, Zod and @google/genai. Database migrations, seed, API contracts and generated schema types are checked in.

## Features and modes

- Guest directory search/chat; validated AI search preferences and deterministic database matches.
- Real HTTP-only Auth sessions, protected roles and ownership checks.
- Transactional booking, server fee snapshots, idempotency, concurrent-slot protection, cancellation/rescheduling and in-app notifications.
- Persistent profiles/favorites, applications, linked provider onboarding, schedules, admin management, audits and technical usage counters.
- Explicit Google/adult/fictional consent; no raw chat database storage or operational prompt logging.
- `APP_MODE=demo` uses actual APIs and Supabase; errors stay visible. `LIVE_AI_ENABLED` controls Google requests.
- `APP_MODE=offline` preserves the labeled in-memory prototype. Its sign-in/bookings are simulated and reset on a full reload.

The original 16 fictional profiles, local portrait atlas, fonts, coral/white branding and responsive layouts are preserved. No real clinician credentials, reviews or outcomes are fabricated. Unsupported voice uses text or clearly labeled examples; microphone capture remains unverified.

## Verification

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

50 local unit/security/PostgreSQL checks and 20 automated browser checks have passed. Browser coverage includes the original offline journeys and five explicitly mocked technical API contracts; those mocks are not cloud verification. Separate live verification passed 11 hosted API/Auth/Postgres workflows, including two real patients competing for a slot, role denial, provider onboarding and revoked-session access.

`npm run verify:live` targets only the approved project and intentionally creates/updates fictional controlled test records. It makes no Gemini calls. Test account passwords/session cookies are stored only in ignored private fixture files. Do not publish or commit those files.

`npm run ai:smoke` consumes real Google quota; four SDK checks were already verified. Further live testing is bounded by the approved test budget. Read the current status report for actual Gemini/browser results and remaining limitations.

To serve a production build, stop the dev server on port 3000, then run `npm run build` and `npm start`. The authorized deployment target is judge252s-projects/meendoc at https://meendoc.vercel.app; source/deployment verification is in progress. See the current status for the final result.

## Documentation

- [Current implementation and acceptance status](docs/PROJECT_STATUS.md)
- [Architecture and Mermaid diagram](docs/ARCHITECTURE.md)
- [Database, RLS, transactions and migration strategy](docs/DATABASE.md)
- [HTTP/API contracts](docs/API.md)
- [Gemini orchestration and safety boundaries](docs/AI_SYSTEM.md)
- [Setup, auth and secure configuration](docs/SETUP.md)
- [Deployment preparation](docs/DEPLOYMENT.md)
- [Security, privacy and known limits](docs/SECURITY.md)
- [Patient, doctor and admin demonstration steps](docs/DEMO_GUIDE.md)

Auth email confirmation/OTP/recovery delivery and publicly hosted deployment require separate verification. Booking emails/SMS, payments, real credential verification and automatic privacy erasure are not implemented. In-app notifications and pending privacy-review requests are actual database records.

The supplied frontend brief and airbnb ui.md remain the visual reference. Refero research was attempted earlier but the live service returned NO_SUBSCRIPTION; the existing approved design/reference was retained.

Repository destination: https://github.com/Judge252/MeenDoc. Production setup uses the existing approved Vercel project and retains the original local Supabase project. npm run verify:deployment performs controlled hosted workflows with no Google requests; npm run check:secrets verifies compiled browser assets. Auth mail remains pending a usable SMTP credential/provider; the authorized Gmail account currently cannot create an App Password.

