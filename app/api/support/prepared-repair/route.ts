import { NextResponse } from "next/server";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { readPreparedSupportReply } from "@/lib/supportPreparedReplies";
import { reconcilePreparedSupportReply } from "@/lib/supportPreparedDelivery";
import { recoverUncertainSupportReply } from "@/lib/supportProviderRecovery";

/** Repair can read provider proof but never sends an email. */
export async function POST(request: Request) {
  const refusal = await refuserSiPasAdmin(request);
  if (refusal) return refusal;
  try {
    const { id, approvalFingerprint, providerId } = await request.json();
    if (typeof id !== "string" || typeof approvalFingerprint !== "string") throw new Error("Requête invalide.");
    const draft = await readPreparedSupportReply(id);
    if (!draft || draft.approvalFingerprint !== approvalFingerprint) throw new Error("Envoi non confirmé.");
    const replyId = draft.status === "sent" ? await reconcilePreparedSupportReply(id)
      : typeof providerId === "string" ? await recoverUncertainSupportReply(id, approvalFingerprint, providerId)
      : (() => { throw new Error("Preuve fournisseur requise."); })();
    return NextResponse.json({ ok: true, replyId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Réparation impossible : vérifie le statut avant tout renvoi." }, { status: 409, headers: { "Cache-Control": "private, no-store" } }); }
}
