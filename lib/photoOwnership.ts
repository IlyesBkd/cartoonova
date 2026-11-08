import type { Sql, TransactionSql } from "postgres";
import { withFreshDatabaseClient } from "@/lib/db";
import type { PhotosInvalides } from "@/lib/orderPhotos";
import { isVpsReference } from "./storageReference";
import { checkoutPhotoSession, checkoutPhotoSubject } from "@/lib/checkoutPhotoSession";

async function completeVpsPhotos(photos: string[], db: Sql | TransactionSql): Promise<boolean> {
  const references = [...new Set(photos.filter(isVpsReference))];
  if (!references.length) return true;
  const rows = await db`SELECT reference FROM storage_objects WHERE reference IN ${db(references)} AND status = 'completed'`;
  const completed = new Set(rows.map(row => String(row.reference)));
  return references.every(ref => completed.has(ref));
}

/** Checkout has no order capability yet: only the independent opaque browser
 * session can attach its reservations. No legacy or already-attached bypass.
 * Neither this session nor this check authorizes a PaymentIntent.
 */
export async function validateCheckoutPhotoOwnership(req: Request, photos: string[]): Promise<PhotosInvalides | null> {
  if (!photos.length) return null;
  const session = checkoutPhotoSession(req);
  if (!session) return { error: "Session de photos requise. Déposez à nouveau vos photos." };
  const paths = photos.map(photo => new URL(photo).pathname.slice(1));
  return withFreshDatabaseClient(async db => {
    if (!await completeVpsPhotos(photos, db)) return { error: "Dépôt non terminé." };
    const rows = await db`
      SELECT r.pathname FROM upload_reservations r
      JOIN upload_contexts c ON c.id = r.context_id
      WHERE r.pathname IN ${db(paths)}
        AND c.purpose = 'checkout' AND c.subject = ${checkoutPhotoSubject(session)}`;
    const owned = new Set(rows.map(row => String(row.pathname)));
    return paths.every(path => owned.has(path)) ? null
      : { error: "Cette photo n'appartient pas à cette session de dépôt." };
  });
}

/** A Blob pathname is not a capability. The CODE-04 reservation ledger binds
 * each new object to the authenticated order; expiry limits minting, not reuse
 * of an already reserved object after checkout/payment or a later revisit.
 */
export async function validatePhotoOwnership(
  photos: string[],
  order: { id: string; photo_urls?: unknown; poster_confirmation_photos?: unknown },
  purpose: "depot" | "poster",
  query?: TransactionSql,
): Promise<PhotosInvalides | null> {
  const previous = purpose === "depot" ? order.photo_urls : order.poster_confirmation_photos;
  const attached = new Set(Array.isArray(previous) ? previous.filter((v): v is string => typeof v === "string") : []);
  const namespace = purpose === "poster" ? "/retouches/" : "/orders/";
  for (const photo of photos) {
    if (!new URL(photo).pathname.startsWith(namespace)) {
      return { error: "Cette photo n'est pas autorisée pour ce dépôt." };
    }
  }
  // Legacy timestamp + original filename uploads predate the ledger. Only an
  // exact URL already attached to this order may be retained, never a guessed
  // legacy filename supplied by a different customer.
  const pending = photos.filter(photo => !attached.has(photo));
  if (!pending.length && !photos.some(isVpsReference)) return null;
  const check = async (db: Sql | TransactionSql) => {
    if (!await completeVpsPhotos(photos, db)) return { error: "Dépôt non terminé." };
    if (!pending.length) return null;
    const paths = pending.map(photo => new URL(photo).pathname.slice(1));
    const rows = await db`
      SELECT r.pathname FROM upload_reservations r
      JOIN upload_contexts c ON c.id = r.context_id
      WHERE r.pathname IN ${db(paths)}
        AND c.purpose = ${purpose} AND c.subject = ${`${purpose}:${order.id}`}`;
    const owned = new Set(rows.map(row => String(row.pathname)));
    return paths.every(path => owned.has(path)) ? null
      : { error: "Cette photo n'appartient pas à cette commande." };
  };
  return query ? check(query) : withFreshDatabaseClient(check);
}
