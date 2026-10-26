# FLOW-08 + FLOW-06 — implémentation et preuves locales

## Périmètre et résultat

Cartes exactes lues dans `/home/hermes/.hermes/profiles/cartoonova/cache/ten-cards-local/trello-before.json` :
- FLOW-08 : tracer chaque effet par commande/version/type ; convergence manuel/express/cron ; concurrence sans double envoi ni nouvel upload de rejeu ; reprise conservant fichiers et état.
- FLOW-06 : PATCH partiel conservant référence et URL ; effacement explicite ; existence/support approprié ; dates de premier envoi préservées.

**GREEN ciblé : 35 tests réussis, 0 échec**, dont 15 tests FLOW dédiés. PostgreSQL **18 jetable**, données synthétiques, adaptateurs email/Blob capturés, aucun service externe réel. ESLint ciblé, `tsc --noEmit --incremental false` et `git diff --check` : code de sortie 0. Aucun build global, commit, push, déploiement ou changement de base métier.

**Attention intégration parallèle :** la suite `tests/order-notification-consistency.test.mjs`, hors fichiers possédés pour cette tâche, a aussi été exécutée : **15 réussis / 8 échecs**. Elle n'est PAS incluse dans le GREEN ci-dessus. Son schéma ne déclare pas `orders.status`, ses fixtures ne renseignent pas le paiement, et elle rencontre notamment `cached plan must not change result type` avec les évolutions parallèles de `lib/db.ts`. Un test du helper cadeau doit maintenant fournir `status: 'paid'`. Le propriétaire FLOW-05/07/09 doit adapter ces fixtures et intégrer sa migration ; `lib/db.ts` et cette suite n'ont pas été modifiés ici. Preuve : `ten-cards-delivery-evidence/parallel-integration.tap`.

## Commandes de reproduction

Depuis la racine du dépôt (aucun `.env` chargé) :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" \
  node --test tests/order-delivery.test.mjs tests/gift-delivery.test.mjs tests/final-image-security.test.mjs

env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" \
  node node_modules/eslint/bin/eslint.js lib/orderDelivery.ts lib/orderDeliveryShipping.ts \
  lib/emailImageFinale.ts app/api/orders/extras/route.ts app/api/orders/expedition/route.ts

env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" \
  node node_modules/typescript/bin/tsc --noEmit --incremental false
```

Prérequis déjà présents : binaires `/usr/lib/postgresql/18/bin/`, dépendances du dépôt. Le harnais crée son serveur loopback, applique la migration uniquement à cette base synthétique et arrête PostgreSQL en fin de suite. Aucun `postmaster.pid` restant dans les répertoires `delivery-pg-*` après le dernier passage. Le probe multi-processus refuse toute URL autre que la connexion loopback synthétique du harnais.

## Preuves RED → GREEN conservées

Les TAP bruts sont dans `tests/ten-cards-delivery-evidence/` ; ce ne sont pas des sorties reconstituées.

| Cas écrit avant correctif | RED observé | Preuve |
| --- | --- | --- |
| PATCH omet référence/suivi | `null` reçu au lieu de `undefined` ; helper SQL absent | `red06.tap` |
| 12 appels extras sur deux modules de route indépendants | 12 uploads au lieu de 1 | `red08.tap` |
| 8 appels du helper final partagé | 8 envois au lieu de 1 | `red-final.tap` |
| Réconciliation après timeout fournisseur | helper de réconciliation absent | `red-recovery.tap` |
| Champ expédition de type nombre/objet/booléen | HTTP 200 au lieu de 400 | `red-types.tap` |
| Cadeau futur impayé | absence du rejet attendu avant programmation | `red-payment.tap` |
| Réponse Blob perdue puis rejeu | HTTP 200 au lieu de 409, nouvel upload possible | `red-blob.tap` |
| Marqueur historique livré sans registre | absence du rejet attendu | `red-legacy.tap` |
| Rejeu du portrait déjà envoyé | 2 mesures email au lieu de 1 | `red-metrics.tap` |

Résultat final : `focused.tap` contient `tests 35`, `pass 35`, `fail 0`. Les fichiers `eslint.txt`, `typescript.txt`, `diff-check.txt` conservent commande et code de sortie. Les logs d'erreur attendus correspondent aux conflits/refus et aux pannes synthétiques ; l'avertissement MockTimers appartient à la suite cadeau existante.

## FLOW-08 : mécanisme effectif

- Nouveau `lib/orderDelivery.ts` : verrou transactionnel **advisory PostgreSQL par commande/type**, sans Map locale ; verrou de ligne `FOR NO KEY UPDATE` conservé pendant préparation/envoi. Une véritable écriture SQL concurrente du destinataire est exercée : elle attend la fin de l'appel fournisseur.
- Registre durable `order_delivery_effects`, clé `(order_id, kind, version)`. États `preparing`, `sending`, `uncertain`, `sent`, artefacts JSONB et identifiant fournisseur. Index unique partiel pour les résultats email non résolus. Aucun DDL à l'exécution.
- Version SHA-256 : octets de l'image, options sérialisées avec clés triées, destinataire normalisé, langue/pays. Une nouvelle URL contenant les mêmes octets n'autorise pas un renvoi ; une vraie retouche, un changement d'options ou de destinataire crée une version différente.
- Relecture canonique verrouillée : commande payée, portrait et acheteur existants, snapshot image/options/acheteur/langue/pays inchangé. Extras réellement souscrits + portrait déjà livré. Portrait physique validé pour l'URL canonique courante.
- `lib/emailImageFinale.ts` conserve sa signature ; manuel, express et cron existants passent par le même helper. La programmation d'un cadeau futur exige aussi un paiement enregistré. L'envoi email reçoit une clé fournisseur déterministe ; un rejeu ne recompte pas une livraison dans l'analytics.
- `app/api/orders/extras/route.ts` retrouve ses PDF depuis les checkpoints. Une intention durable `uploadPending` précède chaque appel Blob ; une réponse perdue ou un crash avant son checkpoint final bloque le rejeu plutôt que recréer gratuitement un fichier.
- `sending` est écrit et validé sur une connexion indépendante **avant** l'appel email. Un crash laisse donc un état non automatiquement réessayable, même si la transaction du verrou est annulée.
- Les rejeux terminés rendent les artefacts/identifiant enregistrés ; les appels encore concurrents rendent 409. La première date de livraison est conservée avec `COALESCE` ; le planning est supprimé après livraison confirmée.

### Concurrence exercée

1. Douze appels extras, deux chargements indépendants de route : un PDF uploadé, un email, puis rejeu séquentiel sans effet supplémentaire.
2. Huit appels du helper image finale partagé : un email ; réouverture d'un module et rejeu sans nouvel email ni nouvelle mesure.
3. Véritable route express `send-final-image`, huit appels concurrents : un email ; vraie retouche B : un deuxième ; rejeu de B : aucun troisième. Première date de livraison inchangée.
4. **Six processus OS distincts**, pools PostgreSQL séparés, même registre : somme des invocations du fournisseur synthétique = 1. Statuts seulement 200/409 et registre final `sent`.
5. Écrivain SQL concurrent pendant le fournisseur : modification du destinataire bloquée jusqu'à la fin de l'effet.

Le test multi-processus prouve l'absence de dépendance à une mémoire de processus ; il ne constitue pas un déploiement multi-région ni un test de coupure réseau réelle.

## Reprise et limites opérationnelles

**Pas de promesse exactly-once entre PostgreSQL, Blob et email.** Le choix est de bloquer plutôt que risquer un deuxième effet quand l'acceptation du fournisseur est inconnue. Une clé fournisseur aide, mais sa durée de rétention et son contrat sont externes ; aucune durée infinie n'est supposée.

- Erreur avant effet externe, sans `uploadPending` : préparation réessayable, fichiers déjà checkpointés conservés.
- Timeout/refus email : état `uncertain` conservé, reprise automatique interdite, y compris pour une autre version. Un refus retourné est traité conservativement comme incertain, pas comme preuve universelle d'absence d'envoi.
- Opération hors API publique `reconcileDelivery(orderId, kind, version, resolution)` : même verrou distribué, motif obligatoire et trace horodatée dans les artefacts. `sent` exige un identifiant fournisseur vérifié, ne renvoie aucun email ; un appel normal ultérieur répare si nécessaire le marqueur commande. `not_sent` exige une preuve positive d'absence d'acceptation, jamais un simple timeout, puis permet une reprise conservant les fichiers et la même clé.
- Blob ambigu : vérifier les journaux/objets. `not_sent` ne doit lever `uploadPending` qu'après confirmation que **rien n'a été créé**. Si l'objet existe mais son URL a été perdue, conserver le blocage et faire une récupération administrative des artefacts sous le même verrou ; aucun outil automatisé de récupération d'un objet déjà accepté n'est exposé ici.
- Livraison finale historique (`final_image_sent_at` présent, aucun effet enregistré) : HTTP 409, pas de renvoi aveugle. Un backfill contrôlé des empreintes historiques, avec preuve de l'ancien contenu envoyé, est nécessaire avant de permettre ces renvois. Ne jamais effacer le marqueur pour forcer l'envoi. Aucune migration de données historique n'a été exécutée.
- Les anciens extras n'avaient aucun registre : leur historique ne peut pas être reconstruit à partir des seuls champs existants. Avant une éventuelle activation réelle, réconcilier/backfiller les envois antérieurs ; les garanties de rejeu portent sur les effets tracés par ce mécanisme.
- Le hash représente les octets téléchargés au moment du traitement. Le mail contient toujours l'URL de l'image : l'immuabilité ultérieure du stockage doit rester une propriété du fournisseur/du chemin d'upload. Aucune preuve de livraison en boîte destinataire ni test de crash OS au milieu du transport n'est revendiqué.
- Le verrou de commande est maintenu pendant les fournisseurs : il protège l'état canonique au prix d'une transaction et de connexions longues. La concurrence perdante doit recharger/réessayer après 409, pas contourner le registre.

## FLOW-06 : contrat PATCH et SQL

`lib/orderDeliveryShipping.ts` est importé directement par la route ; **aucune modification de `lib/db.ts`** et l'ancien `enregistrerExpedition` reste disponible pour les autres appelants.

- Propriété absente → `undefined` → SQL conserve la valeur existante.
- Propriété présente avec `null` ou texte vide/blanc → effacement explicite `NULL`.
- Texte non vide → normalisation existante conservée (notamment numéro de suivi vers URL).
- Nombre/objet/booléen, corps JSON mal formé ou non objet → 400 sans écriture.
- Commande inexistante → 404 ; commande non payée ou numérique → 409.
- Mise à jour sous verrou de ligne ; deux PATCH partiels concurrents sur des champs différents conservent les deux modifications. Coût réel préexistant et date(s) de premier envoi non modifiés.

Tests de frontière route, helper SQL réel et **route + PostgreSQL** : changer seulement le transporteur conserve référence et suivi ; `null`/vide efface ; références/coût/date sont conservés ; commandes absentes/numériques/impayées refusées.

## Fichiers livrés

- Créés : `lib/orderDelivery.ts`, `lib/orderDeliveryShipping.ts`, `migrations/20261026_order_delivery_effects.sql`.
- Modifiés : `app/api/orders/extras/route.ts`, `app/api/orders/expedition/route.ts`, `lib/emailImageFinale.ts`.
- Tests créés : `tests/order-delivery.test.mjs`, `tests/order-delivery-harness.mjs`, `tests/order-delivery-worker.mjs`, `tests/order-delivery-double.mjs`.
- Suites de contrat existantes adaptées : `tests/gift-delivery.test.mjs`, `tests/final-image-security.test.mjs` (double de frontière explicite et fixtures payées ; le vrai registre SQL reste testé séparément).
- Rapport et preuves : ce fichier et `tests/ten-cards-delivery-evidence/*`.

Migration additive à appliquer explicitement **seulement dans un futur changement autorisé**, avant d'activer ce code sur une base métier. En son absence les effets échouent fermés ; aucune création de table implicite. Les autres fichiers modifiés du dépôt partagé appartiennent aux travaux parallèles et ne sont pas revendiqués ici.
