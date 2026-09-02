import { Resend } from "resend";
import { markWelcomeStepSent, type NewsletterSubscriber } from "./db";
import { welcomeSequence, LANGS, type Lang } from "./email-i18n";
import { signEmail } from "./emailToken";
import { SITE_URL } from "./site";
import { mesureServeur } from "./analyticsServeur";
import { MESURES } from "./evenementsMesure";
import { lienEmail } from "./utmEmail";
import { EXPEDITEUR, SUPPORT_EMAIL } from "./expediteur";

const resend = new Resend(process.env.RESEND_API_KEY!);

/* La liste etait recopiee ici, figee a cinq langues, alors que `email-i18n`
   en sert dix et que le site en propose autant : un inscrit neerlandais,
   polonais, suedois, danois ou portugais recevait la sequence en francais.
   Une seule liste, celle qui fait autorite. */

/** Delai apres l'inscription pour chaque etape (l'etape 1 part immediatement). */
export const WELCOME_DELAYS_DAYS: Record<2 | 3, number> = { 2: 3, 3: 8 };

export function langFromLocale(locale: string | null | undefined): Lang {
  return LANGS.includes(locale as Lang) ? (locale as Lang) : "fr";
}

/**
 * Envoie une etape de la sequence de bienvenue et avance le compteur.
 * L'ecriture en base n'a lieu qu'apres un envoi reussi, et `markWelcomeStepSent`
 * ne bouge que si l'etape precedente est bien celle attendue : deux executions
 * concurrentes ne peuvent pas envoyer deux fois le meme email.
 */
export async function sendWelcomeStep(
  subscriber: Pick<NewsletterSubscriber, "email" | "locale">,
  step: 1 | 2 | 3
): Promise<void> {
  const lang = langFromLocale(subscriber.locale);
  const content = welcomeSequence[lang][step - 1];

  const unsubscribeUrl =
    `${SITE_URL}/api/newsletter/unsubscribe` +
    `?email=${encodeURIComponent(subscriber.email)}` +
    `&t=${signEmail(subscriber.email)}&lang=${lang}`;

  const paragraphs = content.paragraphs
    .map((p) => `<p style="font-size:16px;margin:0 0 16px;color:#333;">${p}</p>`)
    .join("");

  await resend.emails.send({
    from: EXPEDITEUR,
    to: [subscriber.email],
    replyTo: SUPPORT_EMAIL,
    subject: content.subject,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef3c7; padding: 20px; border: 4px solid #000;">
        <div style="background: white; border: 3px solid #000; padding: 30px; margin: 20px 0; box-shadow: 8px 8px 0px rgba(0,0,0,1);">
          <h1 style="font-size: 26px; font-weight: 900; text-align: center; margin: 0 0 24px; color: #000;">${content.title}</h1>
          ${paragraphs}
          <div style="text-align: center; margin: 28px 0 8px;">
            <a href="${lienEmail(`${SITE_URL}/${lang}${content.ctaPath}`, "bienvenue")}" style="display: inline-block; background: #facc15; color: #000; font-weight: 900; text-transform: uppercase; padding: 14px 32px; border: 3px solid #000; border-radius: 12px; text-decoration: none; font-size: 14px; box-shadow: 4px 4px 0px rgba(0,0,0,1);">
              ${content.cta}
            </a>
          </div>
        </div>
        <div style="text-align: center; font-size: 12px; color: #444;">
          <p style="font-weight: bold; color: #000;">${content.team}</p>
          <p style="margin-top: 12px;"><a href="${unsubscribeUrl}" style="color: #444;">${content.unsubscribe}</a></p>
        </div>
      </div>
    `,
  });
  /* L'envoi compte autant que le clic : sans denominateur,
     un taux d'ouverture n'est pas un taux. */
  await mesureServeur(MESURES.emailEnvoye, {
    identifiant: subscriber.email,
    proprietes: { campagne: "bienvenue" },
  });

  await markWelcomeStepSent(subscriber.email, step);
}
