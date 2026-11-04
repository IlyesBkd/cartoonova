import { createHash, randomUUID } from "node:crypto";
import { sql, withFreshDatabaseClient } from "@/lib/db";
import { EXPEDITEUR, SUPPORT_EMAIL } from "@/lib/expediteur";
import { emailLayout, emailParagraph } from "@/lib/emailTemplate";
import type { Lang } from "@/lib/email-i18n";

type Transport = { from: string; replyTo: string; html: string; headers: Record<string, string> | null };

interface Attachment { name: string; contentType: string; bytes: Buffer }
interface DraftInput {
  targetType: "message" | "order";
  targetId: string;
  frozenOrderId?: string | null;
  toEmail: string;
  subject: string;
  body: string;
  assisteeIa?: boolean;
  attachments: Attachment[];
  transport?: Transport;
  language?: Lang;
  reference?: string | null;
}
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const fingerprint = (input: DraftInput) => hash(Buffer.from(JSON.stringify([
  input.targetType, input.targetId, input.frozenOrderId ?? null, input.toEmail, input.subject, input.body, Boolean(input.assisteeIa),
  [input.transport?.from, input.transport?.replyTo, input.transport?.html, input.transport?.headers?.['In-Reply-To'], input.transport?.headers?.References],
  input.attachments.map(file => [file.name, file.contentType, hash(file.bytes)]),
])));

/** Save the exact message and files atomically, without contacting any provider. */
export async function prepareSupportReply(input: DraftInput): Promise<string> {
  if (!["message", "order"].includes(input.targetType) || typeof input.targetId !== "string" || !input.targetId.trim() ||
      typeof input.toEmail !== "string" || !input.toEmail.trim() || typeof input.subject !== "string" || !input.subject.trim() ||
      typeof input.body !== "string" || !input.body.trim() || !Array.isArray(input.attachments) || input.attachments.length > 3) {
    throw new Error("Brouillon invalide.");
  }
  let total = 0;
  for (const file of input.attachments) {
    if (typeof file.name !== "string" || !file.name.trim() || file.name.length > 180 || /[\x00-\x1f\x7f/\\]/.test(file.name) ||
        typeof file.contentType !== "string" || file.contentType.length > 100 || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(file.contentType) ||
        !Buffer.isBuffer(file.bytes) || file.bytes.length < 1 || file.bytes.length > 2 * 1024 * 1024) throw new Error("Pièce jointe invalide.");
    total += file.bytes.length;
  }
  if (total > 4 * 1024 * 1024) throw new Error("Pièces jointes trop volumineuses.");
  const ref = input.reference || null;
  const transport: Transport = {
    from: EXPEDITEUR, replyTo: SUPPORT_EMAIL,
    html: emailLayout({ lang: input.language || "en", title: input.subject, bodyHtml: emailParagraph(input.body) }),
    headers: ref ? { "In-Reply-To": ref, References: ref } : null,
  };
  const id = randomUUID();
  await withFreshDatabaseClient(db => db.begin(async tx => {
    await tx`SET LOCAL lock_timeout = '3s'`;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended('support-send:global',0))`;
    const targetId = input.targetType === "order" ? input.targetId.toLowerCase() : input.targetId;
    const [identity] = input.targetType === "message"
      ? await tx`SELECT order_id::text AS order_id FROM support_messages WHERE id=${Number(targetId)} FOR NO KEY UPDATE`
      : await tx`SELECT id::text AS order_id FROM orders WHERE id=${targetId}::uuid FOR NO KEY UPDATE`;
    if (!identity) throw new Error("Conversation introuvable.");
    const frozenOrderId = (identity.order_id as string | null) ?? null;
    const frozen = { ...input, targetId, frozenOrderId, transport };
    await tx`INSERT INTO support_prepared_replies(id,target_type,target_id,frozen_order_id,to_email,subject,body_text,assistee_ia,transport,approval_hash,created_at)
      VALUES(${id}::uuid,${input.targetType},${targetId},${frozenOrderId}::uuid,${input.toEmail},${input.subject},${input.body},${Boolean(input.assisteeIa)},${tx.json(transport)}::jsonb,${fingerprint(frozen)},clock_timestamp())`;
    for (const [position, file] of input.attachments.entries()) {
      await tx`INSERT INTO support_prepared_attachments(id,draft_id,position,filename,content_type,content,sha256)
        VALUES(${randomUUID()}::uuid,${id}::uuid,${position},${file.name},${file.contentType},${file.bytes},${hash(file.bytes)})`;
    }
  }));
  return id;
}

/** Never return or send an attachment whose bytes no longer match its digest. */
export async function readPreparedSupportReply(id: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) return null;
  const [row] = await sql`SELECT * FROM support_prepared_replies WHERE id=${id}::uuid`;
  if (!row) return null;
  const files = await sql`SELECT filename,content_type,content,sha256 FROM support_prepared_attachments WHERE draft_id=${id}::uuid ORDER BY position`;
  const attachments = files.map(file => {
    const bytes = Buffer.from(file.content as Buffer);
    if (hash(bytes) !== file.sha256) throw new Error("Pièce jointe corrompue.");
    return { name: file.filename as string, contentType: file.content_type as string, bytes };
  });
  const draft: DraftInput = { targetType: row.target_type as "message" | "order", targetId: row.target_id as string, frozenOrderId: row.frozen_order_id as string | null, toEmail: row.to_email as string,
    subject: row.subject as string, body: row.body_text as string, assisteeIa: Boolean(row.assistee_ia), attachments, transport: row.transport as Transport };
  if (fingerprint(draft) !== row.approval_hash) throw new Error("Brouillon modifié ou corrompu.");
  return { id, ...draft, status: row.status as string, approvalFingerprint: row.approval_hash as string };
}
