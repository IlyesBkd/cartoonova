# FLOW-04 — `gift_lang`, procédure préparée, non exécutée en production

## Preuve locale

`node --test tests/gift-language-migration.test.mjs` crée son propre cluster PostgreSQL 18, avec environnement minimal, sur un port loopback alloué (jamais 5432). Aucun DSN hérité. Il vérifie :

- ancien bon conservé : montant, solde et nombre d’utilisations inchangés, langue historique NULL ;
- application deux fois sans erreur ; valeurs `fr` / `en` conservées ;
- abandon transactionnel d’un retrait de colonne : état restauré à l’identique ;
- retrait contrôlé avec sauvegarde des langues, réapplication et restauration : toutes les lignes identiques à la photographie initiale.

La migration actuelle ajoute un `text` nullable, sans CHECK de langues. La validation/repli est applicative : ne pas inventer une contrainte inexistante. Les anciens NULL ne sont pas transformés en français par supposition.

## Avant toute application distante — autorisation séparée obligatoire

1. Faire approuver le code et la migration ; disposer d’une sauvegarde restaurable et du déploiement précédent.
2. Identifier explicitement la cible et son rôle ; ne jamais prendre `DATABASE_URL` du shell par défaut. La base locale `cartoonova` est une production, PAS une fixture.
3. Depuis un accès autorisé, renseigner `TARGET_DATABASE_URL` en mémoire, sans l’écrire ni l’imprimer. Lire :

```sh
psql -X "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user, inet_server_addr(), inet_server_port(); SELECT count(*) AS bons_avant FROM promo_codes; SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='promo_codes' AND column_name='gift_lang';"
```

4. Comparer l’identité à la cible approuvée, pas seulement au nom d’une base. Consigner les nombres, sans codes cadeaux ni données personnelles.
5. Après autorisation de migration seulement, appliquer **avant** le code qui lit/écrit la colonne :

```sh
PGOPTIONS='-c lock_timeout=5s -c statement_timeout=30s' psql -X "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f migrations/20261026_gift_language.sql
```

6. Relire la colonne et le nombre de lignes ; vérifier `text`, nullable, pas de backfill. Un timeout est un échec à examiner, pas une raison de désactiver les limites ou de forcer un verrou.
7. Publier le code seulement sur autorisation distincte ; vérifier ensuite un parcours cadeau selon le périmètre autorisé, sans envoi client de diagnostic implicite.

## Retour arrière recommandé : conserver la colonne additive

Revenir au code précédent tout en laissant `gift_lang` nullable en place. Cette option évite perte de langue et verrou de suppression. Aucune suppression de colonne n’est nécessaire au rollback applicatif.

## Si un retrait de schéma est explicitement exigé

Maintenance préalable : suspendre les écritures de bons et revenir au code compatible **avant** le retrait. Sauvegarde indépendante requise. Les commandes ci-dessous sont **une procédure non appliquée**, réservée à une autorisation séparée. La création de table échoue si une ancienne sauvegarde existe : examiner celle-ci, ne pas l’écraser.

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE promo_codes IN ACCESS EXCLUSIVE MODE;
CREATE TABLE gift_language_rollback_20261026 AS
  SELECT code, gift_lang FROM promo_codes;
ALTER TABLE promo_codes DROP COLUMN gift_lang;
COMMIT;
```

Le verrou, la copie et le retrait sont atomiques. Les montants/soldes restent dans la table principale. Protéger cette sauvegarde comme les codes cadeaux ; ne pas la joindre aux rapports. Pour remonter, maintenir les écritures arrêtées :

```sh
PGOPTIONS='-c lock_timeout=5s -c statement_timeout=30s' psql -X "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f migrations/20261026_gift_language.sql
```

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE promo_codes IN ACCESS EXCLUSIVE MODE;
UPDATE promo_codes p SET gift_lang = b.gift_lang
FROM gift_language_rollback_20261026 b WHERE p.code = b.code;
COMMIT;
```

Vérifier compte des lignes, langue par bon et conservation des montants/soldes avant remise en service. Garder la sauvegarde jusqu’à approbation ; aucune suppression automatique ni irréversible prévue ici.
