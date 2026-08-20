import fs from "node:fs";
import path from "node:path";
import type { PrintKey } from "./pricing";
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
 * une image par langue. Le rang du fichier donne le role, le gabarit d'origine
 * etant constant : 1 transformation, 2 impression, 3 encadrement, puis les
 * portraits clients, qui n'ont pas de titre.
 */
export type LegendeVisuel = "transformation" | "impression" | "cadre";

const LEGENDES_PAR_RANG: (LegendeVisuel | null)[] = ["transformation", "impression", "cadre"];

export interface VisuelsProduit {
  galerie: string[];
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

type VisuelsLivres = Omit<VisuelsProduit, "legendes">;

const VISUELS_LIVRES: Record<string, VisuelsLivres> = {
  simpson: {
    galerie: [
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
    galerie: [
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

export function visuelsProduit(slug: string): VisuelsProduit {
  const livres = VISUELS_LIVRES[slug];

  const galerieDeposee = fichiersDe(`catalogue/${slug}/galerie`);
  const decorsDeposes = fichiersDe(`catalogue/${slug}/decors`);

  const deposee = galerieDeposee.length > 0;
  const galerie = deposee ? galerieDeposee : livres?.galerie ?? [];

  // Seuls les visuels deposes viennent des montages a titre incruste : les
  // photos produit de Cartoonova n'ont jamais eu de texte a detourer.
  const legendes = galerie.map((_, i) => (deposee ? LEGENDES_PAR_RANG[i] ?? null : null));

  const decors: Decor[] =
    decorsDeposes.length > 0
      ? decorsDeposes.map((src, i) => decorDepuisFichier(src, i + 1))
      : livres?.decors ?? [];

  return { galerie, legendes, decors, supports: livres?.supports ?? SUPPORTS_DEFAUT };
}

/** Visuel de vignette pour les grilles (accueil, catalogue, similaires). */
export function vignetteProduit(slug: string): string | null {
  return visuelsProduit(slug).galerie[0] ?? null;
}
