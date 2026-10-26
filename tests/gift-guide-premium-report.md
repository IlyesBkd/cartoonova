# Guide cadeau — refonte en cartes illustrées (local, non publié)

## Résultat

Le formulaire de trois listes déroulantes est remplacé dans le vrai composant par une composition boutique : trois groupes de choix, cartes d’univers illustrées et carte de recommandation distincte avec photographie du catalogue, sélection, exemple de tarif et action. La palette crème/jaune et les polices Kefir/Rebond/Atma sont conservées. Aucun nouvel abonnement, service d’image, dépendance ou contenu graphique inventé.

- Destinataire et délai : radios natives dans des fieldsets, choix actif contrasté, focus visible, flèches natives et Tab.
- Univers : trois cartes photographiques et grand visuel synchronisé. Fichiers existants `/framed.jpg`, `/DBZ/Photo_produits/il_1140xN.7733273072_b9q7.png`, `/Disney/Photo_produits/il_1140xN.6576111634_dwx3.png`.
- Le visuel est explicitement un exemple de style, cadre non inclus ; ce n’est pas une prévisualisation du nombre de destinataires choisi.
- Exemple de prix inchangé : numérique, buste, sans options, 1/2/4 personnes. `GiftPricing.tsx`, `computeOrderSubtotal` et leurs contrats ne sont pas modifiés. Les choix restent un point de départ, pas un panier préconfiguré.
- FR/EN, liens vers les trois mêmes slugs, lien bon cadeau et avertissement de délai conservés. Aucun événement de recommandation sur le lien indisponible.
- Mobile empilé, contrôles utilisables à 390 et 320 px, animations sobres et respect de reduced-motion. Les images sont optimisées par le composant Next existant.
- Aucun changement de politique PostHog, pixel ChatGPT, métier, consentement, fournisseur, base de production, paiement ou email.

## Inventaire préalable

Base locale : `05fe56aef047f91104bbb43015e79a7232d941ed`, main. Worktree initial propre, fetch/pull fast-forward : déjà à jour.
Versions lues dans le projet : Next 16.4.3, React/React DOM 19.2.4, next-intl ^4.14.9, Tailwind 4, Playwright ^1.62.1. Guides Next installés lus avant le code : `01-app/01-getting-started/11-css.md` et référence `02-components/image.md`. Règles AGENTS racine et projets lues ; skills design, Cartoonova, React et TDD chargés.

## Vérifications fraîches sur l’état final

### Tests ciblés : 34/34, sans test sauté

Commande isolée :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test --test-concurrency=1 tests/gift-guide-browser.test.mjs tests/gift-prices-browser.test.mjs tests/seo-prices-browser.test.mjs tests/ten-cards-copy.test.mjs
```

Preuves : `/home/hermes/.hermes/profiles/cartoonova/cache/gift-guide-premium-tests-q3vxmlda/` (`tests.tap`, `results.json`, quatre rapports Chromium `components/*.json`).

Le harnais guide monte les vrais composants et la vraie CSS globale compilée plus la CSS du guide. Les frontières next/link, next/image, devise et mesure sont isolées ; les fichiers image/police réels sont servis localement, sans fournisseur. FR/EN × desktop/mobile : chargement, 503, reprise, clic physique indisponible silencieux, prix exacts 15/25 USD sur grille synthétique, payloads exacts de sélection et de recommandation, clavier et Entrée, trois destinations, focus visible de 3 px, tailles cibles ≥44 px, débordement à 320 px, reduced-motion, images décodées, aucune erreur React et zéro violation axe WCAG A/AA sur le guide. Les contrôles nécessitant une appréciation manuelle d’images restent signalés comme incomplets dans les JSON axe ; ce n’est pas une certification d’accessibilité du site entier.

Un premier test RED a échoué sur l’absence des radios dans l’ancien guide. Une première assertion de nom d’événement de test a été corrigée pour employer le nom réel existant `gift_guide_choice`. Un essai parallèle des quatre fichiers a eu un timeout dans le test préexistant de reprise tarifaire à horloge simulée ; les 34 tests ont ensuite été relancés intégralement avec une concurrence de fichiers à 1 et tous passent. L’essai échoué est préservé dans `cache/gift-guide-premium-tests-9r_8vqjz/` ; aucun changement de code métier n’a été effectué pour le masquer.

### Lint, build, HTTP et navigateur compilé

Commande : `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" python scripts/verify-ten-cards-local.py`.

Dernière preuve : `/home/hermes/.hermes/profiles/cartoonova/cache/next-ten-review-qz7q1x_7/`.

- Lint : sortie 0, 0 erreur et 28 avertissements dans des fichiers non modifiés.
- Build de production avec TypeScript : sortie 0, `.next-ten-local`, environnement minimal, identifiants synthétiques, PostgreSQL jetable avec schéma et migrations. Les `.env*` sont refusés avant démarrage. Le tsconfig est restauré par le harnais.
- 20 routes HTTP cadeau/collections dans les dix langues : toutes 200 ; CSP présente. Les deux lectures sitemap restent valides.
- Vrai Chromium sur `next start` de ce même artefact : choix FR, clavier EN, erreur/reprise USD et montant, CSP, rendu et captures. Aucun paiement réel. Les transports externes sont interceptés ; ce n’est pas un test des SDK fournisseurs en production.
- Scan des secrets synthétiques dans 9 218 fichiers de build : aucun chemin avec fuite.
- Serveur et base jetable arrêtés dans le finally, confirmation JSON.
- `git diff --check` : sortie 0.

Le manifeste des sources et les résultats exacts sont dans `/home/hermes/.hermes/profiles/cartoonova/cache/gift-guide-premium-verification.json`. Aucun résultat global d’un ancien lot n’est réutilisé pour prétendre que toute la suite du dépôt a été réexécutée. Les autres suites du lot dix cartes ne sont pas relancées dans cette refonte ciblée.

## Captures à remettre

Toutes les captures finales viennent du vrai site Next construit, puis sont copiées dans le dossier autorisé du profil :

- Desktop (guide seul, titre complet, 1200 × 1058) : `/home/hermes/.hermes/profiles/cartoonova/cache/screenshots/gift-guide-premium-gift-desktop.png`
- Mobile choix (390 × 844) : `/home/hermes/.hermes/profiles/cartoonova/cache/screenshots/gift-guide-premium-gift-mobile-choices.png`
- Mobile recommandation (342 × 718) : `/home/hermes/.hermes/profiles/cartoonova/cache/screenshots/gift-guide-premium-gift-mobile-result.png`
- Variante conte de fées : `/home/hermes/.hermes/profiles/cartoonova/cache/screenshots/gift-guide-premium-gift-desktop-fairytale.png`
- EN après reprise : `/home/hermes/.hermes/profiles/cartoonova/cache/screenshots/gift-guide-premium-gift-en-recovered.png`

Les trois cadres principaux ont été ouverts et inspectés visuellement. La navigation sticky masquait le titre dans la première capture desktop : le cadrage a été corrigé, puis le harnais lint/build/HTTP/navigateur a été réexécuté. Les anciennes preuves sont conservées dans `next-ten-review-eu9k1x6w/`. Aucune capture finale n’est une pleine page de 11 000 px ni un mockup.

Comparaison avant : `cache/screenshots/gift-guide-before-desktop.png` et `gift-guide-before-mobile.png` proviennent du composant avant modification, rendu Chromium avec les styles réels et une grille **synthétique** complète. Elles servent à comparer la composition, pas à comparer les montants à ceux de la base jetable du build final. Le script de cette capture historique est conservé en cache sous `capture-gift-guide-baseline-05fe56a.mjs` et n’est pas un harnais à rejouer sur le composant modifié.

Auto-audit design : 0/10 des signaux de slop définis dans claude-design. Surface Explorer, pas de hero SaaS, de dégradé tech, de faux chiffres ou d’illustration inventée ; le contenu le plus important est le portrait et non trois blocs de caractéristiques équivalents.

## Fichiers et livraison

Modifiés :
- `app/[locale]/cadeau/GiftGuide.tsx`
- `tests/gift-guide-browser.test.mjs`
- `scripts/verify-ten-cards-browser.mjs` (contrôles radios et cadrages lisibles)

Créés :
- `app/[locale]/cadeau/GiftGuide.css` (sélecteurs préfixés, sans altération des jetons globaux)
- `tests/gift-guide-premium-report.md` (ce rapport)

Hors dépôt : preuves et captures dans le cache du profil ; skill `cartoonova-build-deploy` enrichi d’une règle sur cadrage sticky et mise à jour des deux harnais après passage aux radios.

**Pas de commit, push ou publication. Revue indépendante du parent encore requise avant commit.** Aucun Trello modifié.
