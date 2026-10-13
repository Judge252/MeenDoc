# Local setup

Windows workspace: `D:\my  business\MEENDOC`. Node 22 LTS or later is recommended; the deployed project uses Node 24. The lockfile pins the installed dependencies.

```powershell
Set-Location -LiteralPath 'D:\my  business\MEENDOC'
npm ci
npm run dev
```

Open http://127.0.0.1:3000. APP_MODE defaults to the clearly labeled offline prototype if absent. Existing .env contains the user's configured Gemini key; do not overwrite it with the example.

## Dedicated Supabase project

The user supplied the MeenDoc organization and project `mofdzltldjwkalvkkbvk`, URL `https://mofdzltldjwkalvkkbvk.supabase.co`. Use only this approved project. Dashboard account passwords are not application API keys or database passwords.

Before remote changes, inspect existing tables/migrations and back up any data. The previous connector account listed unrelated projects; those have not been modified. Dashboard access to MeenDoc was used to inspect the empty project, apply all migrations/seed and record the four migration versions. The existing connector still uses a different account.

If using the CLI, authenticate with the approved project-owning account using its secure login/token flow, then:

```powershell
npx supabase link --project-ref mofdzltldjwkalvkkbvk
npx supabase db push --dry-run
npx supabase db push --include-seed
```

Review the dry run before pushing. Do not use db reset on the remote project. Alternatively apply the four checked-in SQL migrations in order using an authorized migration tool, then the conflict-safe seed. A CLI push will track the checked-in migration versions; dashboard SQL execution alone does not automatically register those versions.

Get the project's existing publishable key and a server-only secret key (or legacy service_role key) from the approved dashboard. Configure them directly in .env, without posting them in chat or source:

| Variable | Setting |
| --- | --- |
| APP_MODE | demo for API-backed mode; offline for the prototype |
| DEMO_SAFE_MODE | true, mandatory |
| NEXT_PUBLIC_APP_URL | http://127.0.0.1:3000 locally; exact HTTPS host when deployed |
| NEXT_PUBLIC_SUPABASE_URL | Approved project URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Existing publishable key; legacy anon key accepted |
| SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY | One privileged server key; never NEXT_PUBLIC |
| RATE_LIMIT_SECRET | ≥32 random characters, server only |
| CRON_SECRET | Independent ≥32 random characters for slot refresh |
| GEMINI_API_KEY | Existing user-supplied server key |
| GEMINI_MODEL | gemini-3.5-flash-lite |
| LIVE_AI_ENABLED | true in the current configured local demo; disable to avoid Google requests |

Remaining defaults and bounds are in .env.example. Restart Next after changing environment values. The public key and URL are intended browser configuration; privileged keys are not.

## Auth and mail

Configure Supabase Auth Site URL and exact redirect allowlist for /auth/callback, /auth/confirm and /reset-password on the local/deployed host. Require email confirmation and password length ≥8. Local config.toml now uses these values; it does not configure a remote project automatically.

Create test accounts through /register with controlled real inboxes and fictional profile/contact details. Confirm the delivered email before sign-in. OTP must be delivered by Supabase; arbitrary codes are rejected. If using token_hash email templates, link to /auth/confirm with the expected type and safe next; otherwise keep the SDK PKCE callback flow.

Password recovery requires a fresh link/session and the signed short-lived recovery cookie. Phone/SMS OTP is not implemented. Auth email requests depend on the project's provider/SMTP quota; API acceptance does not establish delivery. In-app booking notifications need no SMTP.

Bootstrap one existing confirmed demo account outside the public UI:

```powershell
npm run admin:bootstrap -- your-controlled-admin-email
```

This writes the admin role and an audit event with the server key. There is no public admin-registration option. Use another confirmed controlled account for provider onboarding.

## Verification

```powershell
npm run lint
npm run typecheck
npm run db:verify
npm run test:unit
npx playwright install chromium
npm run test:e2e
npm run build
```

Tests do not require Supabase credentials: PostgreSQL tests use PGlite plus an auth shim; technical-mode browser tests explicitly mock API responses. Playwright starts an isolated offline server at port 3100 with Google disabled and a separate .next-test directory. The current Playwright Chromium 1248 installation is available; a fresh machine needs npx playwright install chromium. An optional existing-browser override is:

```powershell
$env:MEENDOC_TEST_BROWSER = 'C:\Users\LENOVO\AppData\Local\ms-playwright\chromium-1161\chrome-win\chrome.exe'
npx playwright test
```

`npm run db:seed` writes seed SQL; `npm run db:types` derives local types. After remote migrations, `npx supabase gen types --project-id mofdzltldjwkalvkkbvk --schema public` can generate actual project types. Never print secrets with env/status commands.

`npm run ai:smoke` sends real fictional prompts to Google and consumes provider quota. Four calls were already verified; further calls require an agreed test budget.

The authorized Vercel project is judge252s-projects/meendoc, production hostname https://meendoc.vercel.app. The local CLI is linked to that exact project; the connector account has no access to this team. Nineteen Production variables are configured, including four Secret values. GEMINI_MAX_ATTEMPTS=1 bounds each hosted request; the local/example default is two. Preview/Development are not configured. Supabase Site URL is the production hostname, with three exact production callbacks plus the retained three local callbacks. GitHub main is linked and production builds reached READY.

Auth mail remains a provider dependency. Custom SMTP is disabled. Gmail sender/host/port/username were prepared as an unsaved draft; the owner reports that Google's App Password setting is unavailable. Use an eligible Gmail App Password or a properly configured transactional SMTP provider through secure fields. Supabase's built-in mail only sends to organization members. Do not disable confirmation or add organization privileges merely to work around delivery.

The four confirmed fictional test accounts are in the ignored .meendoc-test-accounts.private.json file. Open it only locally. npm run verify:live exercises the local API against hosted PostgreSQL; npm run verify:deployment checks the approved production hostname without creating users/providers or calling Gemini. npm run check:secrets scans the compiled client, and npm run verify:http -- https://meendoc.vercel.app verifies production HTTP responses. These explicit live checks mutate only controlled fictional fixtures.
