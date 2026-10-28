-- DISPOSABLE PREPARATION ONLY. Never run against an existing/production database.
-- Not in migrations/: no runtime DDL, no connection configured by this fixture.
CREATE SCHEMA IF NOT EXISTS gift_guide_preparation;
CREATE TABLE IF NOT EXISTS gift_guide_preparation.sessions (
 token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 session_id uuid UNIQUE NOT NULL,
 cohort text NOT NULL CHECK (cohort IN ('control','guided-v1')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '24 hours',
 retain_until timestamptz NOT NULL DEFAULT clock_timestamp() + interval '30 days',
 events text[] NOT NULL DEFAULT '{}',
 CHECK (cardinality(events) <= 3),
 CHECK (events <@ ARRAY['viewed','exposed','clicked']),
 CHECK (cohort <> 'control' OR cardinality(events) = 0)
);
CREATE TABLE IF NOT EXISTS gift_guide_preparation.checkouts (
 payment_intent_id text PRIMARY KEY CHECK (payment_intent_id ~ '^pi_[a-zA-Z0-9]{1,100}$'),
 token_hash text NOT NULL REFERENCES gift_guide_preparation.sessions(token_hash) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS guide_retention_idx ON gift_guide_preparation.sessions(retain_until);
