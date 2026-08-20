import type { Locale } from "../i18n/config";

/**
 * Calendrier des temps forts commerciaux.
 *
 * Une seule source pour les deux usages qui en dependent :
 *  - la barre promo et le hero, qui changent de discours selon la periode ;
 *  - le rappel de date limite de commande de la fiche produit.
 *
 * Les dates ne sont pas listees annee par annee : elles sont CALCULEES a
 * partir de regles. Une table 2026-2028 aurait demande a etre reecrite en
 * 2029, et surtout elle aurait fige la fete des meres de cinq marches a la
 * main — c'est exactement la ou une table se trompe.
 */

/* ═══ delais annonces ═══════════════════════════════════════════════════
   Delai reel annonce partout sur le site : 2 jours ouvres de dessin (delai du
   digital), puis 3 jours ouvres d'impression et livraison pour le physique. */
export const DRAWING_BUSINESS_DAYS = 2;
export const PRINT_SHIPPING_BUSINESS_DAYS = 3;
export const TOTAL_BUSINESS_DAYS = DRAWING_BUSINESS_DAYS + PRINT_SHIPPING_BUSINESS_DAYS;

/** Retire `days` jours ouvres (samedi/dimanche exclus, jours feries non geres). */
export function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const weekday = result.getDay();
    if (weekday !== 0 && weekday !== 6) remaining--;
  }
  return result;
}

/** Derniere date de commande pour esperer une reception avant `target`. */
export function getOrderByDate(target: Date): Date {
  return subtractBusinessDays(target, TOTAL_BUSINESS_DAYS);
}

/* ═══ calendrier ════════════════════════════════════════════════════════ */

export const CLES_EVENEMENT = [
  "saintValentin",
  "feteDesMeres",
  "feteDesPeres",
  "halloween",
  "blackFriday",
  "noel",
] as const;

export type CleEvenement = (typeof CLES_EVENEMENT)[number];

const DIMANCHE = 0;
const JEUDI = 4;

type Regle =
  /** Date fixe du calendrier. */
  | { type: "fixe"; mois: number; jour: number }
  /** N-ieme <jourSemaine> du mois, eventuellement decale de quelques jours. */
  | { type: "nieme"; mois: number; jourSemaine: number; n: number; decalageJours?: number }
  /** Dernier <jourSemaine> du mois. */
  | { type: "dernier"; mois: number; jourSemaine: number }
  /** Paques + N jours (N negatif = avant). Couvre le Careme et l'Ascension. */
  | { type: "paques"; decalage: number }
  /** Fete des meres francaise : voir `feteDesMeresFr`. */
  | { type: "feteDesMeresFr" };

interface DefEvenement {
  cle: CleEvenement;
  /** Regle par defaut, appliquee a tout marche sans surcharge. */
  regle: Regle;
  parLocale?: Partial<Record<Locale, Regle>>;
  /** Nombre de jours avant l'evenement ou la campagne s'ouvre. */
  joursAvant: number;
  /**
   * true  : cadeau a livrer. La fenetre se ferme a la derniere date de
   *         commande — au-dela, promettre une livraison a temps serait faux.
   * false : moment commercial sans livraison associee (Black Friday). La
   *         fenetre se ferme le jour meme.
   */
  livraison: boolean;
}

/**
 * Les dates de fete des meres et des peres different d'un marche a l'autre.
 * C'est la raison pour laquelle elles etaient absentes du site : les inscrire
 * a une date unique en aurait donne une fausse pour au moins trois pays.
 * Chaque marche porte donc sa propre regle.
 */
const EVENEMENTS: DefEvenement[] = [
  {
    cle: "saintValentin",
    regle: { type: "fixe", mois: 2, jour: 14 },
    joursAvant: 30,
    livraison: true,
  },
  {
    cle: "feteDesMeres",
    // France : dernier dimanche de mai, sauf collision avec la Pentecote.
    regle: { type: "feteDesMeresFr" },
    parLocale: {
      // Royaume-Uni : Mothering Sunday, 4e dimanche du Careme, soit trois
      // semaines avant Paques — en mars, pas en mai.
      en: { type: "paques", decalage: -21 },
      es: { type: "nieme", mois: 5, jourSemaine: DIMANCHE, n: 1 },
      de: { type: "nieme", mois: 5, jourSemaine: DIMANCHE, n: 2 },
      it: { type: "nieme", mois: 5, jourSemaine: DIMANCHE, n: 2 },
    },
    joursAvant: 28,
    livraison: true,
  },
  {
    cle: "feteDesPeres",
    // France et Royaume-Uni : 3e dimanche de juin.
    regle: { type: "nieme", mois: 6, jourSemaine: DIMANCHE, n: 3 },
    parLocale: {
      // Espagne et Italie : la Saint-Joseph, date fixe.
      es: { type: "fixe", mois: 3, jour: 19 },
      it: { type: "fixe", mois: 3, jour: 19 },
      // Allemagne : Vatertag = jeudi de l'Ascension = Paques + 39 jours.
      de: { type: "paques", decalage: 39 },
    },
    joursAvant: 24,
    livraison: true,
  },
  {
    cle: "halloween",
    regle: { type: "fixe", mois: 10, jour: 31 },
    joursAvant: 20,
    livraison: true,
  },
  {
    cle: "blackFriday",
    // Lendemain du 4e jeudi de novembre. « 4e vendredi » serait faux les
    // annees ou le 1er novembre tombe un vendredi : le vendredi qui suit le
    // 4e jeudi est alors le 5e du mois.
    regle: { type: "nieme", mois: 11, jourSemaine: JEUDI, n: 4, decalageJours: 1 },
    joursAvant: 5,
    livraison: false,
  },
  {
    cle: "noel",
    regle: { type: "fixe", mois: 12, jour: 25 },
    joursAvant: 40,
    livraison: true,
  },
];

/** Fin de journee locale : les fenetres se comparent a la journee entiere. */
function jour(annee: number, mois: number, date: number): Date {
  return new Date(annee, mois - 1, date, 23, 59, 59, 999);
}

function ajouterJours(date: Date, jours: number): Date {
  const resultat = new Date(date.getTime());
  resultat.setDate(resultat.getDate() + jours);
  return resultat;
}

/** Dimanche de Paques (gregorien) — algorithme de Meeus/Jones/Butcher. */
export function paques(annee: number): Date {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const total = h + l - 7 * m + 114;
  return jour(annee, Math.floor(total / 31), (total % 31) + 1);
}

/** N-ieme `jourSemaine` du mois (n commence a 1). */
function niemeJourSemaine(annee: number, mois: number, jourSemaine: number, n: number): Date {
  const premier = new Date(annee, mois - 1, 1);
  const decalage = (jourSemaine - premier.getDay() + 7) % 7;
  return jour(annee, mois, 1 + decalage + (n - 1) * 7);
}

/** Dernier `jourSemaine` du mois. */
function dernierJourSemaine(annee: number, mois: number, jourSemaine: number): Date {
  const dernier = new Date(annee, mois, 0); // jour 0 du mois suivant = dernier du mois
  const recul = (dernier.getDay() - jourSemaine + 7) % 7;
  return jour(annee, mois, dernier.getDate() - recul);
}

/**
 * Fete des meres francaise : dernier dimanche de mai, reporte au premier
 * dimanche de juin quand ce dimanche est celui de la Pentecote (Paques + 49).
 * La collision ne se produit pas entre 2026 et 2028, mais elle se produira :
 * la regle est ecrite plutot que constatee, sinon le site se trompera un jour
 * sans que personne ne s'en apercoive.
 */
function feteDesMeresFr(annee: number): Date {
  const dernierDimancheDeMai = dernierJourSemaine(annee, 5, DIMANCHE);
  const pentecote = ajouterJours(paques(annee), 49);
  const memeJour =
    dernierDimancheDeMai.getMonth() === pentecote.getMonth() &&
    dernierDimancheDeMai.getDate() === pentecote.getDate();
  return memeJour ? niemeJourSemaine(annee, 6, DIMANCHE, 1) : dernierDimancheDeMai;
}

function resoudre(regle: Regle, annee: number): Date {
  switch (regle.type) {
    case "fixe":
      return jour(annee, regle.mois, regle.jour);
    case "nieme":
      return ajouterJours(
        niemeJourSemaine(annee, regle.mois, regle.jourSemaine, regle.n),
        regle.decalageJours ?? 0
      );
    case "dernier":
      return dernierJourSemaine(annee, regle.mois, regle.jourSemaine);
    case "paques":
      return ajouterJours(paques(annee), regle.decalage);
    case "feteDesMeresFr":
      return feteDesMeresFr(annee);
  }
}

/** Date d'un evenement pour un marche et une annee donnes. */
export function dateEvenement(cle: CleEvenement, locale: Locale, annee: number): Date {
  const def = EVENEMENTS.find((e) => e.cle === cle);
  if (!def) throw new Error(`Evenement inconnu : ${cle}`);
  return resoudre(def.parLocale?.[locale] ?? def.regle, annee);
}

export interface EvenementActif {
  cle: CleEvenement;
  /** Date de l'evenement lui-meme. */
  date: Date;
  /** Derniere date de commande pour recevoir a temps, ou null si non livrable. */
  commanderAvant: Date | null;
}

/**
 * Evenement a mettre en avant maintenant pour ce marche, ou null hors periode.
 *
 * Quand deux fenetres se chevauchent — Black Friday tombe toujours dans celle
 * de Noel — c'est l'echeance la plus proche qui gagne : c'est celle qui presse.
 *
 * `livraisonSeulement` restreint aux evenements associes a une livraison, pour
 * le rappel de date limite de la fiche produit : « commandez avant le X » n'a
 * aucun sens pour un Black Friday.
 */
export function evenementActif(
  locale: Locale,
  maintenant: Date = new Date(),
  { livraisonSeulement = false }: { livraisonSeulement?: boolean } = {}
): EvenementActif | null {
  let meilleur: EvenementActif | null = null;

  for (const def of EVENEMENTS) {
    if (livraisonSeulement && !def.livraison) continue;

    // Deux annees : fin decembre, la prochaine Saint-Valentin est celle de
    // l'annee suivante.
    for (const annee of [maintenant.getFullYear(), maintenant.getFullYear() + 1]) {
      const date = resoudre(def.parLocale?.[locale] ?? def.regle, annee);
      const commanderAvant = def.livraison ? getOrderByDate(date) : null;
      const fermeture = commanderAvant ?? date;
      const ouverture = ajouterJours(date, -def.joursAvant);

      if (maintenant < ouverture || maintenant > fermeture) continue;
      if (!meilleur || date < meilleur.date) {
        meilleur = { cle: def.cle, date, commanderAvant };
      }
    }
  }

  return meilleur;
}

/**
 * Ce que la barre promo et le hero recoivent : deja serialise et deja
 * formate. La date est mise en forme cote serveur — la formater dans le
 * composant client ferait dependre le rendu des donnees ICU du navigateur,
 * qui ne sont pas toujours celles de Node, et l'hydratation divergerait.
 */
export interface EvenementAffiche {
  cle: CleEvenement;
  /** « 22 mai », deja dans la langue du marche. Vide si non livrable. */
  dateLimite: string;
}

export function evenementAffiche(
  locale: Locale,
  maintenant: Date = new Date()
): EvenementAffiche | null {
  const actif = evenementActif(locale, maintenant);
  if (!actif) return null;
  return {
    cle: actif.cle,
    dateLimite: actif.commanderAvant
      ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(
          actif.commanderAvant
        )
      : "",
  };
}
