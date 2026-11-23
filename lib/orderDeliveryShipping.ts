import { withFreshDatabaseClient, type DbOrder } from "@/lib/db";
import { COUT_ESTIME_EUR, decrireSupport, estPhysique } from "@/lib/supportCommande";

export class ShippingError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export interface ShippingPatch {
  fournisseurRef?: string | null;
  suiviUrl?: string | null;
  transporteur?: string | null;
}
type Notify = (order: DbOrder) => Promise<{ data?: { id: string } | null; error?: unknown }>;
/** Undefined preserves, null (or a normalized empty string) explicitly clears.
 * The optional notification runs under the same canonical row lock. Milestones
 * and message threading are written on this transaction, never another pool
 * connection that would wait on our own lock. This is NOT an exactly-once ledger.
 */
async function saveShipping(orderId: string, patch: ShippingPatch, notify?: Notify) {
  return withFreshDatabaseClient(async db => db.begin(async tx => {
    const [order] = await tx`SELECT * FROM orders WHERE id=${orderId}::uuid FOR NO KEY UPDATE`;
    if (!order) throw new ShippingError("Commande introuvable.", 404);
    if (order.shipping_details) throw new ShippingError("Expédition groupée : utiliser le dossier multi-suivis, sans écraser ses colis.",409);
    // Reference attachment shares the group gate; no member may join mid-send.
    for (const ref of new Set([order.fournisseur_ref,patch.fournisseurRef].filter(Boolean))) {
      const [gate] = await tx`SELECT pg_try_advisory_xact_lock(hashtextextended(${`shipping:${ref}`},0)) AS acquired`;
      if (!gate.acquired) throw new ShippingError("Expédition de cette référence en cours.",409);
      const [frozen] = await tx`SELECT id FROM orders WHERE fournisseur_ref=${ref} AND shipping_details IS NOT NULL LIMIT 1`;
      if (frozen && patch.fournisseurRef !== undefined && patch.fournisseurRef !== order.fournisseur_ref) throw new ShippingError("Groupe d'expédition déjà constitué.",409);
    }
    // A group provider call is durable even when its order transaction rolls
    // back. Check the ledger under the shared reference gate, not only the
    // projection above. Membership also fences a subsequently changed reference.
    const refs = [...new Set([order.fournisseur_ref, patch.fournisseurRef].filter(Boolean))];
    const [effect] = await tx`SELECT supplier_ref FROM order_shipping_effects
      WHERE supplier_ref=ANY(${refs}::text[]) OR details->'orderIds' ? ${order.id}
      LIMIT 1`;
    if (effect) throw new ShippingError("Expédition groupée journalisée : vérification requise, sans envoi simple.",409);
    const options = typeof order.options === "string" ? JSON.parse(order.options) : order.options;
    if (!order.paid_at || !estPhysique(options)) {
      throw new ShippingError("L'expédition exige une commande physique payée.", 409);
    }
    if (notify && !order.customer_email) throw new ShippingError("Commande sans adresse e-mail.", 400);
    const { cle } = decrireSupport(options);
    const estimate = cle && cle !== "digital" ? COUT_ESTIME_EUR[cle] : null;
    const estimer = Boolean(patch.fournisseurRef) && estimate !== null;
    const [saved] = await tx`UPDATE orders SET
      fournisseur_ref=CASE WHEN ${patch.fournisseurRef !== undefined} THEN ${patch.fournisseurRef ?? null} ELSE fournisseur_ref END,
      suivi_url=CASE WHEN ${patch.suiviUrl !== undefined} THEN ${patch.suiviUrl ?? null} ELSE suivi_url END,
      suivi_transporteur=CASE WHEN ${patch.transporteur !== undefined} THEN ${patch.transporteur ?? null} ELSE suivi_transporteur END,
      cout_note=CASE WHEN cout IS NULL AND ${estimer} THEN 'estimation Optimal Print' ELSE cout_note END,
      cout=CASE WHEN cout IS NULL AND ${estimer} THEN ${estimate}::numeric ELSE cout END
      WHERE id=${orderId}::uuid RETURNING *`;
    if (notify) {
      const result = await notify(saved as DbOrder);
      if (result.error) throw new Error("Envoi refusé.");
      await tx`UPDATE orders SET expedie_le=COALESCE(expedie_le,now()), expedition_email_envoye_le=now(),
        last_outbound_message_id=COALESCE(${result.data?.id ?? null},last_outbound_message_id)
        WHERE id=${orderId}::uuid`;
    }
    return saved as DbOrder;
  }));
}
export function patchShipping(orderId: string, patch: ShippingPatch) {
  return saveShipping(orderId, patch);
}
export function notifyShipping(orderId: string, patch: ShippingPatch, notify: Notify) {
  return saveShipping(orderId, patch, notify);
}
