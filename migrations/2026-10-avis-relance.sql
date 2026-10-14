-- Relance de la demande d'avis (14 octobre 2026).
--
-- orders.review_reminder_sent_at : date de la relance unique envoyee 10 jours
-- apres la demande d'avis, si aucun avis n'est arrive (cron lifecycle-emails,
-- `sendReviewReminders`).
--
-- A appliquer sur le PostgreSQL du VPS AVANT de deployer le code qui s'en sert
-- (en production, le schema n'est pas cree au demarrage : voir
-- `runtimeSchemaBootstrapEnabled` dans lib/db.ts). Idempotent.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_reminder_sent_at TIMESTAMPTZ;
