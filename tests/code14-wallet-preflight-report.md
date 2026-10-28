# CODE-14 — préflight wallets, sans paiement

État du 28 octobre 2026. **Avancement partiel ; ne pas clôturer CODE-14.** Aucun fichier applicatif, CSP, layout, configuration fournisseur, domaine, facturation ou abonnement modifié. Aucun commit/push/Trello/message. Les autres modifications du worktree appartiennent aux agents parallèles.

## Outils reproductibles

Depuis `/home/hermes/projects/cartoonova` :

```sh
# Lectures HTTP publiques et GET Stripe /v1/payment_method_domains uniquement.
# Réutilise les accès déjà présents ; ne recharge aucun dotenv et ne crée aucun accès.
node scripts/code14-wallet-preflight.mjs

# Tests isolés : faux transports explicitement synthétiques, aucun réseau fournisseur.
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test tests/code14-wallet-preflight.test.mjs

env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node node_modules/eslint/bin/eslint.js scripts/code14-wallet-preflight.mjs scripts/code14-wallet-browser.mjs tests/code14-wallet-preflight.test.mjs

# Vrai Stripe.js + Express Checkout Element, SANS Intent/Session de paiement.
# Clé publique test uniquement, en mémoire ; aucun secret Stripe transmis à Chromium.
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" CARTOONOVA_STRIPE_TEST_PUBLISHABLE_KEY="$CARTOONOVA_STRIPE_TEST_PUBLISHABLE_KEY" node scripts/code14-wallet-browser.mjs test

# Clé publique LIVE découverte en mémoire dans le JS public ; aucun secret requis.
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node scripts/code14-wallet-browser.mjs live
```

Les sorties sont des JSON expurgés. Ne pas ajouter DEBUG, HAR, trace Playwright, dump HTML/JS/réponse Stripe ou logging d'erreurs brutes : ils pourraient conserver des clés/métadonnées. La clé serveur live est lue uniquement sous `STRIPE_SECRET_KEY`, la clé serveur test uniquement sous `CARTOONOVA_STRIPE_TEST_SECRET_KEY`, sans repli entre modes. Une clé absente, mal préfixée, un refus, une erreur de transport/JSON/pagination ou une incohérence de mode donnent **inconnu**, jamais **absent**. Le listing est borné à 20 pages/100 lignes et 15 secondes par requête ; les redirections authentifiées sont refusées. Aucune mise à jour de version API/SDK/configuration.

Les domaines www/apex sont interrogés séparément dans chaque mode. `registration: présent` signifie qu'un enregistrement est retourné ; `applePay/googlePay: présent` signifie statut de domaine `active` avec `enabled: true`, **pas** une carte enrôlée ni une disponibilité du wallet pour un client. Les détails d'erreur fournisseur, IDs et autres champs ne sont pas exportés.

La découverte publique suit uniquement les JS statiques de même origine accessibles depuis `/fr/simpson`, y compris les chunks différés (80 lectures maximum). `publishableKey: absent` porte uniquement sur ce graphe, pas sur toute la configuration Stripe. Les clés publiques elles-mêmes ne sont jamais imprimées ni écrites.

## Constats actuels

- HTTP 200 ; CSP **bloquante**, pas Report-Only ; `script-src-attr 'none'`, mais `script-src 'unsafe-inline'` demeure. Permissions-Policy délègue payment à self et `https://js.stripe.com`.
- Clé publique live présente dans les chunks accessibles ; aucune clé publique test trouvée dans ce graphe public.
- Les deux domaines `www.cartoonova.com` et `cartoonova.com` ont un enregistrement **LIVE**, activé, Apple Pay et Google Pay `active` dans le compte accessible par la clé existante.
- Aucun enregistrement **TEST** retourné pour ces deux domaines avec la clé test existante. Ce constat concerne les enregistrements visibles dans cet environnement ; il ne prouve pas l'inéligibilité effective de tous les sandboxes. La documentation Stripe mentionne aussi une propagation live vers les sandboxes ; ne pas créer/enregistrer un domaine pour « corriger » ce seul résultat. Le rapprochement d'identité du compte de la clé publique avec celui de la clé serveur n'a pas été établi indépendamment.
- Stripe.js réel et ECE ont chargé et émis `ready` dans Chromium Linux vide, séparément en TEST et LIVE, sous les en-têtes publics copiés sans durcissement. Apple Pay et Google Pay non proposés dans cette fixture ; enrôlement **inconnu**, pas d'indisponibilité universelle démontrée.
- Les iframes Stripe de paiement observées délèguent `payment` ; l'iframe de télémétrie sans délégation n'est pas un défaut établi. Zéro violation CSP capturée après installation de l'écouteur, mais ce n'est ni une couverture de toutes les frames/violations, ni une validation 3DS/checkout.

## Frontière du vrai SDK

Le document de test est **synthétique et intercepté dans le navigateur**, à une URL HTTPS Cartoonova ; il n'est pas une page déployée ni le vrai CheckoutModal. Stripe.js, ses iframes et les ressources autorisées sont réels. Aucun compte wallet, carte, résultat ready ou bouton n'est simulé. ECE utilise Elements sans Intent (`mode: payment`, montant d'affichage 499 centimes EUR). Aucun clic, submit, resolve, confirm, PaymentRequest.show, PaymentIntent, SetupIntent ou Checkout Session n'est créé. L'initialisation appelle la fonction de la fixture via DevTools : ce test ne démontre donc pas la compatibilité d'une CSP sans inline.

Le transport du navigateur refuse **tout non-GET**, tous les endpoints applicatifs et les endpoints paiement ; seul GET `/v1/elements/sessions` est admis sur api.stripe.com. CSP/reporting POST et télémétrie POST sont aussi bloqués. Ces restrictions peuvent altérer l'éligibilité : un résultat négatif reste local à cette fixture. Service workers bloqués, profil éphémère, environnement Chromium réduit à PATH/HOME/TMPDIR, aucune trace/profil persistant. Les compteurs ne conservent ni URL complète/query, ni en-têtes, ni corps de requête. `browserClosed: true` confirme la fermeture exécutée.

## Historique distinct des nouvelles exécutions

`cache/four-followup/before.json`, description CODE-14 intégrale relue : critères paiement/analytics consentis sous CSP bloquante et script non autorisé bloqué, puis réserves wallets et inline. La mention initiale Report-Only est historique et ne décrit plus le site.

`cache/closure-followup/wallet-eligibility.json` décrit un ancien ECE réel headless et l'absence de wallet enrôlé ; l'ancien bouton Google Pay TEST 0000 rapporté n'est pas une carte enrôlée. Les quatre transactions Stripe TEST et le vrai challenge 3DS des rapports antérieurs sont des **preuves historiques**, aucun de ces paiements n'a été rejoué. Le plan `cache/eight-remaining/legal-seo-csp/wallet-validation-plan.json` était une préparation, pas un essai wallet frais. Les nouvelles observations ci-dessus sont datées dans les JSON, sans transformer cet historique en exécution actuelle.

## Restriction inline : étude uniquement

Guide local installé `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` :

- Nonces uniques par requête : exigent rendu dynamique ; les pages statiques n'ont pas de headers de requête lors de leur génération. Le guide explique les coûts SSR, l'absence de cache CDN par défaut, et l'incompatibilité avec ISR/PPR. Ne pas passer le site entier en dynamique pour cette tâche.
- Hashes : inventorier les vrais scripts Next/RSC, JSON-LD et scripts tiers par route, locale et variante de génération ; tenir les hashes alignés au HTML réellement servi et à sa régénération, sans hash/nonce fixe prétendument sûr. SRI des ressources externes ne constitue pas à elle seule une autorisation de tous les scripts inline.
- Porte de validation avant toute modification : vrai appareil/profil déjà enrôlé, comparaison à la démo officielle, rendu ECE sous politique candidate, puis plan de non-régression checkout/3DS/analytics consentis autorisé séparément et mesures cache/performance. Ne pas retirer unsafe-inline de next.config/layout ici.

## Blocages exacts

1. Pas d'appareil/profil autorisé avec carte Apple/Google **déjà** enrôlée dans cet environnement Linux headless éphémère. Nécessaires : appareil/browser compatibles, région et réglages permettant la détection, authentification/biométrie existantes et profil non privé. Ne pas ajouter de carte ni simuler l'enrôlement.
2. L'état effectif du sandbox test et son rattachement au compte/public key doivent être rapprochés avec les accès déjà autorisés ; absence d'enregistrement retourné n'autorise aucune mutation fournisseur.
3. La fixture GET-only peut bloquer des dépendances SDK nécessaires : pas une preuve d'échec du checkout public. Un vrai appareil doit comparer démo Stripe et surface sans Intent autorisée, sans cliquer/ouvrir le paiement.
4. Paiement wallet terminé et nouvelle non-régression transactionnelle sont hors autorisation : aucun paiement, même test. Un essai de **rendu** enrôlé ne validerait toujours pas le débit/confirmation.
5. Inline sans régression : reste ouvert ; aucun changement de politique avant preuves compatibles et examen des impacts cache/ISR/performance.

## Preuves

Répertoire exact : `/home/hermes/.hermes/profiles/cartoonova/cache/four-followup/wallet/`.
`preflight.json` : CSP complète et états domaines ; `browser-test.json` / `browser-live.json` : vraies exécutions SDK ; `tests.tap` / `lint.log` : contrôles ciblés frais ; `red*.tap` : échecs TDD attendus ; `report.json` : bilan intégral et empreintes SHA-256. Le build et la campagne globale relèvent du parent ; aucun succès global n'est revendiqué ici.

Références lues : https://docs.stripe.com/api/payment_method_domains/list ; https://docs.stripe.com/elements/express-checkout-element ; https://docs.stripe.com/security/guide ; https://docs.stripe.com/payments/payment-methods/pmd-registration ; https://docs.stripe.com/testing/wallets .
