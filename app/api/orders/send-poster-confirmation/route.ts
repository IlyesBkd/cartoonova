import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import { setPosterConfirmationToken, setOrderLastOutboundMessageId } from "@/lib/db";
import { getLangFromCountry, posterConfirmationEmail } from "@/lib/email-i18n";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { EXPEDITEUR, SUPPORT_EMAIL } from "@/lib/expediteur";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const { orderId, customerEmail, customerName, finalImageUrl, orderRef, detectedCountry } = await req.json();

    if (!orderId || !finalImageUrl || !customerEmail) {
      return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
    }

    const token = randomBytes(24).toString("hex");
    await setPosterConfirmationToken(orderId, token);

    const lang = getLangFromCountry(detectedCountry);
    const t = posterConfirmationEmail[lang];
    const ref = (orderRef || orderId).slice(0, 8);
    const confirmUrl = `${new URL(req.url).origin}/confirm-poster/${token}`;

    const result = await resend.emails.send({
      from: EXPEDITEUR,
      to: [customerEmail],
      replyTo: SUPPORT_EMAIL,
      subject: t.subject,
      attachments: [
        {
          filename: `cartoonova-${ref}.jpg`,
          path: finalImageUrl,
        },
      ],
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef3c7; padding: 20px; border: 4px solid #000;">
          <div style="background: white; border: 3px solid #000; padding: 30px; margin: 20px 0; box-shadow: 8px 8px 0px rgba(0,0,0,1);">
            <h1 style="font-size: 32px; font-weight: 900; text-align: center; margin: 0 0 20px 0; color: #000; text-transform: uppercase;">
              ${t.title}
            </h1>
            <p style="font-size: 16px; text-align: center; margin: 0 0 20px 0; color: #000;">
              ${t.greeting(customerName)}
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

    console.log("[SEND-POSTER-CONFIRMATION] Email envoyé:", JSON.stringify(result));

    if (result.data?.id) {
      await setOrderLastOutboundMessageId(orderId, result.data.id);
    }

    return NextResponse.json({ ok: true, emailResult: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/orders/send-poster-confirmation] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
