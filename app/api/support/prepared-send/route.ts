import { NextRequest, NextResponse } from "next/server";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { envoyerEmail } from "@/lib/envoiEmail";
import { sendPreparedSupportReply } from "@/lib/supportPreparedDelivery";
import { readPreparedSupportReply } from "@/lib/supportPreparedReplies";

/** Called only after approval of the precise prepared message. */
export async function POST(request: NextRequest) {
  const refusal = await refuserSiPasAdmin(request);
  if (refusal) return refusal;
  let id = "";
  try {
    const input = await request.json();
    id = typeof input.id === "string" ? input.id : "";
    const fingerprint = typeof input.approvalFingerprint === "string" ? input.approvalFingerprint : "";
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id) || !/^[a-f0-9]{64}$/.test(fingerprint)) {
      return NextResponse.json({ error: "Approbation invalide." }, { status: 400 });
    }
    let payload: Parameters<typeof envoyerEmail>[0];
    const replyId = await sendPreparedSupportReply(id, fingerprint, async (_draft, idempotencyKey) => {
      const result = await envoyerEmail(payload, { idempotencyKey });
      if (!result.data?.id) throw new Error("Réponse fournisseur incertaine.");
      return { id: result.data.id };
    }, draft => {
      if (!draft.transport) throw new Error("Aperçu incomplet.");
      const {from,replyTo,html,headers} = draft.transport;
      payload = {
        from, to: [draft.toEmail], replyTo, subject: draft.subject, text: draft.body, html,
        tags: [{ name: "support_draft", value: draft.id }],
        attachments: draft.attachments.map(file => ({ filename: file.name, content: file.bytes, contentType: file.contentType })),
        ...(headers ? { headers: { "In-Reply-To": headers["In-Reply-To"], References: headers.References } } : {}),
      };
    });
    return NextResponse.json({ ok: true, replyId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    let state = "unknown";
    try { state = (await readPreparedSupportReply(id))?.status ?? state; } catch { /* Do not expose unverified content. */ }
    return NextResponse.json({ error: state === "sent" ? "Email accepté : l'historique doit être réparé sans renvoi." : state === "sending" || state === "uncertain" ? "Envoi incertain : vérification obligatoire, ne pas renvoyer." : "Envoi refusé : vérifiez l'aperçu et le destinataire.", state }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
  }
}
