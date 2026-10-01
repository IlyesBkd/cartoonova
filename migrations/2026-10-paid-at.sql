-- Date de paiement des commandes (1er octobre 2026).
--
-- `orders.status` porte deux vocabulaires a la fois : 'PENDING' / 'PAID', pose
-- par le paiement (marquerPayee), et new / in_progress / completed / shipped,
-- pose par l'admin. Des que l'admin touche une commande, 'PAID' disparait, et
-- tout filtre `status = 'PAID'` (relance photos, garde du panier abandonne,
-- sonde de l'entonnoir) devient aveugle a cette commande. `paid_at` dit « a ete
-- payee » une fois pour toutes, quel que soit le statut de suivi.
--
-- Contrat : `paid_at IS NOT NULL` <=> la commande a ete payee. Seul
-- marquerPayee (lib/db.ts) l'ecrit, au plus une fois.
--
-- A appliquer sur le PostgreSQL du VPS AVANT de deployer le code qui s'en sert
-- (en production, le schema n'est plus cree au demarrage : voir
-- `runtimeSchemaBootstrapEnabled` dans lib/db.ts). Idempotent.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Rattrapage des commandes deja payees. La vraie date de paiement n'a jamais
-- ete gardee : `created_at` en est l'approximation la plus proche (le paiement
-- suit la creation de quelques minutes). Toute commande sortie de PENDING l'a
-- ete par un paiement (marquerPayee) ou par l'admin sur une commande payee ;
-- le PaymentIntent exige ecarte les lignes saisies a la main sans paiement.
-- `paid_at IS NULL` rend la requete rejouable sans ecraser une vraie date.
UPDATE orders
SET paid_at = created_at
WHERE paid_at IS NULL
  AND status <> 'PENDING'
  AND payment_intent_id IS NOT NULL;

-- Les relances et la sonde filtrent sur ce critere : l'index partiel ne porte
-- que sur les commandes payees, une minorite de la table.
CREATE INDEX IF NOT EXISTS orders_paid_at_idx ON orders (paid_at) WHERE paid_at IS NOT NULL;
