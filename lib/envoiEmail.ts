import { Resend } from "resend";

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

export async function envoyerEmail(parametres: Parametres): Promise<Resultat> {
  const resultat = await resend.emails.send(parametres);
  if (resultat.error) {
    const destinataire = Array.isArray(parametres.to) ? parametres.to[0] : parametres.to;
    throw new Error(
      `Resend a refuse l'envoi (${resultat.error.name ?? "erreur"}) a ${destinataire ?? "?"} : ${resultat.error.message}`
    );
  }
  return resultat;
}
