# CRO-07 — Supplément bénéficiaire et solde du bon cadeau

## Résultat local

La page bon cadeau explique désormais, avant de continuer puis à l’étape de paiement, que **le bénéficiaire paie au moins 1 unité de la devise choisie par commande**, même si le crédit pourrait couvrir toute la commande. Elle précise qu’un solde insuffisant peut laisser davantage à payer.

- Montants sélectionnables, bouton Continuer, récapitulatif et bouton Payer : symbole conservé et code ISO explicite, par exemple `40 € (EUR)` ou `45 $ (USD)` selon la langue.
- Exemple lié au montant sélectionné : achat du bon, commande **hypothétique** de même montant et même devise, crédit utilisé, paiement bénéficiaire, crédit restant et expiration d’origine. L’exemple n’est présenté ni comme un prix de portrait ni comme un achat effectué.
- Conditions de validité partagées entre achat et article 9 bis des CGV. Le minimum des CGV est explicité pour chacune des neuf devises prises en charge ; les dix traductions sont mises à jour.
- Rétractation, vente du bon et autres articles conservés. Aucune modification des montants proposés ni des règles/calculs de paiement.

## Sources métier vérifiées

- `lib/promoCodes.ts` : `MIN_PAYABLE = 1` ; remise plafonnée à `subtotal - MIN_PAYABLE`, dans la devise native. Refus d’un bon dans une autre devise et après `ends_at`.
- `lib/bonCadeau.ts` : émission avec `VALIDITE_MOIS = 12`, calcul par `setMonth` puis enregistrement de `bon.expireLe`. L’utilisation partielle ne redéfinit pas cette date dans le parcours validé. Le contrôle de l’émission est une lecture/assertion de source, pas un achat ni un test complet de finalisation.
- `lib/bonCadeauMontants.ts` réellement exécuté : EUR `[20, 40, 60]`, GBP `[20, 35, 50]`, USD `[20, 45, 65]`. Le minimum est respectivement **1 EUR, 1 GBP, 1 USD**, pas la conversion d’un euro.
- Exemple pour la sélection médiane : EUR 40/commande 40/remise 39/paiement 1/reste 1 ; GBP 35/35/34/1/1 ; USD 45/45/44/1/1. Chaque nombre porte la devise dans le rendu. Les mêmes relations sont vérifiées pour les trois montants de chaque grille.

## Tests et preuves

Toutes les exécutions de tests et de lint ont utilisé `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR"`.

1. **RED** : le premier harnais corrigé échoue sur l’absence de l’explication visible, dans les 30 combinaisons langue/devise. Journal : `$TMPDIR/cro07-red.log`.
2. **GREEN initial** : 30 combinaisons passent après ajout de la copie.
3. **RED complémentaire** : test de persistance à l’étape de paiement ; 30 échecs attendus avant le partage du bloc d’information entre les deux étapes. Journal : `$TMPDIR/cro07-payment-red.log`.
4. **GREEN final** : `node --test tests/gift-balance-copy.test.mjs tests/gift-balance-copy-browser.test.mjs` : **42 tests TAP réussis, 0 échec, 0 ignoré**. Cela comprend 30 sous-cas navigateur + leur test parent et 11 tests de contrat. Journal : `$TMPDIR/cro07-final.log`.
5. ESLint ciblé des deux fichiers applicatifs et des deux tests : code de sortie 0, aucune sortie. `git diff --check` : code 0.

Le navigateur Chromium exécute les vrais composants `BonCadeauClient`, `CurrencyProvider`, `PageLegale` et la vraie fonction de page CGV, les dix catalogues et le vrai `next-intl`. Styles de l’application et polices locales chargés. Vérifications : minimum natif, absence de devise provisoire au rendu serveur avant lecture du cookie, changement de devise aller-retour, changement du montant, exemple, codes ISO des boutons, CGV, maintien des informations à l’étape suivante et payload de préparation du paiement inchangé.

Le test de contrat exécute les vrais `montantsBon` et `validatePromoCode` avec uniquement la lecture SQL remplacée par une donnée synthétique. Toute écriture SQL est interdite. Il couvre aussi le solde insuffisant, l’expiration et la devise incompatible. Le solde restant de l’exemple est une relation arithmétique vérifiée, pas une consommation réelle en base.

Captures locales relues visuellement :
- `$TMPDIR/cro07-fr-EUR-mobile.png` : viewport 390 × 844, capture du contenu bon cadeau.
- `$TMPDIR/cro07-fr-EUR-desktop.png` : viewport 1280 × 900.

## Fichiers de ce lot

- `app/[locale]/bon-cadeau/BonCadeauClient.tsx`
- `app/[locale]/cgv/page.tsx`
- `messages/{fr,en,de,es,it,nl,pl,pt,sv,da}.json` : uniquement les clés `bonCadeau.conditions`, `minimum`, `minimumLegal`, `exemple`.
- `tests/gift-balance-copy.test.mjs`
- `tests/gift-balance-copy-browser.test.mjs`
- Ce rapport.

Les sources `lib/legal/*.ts` ne sont pas modifiées : la page CGV remplace seulement le paragraphe d’utilisation de l’article 9 bis avec le catalogue partagé. Les autres propriétaires du dépôt conservent leurs modifications parallèles.

## Limites et incidents

- Harnais de composants réels, **pas** serveur Next complet ni acceptation Stripe : SDK Stripe, analytics et frontières SEO sont neutralisés ; le passage à l’étape de paiement utilise une réponse synthétique locale, sans requête vers un prestataire, transaction ou e-mail.
- Aucun build global, aucune base réelle, aucun accès production, aucun commit/push/déploiement. La suite globale et un typecheck ne sont pas revendiqués.
- Dix traductions testées en rendu et contrats ICU ; pas de relecture professionnelle native revendiquée. Pas de preuve d’amélioration mesurée du taux de conversion.
- Débordement préexistant du grand titre général des CGV allemandes observé à 390 px dans le harnais (texte « Allgemeine Geschäftsbedingungen » jusqu’à x=408). Hors périmètre CRO-07, non modifié ; les assertions de mise en page portent sur le bon cadeau et l’article 9 bis, qui passent dans les 30 cas.
- Une réinstallation parallèle des dépendances a temporairement rendu `esbuild`/`tsx` introuvables entre RED et GREEN. Une fois les dépendances restaurées par le propriétaire de l’installation, les vérifications finales ont été exécutées avec succès. Aucun package/lock modifié par ce lot.
