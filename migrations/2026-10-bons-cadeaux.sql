-- Bons cadeaux (1er octobre 2026).
--
-- Un bon cadeau est un code promo de type « amount » qui porte un SOLDE : il
-- s'utilise en plusieurs fois, jusqu'a epuisement. Le solde est debite apres
-- paiement (lib/finaliserCommande.ts), jamais a la creation de la commande :
-- un paiement abandonne ne doit pas consommer le bon.
--
-- A appliquer sur le PostgreSQL du VPS AVANT de deployer le code qui s'en sert
-- (en production, le schema n'est plus cree au demarrage : voir
-- `runtimeSchemaBootstrapEnabled` dans lib/db.ts). Idempotent.

ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS solde NUMERIC;
-- Le PaymentIntent qui a paye le bon : garantit qu'un meme paiement ne cree
-- qu'un seul bon, quel que soit l'ordre d'arrivee du webhook et de la page de succes.
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS achat_payment_intent TEXT UNIQUE;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS acheteur_email TEXT;
