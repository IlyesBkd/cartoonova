-- Statut de commande impose a la main (21 octobre 2026).
--
-- Le statut de suivi affiche dans le tableau de bord est desormais calcule a
-- partir de ce que la commande porte deja (apercu envoye, reponse du client,
-- fichier parti, colis remis) : voir lib/statutCommande.ts. Cette colonne ne
-- sert qu'a l'exception, quand l'admin veut imposer un statut que la base ne
-- peut pas deviner. NULL = statut calcule.
--
-- `orders.status` n'est pas reutilise : il porte le paiement (PENDING / PAID)
-- et les anciens statuts saisis a la main, qui figeraient toutes les commandes
-- passees s'ils etaient relus comme des forcages.
--
-- A appliquer sur le PostgreSQL du VPS AVANT de deployer le code qui s'en sert.
-- Idempotent.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS statut_force TEXT;
