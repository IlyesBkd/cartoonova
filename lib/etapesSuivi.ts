import { estPhysique } from "./supportCommande";
import type { DbOrder } from "./db";
import type { EtapeSuivi } from "./email-i18n";

/* Etapes de la page de suivi, et celle qu'une commande a atteinte.

   Une commande imprimee n'a pas le meme parcours qu'un fichier numerique :
   elle attend l'accord du client sur l'apercu, puis un colis. Le numerique,
   lui, s'arrete a l'envoi du fichier. La page de suivi lit la base a chaque
   requete : tout ce qui est deduit ici se met donc a jour sans rien d'autre.

   Pur et sans acces base, pour pouvoir etre teste sur des commandes simulees. */

export const ETAPES_NUMERIQUE: EtapeSuivi[] = ["recue", "dessin", "apercu", "envoyee"];
export const ETAPES_IMPRIME: EtapeSuivi[] = ["recue", "dessin", "apercu", "acceptee", "expediee"];

type CommandeSuivie = Pick<
  DbOrder,
  | "options"
  | "final_image_sent_at"
  | "poster_confirmation_sent_at"
  | "poster_confirmation_status"
  | "expedie_le"
>;

export function etapesDeLaCommande(order: Pick<DbOrder, "options">): EtapeSuivi[] {
  return estPhysique(order.options) ? ETAPES_IMPRIME : ETAPES_NUMERIQUE;
}

/**
 * Etape atteinte, deduite de ce que la commande porte deja.
 *
 * « Accepte » = le client a confirme l'apercu (`poster_confirmation_status`).
 * Cette confirmation n'est pas definitive : un nouvel apercu la remet a zero, et
 * le client peut demander des retouches. L'etape recule alors toute seule, ce qui
 * est la verite — le portrait n'est plus valide.
 */
export function etapeAtteinte(order: CommandeSuivie): EtapeSuivi {
  if (estPhysique(order.options)) {
    if (order.expedie_le) return "expediee";
    if (order.poster_confirmation_status === "confirmed") return "acceptee";
    if (order.poster_confirmation_sent_at) return "apercu";
    return "dessin";
  }
  if (order.final_image_sent_at) return "envoyee";
  if (order.poster_confirmation_sent_at) return "apercu";
  return "dessin";
}
