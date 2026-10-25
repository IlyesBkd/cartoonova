-- Apply before deploying checkout. Existing PAID orders are unchanged; legacy
-- discounted PENDING intents require manual review/cancellation (no backfill of
-- credit that may already have been promised twice).
CREATE TABLE IF NOT EXISTS promo_reservations (
  payment_intent_id text PRIMARY KEY,
  code text NOT NULL REFERENCES promo_codes(code),
  discount numeric(12,2) NOT NULL CHECK (discount > 0),
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','consumed','released')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  released_at timestamptz
);
CREATE INDEX IF NOT EXISTS promo_reservations_active_code_idx
  ON promo_reservations(code, expires_at) WHERE state = 'reserved';

-- Lock the code FIRST in every mutation. Statement-local snapshots in this
-- VOLATILE function are refreshed after a waiting row lock under READ COMMITTED.
CREATE OR REPLACE FUNCTION reserve_checkout_promo(pi text, promo text, amount numeric, subtotal numeric, curr text)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE p promo_codes%ROWTYPE; held numeric; uses bigint; r promo_reservations%ROWTYPE; allowed numeric;
BEGIN
  SELECT * INTO p FROM promo_codes WHERE code = promo FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO r FROM promo_reservations WHERE payment_intent_id = pi;
  IF FOUND THEN RETURN r.code = promo AND r.discount = amount AND r.state = 'reserved'; END IF;
  SELECT COALESCE(sum(discount),0), count(*) INTO held, uses
    FROM promo_reservations WHERE code = promo AND state = 'reserved';
  IF NOT p.active OR (p.starts_at IS NOT NULL AND p.starts_at > now())
    OR (p.ends_at IS NOT NULL AND p.ends_at < now()) OR subtotal < p.min_subtotal
    OR (p.kind = 'amount' AND p.currency IS NOT NULL AND p.currency <> curr)
    OR (p.max_uses IS NOT NULL AND p.used_count + uses >= p.max_uses)
    THEN RETURN false; END IF;
  allowed := round(LEAST(CASE WHEN p.kind = 'percent' THEN subtotal * p.value / 100
    ELSE COALESCE(p.solde - held, p.value) END, GREATEST(subtotal - 1,0)),2);
  IF amount <= 0 OR amount <> allowed THEN RETURN false; END IF;
  INSERT INTO promo_reservations(payment_intent_id,code,discount) VALUES(pi,promo,amount);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION release_canceled_promo_reservation(pi text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE promo text;
BEGIN
  SELECT code INTO promo FROM promo_reservations WHERE payment_intent_id = pi;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM 1 FROM promo_codes WHERE code = promo FOR UPDATE;
  UPDATE promo_reservations SET state = 'released', released_at = now()
    WHERE payment_intent_id = pi AND state = 'reserved' AND expires_at <= now();
END $$;

-- Runs inside the existing PAID + confirmation-outbox statement: a failure in
-- any of the three writes rolls back all three. Retries on paid_at are no-ops.
CREATE OR REPLACE FUNCTION consume_order_promo_reservation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r promo_reservations%ROWTYPE;
BEGIN
  IF OLD.paid_at IS NOT NULL OR NEW.paid_at IS NULL
    OR NEW.promo_code IS NULL OR COALESCE(NEW.discount_amount,0) <= 0 THEN RETURN NEW; END IF;
  PERFORM 1 FROM promo_codes WHERE code = NEW.promo_code FOR UPDATE;
  SELECT * INTO r FROM promo_reservations
    WHERE payment_intent_id = NEW.payment_intent_id FOR UPDATE;
  IF NOT FOUND OR r.state <> 'reserved' OR r.code <> NEW.promo_code
    OR r.discount <> NEW.discount_amount THEN
    RAISE EXCEPTION 'Promo reservation missing or mismatched' USING ERRCODE = '23514';
  END IF;
  UPDATE promo_codes SET used_count = used_count + 1,
    solde = CASE WHEN solde IS NULL THEN NULL ELSE solde - r.discount END
    WHERE code = r.code AND (solde IS NULL OR solde >= r.discount)
      AND (max_uses IS NULL OR used_count < max_uses);
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserved promo credit unavailable' USING ERRCODE = '23514'; END IF;
  UPDATE promo_reservations SET state = 'consumed', consumed_at = now()
    WHERE payment_intent_id = r.payment_intent_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_consume_promo_reservation ON orders;
CREATE TRIGGER orders_consume_promo_reservation BEFORE UPDATE OF paid_at ON orders
  FOR EACH ROW EXECUTE FUNCTION consume_order_promo_reservation();
