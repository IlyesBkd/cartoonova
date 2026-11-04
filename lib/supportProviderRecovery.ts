import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { readPreparedSupportReply } from "@/lib/supportPreparedReplies";
import { reconcilePreparedSupportReply } from "@/lib/supportPreparedDelivery";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Verify an already accepted Resend email, then repair history without sending. */
export async function recoverUncertainSupportReply(id: string, fingerprint: string, providerId: string, request: typeof fetch = fetch) {
  if (!uuid.test(id) || !uuid.test(providerId) || !process.env.RESEND_API_KEY) throw new Error("Preuve fournisseur indisponible.");
  const draft = await readPreparedSupportReply(id);
  if (!draft || !draft.transport || !["sending", "uncertain"].includes(draft.status) || draft.approvalFingerprint !== fingerprint) throw new Error("Brouillon non récupérable.");
  const base = `https://api.resend.com/emails/${providerId}`;
  const headers = { Authorization: `Bearer ${process.env.RESEND_API_KEY}` };
  const get = async (url: string) => {
    const response = await request(url, { headers, redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Preuve fournisseur indisponible.");
    return response.json();
  };
  const sent = await get(base);
  if (typeof sent.created_at !== "string" || !Number.isFinite(Date.parse(sent.created_at))) throw new Error("Date fournisseur indisponible.");
  if (sent.id !== providerId || sent.from !== draft.transport.from || sent.subject !== draft.subject || sent.html !== draft.transport.html || sent.text !== draft.body ||
      !Array.isArray(sent.to) || sent.to.length !== 1 || sent.to[0] !== draft.toEmail ||
      !Array.isArray(sent.reply_to) || sent.reply_to.length !== 1 || sent.reply_to[0] !== draft.transport.replyTo ||
      !Array.isArray(sent.tags) || !sent.tags.some((tag: { name: string; value: string }) => tag.name === "support_draft" && tag.value === id) ||
      (sent.cc && sent.cc.length) || (sent.bcc && sent.bcc.length)) throw new Error("Preuve fournisseur différente du brouillon.");
  // Resend's retrieval contract does not establish that omitted headers are absent.
  // Therefore drafts without both approved values cannot currently be recovered here.
  const approved = draft.transport.headers;
  if (!approved || typeof approved["In-Reply-To"] !== "string" || typeof approved.References !== "string" ||
      !sent.headers || typeof sent.headers !== "object" || Array.isArray(sent.headers) ||
      sent.headers["In-Reply-To"] !== approved["In-Reply-To"] || sent.headers.References !== approved.References) {
    throw new Error("Preuve des en-têtes fournisseur indisponible ou différente.");
  }
  const list = await get(`${base}/attachments?limit=100`);
  if (list.has_more !== false || !Array.isArray(list.data) || list.data.length !== draft.attachments.length) throw new Error("Pièces fournisseur différentes du brouillon.");
  const remaining = [...draft.attachments];
  for (const attachment of list.data) {
    const index = remaining.findIndex(f => f.name === attachment.filename && f.contentType === attachment.content_type && f.bytes.length === attachment.size);
    if (index < 0 || typeof attachment.download_url !== "string") throw new Error("Pièce fournisseur différente.");
    const url = new URL(attachment.download_url);
    if (url.protocol !== "https:" || url.hostname !== "outbound-cdn.resend.com" || url.username || url.password || url.port) throw new Error("Adresse de pièce fournisseur invalide.");
    const response = await request(url.toString(), { redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!response.ok || !response.body) throw new Error("Pièce fournisseur inaccessible.");
    const reader = response.body.getReader(); let size = 0; const hash = createHash("sha256");
    for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new Error("Pièce fournisseur trop volumineuse."); } hash.update(part.value); }
    const [expected] = remaining.splice(index, 1);
    if (size !== expected.bytes.length || hash.digest("hex") !== createHash("sha256").update(expected.bytes).digest("hex")) throw new Error("Pièce fournisseur différente.");
  }
  const rows = await sql`UPDATE support_prepared_replies SET status='sent',provider_id=${providerId},provider_sent_at=${sent.created_at}::timestamptz,resolved_at=clock_timestamp()
    WHERE id=${id}::uuid AND status IN ('sending','uncertain') AND approval_hash=${fingerprint} AND approved_at IS NOT NULL RETURNING id`;
  if (!rows.length) throw new Error("Le statut a changé pendant la vérification.");
  return reconcilePreparedSupportReply(id);
}
