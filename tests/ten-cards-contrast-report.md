# QA-02 — Contraste des textes dorés

Carte : https://trello.com/c/tQQIaGe8 — baseline locale `abbf837`.

## Résultat et limite d’intégration

**Le correctif couleur est implémenté et vérifié en Chromium desktop/mobile.** Les textes dorés mesurés passent AA sur les cinq surfaces claires du système. Les boutons, ombres, étoiles et chiffres en filigrane gardent leurs couleurs d’origine.

**Ne pas déclarer toute la carte terminée : les chiffres strictement décoratifs doivent encore recevoir `aria-hidden="true"` dans leurs composants propriétaires.** Le périmètre délégué autorise les changements de couleur seulement dans ces composants ; aucun contournement CSS n’a été utilisé pour modifier leur sémantique. Le test d’intégration dédié reproduit encore cette lacune (voir ci-dessous). Aucun commit, push, déploiement, accès production, email ni appel fournisseur.

## Modification minimale

- `app/toonjaune.css` : `--accent-texte` passe de `#AD7F12` à `#875E08`. `--accent-texte-petit` devient son alias (auparavant `#96690A`). L’or reste brun-doré ; sa luminance permet aussi les petits textes sur cendre.
- `app/toonjaune-app.css` : `.prose a` et `.bon-imprimable__marque` utilisent le jeton de texte, et non `--soleil-fonce` (`#D4A32A`, réservé aux ombres).
- Les jetons `--soleil: #E9BA3B`, `--soleil-fonce: #D4A32A`, `--soleil-pale: #FBEFCB` et toutes les surfaces sont inchangés. Le test vérifie explicitement fond/texte/ombre du vrai bouton principal de Navbar.

## Méthode réelle

`tests/ten-cards-contrast-browser.test.mjs` compile le vrai point d’entrée `app/globals.css` avec PostCSS et `@tailwindcss/postcss` : Tailwind/preflight + ToonJaune + pont applicatif + feuilles caisse/fiche/pages/portfolio. Les composants React réels sont compilés avec esbuild et montés dans Chromium à **1440×900** et **390×844**, avec polices locales réelles et catalogues FR réels. Les animations finies sont attendues avant les mesures axe pour ne pas prendre l’opacité transitoire d’une barre sticky pour une couleur définitive.

Composants exercés : `Accueil`, `Catalogue` (35 produits), `AProposClient`, `FicheProduit` (premier produit, légende transformation), `PageLegale` (document synthétique), page réelle de bon imprimable (bon synthétique), `Navbar` (menu desktop ouvert). Une matrice supplémentaire rend `PageLegale` sur les cinq fonds réels.

Les frontières navigation Next/image, devise/tarifs, DB/jeton/bon et Stripe sont remplacées localement ; le rendu des composants, la typographie, les styles et `next-intl` sont réels. Les images sont des SVG synthétiques. Tous les transports autres que les ressources interceptées de `https://contrast.invalid` sont bloqués ; aucune DB ni API n’est jointe. Les erreurs JS et transports externes inattendus font échouer le test.

Le calcul utilise `getComputedStyle`, taille/gras réels, composition alpha des fonds hérités et formule WCAG sRGB. Les seuils sont **3:1 à partir de 24px**, ou **18,6667px avec graisse ≥700**, sinon **4,5:1**. Par exemple 22px/600 reste du texte normal (seuil 4,5), pas du grand texte par approximation. Les ratios ne sont pas arrondis avant l’assertion.

## Inventaire rendu avant/après

Ratios calculés en Chromium, arrondis ci-dessous uniquement pour lecture. Les JSON contiennent chaque occurrence, fond RGB, taille, graisse, seuil et ratio non arrondi.

| Texte / sélecteur pertinent | Fond réel | Taille desktop / mobile ; graisse | Seuil | Avant | Après |
|---|---|---|---:|---:|---:|
| Accueil : « cartoon », « tes personnages préférés », « questions » (`.accent`) | cendre `#EDE5D5` | 46 / 30px ; 700 | 3 | 2,881 | **4,614** |
| Catalogue : « un seul toi » (`.accent`) | crème `#FFF9ED` | 50 / 32px ; 700 | 3 | 3,440 | **5,509** |
| À propos : « Cartoonova » (`.accent`) | crème | 50 / 32px ; 700 | 3 | 3,440 | **5,509** |
| À propos : « fait ça » (`.accent`) | fond `#F6F0E4` | 46 / 30px ; 700 | 3 | 3,178 | **5,091** |
| Fiche : légende « Simpson » (`.galerie__legende .accent`) | fond | 26 / 19px ; 700 | 3 | 3,178 | **5,091** |
| Fiche : FAQ « questions » (`.accent`) | fond | 46 / 30px ; 700 | 3 | 3,178 | **5,091** |
| Maquette dépôt accueil : « Choisir des fichiers » (`.hiw-mock__zone span`) | papier `#FFFFFF` | 15px ; 700 | 4,5 | 4,859 | **5,778** |
| Document légal : lien local et email (`.prose a`) | fond | 17px ; 600 | 4,5 | 2,040 | **5,091** |
| Bon imprimable : « Cartoonova » (`.bon-imprimable__marque`) | papier | 17px ; 800 | 4,5 | 2,315 | **5,778** |
| Menu ouvert : « Voir tous les styles » (`.nav__tout`) | papier | 14,5px ; 700 | 4,5 | 3,607 | **5,778** |
| Surtitre doré « Pourquoi nous » accueil/à-propos | encre `#2A2552` | 21px ; 500 | 4,5 | 7,779 | **7,779 inchangé** |
| Tuile fiche : « Premier aperçu… » | encre | 22px ; 600 | 4,5 | 7,779 | **7,779 inchangé** |

### Matrice de surfaces (vrais liens de PageLegale, 17px/600)

| Surface | Ancien lien `#D4A32A` | Nouvel or `#875E08` | AA normal |
|---|---:|---:|---|
| papier `#FFFFFF` | 2,315 | 5,778 | oui |
| crème `#FFF9ED` | 2,207 | 5,509 | oui |
| fond `#F6F0E4` | 2,040 | 5,091 | oui |
| cendre `#EDE5D5` | 1,849 | 4,614 | oui |
| soleil-pâle `#FBEFCB` | 2,018 | 5,038 | oui |

### Inventaire statique complémentaire et exceptions

- Le jeton commun couvre aussi `.marque i`, `.nav__style__vignette i` (17px), `.nav__vedette__visuel i` (44px), `.nav__vedette__cta` (13,5px), les accents des autres pages publiques, et `.suivi__aide a` via le petit jeton. Leurs variantes absentes des fixtures ne sont **pas** annoncées comme rendues individuellement ; la matrice des surfaces valide la palette, pas chaque route.
- `.hero h1 .accent`, accents des atouts et `.cta-fin h2 .accent` imposent déjà de l’encre : pas de changement.
- `.accent--clair`, promo, badges, étoiles et chiffres de contrôle sur fond encre restent jaune clair ; les usages texte sur fond encre mesurés passent 7,779:1.
- Les icônes, traits, ombres et étoiles décoratives ne sont pas du texte courant et ne sont pas assombris en bloc. Aucun remplacement global de `--soleil` ou `--soleil-fonce`.
- Les maquettes internes `simpson-mockups/*` à palettes autonomes ne font pas partie des templates commerciaux mesurés.

## Chiffres décoratifs : reprise nécessaire par le parent

Le rendu trouve **11 occurrences par viewport** : 3 `.hiw-background-number` + 4 `.atout-carte__num` sur l’accueil, et 4 `.atout-carte__num` à propos. Elles ne portent aucune information nécessaire en plus des titres ; le filigrane doit conserver son aspect, mais pas être exposé comme texte.

Changement de balisage suggéré, non appliqué hors périmètre couleur :

- `components/pages/Accueil.tsx` : ajouter `aria-hidden="true"` aux trois `<span className="hiw-background-number">` et au `<div className="atout-carte__num">` généré dans la boucle.
- `app/[locale]/a-propos/AProposClient.tsx` : même attribut sur le `<div className="atout-carte__num">` généré.

Le test enregistre ces occurrences dans `results[].decorations`. Le mode `CONTRAST_REQUIRE_DECORATIVE_HIDDEN=1` exige explicitement leur masquage ; il est **RED actuellement** (journal `contrast-decoration-red.log`). Après application par leur propriétaire, relancer ce mode puis supprimer la condition pour en faire une assertion obligatoire.

Axe conserve les violations `.atout-carte__num` (1,14:1 sur blanc), et des `incomplete` sur gradients/images et filigranes. Le correctif ne les cache pas dans les preuves JSON. Donc **pas de déclaration « axe entièrement sans violation »**, ni de validation AA complète de tout le site. Les violations des textes dorés informatifs visés sont corrigées ; l’exception décorative doit encore être finalisée.

## TDD et commandes exécutées

Toutes les commandes Node de test sont lancées avec `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR"` (aucun secret).

1. **RED avant modification** : `CONTRAST_BASELINE=abbf837 node --test tests/ten-cards-contrast-browser.test.mjs` reproduit 2 échecs (desktop/mobile), dont le titre 46px à 2,88069:1 et les liens normaux insuffisants. Les deux CSS baseline sont relues avec `git show` en mémoire, jamais restaurées sur l’arbre partagé.
2. **GREEN couleur** : `node --test tests/ten-cards-contrast-browser.test.mjs` : **2/2 réussis**. Les données finales comprennent 26 mesures desktop et 25 mobile, aucune sous son seuil ; baseline finale : 17 mesures desktop et 16 mobile sous seuil (la matrice répète volontairement les liens sur cinq surfaces).
3. **RED supplémentaire puis GREEN** du bon imprimable : ajout du vrai composant avec bon synthétique ; échec à 2,31489:1 sur 17px/800 ; remplacement du jeton d’ombre par jeton texte ; réussite à 5,77754:1.
4. **Régressions fiche** : `node --test --test-name-pattern='support recap|zoom keyboard' tests/product-ui-browser.test.mjs` : **30/30** réussis.
5. **Régressions zoom réel** : `node --test --test-name-pattern='zoom real' tests/product-ui-browser.test.mjs` : **2/2** réussis (35 produits × 10 langues × desktop/mobile, matrice 700 ouvertures/fermetures).
6. **Régressions Navbar** : `node --test tests/navbar-browser.test.mjs` : **2/2** réussis, dont 1170 liens atteints en tactile sur 10 langues et trois hauteurs d’écran.
7. **Lint ciblé** : `node node_modules/eslint/bin/eslint.js tests/ten-cards-contrast-browser.test.mjs` : code 0, sans sortie. Le premier lancement via le raccourci `.bin/eslint` était bloqué par le scanner de commandes (budget de lecture), puis la cible JS explicite a réussi.
8. **Contrôle d’intégration décoratif** : `CONTRAST_REQUIRE_DECORATIVE_HIDDEN=1 node --test tests/ten-cards-contrast-browser.test.mjs` : **2 échecs attendus**, à reprendre par le propriétaire des composants (aucune prétention de succès global).

Pas de build global ni d’installation, conformément au périmètre parallèle. Les autres fichiers modifiés par les agents voisins n’ont pas été touchés.

## Preuves locales

Répertoire : `/home/hermes/.hermes/profiles/cartoonova/cache/ten-cards-local/`.

- `contrast-before-desktop.json`, `contrast-before-mobile.json` : inventaire calculé et axe baseline.
- `contrast-after-desktop.json`, `contrast-after-mobile.json` : inventaire calculé, axe, décorations, identité du bouton, absence de transport externe et erreurs JS.
- `contrast-before-{desktop,mobile}-{home,product}.png` et `contrast-after-{desktop,mobile}-{home,product}.png` : 8 captures Chromium avec visuels synthétiques ; les captures accueil après ont été inspectées visuellement (titre sur beige, doré sombre et bouton jaune conservé).
- `contrast-red.log`, `contrast-green.log`, `contrast-decoration-red.log`, `contrast-product-regression.log`, `contrast-zoom-regression.log`, `contrast-navbar-regression.log` : sorties d’exécution.

Ces preuves concernent un harnais de composants local, pas des URL publiques ni une vérification HTTP de production.
