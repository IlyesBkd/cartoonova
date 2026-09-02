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
