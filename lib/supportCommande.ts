import type { Currency } from "./currency";

/**
 * Cette commande part-elle a l'impression, ou par e-mail ?
 *
 * ── Pourquoi la question se pose ─────────────────────────────────────────
 *
 * Le tableau de bord propose les memes deux boutons pour toutes les commandes :
 * « envoyer l'illustration » et « envoyer pour confirmation avant impression ».
 * Sur un fichier numerique, le premier est le bon. Sur une toile, c'est une
 * erreur qui coute une impression : le client recoit « votre illustration est
 * prete, telechargez-la » alors qu'il attend un objet, et rien ne lui a demande
 * s'il voulait une retouche avant que la toile ne parte chez l'imprimeur.
 *
 * ── Pourquoi ce n'est pas une simple comparaison de texte ────────────────
 *
 * `printOption` enregistre le LIBELLE TRADUIT du support : « Digital » en
 * francais, « Digitale » en italien, « Cyfrowo » en polonais. Comparer au mot
 * « Digital » marche pour la moitie des marches et echoue silencieusement pour
 * l'autre — exactement le defaut deja rencontre a la caisse, ou un client
 * italien devait remplir treize champs d'adresse pour recevoir un fichier.
 *
 * ── Comment on tranche ───────────────────────────────────────────────────
 *
 * `printKey` d'abord : une cle stable, insensible a la langue. Elle n'etait pas
 * transmise a la creation de commande ; elle l'est desormais, donc toute
 * commande passee a partir d'aujourd'hui se lit sans ambiguite.
 *
 * Le libelle ensuite, pour les commandes anterieures, compare a l'ensemble des
 * dix traductions. Ce repli est date : il ne sert qu'aux commandes d'avant, et
 * pourra disparaitre quand elles seront toutes traitees.
 *
 * En cas de doute — libelle vide, inconnu, ou traduction ajoutee depuis —, on
 * repond « physique ». Se tromper en demandant une confirmation inutile coute
 * un e-mail ; se tromper dans l'autre sens coute une toile.
 */

/** Les dix traductions de « numerique », en minuscules. */
const LIBELLES_NUMERIQUES = new Set([
  "digital",   // fr, en, es, de, pt
  "digitale",  // it
  "digitaal",  // nl
  "cyfrowo",   // pl
  "digitalt",  // sv, da
]);

export interface OptionsSupport {
  printKey?: string | null;
  printOption?: string | null;
}

/** Vrai si la commande se livre par e-mail, sans rien imprimer. */
export function estNumerique(options: OptionsSupport | null | undefined): boolean {
  if (!options) return false;

  // La cle fait foi quand elle existe.
  if (typeof options.printKey === "string" && options.printKey) {
    return options.printKey === "digital";
  }

  const libelle = (options.printOption ?? "").trim().toLowerCase();
  if (!libelle) return false;
  return LIBELLES_NUMERIQUES.has(libelle);
}

/** L'inverse, nomme pour se lire dans le sens ou la question se pose. */
export function estPhysique(options: OptionsSupport | null | undefined): boolean {
  return !estNumerique(options);
}

/* ─── Quel support, exactement ────────────────────────────────────────

   `estPhysique` repond par oui ou non. Le tableau de bord, lui, a besoin de
   savoir QUOI commander chez l'imprimeur — et il ne pouvait le lire nulle
   part : la fiche affichait `printOption`, c'est-a-dire le libelle DANS LA
   LANGUE DU CLIENT. Une commande polonaise annoncait « Portret na płótnie »,
   une suedoise « Porträtt på canvas ». Deux fois une toile, et rien ne le
   disait.

   La taille manquait tout autant. Elle n'est ecrite nulle part dans la
   commande, pour une raison simple : le catalogue n'en propose qu'une. Elle
   ne se choisit pas, elle se deduit du support — et c'est pourtant la
   premiere chose a saisir chez l'imprimeur. */

/** Les trois supports imprimes sont tous en 30x40. Une seule taille vendue.

    C'est desormais le seul endroit ou la dimension est ecrite. Elle l'etait
    aussi, en toutes lettres, dans les trente sous-titres des dix fichiers
    `messages/*.json` — qui ne portent plus que `{taille}`. Changer de taille au
    catalogue ne demande donc qu'une seule edition. */
/* Espace INSECABLE avant l'unite : a quatre colonnes, la vignette coupait
   « 30×40 cm » entre le nombre et l'unite, ce qui donnait « 30×40 » sur une
   ligne et « cm · » sur la suivante. */
export const TAILLE_IMPRESSION = "30×40 cm";

/**
 * La meme toile, dite en pouces.
 *
 * Ce n'est PAS un autre produit. Gelato porte les deux ecritures dans un seul
 * attribut — `300x400-mm-12x16-inch` — et facture le meme prix, le meme port,
 * depuis la meme imprimerie : verifie par devis, au centime. Seul le libelle
 * change.
 *
 * L'ecart reel est de cinq millimetres (12x16" = 30,5 x 40,6 cm). C'est leur
 * convention d'arrondi, et la reprendre vaut mieux qu'annoncer a un Americain
 * une taille qu'aucun de ses cadres ne porte.
 */
export const TAILLE_IMPRESSION_POUCES = "12×16 in";

/**
 * La taille a afficher, selon la devise du visiteur.
 *
 * ── Pourquoi la devise et pas la langue ──────────────────────────────────
 *
 * Parce que `en` sert a la fois le Royaume-Uni et les Etats-Unis, et que ces
 * deux marches ne mesurent pas pareil : un Britannique achete un cadre en
 * centimetres, un Americain en pouces. Se fier a la langue affichait donc
 * « 30×40 cm » a New York — ce que personne ne sait traduire en rayon.
 *
 * La devise, elle, decoule du pays detecte. C'est le signal le plus proche du
 * marche dont dispose la fiche produit.
 *
 * L'Australie reste au metrique malgre l'anglais : elle mesure en centimetres.
 */
export function tailleImpression(devise: Currency): string {
  return devise === "USD" || devise === "CAD" ? TAILLE_IMPRESSION_POUCES : TAILLE_IMPRESSION;
}

export type CleSupport = "digital" | "posterSimple" | "canvas" | "framed";

/** Ce qu'il y a a savoir d'un support, du point de vue de l'atelier. */
export interface SupportDecrit {
  /** La cle du catalogue, ou null quand le libelle n'est pas reconnu. */
  cle: CleSupport | null;
  /** En francais, quelle que soit la langue du client. */
  libelle: string;
  /** Null pour le numerique : un fichier n'a pas de dimensions. */
  taille: string | null;
  /** La precision qui compte a la commande — finition, cadre, papier. */
  detail: string | null;
}

const SUPPORTS: Record<CleSupport, Omit<SupportDecrit, "cle">> = {
  digital: { libelle: "Fichier numérique", taille: null, detail: "haute définition, par e-mail" },
  posterSimple: { libelle: "Poster", taille: TAILLE_IMPRESSION, detail: "papier mat, sans cadre" },
  canvas: { libelle: "Toile", taille: TAILLE_IMPRESSION, detail: "prête à accrocher" },
  framed: { libelle: "Poster encadré", taille: TAILLE_IMPRESSION, detail: "cadre chêne" },
};

/* Les libelles imprimes, dans les dix langues, en minuscules.

   Meme repli date que `LIBELLES_NUMERIQUES` au-dessus, et pour la meme raison :
   les commandes passees avant que `printKey` ne soit transmis n'ont que le
   libelle traduit. Il disparaitra avec elles. */
const LIBELLES_IMPRIMES = new Map<string, CleSupport>([
  // Toile
  ["portrait sur toile", "canvas"],
  ["canvas portrait", "canvas"],
  ["retrato en lienzo", "canvas"],
  ["leinwand-portrait", "canvas"],
  ["ritratto su tela", "canvas"],
  ["canvasportret", "canvas"],
  ["portret na płótnie", "canvas"],
  ["porträtt på canvas", "canvas"],
  ["portræt på lærred", "canvas"],
  ["retrato em tela", "canvas"],
  // Poster encadre
  ["portrait encadré", "framed"],
  ["framed poster", "framed"],
  ["póster enmarcado", "framed"],
  ["gerahmtes poster", "framed"],
  ["ritratto incorniciato", "framed"],
  ["ingelijste poster", "framed"],
  ["plakat w ramie", "framed"],
  ["inramad affisch", "framed"],
  ["indrammet plakat", "framed"],
  ["poster emoldurado", "framed"],
  // Poster simple
  ["poster", "posterSimple"],
  ["poster simple", "posterSimple"],
  ["póster simple", "posterSimple"],
  ["poster semplice", "posterSimple"],
  ["plakat", "posterSimple"],
  ["affisch", "posterSimple"],
]);

/**
 * Le support d'une commande, en francais et avec sa taille.
 *
 * `printKey` fait foi quand elle existe. Sinon on retombe sur le libelle
 * traduit. Sinon encore — libelle vide, ou traduction ajoutee depuis — on rend
 * ce que le client a vu, sans l'inventer : mieux vaut « Poster Semplice »
 * affiche tel quel qu'une toile annoncee par erreur.
 */
export function decrireSupport(options: OptionsSupport | null | undefined): SupportDecrit {
  const cleBrute = typeof options?.printKey === "string" ? options.printKey : "";
  if (cleBrute && cleBrute in SUPPORTS) {
    const cle = cleBrute as CleSupport;
    return { cle, ...SUPPORTS[cle] };
  }

  const libelle = (options?.printOption ?? "").trim();
  const normalise = libelle.toLowerCase();

  if (LIBELLES_NUMERIQUES.has(normalise)) {
    return { cle: "digital", ...SUPPORTS.digital };
  }

  const trouve = LIBELLES_IMPRIMES.get(normalise);
  if (trouve) return { cle: trouve, ...SUPPORTS[trouve] };

  return { cle: null, libelle: libelle || "Support inconnu", taille: null, detail: null };
}

/** Une ligne prete a lire : « Toile — 30×40 cm ». */
export function libelleSupportCourt(options: OptionsSupport | null | undefined): string {
  const s = decrireSupport(options);
  return s.taille ? `${s.libelle} — ${s.taille}` : s.libelle;
}
