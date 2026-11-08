import { withFreshDatabaseClient, type DbOrder } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { parseOrderTrackingToken } from "@/lib/emailToken";
import { checkoutPhotoSession, checkoutPhotoSubject } from "@/lib/checkoutPhotoSession";
import { canRespondToPreview } from "@/lib/clientOrderPolicy";
import { storagePath, isVpsReference } from "./storageCore";
import { storageDescriptor } from "./storage";

export async function authorizeFinalStorageAttachment(reference: string, orderId: string) {
  if (!isVpsReference(reference) || !storagePath(reference).startsWith("/final/")) return false;
  const d = await storageDescriptor(reference);
  if (d.status !== "completed") return false;
  const rows = await withFreshDatabaseClient(db => db`SELECT r.pathname FROM upload_reservations r
    JOIN upload_contexts c ON c.id = r.context_id WHERE r.pathname = ${storagePath(reference).slice(1)}
    AND c.purpose = 'admin' AND c.subject = ${`admin:${orderId}`}`);
  return rows.length > 0;
}
export async function authorizeStorageRead(req: Request, reference: string): Promise<boolean> {
  if (!isVpsReference(reference)) return false;
  if (await requireAdmin(req) === null) return true;
  const path = storagePath(reference).slice(1);
  const session = checkoutPhotoSession(req);
  if (session) {
    const rows = await withFreshDatabaseClient(db => db`SELECT r.pathname FROM upload_reservations r
      JOIN upload_contexts c ON c.id = r.context_id WHERE r.pathname = ${path}
      AND c.purpose = 'checkout' AND c.subject = ${checkoutPhotoSubject(session)}`);
    if (rows.length) return true;
  }
  const url = new URL(req.url);
  const tracking = url.searchParams.get("token");
  const poster = url.searchParams.get("posterToken");
  const id = tracking ? parseOrderTrackingToken(tracking) : null;
  const attached = (order: DbOrder) => [order.photo_urls, order.poster_confirmation_photos].some(list => Array.isArray(list) && list.includes(reference));
  if (id) {
    const [row] = await withFreshDatabaseClient(db => db`SELECT * FROM orders WHERE id = ${id}::uuid`);
    const order = row as unknown as DbOrder;
    if (order?.paid_at && (attached(order) || (order.final_image_url === reference && !!order.final_image_sent_at))) return true;
  }
  if (poster && poster.length <= 256) {
    const [row] = await withFreshDatabaseClient(db => db`SELECT * FROM orders WHERE poster_confirmation_token = ${poster}`);
    const order = row as unknown as DbOrder;
    if (canRespondToPreview(order) && (order.poster_confirmation_image_url === reference || attached(order))) return true;
  }
  return false;
}
