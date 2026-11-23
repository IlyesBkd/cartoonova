import type postgres from "postgres";
import { createHash } from "node:crypto";
import { withFreshDatabaseClient, type DbOrder } from "@/lib/db";
import { estPhysique } from "@/lib/supportCommande";
import { langueCommande } from "@/lib/email-i18n";
import { ShippingError } from "@/lib/orderDeliveryShipping";

export interface ShippingDetails {
  supplierRef: string;
  orderIds: string[];
  tracking: { number: string; url: string; carrier: string | null }[];
  scope: "supplier_group_no_parcel_product_mapping";
}
export function parseShippingGroup(value: unknown): ShippingDetails {
  const v = value as Partial<ShippingDetails> | null;
  if (!v || typeof v.supplierRef !== 'string' || !/^\d{6,10}$/.test(v.supplierRef) || !Array.isArray(v.orderIds) || !v.orderIds.length || v.orderIds.length > 30 ||
      v.orderIds.some(id => typeof id !== "string" || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)) || new Set(v.orderIds).size !== v.orderIds.length ||
      !Array.isArray(v.tracking) || !v.tracking.length || v.tracking.length > 30) throw new ShippingError("Groupe ou suivis invalides.",400);
  const tracking = v.tracking.map(t => {
    if (!t || typeof t.number !== "string" || !/^[A-Za-z0-9]{6,40}$/.test(t.number) ||
        (t.carrier !== null && t.carrier !== undefined && (typeof t.carrier !== "string" || t.carrier.length > 60))) throw new ShippingError("Numéro ou transporteur invalide.",400);
    const number = t.number.toUpperCase();
    return {number, url:`https://t.17track.net/fr#nums=${number}`, carrier:t.carrier?.trim() || null};
  }).sort((a,b)=>a.number.localeCompare(b.number));
  if (new Set(tracking.map(t=>t.number)).size !== tracking.length) throw new ShippingError("Suivi répété.",400);
  return {supplierRef:v.supplierRef!,orderIds:[...v.orderIds].sort(),tracking,scope:"supplier_group_no_parcel_product_mapping"};
}
const encoded = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(encoded).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>`${JSON.stringify(k)}:${encoded(x)}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
};
const identity = (o: DbOrder) => {
  const opt = typeof o.options === "string" ? JSON.parse(o.options) : o.options;
  return [o.customer_name?.trim().toLowerCase(),o.customer_email?.trim().toLowerCase(),o.customer_address?.trim().toLowerCase(),opt?.postalCode,opt?.city,opt?.country,langueCommande(o)];
};
/** Separate durable ledger connection is intentional: rollback/crash cannot erase
 * a provider invocation. A sent ledger without matching milestones fails closed.
 * No automatic resend/reconciliation of uncertain attempts. */
export async function notifyShippingGroup(details: ShippingDetails, send?: (orders: DbOrder[], details: ShippingDetails, key: string) => Promise<{data?:{id:string}|null;error?:unknown}>) {
  return withFreshDatabaseClient(async db => db.begin(async tx => {
    const [lock] = await tx`SELECT pg_try_advisory_xact_lock(hashtextextended(${`shipping:${details.supplierRef}`},0)) AS acquired`;
    if (!lock.acquired) throw new ShippingError("Expédition déjà en cours.",409);
    for (const track of details.tracking) {
      const [parcelLock] = await tx`SELECT pg_try_advisory_xact_lock(hashtextextended(${`shipping-track:${track.number}`},0)) AS acquired`;
      if (!parcelLock.acquired) throw new ShippingError("Suivi en cours de rattachement.",409);
    }
    const rows = await tx`SELECT * FROM orders WHERE fournisseur_ref=${details.supplierRef} ORDER BY id FOR NO KEY UPDATE`;
    const orders = rows as unknown as DbOrder[];
    if (encoded(orders.map(o=>o.id)) !== encoded(details.orderIds)) throw new ShippingError("Le périmètre du groupe a changé.",409);
    for (const o of orders) {
      const opt = typeof o.options === "string" ? JSON.parse(o.options) : o.options;
      if (o.id.startsWith("b04b885f") || o.id.startsWith("e742b4db")) throw new ShippingError("Dossier historique exclu.",409);
      if (!o.paid_at || !estPhysique(opt) || o.statut_force || ['REFUNDED','CANCELLED','CANCELED','DEMO'].includes(o.status) || o.poster_confirmation_status !== 'confirmed') throw new ShippingError("Commande non éligible.",409);
      const ident = identity(o);
      if (ident.slice(0,5).some(v=>!v) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.customer_email) || encoded(ident) !== encoded(identity(orders[0]))) throw new ShippingError("Identité, adresse ou langue différente.",409);
    }
    const fingerprint = createHash('sha256').update(encoded([details,identity(orders[0])])).digest('hex');
    const [outside] = await tx`SELECT id FROM orders WHERE NOT (id=ANY(${details.orderIds}::uuid[])) AND
      (suivi_url=ANY(${details.tracking.map(t=>t.url)}::text[]) OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(shipping_details->'tracking','[]'::jsonb)) AS parcel
        WHERE parcel->>'number'=ANY(${details.tracking.map(t=>t.number)}::text[]))) LIMIT 1`;
    if (outside) throw new ShippingError("Suivi déjà rattaché hors du groupe.",409);
    return withFreshDatabaseClient(async ledger => {
      const [otherEffect] = await ledger`SELECT supplier_ref FROM order_shipping_effects WHERE supplier_ref<>${details.supplierRef} AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(details->'tracking') AS parcel WHERE parcel->>'number'=ANY(${details.tracking.map(t=>t.number)}::text[])) LIMIT 1`;
      if (otherEffect) throw new ShippingError("Suivi présent dans un autre journal d'expédition, vérification requise.",409);
      const [prior] = await ledger`SELECT * FROM order_shipping_effects WHERE supplier_ref=${details.supplierRef}`;
      if (prior) {
        if (prior.status !== 'sent' || prior.fingerprint !== fingerprint || orders.some(o=>encoded(o.shipping_details)!==encoded(details) || !o.expedie_le || !o.expedition_email_envoye_le || o.suivi_url!==details.tracking[0].url || o.suivi_transporteur!==details.tracking[0].carrier)) throw new ShippingError("Expédition existante modifiée ou résultat incertain : vérification requise.",409);
        return {duplicate:true,details,emailId:prior.email_id};
      }
      const carrierKey = (value: string | null | undefined) => value?.trim().toLowerCase().replace(/\s+/g,' ') || null;
      if (orders.some(o=>o.suivi_transporteur && details.tracking.some(t=>carrierKey(t.carrier)!==carrierKey(o.suivi_transporteur)))) throw new ShippingError("Transporteur historique contradictoire : vérification requise.",409);
      if (orders.some(o=>o.expedie_le || o.expedition_email_envoye_le || (o.shipping_details ? encoded(o.shipping_details)!==encoded(details) : !!o.suivi_url))) throw new ShippingError("Expédition historique ou contradictoire : vérification requise.",409);
      if (!send) {
        await tx`UPDATE orders SET shipping_details=${tx.json(details as unknown as postgres.JSONValue)},suivi_url=${details.tracking[0].url},suivi_transporteur=${details.tracking[0].carrier} WHERE id=ANY(${details.orderIds}::uuid[])`;
        return {duplicate:false,details,emailId:null};
      }
      await ledger`INSERT INTO order_shipping_effects(supplier_ref,fingerprint,details,status) VALUES(${details.supplierRef},${fingerprint},${tx.json(details as unknown as postgres.JSONValue)},'sending')`;
      let emailId: string;
      try {
        const result = await send(orders,details,`shipping/${details.supplierRef}/${fingerprint}`);
        if (result.error || !result.data?.id) throw new Error("Réponse fournisseur incertaine.");
        emailId=result.data.id;
        await ledger`UPDATE order_shipping_effects SET status='sent',email_id=${emailId},updated_at=now() WHERE supplier_ref=${details.supplierRef}`;
      } catch (error) {
        await ledger`UPDATE order_shipping_effects SET status='uncertain',updated_at=now() WHERE supplier_ref=${details.supplierRef}`;
        throw error;
      }
      await tx`UPDATE orders SET shipping_details=${tx.json(details as unknown as postgres.JSONValue)},
        suivi_url=${details.tracking[0].url},suivi_transporteur=${details.tracking[0].carrier},
        expedie_le=COALESCE(expedie_le,now()),expedition_email_envoye_le=now(),last_outbound_message_id=${emailId}
        WHERE id=ANY(${details.orderIds}::uuid[])`;
      return {duplicate:false,details,emailId};
    });
  }));
}
