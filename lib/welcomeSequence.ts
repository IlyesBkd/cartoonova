import { markWelcomeStepSent, type NewsletterSubscriber } from "./db";
import { welcomeSequence, LANGS, type Lang } from "./email-i18n";
import { signEmail } from "./emailToken";
import { SITE_URL } from "./site";
import { mesureServeur } from "./analyticsServeur";
import { MESURES } from "./evenementsMesure";
import { lienEmail } from "./utmEmail";
import { EXPEDITEUR, SUPPORT_EMAIL } from "./expediteur";
import { envoyerEmail } from "@/lib/envoiEmail";
import { emailLayout, emailParagraph, emailButton, escapeEmailHtml } from "@/lib/emailTemplate";

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
    // Trusted static translations contain HTML entities (Rick &amp; Morty).
    .map((p) => `<p style="font-size:16px;line-height:1.65;margin:0 0 16px;">${p}</p>`)
    .join("");

  await envoyerEmail({
    from: EXPEDITEUR,
    to: [subscriber.email],
    replyTo: SUPPORT_EMAIL,
    subject: content.subject,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    html: emailLayout({
      lang,
      title: content.title,
      bodyHtml: paragraphs + emailButton(content.cta, lienEmail(`${SITE_URL}/${lang}${content.ctaPath}`, "bienvenue")),
      footerHtml: emailParagraph(content.team) +
        `<p><a href="${escapeEmailHtml(unsubscribeUrl)}">${escapeEmailHtml(content.unsubscribe)}</a></p>`,
    }),
  });
  /* L'envoi compte autant que le clic : sans denominateur,
     un taux d'ouverture n'est pas un taux. */
  await mesureServeur(MESURES.emailEnvoye, {
    identifiant: subscriber.email,
    proprietes: { campagne: "bienvenue" },
  });

  await markWelcomeStepSent(subscriber.email, step);
}
