/**
 * Prix de lancement.
 *
 * Le portrait numerique est vendu 5 EUR le personnage. Le site l'affichait
 * barre a 8 EUR, « -40 % » : un prix de reference qui n'a jamais ete pratique,
 * ce que le droit de la consommation interdit (le prix de reference d'une
 * reduction est le plus bas des 30 jours precedents).
 *
 * Decision du 1er octobre 2026 : le dire tel quel. 5 EUR est un prix de
 * lancement, jusqu'au 15 novembre ; ensuite le portrait passe a 19 EUR, +7 EUR
 * par personnage, la toile a +55 EUR (le cout Gelato d'une toile livree en
 * France est de 41,18 EUR, port compris).
 *
 * La hausse elle-meme se fait dans l'admin (table `prices`), pas ici : ce
 * fichier ne porte que l'annonce, et le rappel affiche dans l'admin une fois
 * la date passee.
 */

/** Dernier instant du prix de lancement : 15 novembre 2026, 23:59, heure de Paris. */
export const FIN_LANCEMENT = new Date("2026-11-15T23:59:59+01:00");

/** Grille prevue apres le lancement, en euros. */
export const PRIX_APRES_LANCEMENT_EUR = {
  base: 19,
  extraPerson: 7,
  canvas: 55,
} as const;

export function lancementEnCours(maintenant: Date = new Date()): boolean {
  return maintenant <= FIN_LANCEMENT;
}
