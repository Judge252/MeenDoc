# Security and privacy

This is an adult-only, fictional, non-clinical technical demonstration. Technical functionality is not approval for patient care. Use controlled test inboxes and fictional contact/profile data.

## Enforced boundaries

- Server-only Gemini and privileged Supabase credentials; .env files ignored except the value-free example.
- HTTP-only Supabase SSR cookies, HTTPS Secure flag, verified getUser() sessions and fresh database roles.
- Protected admin/doctor server layouts and guarded APIs; hidden navigation is not the access control.
- RLS on exposed tables, ownership rules, column grants and hardened transaction functions.
- Roles live in user_roles; editable auth metadata/profile inputs cannot elevate privilege.
- JWT session IDs are checked against auth.sessions in protected database access; deleted/anonymous sessions are rejected.
- Same-origin JSON mutations, strict Zod schemas, bounded body/query/context, safe redirects and safe error messages.
- Shared PostgreSQL request limits for auth/public submissions/assistant and global provider attempts.
- Booking locks/constraints, database prices and explicit state transitions; no patient identity or price accepted from a browser.
- Parameterized reads/fixed admin write allowlists. The AI cannot write records or call arbitrary tools.
- Minimal audit events and request logs; no raw prompts, passwords, tokens, clinical chat or appointment contact values in operational logs.

The server role key bypasses RLS by design. Its use is restricted to reviewed server modules: quotas/assistant state, authorized administration and bootstrap. Never move it to browser code or expose a general SQL endpoint.

## Retained data

| Data | Location / lifetime |
| --- | --- |
| Chat text | Browser memory and bounded request to Google after consent; no MEENDOC database transcript |
| Assistant preferences/status/latch | Private session table; 24-hour expiry |
| Language, favorite fictional IDs, broad location, reminder preference | Four-field browser preference allowlist |
| Profiles, favorites, demo appointments and applications | Supabase until reviewed retention/deletion; normal authorized reads |
| Consent version, pseudonymous usage counters, audit actions | Minimal database metadata; production retention review pending |
| Booking notifications | Own account in-app records; no booking email/SMS provider |

The privacy request action saves a pending request. Admin review/completion flags do not implement automatic data erasure. An operator must perform the authorized deletion/export process and verify it before claiming completion. Deleting an account/backup/audit history is not an automatic demo action.

Google is a third-party processor when live AI is selected. The consent UI explains this; do not promise zero provider retention. Voice uses reported on-device capabilities only; actual microphone success has not been verified.

## Known limits and release requirements

PGlite auth fixtures do not test hosted GoTrue, SMTP or physical browser cookie refresh. Separate live checks have verified concurrent booking, password sign-in, account/provider linking, direct REST RLS and revoked sessions. The public Vercel deployment additionally passed HTTPS cookie flags and controlled account/database workflows. Auth email delivery remains unverified. Mocked browser tests verify UI contracts, not cloud persistence.

Gemini failure diagnostics retain only an allowlisted reason, numeric provider status and attempt number. They never retain the raw provider message, request URL, headers, key, stack trace or chat content. A security regression test covers this boundary; the configurable attempt cap prevents hidden verification retries.

Navigation evidence/claim filters and explicit emergency examples are not validated clinical triage. They may miss or incorrectly classify requests. Obtain clinician, privacy and legal review and a real credential-verification workflow before genuine healthcare use.

Implement a production retention schedule, account deletion/export process, provider monitoring, external notification delivery if promised, abuse/CAPTCHA policy and approved clinical escalation content before moving beyond fictional demonstrations. None of those claims is inferred from a local build.

Production dependency audit currently reports zero known vulnerabilities. Five high findings remain in the development lint/tool chain through braces; a safe upstream compatible fix was not available at the checkpoint. Do not force-downgrade Next.js to clear an unrelated dev advisory. Recheck after a supported dependency update.

Use secure environment fields for secrets. Credentials disclosed in a chat should be rotated by their owner through the service's normal account controls; do not copy them into documentation.
