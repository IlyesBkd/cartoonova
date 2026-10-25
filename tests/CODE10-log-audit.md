# CODE10 — remaining route/cron log audit

## Result and evidence

- RED: first console-expression regression failed on `app/api/chat/route.ts` leaking the synthetic email; the independent confirm-poster Discord test then failed on the same fixture. New job-journal regression failed on stored private text, and the cyclic-summary regression failed with a RangeError. GREEN after each correction.
- Final isolated regression command: `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" PRIVACY_CAPTURE_DIR="$TMPDIR/code10-captures" node --import tsx --test tests/privacy-route-logs.test.mjs tests/privacy.test.mjs tests/privacy-browser.test.mjs tests/email-outbox-provider.test.mjs tests/email-outbox.test.mjs tests/order-create.test.mjs` — **44/44 passed**.
- TypeScript full-program API check with project tsconfig: **0 diagnostics**. `git diff --check`: clean. The direct tsc executable was blocked by the runtime's script-size scanner; the TypeScript API performed the actual equivalent project check instead.
- Synthetic captures retained at `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/code10-captures/`. New evidence: `route-console-arguments.json` (91 console expressions, 43 source files), `checkout-handler-safe-console.json`, `support-reply-{rejected,thrown}-console.json`, `sync-cron-{success,failed}-console.json`, `csp-handler-safe-outputs.json`, `confirm-poster-safe-discord.json`, `job-journal-safe-write.json`.
- Assertions reject synthetic email, private name, free-form note and access-capability fixtures while preserving order ID / HTTP 422 / operational counters. Support transactional recipient and body remain unchanged; their intended PII is not saved in the safe log captures.

## Changes

- Categorize raw Error, stack, plain provider object and message log arguments at the boundary; retain numeric HTTP status (100–599), static context and existing non-sensitive internal order/payment IDs.
- Restrict cron aggregate logs and new job journal detail writes to allowlisted numeric counters, recursively bounded. No historical log/customer-data deletion or migration.
- CSP console and alert paths reject arbitrary client-supplied directive/source/blocked text; retain known directive/resource categories and normalized private-route kind, not raw URL or arbitrary path.
- Confirm-poster's direct Discord notification now contains operational ID/status/counts, not recipient email, customer note or photo URLs. Other direct business support destinations are not silently disabled.

## Exact boundaries / unresolved scope

1. The 91-expression audit evaluates extracted console argument expressions against synthetic fixtures, not every handler branch. Runtime-isolated transpiled handler coverage includes checkout catch, support provider rejection/throw, sync cron success/catch, actual CSP POST, confirm-poster notification and new job-journal SQL values. DB/email dependencies are in-memory substitutes; neither production DB nor paid API is contacted.
2. Existing error-bearing HTTP responses are **not sanitized by this log-only change** (notably support/orders/prices/traductions/cron responses). UI/support return values in aiReponse can still include provider text. They must not be described as privacy-safe payloads or later logged indiscriminately.
3. `/api/chat` intentionally transports customer email/message to its support Discord channel; `/api/reviews` has its own direct review-content Discord notification. Those business payloads are not covered by the no-PII console assertion. This is not proof that all Discord traffic is PII-free.
4. Replay is **disabled in the final implementation** (`disable_session_recording: true`). Installed SDK snapshot compression precedes `before_send`, so the recursive event sanitizer cannot certify opaque rrweb records. The browser regression first failed with recording enabled, then passed after disabling it; it checks the actual initialized SDK configuration while retaining ordinary commercial events. No enabled production replay or historic recording is certified. Browser identity remains anonymous and server identity uses HMAC: the former automatic browser/server email join is intentionally not preserved.
5. Other reviewers own send-final-image, send-poster-confirmation, bonus/image, orders/extras, emailImageFinale and extras/carteVoeux, plus CRO catalogue/email-i18n/gift/structured-data files. Those files were not edited here. Existing parent diffs are retained.
6. No live production configuration, retention/export/access controls, Vercel platform access logs, provider-side logging, scripts/workflow logs, all browser console calls or historical stored traffic were certified. Log context strings and existing internal IDs are trusted application-generated values, not arbitrary user input.
7. No commit, publication, system cron execution, real email, payment/provider charge or production mutation was performed. All tests ran under `env -i`.

## Exact source/test files changed by this subtask

- `app/api/chat/route.ts`
- `app/api/checkout/lead/route.ts`
- `app/api/contact/route.ts`
- `app/api/cron/lifecycle-emails/route.ts`
- `app/api/cron/retouches/route.ts`
- `app/api/cron/sync-support-inbox/route.ts`
- `app/api/csp/route.ts`
- `app/api/newsletter/route.ts`
- `app/api/newsletter/unsubscribe/route.ts`
- `app/api/order/create/route.ts`
- `app/api/orders/confirm-poster/route.ts`
- `app/api/orders/expedition/route.ts`
- `app/api/orders/review-request/route.ts`
- `app/api/orders/route.ts`
- `app/api/prices/all/route.ts`
- `app/api/prices/route.ts`
- `app/api/promo/route.ts`
- `app/api/promo/validate/route.ts`
- `app/api/reviews/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/support/classify-backlog/route.ts`
- `app/api/support/draft/route.ts`
- `app/api/support/messages/route.ts`
- `app/api/support/outbox/route.ts`
- `app/api/support/reply/route.ts`
- `app/api/support/sync/route.ts`
- `app/api/traductions/route.ts`
- `lib/aiClassify.ts`
- `lib/aiReponse.ts`
- `lib/bonCadeau.ts`
- `lib/confidentialiteMesure.ts`
- `lib/contenuFiche.ts`
- `lib/finaliserCommande.ts`
- `lib/imapSync.ts`
- `lib/indexation.ts`
- `lib/journalTaches.ts`
- `lib/parrainage.ts`
- `lib/productFeed.ts`
- `lib/recompenseAvis.ts`
- `lib/retouches.ts`
- `lib/traduction.ts`
- `tests/privacy-route-logs.test.mjs`

This report: `tests/CODE10-log-audit.md`. Existing profile skill `cartoonova-privacy-transport-testing` was enriched (no new skill).
