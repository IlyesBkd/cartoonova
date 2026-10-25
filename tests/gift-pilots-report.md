# SEO-02 — six pages cadeaux pilotes, travail local

Carte : https://trello.com/c/sB6R35A5

## Livré

Six URL **existantes**, uniquement en français :

- `/fr/cadeau/rickandmorty-anniversaire` : expression inhabituelle, référence au repos, pose et portail.
- `/fr/cadeau/simpson-anniversaire` : coiffure/barbe/chapeau, choix canapé/maison/plage, placement familial.
- `/fr/cadeau/onepiece-anniversaire` : lisibilité du format Wanted, surnom, références visage/tenue.
- `/fr/cadeau/dbz-anniversaire` : référence en pied et visage, place des mains, contraste décor/aura.
- `/fr/cadeau/ghibli-anniversaire` : geste entre adultes et enfant, lumière, distinction ambiance/lieu exact.
- `/fr/cadeau/disney-anniversaire` : expressions, photos distinctes du duo, tenue quotidienne et fond discret.

Chaque page comporte une introduction propre, deux raisons spécifiques, des conseils photo et décor, une suggestion de composition explicitement identifiée, une légende descriptive et deux questions/réponses propres. Les deux FAQ communes d’anniversaire (délais et groupe) restent présentes. La FAQ visible et le JSON-LD partagent exactement la même liste. Aucun nouveau slug, aucune nouvelle langue, aucun nouveau fichier image, aucun appel de génération.

Diagnostic éditorial A : les six pages réutilisaient l’introduction et la FAQ génériques de l’occasion. L’enrichissement répond aux choix concrets à préparer avant de configurer le portrait ; il ne prétend pas ajouter une preuve client.

## Choix des pilotes et baseline GSC

Export existant fourni par le parent, relu et compté programmatiquement :
`/home/hermes/.hermes/profiles/cartoonova/cache/four-cards-local/gsc-gift-baseline.json`.
Période **2026-07-25 → 2026-10-22**, dimension page, 64 lignes cadeaux dont 8 FR.

- Rick et Morty anniversaire : **14 impressions, 0 clic, position moyenne 3,142857142857143**. C’est la seule page anniversaire FR avec une ligne dans cet export : priorité de suivi, pas preuve d’une demande forte.
- Les cinq autres anniversaires FR n’ont pas de ligne : **aucune conclusion de non-indexation ou de demande nulle**.
- DBZ mariage a 3 impressions ; les six autres lignes FR ont chacune 1 impression. Ce signal ne justifie pas de multiplier les pages ou de changer le groupe en cours de comparaison.

Les six anniversaires demandés par la carte forment un groupe cohérent (même occasion, six styles), non une sélection de six gagnants démontrés. Échantillon insuffisant pour promettre clics, trafic, position ou indexation. Aucune nouvelle collecte n’a été lancée.

### Mesure avant toute extension

Après une publication expressément autorisée, enregistrer sa date et son SHA, puis comparer les six URL exactes sur des fenêtres de durée identique avant/après publication. Prévoir un premier point après 28 jours complets, puis prolonger si les volumes restent trop faibles. Conserver pays/appareil/type de recherche comparables ; consulter les requêtes si elles sont disponibles. Séparer clics, impressions, CTR et position et tenir compte des variations de saison et d’exposition. Suivre Rick et Morty séparément sans masquer les cinq URL sans ligne initiale. Contrôler l’indexation par un outil dédié si nécessaire : l’absence de ligne analytique n’est pas ce contrôle. N’étendre à aucune autre occasion/langue avant analyse et décision explicite. Pas d’attribution causale automatique à ces textes.

## Illustrations : vérification visuelle et limites de preuve

Les six visuels déjà employés par les pages ont été inspectés visuellement **avant** rédaction, dans une planche locale :
`/home/hermes/.hermes/profiles/cartoonova/cache/scratch/gift-contact.png`.
Les fichiers sont également décodés intégralement avec Sharp dans les tests et affichés avec le vrai `next/image` dans Chromium.

| Style | Fichier existant inspecté | Éléments effectivement visibles |
| --- | --- | --- |
| Simpson | `public/framed.jpg` | Deux personnages jaunes dans un cadre noir, intérieur rose, photo en bas à gauche. |
| One Piece | `public/onepiece/portrait_encadré.png` | Affiche Wanted/Him & Her, deux personnages sur un bateau, photo ronde à gauche. |
| DBZ | `public/DBZ/Photo_produits/1.png` | Personnage en pantalon blanc, aura rouge, rochers, photo présentée devant le cadre. |
| Ghibli | `public/Ghibli/Photo_produits/il_794xN.7001686030_jbst.png` | Deux adultes et un enfant, lumière dorée, photo ronde en bas à droite. |
| Disney | `public/Disney/Photo_produits/1.png` | Deux personnages souriants, tenue grise et cheveux longs, paysage urbain, petite photo en bas à gauche. |
| Rick et Morty | `public/rickandmorty/Photo_produits/1.png` | Personnage portant l’autre, portail vert, photos rondes de part et d’autre. |

Aucune de ces images ne prouve un anniversaire réel, une commande particulière, sa date ou un témoignage. Les légendes le disent. Aucun prénom, avis, résultat ni histoire client n’a été inventé. Les propositions de composition sont des **suggestions**, distinctes du sujet réellement visible. Pas de publication externe ni de nouvelle utilisation hors des pages déjà illustrées ; aucun audit juridique autonome des droits n’est revendiqué.

Les décors proposés sont vérifiés dans `lib/visuels.ts` et leurs fichiers existent : huit pour DBZ, décors historiques pour Simpson. One Piece, Ghibli, Disney et Rick et Morty n’ont pas de galerie de décors prédéfinis. La copie ne leur invente pas de sélecteur ni une option incluse ; elle demande confirmation des souhaits particuliers avant achat.

## Preuves RED → GREEN

### RED avant tout code produit

Commande isolée :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test tests/gift-pilots.test.mjs
```

Résultat observé : **exit 1, 1 test, 0 réussi, 1 échec**.
Test : `six French birthday pilots render differentiated practical composition guidance`.
Échec attendu : `simpson needs practical pilot guidance`, assertion `/data-gift-pilot=/` absente du rendu réel de la page. Ce n’était pas une erreur d’import ou de compilation.
Journal initial : `$TMPDIR/gift-pilots-red.log`.

Après ajout de la première tranche (données + composant + branchement réel), le même test est passé : **exit 0, 1/1**. Les contrôles de non-régression, FAQ et navigateur ont ensuite été ajoutés et exercés.

### GREEN et non-régressions

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" \
  PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}" \
  node --test tests/gift-pilots.test.mjs tests/occasion-context.test.mjs \
  tests/gift-prices-browser.test.mjs tests/photo-privacy-copy.test.mjs
```

Résultat : **exit 0, 32 tests réussis, 0 échec, 0 ignoré**. Journal : `$TMPDIR/gift-pilots-final-green.log`.

- Suite pilotes : cinq tests ; rendu React/next-intl des six pages, unicité de tous les champs éditoriaux et des 12 nouvelles questions/réponses, FAQ visible = JSON-LD, images locales décodées, décors réellement existants.
- Chromium isolé : six vrais corps de page à 390 et 1280 px (12 variantes), CSS réelle compilée par le plugin PostCSS Tailwind, vrai composant `next/image`, images chargées depuis les fichiers locaux, légendes visibles, FAQ ouvrables, pas de débordement horizontal. Toutes les requêtes externes sont bloquées.
- Snapshot antérieur à l’implémentation (`tests/gift-pilots-baseline.json`, HEAD de départ `2528120`) : **360 métadonnées complètes identiques**, dont canonical/hreflang/OG, paramètres statiques identiques, **354 rendus non-pilotes strictement identiques** à horloge contrôlée. Le hash couvre la totalité du corps rendu, pas un simple inventaire de textes.
- Suite occasions : graphe des liens de 360 pages rendues, conservation des langues, occasions, destinations existantes, délais et absence de campagne étrangère.
- Suite tarifs : grilles EUR/GBP/USD et CTA vers configurateur, réponses tardives/erreurs/reprise ; prix de test isolés, pas validation commerciale de production.
- Suite notices : produit, dépôt après paiement, retouches et documents légaux dans les dix langues ; absence de nouvelle promesse d’effacement ou de promotion par défaut.
- ESLint ciblé sur les quatre sources ajoutées/modifiées et `git diff --check` : succès.

Avertissement connu : Node signale l’API expérimentale MockTimers ; aucun test n’est ignoré pour cette raison. Le harnais substitue les frontières serveur de traduction et de prix, et le provider tarifaire pour les rendus SEO. Les prix interactifs sont exercés séparément avec la suite dédiée. Le test Chromium injecte les corps rendus dans une page isolée : **ce n’est pas un démarrage HTTP Next ni un test du layout complet de production**.

## Critères non réalisés / suite nécessaire

- **Cas clients originaux d’anniversaire prouvés : non réalisé**, faute de preuves disponibles. Pour débloquer ce critère, obtenir un dossier autorisé liant une réalisation à l’occasion, un brief vérifiable et l’autorisation de publication distincte. Les conseils et suggestions utiles ne sont pas présentés comme un remplacement de cette preuve.
- **Publication et validation HTTP de production : non réalisées**, conformément au périmètre. La carte n’est pas réputée clôturable en production.
- **Gains SEO / indexation / comparaison après publication : non mesurés** ; plan ci-dessus, aucune garantie.
- **Build global, tests globaux, commit, push, transaction réelle : non exécutés**, sur instruction. Pas de modification des sauvegardes/restaurations.
- Aucun changement par cette tâche dans `messages/`, le backend checkout, `FicheProduit.tsx`, les tarifs, les règles métiers ou les notices. L’arbre de travail est partagé avec d’autres agents : leurs fichiers ne font pas partie de cette livraison.

## Fichiers de cette livraison

- Modifié : `app/[locale]/cadeau/[slug]/page.tsx`.
- Ajoutés : `lib/giftPilots.ts`, `components/GiftPilotGuide.tsx`, `tests/gift-pilots.test.mjs`, `tests/gift-pilots-baseline.json`, `tests/gift-pilots-report.md`.
