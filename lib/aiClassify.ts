import type { SupportMessageCategory } from "./db";

const SYSTEM_PROMPT = `Tu tries les emails reçus sur la boîte support@cartoonova.com, l'adresse support d'un e-commerce (Cartoonova) qui vend des portraits caricature personnalisés à partir de photos.

Classe chaque email dans EXACTEMENT une de ces catégories :
- "customer" : un vrai message d'un client ou prospect (question sur sa commande, son portrait, une livraison, une modification, une plainte, une confirmation de commande, un message relayé par "mailer@shopify.com" contenant un message client, une réponse/forward à un email envoyé par Cartoonova).
- "notification" : email automatique système, sans action requise (rapports de spam IONOS, notifications de connexion, confirmations techniques Google/Shopify, emails d'onboarding d'applications Shopify installées).
- "spam" : sollicitation commerciale non désirée, arnaque, phishing (fausses menaces sur les droits d'auteur/propriété intellectuelle, propositions d'audit gratuit, agences de pub/growth hacking, offres SEO, ventes d'espaces publicitaires).

Réponds avec UN SEUL mot exact : customer, notification, ou spam.`;

/**
 * Renvoie `null` quand le classement N'A PAS PU avoir lieu — cle absente,
 * appel en echec, exception.
 *
 * Ces trois cas retombaient auparavant sur "customer", au motif qu'il vaut
 * mieux voir un spam que rater un client. L'intention etait bonne, l'effet
 * non : une panne du classement devenait indiscernable d'une boite propre.
 * Le jour ou la cle OpenAI expire, le demarchage se remet a tomber dans la
 * liste de travail et rien ne le signale — c'est la meme panne silencieuse
 * que la synchronisation IMAP qui s'est arretee cinq semaines sans temoin.
 *
 * `null` est deja un etat de premiere classe cote base et cote interface :
 * la colonne est nullable, `countUnclassifiedSupportMessages` les compte et
 * l'admin affiche « X non classes » avec un bouton pour reprendre. Un echec
 * devient donc visible au lieu de se deguiser en courrier client.
 */
export async function classifySupportMessage(input: {
  fromEmail: string;
  subject: string | null;
  bodyText: string | null;
}): Promise<SupportMessageCategory | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[AI-CLASSIFY] OPENAI_API_KEY absente : message laisse non classe");
    return null;
  }

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 5,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `De: ${input.fromEmail}\nSujet: ${input.subject || "(sans objet)"}\nContenu:\n${(input.bodyText || "").slice(0, 800)}`,
          },
        ],
      }),
    });

    if (!r.ok) {
      console.error(`[AI-CLASSIFY] reponse ${r.status} : message laisse non classe`);
      return null;
    }

    const data = await r.json();
    const label = (data?.choices?.[0]?.message?.content || "").trim().toLowerCase();

    if (label.includes("spam")) return "spam";
    if (label.includes("notif")) return "notification";
    if (label.includes("customer")) return "customer";

    /* Une reponse hors des trois libelles attendus n'est pas un classement :
       c'est un modele qui a derive. On ne la traduit pas en "customer". */
    console.error(`[AI-CLASSIFY] reponse inattendue ${JSON.stringify(label)} : message laisse non classe`);
    return null;
  } catch (error) {
    console.error("[AI-CLASSIFY] Erreur:", error);
    return null;
  }
}
