# Horodatage serveur des dépôts photos

## Activation vérifiée

La migration a été appliquée en production après accord explicite, puis relue : trigger actif, deux colonnes nullable présentes, contenu des commandes existantes inchangé et aucune date historique inventée. Une sonde synthétique sur table temporaire a vérifié la première réception, la stabilité au retry et le rejet des dates arbitraires avec la vraie fonction de production, sans créer ou modifier de commande client. L'activation du mécanisme en base ne nécessite pas de redéploiement Vercel ; aucun push du site n'a été effectué. Les sections suivantes décrivent la préparation et ses preuves locales.

## Livraison

- `migrations/20261028_order_photo_timestamps.sql` : transaction atomique, colonnes `photos_received_at` / `photos_updated_at` nullable, trigger `BEFORE INSERT OR UPDATE` sur `orders`. Exécution explicite de la migration nécessaire avant consommation des champs ; aucune DDL runtime.
- `lib/db.ts` : les deux champs sont optionnels et nullable sur `DbOrder` pendant la transition.
- Aucun changement au paiement, aux routes métier, à l'UI ou aux crons. Aucun backfill, commit, push, déploiement ou accès production.

## Sémantique

Les dates proviennent exclusivement de `clock_timestamp()` PostgreSQL. Tout horodatage fourni lors d'un INSERT/UPDATE est ignoré. Le premier dépôt connu reste immuable ; le dernier changement inclut le retrait de toutes les références. Un doublon ou une liste normalisée inchangée ne modifie aucune date. L'ordre des références reste significatif.

La comparaison décode au maximum deux couches JSON historiques, déduplique les références et traite NULL / JSON null / [] comme vides. Une liste structurellement invalide reste inconnue, pas assimilée à une liste vide. La normalisation ne modifie pas les références stockées. Le contrôle structurel HTTPS Blob n'est pas une validation du store configuré ni de propriété des fichiers : les contrôles API existants restent autoritatifs ; les dates ne prouvent pas que l'objet distant existe ou soit décodable.

Les anciennes commandes avec photos conservent un premier dépôt inconnu, même après ajout, remplacement, retrait puis redépôt. Une ancienne ligne connue vide, sans modification observée depuis la migration, peut recevoir sa première vraie date. Par prudence, une histoire invalide ou déjà modifiée avec premier dépôt inconnu ne reçoit pas ensuite de premier dépôt supposé. Aucun historique n'est reconstruit depuis `created_at`, `paid_at` ou l'application de la migration.

Les fonctions sont `SECURITY INVOKER` avec `search_path=pg_catalog`; le trigger vise tous les UPDATE pour empêcher aussi les écritures directes des seules dates. Un propriétaire de table/superutilisateur peut toujours désactiver un trigger : ceci ne prétend pas protéger contre l'administration PostgreSQL.

## Preuves

Commande ciblée finale (PostgreSQL 18 jetable, ports dynamiques distincts de 5432, aucun secret hérité) :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test tests/order-photo-timestamps.test.mjs tests/ten-cards-client.test.mjs tests/order-create.test.mjs
```

Résultat final après correction de la reconnaissance des extensions majuscules : **42 tests réussis, 0 échec, 0 ignoré**. La suite dédiée couvre insert vide/non vide, transitions ajout/remplacement/retrait/redépôt, premier dépôt immuable, retries, dates arbitraires rejetées, historiques inconnus, encodages anciens, listes invalides et Unicode non représentable, migration répétée, rollback réel et concurrence PG avec preuve d'attente `Lock` dans `pg_stat_activity`. Les suites routes réelles existantes chargent la migration ; assertions supplémentaires sur les dates au dépôt après paiement, leur stabilité au retry et l'absence d'effet sur `paid_at` à la création. La suite création inclut ses vrais contextes Chromium existants ; fournisseurs externes simulés/interdits.

TDD vertical réellement exécuté : premier insert RED (date manquante) → GREEN ; transitions/historique RED → GREEN ; encodage RED → GREEN ; Unicode `22P05` RED → GREEN (capture bornée de `data_exception`). Les essais rollback, concurrence et répétition vérifient ensuite ces comportements contre PostgreSQL réel. Un souci de harnais a été corrigé : les transactions explicites de migration nécessitent une connexion réservée et les chaînes JSON nécessitent `::text::jsonb` avec postgres.js.

`git diff --check` réussi. Lint/build global et fixture intégrale laissés au parent, conformément au périmètre délégué. Les instances PostgreSQL sont arrêtées via `pg_ctl -m fast -w stop` en `finally` (échec de nettoyage ferait échouer la suite).

Le fichier JSON de preuves hors dépôt contient les commandes réellement rejouées, les sorties TAP persistées et les empreintes SHA-256 des sources ; son chemin est communiqué au parent. Le répertoire préexistant `scripts/__pycache__/` est laissé intact.
