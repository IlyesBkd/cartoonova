import { NextRequest, NextResponse } from "next/server";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { getOrderById, getSupportMessageById } from "@/lib/db";
import { emailValide } from "@/lib/email";
import { langueCommande } from "@/lib/email-i18n";
import { prepareSupportReply, readPreparedSupportReply } from "@/lib/supportPreparedReplies";

const MAX_REQUEST_BYTES = 4 * 1024 * 1024 + 128 * 1024;
function supportReference(rawRef: string | null | undefined) {
  const usable = rawRef && !rawRef.endsWith("@imap-fallback") && !/^chat-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(rawRef) && !/[\r\n]/.test(rawRef);
  return usable ? (rawRef.startsWith("<") ? rawRef : `<${rawRef}>`) : null;
}

/** Bound memory consumption even when Content-Length is omitted or dishonest. */
async function limitedForm(request: Request): Promise<FormData> {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("multipart/form-data;")) throw new Error("Format invalide.");
  if (Number(request.headers.get("content-length") || 0) > MAX_REQUEST_BYTES || !request.body) throw new Error("Fichiers trop volumineux.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new Error("Fichiers trop volumineux."); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { headers: { "Content-Type": type } }).formData();
}
function scalar(form: FormData, key: string): string {
  const entries = form.getAll(key);
  if (entries.length > 1 || (entries.length && typeof entries[0] !== "string")) throw new Error("Champ invalide.");
  return (entries[0] as string | undefined) ?? "";
}

/** Prepare only: this endpoint has no ability to send an email. */
export async function POST(request: NextRequest) {
  const refusal = await refuserSiPasAdmin(request);
  if (refusal) return refusal;
  try {
    const form = await limitedForm(request);
    const messageId = scalar(form, "messageId"), orderId = scalar(form, "orderId");
    const body = scalar(form, "body").trim(), requestedSubject = scalar(form, "subject").trim();
    if (Boolean(messageId) === Boolean(orderId) || !body || body.length > 100000 || requestedSubject.length > 500 || /[\r\n]/.test(requestedSubject)) {
      return NextResponse.json({ error: "Brouillon invalide." }, { status: 400 });
    }
    if ((messageId && (!/^[1-9][0-9]{0,9}$/.test(messageId) || !Number.isSafeInteger(Number(messageId)))) ||
        (orderId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(orderId))) {
      return NextResponse.json({ error: "Conversation invalide." }, { status: 400 });
    }
    const message = messageId ? await getSupportMessageById(Number(messageId)) : null;
    const order = orderId ? await getOrderById(orderId) : null;
    if ((messageId && !message) || (orderId && !order)) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
    const toEmail = message ? message.from_email : order?.customer_email;
    if (!toEmail || !emailValide(toEmail)) return NextResponse.json({ error: "Adresse destinataire invalide." }, { status: 422 });
    const originalSubject = (message?.subject || "").trim();
    if (/[\r\n]/.test(originalSubject) || originalSubject.length > 500) return NextResponse.json({ error: "Objet invalide." }, { status: 422 });
    const subject = message ? (!originalSubject ? "Re: ton message" : /^(re|ré|rép|rep|aw|antw|odp|sv|vs|r)\s*:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`)
      : requestedSubject || `Ta commande Cartoonova #${orderId.slice(0, 8)}`;
    const uploads = form.getAll("attachments");
    if (uploads.length > 3 || uploads.some(f => typeof f === "string" || f.size === 0 || f.size > 2 * 1024 * 1024)) {
      return NextResponse.json({ error: "Pièce jointe invalide." }, { status: 400 });
    }
    const attachments = await Promise.all((uploads as File[]).map(async file => ({ name: file.name, contentType: file.type || "application/octet-stream", bytes: Buffer.from(await file.arrayBuffer()) })));
    const relatedOrder = order || (message?.order_id ? await getOrderById(message.order_id) : null);
    const reference = supportReference(message?.message_id);
    const id = await prepareSupportReply({ targetType: message ? "message" : "order", targetId: messageId || orderId, toEmail, subject, body, assisteeIa: scalar(form, "assisteeIa") === "true", attachments, language: relatedOrder ? langueCommande(relatedOrder) : "en", reference });
    const draft = await readPreparedSupportReply(id);
    if (!draft) throw new Error("Brouillon introuvable après enregistrement.");
    return NextResponse.json({ draft: { ...draft, attachments: draft.attachments.map(file => ({ name: file.name, contentType: file.contentType, size: file.bytes.length })) } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Impossible de préparer la réponse." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
}
