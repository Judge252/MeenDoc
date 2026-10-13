# AI system

The provider interface in src/server/ai/contracts.ts isolates Google from UI/business logic. The official `@google/genai` 2.28.0 adapter uses the configurable stable Flash-class model `gemini-3.5-flash-lite`, JSON structured output and strict Zod validation.

Four real provider smoke calls succeeded: two Arabic, two English, 2,606 total reported tokens. The revised prompts returned canonical Alexandria, dermatology and EGP 500 preferences. Those SDK calls verified credentials and structured responses. Two additional approved browser cases then verified Arabic preference extraction and an English Gemini-to-Supabase matching card. The English case timed out at 15 seconds and succeeded on one retry at 30 seconds; three adapter attempts were used for those two cases. Completed browser responses reported 1,584 tokens in addition to the 2,606 SDK-smoke tokens. Failed/aborted generation may incur provider usage without reported tokens. Do not rerun paid/quota-consuming smoke calls casually.

## Orchestration

1. Load/create the HTTP-only-cookie assistant session and enforce shared database quotas.
2. Require adult, fictional-demo and Google text-processing consent before live generation.
3. Provide the active specialty directory, prior validated preferences, language and bounded in-memory context.
4. Validate untrusted output and apply navigation-only evidence/claim rules.
5. Normalize and validate location/specialty identifiers against the actual directory.
6. Search PostgreSQL deterministically when the validated action permits it.
7. Format factual result counts and return only database provider cards.
8. Retain preferences/latch/consent version and count usage; never store raw prompts or replies.

Model output contains reply, enumerated intent, nullable extractedPreferences with explicit specialtyEvidence, nextQuestion, uiAction ask/show_filters/search/stop, up to four suggestedOptions, conversationStatus and safetyStatus. Unknown fields, invented tool calls, invalid enums and unrecognized identifiers cannot execute business operations.

The model has no database tools and cannot book, assign roles, publish a provider or fabricate cards. It can propose search preferences. A specialty requires explicit specialty-name evidence in user messages; unsupported symptoms lead to uncertainty instead of autonomous symptom-to-specialty mapping.

## Boundaries

Versioned policy/prompt modules: prompt-v1.ts and safety-v1.ts. The assistant is a non-clinical directory/navigation demonstration. It does not diagnose, assess severity, prescribe, recommend doses, interpret medical results or provide personalized triage.

Explicit eyes/skin/joint scenarios are fictional UI examples labeled as requiring clinician review. They have not been clinically validated. The emergency example sets a minimal session latch and halts matching until a successful restart. Model safety/keyword/claim filters are defensive checks with false-positive/false-negative risk; they are not a dependable emergency detector. Review by qualified clinicians and privacy/legal professionals is required before any real healthcare deployment.

Live outages, invalid output, timeout and quota failure are visible. The user can deliberately choose the labeled scripted example mode or manually browse. No failed Gemini request is represented as live AI success.

## Limits and privacy

Code/example default timeout 15 seconds, configurable 1–30 seconds. The current local and Production settings use 30 seconds after the verified live timeout recovery. Default output limit 700 tokens, input message ≤1000 characters, provider history 12 messages, combined context 12,000 characters. GEMINI_MAX_ATTEMPTS is one or two (default two); Production currently uses one to keep the approved hosted test budget exact. When two are allowed, at most one transient provider retry reserves another shared request; provider 429 and invalid output do not retry. Operational failures log only a numeric status, allowlisted reason and attempt number, never provider messages or chat text.

Default limits: 20 assistant requests/hour per pseudonymous ingress/session/user and 200 provider attempts/day globally. Counters are stored in PostgreSQL, not process memory. Fixed daily usage windows are UTC. HMAC subjects use RATE_LIMIT_SECRET. The admin UI shows counts/tokens and an 80% request-limit warning; these counters are not a provider invoice or exact cost measurement.

Chat text stays in browser memory and the bounded request. It is sent to Google only after consent; Google's own processing/retention is governed by the user's provider account terms. MEENDOC does not promise zero third-party retention. The private 24-hour assistant record contains no text. Consent records and technical counters have minimal pseudonymous metadata; broader retention/cleanup policy still needs production review.

Voice is separate: browser on-device recognition only when reported available, without a language-pack download or cloud speech service. Unsupported browsers offer text and clearly labeled example phrases. Successful microphone capture remains unverified on this machine.

Configuration: server-only GEMINI_API_KEY, GEMINI_MODEL, LIVE_AI_ENABLED, timeouts/history/token limits and shared quota settings in .env.example. See SETUP.md. Reference: [Google Gemini models](https://ai.google.dev/gemini-api/docs/models) and [structured output](https://ai.google.dev/gemini-api/docs/structured-output).
