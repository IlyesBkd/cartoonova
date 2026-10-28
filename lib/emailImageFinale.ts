import { getOrderById, setOrderLastOutboundMessageId, programmerEnvoiImageFinale } from "./db";
import { finalImageEmail, avisLiens, bonusLiens, langueCommande } from "./email-i18n";
import { orderTrackingToken } from "./emailToken";
import { SITE_URL } from "./site";
import { EXPEDITEUR, SUPPORT_EMAIL } from "./expediteur";
import { mesureServeur } from "./analyticsServeur";
import { MESURES } from "./evenementsMesure";
import { infosParrainage } from "./parrainage";
import { parrainageTextes } from "./i18n/relances";
import { envoyerEmail } from "@/lib/envoiEmail";
import { optionsLivraisonCadeau, validerLivraisonCadeau } from "./livraisonCadeau";
import { downloadFinalImage, validateFinalImageUrl, FinalImageError } from "./finalImage";
import { executeDelivery, deliveryContentHash, OrderDeliveryError } from "./orderDelivery";
import { emailLayout, emailParagraph, emailButton, emailNotice, emailImage, escapeEmailHtml } from "./emailTemplate";

/**
 * L'e-mail qui livre le portrait.
 *
 * Il partait d'un seul endroit — le bouton du tableau de bord — et son corps
 * etait ecrit dans la route. Maintenant que le cron l'envoie aussi, deux copies
 * auraient commence a diverger des la premiere retouche de formulation ; la
 * seule qui compte etant celle qu'on ne relit plus, c'est la copie du cron qui
 * serait restee en arriere.
 */

export interface DestinataireImageFinale {
  id: string;
  customer_email: string;
  customer_name: string | null;
  detected_country: string | null;
  final_image_url: string;
  langue?: string | null;
  /** Canonical saved options, required on every delivery path (including cron). */
  options: unknown;
}

/**
 * Envoie l'illustration, note l'envoi, et marque la commande livree.
 *
 * Laisse remonter l'echec de l'envoi : l'appelant doit pouvoir le dire a
 * l'admin ou le compter dans le rapport du cron. En revanche la commande n'est
 * marquee livree QU'APRES un envoi reussi — sinon un echec de Resend
 * effacerait le rendez-vous et personne ne recevrait jamais rien.
 */
export async function envoyerImageFinale(
  order: DestinataireImageFinale
): Promise<{ id: string | null; deferredUntil?: string }> {
  const saved = await getOrderById(order.id);
  if (!saved?.final_image_url) throw new FinalImageError("Commande sans portrait enregistré.", 409);
  if (!saved.paid_at) throw new FinalImageError("La livraison exige une commande payée.", 409);
  if (saved.final_image_url !== order.final_image_url || saved.customer_email !== order.customer_email) {
    throw new FinalImageError("La commande a changé. Rechargez-la avant l'envoi.", 409);
  }
  order = { ...saved, final_image_url: saved.final_image_url };
  const lang = langueCommande(order);
  const t = finalImageEmail[lang];
  const options = optionsLivraisonCadeau(order.options);
  validerLivraisonCadeau(options);
  validateFinalImageUrl(order.final_image_url);
  const gift = options?.gift;
  // The promise is a UTC calendar day, not the buyer's or server's timezone.
  // A deferred gift is aligned with the daily cron at 09:00 UTC.
  if (gift?.deliverAfter && gift.deliverAfter > new Date().toISOString().slice(0, 10)) {
    const date = new Date(`${gift.deliverAfter}T09:00:00.000Z`);
    await programmerEnvoiImageFinale(order.id, date);
    return { id: null, deferredUntil: date.toISOString() };
  }
  const destinataire = gift?.recipientEmail?.trim() || order.customer_email;
  const { bytes } = await downloadFinalImage(order.final_image_url);
  const tiers = destinataire.toLowerCase() !== order.customer_email.toLowerCase();
  const ref = order.id.slice(0, 8);
  /* Les cadeaux offerts (fond d'ecran, avatar, carte a imprimer) : la page
     s'ouvre une fois la commande marquee livree, ce qui suit cet envoi. */
  const token = tiers ? null : orderTrackingToken(order.id);
  const lienBonus = `${SITE_URL}/bonus/${token}`;

  /* Le code ami se montre ici parce que c'est le moment ou le client est le
     plus content de nous : il vient de decouvrir son portrait. Un echec de
     creation ne retient pas la livraison — le bloc disparait, c'est tout. */
  let parrainage: { code: string; recompense: string } | null = null;
  try {
    if (!tiers) parrainage = await infosParrainage(order.customer_email, lang);
  } catch {
    console.error("[IMAGE-FINALE] code de parrainage indisponible.");
  }
  const tp = parrainageTextes[lang];

  const current = await getOrderById(order.id);
  if (!current || current.final_image_url !== order.final_image_url ||
      current.customer_email !== order.customer_email ||
      JSON.stringify(optionsLivraisonCadeau(current.options)) !== JSON.stringify(options)) {
    throw new FinalImageError("La commande a changé. Rechargez-la avant l'envoi.", 409);
  }
  const delivery = await executeDelivery(order, "final_image", deliveryContentHash(bytes), destinataire, async context => {
  await context.send(idempotencyKey => envoyerEmail({
    from: EXPEDITEUR,
    to: [destinataire],
    replyTo: SUPPORT_EMAIL,
    subject: t.subject,
    html: emailLayout({
      lang,
      title: t.title,
      bodyHtml: `
        ${emailParagraph(t.greeting(tiers ? null : order.customer_name))}
        <p style="font-size:16px;line-height:1.7;color:#3f3f46;margin:0 0 18px;">${t.ready(escapeEmailHtml(ref))}</p>
        ${gift?.message ? emailParagraph(gift.message) : ""}
        ${emailImage(order.final_image_url, "Cartoonova")}
        ${emailParagraph(t.question)}
        ${emailButton(t.download, order.final_image_url)}
        ${!tiers ? emailButton(`🎁 ${bonusLiens[lang].email}`, lienBonus)
          + emailParagraph(avisLiens[lang].texte)
          + emailButton(`${avisLiens[lang].bouton} →`, `${SITE_URL}/${lang}/avis/nouveau?c=${token}`) : ""}
        ${emailNotice(t.feedback)}
        ${parrainage ? emailNotice(tp.titre)
          + emailParagraph(tp.offre(parrainage.recompense))
          + emailParagraph(tp.code)
          + emailNotice(parrainage.code) : ""}
      `,
      footerHtml: emailParagraph(t.thanks) + emailParagraph(t.team),
    }),
  }, { idempotencyKey }));
  }).catch(error => {
    if (error instanceof OrderDeliveryError) throw new FinalImageError(error.message, error.status);
    throw error;
  });

  /* Sans cet identifiant, la reponse du client — « pouvez-vous ajouter les
     tatouages ? » — arrive dans la boite support sans se rattacher a sa
     commande. */
  if (delivery.emailId) {
    await setOrderLastOutboundMessageId(order.id, delivery.emailId);
  }

  /* L'envoi compte autant que le clic : sans denominateur,
     un taux d'ouverture n'est pas un taux. */
  if (!delivery.duplicate) await mesureServeur(MESURES.emailEnvoye, {
    identifiant: destinataire,
    proprietes: { campagne: "image_finale" },
  }).catch(() => {});

  return { id: delivery.emailId };
}
