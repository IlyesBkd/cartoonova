# CODE-03 — local evidence and deployment limits

## RED → GREEN

Command (no inherited provider/database secrets):

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test tests/promo-reservations.test.mjs
```

Observed before production changes:
- Concurrent gift checkout: **12 discounted secrets exposed, expected 1** (`12 !== 1`).
- PENDING order callback consumed quota: **1 used, expected 0**.
- Concurrent payment confirmation left gift balance **3, expected 0**.
- Expired abandoned intent could not be replaced: **409, expected 200** before secure cancellation/release was implemented.

Final dedicated run: **10/10 passed** on disposable PostgreSQL 18, real checkout/order-create/finalizer/outbox, external effects simulated. Covers 12 concurrent gift requests, 10 quota requests, 12 concurrent confirmations and order retries, provider outage/email retry, SQL reservation failure, outbox-insert rollback of all payment/promo changes, exact partial balance, PaymentIntent idempotency, missing/mismatched reservation rejection, cancel-before-release, and succeeded/processing/uncertain outcomes retained past expiry.

Targeted ESLint and project TypeScript (`--noEmit --incremental false`) passed. Existing email-outbox suite also passed (15/15). The existing order-create suite initially had 10/11 passing: its discounted-checkout fixture does not inject the newly imported reservation helper. Parent must adapt that harness (outside this agent's assigned file ownership); it must not use production DATABASE_URL. The dedicated test already exercises the real order-create route with the real reservation/promo SQL.

## Lifecycle and limits

- PaymentIntent created server-side, then its exact discount/quota reserved under a promo row lock, **then** client secret returned. A rejected reservation never returns its client secret; cancellation is attempted.
- Ledger unique by PaymentIntent. PENDING order creation no longer consumes a quota. `orders` paid_at trigger consumes balance/quota and reservation inside the existing PAID/outbox statement; retries on paid_at do not consume again.
- Expiry defaults to 30 minutes but **does not release by time alone**. Next checkout with the same code reconciles at most 10 expired reservations and releases only after provider reports canceled. This is lazy cleanup, not a scheduled exact-time expiry guarantee.
- Paid or processing after expiry remains backed by its original reserved credit; failed/unknown provider cancellation remains held. This prevents a late payment on an old secret receiving a discount already reallocated elsewhere. Such stuck/paid-but-unfinalized holds require payment reconciliation, not blind timeout release.
- Production migration **not applied**. Before deployment, explicitly approve migration, pause discounted checkout, and reconcile/cancel legacy discounted PENDING intents lacking reservations. New trigger deliberately rejects those legacy pending payments. Already-paid orders remain unchanged. Do not manufacture/backfill reservations or reset historical used_count without reconciliation.
- Rollback is not application-code-only: restoring the old finalizer debit while retaining the trigger would debit twice. Coordinate code/schema rollback during maintenance.
- Simulations establish the provider contract but are **not a real Stripe acceptance test**. No real Stripe call, email, production data mutation, cron change, commit or push was performed.

Files: `app/api/checkout/route.ts`, `lib/promoCodes.ts`, `lib/finaliserCommande.ts`, new `lib/promoReservations.ts`, `migrations/20261025_promo_reservations.sql`, `tests/promo-reservations.test.mjs`, and this note. Shared procedure added to the Cartoonova skill's `references/promo-reservations-testing.md`.
