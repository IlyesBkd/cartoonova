import type { OrderOptions } from "./db";

/**
 * Quand part l'e-mail d'illustration finale.
 *
 * Un portrait livre deux heures apres la commande n'a pas l'air rapide : il a
 * l'air automatique. Le client a paye pour « nos artistes viennent de terminer
 * votre portrait » — c'est la phrase exacte de l'e-mail — et s'il le recoit
 * avant d'avoir referme l'onglet, il en tire la seule conclusion possible. Le
 * delai ne sert pas a gagner du temps sur le travail : il laisse au travail le
 * temps d'avoir eu lieu.
 *
 * Deux contraintes encadrent ce delai, et elles tirent en sens contraire.
 *
 *   1. Assez tard pour que la fabrication soit credible.
 *   2. Assez tot pour tenir « Livré en 2 jours », affiche sur les fiches, les
 *      pastilles produit et la page tarifs (`messages/*.json`). Cette promesse
 *      court depuis LA COMMANDE, pas depuis le depot de l'image : si l'image
 *      est deposee le lendemain, il ne reste pas deux jours a attendre, il en
 *      reste un. C'est ce que le calcul ci-dessous prend comme reference.
 *
 * Quand les deux ne peuvent plus tenir ensemble — image deposee trop tard —
 * c'est la promesse qui gagne et l'attente qui saute. Un client qui recoit son
 * portrait plus vite que prevu ne se plaint pas ; un client livre en retard,
 * si.
 *
 * L'envoi est fait par le cron `lifecycle-emails`, qui passe une fois par jour
 * a 9 h UTC (cf. vercel.json). Viser 14 h 32 n'aurait donc aucun sens : rien ne
 * tourne a 14 h 32. Toute date visee est un de ces passages, ce qui a
 * l'avantage secondaire de faire arriver les portraits en milieu de matinee
 * plutot qu'au hasard de l'heure de depot.
 */

/** Heure UTC du passage quotidien de `lifecycle-emails`. */
export const HEURE_CRON_UTC = 9;

const HEURE = 3_600_000;

/**
 * L'attente minimale apres le depot de l'image.
 *
 * 14 h ecarte le passage du lendemain matin pour une image deposee en fin
 * d'apres-midi, sans repousser d'un jour entier ce qui est depose le matin.
 */
const ATTENTE_MINIMALE_HEURES = 14;

/**
 * La promesse affichee, en heures depuis la commande.
 *
 * « Livré en 2 jours » apparait dans dix fichiers de traduction et sur toutes
 * les fiches produit. Rien ici ne doit la faire mentir.
 */
const PROMESSE_HEURES = 48;

/** Le passage du cron strictement apres `apres`. */
function prochainPassage(apres: Date): Date {
  const d = new Date(apres);
  d.setUTCHours(HEURE_CRON_UTC, 0, 0, 0);
  if (d <= apres) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** Le dernier passage du cron a `avant` ou avant. */
function dernierPassage(avant: Date): Date {
  const d = new Date(avant);
  d.setUTCHours(HEURE_CRON_UTC, 0, 0, 0);
  if (d > avant) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

/**
 * Date a laquelle l'e-mail d'illustration finale doit partir.
 *
 * `commandeLe` porte la promesse, `depose` l'attente minimale, `options` la
 * date du cadeau. Sans `commandeLe` — un appel qui ne l'aurait pas sous la
 * main — on retombe sur l'heure du depot, ce qui ne peut qu'avancer l'envoi.
 */
export function dateEnvoiProgramme(
  depose: Date = new Date(),
  options?: OrderOptions | null,
  commandeLe?: Date | string | null
): Date {
  const commande = commandeLe ? new Date(commandeLe) : depose;
  const origine = Number.isNaN(commande.getTime()) ? depose : commande;

  const limite = new Date(origine.getTime() + PROMESSE_HEURES * HEURE);
  const attendu = new Date(depose.getTime() + ATTENTE_MINIMALE_HEURES * HEURE);

  /* Plus de place pour l'attente : on part du depot, donc au prochain passage. */
  const premier = prochainPassage(attendu < limite ? attendu : depose);
  const dernier = dernierPassage(limite);

  /* Tirage parmi les passages encore disponibles.
     Sans lui, le delai serait une fonction exacte de l'heure de depot : un
     client qui recommande — et la relance de rachat part a 90 jours, donc cela
     arrive — recevrait deux fois son portrait au meme intervalle a la minute
     pres. Un delai regulier se remarque autant qu'une absence de delai. */
  const passagesDisponibles = Math.floor((dernier.getTime() - premier.getTime()) / (24 * HEURE));
  const quand = new Date(premier);
  if (passagesDisponibles > 0) {
    quand.setUTCDate(quand.getUTCDate() + Math.floor(Math.random() * (passagesDisponibles + 1)));
  }

  return reporterApresDateCadeau(quand, options);
}

/**
 * Repousse une date d'envoi au jour du cadeau quand il est plus tard.
 *
 * Une commande cadeau porte une date « pas avant le », saisie au paiement.
 * Elle etait jusqu'ici collectee, affichee sur la page de suivi, recopiee dans
 * l'alerte Discord — et respectee nulle part, parce que l'envoi etait manuel et
 * que personne ne relisait la fiche avant de cliquer. Programmer l'envoi est ce
 * qui permet enfin de la tenir, et elle prime sur la promesse de deux jours :
 * livrer un cadeau en avance, c'est le gacher.
 *
 * Le format est verifie a la creation de la commande (`^\d{4}-\d{2}-\d{2}$`),
 * mais une valeur arrivee par un autre chemin ne doit pas produire une date
 * invalide qui bloquerait la commande pour toujours : en cas de doute, on garde
 * la date calculee.
 */
export function reporterApresDateCadeau(
  quand: Date,
  options?: OrderOptions | null
): Date {
  const pasAvant = options?.gift?.deliverAfter;
  if (!pasAvant) return quand;

  const heure = String(HEURE_CRON_UTC).padStart(2, "0");
  const jourCadeau = new Date(`${pasAvant}T${heure}:00:00.000Z`);
  if (Number.isNaN(jourCadeau.getTime())) return quand;

  return jourCadeau > quand ? jourCadeau : quand;
}
