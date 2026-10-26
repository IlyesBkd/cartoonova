import { createHash } from "node:crypto";
import type postgres from "postgres";
import { withFreshDatabaseClient } from "@/lib/db";
import { assertDeliveryEligible } from "./deliveryPolicy";

export class OrderDeliveryError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
type Snapshot = { id: string; customer_email: string; final_image_url: string | null; options: unknown; langue?: string | null; detected_country?: string | null };
type Artifacts = Record<string, unknown>;
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function options(value: unknown) { return typeof value === "string" ? JSON.parse(value) : value; }
function snapshot(order: Snapshot) {
  return stable([order.final_image_url,order.customer_email,options(order.options),order.langue,order.detected_country]);
}
export function deliveryContentHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
interface DeliveryContext {
  artifacts: Artifacts;
  checkpoint: (artifacts: Artifacts) => Promise<void>;
  send: (provider: (idempotencyKey: string) => Promise<{ data?: { id: string } | null; error?: unknown }>) => Promise<void>;
}
/**
 * Distributed lock + durable effect ledger. Hold the canonical order row lock
 * across preparation/send so SQL updates cannot change recipient/image mid-send.
 * Ledger writes use independent transactions: a process crash after invoking a
 * provider leaves `sending`, NEVER an automatically retryable phantom failure.
 */
export async function executeDelivery(
  expected: Snapshot, kind: "extras" | "final_image", contentHash: string, recipient: string,
  work: (context: DeliveryContext) => Promise<void>
): Promise<{ artifacts: Artifacts; emailId: string | null; duplicate: boolean }> {
  return withFreshDatabaseClient(async lockDb => lockDb.begin(async tx => {
    const [lock] = await tx`SELECT pg_try_advisory_xact_lock(hashtextextended(${`delivery:${expected.id}:${kind}`},0)) AS acquired`;
    if (!lock.acquired) throw new OrderDeliveryError("Un envoi est déjà en cours.");
    const [current] = await tx`SELECT * FROM orders WHERE id=${expected.id}::uuid FOR NO KEY UPDATE`;
    if (!current) throw new OrderDeliveryError("Commande introuvable.",404);
    try { assertDeliveryEligible(current as Snapshot, kind); }
    catch (error) { throw new OrderDeliveryError(error instanceof Error ? error.message : "Livraison refusée."); }
    if (snapshot(current as Snapshot) !== snapshot(expected)) throw new OrderDeliveryError("La commande a changé. Rechargez-la avant l'envoi.");
    const opts = options(current.options);
    if (kind === "extras" && (!current.final_image_sent_at || (!opts?.carteVoeux && !opts?.calendrier))) {
      throw new OrderDeliveryError("Les extras payés exigent un portrait déjà livré.");
    }

    const versionFor = (to: string) => createHash("sha256").update(stable([contentHash,opts,to.trim().toLowerCase(),current.langue,current.detected_country])).digest("hex");
    const version = versionFor(recipient);
    const delivery = await withFreshDatabaseClient(async db => {
      if (kind === "extras") {
        // Match the exact content/options/destination fingerprint used by final
        // delivery, including gifts. A timestamp or URL alone proves no bytes.
        const finalRecipient = opts?.gift?.recipientEmail?.trim() || current.customer_email;
        const [sent] = await db`SELECT version FROM order_delivery_effects WHERE order_id=${expected.id}::uuid AND kind='final_image' AND version=${versionFor(finalRecipient)} AND status='sent'`;
        if (!sent) throw new OrderDeliveryError("Portrait courant sans empreinte de livraison compatible : vérification administrative requise.");
      }
      if (kind === "final_image" && current.final_image_sent_at) {
        const [known] = await db`SELECT version FROM order_delivery_effects WHERE order_id=${expected.id}::uuid AND kind=${kind} LIMIT 1`;
        if (!known) throw new OrderDeliveryError("Livraison historique sans empreinte : vérification administrative requise avant renvoi.");
      }
      const [unresolved] = await db`SELECT status FROM order_delivery_effects WHERE order_id=${expected.id}::uuid AND kind=${kind} AND (status IN ('sending','uncertain') OR artifacts->>'uploadPending' IS NOT NULL) LIMIT 1`;
      if (unresolved) throw new OrderDeliveryError("Résultat fournisseur incertain : vérifier le journal avant toute reprise.");
      await db`INSERT INTO order_delivery_effects(order_id,kind,version,status) VALUES(${expected.id}::uuid,${kind},${version},'preparing') ON CONFLICT DO NOTHING`;
      const [effect] = await db`SELECT * FROM order_delivery_effects WHERE order_id=${expected.id}::uuid AND kind=${kind} AND version=${version}`;
      if (effect.status === "sent") return {artifacts:effect.artifacts as Artifacts,emailId:effect.email_id as string | null,duplicate:true};
      const context: DeliveryContext = {
        artifacts: effect.artifacts as Artifacts,
        checkpoint: async artifacts => {
          await db`UPDATE order_delivery_effects SET artifacts=${db.json(artifacts as postgres.JSONValue)},updated_at=now() WHERE order_id=${expected.id}::uuid AND kind=${kind} AND version=${version}`;
          context.artifacts = artifacts;
        },
        send: async provider => {
          await db`UPDATE order_delivery_effects SET status='sending',updated_at=now() WHERE order_id=${expected.id}::uuid AND kind=${kind} AND version=${version}`;
          try {
            const result = await provider(`delivery/${expected.id}/${kind}/${version}`);
            if (result.error) throw new Error("Envoi refusé.");
            await db`UPDATE order_delivery_effects SET status='sent',email_id=${result.data?.id ?? null},updated_at=now() WHERE order_id=${expected.id}::uuid AND kind=${kind} AND version=${version}`;
          } catch (error) {
            await db`UPDATE order_delivery_effects SET status='uncertain',updated_at=now() WHERE order_id=${expected.id}::uuid AND kind=${kind} AND version=${version}`;
            throw error;
          }
        },
      };
      await work(context);
      const [done] = await db`SELECT * FROM order_delivery_effects WHERE order_id=${expected.id}::uuid AND kind=${kind} AND version=${version}`;
      if (done.status !== "sent") throw new OrderDeliveryError("Envoi non confirmé.");
      return {artifacts:done.artifacts as Artifacts,emailId:done.email_id as string | null,duplicate:false};
    });
    if (kind === "final_image") await tx`UPDATE orders SET final_image_sent_at=COALESCE(final_image_sent_at,now()), final_image_scheduled_at=NULL WHERE id=${expected.id}::uuid`;
    return delivery;
  }));
}

/** Offline admin operation only, after checking the provider log. No public API.
 * `not_sent` is a positive confirmation of rejection, NEVER merely a timeout.
 * `sent` records acceptance without contacting the provider again.
 */
export async function reconcileDelivery(
  orderId: string, kind: "extras" | "final_image", version: string,
  resolution: { outcome: "sent" | "not_sent"; reason: string; emailId?: string }
) {
  if (!resolution.reason.trim() || !["sent", "not_sent"].includes(resolution.outcome) ||
      (resolution.outcome === "sent" && !resolution.emailId?.trim())) {
    throw new OrderDeliveryError("Une preuve fournisseur et une décision explicite sont requises.",400);
  }
  return withFreshDatabaseClient(async db => db.begin(async tx => {
    const [lock] = await tx`SELECT pg_try_advisory_xact_lock(hashtextextended(${`delivery:${orderId}:${kind}`},0)) AS acquired`;
    if (!lock.acquired) throw new OrderDeliveryError("Un envoi est déjà en cours.");
    const event = { ...resolution, at: new Date().toISOString() };
    const [updated] = await tx`UPDATE order_delivery_effects SET
      status=${resolution.outcome === "sent" ? "sent" : "preparing"}, email_id=${resolution.emailId ?? null},updated_at=now(),
      artifacts=(artifacts - 'uploadPending') || jsonb_build_object('reconciliation',COALESCE(artifacts->'reconciliation','[]'::jsonb) || ${tx.json(event)}::jsonb)
      WHERE order_id=${orderId}::uuid AND kind=${kind} AND version=${version}
        AND (status IN ('sending','uncertain') OR (status='preparing' AND artifacts->>'uploadPending' IS NOT NULL AND ${resolution.outcome === "not_sent"})) RETURNING version`;
    if (!updated) throw new OrderDeliveryError("Aucun résultat incertain correspondant.");
  }));
}
