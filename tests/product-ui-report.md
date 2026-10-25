# EXT-UX-01 / QA-03 — validation locale

## Résultat

- **EXT-UX-01 corrigé** : le zoom utilise un véritable `<dialog>.showModal()`. Sa top layer sort du contexte d’empilement créé par `.galerie { position: sticky }` sur desktop ; augmenter seulement son `z-index` ne suffisait pas. L’en-tête, le bandeau et la barre d’achat restent sous cette couche native. Le navigateur rend l’arrière-plan inerte, place le focus sur la croix, et Tab / Maj+Tab restent sur l’unique commande. Échap, croix et Retour ferment le zoom et rendent le focus au déclencheur ; le défilement du fond est restauré.
- **QA-03 corrigé** : `support` était déjà initialisé à `digital`, mais `supports` était vide tant que les prix n’étaient pas disponibles. `supportChoisi?.libelle` produisait donc un bouton vide au SSR et pendant le chargement. Le libellé de repli est maintenant traduit et dépend du support sélectionné, pas de la présence des tarifs. Le nom accessible explicite est `Modifier le support : Fichier numérique` en français, traduit dans les dix catalogues et actualisé après chaque sélection. La description de commande reprend ce même libellé.
- **51 tests distincts passés**, dont **32 tests produit UI** et **19 tests de non-régression**. Deux tests UI agrègent **700 rendus et fermetures réelles** : 35 produits × 10 langues × desktop/mobile. Ces 700 cas ne sont pas présentés comme 700 tests TAP séparés.

## Périmètre des modifications

- `app/[locale]/[produit]/FicheProduit.tsx`
- `app/toonjaune-app.css` : normalisation des dimensions/marges/bordure du dialogue natif.
- `messages/{fr,en,es,de,it,nl,pl,sv,da,pt}.json` : uniquement la clé `fiche.modifierSupport`.
- `tests/product-ui-browser.test.mjs`
- Ce rapport et `tests/product-ui-evidence/`.

Aucune modification de checkout backend, pages SEO/cadeaux, tarifs GBP ou sauvegardes par ce chantier. Les modifications parallèles d’autres agents ont été conservées. Aucun commit, push, déploiement ou build global.

## Preuves TDD RED → GREEN

Les tests ont été écrits et exécutés en échec avant chaque correctif produit :

1. Couche du zoom : cible de la croix interceptée par l’en-tête sur desktop.
2. Focus : deux échecs attendus desktop/mobile, `opening focuses the close control`, avant remplacement du faux dialogue.
3. Support : dix échecs attendus, libellé SSR vide au lieu de `product.digital`, avant ajout du repli et de la clé accessible.

Journaux conservés :

- `product-ui-evidence/red-focus-before-fix.log` : 0/2, échecs attendus.
- `product-ui-evidence/red-support-before-fix.log` : 0/10, échecs attendus.
- `product-ui-evidence/red-baseline.log` : confirmation reproductible sur le composant original du SHA `2528120`, avec le harnais final et les vraies feuilles de style compilées. 0/3 : libellé vide, focus absent, croix masquée par l’en-tête.
- `product-ui-evidence/green-behavior.log` : 30/30.
- `product-ui-evidence/green-matrix.log` : 2/2, matrice 700/700.
- `product-ui-evidence/green-regressions.log` : 19/19.
- `product-ui-evidence/summary.json` : agrégation programmée, noms dédoublonnés, matrice par langue/viewport et empreintes SHA-256 des sources concernées.

Le mode `PRODUCT_UI_BASELINE=2528120` substitue seulement le composant original lors du bundle de test en mémoire ; il n’écrit ni ne restaure aucun fichier de production.

## Vérifications exécutées

Toutes les commandes ont été exécutées depuis le dépôt, dans un environnement minimal sans secrets :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" \
  node --test --test-name-pattern='support recap|zoom keyboard' tests/product-ui-browser.test.mjs
# 30 tests, 30 passés, 0 échec

env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" \
  node --test --test-name-pattern='zoom real' tests/product-ui-browser.test.mjs
# 2 tests, 2 passés ; 350 desktop + 350 mobile

env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" \
  node --test tests/product-prices-browser.test.mjs tests/seo-prices-browser.test.mjs tests/photo-privacy-copy.test.mjs
# 19 tests, 19 passés, 0 échec

env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" \
  node node_modules/eslint/bin/eslint.js 'app/[locale]/[produit]/FicheProduit.tsx' tests/product-ui-browser.test.mjs
# sortie 0, aucune erreur ni avertissement

git diff --check
# sortie 0
```

Rejouer les trois régressions sur l’ancien composant :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" PRODUCT_UI_BASELINE=2528120 \
  node --test --test-name-pattern='zoom keyboard.*fr/desktop|support recap.*\(fr\)|zoom real desktop' tests/product-ui-browser.test.mjs
# sortie Node attendue : 1 ; trois échecs fonctionnels
```

### Couverture détaillée

- Chromium réel, desktop 1440×900 et mobile 390×844 avec écran tactile.
- Composants réels `FicheProduit`, `Navbar`, vrais catalogues `next-intl`, vrai hook Retour et catalogue `CATALOGUE_EN_LIGNE` vérifié à 35 produits.
- Feuilles `globals.css`, Tailwind/preflight et imports CSS compilés avec PostCSS installé, plus CSS des composants. Ne pas omettre les styles globaux : un premier harnais incomplet avait créé un faux débordement mobile (viewport de mise en page de 1024 px) ; ce défaut de harnais a été corrigé avant validation finale.
- Chaque cas catalogue : vrai clic desktop ou vrai tap mobile sur l’image puis la croix, **sans `force`**, vérification `elementFromPoint`, focus de la croix, disparition du dialogue, libellé initial et nom accessible du support.
- Dans chaque langue, desktop et mobile : ouverture clavier, focus initial, Tab/Maj+Tab, Échap, Retour historique, retour au déclencheur après fermeture et restauration du verrouillage de défilement.
- Dans chaque langue : rendu serveur React sans tarifs disponibles, rendu client initial en attente, arrivée des prix, choix successif des quatre supports, libellé et nom accessible actualisés, clic du récapitulatif ramenant à l’étape support.
- Non-régressions : prix initiaux, course des devises, erreur/reprise des prix, JSON-LD/prix visibles et notices photos multilingues.

## Isolation et limites

Toutes les requêtes navigateur sont interceptées. Seule l’origine synthétique `https://product.invalid` est servie en mémoire ; toute autre origine est bloquée et fait échouer l’assertion finale. Images SVG synthétiques, prix de fixture et frontières Next Image/Link/navigation, analytics, upload et checkout isolées. Aucun appel à une base, Stripe, Resend ou à un service de production dans le nouveau harnais.

Il s’agit de **rendus isolés des composants réels**, pas de 700 URL Next.js servies en HTTP, ni de captures des visuels du catalogue public. La galerie est une image synthétique commune pour garantir déterminisme et absence de réseau externe. L’analyse du HTML SSR est réalisée avec le vrai `renderToString`, pas avec un serveur Next complet. Safari/Firefox, lecteur d’écran et production non testés. Les vérifications globales/build/revue d’intégration restent au parent.

Une tentative monolithique de cette suite UI a atteint la borne terminal de 120 secondes après 31 tests réussis. Elle n’est pas comptée comme réussite complète : les deux sélections disjointes ci-dessus ont ensuite été exécutées jusqu’au bout et constituent la preuve de validation de l’ensemble des 32 tests UI. Le runner global du dépôt dispose d’une borne par fichier de 180 secondes ; en itération, conserver les deux sélections bornées.
