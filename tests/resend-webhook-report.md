# CODE-08 — Webhook Resend : correctif local vérifié

## Résultat et périmètre

- Signature Svix HMAC-SHA256 `v1` obligatoire, vérifiée sur le corps brut ; absence de `RESEND_WEBHOOK_SECRET`, d'un en-tête Svix ou de signature valide → HTTP 401, aucun effet ni claim.
- Suppression de l'authentification `?cle=` dérivée de `CRON_SECRET`. Une signature valide suffit sans query string ni `CRON_SECRET` ; une ancienne clé valide ne permet aucun contournement.
- Timestamp décimal entier sûr (donc fini), dans la fenêtre ±300 secondes ; rejet notamment de `NaN`, infinis et dates trop anciennes/futures.
- Claim PostgreSQL atomique `INSERT ... ON CONFLICT DO NOTHING RETURNING` sur `svix_id`, validé avant mesure, recherche commande et Discord. Les rejeux répondent 200 `{ok:true,duplicate:true}` sans répéter ces effets, même entre instances et avec un nouveau timestamp signé.
- Base indisponible avant claim → 503 sans effet, retry possible après rétablissement. Erreur après claim → conservation du claim et 503 ; aucun retry automatique des effets partiels.

## Fichiers de ce lot

- Modifié : `app/api/resend/webhook/route.ts`.
- Créé : `migrations/2026-10-resend-webhook.sql`.
- Créé : `tests/resend-webhook-security.test.mjs`.
- Créé : ce rapport.

Aucun package/lock/workflow, autre test ou configuration distante modifié par ce lot. Le dépôt est partagé : les autres différences visibles appartiennent aux autres agents.

## TDD observé

Skill TDD et guide local `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` lus avant code.

Avec la même commande ciblée à chaque cycle :

1. Secret absent : RED `200 !== 401`, puis GREEN 1/1 après passage en refus obligatoire.
2. Signature sans ancienne clé : RED `401 !== 200`, puis GREEN 2/2 après suppression de la dépendance à l'URL/CRON.
3. Timestamp `NaN` : RED `200 !== 401`, puis GREEN 3/3 après validation de l'entier décimal sûr.
4. Version `v0` : RED `200 !== 401`, puis GREEN 4/4 après restriction à `v1`.
5. Replay durable : RED montrant deux séquences mesure/lookup/Discord au lieu d'une ; puis GREEN 5/5 après migration et claim atomique.
6. Échecs transport/base : RED sur exceptions non gérées, puis GREEN 7/7 avec conservation des états et réponses 503.
7. Perte DB après effets : RED sur exception synchrone pendant le marquage d'échec, puis GREEN 8/8 avec gestion imbriquée de cette panne.
8. Ajout de couverture de régression, sans nouveau comportement de production : concurrence, migration/réapplication, rollback/retry, signatures/corps altérés, limites temporelles, rotation de signatures et événements ignorés.

Un essai intermédiaire du harness a produit `UNSAFE_TRANSACTION` : le driver postgres interdit `BEGIN` via une connexion de pool non réservée. Le harness applique désormais le script transactionnel sur `db.reserve()` ; la migration n'a été exécutée que sur le cluster jetable.

## Commandes et vérification finale

Depuis `/home/hermes/projects/cartoonova` :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test tests/resend-webhook-security.test.mjs
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node node_modules/eslint/bin/eslint.js app/api/resend/webhook/route.ts tests/resend-webhook-security.test.mjs
git diff --check
```

Résultat final : **16 tests passés, 0 échec**, lint ciblé et contrôle des espaces réussis. Aucun build global, commit ou push.

Le harness transpile et exécute le vrai module de route avec les vrais `NextRequest`/`NextResponse`. Seules les frontières DB/mesure/Discord sont remplacées : le SQL utilise réellement PostgreSQL 18 jetable, sur loopback et port éphémère non 5432 ; les effets sont comptés localement. `fetch` échoue si un appel HTTP accidentel survient. Aucune variable de fournisseur/base réelle héritée, aucun `.env` chargé, aucun appel Resend/Discord/PostHog réel.

Les tests contrôlent notamment :

- Un seul traitement avec 16 requêtes concurrentes supplémentaires pendant que le premier claim est encore `processing`.
- État exact `completed` avec date, `failed` sans date, `processing` conservé après panne DB ; retry sans répétition des effets.
- Réapplication de la migration deux fois après données existantes, sans modification d'aucun enregistrement ; colonnes/types/nullabilité et contraintes d'état.
- Rollback explicite d'un claim dans une transaction, absence du claim puis retry de la vraie route réussi.
- Rejeu signé avec contenu et timestamp différents, distingué d'un nouvel identifiant.

## Migration et blocage de publication

Migration transactionnelle et réexécutable : nouvelle table `resend_webhook_events` avec clé primaire `svix_id`, état `processing/completed/failed`, `claimed_at`, `completed_at`. Pas de DDL au runtime, pas de payload, destinataire ou secret stocké. Les identifiants ne sont pas purgés automatiquement, pour ne pas réautoriser un rejeu signé plus tard. Le script ne répare pas une table homonyme préexistante au schéma incompatible : contrôler le schéma avant provisioning réel.

**Publication bloquée actuellement** : le parent a constaté en lecture seule que `RESEND_WEBHOOK_SECRET` est absent de production. Publier tel quel ferait refuser les callbacks avec 401. Avant toute publication, un opérateur doit vérifier la configuration de signature du webhook côté fournisseur, provisionner le secret correspondant dans l'environnement cible et appliquer la migration sur la bonne base ; ces opérations ne sont pas réalisées ici. L'ancien paramètre `cle` peut rester dans une URL existante mais il est ignoré, jamais utilisé en fallback.

## Limites assumées

Garantie **at-most-once des tentatives d'effets**, pas exactly-once de livraison aux fournisseurs. Le claim est commité indépendamment et avant les effets externes : un crash entre claim et effet, ou entre deux effets, peut perdre une mesure/alerte. Un claim `processing` abandonné ou `failed` n'est volontairement ni libéré ni repris automatiquement. Les helpers existants peuvent aussi absorber certaines erreurs réseau ; `completed` signifie que les appels locaux sont revenus, pas une preuve de livraison distante. Une reprise fiable sans pertes nécessiterait une outbox et des consommateurs/fournisseurs avec idempotence documentée ; remettre simplement tout en transaction SQL ne rendrait pas les appels externes transactionnels et pourrait réintroduire les doublons.

Les tests sont des intégrations de module, pas un serveur Next HTTP déployé ; build, typecheck global, suite globale et smoke prod restent au parent. Les réponses à JSON syntaxiquement valide mais structurellement inattendu ne sont pas redéfinies dans ce lot.
