# Cerebras Board Studio

Local React/Vite portfolio demo. Start with `npm run dev`, then open http://127.0.0.1:5173/. Run `npm test` and `npm run build` for verification. AI is mocked by default; optional local BYOK uses real Cerebras. Account controls remain unavailable until Supabase is configured. No real email, provider requests, credential grants or publication have occurred.

## Board interactions
The sidebar is removed. Compact status-grouped cards open an in-page task editor for title, description, priority and status. New task or C opens the same dialog; each column has a + action. Cancel/Escape discards unsaved edits. Save or Ctrl/Cmd+Enter commits. Drag a card or its handle between columns to change status. The handle supports touch dragging and Left/Right keyboard movement; each task's custom menu also offers status changes. Menus support arrows, Home/End, Escape, Tab and touch selection. Priority uses four rising signal bars: Low/Medium/High/Urgent fill 1/2/3/4 bars. Urgent has a fixed red treatment that remains readable across themes; labels and filled-bar counts give non-color cues. The same component appears on cards, editor controls, menus and read-only snapshots. Task data stays in this browser's localStorage; there is no Supabase task sync.

Reference interactions: [Linear board layout](https://linear.app/docs/board-layout), [issue creation](https://linear.app/docs/creating-issues), [display options](https://linear.app/docs/display-options). Branding and implementation are independent.

## Presentation boundary
The permanent glass control pill uses trusted CSS independent of theme tokens. AI only supplies the bounded schema in src/theme.js: hex colors, fixed font/density/layout enums, radius 0–24 and a short name. No generated HTML, JS, network CSS or task changes. Errors preserve the last working style, and Undo restores it. The conservative style-request filter is a scope guard, not a proof against prompt injection. Schema validation is applied on both server and client.

Dictation is opt-in browser speech recognition, may use vendor servers, and is unsupported in some browsers. No hosted transcription integration is selected.

## Supabase authentication
src/supabase-adapter.js supports Google/GitHub, magic-link or email-code passwordless options, PKCE code exchange, sign-out and session subscription using an injected SDK client. The passwordless method is not finalized. UI contains no fake email submission or fake signed-in state. server/auth.js verifies each bearer token using Supabase auth.getUser(token) and requires a confirmed email. Shared Cerebras access uses a server-owned approved-email list; everyone else needs BYOK plus a verified account.

Official references: [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [OAuth](https://supabase.com/docs/reference/javascript/auth-signinwithoauth), [email OTP/magic links](https://supabase.com/docs/reference/javascript/auth-signinwithotp). Access-token validity after sign-out follows Supabase's token lifetime; immediate application-level revocation requires an additional server denylist/session policy.

BYOK is stored only in the user's browser. The backend uses it transiently for the upstream Authorization header and never logs/persists it. Browser storage is accessible to same-origin script. Owner keys exist only in server configuration, never frontend or snapshots. No service-role Supabase key is required for getUser verification.

## Live-ready server composition (not activated)
server/live.js exports createLiveServer with dependencies: server Supabase client, HTTPS origin, absolute databasePath, ownerKey, approvedEmails, limits and reviewed rates. It returns an unbound Node HTTP server. Explicit allowLocalDevelopment permits only localhost/127.0.0.1 port 5173 for local auth testing; HTTPS is otherwise required. Importing it makes no provider call and opens no port. The host supplies @supabase/supabase-js with persistSession:false and autoRefreshToken:false. Runtime needs Node 20+ and Python 3 with SQLite. Keep the database outside web-served paths on a durable local volume.

POST /api/style requires same-origin JSON and bearer auth; bodies are limited to 4096 bytes and only prompt/byok accepted. Replies are no-store, errors generic. The provider adapter has a 10-second timeout, 32 KiB response bound, 2048 completion-token cap including reasoning, finish-reason check, and final-content-only parsing. Model is qwen-3.8-27b with reasoning_effort medium and reasoning_format parsed, with strict JSON response_format. Account access and sufficient output budget remain untested.

## Durable quotas and budget
server/ledger.py uses SQLite BEGIN IMMEDIATE and synchronous FULL transactions. Limits cover per-minute/per-user daily/global daily requests, cross-process concurrent requests, and daily owner budget. UTC days are used. Attempts consume rate/request quota even after failure, preventing refund abuse. Reservations are atomic and survive restarts. Pending pre-dispatch reservations can be cancelled/refunded. Dispatched failures/timeouts or crashes retain full conservative charge; validated usage settles actual cost and refunds unused budget. Expired leases release concurrency after 60 seconds. Actual usage beyond the reservation trips a persistent circuit breaker requiring operator investigation.

Explicit rates.inputMicrosPerMillion and rates.outputMicrosPerMillion use integer micro-USD per million tokens (1 USD = 1,000,000 micro-USD). Reserve 4096 input + 2048 output tokens at reviewed upper-bound prices. limits.globalBudgetMicros must be explicitly positive for live server startup. No prices are assumed. BYOK has zero owner cost but shares rate, daily and concurrency caps. The SQLite file contains hashed user IDs, request accounting and stripped snapshots, not prompts, raw identities, bearer tokens or keys.

This adapter supports multiple processes sharing ONE local SQLite volume. Multiple hosts must share a transactional database service instead; network filesystems/ephemeral disks are unsupported. Provider price changes, taxes and external account usage require a reviewed safety margin and provider-side spend cap. The quota system does not promise a provider invoice ceiling under incorrect prices or outside use.

## Explicit snapshot sharing
Local UI previews use frozen theme + trusted example tasks, not private tasks. They remain unchanged until Republish preview, and can be revoked. Local links work only on this browser/origin.

Server snapshot adapter persists sanitized example snapshots in SQLite. POST /api/snapshots creates, PUT /api/snapshots/:id republishes, DELETE revokes; all require verified owner auth and origin checks. GET returns only the stripped read-only design/example data and grants no AI entitlement. It never returns ownership/auth metadata. Public publication remains disabled until a host is authorized and connected. No browser UI calls these routes yet.

## Activation decisions and remaining deployment work
- Supabase project sezokkremtxvznshoauv is user-created (endpoint in .env.example); OAuth callbacks/providers and passwordless email method/templates still need verified setup. No credential entry in chat.
- Supply server-only Cerebras key, approved-email config, reviewed provider price bounds and budget, and a durable SQLite volume. Allowlist administration is trusted server configuration, not a user-editable UI.
- Supabase/style runtime is wired behind VITE_ENABLE_AUTH and VITE_ENABLE_LIVE_AI flags, both false by default. Copy the nonsecret .env.example into ignored .env.local only via approved secure configuration. npm run start:api uses that file and binds loopback port 8787; Vite proxies /api. Hosted snapshot UI integration remains gated on publication authorization. Configure TLS/reverse proxy and frontend/API same origin. Disable proxy/platform request-header/body logging and ensure crash reporting redacts secrets. Add edge IP limits for unauthenticated/oversized traffic and snapshot read/write abuse.
- Authorize actual auth/provider smoke tests and public deployment. GitHub source publication and Vercel baseline deployment are authorized; hosted AI activation remains gated. ONE and ModRetro were not touched.

## Verification
24 automated tests pass, including concurrent SQLite reservations, restart persistence, safe refunds, crash leases, budget breaker, BYOK privacy, verified Supabase identity contract, HTTP rejection boundaries, and owner-only snapshot republish/revoke. Production build passes. Earlier browser checks verified local persistence, restyle, Undo, error preservation, frozen snapshots and revocation. Updated browser QA verified repeated open/cancel, clean draft reset, create/edit/save, custom priority/status menus, End/Enter keyboard selection, handle ArrowRight movement, menu status change surviving reload, pointer drag from In progress to To do, and 390px account/task dialog layout. Dialog title focus and invoking-control focus restoration were fixed and verified. Touch pointer support is implemented but has not been tested on physical touch hardware.

Latest priority browser QA: all four menu levels and screen-reader labels verified; Urgent retained four filled bars and fixed red styling after Paper restyle; Undo restored Midnight. Updated full-page screenshot saved to the existing Library file (version 1). Browser viewport override reset.

## Local live setup contract
Canonical app/Supabase Site URL: `http://127.0.0.1:5173/`. Exact allowed redirect: `http://127.0.0.1:5173/`. OAuth and passwordless auth return to `/`, where runtime.js exchanges the PKCE code. Provider dashboards use the Supabase callback `https://sezokkremtxvznshoauv.supabase.co/auth/v1/callback`. Do not mix localhost and 127.0.0.1 origins for this setup.

Ignored `.env.local` is prepared at the repository root, mode 0600, with blank credential fields. Enter the publishable Supabase project key in SUPABASE_PUBLISHABLE_KEY and VITE_SUPABASE_PUBLISHABLE_KEY. The owner's Cerebras key goes ONLY in CEREBRAS_API_KEY. APPROVED_EMAILS contains the owner's confirmed sign-in email (comma-separated additions require owner approval). No service-role Supabase key is needed. Do not paste any keys into chat.

`node --env-file=.env.local scripts/check-config.js` reports presence only. After approved secure configuration, `npm run start:api` starts the loopback API and `npm run dev` runs the app proxy. Enable VITE_ENABLE_AUTH for real sign-in; enable VITE_ENABLE_LIVE_AI only after the provider key and smoke budget are approved. Vite must restart when environment settings change.

Current official Qwen price: input $0.99/M tokens, output $1.49/M tokens: https://inference-docs.cerebras.ai/models/qwen-3.8-27b . Strict schema docs: https://inference-docs.cerebras.ai/capabilities/structured-outputs . Proposed smoke config (not activated): INPUT_MICROS_PER_MILLION=990000, OUTPUT_MICROS_PER_MILLION=1490000, DAILY_BUDGET_MICROS=30000, GLOBAL_DAILY_REQUESTS=3. Reserve at most $0.007107 per request, about $0.021321 for three, including all input/output caps. The three-request cap applies to the entire local API budget day, preventing unapproved retries. No automatic retries. Medium reasoning is enabled; truncation still fails closed.

## Local real BYOK

Run `npm run dev` and `npm run start:byok`, with `VITE_ENABLE_LOCAL_BYOK=true` in ignored `.env.local`. Open http://127.0.0.1:5173/, Account → Your own API key → Save locally, then Restyle. This loopback-only path does not create an account or grant shared-key access. It uses a process-local capability, exact host/origin checks, durable daily cap of three requests and concurrency of one. No provider call happens at startup. Keys are transient upstream credentials; only accounting reaches SQLite. Medium reasoning and final output share 2048 tokens. Actual model access and paid output quality remain untested.

## Vercel baseline

Node 24.x is declared for Vercel. The default production build is a local-data demo with AI/auth disabled. The loopback BYOK server and SQLite/Python accounting are local-only and cannot serve Vercel functions. Hosted AI and hosted snapshots require a serverless adapter plus reviewed shared durable quotas, Supabase auth configuration, and deployment secrets before enabling production flags. Do not enable paid AI with an ephemeral in-memory quota store.
