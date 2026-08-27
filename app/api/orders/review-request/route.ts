import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getOrderById, markReviewRequestSent } from "@/lib/db";
import { getLangFromCountry, reviewRequestEmail } from "@/lib/email-i18n";
import { orderTrackingToken } from "@/lib/emailToken";
import { avisExistePourCommande } from "@/lib/reviewsDb";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { SITE_URL } from "@/lib/site";

/**
 * Demande d'avis envoyee a la main depuis le tableau de bord.
 *
 * Le cron sait deja le faire, mais sous trois conditions : l'image finale doit
 * avoir ete envoyee, dix jours doivent s'etre ecoules, et la commande ne doit
 * jamais avoir ete relancee. C'est la bonne regle pour un flux automatique et
 * la mauvaise pour amorcer.
 *
 * Or il n'y a aujourd'hui aucun avis, donc pas d'etoiles, donc pas de
 * `aggregateRating` sur les 36 fiches ni sur les resultats de recherche — et
 * un assistant qui arbitre entre trois marchands s'appuie massivement sur la
 * reputation. La boucle ne peut pas s'amorcer seule avec un client : il faut
 * pouvoir solliciter au moment choisi, portrait par portrait.
 *
 * Ce que la route ne fait PAS : creer un avis. Elle envoie une invitation vers
 * `/avis/nouveau`, ou le client ecrit ce qu'il veut. Le lien est signe et porte
 * l'identifiant de commande — c'est ce qui rend l'avis verifiable, et c'est
 * exactement ce qui distingue un avis d'un temoignage inventé.
 */
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: "orderId manquant." }, { status: 400 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }
    if (!order.customer_email) {
      return NextResponse.json({ error: "Commande sans adresse e-mail." }, { status: 400 });
    }

    /* Un client qui a deja depose son avis ne doit pas etre relance : c'est le
       genre de courrier qui transforme une bonne volonte en agacement. */
    if (await avisExistePourCommande(orderId).catch(() => false)) {
      return NextResponse.json({ error: "Cette commande a deja un avis." }, { status: 409 });
    }

    const lang = getLangFromCountry(order.detected_country);
    const t = reviewRequestEmail[lang];
    const lien = `${SITE_URL}/${lang}/avis/nouveau?c=${orderTrackingToken(order.id)}`;

    await resend.emails.send({
      from: "Cartoonova <noreply@cartoonova.com>",
      to: [order.customer_email],
      replyTo: "support@cartoonova.com",
      subject: t.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef3c7; padding: 20px; border: 4px solid #000;">
          <div style="background: white; border: 3px solid #000; padding: 30px;">
            <h1 style="font-size: 26px; font-weight: 900; text-align: center; margin: 0 0 20px; color: #000;">${t.title}</h1>
            <p style="font-size: 16px; margin: 0 0 16px; color: #000;">${t.greeting(order.customer_name)}</p>
            <p style="font-size: 16px; margin: 0 0 16px; color: #333;">${t.body}</p>
            <p style="font-size: 16px; margin: 0 0 24px; color: #333;">${t.ask}</p>
            <div style="text-align: center;">
              <a href="${lien}" style="display: inline-block; background: #facc15; color: #000; font-weight: 900; text-transform: uppercase; padding: 14px 32px; border: 3px solid #000; border-radius: 12px; text-decoration: none; font-size: 14px; box-shadow: 4px 4px 0px rgba(0,0,0,1);">${t.cta}</a>
            </div>
          </div>
          <div style="text-align: center; font-size: 14px; color: #000; font-weight: bold; margin-top: 16px;">
            <p>${t.thanks}</p>
            <p>${t.team}</p>
          </div>
        </div>
      `,
    });

    /* Marque la commande pour que le cron ne repasse pas derriere : sans ca,
       un envoi manuel serait suivi d'un envoi automatique dix jours plus tard. */
    await markReviewRequestSent(order.id).catch((e) =>
      console.error("[review-request] marquage impossible:", e)
    );

    return NextResponse.json({ ok: true, lang, email: order.customer_email });
  } catch (erreur) {
    console.error("[review-request] échec:", erreur);
    return NextResponse.json({ error: "Envoi impossible." }, { status: 500 });
  }
}
