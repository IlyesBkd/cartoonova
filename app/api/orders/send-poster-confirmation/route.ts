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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef3c7; padding: 20px; border: 4px solid #000;">
          <div style="background: white; border: 3px solid #000; padding: 30px; margin: 20px 0; box-shadow: 8px 8px 0px rgba(0,0,0,1);">
            <h1 style="font-size: 32px; font-weight: 900; text-align: center; margin: 0 0 20px 0; color: #000; text-transform: uppercase;">
              ${t.title}
            </h1>
            <p style="font-size: 16px; text-align: center; margin: 0 0 20px 0; color: #000;">
              ${t.greeting(commande.customer_name)}
            </p>
            <p style="font-size: 16px; text-align: center; margin: 0 0 20px 0; color: #555;">
              ${t.intro(ref)}
            </p>
            <div style="text-align: center; margin: 20px 0;">
              <img src="${finalImageUrl}" alt="Cartoonova poster" style="max-width: 100%; border: 3px solid #000; border-radius: 12px; box-shadow: 6px 6px 0px rgba(0,0,0,1);" />
            </div>
            <p style="font-size: 13px; text-align: center; color: #555; margin: 0 0 20px 0;">
              ${t.attachmentNote}
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmUrl}" target="_blank" style="display: inline-block; background: #facc15; color: #000; font-weight: 900; text-transform: uppercase; padding: 14px 32px; border: 3px solid #000; border-radius: 12px; text-decoration: none; font-size: 14px; box-shadow: 4px 4px 0px rgba(0,0,0,1);">
                ${t.cta}
              </a>
            </div>
            <!-- Avant la phrase qui parle d'impression : un client qui veut une
                 retouche doit l'apprendre AVANT de lire « nous lançons
                 l'impression », sinon il croit que le seul chemin est oui. -->
            <p style="font-size: 14px; text-align: center; color: #333; margin: 0 0 14px 0; padding: 12px; background: #fef3c7; border: 2px solid #000; border-radius: 10px;">
              ${t.modification}
            </p>
            <p style="font-size: 14px; text-align: center; color: #555; margin-top: 0;">
              ${t.reassurance}
            </p>
          </div>
          <div style="text-align: center; font-size: 14px; color: #000; font-weight: bold;">
            <p>${t.thanks}</p>
            <p>${t.team}</p>
          </div>
        </div>
      `,
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
