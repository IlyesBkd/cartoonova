import { estPhysique } from "./supportCommande";
import { attendDesPhotos } from "./orderPhotos";
import type { DbOrder } from "./db";

/* Statut de suivi d'une commande, tel que le tableau de bord l'affiche.

   Il se changeait a la main avec quatre boutons, et n'etait donc jamais a
   jour : une commande livree depuis deux semaines restait « PAID ». Or tout
   ce qu'il resume est deja en base — l'apercu envoye, la reponse du client,
   le fichier parti, le colis remis. Le statut se deduit donc de ces faits, au
   meme titre que l'etape de la page de suivi (lib/etapesSuivi.ts).

   L'admin peut encore le forcer (`statut_force`), pour ce que la base ne voit
   pas : une commande reglee par telephone, un remboursement.

   Pur et sans acces base, pour etre appele cote navigateur. */

export const STATUTS_COMMANDE = {
  non_payee: { label: "Non payée", color: "bg-gray-100 text-gray-600 border-gray-300" },
  a_traiter: { label: "À traiter", color: "bg-red-100 text-red-800 border-red-300" },
  photos: { label: "Photos manquantes", color: "bg-orange-100 text-orange-800 border-orange-300" },
  retouche: { label: "Retouche à faire", color: "bg-red-100 text-red-800 border-red-300" },
  attente_client: { label: "Attente du client", color: "bg-sky-100 text-sky-800 border-sky-300" },
  new: { label: "Nouvelle", color: "bg-blue-100 text-blue-800 border-blue-300" },
  a_envoyer: { label: "À envoyer", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  envoi_programme: { label: "Envoi programmé", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  a_imprimer: { label: "À imprimer", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  completed: { label: "Terminée", color: "bg-green-100 text-green-800 border-green-300" },
  shipped: { label: "Expédiée", color: "bg-purple-100 text-purple-800 border-purple-300" },
} as const;

export type StatutCommande = keyof typeof STATUTS_COMMANDE;

export function estStatutCommande(valeur: unknown): valeur is StatutCommande {
  return typeof valeur === "string" && Object.prototype.hasOwnProperty.call(STATUTS_COMMANDE, valeur);
}

type CommandeStatut = Pick<
  DbOrder,
  | "status"
  | "paid_at"
  | "options"
  | "photo_urls"
  | "poster_confirmation_sent_at"
  | "poster_confirmation_status"
  | "poster_confirmation_responded_at"
  | "final_image_sent_at"
  | "final_image_scheduled_at"
  | "expedie_le"
> & { statut_force?: string | null };

/* Les anciennes lignes ont `photo_urls` en JSON double-encode : la colonne
   revient alors sous forme de chaine, que `attendDesPhotos` lirait comme
   « aucune photo ». */
function listePhotos(brut: unknown): unknown {
  if (typeof brut !== "string") return brut;
  try {
    return JSON.parse(brut);
  } catch {
    return brut;
  }
}

/**
 * Statut deduit, dans l'ordre ou les situations demandent d'agir.
 *
 * `messageNonLuLe` vient du support, que cette fonction ne lit pas : la date
 * du dernier message client non lu et sans reponse. Un client qui demande une
 * retouche par simple e-mail apres reception (« les visages pourraient
 * ressembler davantage ») ne laisse aucune autre trace en base. Sans cette
 * entree, sa commande resterait « Terminee » pendant qu'il attend.
 */
export function statutCommande(
  order: CommandeStatut,
  { messageNonLuLe = null }: { messageNonLuLe?: string | null } = {}
): StatutCommande {
  if (estStatutCommande(order.statut_force)) return order.statut_force;

  /* `paid_at` fait foi. Les commandes saisies a la main sans paiement Stripe
     n'en ont pas, mais ont quitte PENDING : on les tient pour payees. */
  if (!order.paid_at && order.status === "PENDING") return "non_payee";

  /* Seul un message arrive APRES notre dernier envoi attend quelque chose.
     Renvoyer le portrait corrige repond a la demande, meme si l'e-mail qui la
     portait n'a jamais ete ouvert dans l'onglet Support. */
  if (messageNonLuLe) {
    const recu = Date.parse(messageNonLuLe) || 0;
    const dernierEnvoi = Math.max(
      0,
      ...[order.final_image_sent_at, order.poster_confirmation_sent_at, order.expedie_le].map(
        (d) => (d ? Date.parse(d) || 0 : 0)
      )
    );
    if (recu > dernierEnvoi) return "a_traiter";
  }

  /* Commandes closes a la main avant que le statut ne se calcule : certaines
     ont ete expediees avant que `expedie_le` n'existe, et se retrouveraient
     « A imprimer ». Ces valeurs ne sont plus jamais ecrites, la regle ne
     concerne donc que l'historique. */
  if (order.status === "shipped") return "shipped";
  if (order.status === "completed") return "completed";
  if (attendDesPhotos(listePhotos(order.photo_urls))) return "photos";
  /* La retouche est faite quand quelque chose est reparti depuis la demande.
     Un nouvel apercu remet deja le statut a zero ; le fichier final ou le colis
     envoyes directement, eux, ne touchent pas a ce champ. */
  if (order.poster_confirmation_status === "changes_requested") {
    const demandee = Date.parse(order.poster_confirmation_responded_at ?? "") || 0;
    const repartiDepuis = [order.final_image_sent_at, order.expedie_le].some(
      (d) => d && Date.parse(d) > demandee
    );
    if (!repartiDepuis) return "retouche";
  }

  const valide = order.poster_confirmation_status === "confirmed";

  if (estPhysique(order.options)) {
    if (order.expedie_le) return "shipped";
    if (valide) return "a_imprimer";
    if (order.poster_confirmation_sent_at) return "attente_client";
    return "new";
  }

  // Le fichier parti clot la commande, meme si le client n'a jamais clique.
  if (order.final_image_sent_at) return "completed";
  if (order.final_image_scheduled_at) return "envoi_programme";
  if (valide) return "a_envoyer";
  if (order.poster_confirmation_sent_at) return "attente_client";
  return "new";
}
