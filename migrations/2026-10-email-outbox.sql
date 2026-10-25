-- Provisionner AVANT le code ; aucune migration automatique en production.
-- Prerequis : migrations/2026-10-paid-at.sql et 2026-10-bons-cadeaux.sql.
-- Tests locaux isoles : node --test tests/email-outbox*.test.mjs
-- Ils appliquent ce SQL uniquement sur un PostgreSQL jetable, jamais DATABASE_URL.
--
-- Reprise : GET /api/cron/email-outbox, Authorization: Bearer <CRON_SECRET>.
-- Endpoint NON programme : aucun horaire ni cron de production n'est modifie.
-- Le cron lifecycle existant draine egalement la file apres authentification.
-- PRECONDITION DEPLOIEMENT : un passage quotidien ne couvre pas la fenetre de
-- deduplication prudente de 23 h. Prevoir un drain toutes les 5 a 15 min, avec
-- autorisation explicite de changement du planning ; ne pas activer ce SQL seul
-- en presentant la reprise comme garantie. Ne jamais allonger la fenetre de
-- retry pour contourner l'expiration des cles fournisseur.
-- Webhook/page succes tentent aussi le job correspondant, meme deja finalise.
-- Backoff 60s exponentiel plafonne a 1h, 8 tentatives, lease 2min.
-- Resend deduplique 24h : arret prudent a 23h depuis la premiere tentative.
-- exhausted_at != NULL et sent_at IS NULL = investigation MANUELLE, PAS succes.
-- Ne jamais remettre automatiquement a zero first_attempt_at/attempts : verifier
-- d'abord la livraison cote fournisseur, surtout apres timeout ou crash.
-- Le payload contient adresse et liens prives : pas de SELECT * dans les logs.
-- Pas de backfill historique automatique : l'ancien schema ne sait pas prouver
-- si un mail avait deja ete livre ; reconciliation manuelle necessaire.
CREATE TABLE IF NOT EXISTS email_outbox (
  event_key text PRIMARY KEY,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  available_at timestamptz NOT NULL DEFAULT NOW(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  first_attempt_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  sent_at timestamptz,
  exhausted_at timestamptz,
  last_error text
);
CREATE INDEX IF NOT EXISTS email_outbox_pending_idx ON email_outbox(available_at)
  WHERE sent_at IS NULL AND exhausted_at IS NULL;
