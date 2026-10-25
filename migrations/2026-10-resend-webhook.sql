-- Provisionner avant le deploiement ; aucun DDL au traitement des callbacks.
-- Les identifiants sont conserves sans expiration pour bloquer aussi les rejeux
-- re-signes avec un horodatage recent. Ni contenu, ni destinataire, ni secret.
BEGIN;
CREATE TABLE IF NOT EXISTS resend_webhook_events (
  svix_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
COMMIT;
