import type { SupportMessageCategory } from "./db";

const SYSTEM_PROMPT = `Tu tries les emails reçus sur la boîte support@cartoonova.com, l'adresse support d'un e-commerce (Cartoonova) qui vend des portraits caricature personnalisés à partir de photos.

Classe chaque email dans EXACTEMENT une de ces catégories :
- "customer" : un vrai message d'un client ou prospect (question sur sa commande, son portrait, une livraison, une modification, une plainte, une confirmation de commande, un message relayé par "mailer@shopify.com" contenant un message client, une réponse/forward à un email envoyé par Cartoonova).
- "notification" : email automatique système, sans action requise (rapports de spam IONOS, notifications de connexion, confirmations techniques Google/Shopify, emails d'onboarding d'applications Shopify installées).
- "spam" : sollicitation commerciale non désirée, arnaque, phishing (fausses menaces sur les droits d'auteur/propriété intellectuelle, propositions d'audit gratuit, agences de pub/growth hacking, offres SEO, ventes d'espaces publicitaires).

Réponds avec UN SEUL mot exact : customer, notification, ou spam.`;

export async function classifySupportMessage(input: {
  fromEmail: string;
  subject: string | null;
  bodyText: string | null;
}): Promise<SupportMessageCategory> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "customer";

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

    if (!r.ok) return "customer";

    const data = await r.json();
    const label = (data?.choices?.[0]?.message?.content || "").trim().toLowerCase();

    if (label.includes("spam")) return "spam";
    if (label.includes("notif")) return "notification";
    return "customer";
  } catch (error) {
    console.error("[AI-CLASSIFY] Erreur:", error);
    return "customer";
  }
}
