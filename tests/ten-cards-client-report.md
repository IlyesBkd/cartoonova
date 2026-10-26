# FLOW-05 / FLOW-07 / FLOW-09 — parcours client, validation locale

## État et périmètre

Implémentation locale, **non commitée, non poussée, non publiée**. Cartes exactes lues dans `/home/hermes/.hermes/profiles/cartoonova/cache/ten-cards-local/trello-before.json` via les marqueurs `Cartoonova backlog ID: FLOW-05`, `FLOW-07`, `FLOW-09`. Aucun accès en écriture à la production, fournisseur payant, email réel ni déploiement. Le travail parallèle des autres agents n’est pas inclus dans cette validation. `suivi` reste à l’agent D ; aucun changement de cette page par ce lot.

## Règles métier déduites du code réel

Contrat partagé : `lib/clientOrderPolicy.ts` (fonctions synchrones, ordre ou null → boolean).

| Action | Autorisation effective |
|---|---|
| Dépôt de références | Commande existante, `paid_at` présent ; ni `poster_confirmation_sent_at`, ni `final_image_sent_at`, ni `expedie_le`. |
| Réponse à l’aperçu | Paiement reçu, invitation envoyée, jeton courant lié à `final_image_url` et `customer_email` ; ni livraison numérique ni expédition. Une réponse peut être modifiée avant fermeture, avec la révision courante. |
| Avis vérifié | Commande payée et `final_image_sent_at` **ou** `expedie_le`. Aucun délai supplémentaire imposé. |
| Avis sans lien | Parcours existant conservé, statut `en_attente`, jamais publication vérifiée automatique. Un lien fourni mais invalide/inexistant/inéligible ne retombe pas silencieusement sur ce parcours. |

Justification : le code `getOrdersAwaitingPhotos` et le lifecycle s’appuient déjà sur `paid_at` et non le statut libre ; la livraison/expédition sont les jalons persistés. Le lifecycle des avis utilise les dates de livraison numérique/expédition. Il n’existe pas dans ces parcours de preuve de livraison transporteur distincte : **expédition est ici le proxy existant du physique, pas une livraison réelle démontrée**. Aucun statut admin arbitraire, même `PENDING`, ne ferme à lui seul une commande payée. L’envoi de l’aperçu marque le début de la phase de validation ; les photos supplémentaires passent alors par les retouches et non par la modification des références initiales. Cette interprétation doit rester explicite lors de l’intégration produit ; ce n’est pas une approbation métier externe obtenue pendant la tâche.

Pages et API utilisent les mêmes prédicats. Les pages indisponibles affichent une explication sans formulaire actionnable (elles conservent le rendu informatif existant, pas une nouvelle convention HTTP). API : signature invalide 403, commande/lien absent 404, phase/révision incompatible 409, contenu invalide 400. Les refus métier ne déclenchent ni écriture client, ni publication, ni email.

## FLOW-07 : protocole photos

- POST `/api/orders/photos` : `operation` absent ou `add` fusionne et dédoublonne, sans supprimer les anciennes références.
- `remove` / `replace` exigent `expectedPhotos`, instantané exact de la sélection affichée. Vérification du contenu sous verrou `orders FOR UPDATE` ; une sélection périmée qui modifierait les références donne 409.
- La propriété des nouveaux objets, le plafond total de **8** et la phase sont revérifiés dans la transaction. Les anciennes références exactes déjà attachées restent compatibles. Une URL étrangère ne peut pas être adoptée.
- Un retrait ne peut rien attacher : son retry est accepté même après disparition de l’ancienne référence du tableau (y compris ancien fichier sans ledger). Il ne supprime jamais le fichier Blob.
- Résultat de persistance : `{ order, changed, firstDeposit }`. Réponse HTTP augmentée avec `photoUrls`, utilisée pour rafraîchir le snapshot après retrait. Un retry sans changement ne redéclenche pas les effets.
- L’UI affiche les références existantes, permet leur retrait explicite, propose Ajouter par défaut / Remplacer via un sélecteur, et demande confirmation avant remplacement. Le plafond de sélection n’est plus appliqué par une troncature silencieuse des fichiers choisis.

## FLOW-09 : intégrité de la demande

`lib/retouchePolicy.ts` exporte `MAX_RETOUCHE_NOTE = 2000` et le validateur de type/longueur. Unité documentée : **unités UTF-16**, identiques à `String.length` et `textarea.maxLength`, non graphèmes. 2000 reprend la capacité de l’ancien accusé tronqué ; désormais le dépassement est refusé explicitement.

- Note omise permise pour le parcours existant (confirmation ou demande avec photo seule) ; note présente non chaîne, y compris `null`, refusée par l’API.
- Aucun `trim`/`slice` ne change la note acceptée : espaces, accents et sauts de ligne conservés en commande, historique et email échappé HTML.
- UI : `maxLength` partagé, compteur visible, garde avant soumission pour une ancienne note hors borne ; pas de raccourcissement silencieux des anciennes notes.
- Réponse et entrée d’historique sont atomiques. Une panne d’historique fait rollback au lieu de répondre succès après perte de la demande. Email uniquement après commit de la nouvelle réponse.
- L’accusé contient également les liens exacts des photos validées ; aucun objet externe n’est téléchargé pendant ces tests.

## Boucles RED → GREEN réellement exécutées

Chaque tranche a été exécutée en rouge avant le correctif correspondant, puis en vert. Les premiers problèmes de fixture (cast JSONB) ont été corrigés avant d’en tirer une preuve métier. Les tests supplémentaires de concurrence caractérisent ensuite les garanties de l’implémentation ; ils ne sont pas présentés comme des régressions toutes observées sur l’ancien code.

| Tranche | RED observé avant correction | GREEN |
|---|---|---|
| Paiement/phase dépôt | Test dépôt signé impayé en échec avant la garde partagée | refus 409, aucun effet |
| Ajout cumulatif | Second dépôt ne conserve pas toute la sélection antérieure | anciennes références conservées |
| Retrait/remplacement | Test snapshot absent/périmé en échec avant le protocole explicite | 400/409 ; remplacement et retry exact acceptés |
| Phase aperçu | Test invitation courante mais paiement absent / phase close en échec | refus sans historique ni email |
| Avis | Test commande non livrée/impayée en échec avant la garde | refus ; avis légitime publié et retry idempotent |
| Borne note | Test dépassement/non-chaîne en échec avant validateur | 400 sans écriture ni email |
| Note exacte | Égalité de la note à la borne avec espaces en échec avant suppression du trim | note + photo relues, email complet échappé |
| Atomicité historique | Test de panne historique rouge avant transaction commune | 500, rollback réponse, zéro email |
| Pages serveur | Test de rendu serveur rouge avant fermeture des formulaires | pages impayées/fermées sans formulaire |
| Limite UI Chromium | Test limite textarea rouge avant ajout de la borne partagée | 2000 exposé, frappe supplémentaire bloquée |
| Photos UI Chromium | Test références persistées et opérations explicites rouge avant adaptation UI | références visibles, payloads remove/replace avec snapshot |
| Retry retrait legacy | Test seconde requête de retrait rouge avant prise en charge legacy | retry 200 sans modification supplémentaire |

Les sorties RED sont celles des exécutions terminal de cette session ; elles n’ont pas été reconstruites en faux fichiers TAP. Une attente UI initialement écrite sur un mot supposé de la copie (`bien`) a été corrigée vers le vrai message `C’est reçu, merci` après inspection du catalogue : ce timeout de harnais n’est pas compté comme preuve produit.

## Cas exercés

`tests/ten-cards-client.test.mjs` : PostgreSQL **18 jetable**, vrais SQL et vraies routes, transport email/notifications capturé. Ajout cumulatif/dédoublonnage ; snapshots manquant/périmé ; remplacement/retrait explicite et retries ; impayé/inexistant ; statut libre PENDING payé ; fermeture après aperçu/livraison/expédition ; aperçu non envoyé ou désolidarisé de l’image/email ; avis modéré sans lien et vérifié après jalon ; note 2000 avec HTML/accents/espaces et photo identique ; dépassement/type invalide ; panne historique avec rollback.

Concurrence réelle : deux ajouts fusionnent ; sept références + deux ajouts concurrents restent à huit (200/400) ; deux remplacements du même snapshot n’en acceptent qu’un (200/409) ; deux réponses identiques n’ajoutent qu’un historique/email ; deux avis ne publient/récompensent qu’une fois. Un test à barrière SQL observe `pg_stat_activity.wait_event_type='Lock'`, retire le paiement pendant l’attente et vérifie que **les trois actions** refusent ensuite sans effet : la lecture initiale n’est pas la seule garde.

`tests/ten-cards-client-ui.test.mjs` : vraies pages rendues avec frontières DB et composants client instrumentées ; vrais composants client en Chromium, upload synthétique et réseau intercepté, propriétés de retrait/remplacement et limite du textarea exercées. Ce n’est pas un serveur Next compilé ni une preuve du fournisseur Blob.

Non-régression : `photo-validation.test.mjs`, `photo-validation-routes.test.mjs`, `photo-privacy-copy.test.mjs`. La fixture de validation alternant dépôt et aperçu sur les mêmes lignes installe maintenant une invitation envoyée uniquement pendant la phase aperçu ; elle contient aussi les jalons de fermeture. L’attendu HTTP inclut le nouveau `photoUrls`. La notice vie privée reste sans case de consentement promotionnel.

## Résultat final conservé

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test \
  tests/ten-cards-client.test.mjs tests/ten-cards-client-ui.test.mjs \
  tests/photo-validation.test.mjs tests/photo-validation-routes.test.mjs \
  tests/photo-privacy-copy.test.mjs
```

**45 tests, 45 réussis, 0 échec, 0 ignoré**, compteurs relus automatiquement dans la sortie réelle. Journal : `/home/hermes/.hermes/profiles/cartoonova/cache/ten-cards-local/client-green.tap`.

ESLint ciblé sur les fichiers TypeScript/TSX du lot : code 0. `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node node_modules/typescript/bin/tsc --noEmit --incremental false` : code 0.

## Limites / intégration parent

- Build global et serveur Next compilé réservés au parent ; aucun build lancé ici. Validation globale de l’arbre multi-agents encore distincte.
- `order-notification-consistency.test.mjs` a été exercé : **15/23 verts, 8 échecs** sur les fixtures partagées (paiement absent, un plan SQL préparé périmé après DDL de bootstrap). Signalé au parent responsable des fixtures partagées/compilées ; fichier non modifié par ce lot. Il faut les réaligner et refaire la suite sur l’arbre réuni avant toute annonce globale. La nouvelle garde de livraison de l’autre agent provoque elle aussi un refus sur ces commandes non payées.
- Pas d’inventaire ou migration de données production. Pas de nouvelle migration nécessaire : les colonnes/journaux existent ; bootstrap local retouches préservé. Conservation/suppression physique Blob hors périmètre.
- Envoi de l’email après commit : pas de nouvel outbox transactionnel. Une panne/crash entre commit et transport reste un risque distinct ; une relance exacte n’envoie pas deux accusés. Aucun succès fournisseur réel prétendu.
- Règles fondées sur les jalons réellement disponibles ; absence de statut transporteur « livré », remboursement et fermeture métier dédiée non inventés. Ne pas fermer une commande sur son seul statut libre admin.
