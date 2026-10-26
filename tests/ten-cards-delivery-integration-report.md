# Livraison — intégration des trois correctifs de revue

## Résultat vérifié

**88 tests réussis, 0 échec**, sur six suites ciblées rejouées après les corrections et les adaptations de fixtures. `tsc --noEmit --incremental false`, ESLint des trois fichiers applicatifs et `git diff --check` : sortie 0. Les PostgreSQL 18 jetables du harnais sont arrêtés ; aucun `delivery-pg-*/pg/postmaster.pid` restant après vérification.

Exécution sous `env -i`, uniquement PATH/HOME/TMPDIR hérités, données synthétiques et frontières email/Blob capturées. Aucune base métier, aucun fournisseur réel, aucun email réel, aucune facturation, aucun build, commit ou push. La suite globale `npm test` reste celle du coordinateur ; ce rapport ne revendique pas son résultat.

## Périmètre exact pour la revue indépendante

Applicatif modifié dans cette passe uniquement :
- `lib/orderDelivery.ts` : confirmation physique liée au client courant ; preuve de livraison du contenu final courant avant extras.
- `lib/orderDeliveryShipping.ts` : coût canonique et mutation/notification expédition sous le même verrou.
- `app/api/orders/expedition/route.ts` : PATCH enregistre uniquement ; POST rend et notifie depuis la ligne canonique retournée, pendant le verrou.

Tests modifiés : `tests/order-delivery-harness.mjs`, `tests/order-delivery.test.mjs`, `tests/order-delivery-payment.test.mjs`. Créé : `tests/order-delivery-integration.test.mjs` (9 tests routes réelles + PostgreSQL réel). Ce rapport est nouveau. `tests/order-delivery-worker.mjs` est inchangé et son scénario six processus est rejoué.

**Non modifiés ici :** `lib/db.ts`, consentement, migration existante, route extras, helper email final, suites cadeau/sécurité/notifications et tous les autres travaux parallèles. Les gardes `paid_at` du coordinateur sont conservées ; aucun retour au statut libre comme preuve de paiement. Le diagnostic préfix indépendant reste `tests/ten-cards-backend-review.json` ; il n'est ni remplacé ni présenté comme une revue post-correctif.

## RED → GREEN réellement exécutés

Les TAP complets non reconstitués sont conservés dans `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/` (cache temporaire soumis à purge ; archiver avant purge si nécessaire). Chaque code de sortie du test a été capturé **avant** l'affichage du log.

| Tranche | RED observé | GREEN immédiat | Fichiers TAP |
| --- | --- | --- | --- |
| Confirmation physique d'un ancien email | route HTTP 200 au lieu de 409, email capturé | 1/1 | `delivery-review-red1.tap`, `delivery-review-green1.tap` |
| Extras B non livré + historique sans empreinte | deux routes HTTP 200 au lieu de 409 | 3/3 avec la garde physique | `delivery-review-red2.tap`, `delivery-review-green2.tap` |
| Coût PATCH/POST et verrou jusqu'à l'email | 12.99 au lieu de 31.28 sur les deux chemins ; écrivain SQL non bloqué à la frontière fournisseur | 6/6 avec les tranches précédentes | `delivery-review-red3.tap`, `delivery-review-green3.tap` |
| Rejeu final de toutes les suites ciblées et contrats complémentaires | — | 88/88 | `delivery-review-focused.tap` |

Extraits littéraux des preuves RED :

```text
# Subtest: physical final route refuses confirmation from previous email under canonical lock
200 !== 409
# Subtest: extras require current delivered bytes and compatible options/recipient, not an old milestone
B has not been delivered
200 !== 409
# Subtest: shipping PATCH uses canonical support estimate
12.99 !== 31.28
# Subtest: shipping POST holds canonical SQL lock through provider without nested update deadlock
competing SQL writer must be blocked at provider boundary
false !== true
```

Résumé TAP final réel :

```text
1..88
# tests 88
# suites 0
# pass 88
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

## 1. Validation physique canonique

Sous le verrou de ligne existant, `final_image` physique exige maintenant les trois propriétés ensemble : `confirmed`, image de confirmation égale à l'image finale canonique, **`poster_confirmation_email === customer_email`**. Il s'agit de l'égalité exacte de la règle SQL déjà présente dans `db.ts`, pas d'une nouvelle normalisation permissive.

Deux preuves de route réelle : ancienne adresse refusée sans effet puis confirmation correspondante acceptée ; modification SQL du seul email de confirmation pendant une barrière de téléchargement refusée avant fournisseur. Le paiement demeure fondé sur `paid_at`.

## 2. Extras liés aux octets effectivement livrés

Le registre possède déjà une empreinte composite SHA-256 `version`, construite à partir de SHA-256 des **octets téléchargés**, des options canoniques sérialisées de façon stable, du destinataire normalisé et de la langue/pays. La garde extras recalcule l'empreinte qu'aurait la livraison finale courante et exige une ligne **`kind='final_image' AND status='sent'`** exactement correspondante, sous le verrou de commande. Elle ne se contente ni d'une URL ni de `final_image_sent_at`.

Le destinataire de cette preuve est celui de la livraison finale (destinataire cadeau configuré ou acheteur), tandis que l'email extras conserve son contrat d'envoi à l'acheteur. La compatibilité est volontairement stricte : toutes les options, la langue et le pays participent à l'empreinte. Un changement nécessite une livraison finale compatible avant les nouveaux extras.

Parcours démontrés :
- A réellement livré → extras autorisés ; rejeu sans upload/email supplémentaire.
- B retouché à une autre URL mais non livré → 409, aucun upload supplémentaire.
- B réellement livré → extras autorisés.
- Octets C modifiés derrière **la même URL** → 409 jusqu'à livraison réelle de C.
- Nouvelle adresse ou nouvelles options → 409 jusqu'à livraison finale compatible.
- Cadeau réellement livré au tiers → extras légitimes à l'acheteur.
- Même contenu réuploadé à une nouvelle URL → rejeu, pas une nouvelle livraison d'extras.
- Première date finale inchangée malgré les versions ultérieures.

**Historique sans empreinte : 409 prudent**, sans effacer ou déplacer le marqueur historique. Même un ancien `final_image_sent_at` valide ne permet pas de prouver les octets expédiés. Aucun backfill inventé n'est introduit. Une réconciliation/backfill administratif exigerait une preuve vérifiable du contenu et des paramètres réellement livrés. La migration existante du registre n'est pas modifiée.

Les fixtures légitimes ne forgent plus seulement un timestamp : elles exécutent une vraie livraison finale via le garde SQL applicatif avec un fournisseur synthétique capturé (`deliverFixture`). Les scénarios de route d'intégration passent aussi par le véritable helper et la route finale. Les fixtures historiques délibérément sans empreinte restent refusées ; aucune garde n'a été affaiblie.

## 3. Expédition canonique jusqu'à l'effet externe

`PATCH` appelle `patchShipping` et **n'envoie aucun email**. `POST` appelle `notifyShipping` ; mutation, rendu de l'email, appel fournisseur et jalons se déroulent dans la même transaction de verrouillage. Le destinataire, le nom/langue, le support/options, le lien et le transporteur proviennent de la ligne canonique sauvegardée, non de l'ancien snapshot de route.

Le coût estimé est calculé depuis les options relues sous ce verrou pour **PATCH et POST**. Une course synthétique réelle remplace canvas par framed avant acquisition : les deux chemins enregistrent 31.28, pas l'ancien 12.99 ; POST utilise aussi la nouvelle adresse/langue et le transporteur conservé.

Preuve de concurrence : au cours de l'appel email synthétique suspendu par une barrière explicite, un pool PostgreSQL indépendant tente de changer email/langue/options/suivi. `pg_stat_activity.wait_event_type='Lock'` confirme son attente ; il n'aboutit qu'après libération de la frontière fournisseur. Le scénario termine sans deadlock. Le rattachement `last_outbound_message_id` et les dates sont mis à jour sur **la transaction déjà détentrice du verrou**, jamais via un second helper/pool bloqué sur notre propre verrou.

Contrats préservés et rejoués : champ absent conservé ; null/vide efface ; PATCH partiels concurrents conservent les champs distincts ; coût réel et référence préexistants conservés ; `expedie_le` garde la date du premier départ ; `expedition_email_envoye_le` suit le dernier envoi conformément au contrat SQL existant. Deux POST explicites peuvent renvoyer deux emails : ce comportement n'est pas transformé en déduplication implicite.

## Erreurs, reprise et limites

- Livraison finale/extras : registre durable et états d'incertitude préexistants conservés ; upload Blob ambigu et email incertain restent bloqués jusqu'à réconciliation avec preuve fournisseur. Les tests de reprise et six processus indépendants sont verts.
- Expédition : l'erreur fournisseur remonte en 500 ; aucun jalon de succès n'est écrit et la transaction de patch POST est annulée. Un PATCH explicite reste le moyen d'enregistrer le dossier sans notification.
- **Aucune garantie exactly-once d'expédition.** Un email accepté dont la réponse ou le commit SQL est perdu peut avoir été envoyé sans jalon enregistré. Ne pas interpréter le 500 comme preuve d'absence d'envoi, ni recommander une boucle de reprise aveugle : vérifier les journaux fournisseur avant décision de renvoi. Aucun registre d'incertitude ou réconciliation durable expédition n'est ajouté dans ce correctif minimal.
- Le verrou SQL protège l'état de commande, pas les octets d'un stockage externe modifiable après le téléchargement. Le hash certifie les octets téléchargés ; aucune promesse d'immuabilité ultérieure de l'URL ou de réception en boîte client.
- Les transactions restent ouvertes pendant les fournisseurs ; contention et connexions longues sont un coût assumé, pas une preuve de disponibilité multi-région.
- Prérequis de déploiement : migration existante `order_delivery_effects` et colonnes commande préexistantes (confirmation, expédition/coût, `last_outbound_message_id`) appliquées par la procédure autorisée. Aucun DDL ni déploiement réalisé ici. Sans schéma requis, échec fermé.

## Reproduction

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" \
  node --test tests/order-delivery.test.mjs tests/order-delivery-payment.test.mjs \
  tests/order-delivery-integration.test.mjs tests/gift-delivery.test.mjs \
  tests/final-image-security.test.mjs tests/order-notification-consistency.test.mjs

env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" \
  node node_modules/eslint/bin/eslint.js lib/orderDelivery.ts \
  lib/orderDeliveryShipping.ts app/api/orders/expedition/route.ts

env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" \
  node node_modules/typescript/bin/tsc --noEmit --incremental false

git diff --check
```

Les logs d'erreur attendus sont ceux des 409/refus et pannes synthétiques. L'avertissement MockTimers vient de la suite cadeau existante ; les 88 tests ne sont pas présentés comme une sortie sans avertissement.
