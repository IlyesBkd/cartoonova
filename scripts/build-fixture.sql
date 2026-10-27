-- SYNTHETIC BUILD FIXTURE ONLY. Not a production migration or schema backup.
-- Empty base tables sufficient for public prerender reads and repository migrations.
-- Never apply to an existing DB: the harness creates its own fresh cluster first.
CREATE TABLE orders (
 id uuid PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'PENDING',
 payment_intent_id text,
 promo_code text,
 discount_amount numeric,
 poster_confirmation_token text
);
CREATE TABLE promo_codes (
 code text PRIMARY KEY,
 kind text NOT NULL DEFAULT 'amount',
 value numeric NOT NULL DEFAULT 0,
 currency text,
 active boolean NOT NULL DEFAULT true,
 starts_at timestamptz,
 ends_at timestamptz,
 min_subtotal numeric NOT NULL DEFAULT 0,
 max_uses integer,
 used_count integer NOT NULL DEFAULT 0
);
CREATE TABLE prices (
 id text PRIMARY KEY,
 data jsonb,
 base numeric, fullbody_extra numeric, extra_person numeric, extra_animal numeric,
 digital numeric, canvas numeric, poster numeric, poster_simple numeric
);
-- No singleton row: real application fallback is exercised by prerendering.
CREATE TABLE support_messages (
 id serial PRIMARY KEY,
 email text NOT NULL,
 message text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now()
);
-- Articles/reviews/product content are provisioned from their in-repo runtime
-- schema definitions by the local application (VERCEL unset), with empty content.
