import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import Stripe from "stripe";
import {
  getOrdersDueForReviewRequest,
  getOrdersDueForReorderEmail,
  getOrdersDueForAbandonedEmail,
  getSubscribersDueForWelcome,
  markReviewRequestSent,
  markReorderEmailSent,
  markAbandonedEmailSent,
  type LifecycleOrder,
} from "@/lib/db";
import { sendWelcomeStep, WELCOME_DELAYS_DAYS } from "@/lib/welcomeSequence";
import {
  getLangFromCountry,
  reviewRequestEmail,
  reorderEmail,
  abandonedCartEmail,
} from "@/lib/email-i18n";
import { signEmail, orderTrackingToken } from "@/lib/emailToken";
import { SITE_URL } from "@/lib/site";

const resend = new Resend(process.env.RESEND_API_KEY!);

// Delai apres l'envoi de l'illustration finale. La demande d'avis attend que
// l'impression soit arrivee (2j de dessin + 3j ouvres de fabrication/envoi).
const REVIEW_REQUEST_DELAY_DAYS = 10;
const REORDER_DELAY_DAYS = 90;

// Relance des paniers abandonnes. 4 h laisse le temps a un paiement en cours
// (authentification bancaire, hesitation) de se terminer sans qu'on s'en mele ;
// au-dela de 14 jours le contexte d'achat a disparu et la relance derange.
const ABANDONED_DELAY_HOURS = 4;
const ABANDONED_MAX_DAYS = 14;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

// Filet de securite : un bug de requete ne doit pas pouvoir declencher un envoi
// de masse a toute la base en une seule execution.
const MAX_PER_RUN = 25;

const SUPPORT_EMAIL = "support@cartoonova.com";

function shell(inner: string, footer: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef3c7; padding: 20px; border: 4px solid #000;">
      <div style="background: white; border: 3px solid #000; padding: 30px; margin: 20px 0; box-shadow: 8px 8px 0px rgba(0,0,0,1);">
        ${inner}
      </div>
      <div style="text-align: center; font-size: 12px; color: #444;">
        ${footer}
      </div>
    </div>
  `;
}

function button(href: string, label: string) {
  return `
    <div style="text-align: center; margin: 28px 0 8px;">
      <a href="${href}" style="display: inline-block; background: #facc15; color: #000; font-weight: 900; text-transform: uppercase; padding: 14px 32px; border: 3px solid #000; border-radius: 12px; text-decoration: none; font-size: 14px; box-shadow: 4px 4px 0px rgba(0,0,0,1);">
        ${label}
      </a>
    </div>
  `;
}

async function sendReviewRequests(): Promise<{ sent: number; failed: number }> {
  const orders = (await getOrdersDueForReviewRequest(REVIEW_REQUEST_DELAY_DAYS)).slice(0, MAX_PER_RUN);
  let sent = 0;
  let failed = 0;

  for (const order of orders) {
    const lang = getLangFromCountry(order.detected_country);
    const t = reviewRequestEmail[lang];

    try {
      await resend.emails.send({
        from: "Cartoonova <noreply@cartoonova.com>",
        to: [order.customer_email],
        replyTo: SUPPORT_EMAIL,
        subject: t.subject,
        html: shell(
          `
            <h1 style="font-size: 26px; font-weight: 900; text-align: center; margin: 0 0 20px; color: #000;">${t.title}</h1>
            <p style="font-size: 16px; margin: 0 0 16px; color: #000;">${t.greeting(order.customer_name)}</p>
            <p style="font-size: 16px; margin: 0 0 16px; color: #333;">${t.body}</p>
            <p style="font-size: 16px; margin: 0; color: #333;">${t.ask}</p>
            ${button(`${SITE_URL}/${lang}/avis/nouveau?c=${orderTrackingToken(order.id)}`, t.cta)}
          `,
          `<p style="font-weight: bold; color: #000;">${t.thanks}</p><p>${t.team}</p>`
        ),
      });

      await markReviewRequestSent(order.id);
      sent++;
    } catch (error: unknown) {
      failed++;
      console.error(
        "[CRON lifecycle-emails] review request failed",
        order.id,
        error instanceof Error ? error.message : error
      );
    }
  }

  return { sent, failed };
}

async function sendReorderEmails(): Promise<{ sent: number; failed: number }> {
  const orders = (await getOrdersDueForReorderEmail(REORDER_DELAY_DAYS)).slice(0, MAX_PER_RUN);
  let sent = 0;
  let failed = 0;

  for (const order of orders as LifecycleOrder[]) {
    const lang = getLangFromCountry(order.detected_country);
    const t = reorderEmail[lang];
    const unsubscribeUrl =
      `${SITE_URL}/api/newsletter/unsubscribe` +
      `?email=${encodeURIComponent(order.customer_email)}` +
      `&t=${signEmail(order.customer_email)}&lang=${lang}`;

    try {
      await resend.emails.send({
        from: "Cartoonova <noreply@cartoonova.com>",
        to: [order.customer_email],
        replyTo: SUPPORT_EMAIL,
        subject: t.subject,
        headers: {
          // Permet la desinscription en un clic depuis Gmail/Outlook.
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        html: shell(
          `
            <h1 style="font-size: 26px; font-weight: 900; text-align: center; margin: 0 0 20px; color: #000;">${t.title}</h1>
            <p style="font-size: 16px; margin: 0 0 16px; color: #000;">${t.greeting(order.customer_name)}</p>
            <p style="font-size: 16px; margin: 0; color: #333;">${t.body}</p>
            ${button(`${SITE_URL}/${lang}/collections`, t.cta)}
          `,
          `<p style="font-weight: bold; color: #000;">${t.thanks}</p><p>${t.team}</p>
           <p style="margin-top: 12px;"><a href="${unsubscribeUrl}" style="color: #444;">${t.unsubscribe}</a></p>`
        ),
      });

      await markReorderEmailSent(order.customer_email);
      sent++;
    } catch (error: unknown) {
      failed++;
      console.error(
        "[CRON lifecycle-emails] reorder email failed",
        order.id,
        error instanceof Error ? error.message : error
      );
    }
  }

  return { sent, failed };
}

/**
 * Relance des commandes restees en PENDING.
 *
 * Avant d'ecrire, on demande a Stripe l'etat reel du paiement. Une commande peut
 * etre PENDING alors que le client a bel et bien paye : le passage a PAID
 * n'intervient qu'au chargement de la page de remerciement, et un onglet ferme
 * trop tot suffit a le manquer. Envoyer « vous avez oublie quelque chose » a
 * quelqu'un qui a paye serait pire que de ne rien envoyer.
 *
 * Ces cas sont comptes et journalises : ils revelent des commandes payees que
 * personne n'a vues passer.
 */
async function sendAbandonedCartEmails(): Promise<{
  sent: number;
  failed: number;
  payeesNonEnregistrees: number;
}> {
  const orders = (
    await getOrdersDueForAbandonedEmail(ABANDONED_DELAY_HOURS, ABANDONED_MAX_DAYS)
  ).slice(0, MAX_PER_RUN);

  let sent = 0;
  let failed = 0;
  let payeesNonEnregistrees = 0;

  for (const order of orders) {
    const lang = getLangFromCountry(order.detected_country);
    const t = abandonedCartEmail[lang];

    try {
      // Verite cote Stripe avant toute chose.
      const pi = await stripe.paymentIntents.retrieve(order.payment_intent_id);
      if (pi.status === "succeeded") {
        payeesNonEnregistrees++;
        console.error(
          "[CRON lifecycle-emails] commande PAYEE mais restee PENDING —",
          "à rattraper à la main:",
          order.id,
          order.payment_intent_id
        );
        // Marquee comme relancee pour ne pas la reexaminer a chaque passage.
        await markAbandonedEmailSent(order.id);
        continue;
      }

      const style = order.options?.style;
      const reprise = style ? `${SITE_URL}/${lang}/${style}` : `${SITE_URL}/${lang}/collections`;
      const unsubscribeUrl =
        `${SITE_URL}/api/newsletter/unsubscribe` +
        `?email=${encodeURIComponent(order.customer_email)}` +
        `&t=${signEmail(order.customer_email)}&lang=${lang}`;

      await resend.emails.send({
        from: "Cartoonova <noreply@cartoonova.com>",
        to: [order.customer_email],
        replyTo: SUPPORT_EMAIL,
        subject: t.subject,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        html: shell(
          `
            <h1 style="font-size: 26px; font-weight: 900; text-align: center; margin: 0 0 20px; color: #000;">${t.title}</h1>
            <p style="font-size: 16px; margin: 0 0 16px; color: #000;">${t.greeting(order.customer_name)}</p>
            <p style="font-size: 16px; margin: 0 0 16px; color: #333;">${t.body}</p>
            <p style="font-size: 16px; margin: 0; color: #333;">${t.kept}</p>
            ${button(reprise, t.cta)}
            <p style="font-size: 14px; margin: 20px 0 0; color: #555;">${t.help}</p>
          `,
          `<p style="font-weight: bold; color: #000;">${t.thanks}</p><p>${t.team}</p>
           <p style="margin-top: 12px;"><a href="${unsubscribeUrl}" style="color: #444;">${t.unsubscribe}</a></p>`
        ),
      });

      await markAbandonedEmailSent(order.id);
      sent++;
    } catch (error: unknown) {
      failed++;
      console.error(
        "[CRON lifecycle-emails] abandoned cart email failed",
        order.id,
        error instanceof Error ? error.message : error
      );
    }
  }

  return { sent, failed, payeesNonEnregistrees };
}

async function sendWelcomeSteps(): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // L'etape 1 part a l'inscription (app/api/newsletter/route.ts) ; ici on ne
  // traite que les suivantes.
  for (const step of [2, 3] as const) {
    const due = (await getSubscribersDueForWelcome(step, WELCOME_DELAYS_DAYS[step])).slice(
      0,
      MAX_PER_RUN
    );

    for (const subscriber of due) {
      try {
        await sendWelcomeStep(subscriber, step);
        sent++;
      } catch (error: unknown) {
        failed++;
        console.error(
          "[CRON lifecycle-emails] welcome step failed",
          step,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  return { sent, failed };
}

export async function GET(req: NextRequest) {
  // Sans CRON_SECRET configure, la comparaison ci-dessous laisserait passer un
  // header "Bearer undefined" : on refuse explicitement plutot que d'ouvrir la
  // route qui envoie des emails.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[CRON lifecycle-emails] CRON_SECRET manquant");
    return NextResponse.json({ error: "Non configuré." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const welcome = await sendWelcomeSteps();
    const reviewRequests = await sendReviewRequests();
    const reorders = await sendReorderEmails();
    const abandoned = await sendAbandonedCartEmails();
    const result = { welcome, reviewRequests, reorders, abandoned };
    console.log("[CRON lifecycle-emails]", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[CRON lifecycle-emails] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
