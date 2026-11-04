import { createHash, randomUUID } from "node:crypto";
import { sql, withFreshDatabaseClient } from "@/lib/db";
import { readPreparedSupportReply } from "@/lib/supportPreparedReplies";

type Prepared = NonNullable<Awaited<ReturnType<typeof readPreparedSupportReply>>>;
type Provider = (draft: Prepared, idempotencyKey: string) => Promise<{ id: string }>;

/** A durable sending intent is committed BEFORE contacting the provider. */
export async function approvePreparedSupportReply(id: string, approvedFingerprint: string) {
  const draft = await readPreparedSupportReply(id);
  if (!draft || draft.status !== "prepared" || draft.approvalFingerprint !== approvedFingerprint) throw new Error("Approbation invalide.");
  const rows = await sql`UPDATE support_prepared_replies SET approved_at=COALESCE(approved_at,clock_timestamp())
    WHERE id=${id}::uuid AND status='prepared' AND approval_hash=${approvedFingerprint} RETURNING id`;
  if (!rows.length) throw new Error("Approbation invalide.");
}

export async function sendPreparedSupportReply(id: string, approvedFingerprint: string, provider: Provider, preflight?: (draft: Prepared) => void): Promise<number> {
  const draft = await readPreparedSupportReply(id);
  if (!draft || draft.status !== "prepared" || draft.approvalFingerprint !== approvedFingerprint) throw new Error("Approbation invalide ou brouillon déjà traité.");
  const priorOutboundId = await withFreshDatabaseClient(db => db.begin(async tx => {
  await tx`SET LOCAL lock_timeout = '3s'`;
  await tx`SET LOCAL statement_timeout = '5s'`;
  const [globalLock] = await tx`SELECT pg_try_advisory_xact_lock(hashtextextended('support-send:global',0)) AS acquired`;
  if (!globalLock.acquired) throw new Error("Un autre envoi support est en cours.");

  const [identity] = draft.targetType === "message"
    ? await tx`SELECT order_id::text AS order_id FROM support_messages WHERE id=${Number(draft.targetId)} FOR NO KEY UPDATE`
    : [{ order_id: draft.targetId }];
  if (!identity) throw new Error("Conversation introuvable.");
  if ((identity.order_id ?? null) !== (draft.frozenOrderId ?? null)) throw new Error("Conversation modifiée : préparez un nouvel aperçu.");

  let priorOutboundId: string | null = null;
  if (draft.targetType === "message") {
    const [message] = await tx`SELECT from_email FROM support_messages WHERE id=${Number(draft.targetId)} FOR NO KEY UPDATE`;
    if (!message || message.from_email !== draft.toEmail) throw new Error("Destinataire modifié : préparez une nouvelle réponse.");
  }
  if (draft.frozenOrderId) {
    const [order] = await tx`SELECT customer_email,last_outbound_message_id FROM orders WHERE id=${draft.frozenOrderId}::uuid FOR NO KEY UPDATE`;
    if (!order || (draft.targetType === "order" && order.customer_email !== draft.toEmail)) throw new Error("Destinataire modifié : préparez une nouvelle réponse.");
    priorOutboundId = (order.last_outbound_message_id as string | null) ?? null;
  }
  // Conservative global gate: a later or unresolved send invalidates every older preview,
  // even if message-to-order links were changed concurrently.
  const [unresolved] = await tx`SELECT previous.id FROM support_prepared_replies previous
    JOIN support_prepared_replies current ON current.id=${id}::uuid
    WHERE previous.id<>current.id AND
      (previous.status IN ('sending','uncertain') OR (previous.status='sent' AND previous.reply_id IS NULL)
        OR (previous.status='sent' AND (previous.resolved_at IS NULL OR previous.resolved_at >= current.created_at))) LIMIT 1`;
  if (unresolved) throw new Error("Un envoi précédent bloque ce brouillon : vérifiez la conversation et préparez un nouvel aperçu.");
  // Only strictly local, synchronous preparation belongs here. A failure is
  // known not to have invoked the provider and must not claim the draft.
  preflight?.(draft);
  const claimed = await tx`UPDATE support_prepared_replies SET status='sending',prior_outbound_id=${priorOutboundId} WHERE id=${id}::uuid AND status='prepared' AND approved_at IS NOT NULL AND approval_hash=${approvedFingerprint} RETURNING id`;
  if (!claimed.length) throw new Error("Brouillon déjà traité ou en cours.");
  return priorOutboundId;
  })); // The global lock and the durable claim commit together, on one connection.

  await withFreshDatabaseClient(lockDb => lockDb.begin(async tx => {
  await tx`SET LOCAL lock_timeout = '3s'`;
  await tx`SET LOCAL statement_timeout = '5s'`;
  const [globalLock] = await tx`SELECT pg_try_advisory_xact_lock(hashtextextended('support-send:global',0)) AS acquired`;
  if (!globalLock.acquired) throw new Error("Envoi réservé : vérification requise.");
  // Reacquire and revalidate the canonical rows after the claim committed.
  if (draft.targetType === "message") {
    const [message] = await tx`SELECT order_id::text AS order_id,from_email FROM support_messages WHERE id=${Number(draft.targetId)} FOR NO KEY UPDATE`;
    if (!message || (message.order_id ?? null) !== (draft.frozenOrderId ?? null) || message.from_email !== draft.toEmail) throw new Error("Conversation modifiée : vérification requise.");
  }
  if (draft.frozenOrderId) {
    const [order] = await tx`SELECT customer_email,last_outbound_message_id FROM orders WHERE id=${draft.frozenOrderId}::uuid FOR NO KEY UPDATE`;
    if (!order || (draft.targetType === "order" && order.customer_email !== draft.toEmail) || (order.last_outbound_message_id ?? null) !== priorOutboundId) throw new Error("Conversation modifiée : vérification requise.");
  }
  // Any exception or lost response leaves 'sending': NEVER resend blindly.
  // Bound the lock duration. A timeout is uncertain, not proof of non-delivery.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let result: { id: string };
  try {
    result = await Promise.race([
      provider(draft, `support/${id}`).then(async accepted => {
        if (!accepted.id) throw new Error("Résultat fournisseur incertain : vérification requise.");
        // This checkpoint may still run after the timeout if the process survives.
        await withFreshDatabaseClient(async checkpoint => {
          await checkpoint`SET lock_timeout = '3s'`;
          await checkpoint`SET statement_timeout = '5s'`;
          const stored = await checkpoint`UPDATE support_prepared_replies SET status='sent',provider_id=${accepted.id},provider_sent_at=clock_timestamp(),resolved_at=clock_timestamp() WHERE id=${id}::uuid AND status='sending' RETURNING id`;
          if (!stored.length) throw new Error("Résultat fournisseur incertain : vérification requise.");
        });
        return accepted;
      }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Envoi incertain : délai fournisseur dépassé.")), 8000); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!result.id) throw new Error("Résultat fournisseur incertain : vérification requise.");
  }));
  try { return await reconcilePreparedSupportReply(id); }
  catch { throw new Error("Email accepté, mais historique à réparer sans renvoi."); }
}

/** Idempotent history repair: this function cannot call an email provider. */
export async function reconcilePreparedSupportReply(id: string): Promise<number> {
  const draft = await readPreparedSupportReply(id);
  if (!draft || draft.status !== "sent") throw new Error("Aucun envoi confirmé à réparer.");
  return withFreshDatabaseClient(db => db.begin(async tx => {
    await tx`SET LOCAL lock_timeout = '3s'`;
    await tx`SET LOCAL statement_timeout = '5s'`;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended('support-send:global',0))`;
    const [entry] = await tx`SELECT status,provider_id,provider_sent_at,reply_id,prior_outbound_id FROM support_prepared_replies WHERE id=${id}::uuid FOR UPDATE`;
    if (!entry || entry.status !== "sent" || !entry.provider_id || !entry.provider_sent_at) throw new Error("Aucun envoi confirmé à réparer.");
    if (entry.reply_id) return Number(entry.reply_id);
    const orderId = draft.frozenOrderId ?? null;
    const messageId = draft.targetType === "message" ? Number(draft.targetId) : null;
    if (messageId) {
      const [message] = await tx`SELECT id FROM support_messages WHERE id=${messageId}`;
      if (!message) throw new Error("Conversation introuvable.");

    }
    const [reply] = await tx`INSERT INTO support_replies(support_message_id,order_id,to_email,subject,body_text,assistee_ia,provider_id,sent_at)
      VALUES(${messageId},${orderId}::uuid,${draft.toEmail},${draft.subject},${draft.body},${Boolean(draft.assisteeIa)},${entry.provider_id},${entry.provider_sent_at}) RETURNING id`;
    for (const file of draft.attachments) {
      const digest = createHash("sha256").update(file.bytes).digest("hex");
      await tx`INSERT INTO support_private_attachments(id,reply_id,filename,content_type,content,sha256)
        VALUES(${randomUUID()}::uuid,${reply.id},${file.name},${file.contentType},${file.bytes},${digest})`;
    }
    if (messageId) await tx`UPDATE support_messages SET read_at=COALESCE(read_at,now()) WHERE id=${messageId}`;
    if (orderId) await tx`UPDATE orders SET last_outbound_message_id=${entry.provider_id} WHERE id=${orderId}::uuid AND last_outbound_message_id IS NOT DISTINCT FROM ${entry.prior_outbound_id}`;
    await tx`UPDATE support_prepared_replies SET reply_id=${reply.id},resolved_at=clock_timestamp() WHERE id=${id}::uuid`;
    return Number(reply.id);
  }));
}
