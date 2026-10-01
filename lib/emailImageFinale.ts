import { Resend } from "resend";
import { markFinalImageSent, setOrderLastOutboundMessageId } from "./db";
import { getLangFromCountry, finalImageEmail, bonusLiens } from "./email-i18n";
import { orderTrackingToken } from "./emailToken";
import { SITE_URL } from "./site";
import { EXPEDITEUR, SUPPORT_EMAIL } from "./expediteur";
import { mesureServeur } from "./analyticsServeur";
import { MESURES } from "./evenementsMesure";
import { infosParrainage } from "./parrainage";
import { parrainageTextes } from "./i18n/relances";

/**
 * L'e-mail qui livre le portrait.
 *
 * Il partait d'un seul endroit — le bouton du tableau de bord — et son corps
 * etait ecrit dans la route. Maintenant que le cron l'envoie aussi, deux copies
 * auraient commence a diverger des la premiere retouche de formulation ; la
 * seule qui compte etant celle qu'on ne relit plus, c'est la copie du cron qui
 * serait restee en arriere.
 */

const resend = new Resend(process.env.RESEND_API_KEY!);

export interface DestinataireImageFinale {
  id: string;
  customer_email: string;
  customer_name: string | null;
  detected_country: string | null;
  final_image_url: string;
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
): Promise<{ id: string | null }> {
  const lang = getLangFromCountry(order.detected_country);
  const t = finalImageEmail[lang];
  const ref = order.id.slice(0, 8);
  /* Les cadeaux offerts (fond d'ecran, avatar, carte a imprimer) : la page
     s'ouvre une fois la commande marquee livree, ce qui suit cet envoi. */
  const lienBonus = `${SITE_URL}/bonus/${orderTrackingToken(order.id)}`;

  /* Le code ami se montre ici parce que c'est le moment ou le client est le
     plus content de nous : il vient de decouvrir son portrait. Un echec de
     creation ne retient pas la livraison — le bloc disparait, c'est tout. */
  let parrainage: { code: string; recompense: string } | null = null;
  try {
    parrainage = await infosParrainage(order.customer_email, lang);
  } catch (erreur) {
    console.error("[IMAGE-FINALE] code de parrainage indisponible:", order.id, erreur);
  }
  const tp = parrainageTextes[lang];

  const result = await resend.emails.send({
    from: EXPEDITEUR,
    to: [order.customer_email],
    replyTo: SUPPORT_EMAIL,
    subject: t.subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef3c7; padding: 20px; border: 4px solid #000;">
        <div style="background: white; border: 3px solid #000; padding: 30px; margin: 20px 0; box-shadow: 8px 8px 0px rgba(0,0,0,1);">
          <h1 style="font-size: 32px; font-weight: 900; text-align: center; margin: 0 0 20px 0; color: #000; text-transform: uppercase;">
            ${t.title}
          </h1>
          <p style="font-size: 16px; text-align: center; margin: 0 0 30px 0; color: #000;">
            ${t.greeting(order.customer_name)}
          </p>
          <p style="font-size: 16px; text-align: center; margin: 0 0 20px 0; color: #555;">
            ${t.ready(ref)}
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <img src="${order.final_image_url}" alt="Cartoonova" style="max-width: 100%; border: 3px solid #000; border-radius: 12px; box-shadow: 6px 6px 0px rgba(0,0,0,1);" />
          </div>
          <p style="font-size: 20px; font-weight: 900; text-align: center; margin: 24px 0 0 0; color: #000;">
            ${t.question}
          </p>
          <div style="text-align: center; margin: 24px 0 30px 0;">
            <a href="${order.final_image_url}" target="_blank" style="display: inline-block; background: #facc15; color: #000; font-weight: 900; text-transform: uppercase; padding: 14px 32px; border: 3px solid #000; border-radius: 12px; text-decoration: none; font-size: 14px; box-shadow: 4px 4px 0px rgba(0,0,0,1);">
              ${t.download}
            </a>
            <div style="margin-top: 14px;">
              <a href="${lienBonus}" target="_blank" style="display: inline-block; background: #fff; color: #000; font-weight: 900; padding: 12px 26px; border: 3px solid #000; border-radius: 12px; text-decoration: none; font-size: 14px;">
                🎁 ${bonusLiens[lang].email}
              </a>
            </div>
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
          ${
            parrainage
              ? `<div style="border: 3px dashed #000; border-radius: 12px; padding: 18px 20px; margin-top: 18px; text-align: center;">
            <p style="font-size: 18px; font-weight: 900; color: #000; margin: 0 0 8px;">${tp.titre}</p>
            <p style="font-size: 15px; line-height: 1.5; color: #333; margin: 0 0 12px;">${tp.offre(parrainage.recompense)}</p>
            <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #555;">${tp.code}</p>
            <p style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: .06em; color: #000;">${parrainage.code}</p>
          </div>`
              : ""
          }
        </div>
        <div style="text-align: center; font-size: 14px; color: #000; font-weight: bold;">
          <p>${t.thanks}</p>
          <p>${t.team}</p>
        </div>
      </div>
    `,
  });

  if (result.error) {
    throw new Error(result.error.message || "Envoi refusé par Resend.");
  }

  console.log("[IMAGE-FINALE] Email envoyé:", JSON.stringify(result));

  /* Sans cet identifiant, la reponse du client — « pouvez-vous ajouter les
     tatouages ? » — arrive dans la boite support sans se rattacher a sa
     commande. */
  if (result.data?.id) {
    await setOrderLastOutboundMessageId(order.id, result.data.id);
  }

  /* L'envoi compte autant que le clic : sans denominateur,
     un taux d'ouverture n'est pas un taux. */
  await mesureServeur(MESURES.emailEnvoye, {
    identifiant: order.customer_email,
    proprietes: { campagne: "image_finale" },
  }).catch(() => {});

  await markFinalImageSent(order.id);

  return { id: result.data?.id ?? null };
}
