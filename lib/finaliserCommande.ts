import { Resend } from "resend";
import { marquerPayee } from "@/lib/db";
import type { DbOrder } from "@/lib/db";
import { getLangFromCountry, confirmationEmail } from "@/lib/email-i18n";
import { orderTrackingToken } from "@/lib/emailToken";
import { SITE_URL } from "@/lib/site";
import { mesureServeur, personneServeur } from "@/lib/analyticsServeur";
import { MESURES } from "@/lib/evenementsMesure";
import { toEUR } from "@/lib/currency";
import { alerteDiscord, COULEUR_SOLEIL } from "@/lib/discord";

/**
 * Tout ce qui doit arriver une fois, et une seule, quand une commande est
 * payee : passage en PAID, e-mail au client, notification a l'equipe, mesure.
 *
 * Ce code vivait dans `app/success/page.tsx`. Il en sort parce qu'il a
 * desormais DEUX appelants : la page de remerciement et le webhook Stripe.
 * Le laisser dans la page aurait impose de le recopier, et deux copies d'une
 * sequence de notifications divergent toujours — c'est l'e-mail qu'on met a
 * jour d'un cote et pas de l'autre.
 *
 * La garantie d'unicite ne vient pas d'ici mais de `marquerPayee`, ou la
 * lecture et l'ecriture du statut sont une seule requete SQL. C'est
 * indispensable : Stripe emet `payment_intent.succeeded` a l'instant meme ou
 * il redirige le navigateur, donc les deux appelants courent l'un contre
 * l'autre a chaque commande.
 */

const resend = new Resend(process.env.RESEND_API_KEY!);

async function envoyerConfirmation(order: DbOrder): Promise<void> {
  try {
    const opts = order.options;
    const lang = getLangFromCountry(order.detected_country);
    const t = confirmationEmail[lang];
    const ref = order.id.slice(0, 8);

    await resend.emails.send({
      from: "Cartoonova <noreply@cartoonova.com>",
      to: [order.customer_email],
      replyTo: "support@cartoonova.com",
      subject: t.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef3c7; padding: 20px; border: 4px solid #000;">
          <div style="background: white; border: 3px solid #000; padding: 30px; margin: 20px 0; box-shadow: 8px 8px 0px rgba(0,0,0,1);">
            <h1 style="font-size: 32px; font-weight: 900; text-align: center; margin: 0 0 20px 0; color: #000; text-transform: uppercase;">
              ${t.title}
            </h1>
            <p style="font-size: 18px; font-weight: bold; text-align: center; margin: 0 0 30px 0; color: #000;">
              ${t.orderConfirmed(ref)}
            </p>
            <div style="background: #fef3c7; border: 2px solid #000; padding: 20px; margin: 20px 0;">
              <h2 style="font-size: 20px; font-weight: 900; margin: 0 0 15px 0; color: #000;">${t.summary}</h2>
              <ul style="font-size: 16px; font-weight: bold; margin: 0; padding: 0 0 0 20px; color: #000;">
                <li>${t.format}: ${opts.format === "portrait" ? "Portrait" : "Full Body"}</li>
                <li>${t.people}: ${opts.people}</li>
                ${opts.animals > 0 ? `<li>${t.animals}: ${opts.animals}</li>` : ""}
                <li>${t.option}: ${opts.printOption}</li>
                <li>${t.total}: ${order.total_price} ${order.currency}</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <p style="font-size: 18px; font-weight: bold; color: #000;">${t.artistsWorking}</p>
              <p style="font-size: 16px; color: #000;">${t.deliveryTime}</p>
            </div>
            <!-- Lien de suivi : sans lui, le client n'a aucun moyen de verifier
                 l'avancement et chaque question part au support. -->
            <div style="text-align: center; margin: 28px 0 8px;">
              <a href="${SITE_URL}/suivi/${orderTrackingToken(order.id)}" style="display: inline-block; background: #facc15; color: #000; font-weight: 900; text-transform: uppercase; padding: 14px 32px; border: 3px solid #000; border-radius: 12px; text-decoration: none; font-size: 14px; box-shadow: 4px 4px 0px rgba(0,0,0,1);">
                ${t.trackOrder}
              </a>
            </div>
          </div>
          <div style="text-align: center; font-size: 14px; color: #000; font-weight: bold;">
            <p>${t.thanks}</p>
            <p>${t.team}</p>
          </div>
        </div>
      `,
    });
  } catch (erreur) {
    /* Une commande payee ne se perd pas parce que Resend est en panne : on
       journalise et on laisse le reste se faire. */
    console.error("[finaliser] envoi de l'e-mail de confirmation impossible:", erreur);
  }
}

async function notifierEquipe(order: DbOrder): Promise<void> {
  const opts = order.options;

  await alerteDiscord({
    titre: "🎉 NOUVELLE COMMANDE REÇUE !",
    couleur: COULEUR_SOLEIL,
    champs: [
      { name: "📦 Numéro", value: order.id.slice(0, 8), inline: true },
      { name: "📧 Email", value: order.customer_email, inline: true },
      { name: "🎨 Format", value: opts.format, inline: true },
      {
        name: "👥 Personnes",
        value: opts.animals > 0 ? `${opts.people} + ${opts.animals} animaux` : String(opts.people),
        inline: true,
      },
      { name: "🖼️ Option", value: opts.printOption, inline: true },
      { name: "💰 Total", value: `${order.total_price} ${order.currency}`, inline: true },
      // Les consignes cadeau doivent sauter aux yeux : elles changent a qui et
      // quand le portrait doit partir.
      ...(opts.gift
        ? [
            {
              name: "🎁 Cadeau",
              value: [
                opts.gift.recipientEmail ? `Envoyer à : ${opts.gift.recipientEmail}` : null,
                opts.gift.deliverAfter ? `Pas avant le : ${opts.gift.deliverAfter}` : null,
                opts.gift.message ? `Message : ${opts.gift.message}` : null,
              ]
                .filter(Boolean)
                .join("\n"),
              inline: false,
            },
          ]
        : []),
    ],
    piedDePage: "Cartoonova • Paiement réussi",
  });
}

async function mesurerAchat(order: DbOrder, source: "webhook" | "page_succes"): Promise<void> {
  const opts = order.options;
  const montant = Number(order.total_price);

  await mesureServeur(MESURES.achatConfirme, {
    identifiant: order.customer_email,
    proprietes: {
      order_id: order.id,
      transaction_id: order.payment_intent_id,
      value: montant,
      currency: order.currency,
      /* Somme sur une base unique : neuf devises circulent, et les additionner
         telles quelles fausse le total. */
      revenue_eur: toEUR(montant, order.currency),
      $revenue: toEUR(montant, order.currency),
      style: opts.style ?? "unknown",
      format: opts.format ?? "unknown",
      people: opts.people ?? 1,
      animals: opts.animals ?? 0,
      print_option: opts.printOption ?? "unknown",
      is_gift: Boolean(opts.gift),
      promo_code: order.promo_code ?? null,
      discount_amount: order.discount_amount ?? null,
      detected_country: order.detected_country ?? null,
      /* Qui des deux a gagne la course. Utile a surveiller les premiers
         jours : si la page de succes gagne systematiquement, le webhook ne
         fonctionne pas et personne ne s'en apercevrait autrement. */
      source,
    },
  });

  await personneServeur(order.customer_email, {
    derniere_commande: new Date().toISOString(),
    dernier_style: opts.style ?? null,
    pays: order.detected_country ?? null,
    devise: order.currency,
  });
}

/**
 * Finalise la commande si elle ne l'est pas deja.
 *
 * Renvoie `true` si c'est cet appel qui l'a finalisee, `false` si un autre
 * l'avait deja fait. L'appelant n'a rien a verifier avant : la protection est
 * dans la requete SQL, pas dans une lecture prealable.
 */
export async function finaliserCommande(
  order: DbOrder,
  source: "webhook" | "page_succes"
): Promise<boolean> {
  const gagnant = await marquerPayee(order.id);
  if (!gagnant) return false;

  console.log(`[finaliser] commande ${order.id} finalisée par ${source}`);

  await Promise.all([
    envoyerConfirmation(order),
    notifierEquipe(order),
    /* Attendu explicitement : sur Vercel l'execution est coupee des que la
       reponse part, et un envoi non attendu est simplement perdu. */
    mesurerAchat(order, source),
  ]);

  return true;
}
