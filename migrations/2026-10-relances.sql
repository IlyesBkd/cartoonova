-- Relances et parrainage (1er octobre 2026).
--
-- 1. checkout_leads : les visiteurs qui saisissent leur e-mail a l'etape 1 de
--    la caisse puis partent. Relances une fois, 24 h apres, par le cron
--    lifecycle-emails (app/api/cron/lifecycle-emails, `sendLeadReminders`).
-- 2. orders.print_upsell_sent_at : proposition du poster aux clients du
--    fichier numerique, une fois par adresse (`sendPrintUpsell`).
-- 3. promo_codes.parrain_email / parrain_lang : codes de parrainage AMI-…
--    (lib/parrainage.ts). L'index UNIQUE garantit un seul code par parrain,
--    meme si deux pages le creent au meme instant.
--
-- A appliquer sur le PostgreSQL du VPS AVANT de deployer le code qui s'en sert
-- (en production, le schema n'est plus cree au demarrage : voir
-- `runtimeSchemaBootstrapEnabled` dans lib/db.ts). Idempotent.
-- Suppose migrations/2026-10-bons-cadeaux.sql deja applique.

CREATE TABLE IF NOT EXISTS checkout_leads (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  locale TEXT NOT NULL,
  style TEXT,
  print_key TEXT,
  total NUMERIC,
  currency TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reminded_at TIMESTAMPTZ
);
-- Dedoublonnage a l'insertion (meme adresse sous 24 h) et exclusions du cron.
CREATE INDEX IF NOT EXISTS checkout_leads_email_idx ON checkout_leads (lower(email), created_at DESC);
-- La file du cron : leads jamais relances.
CREATE INDEX IF NOT EXISTS checkout_leads_a_relancer_idx ON checkout_leads (created_at) WHERE reminded_at IS NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS print_upsell_sent_at TIMESTAMPTZ;

ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS parrain_email TEXT;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS parrain_lang TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_parrain_email_idx
  ON promo_codes (lower(parrain_email)) WHERE parrain_email IS NOT NULL;
