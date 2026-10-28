import { diagnosticJournal } from "@/lib/confidentialiteMesure";
import { payerAvecConfirmation, drainerEmails, type EmailPayload } from "./emailOutbox";
import type { DbOrder } from "@/lib/db";
import { confirmationEmail, depotPhotosPage, optionsCommande, langueCommande } from "@/lib/email-i18n";
import { orderTrackingToken } from "@/lib/emailToken";
import { SITE_URL } from "@/lib/site";
import { mesureServeur, personneServeur } from "@/lib/analyticsServeur";
import { MESURES } from "@/lib/evenementsMesure";
import { toEUR } from "@/lib/currency";
import { alerteDiscord, COULEUR_SOLEIL, COULEUR_ATTENTION } from "@/lib/discord";
import { attendDesPhotos } from "@/lib/orderPhotos";
import { lireConsigne, pourDiscord } from "@/lib/consigneClient";
import { lienEmail } from "./utmEmail";
import { formatPrix } from "@/lib/i18n/relances";
import { recompenserParrain } from "./parrainage";
import { EXPEDITEUR, SUPPORT_EMAIL } from "./expediteur";
import { envoyerConversionChatgpt } from "@/lib/conversionsChatgpt";
import { OCCASION_FR, estOccasion } from "@/lib/occasions";
import { emailLayout, emailParagraph, emailButton, emailNotice, escapeEmailHtml } from "./emailTemplate";

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
 * La garantie d'unicite vient de `payerAvecConfirmation` : paiement et intent
 * d'e-mail sont une seule instruction SQL. L'envoi est repris independamment
 * de `paid_at`, par les appelants ou par le drain authentifie.
 * C'est indispensable : Stripe emet `payment_intent.succeeded` a l'instant meme ou
 * il redirige le navigateur, donc les deux appelants courent l'un contre
 * l'autre a chaque commande.
 */

function confirmationPayload(order: DbOrder): EmailPayload {
    const opts = order.options;
    const lang = langueCommande(order);
    const t = confirmationEmail[lang];
    const td = depotPhotosPage[lang];
    const oc = optionsCommande[lang];
    const ref = order.id.slice(0, 8);

    return {
      from: EXPEDITEUR,
      to: [order.customer_email],
      replyTo: SUPPORT_EMAIL,
      subject: t.subject,
      html: emailLayout({
        lang,
        title: t.title,
        bodyHtml: `
          ${emailParagraph(t.orderConfirmed(ref))}
          <h2 style="font-size:20px;line-height:1.4;color:#18181b;">${escapeEmailHtml(t.summary)}</h2>
          <ul style="font-size:16px;line-height:1.7;color:#3f3f46;padding-left:22px;">
            <li>${escapeEmailHtml(t.format)}: ${opts.format === "portrait" ? "Portrait" : "Full Body"}</li>
            <li>${escapeEmailHtml(t.people)}: ${escapeEmailHtml(String(opts.people))}</li>
            ${opts.animals > 0 ? `<li>${escapeEmailHtml(t.animals)}: ${escapeEmailHtml(String(opts.animals))}</li>` : ""}
            <li>${escapeEmailHtml(t.option)}: ${escapeEmailHtml(opts.printOption)}</li>
            ${opts.banner ? `<li>${escapeEmailHtml(oc.banner)}</li>` : ""}
            ${opts.extraDecor ? `<li>${escapeEmailHtml(oc.extraDecor)}</li>` : ""}
            ${opts.express ? `<li>⚡ ${escapeEmailHtml(oc.express)}</li>` : ""}
            ${opts.carteVoeux ? `<li>${escapeEmailHtml(oc.carteVoeux)}</li>` : ""}
            ${opts.calendrier ? `<li>${escapeEmailHtml(oc.calendrier)}</li>` : ""}
            ${opts.shippingAmount ? `<li>${escapeEmailHtml(oc.shipping)}: ${escapeEmailHtml(formatPrix(Number(opts.shippingAmount), order.currency, lang))}</li>` : ""}
            <li>${escapeEmailHtml(t.total)}: ${escapeEmailHtml(formatPrix(Number(order.total_price), order.currency, lang))}</li>
          </ul>
          ${emailParagraph(t.artistsWorking)}
          ${emailParagraph(opts.express ? oc.deliveryExpress : t.deliveryTime)}
          ${attendDesPhotos(order.photo_urls)
            ? emailNotice(td.emailRappel) + emailButton(td.submit, lienEmail(`${SITE_URL}/depot/${orderTrackingToken(order.id)}`, "depot_photos"))
            : ""}
          ${emailButton(t.trackOrder, lienEmail(`${SITE_URL}/suivi/${orderTrackingToken(order.id)}`, "suivi"))}
        `,
        footerHtml: emailParagraph(t.thanks) + emailParagraph(t.team),
      }),
    };
}

async function notifierEquipe(order: DbOrder): Promise<void> {
  const opts = order.options;

  /* La consigne ecrite par le client n'etait transmise nulle part — ni ici,
     ni dans le tableau de bord. L'illustrateur decouvrait donc la commande
     sans le seul texte que le client ait pris la peine d'ecrire, et une
     question posee au moment de commander ne remontait a personne. */
  const consigne = lireConsigne(opts.description);

  await alerteDiscord({
    /* La question passe dans le titre, pas dans un champ : c'est la seule
       partie du message qu'on lit sans deplier, et une question sans reponse
       est ce qui coute le plus cher a ce stade. */
    /* L'express passe en tete du titre : 24 h, week-end compris, c'est la
       commande a traiter avant toutes les autres. */
    titre:
      (opts.express ? "⚡ EXPRESS 24H — " : "") +
      (consigne.question
        ? "🎉 NOUVELLE COMMANDE — ❓ LE CLIENT POSE UNE QUESTION"
        : "🎉 NOUVELLE COMMANDE REÇUE !"),
    couleur: consigne.question || opts.express ? COULEUR_ATTENTION : COULEUR_SOLEIL,
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
      ...(opts.banner || opts.extraDecor || opts.express || opts.carteVoeux || opts.calendrier
        ? [
            {
              name: "➕ Options payées",
              value: [
                opts.express ? "⚡ Express 24 h (week-end compris)" : null,
                opts.banner ? "🎀 Banderole / texte (voir la consigne)" : null,
                opts.extraDecor ? `🏞️ Décor supplémentaire : ${opts.extraDecorKey ?? "?"}` : null,
                opts.carteVoeux ? "💌 Carte de vœux PDF (bouton dans l'admin, après le portrait final)" : null,
                opts.calendrier ? "📅 Calendrier 2027 PDF (bouton dans l'admin, après le portrait final)" : null,
              ]
                .filter(Boolean)
                .join("\n"),
              inline: false,
            },
          ]
        : []),
      /* La consigne en pleine largeur, juste apres la configuration : c'est
         le brief de l'illustrateur. */
      ...(consigne.texte
        ? [
            {
              name: consigne.question ? "❓ Consigne du client — CONTIENT UNE QUESTION" : "✏️ Consigne du client",
              value: pourDiscord(consigne.texte),
              inline: false,
            },
          ]
        : []),
      // Les consignes cadeau doivent sauter aux yeux : elles changent a qui et
      // quand le portrait doit partir.
      ...(estOccasion(opts.occasion)
        ? [{ name: "🎉 Occasion", value: OCCASION_FR[opts.occasion], inline: true }]
        : []),
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
      occasion: opts.occasion ?? null,
      promo_code: order.promo_code ?? null,
      discount_amount: order.discount_amount ?? null,
      detected_country: order.detected_country ?? null,
      /* Origine de la commande (premier contact + dernier clic publicitaire).
         Sans elle, PostHog ne pouvait pas dire quelle source rapporte quoi :
         l'evenement serveur n'herite ni du referent ni des utm du navigateur. */
      origine_referent: order.origine?.referent ?? null,
      utm_source: order.origine?.utm_source ?? null,
      utm_medium: order.origine?.utm_medium ?? null,
      utm_campaign: order.origine?.utm_campaign ?? null,
      landing_path: order.origine?.arrivee ?? null,
      ad_platform: order.origine?.pub?.plateforme ?? null,
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
  const gagnant = await payerAvecConfirmation(order.id, confirmationPayload(order));
  if (!gagnant) {
    await drainerEmails(`order:${order.id}`, 1);
    return false;
  }

  console.log(`[finaliser] commande ${order.id} finalisée par ${source}`);

  // Credit + quota were consumed by the orders paid_at trigger in the same
  // SQL transaction as PAID and the durable confirmation intent. Never debit
  // here: a crash/retry after PAID must not lose or duplicate consumption.

  await Promise.all([
    drainerEmails(`order:${order.id}`, 1),
    notifierEquipe(order),
    /* Attendu explicitement : sur Vercel l'execution est coupee des que la
       reponse part, et un envoi non attendu est simplement perdu. */
    mesurerAchat(order, source),
    // Vente envoyee a ChatGPT Ads de serveur a serveur (ne leve jamais).
    envoyerConversionChatgpt(order),
    /* Parrainage : si le code utilise est un code AMI-, le parrain recoit
       son bon maintenant que l'ami a paye. `recompenserParrain` ne leve
       jamais ; le `catch` est une seconde ceinture, parce qu'un bonus ne doit
       sous aucun pretexte empecher la confirmation de partir. */
    order.promo_code
      ? recompenserParrain(order).catch((erreur) =>
          console.error("[finaliser] parrainage impossible:", order.id, diagnosticJournal(erreur))
        )
      : Promise.resolve(),
  ]);

  return true;
}
