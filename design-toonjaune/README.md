# ToonJaune — système de design

Paquet autonome, à déposer dans un autre projet pour en reprendre le design.

Ouvrir **`demo.html`** : palette, typographie, boutons et tous les composants
rendus sur une page. C'est la référence.

## Ce qu'il y a dedans — et ce qu'il n'y a pas

Ce paquet contient le **système**, pas le **contenu**. Les 86 Mo de photos et de
vidéos du site d'origine appartiennent aux boutiques capturées : ils n'ont rien
à faire dans un nouveau projet. Ils sont remplacés par des substituts SVG qui
matérialisent chaque emplacement et son format.

```
systeme/
  jetons.css       couleurs, échelle, polices, styles de base
  composants.css   boutons, en-tête, hero, cartes, étapes, FAQ, bandeaux, pied
  produit.css      galerie, configurateur, panneau d'achat, comparatif, presse
polices/           les 3 familles + note de licence
blocs/             12 patrons de markup, prêts à copier
gabarit/           le gabarit de page produit ({{champs}} et conditions)
substituts/        8 SVG de remplacement, un par format d'image
demo.html          la page de référence
```

## Démarrer

```html
<link rel="stylesheet" href="systeme/jetons.css">
<link rel="stylesheet" href="systeme/composants.css">
<link rel="stylesheet" href="systeme/produit.css">  <!-- pages produit seulement -->
```

L'ordre compte : `composants.css` et `produit.css` consomment les variables de
`jetons.css`.

## Reskinner en une minute

Tout part de `:root` dans `jetons.css`. Aucun composant ne code une couleur en
dur — changez les neuf variables, tout suit.

| Jeton | Valeur | Rôle |
|---|---|---|
| `--encre` | `#2A2552` | ancre : titres, sections sombres, pied de page |
| `--encre-doux` | `#5A5578` | texte secondaire |
| `--soleil` | `#E9BA3B` | action, accents |
| `--soleil-fonce` | `#D4A32A` | survol, profondeur des boutons |
| `--soleil-pale` | `#FBEFCB` | pastilles, fonds d'icône |
| `--creme` | `#FFF9ED` | fond chaud : hero, bandes douces |
| `--menthe` | `#E0FAFA` | tint secondaire : bandeau défilant |
| `--cendre` | `#F8F6F3` | bande neutre alternée |
| `--papier` | `#FFFFFF` | fond général, cartes |

Échelle et formes : `--largeur` (1200 px), `--rayon` (18 px), `--rayon-lg`
(28 px), `--ombre`, `--ombre-forte`.

## La règle typographique qui tient le système

Trois familles, mais **une seule discipline** : `--accent` (Atma) est réservée au
**mot accentué d'un titre**, jamais au reste.

```html
<h2>Trois étapes, <span class="accent">c'est tout</span></h2>
```

Utilisée partout, elle redevient du bruit. C'est ce qui donne au système son
caractère sans le rendre criard.

## Deux pièges CSS déjà réglés

Ils reviendront si vous ajoutez des composants :

- **Grilles** — les éléments de grille ont `min-width: auto` et ne peuvent pas
  descendre sous la largeur intrinsèque d'une image. Sans `min-width: 0`, la
  grille déborde. Réglé sur toutes les grilles du système.
- **Flex en colonne** — même chose sur l'axe vertical avec `min-height: auto` :
  un `aspect-ratio` est purement ignoré tant qu'on n'a pas posé `min-height: 0`.

## Adaptatif

Points de rupture utilisés : **1100 px** (la colonne de tuiles passe en rangée),
**1000 px** (hero et grilles à une colonne, menu replié), **860 px**, **620 px**,
**520 px**. `prefers-reduced-motion` est respecté.

## À vérifier avant usage réel

- **Polices** : Atma est libre (OFL). **Kefir et Rebond Grotesque sont
  commerciales** — voir `polices/LISEZMOI.md`. Substituts libres proches :
  Fredoka ou Baloo 2, Inter ou Manrope.
- **Substituts d'images** : à remplacer par vos visuels, mêmes proportions.
- Les patrons de `blocs/` contiennent encore des **textes d'exemple** (avis
  signés, mentions presse, récit de marque) : ce sont des gabarits de contenu,
  pas du contenu à reprendre.
