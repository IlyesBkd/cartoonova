import { emailLayout, emailParagraph, emailButton, emailNotice, emailImage, escapeEmailHtml } from "@/lib/emailTemplate";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getOrderById, setPosterConfirmationToken, recordPosterConfirmationMessage, setOrderLastOutboundMessageId } from "@/lib/db";
import { langueCommande, posterConfirmationEmail } from "@/lib/email-i18n";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { EXPEDITEUR, SUPPORT_EMAIL } from "@/lib/expediteur";
import { envoyerEmail } from "@/lib/envoiEmail";
import { downloadFinalImage, FinalImageError } from "@/lib/finalImage";

export async function POST(req: NextRequest) {
  const refus = await refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const { orderId, customerEmail, finalImageUrl } = await req.json();

    if (!orderId || !finalImageUrl || !customerEmail) {
      return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
    }

    const commande = await getOrderById(orderId);
    if (!commande) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    if (customerEmail !== commande.customer_email || finalImageUrl !== commande.final_image_url) {
      return NextResponse.json({ error: "Destinataire différent de la commande enregistrée." }, { status: 409 });
    }
    const image = await downloadFinalImage(finalImageUrl);
    const extension = image.contentType === "image/jpeg" ? "jpg" : image.contentType.split("/")[1];
    const token = randomBytes(24).toString("hex");
    if (!await setPosterConfirmationToken(orderId, token, commande.final_image_url!, commande.customer_email)) {
      return NextResponse.json({ error: "La commande a changé. Rechargez-la avant l'envoi." }, { status: 409 });
    }

    const lang = langueCommande(commande);
    const t = posterConfirmationEmail[lang];
    const ref = commande.id.slice(0, 8);
    const confirmUrl = `${new URL(req.url).origin}/confirm-poster/${token}`;

    const result = await envoyerEmail({
      from: EXPEDITEUR,
      to: [commande.customer_email],
      replyTo: SUPPORT_EMAIL,
      subject: t.subject,
      attachments: [
        {
          filename: `cartoonova-${ref}.${extension}`,
          content: Buffer.from(image.bytes).toString("base64"),
          contentType: image.contentType,
        },
      ],
      html: emailLayout({
        lang,
        title: t.title,
        bodyHtml: emailParagraph(t.greeting(commande.customer_name))
          // Only the translation contains markup; never the interpolated reference.
          + `<p style="margin:0 0 16px;line-height:1.6;">${t.intro(escapeEmailHtml(ref))}</p>`
          + emailImage(finalImageUrl, "Cartoonova poster")
          + emailParagraph(t.attachmentNote)
          + emailButton(t.cta, confirmUrl)
          // Keep the revision invitation before the printing reassurance.
          + emailNotice(t.modification)
          + emailParagraph(t.reassurance),
        footerHtml: emailParagraph(t.thanks) + emailParagraph(t.team),
      }),
    });

    if (result.error) throw new Error("Envoi du portrait refusé.");

    if (result.data?.id) {
      await recordPosterConfirmationMessage(orderId, token, result.data.id);
      await setOrderLastOutboundMessageId(orderId, result.data.id);
    }

    return NextResponse.json({ ok: true, emailResult: result });
  } catch (error: unknown) {
    const message = error instanceof FinalImageError ? error.message : "Envoi du portrait impossible.";
    console.error("[SEND-POSTER-CONFIRMATION] Échec de livraison.");
    return NextResponse.json({ error: message }, { status: error instanceof FinalImageError ? error.status : 500 });
  }
}
