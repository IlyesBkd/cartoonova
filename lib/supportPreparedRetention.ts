import { withFreshDatabaseClient } from "@/lib/db";

/**
 * Opt-in maintenance primitive; deliberately not scheduled or exposed as a route.
 * Delete at most 100 never-approved previews older than 90 days per invocation.
 * The global send lock serializes this operation with preparation and delivery;
 * the row locks serialize it with approval. Never delete delivery evidence.
 */
export async function purgeExpiredUnapprovedSupportDrafts(): Promise<number> {
  return withFreshDatabaseClient(db => db.begin(async tx => {
    await tx`SET LOCAL lock_timeout = '3s'`;
    await tx`SET LOCAL statement_timeout = '5s'`;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended('support-send:global',0))`;
    const deleted = await tx`
      DELETE FROM support_prepared_replies WHERE id IN (
        SELECT id FROM support_prepared_replies
        WHERE status='prepared' AND approved_at IS NULL AND provider_id IS NULL
          AND provider_sent_at IS NULL AND resolved_at IS NULL AND reply_id IS NULL
          AND prior_outbound_id IS NULL AND created_at < clock_timestamp() - interval '90 days'
        ORDER BY created_at, id LIMIT 100 FOR UPDATE SKIP LOCKED
      ) RETURNING id`;
    return deleted.length;
  }));
}
