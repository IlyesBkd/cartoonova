CREATE TABLE IF NOT EXISTS support_prepared_replies (
  id uuid PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN ('message', 'order')),
  target_id text NOT NULL,
  frozen_order_id uuid,
  to_email text NOT NULL,
  subject text NOT NULL,
  body_text text NOT NULL,
  assistee_ia boolean NOT NULL DEFAULT false,
  transport jsonb NOT NULL,
  approval_hash text NOT NULL CHECK (approval_hash ~ '^[0-9a-f]{64}$'),
  approved_at timestamptz,
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'sending', 'sent', 'uncertain')),
  provider_id text,
  provider_sent_at timestamptz,
  resolved_at timestamptz,
  prior_outbound_id text,
  reply_id integer REFERENCES support_replies(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_prepared_attachments (
  id uuid PRIMARY KEY,
  draft_id uuid NOT NULL REFERENCES support_prepared_replies(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  filename text NOT NULL,
  content_type text NOT NULL,
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 2097152),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  UNIQUE (draft_id, position)
);

-- Once approved, neither the payload nor its approval can be rewritten.
CREATE OR REPLACE FUNCTION support_freeze_approved_reply() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.approved_at IS NOT NULL OR NEW.approved_at IS NOT NULL OR OLD.status <> 'prepared' OR OLD.provider_id IS NOT NULL OR OLD.provider_sent_at IS NOT NULL OR OLD.resolved_at IS NOT NULL OR OLD.reply_id IS NOT NULL OR OLD.prior_outbound_id IS NOT NULL) AND
     (ROW(OLD.target_type,OLD.target_id,OLD.frozen_order_id,OLD.to_email,OLD.subject,OLD.body_text,OLD.assistee_ia,OLD.transport,OLD.approval_hash)
      IS DISTINCT FROM ROW(NEW.target_type,NEW.target_id,NEW.frozen_order_id,NEW.to_email,NEW.subject,NEW.body_text,NEW.assistee_ia,NEW.transport,NEW.approval_hash)
      OR (OLD.approved_at IS NOT NULL AND NEW.approved_at IS DISTINCT FROM OLD.approved_at)) THEN
    RAISE EXCEPTION 'approved support snapshot is immutable';
  END IF;
  IF OLD.approved_at IS NULL AND NEW.approved_at IS NOT NULL AND
    (OLD.status <> 'prepared' OR NEW.status <> 'prepared' OR
     ROW(OLD.id,OLD.created_at,OLD.prior_outbound_id,OLD.provider_id,OLD.provider_sent_at,OLD.resolved_at,OLD.reply_id)
       IS DISTINCT FROM ROW(NEW.id,NEW.created_at,NEW.prior_outbound_id,NEW.provider_id,NEW.provider_sent_at,NEW.resolved_at,NEW.reply_id) OR
     NEW.prior_outbound_id IS NOT NULL OR NEW.provider_id IS NOT NULL OR NEW.provider_sent_at IS NOT NULL OR NEW.resolved_at IS NOT NULL OR NEW.reply_id IS NOT NULL) THEN
    RAISE EXCEPTION 'invalid approval transition or delivery evidence';
  END IF;
  IF OLD.approved_at IS NOT NULL OR OLD.status <> 'prepared' OR OLD.provider_id IS NOT NULL OR OLD.provider_sent_at IS NOT NULL OR OLD.resolved_at IS NOT NULL OR OLD.reply_id IS NOT NULL OR OLD.prior_outbound_id IS NOT NULL THEN
    IF ROW(OLD.id,OLD.created_at) IS DISTINCT FROM ROW(NEW.id,NEW.created_at) THEN
      RAISE EXCEPTION 'approved support snapshot is immutable';
    END IF;
    IF NOT (NEW.status = OLD.status OR
      (OLD.status = 'prepared' AND NEW.status = 'sending') OR
      (OLD.status = 'sending' AND NEW.status IN ('uncertain','sent')) OR
      (OLD.status = 'uncertain' AND NEW.status = 'sent')) THEN
      RAISE EXCEPTION 'invalid support delivery transition';
    END IF;
    IF (OLD.status <> 'prepared' AND NEW.prior_outbound_id IS DISTINCT FROM OLD.prior_outbound_id)
      OR (OLD.status = 'prepared' AND NEW.status = 'prepared' AND NEW.prior_outbound_id IS DISTINCT FROM OLD.prior_outbound_id)
      OR (OLD.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id)
      OR (OLD.provider_sent_at IS NOT NULL AND NEW.provider_sent_at IS DISTINCT FROM OLD.provider_sent_at)
      OR (OLD.reply_id IS NOT NULL AND NEW.reply_id IS DISTINCT FROM OLD.reply_id)
      OR (OLD.resolved_at IS NOT NULL AND (NEW.resolved_at IS NULL OR NEW.resolved_at < OLD.resolved_at))
      OR (NEW.status = 'sent' AND (NEW.provider_id IS NULL OR NEW.provider_sent_at IS NULL OR NEW.resolved_at IS NULL))
      OR (NEW.status <> 'sent' AND (NEW.provider_id IS NOT NULL OR NEW.provider_sent_at IS NOT NULL OR NEW.resolved_at IS NOT NULL OR NEW.reply_id IS NOT NULL)) THEN
      RAISE EXCEPTION 'support delivery evidence is immutable or inconsistent';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS support_freeze_approved_reply ON support_prepared_replies;
CREATE TRIGGER support_freeze_approved_reply BEFORE UPDATE ON support_prepared_replies FOR EACH ROW EXECUTE FUNCTION support_freeze_approved_reply();

CREATE OR REPLACE FUNCTION support_preserve_delivery_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.approved_at IS NOT NULL OR OLD.status <> 'prepared' OR OLD.provider_id IS NOT NULL
    OR OLD.provider_sent_at IS NOT NULL OR OLD.resolved_at IS NOT NULL OR OLD.reply_id IS NOT NULL
    OR OLD.prior_outbound_id IS NOT NULL THEN
    RAISE EXCEPTION 'support delivery evidence is immutable';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS support_preserve_delivery_evidence ON support_prepared_replies;
CREATE TRIGGER support_preserve_delivery_evidence BEFORE DELETE ON support_prepared_replies FOR EACH ROW EXECUTE FUNCTION support_preserve_delivery_evidence();

CREATE OR REPLACE FUNCTION support_freeze_approved_attachment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id uuid; frozen boolean;
BEGIN
  -- Lock both parents in deterministic order for a move; approval serializes on the same row.
  FOR parent_id IN SELECT DISTINCT x FROM unnest(ARRAY[CASE WHEN TG_OP <> 'INSERT' THEN OLD.draft_id END, CASE WHEN TG_OP <> 'DELETE' THEN NEW.draft_id END]) x WHERE x IS NOT NULL ORDER BY x LOOP
    SELECT approved_at IS NOT NULL OR status <> 'prepared' OR provider_id IS NOT NULL OR provider_sent_at IS NOT NULL OR resolved_at IS NOT NULL OR reply_id IS NOT NULL OR prior_outbound_id IS NOT NULL INTO frozen FROM support_prepared_replies WHERE id=parent_id FOR UPDATE;
    IF frozen THEN RAISE EXCEPTION 'approved support attachments are immutable'; END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS support_freeze_approved_attachment ON support_prepared_attachments;
CREATE TRIGGER support_freeze_approved_attachment BEFORE INSERT OR UPDATE OR DELETE ON support_prepared_attachments FOR EACH ROW EXECUTE FUNCTION support_freeze_approved_attachment();
