# Demonstration guide

Every presentation must name the mode visible in the banner. The approved Supabase project is connected and core live API/Auth/Postgres workflows are verified locally and on https://meendoc.vercel.app. Real Arabic/English Gemini responses reached the local browser; the English result returned a matching database card after one timeout retry. The separately authorized hosted English case failed with an upstream Google HTTP 504. Use manual filters/labeled scenarios unless a new live test budget is agreed. Fictional clinicians and bookings remain explicitly disclosed.

## Offline presentation, available now

1. Run npm run dev with APP_MODE=offline (or absent).
2. Open / in Arabic. Choose the starter asking which doctor to see, then a labeled fictional scenario, duration and routine example.
3. Choose Cairo and EGP 500; show filtered fictional cards and open a profile.
4. Pick a slot, use the labeled demo sign-in, enter fictional contact details and confirm.
5. Use app links to open appointments and cancel/reschedule. A full reload resets in-memory booking/auth data.
6. Switch to English and show the same flow. Explain voice fallback if on-device recognition is unavailable.
7. Select the uncertain/emergency example; matching stops and restart is required.

This mode demonstrates interface behavior. It does not demonstrate Gemini, email, Supabase persistence or actual clinic reservations.

## Technical patient presentation

1. Open https://meendoc.vercel.app (or the connected local APP_MODE=demo at http://127.0.0.1:3000). The public deployment's account/database workflows and actual booking/reload/cancellation are verified; check PROJECT_STATUS.md for separate AI/email limits.
2. Use a confirmed controlled patient account for booking; guest browsing/chat needs no account.
3. With real AI enabled and an agreed request budget, type: “عايز دكتور جلدية في اسكندرية والكشف ميعديش ٥٠٠ جنيه.” Accept adult/fictional/Google processing consent.
4. Show the actual network response and matching database cards; verify all returned records meet location, specialty and fee criteria. No invented provider identities are accepted.
5. Open a card, select an actual clinic, date and slot. Confirm that the clinic-specific fee and slot continue into booking.
6. Sign in inside the booking gate; enter fictional contact details and confirm. Show the database-generated MD reference and fee snapshot.
7. Open appointments, reload, then use a separate authenticated session to confirm persistence. Cancel/reschedule and inspect slot release, notification and audit records.
8. Favorite a provider, reload, mark a notification read and request privacy review. The privacy action does not instantly erase data.

If Gemini is disabled/unavailable, explicitly select the scripted example or manual filters; the API can still demonstrate real catalog/auth/bookings once Supabase is configured. Do not call a scripted result “live AI”.

## Doctor and admin presentation

1. Register/confirm a second controlled account intended for a fictional provider. Submit the adult/demo application at /join-as-doctor.
2. Bootstrap a separate confirmed admin out of band. Sign in and open /admin.
3. Review the pending application; select its intended confirmed provider account, add review notes and approve. Confirm a linked draft/unverified profile plus doctor role. Approval is not medical credential verification.
4. Add/link a fictional clinic, fee and schedule, then publish the demo profile. Record the separate demo review only if appropriate; the label never asserts a real licensed clinician.
5. Sign in as the provider at /doctor/dashboard. Edit owned biography, credentials placeholders, clinic and weekly availability/unavailable dates. Check resulting public slots.
6. Open own appointments and apply a permitted cancel/complete status. Try another provider's record and confirm denial.
7. Return as admin to manage bilingual specialty/subspecialty records, announcements and feedback. Show minimal audit history and technical AI usage counters without chat content.

## Separate live validation

Use two distinct confirmed patients competing for the same slot concurrently: exactly one succeeds and the other receives a conflict. Repeat the first request with its original idempotency key: no duplicate appointment. Reschedule into another free slot; inspect the old/new slots and notification records.

Verify patient denial of every admin/doctor resource, provider ownership, admin page denial after logout, expired/revoked session denial, email confirmation/OTP/recovery, and the hosted deployment. These are separate from the local PGlite/mocked-API tests and must be recorded in PROJECT_STATUS.md when performed.

For the existing controlled fixtures, open .meendoc-test-accounts.private.json locally and choose patient1/patient2/doctor/admin. Enter those credentials at /login; do not publish the file. Patient: directory → Dr. Laila Adel → actual clinic/date/slot → booking → appointments/reload → cancel. Doctor: /doctor/dashboard → owned draft biography/save/reload; its test clinic is deliberately inactive. Admin: /admin → overview, approved application/account link, catalog and audit tabs. Final application reviews are read-only. Use the setup/onboarding sequence above for a new provider.

No further Gemini generation is included in the completed test authorization. A new live demonstration consumes quota and requires its agreed request budget; manual filters or labeled examples exercise the real database without Google. Signup/OTP/recovery email demonstrations are pending a usable SMTP provider and actual inbox/link verification.
