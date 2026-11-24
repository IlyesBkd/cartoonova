import { Resend } from "resend";
import { emailText } from "./emailTemplate";
import { beginEmailHistory, finishEmailHistory, emailHistoryDiagnostic } from "./customerHistoryJournal";

/**
 * Envoi d'un e-mail par Resend, qui echoue VRAIMENT quand l'envoi est refuse.
 *
 * Le SDK Resend ne leve pas d'exception sur un refus (adresse rejetee, quota,
 * domaine non verifie) : il renvoie `{ error }`. Tous les appels sauf un
 * ignoraient ce retour — l'e-mail de confirmation pouvait ne jamais partir
 * sans qu'aucune erreur n'apparaisse, et il etait meme compte comme envoye
 * dans PostHog. Constate le 6 octobre 2026.
 *
 * Meme signature que `resend.emails.send` : les appelants qui lisaient deja
 * `result.error` continuent de fonctionner (il vaut toujours null ici).
 */
const resend = new Resend(process.env.RESEND_API_KEY!);

type Parametres = Parameters<typeof resend.emails.send>[0];
type Resultat = Awaited<ReturnType<typeof resend.emails.send>>;

export async function envoyerEmail(
  parametres: Parametres,
  options?: Parameters<typeof resend.emails.send>[1]
): Promise<Resultat> {
  // Keep approved plain-text support replies unchanged; add a readable
  // alternative only for HTML-only payloads. Never mutate outbox payloads.
  const payload = typeof parametres.html === "string" && parametres.text === undefined
    ? { ...parametres, text: emailText(parametres.html) }
    : parametres;
  const attempt = await beginEmailHistory(payload, options?.idempotencyKey);
  let resultat: Resultat;
  try {
    resultat = await resend.emails.send(payload, options);
  } catch (error) {
    await finishEmailHistory(attempt, 'uncertain').catch(emailHistoryDiagnostic);
    throw error;
  }
  if (resultat.error) {
    await finishEmailHistory(attempt, 'failed').catch(emailHistoryDiagnostic);
    // Provider text can echo recipients, signed links or HTML. Keep only a
    // documented diagnostic category, never the response body or recipient.
    const categories = ["validation_error", "rate_limit_exceeded", "application_error", "missing_api_key", "invalid_api_key", "restricted_api_key"];
    const categorie = categories.includes(resultat.error.name) ? resultat.error.name : "erreur";
    throw new Error(`Resend a refuse l'envoi (${categorie})`);
  }
  await finishEmailHistory(attempt, resultat.data?.id ? 'sent' : 'uncertain', resultat.data?.id).catch(emailHistoryDiagnostic);
  return resultat;
}
