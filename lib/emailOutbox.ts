import { randomUUID } from "node:crypto";
import { sql } from "./db";
import { envoyerEmail } from "./envoiEmail";
import { mesureServeur } from "./analyticsServeur";
import { MESURES } from "./evenementsMesure";

export type EmailPayload = Parameters<typeof envoyerEmail>[0];

/** One SQL statement: payment and durable intent commit or roll back together. */
export async function payerAvecConfirmation(id: string, payload: EmailPayload): Promise<boolean> {
  const rows = await sql`
    WITH paid AS (
      UPDATE orders SET paid_at = NOW(),
        status = CASE WHEN status = 'PENDING' THEN 'PAID' ELSE status END
      WHERE id = ${id}::uuid AND paid_at IS NULL RETURNING id
    )
    INSERT INTO email_outbox(event_key, payload)
    SELECT 'order:' || id::text, ${JSON.stringify(payload)}::text::jsonb FROM paid
    RETURNING event_key
  `;
  return rows.length > 0;
}

/** Leases + fenced acknowledgements; never hold a DB transaction during HTTP.
 * Resend retains idempotency keys 24h: stop at 23h after the first attempt,
 * rather than risk sending twice outside that window. Exhausted is NOT sent.
 */
export async function drainerEmails(eventKey: string | null = null, limit = 20): Promise<number> {
  let sent = 0;
  for (let n = 0; n < Math.min(Math.max(limit, 0), 50); n++) {
    const token = randomUUID();
    await sql`
      UPDATE email_outbox SET exhausted_at = NOW(), lease_token = NULL, lease_until = NULL
      WHERE sent_at IS NULL AND exhausted_at IS NULL
        AND (lease_until IS NULL OR lease_until <= NOW())
        AND (attempts >= 8 OR first_attempt_at <= NOW() - INTERVAL '23 hours')
        AND (${eventKey}::text IS NULL OR event_key = ${eventKey})
    `;
    const rows = await sql`
      WITH candidate AS (
        SELECT event_key FROM email_outbox
        WHERE sent_at IS NULL AND exhausted_at IS NULL AND attempts < 8
          AND available_at <= NOW() AND (lease_until IS NULL OR lease_until <= NOW())
          AND (first_attempt_at IS NULL OR first_attempt_at > NOW() - INTERVAL '23 hours')
          AND (${eventKey}::text IS NULL OR event_key = ${eventKey})
        ORDER BY available_at, event_key FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE email_outbox e SET attempts = attempts + 1,
        first_attempt_at = COALESCE(first_attempt_at, NOW()),
        lease_token = ${token}::uuid, lease_until = NOW() + INTERVAL '2 minutes'
      FROM candidate c WHERE e.event_key = c.event_key RETURNING e.*
    `;
    if (!rows[0]) break;
    const job = rows[0];
    try {
      await envoyerEmail(job.payload as EmailPayload, { idempotencyKey: String(job.event_key) });
      const ack = await sql`
        UPDATE email_outbox SET sent_at = NOW(), lease_until = NULL, lease_token = NULL, last_error = NULL
        WHERE event_key = ${job.event_key} AND lease_token = ${token}::uuid RETURNING event_key
      `;
      sent += ack.length;
      if (ack.length && String(job.event_key).startsWith("order:")) {
        const payload = job.payload as EmailPayload;
        const email = Array.isArray(payload.to) ? payload.to[0] : payload.to;
        // La mesure ne doit jamais invalider un acquittement fournisseur.
        await mesureServeur(MESURES.emailEnvoye, {
          identifiant: email, proprietes: { campagne: "confirmation" },
        }).catch(() => {});
      }
    } catch (error) {
      await sql`
        UPDATE email_outbox SET lease_until = NULL, lease_token = NULL,
          available_at = NOW() + (LEAST(3600, 60 * POWER(2, attempts - 1)) * INTERVAL '1 second'),
          exhausted_at = CASE WHEN attempts >= 8 THEN NOW() ELSE NULL END,
          last_error = ${error instanceof Error ? error.name : "EmailDeliveryError"}
        WHERE event_key = ${job.event_key} AND lease_token = ${token}::uuid
      `;
      throw error;
    }
  }
  return sent;
}
