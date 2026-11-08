-- Additive only. Apply explicitly before enabling VPS writes; no legacy mutation.
CREATE TABLE IF NOT EXISTS storage_objects (
  reference text PRIMARY KEY,
  legacy_url text UNIQUE,
  internal_path text UNIQUE NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  bytes integer NOT NULL CHECK (bytes BETWEEN 1 AND 10485760),
  content_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);
