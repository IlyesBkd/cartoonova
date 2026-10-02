import fs from "node:fs";
import path from "node:path";
import type { PrintKey } from "./pricing";
import { CATALOGUE_EN_LIGNE } from "./catalogue";
import { VERSION_VISUELS } from "./versionVisuels";

/**
 * Visuels d'une fiche produit. Module serveur : il lit `public/` au rendu.
 *
 * Deux sources, dans cet ordre :
 *  1. `VISUELS_LIVRES` — les six univers deja en ligne, dont les fichiers sont
 *     ranges dans public/ depuis l'ancien site (chemins historiques conserves).
 *  2. `public/catalogue/<slug>/galerie/*` et `public/catalogue/<slug>/decors/*`
 *     — la convention pour tous les autres. Deposer les fichiers suffit : rien
 *     a declarer, la galerie et l'etape « arriere-plan » apparaissent seules.
 *
 * Sans aucun fichier, la fiche s'affiche avec les substituts du systeme de
 * design (.substitut) et l'etape « arriere-plan » reste masquee.
 */

export interface Decor {
  src: string;
  /** Espace de noms next-intl ou chercher le libelle, si traduit. */
  ns?: string;
  /** Cle de traduction, ou libelle brut si `ns` est absent. */
  cle: string;
  /** Rang du decor, pour les libelles numerotes (« Décor 2 »). */
  numero?: number;
}

/**
 * Legende d'un visuel de galerie.
 *
 * Les visuels deposes viennent de montages dont le titre etait incruste en
 * francais. Le titre est detoure par `scripts/detoure-bandeaux.mjs` et rendu
 * ici en texte : il se traduit alors avec le reste du site, au lieu d'exiger
 * une image par langue. Dans le gabarit complet, le rang du fichier donne le
 * role : 1 transformation, 2 impression, 3 encadrement, puis les portraits
 * clients, qui n'ont pas de titre. Toutes les galeries importees ne suivent pas
 * ce gabarit : voir `AVANT_APRES_EN_TETE` plus bas.
 */
export type LegendeVisuel = "transformation" | "impression" | "cadre";

const LEGENDES_PAR_RANG: (LegendeVisuel | null)[] = ["transformation", "impression", "cadre"];

export interface VisuelsProduit {
  galerie: string[];
  /**
   * Aligne sur `galerie`, pour ce qui sort du site : og:image, flux marchand.
   * Les visuels dont le fond a ete rendu transparent (scripts/retire-fond-blanc.mjs)
   * y retrouvent leur original opaque, range dans `galerie/opaque/` : Facebook
   * affiche la transparence en noir, et Merchant Center attend un fond plein.
   */
  partage: string[];
  /** Aligne sur `galerie`. `null` quand le visuel n'a pas de titre. */
  legendes: (LegendeVisuel | null)[];
  decors: Decor[];
  supports: Record<PrintKey, string>;
}

const RACINE_PUBLIQUE = path.join(process.cwd(), "public");
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

/** Supports d'impression par defaut — les visuels generiques du site. */
const SUPPORTS_DEFAUT: Record<PrintKey, string> = {
  digital: "/digital.jpeg",
  posterSimple: "/poster.png",
  canvas: "/canvas.jpeg",
  framed: "/framed.jpg",
};

const decorsSimpson: Decor[] = [
  { src: "/simpson_background/couch8x10.jpg", ns: "product", cle: "bgCouch" },
  { src: "/simpson_background/house.jpg", ns: "product", cle: "bgHouse" },
  { src: "/simpson_background/beach.jpg", ns: "product", cle: "bgBeach" },
  { src: "/simpson_background/bar.jpg", ns: "product", cle: "bgBar" },
  { src: "/simpson_background/church.jpg", ns: "product", cle: "bgChurch" },
  { src: "/simpson_background/forest.jpg", ns: "product", cle: "bgForest" },
  { src: "/simpson_background/snow.jpg", ns: "product", cle: "bgSnow" },
  { src: "/simpson_background/montain.jpg", ns: "product", cle: "bgMountain" },
  { src: "/simpson_background/valentines.jpg", ns: "product", cle: "bgValentines" },
];

const decorsDbz: Decor[] = Array.from({ length: 8 }, (_, i) => ({
  src: `/DBZ/Backgrounds_DBZ/${i + 1}.jpg`,
  ns: "dbz",
  cle: `bg${i + 1}`,
}));

type VisuelsLivres = Omit<VisuelsProduit, "legendes" | "partage"> & {
  /**
   * Le premier visuel montre la photo d'origine A COTE du dessin. C'est le
   * visuel qui repond a la seule question du visiteur — « est-ce que ce sera
   * moi ? » — et les fiches importees l'ont deja en tete. Les six univers
   * d'origine n'en avaient pas, ou l'avaient sans titre : il etait alors
   * compte parmi les « photos de clients » sous les avis.
   *
   * Uniquement des montages avant/apres qui existent deja dans public/ : on
   * n'en fabrique pas. Un univers sans montage reel garde `false`.
   */
  avantApres: boolean;
};

const VISUELS_LIVRES: Record<string, VisuelsLivres> = {
  simpson: {
    /* `framed.jpg` sert aussi de vignette au support « encadre » : c'est le
       seul montage Simpson du site qui montre la photo d'origine. */
    avantApres: true,
    galerie: [
      "/framed.jpg",
      "/simpson_photos_produit/0009_1.jpg",
      "/simpson_photos_produit/0015_1.jpg",
      "/simpson_photos_produit/0017_1.jpg",
      "/simpson_photos_produit/0021_1.jpg",
      "/simpson_photos_produit/0029_1.jpg",
      "/simpson_photos_produit/0032-revise3.jpg",
      "/simpson_photos_produit/0044_revise.jpg",
      "/simpson_photos_produit/0048.jpg",
      "/simpson_photos_produit/0049.jpg",
      "/simpson_photos_produit/43-2.png",
      "/simpson_photos_produit/IB2-18-1.jpg",
      "/simpson_photos_produit/IB4-20.jpg",
    ],
    decors: decorsSimpson,
    supports: SUPPORTS_DEFAUT,
  },
  dbz: {
    // Premier visuel : montage photo d'origine + dessin, deja en tete.
    avantApres: true,
    galerie: [
      "/DBZ/Photo_produits/1.png",
      "/DBZ/Photo_produits/il_1140xN.7733273072_b9q7.png",
      "/DBZ/Photo_produits/il_1140xN.7781222829_j22o.png",
      "/DBZ/Photo_produits/il_1140xN.7781222843_qc6e.png",
      "/DBZ/Photo_produits/il_1140xN.7781222857_h7cu.png",
      "/DBZ/Photo_produits/il_1140xN.4418149486_poi0.jpg",
      "/DBZ/Photo_produits/il_1140xN.4642601061_1pq4.jpg",
      "/DBZ/Photo_produits/ezgif.com-webp-to-png (7).png",
    ],
    decors: decorsDbz,
    supports: {
      digital: "/DBZ/Add-Ons/digital.png",
      posterSimple: "/DBZ/Add-Ons/poster.jpg",
      canvas: "/DBZ/Add-Ons/canvas.jpg",
      framed: "/DBZ/Add-Ons/framed.jpg",
    },
  },
  disney: {
    // Premier visuel : montage photo d'origine + dessin, deja en tete.
    avantApres: true,
    galerie: [
      "/Disney/Photo_produits/1.png",
      "/Disney/Photo_produits/il_1140xN.6576111634_dwx3.png",
      "/Disney/Photo_produits/il_1140xN.6576111670_bk3q.png",
      "/Disney/Photo_produits/il_1140xN.6576119278_hzjr.png",
      "/Disney/Photo_produits/il_1140xN.6624222083_1rk3.png",
      "/Disney/Photo_produits/il_1140xN.6624222155_5ukx.png",
      "/Disney/Photo_produits/il_1140xN.6624222159_pajm.png",
    ],
    decors: [],
    supports: {
      digital: "/Disney/Add-Ons/digital.png",
      posterSimple: "/Disney/Add-Ons/poster.png",
      canvas: "/Disney/Add-Ons/portrait_sur_toile.png",
      framed: "/Disney/Add-Ons/portrait_encadré.png",
    },
  },
  ghibli: {
    // Premier visuel : montage photo d'origine + dessin, deja en tete.
    avantApres: true,
    galerie: [
      "/Ghibli/Photo_produits/il_794xN.7001686030_jbst.png",
      "/Ghibli/Photo_produits/il_794xN.7001686038_phv9.png",
      "/Ghibli/Photo_produits/il_794xN.7001719866_sh1o.png",
      "/Ghibli/Photo_produits/il_794xN.7049662203_8jy8.png",
      "/Ghibli/Photo_produits/il_794xN.7339346102_tqwv.png",
      "/Ghibli/Photo_produits/il_794xN.7339346104_18dc.png",
      "/Ghibli/Photo_produits/il_794xN.7339346124_iahy.png",
      "/Ghibli/Photo_produits/il_794xN.7387284335_oesn.png",
    ],
    decors: [],
    supports: {
      digital: "/Ghibli/Add-Ons/digital.png",
      posterSimple: "/Ghibli/Add-Ons/poster.png",
      canvas: "/Ghibli/Add-Ons/portrait_sur_toile.png",
      framed: "/Ghibli/Add-Ons/portrait_encadré.png",
    },
  },
  onepiece: {
    /* Le seul affiche « Wanted » du site avec la photo d'origine en medaillon
       est la vignette du support encadre ; les huit visuels de galerie n'en
       ont aucune. */
    avantApres: true,
    galerie: [
      "/onepiece/portrait_encadré.png",
      "/onepiece/wanted_produit/il_1140xN.7027231626_qn94.png",
      "/onepiece/wanted_produit/il_1140xN.7075208403_h6ii.png",
      "/onepiece/wanted_produit/il_1140xN.7075208427_9pky.png",
      "/onepiece/wanted_produit/il_1140xN.7075210791_t70l.png",
      "/onepiece/wanted_produit/il_1140xN.7263590518_s1vk.png",
      "/onepiece/wanted_produit/il_1140xN.7263593458_c94y.png",
      "/onepiece/wanted_produit/il_1140xN.7311536425_c0lx.png",
      "/onepiece/wanted_produit/8.png",
    ],
    decors: [],
    supports: {
      digital: "/onepiece/digital.png",
      posterSimple: "/onepiece/poster.png",
      canvas: "/onepiece/portrait_sur_toile.png",
      framed: "/onepiece/portrait_encadré.png",
    },
  },
  rickandmorty: {
    // Premier visuel : montage photo d'origine + dessin, deja en tete.
    avantApres: true,
    galerie: [
      "/rickandmorty/Photo_produits/1.png",
      "/rickandmorty/Photo_produits/il_1140xN.6929430540_28j8.png",
      "/rickandmorty/Photo_produits/il_1140xN.6929433252_cgte.png",
      "/rickandmorty/Photo_produits/il_1140xN.6977423979_mjqy.png",
      "/rickandmorty/Photo_produits/il_794xN.4850315677_9cqe.png",
      "/rickandmorty/Photo_produits/il_794xN.4850315693_rqjs.png",
      "/rickandmorty/Photo_produits/il_794xN.4850315697_f5io.png",
      "/rickandmorty/Photo_produits/il_794xN.4866606302_i42x.png",
    ],
    decors: [],
    supports: {
      digital: "/rickandmorty/Add-Ons/digital.png",
      posterSimple: "/rickandmorty/Add-Ons/poster.png",
      canvas: "/rickandmorty/Add-Ons/portrait_sur_toile.png",
      framed: "/rickandmorty/Add-Ons/portrait_encadré.png",
    },
  },
};

/**
 * Liste triee des images d'un dossier de public/, ou [] s'il n'existe pas.
 *
 * Chaque chemin porte le jeton `?v=` de `versionVisuels.ts`. Sans lui,
 * remplacer un visuel en gardant son nom ne change rien a l'ecran : l'optimiseur
 * d'images de Next garde sa version derivee en cache pendant un an. Incrementer
 * le jeton apres un remplacement suffit a tout regenerer.
 */
function fichiersDe(dossierRelatif: string): string[] {
  const dossier = path.join(RACINE_PUBLIQUE, dossierRelatif);
  let entrees: string[];
  try {
    entrees = fs.readdirSync(dossier);
  } catch {
    return [];
  }
  return entrees
    .filter((f) => EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }))
    .map((f) => `/${dossierRelatif}/${f}`.replace(/\/+/g, "/") + `?v=${VERSION_VISUELS}`);
}

/**
 * Libelle d'un decor depose.
 *
 * `decor-2.jpg` -> numerote, traduit a l'affichage (« Décor 2 »). C'est la
 * convention posee par le script d'import, et celle de la capture d'origine
 * ou les decors n'ont pas de nom.
 *
 * Tout autre nom de fichier est repris tel quel, rendu lisible : deposer
 * `plage.jpg` affiche « Plage ». C'est la porte de sortie pour nommer un
 * decor sans toucher au code.
 *
 * Prefixe d'ordre optionnel — `1-plage.jpg`, `2-montagne.jpg` — pour les cas
 * ou l'ordre voulu (celui de la fiche d'origine) ne correspond pas au tri
 * alphabetique des noms. Le prefixe fixe le tri sans apparaitre dans le
 * libelle affiche.
 */
function decorDepuisFichier(chemin: string, rang: number): Decor {
  const base = path.basename(chemin, path.extname(chemin));

  const numerote = /^decor[-_]?(\d+)$/i.exec(base);
  if (numerote) {
    return { src: chemin, ns: "tj", cle: "decorNumero", numero: Number(numerote[1]) };
  }

  const sansPrefixeOrdre = base.replace(/^\d+[-_]+/, "");
  const mots = sansPrefixeOrdre.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return { src: chemin, cle: mots.charAt(0).toUpperCase() + mots.slice(1), numero: rang };
}

/**
 * Les galeries importees ne suivent pas toutes le meme gabarit. Verifie a
 * l'oeil, fichier par fichier, le 2 octobre 2026.
 *
 * Gabarit complet (`AVANT_APRES_EN_TETE`) : 01 montage photo d'origine + dessin
 * encadre, 02 tirage papier en situation, 03 trois cadres en situation, puis
 * des portraits clients. C'est le seul gabarit auquel `LEGENDES_PAR_RANG`
 * s'applique.
 *
 * Gabarit court (`AVANT_APRES_EN_DEUXIEME`) : 01 portrait encadre, 02 montage
 * « Photo -> Portrait » (ou « Avant / Apres »), puis d'autres portraits
 * encadres. Il n'y a ni tirage papier ni mise en situation.
 *
 * Tout le reste (Aquaman, Black Panther, Superman, Stranger Things) : rien que
 * des portraits finis, aucune photo d'origine.
 *
 * Avant cette distinction, le rang seul decidait : le premier visuel de CHAQUE
 * galerie importee etait annonce « Transforme-toi en … » alors qu'il ne
 * montrait souvent qu'un cadre, et un vrai avant/apres en deuxieme position
 * etait annonce « Imprime en France, sur papier A3 ».
 */
const AVANT_APRES_EN_TETE = new Set([
  "carte-pokemon-personnalisee",
  "affiche-manga-style",
  "portrait-attaque-des-titans-personnalise",
  "portrait-bleach-personnalise",
  "portrait-demon-slayer-personnalise",
  "portrait-hunter-x-hunter-personnalise",
  "portrait-jujutsu-kaisen-personnalise",
  "portrait-naruto-personnalise",
  "portrait-lego-personnalise",
  "portrait-playmobil-personnalise",
  "portrait-south-park-personnalise",
  "portrait-spiderman-personnalise",
  "portrait-tim-burton-personnalise",
  "portrait-tintin-personnalise",
]);

const AVANT_APRES_EN_DEUXIEME = new Set([
  "affiche-deadpool-personnalisee",
  "affiche-joker-personnalisee",
  "affiche-wonderwoman-personnalisee",
  "portrait-adventure-time-personnalise",
  "portrait-batman-personnalise",
  "portrait-death-note-personnalise",
  "portrait-family-guy-personnalise",
  "portrait-futurama-personnalise",
  "portrait-harry-potter-personnalise",
  "portrait-indestructibles-personnalise",
  "portrait-snoopy-personnalise",
  "portrait-star-wars-personnalise",
]);

function legendesDeposees(slug: string, nombre: number): (LegendeVisuel | null)[] {
  return Array.from({ length: nombre }, (_, i) => {
    if (AVANT_APRES_EN_TETE.has(slug)) return LEGENDES_PAR_RANG[i] ?? null;
    if (AVANT_APRES_EN_DEUXIEME.has(slug) && i === 1) return "transformation";
    return null;
  });
}

export function visuelsProduit(slug: string): VisuelsProduit {
  const livres = VISUELS_LIVRES[slug];

  const galerieDeposee = fichiersDe(`catalogue/${slug}/galerie`);
  const decorsDeposes = fichiersDe(`catalogue/${slug}/decors`);

  const deposee = galerieDeposee.length > 0;
  const galerie = deposee ? galerieDeposee : livres?.galerie ?? [];

  // Seuls les visuels deposes viennent des montages a titre incruste : les
  // photos produit de Cartoonova n'ont jamais eu de texte a detourer. Leur
  // montage avant/apres, quand il existe, prend le titre « transformation ».
  // Un visuel sans titre est compte parmi les photos de clients (FicheProduit).
  const legendes = deposee
    ? legendesDeposees(slug, galerie.length)
    : galerie.map((_, i) => (i === 0 && livres?.avantApres ? ("transformation" as const) : null));

  const decors: Decor[] =
    decorsDeposes.length > 0
      ? decorsDeposes.map((src, i) => decorDepuisFichier(src, i + 1))
      : livres?.decors ?? [];

  const opaques = deposee ? fichiersDe(`catalogue/${slug}/galerie/opaque`) : [];
  const partage = galerie.map(
    (src) => opaques.find((o) => nomSansExtension(o) === nomSansExtension(src)) ?? src
  );

  return { galerie, partage, legendes, decors, supports: livres?.supports ?? supportsDeposes(slug, galerieDeposee) };
}

/**
 * Vignettes des supports pour une fiche importee.
 *
 * Les visuels generiques (`/poster.png`, `/framed.jpg`) montrent un dessin
 * Simpson : sur la fiche Naruto, le choix « poster » ou « encadre »
 * illustrait donc un autre univers. Le gabarit complet contient deja le bon
 * visuel — 02 tirage papier en situation, 03 cadres en situation — et on le
 * reprend quand le fichier est la. Le fichier numerique et la toile n'ont pas
 * d'equivalent dans ces galeries : ils gardent le visuel generique.
 *
 * Reserve au gabarit complet : dans le gabarit court, 02 est le montage
 * avant/apres et non un tirage.
 */
function supportsDeposes(slug: string, galerie: string[]): Record<PrintKey, string> {
  if (!AVANT_APRES_EN_TETE.has(slug)) return SUPPORTS_DEFAUT;
  const rang = (nom: string) => galerie.find((src) => nomSansExtension(src) === nom);
  return {
    ...SUPPORTS_DEFAUT,
    posterSimple: rang("02") ?? SUPPORTS_DEFAUT.posterSimple,
    framed: rang("03") ?? SUPPORTS_DEFAUT.framed,
  };
}

/**
 * Montages avant/apres reels, un par univers, pour la page portfolio.
 *
 * Derive des legendes : un univers n'y figure que si un visuel de sa galerie
 * est titre « transformation », c'est-a-dire un montage qui existe et montre
 * la photo d'origine a cote du dessin. Aucun n'est fabrique. Ordre : celui du
 * catalogue en ligne (produit phare en tete).
 */
export function galerieAvantApres(): { slug: string; image: string }[] {
  return CATALOGUE_EN_LIGNE.flatMap(({ slug }) => {
    const { galerie, legendes } = visuelsProduit(slug);
    const i = legendes.indexOf("transformation");
    return i >= 0 ? [{ slug, image: galerie[i] }] : [];
  });
}

/** `/catalogue/x/galerie/01.webp?v=3` -> `01` */
function nomSansExtension(chemin: string): string {
  const fichier = chemin.split("?")[0].split("/").pop() ?? "";
  return fichier.replace(/\.[^.]+$/, "");
}

/** Visuel de vignette pour les grilles (accueil, catalogue, similaires). */
export function vignetteProduit(slug: string): string | null {
  return visuelsProduit(slug).galerie[0] ?? null;
}
