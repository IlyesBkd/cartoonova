import { createHash, randomBytes, randomUUID } from "node:crypto";
import { checkoutPhotoSession, checkoutPhotoSubject } from "@/lib/checkoutPhotoSession";
import { withFreshDatabaseClient } from "@/lib/db";
import { parseOrderTrackingToken } from "@/lib/emailToken";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { SLUGS_PRODUIT_TOUTES_LANGUES } from "@/lib/catalogue";

import type { TransactionSql } from "postgres";
type Transaction = TransactionSql;
export class UploadError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}
const MAX_BYTES = 10 * 1024 * 1024;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function ipHash(req: Request) {
  // Only Vercel's overwritten ingress header is trusted. Outside Vercel all
  // callers deliberately share a bucket; arbitrary X-Forwarded-For is ignored.
  const ip = process.env.VERCEL === "1" ? req.headers.get("x-vercel-forwarded-for") : "local-shared";
  return hash(ip?.split(",")[0].trim() || "unknown-shared");
}
function sameOrigin(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) throw new UploadError("Origine invalide.");
}
async function charge(tx: Transaction, key: string, amount: number, limit: number) {
  const rows = await tx`
    INSERT INTO upload_quota_buckets (key, used) VALUES (${key}, ${amount})
    ON CONFLICT (key) DO UPDATE SET used = upload_quota_buckets.used + EXCLUDED.used
    WHERE upload_quota_buckets.used + EXCLUDED.used <= ${limit}
    RETURNING used`;
  if (!rows.length) throw new UploadError("Quota de dépôt atteint. Réessayez plus tard.", 429);
}
export async function createUploadContext(req: Request, input: { purpose?: unknown; product?: unknown; token?: unknown; orderId?: unknown }) {
  sameOrigin(req);
  const purpose = input.purpose;
  if (!["checkout", "depot", "poster", "admin"].includes(String(purpose))) throw new UploadError("Contexte invalide.");
  let subject = "";
  const photoSession = purpose === "checkout" ? checkoutPhotoSession(req) ?? randomBytes(32).toString("hex") : null;
  return withFreshDatabaseClient(async db => db.begin(async tx => {
    if (purpose === "checkout") {
      if (typeof input.product !== "string" || !SLUGS_PRODUIT_TOUTES_LANGUES.includes(input.product)) throw new UploadError("Produit invalide.");
      subject = checkoutPhotoSubject(photoSession!);
    } else {
      let rows;
      if (purpose === "admin") {
        const refused = await refuserSiPasAdmin(req);
        if (refused) throw new UploadError("Non autorisé.", refused.status);
        if (typeof input.orderId !== "string" || !/^[a-f0-9-]{36}$/i.test(input.orderId)) throw new UploadError("Commande invalide.");
        rows = await tx`SELECT id FROM orders WHERE id = ${input.orderId}`;
      } else if (purpose === "depot") {
        const id = typeof input.token === "string" ? parseOrderTrackingToken(input.token) : null;
        if (!id) throw new UploadError("Lien invalide.");
        rows = await tx`SELECT id FROM orders WHERE id = ${id} AND paid_at IS NOT NULL`;
      } else {
        if (typeof input.token !== "string" || input.token.length > 256) throw new UploadError("Lien invalide.");
        rows = await tx`SELECT id FROM orders WHERE poster_confirmation_token = ${input.token}
          AND paid_at IS NOT NULL`;
      }
      if (!rows.length) throw new UploadError("Commande indisponible.");
      subject = `${purpose}:${rows[0].id}`;
    }
    const [{ day }] = await tx`SELECT (now() AT TIME ZONE 'UTC')::date::text AS day`;
    // A single transaction for all scopes: a failed scope rolls back every debit.
    // Always acquire shared buckets in the same order to avoid deadlocks.
    await charge(tx, `issue:global:${day}`, 1, 1000);
    // Admin authorization above selects a separate, bounded team envelope;
    // the global cap remains shared with public traffic.
    await charge(tx, purpose === "admin" ? `issue:admin:ip:${ipHash(req)}:${day}` : `issue:ip:${ipHash(req)}:${day}`, 1, purpose === "admin" ? 128 : 12);
    const id = randomUUID();
    const context = randomBytes(32).toString("hex");
    const base = purpose === "poster" ? "retouches" : purpose === "admin" ? "final" : "orders";
    const prefix = `${base}/${id}/`;
    const [row] = await tx`INSERT INTO upload_contexts (id, token_hash, purpose, subject, ip_hash, prefix, expires_at)
      VALUES (${id}, ${hash(context)}, ${String(purpose)}, ${subject}, ${ipHash(req)}, ${prefix}, now() + interval '15 minutes')
      RETURNING expires_at`;
    return { context, prefix, expiresAt: new Date(row.expires_at).getTime(), photoSession };
  }));
}
export async function reserveUpload(req: Request, pathname: string, context: string | null) {
  if (!context || !/^[a-f0-9]{64}$/.test(context)) throw new UploadError("Contexte requis.");
  sameOrigin(req);
  return withFreshDatabaseClient(async db => db.begin(async tx => {
    const [c] = await tx`SELECT * FROM upload_contexts WHERE token_hash = ${hash(context)}
      AND ip_hash = ${ipHash(req)} AND expires_at > now() FOR UPDATE`;
    if (!c) throw new UploadError("Contexte expiré ou invalide.");
    if (c.purpose === "checkout") {
      const session = checkoutPhotoSession(req);
      if (!session || c.subject !== checkoutPhotoSubject(session)) throw new UploadError("Session de photos invalide.");
    }
    if (!pathname.startsWith(c.prefix) || !/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|heic|heif)$/i.test(pathname.slice(c.prefix.length))) {
      throw new UploadError("Chemin de dépôt interdit.");
    }
    const [{ day }] = await tx`SELECT (now() AT TIME ZONE 'UTC')::date::text AS day`;
    // Pessimistic reservation BEFORE issuing a provider token. Never refunded:
    // even an abandoned/failed response can have a valid provider token.
    await charge(tx, `bytes:global:${day}`, MAX_BYTES, MAX_BYTES * 1000);
    await charge(tx, c.purpose === "admin" ? `bytes:admin:ip:${c.ip_hash}:${day}` : `bytes:ip:${c.ip_hash}:${day}`, MAX_BYTES, MAX_BYTES * (c.purpose === "admin" ? 256 : 64));
    await charge(tx, `bytes:subject:${c.subject}:${day}`, MAX_BYTES, MAX_BYTES * 32);
    await charge(tx, `bytes:context:${c.id}`, MAX_BYTES, MAX_BYTES * 16);
    const reservation = randomUUID();
    const reserved = await tx`INSERT INTO upload_reservations (id, context_id, pathname, reserved_bytes)
      VALUES (${reservation}, ${c.id}, ${pathname}, ${MAX_BYTES})
      ON CONFLICT (pathname) DO NOTHING RETURNING id`;
    if (!reserved.length) throw new UploadError("Chemin déjà réservé.", 409);
    return {
      allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
      maximumSizeInBytes: MAX_BYTES,
      validUntil: Math.min(Date.now() + 120_000, new Date(c.expires_at).getTime()),
      // The SDK signs the exact requested pathname. One reserved path must
      // never fan out into multiple provider objects when its token is replayed.
      addRandomSuffix: false,
      allowOverwrite: false,
      tokenPayload: JSON.stringify({ reservation }),
    };
  }));
}
