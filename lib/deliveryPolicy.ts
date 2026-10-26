import { estPhysique } from "./supportCommande";
import { optionsLivraisonCadeau, validerLivraisonCadeau } from "./livraisonCadeau";

export class DeliveryPolicyError extends Error {
  constructor(message: string, readonly status: 404 | 409 = 409) {
    super(message);
  }
}
type DeliveryOrder = {
  paid_at?: unknown; customer_email?: string | null; final_image_url?: string | null;
  options: unknown; final_image_sent_at?: unknown; poster_confirmation_status?: string | null;
  poster_confirmation_image_url?: string | null; poster_confirmation_email?: string | null;
};
/** No implicit admin override. Recheck against the locked row before effects.
 * Scheduling evaluates the promised date, not today's date. */
export function assertDeliveryEligible(order: DeliveryOrder, phase: "schedule" | "final_image" | "extras", at = new Date()) {
  const opts = optionsLivraisonCadeau(order.options);
  validerLivraisonCadeau(opts);
  if (!order.paid_at || !order.final_image_url || !order.customer_email) {
    throw new DeliveryPolicyError("La livraison exige une commande payée avec portrait et destinataire.");
  }
  if (estPhysique(opts) && (order.poster_confirmation_status !== "confirmed" ||
      order.poster_confirmation_image_url !== order.final_image_url || order.poster_confirmation_email !== order.customer_email)) {
    throw new DeliveryPolicyError("Le tirage doit être validé pour cette version du portrait et ce destinataire.");
  }
  if (Number.isNaN(at.getTime()) || (opts?.gift?.deliverAfter && opts.gift.deliverAfter > at.toISOString().slice(0, 10))) {
    throw new DeliveryPolicyError("La date de remise du cadeau doit être respectée.");
  }
  if (phase === "extras" && (!order.final_image_sent_at || (!opts?.carteVoeux && !opts?.calendrier))) {
    throw new DeliveryPolicyError("Les extras payés exigent un portrait déjà livré.");
  }
}
