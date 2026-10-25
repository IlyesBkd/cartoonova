-- Apply before deploying CODE-04. No automatic production DDL.
CREATE TABLE IF NOT EXISTS upload_contexts (
  id uuid PRIMARY KEY,
  token_hash text UNIQUE NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('checkout','depot','poster','admin')),
  subject text NOT NULL,
  ip_hash text NOT NULL,
  prefix text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS upload_quota_buckets (
  key text PRIMARY KEY,
  used bigint NOT NULL DEFAULT 0 CHECK (used >= 0)
);
CREATE TABLE IF NOT EXISTS upload_reservations (
  id uuid PRIMARY KEY,
  context_id uuid NOT NULL REFERENCES upload_contexts(id),
  pathname text NOT NULL,
  reserved_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS upload_reservation_pathname_unique ON upload_reservations(pathname);
CREATE INDEX IF NOT EXISTS upload_context_expiry ON upload_contexts(expires_at);
-- Reservations are charged at maximum token size, not browser-declared size.
-- Do not automatically refund failures/callbacks: an issued token may still upload.
-- No Blob deletion/cron is installed by this migration.
-- Operational limits (UTC day): public contexts 12/IP; authenticated admin
-- contexts 128/IP in a separate bucket; both share the unchanged 1000 global cap.
-- Reserved uploads: 16/context, 32/subject; public 64/IP, admin 256/IP separately;
-- unchanged shared 1000 globally, each 10 MiB. Admin scope is assigned only
-- after server authentication + existing order lookup, never from upload input.
-- Exact pathname is signed by the SDK with addRandomSuffix=false and
-- allowOverwrite=false. UNIQUE pathname prevents reminting, even after failure.
-- Client UUID filenames sit under an opaque server UUID context prefix.
-- Context TTL 15 minutes; provider token TTL at most 2 minutes.
-- A checkout subject shares the same IP across products/context rotations;
-- depot/poster/admin subjects are scoped to purpose + order ID.
-- Vercel ingress uses x-vercel-forwarded-for. Non-Vercel instances share
-- one conservative local bucket (do NOT trust arbitrary X-Forwarded-For).
-- Expired context/ledger rows intentionally remain: operational retention and
-- orphan Blob inventory need a separately reviewed maintenance job, NOT enabled.
-- Never delete real objects on the basis of context expiry: they can be
-- attached to paid orders and retain their original public URLs.
-- E2E: apply this SQL to the disposable database, then POST /api/upload/context
-- with same-origin Origin + JSON {purpose:'checkout',product:'simpson'}, or
-- {purpose:'depot',token:<signed tracking link>}, {purpose:'poster',token:<poster
-- confirmation token>}, {purpose:'admin',orderId:<uuid>} + x-admin-password.
-- Response {context,prefix,expiresAt}: mock Blob SDK must call the real
-- onBeforeGenerateToken(prefix + 'synthetic.jpg', context, false), NEVER
-- blanket-stub /api/upload success, or authorization/quotas are not exercised.
