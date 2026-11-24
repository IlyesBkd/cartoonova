import { randomUUID } from "node:crypto";
import { withFreshDatabaseClient } from "./db";

type EmailSnapshot = { to?: string | string[]; cc?: string | string[]; bcc?: string | string[]; subject?: string; text?: string; attachments?: Array<{ filename?: string | false }> };
const addresses = (v?: string | string[]) => (Array.isArray(v) ? v : v ? [v] : []).map(x => x.trim().toLowerCase());
/** Separate autocommit connection: a business rollback cannot erase invocation.
 * No headers, API keys, signed transport metadata or attachment bytes. */
export async function beginEmailHistory(payload: EmailSnapshot, idempotencyKey?: string): Promise<string> {
  const attempt = randomUUID();
  const recipients = [...new Set([...addresses(payload.to), ...addresses(payload.cc), ...addresses(payload.bcc)])];
  await withFreshDatabaseClient(async db => {
    for (const email of recipients) await db`INSERT INTO customer_history_events
      (customer_email,kind,status,subject,body,details,attempt_id)
      VALUES(${email},'email','uncertain',${payload.subject ?? null},${payload.text ?? null},
        ${JSON.stringify({ attachments: (payload.attachments ?? []).map(a => a.filename ?? 'pièce jointe'), idempotencyKey: idempotencyKey ?? null })}::text::jsonb,${attempt}::uuid)`;
  });
  return attempt;
}
/** Append outcome rather than update: provider acceptance and its timestamp
 * are immutable. Failure here must NEVER turn an accepted email into a retry. */
export async function finishEmailHistory(attempt: string, status: 'sent' | 'uncertain' | 'failed', providerId?: string) {
  await withFreshDatabaseClient(db => db`INSERT INTO customer_history_events
    (customer_email,kind,status,subject,body,details,attempt_id,provider_id,sent_at)
    SELECT DISTINCT ON (customer_email) customer_email,kind,${status},subject,body,details,attempt_id,${providerId ?? null},
      CASE WHEN ${status}='sent' THEN clock_timestamp() ELSE NULL END
    FROM customer_history_events WHERE attempt_id=${attempt}::uuid
      AND NOT EXISTS(SELECT 1 FROM customer_history_events x WHERE x.attempt_id=${attempt}::uuid AND x.status IN ('sent','failed'))
    ORDER BY customer_email,at,id`);
}
export function emailHistoryDiagnostic() { console.error('[customer-history] email journal outcome unavailable'); }
