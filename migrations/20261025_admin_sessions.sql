-- CODE-09: additive only. Apply before deploying session authentication.
BEGIN;
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 credential_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS admin_login_buckets (
 bucket_key text PRIMARY KEY,
 attempts integer NOT NULL CHECK (attempts > 0),
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_login_buckets_expiry_idx ON admin_login_buckets(expires_at);
COMMIT;
