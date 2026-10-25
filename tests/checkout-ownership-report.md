# CODE-02 — autorisation checkout et confirmation

## Résultat et périmètre

Correctif **local, non commité, non poussé et non publié** pour [CODE-02](https://trello.com/c/lIJa7oaX), selon le contexte de carte transmis par le coordinateur. La connaissance du seul PaymentIntent ne restitue plus une commande, des liens HMAC suivi/dépôt ou un bon cadeau. Aucun accès frauduleux en production n’a été démontré ; les reproductions utilisent uniquement des données synthétiques.

Aucun accès à la base de production, aucune modification de configuration Stripe/facturation, aucune migration de production, aucun appel Stripe réel, paiement, e-mail ou service externe. Aucun changement sauvegarde/restauration/OPS-02. Pas de build global ni de commit/push. Les fichiers produit/cadeau SEO/messages modifiés parallèlement par d’autres agents n’ont pas été touchés par cet agent.

## Décision après inspection

- `lib/checkoutPhotoSession.ts` exclut expressément toute autorisation de paiement : le cookie photo ne devait pas être réutilisé pour les commandes.
- Le checkout existant ne possédait pas de session d’autorisation des paiements. Le devis CODE-01 est immuable mais n’est pas une preuve de possession.
- `order/create` rendait l’ID existant avant même de récupérer le PaymentIntent, si l’e-mail correspondait ; la confirmation signait les liens et finalisait les cadeaux avec un PI seul.
- Les appels réels de `components/CheckoutModal.tsx` sont des fetch same-origin et le retour Stripe reprend `window.location.origin`. Ils transmettent automatiquement les cookies ; **aucune intégration FicheProduit/CheckoutModal nécessaire**.
- Guides Next installés lus : Route Handlers, cookies, headers. Règles AGENTS du dépôt et du répertoire parent lues.

## Contrat introduit

Chaque checkout réussi génère côté serveur 32 octets aléatoires. Seule l’empreinte SHA-256 et l’expiration sont enregistrées dans les métadonnées Stripe :

- `type`: `portrait_order` ou `bon_cadeau` ;
- `checkout_proof_hash` ;
- `checkout_proof_expires_at` (secondes Unix, durée 7 jours).

Le navigateur reçoit uniquement un cookie `__Host-cartoonova-checkout-<PI>` : HttpOnly, Secure, Path=/, SameSite=Lax, Max-Age=7 jours, sans Domain. Un cookie distinct par PI préserve les onglets et les autres checkouts ; Lax préserve les retours GET de banque/3DS/PayPal. Le secret n’est transmis ni dans JSON, ni dans l’URL, ni aux composants client. Les réponses checkout ont `Cache-Control: no-store`.

À la création **et au réessai**, le serveur vérifie la preuve, son expiration et le type portrait **avant toute lecture de commande**, y compris le chemin idempotent. La confirmation vérifie la preuve/type **avant lecture, finalisation, sérialisation de commande, code cadeau ou production de liens HMAC**. Les erreurs d’autorisation rendent un écran générique, pas les données du paiement.

Les doublons de cookie sont refusés sur l’en-tête brut. Point trouvé en test : `cookies().getAll(name)` ne suffit pas, car le vrai parseur Next réduit les noms à une Map. La page utilise donc `await headers()` et le même parseur strict que la route.

Le devis immuable, les INSERT concurrents, les réservations promos, la finalisation atomique PAID et l’outbox existants sont inchangés.

## Preuves TDD RED → GREEN

Commande utilisée après chaque tranche :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test tests/checkout-proof.test.mjs
```

1. **PI seul à création/restitution** : RED `200 !== 403` sur la vraie route ; GREEN après garde avant lecture de commande.
2. **Émission de preuve et parcours légitime** : RED cookie absent (`''`) ; GREEN après émission par le checkout portrait. Réessais concurrents sans mutation du devis/commande.
3. **Confirmation et liens HMAC** : RED HTML contenant e-mail et `/suivi/…`/`/depot/…` avec PI seul ; GREEN après garde de la page serveur.
4. **Bon cadeau** : RED `gift checkout must issue ownership capability` ; GREEN après émission au checkout cadeau. Refus PI seul, affichage du code/lien imprimable au propriétaire, et refus de ce PI dans `order/create`.
5. **Expiration serveur** : RED `200 !== 403` avec expiration passée ; GREEN après vérification de l’échéance dans les métadonnées.
6. **Vrai parseur de cookies Next** : RED fuite de l’HTML autorisé pour un en-tête contenant deux cookies de même nom ; GREEN après parsing de l’en-tête brut.

Les premières tentatives de harnais ont aussi révélé deux erreurs de fixture corrigées avant de retenir les RED métier : faux composant ESM React et montant cadeau 50 EUR non proposé (remplacé par 40 EUR).

## Vérifications finales exécutées

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test \
  tests/checkout-proof.test.mjs \
  tests/order-create.test.mjs \
  tests/promo-reservations.test.mjs
```

**34 tests réussis, 0 échec, 0 ignoré**, sortie réelle finale TAP `1..34`, durée environ 7 secondes. Les harnais existants ont été adaptés pour retransmettre les cookies, sans remplacer/désactiver le garde. Le cas de snapshot `setup_intent` est désormais refusé plus tôt en 403 ; les autres assertions de devis restent en 409.

Couverture : PI seul même avec e-mail exact ; preuve étrangère/forgée/courte ; cookie photo seul ; doublons ; type inconnu et type cadeau à création portrait ; expiration et ancien PI sans métadonnées ; idempotence et concurrence SQL ; reprise après paiement ; devis immuable et options facturées ; propriété des photos ; quotas/réservations et outbox atomique.

Chromium : deux vrais contextes isolés, cookies HttpOnly/Secure/Lax invisibles à document.cookie, appels vers les vrais handlers, refus de l’autre navigateur, refus/réessai de paiement simulé, processing → succeeded + actualisation, retour arrière, aller-retour GET depuis une origine banque synthétique, conservation du premier PI après ouverture d’un second checkout.

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node node_modules/eslint/bin/eslint.js \
  lib/checkoutProof.ts app/api/checkout/route.ts app/api/order/create/route.ts \
  app/api/bon-cadeau/checkout/route.ts 'app/(hors-langue)/success/page.tsx' \
  tests/checkout-proof.test.mjs tests/order-create.test.mjs tests/promo-reservations.test.mjs
git diff --check
```

**ESLint ciblé réussi et diff --check réussi**, code retour 0. L’invocation initiale via le symlink `.bin/eslint` a été bloquée par le scanner de commande ; l’invocation directe du même binaire JS a réussi. Aucun build global lancé (réservé au parent).

## Fichiers de ce lot

Créés :
- `lib/checkoutProof.ts`
- `tests/checkout-proof.test.mjs`
- `tests/checkout-ownership-report.md`

Modifiés :
- `app/api/checkout/route.ts`
- `app/api/bon-cadeau/checkout/route.ts`
- `app/api/order/create/route.ts`
- `app/(hors-langue)/success/page.tsx`
- `tests/order-create.test.mjs` : fixtures d’autorisation et capture du vrai Set-Cookie pour les checkouts ; assertions métier conservées.
- `tests/promo-reservations.test.mjs` : retransmission du cookie reçu pour le test de réessai/outbox réel.

Procédure mémorisée dans le skill du profil cartoonova (`references/checkout-ownership-testing.md`, lien ajouté à `cartoonova-build-deploy`) : autorisation par PI/type et piège de normalisation des cookies Next.

## Limites et points de publication

- Sans cookie (autre navigateur, suppression, expiration) ou pour un paiement ouvert **avant** ce correctif sans preuve, aucun accès n’est accordé sur PI seul. Utiliser les liens e-mail signés existants/support ; ne pas ajouter de repli PI/e-mail et ne pas demander de repayer. Pas de rétroattribution aveugle de preuves aux paiements existants.
- Cookie Secure : domaine de checkout et retour doivent rester identiques en HTTPS. Le parcours navigateur est prouvé sur origines HTTPS synthétiques ; pas de nouvelle vérification publique/prod effectuée.
- La suite dédiée exerce les vraies routes, la vraie page serveur et de vrais HMAC, avec PostgreSQL jetable. Le composant client de succès, les finaliseurs et les fournisseurs sont capturés/remplacés ; ce n’est pas un test Stripe hébergé ou 3DS réel. Le test promo exerce séparément la vraie finalisation/outbox avec transport e-mail capturé.
- Un secret de cookie volé reste une capacité bearer jusqu’à expiration. Ce changement ne prétend pas protéger un navigateur compromis ni remplacer les liens d’après-achat signés.
- Un cookie par PI implique la limite normale de cookies/en-têtes du navigateur en cas de très nombreux checkouts sur la durée ; aucun quota anti-abus de création de paiement n’a été ajouté dans cette carte.
- Tests globaux/build/revue finale/intégration de l’arbre parallèle restent à exécuter par le parent avant son commit local.
