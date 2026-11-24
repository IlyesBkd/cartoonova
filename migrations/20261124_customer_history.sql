-- Additive, explicit deployment only. Never backfill inferred send evidence.
CREATE TABLE IF NOT EXISTS customer_history_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT clock_timestamp(),
  customer_email text NOT NULL,
  order_id uuid,
  kind text NOT NULL,
  status text NOT NULL CHECK(status IN ('recorded','sent','scheduled','uncertain','failed')),
  subject text,
  body text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(details)='object'),
  attempt_id uuid,
  provider_id text,
  sent_at timestamptz,
  CHECK (customer_email = lower(btrim(customer_email))),
  CHECK (status <> 'sent' OR sent_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS customer_history_email_date ON customer_history_events(customer_email,at DESC,id DESC);
CREATE INDEX IF NOT EXISTS customer_history_order_date ON customer_history_events(order_id,at DESC,id DESC);
CREATE INDEX IF NOT EXISTS customer_history_attempt ON customer_history_events(attempt_id,at DESC);
CREATE INDEX IF NOT EXISTS customer_history_provider ON customer_history_events(provider_id) WHERE provider_id IS NOT NULL;
CREATE OR REPLACE FUNCTION customer_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'customer history is append-only'; END $$;
DROP TRIGGER IF EXISTS customer_history_immutable ON customer_history_events;
CREATE TRIGGER customer_history_immutable BEFORE UPDATE OR DELETE ON customer_history_events FOR EACH ROW EXECUTE FUNCTION customer_history_immutable();
DROP TRIGGER IF EXISTS customer_history_no_truncate ON customer_history_events;
CREATE TRIGGER customer_history_no_truncate BEFORE TRUNCATE ON customer_history_events FOR EACH STATEMENT EXECUTE FUNCTION customer_history_immutable();

-- JSON extraction tolerates minimal fixtures / older additive schemas. Only the
-- named keys enter the journal: never tokens, addresses or the complete row.
CREATE OR REPLACE FUNCTION customer_history_order_changes() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE before_row jsonb := '{}'::jsonb; after_row jsonb; k text; before_value jsonb; after_value jsonb;
  fields text[] := ARRAY['photo_urls','final_image_url','final_image_scheduled_at',
    'poster_confirmation_image_url','poster_confirmation_sent_at','poster_confirmation_status',
    'poster_confirmation_responded_at','poster_confirmation_note','poster_confirmation_photos',
    'status','statut_force','fournisseur_ref','cout','cout_note','suivi_url',
    'suivi_transporteur','shipping_details','expedie_le'];
BEGIN
  after_row := to_jsonb(NEW);
  IF TG_OP = 'UPDATE' THEN before_row := to_jsonb(OLD); END IF;
  FOREACH k IN ARRAY fields LOOP
    before_value := before_row->k; after_value := after_row->k;
    IF before_value IS DISTINCT FROM after_value AND
       NOT (TG_OP='INSERT' AND (after_value IS NULL OR after_value='null'::jsonb OR after_value='[]'::jsonb)) THEN
      INSERT INTO customer_history_events(customer_email,order_id,kind,status,details)
      VALUES(lower(btrim(NEW.customer_email)),NEW.id,'order.'||k,
        CASE WHEN k='final_image_scheduled_at' AND after_value <> 'null'::jsonb THEN 'scheduled' ELSE 'recorded' END,
        jsonb_build_object('field',k,'before',before_value,'after',after_value));
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS customer_history_order_changes ON orders;
CREATE TRIGGER customer_history_order_changes AFTER INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION customer_history_order_changes();
-- Exact normalized identity lookups, no name heuristics.
CREATE INDEX IF NOT EXISTS orders_history_email ON orders(lower(btrim(customer_email)));
-- Source tables can be absent in a minimal build fixture; do not bootstrap them.
DO $$ BEGIN
 IF to_regclass('support_messages') IS NOT NULL THEN
   EXECUTE 'CREATE INDEX IF NOT EXISTS support_history_email ON support_messages(lower(btrim(from_email)),received_at DESC,id)';
 END IF;
 IF to_regclass('support_replies') IS NOT NULL THEN
   EXECUTE 'CREATE INDEX IF NOT EXISTS replies_history_email ON support_replies(lower(btrim(to_email)),sent_at DESC,id)';
 END IF;
END $$;
