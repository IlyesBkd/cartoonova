import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { updateOrderFinalImage, markFinalImageSent, setOrderLastOutboundMessageId } from "@/lib/db";
import { getLangFromCountry, finalImageEmail } from "@/lib/email-i18n";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { EXPEDITEUR, SUPPORT_EMAIL } from "@/lib/expediteur";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const { orderId, customerEmail, customerName, finalImageUrl, orderRef, saveOnly, detectedCountry } = await req.json();

    if (!orderId || !finalImageUrl) {
      return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
    }

    // 1. Save final image URL to DB
    await updateOrderFinalImage(orderId, finalImageUrl);

    // If saveOnly, just persist the URL and return
    if (saveOnly) {
      return NextResponse.json({ ok: true, saved: true });
    }

    if (!customerEmail) {
      return NextResponse.json({ error: "Email client manquant." }, { status: 400 });
    }

    // 2. Send email via Resend (language based on detected country)
    const lang = getLangFromCountry(detectedCountry);
    const t = finalImageEmail[lang];
    const ref = (orderRef || orderId).slice(0, 8);

    const result = await resend.emails.send({
      from: EXPEDITEUR,
      to: [customerEmail],
      replyTo: SUPPORT_EMAIL,
      subject: t.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef3c7; padding: 20px; border: 4px solid #000;">
          <div style="background: white; border: 3px solid #000; padding: 30px; margin: 20px 0; box-shadow: 8px 8px 0px rgba(0,0,0,1);">
            <h1 style="font-size: 32px; font-weight: 900; text-align: center; margin: 0 0 20px 0; color: #000; text-transform: uppercase;">
              ${t.title}
            </h1>
            <p style="font-size: 16px; text-align: center; margin: 0 0 30px 0; color: #000;">
              ${t.greeting(customerName)}
            </p>
            <p style="font-size: 16px; text-align: center; margin: 0 0 20px 0; color: #555;">
              ${t.ready(ref)}
            </p>
            <div style="text-align: center; margin: 20px 0;">
              <img src="${finalImageUrl}" alt="Cartoonova" style="max-width: 100%; border: 3px solid #000; border-radius: 12px; box-shadow: 6px 6px 0px rgba(0,0,0,1);" />
            </div>
            <p style="font-size: 20px; font-weight: 900; text-align: center; margin: 24px 0 0 0; color: #000;">
              ${t.question}
            </p>
            <div style="text-align: center; margin: 24px 0 30px 0;">
              <a href="${finalImageUrl}" target="_blank" style="display: inline-block; background: #facc15; color: #000; font-weight: 900; text-transform: uppercase; padding: 14px 32px; border: 3px solid #000; border-radius: 12px; text-decoration: none; font-size: 14px; box-shadow: 4px 4px 0px rgba(0,0,0,1);">
                ${t.download}
              </a>
            </div>
            <!-- L'invitation a la retouche etait en gris, 14px, sous le bouton :
                 la place qu'on donne aux mentions legales. Elle porte pourtant la
                 promesse vendue sur toutes les fiches. Elle a desormais son
                 encadre, dans le jaune de la marque. -->
            <div style="background: #fef3c7; border: 3px solid #000; border-radius: 12px; padding: 18px 20px; margin-top: 10px;">
              <p style="font-size: 15px; line-height: 1.55; text-align: center; color: #000; margin: 0;">
                ${t.feedback}
              </p>
            </div>
          </div>
          <div style="text-align: center; font-size: 14px; color: #000; font-weight: bold;">
            <p>${t.thanks}</p>
            <p>${t.team}</p>
          </div>
        </div>
      `,
    });

    console.log("[SEND-FINAL-IMAGE] Email envoyé:", JSON.stringify(result));

    if (result.data?.id) {
      await setOrderLastOutboundMessageId(orderId, result.data.id);
    }

    // 3. Mark as sent in DB
    await markFinalImageSent(orderId);

    return NextResponse.json({ ok: true, emailResult: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/orders/send-final-image] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
