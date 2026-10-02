import { estPhysique } from "./supportCommande";
import { attendDesPhotos } from "./orderPhotos";
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

/* Ce que le client doit faire maintenant, s'il a quelque chose a faire.

   La liste d'etapes dit ou en est la commande, pas ce qui la bloque. Or deux
   situations ne bougent que si le client agit : des photos jamais deposees, et
   un apercu en attente de sa reponse. Sans bouton sur la page, il devait
   retrouver le bon e-mail — et la commande restait figee en silence.

   La retouche demandee n'attend rien de lui : on la montre quand meme, pour
   qu'il voie que sa demande est arrivee et quand revient le nouvel apercu,
   plutot que de reecrire au support pour le verifier. */

export type ProchaineAction =
  | { type: "photos" }
  | { type: "apercu" }
  | { type: "retouche"; le: string | null; note: string | null };

type CommandeAAgir = Pick<
  DbOrder,
  | "photo_urls"
  | "final_image_sent_at"
  | "poster_confirmation_token"
  | "poster_confirmation_sent_at"
  | "poster_confirmation_status"
  | "poster_confirmation_responded_at"
  | "poster_confirmation_note"
>;

export function prochaineAction(order: CommandeAAgir): ProchaineAction | null {
  // Les photos d'abord : sans elles rien ne commence, tout le reste attend.
  if (attendDesPhotos(order.photo_urls)) return { type: "photos" };

  // Apercu envoye, pas encore de reponse. Le jeton est exige parce que c'est lui
  // qui fait le lien ; le fichier final deja parti veut dire que la question ne
  // se pose plus, meme si le client n'a jamais clique.
  if (
    order.poster_confirmation_token &&
    order.poster_confirmation_sent_at &&
    order.poster_confirmation_status === null &&
    !order.final_image_sent_at
  ) {
    return { type: "apercu" };
  }

  // Un nouvel apercu remet le statut a zero : tant qu'il vaut
  // `changes_requested`, la retouche est donc toujours en cours chez nous.
  if (order.poster_confirmation_status === "changes_requested") {
    return {
      type: "retouche",
      le: order.poster_confirmation_responded_at,
      note: order.poster_confirmation_note,
    };
  }

  return null;
}
