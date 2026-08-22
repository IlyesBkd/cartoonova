import crypto from "node:crypto";

/**
 * Jeton d'acces Google par compte de service.
 *
 * La logique vivait dans `lib/gsc.ts`, ecrite pour Search Console. Merchant
 * Center utilise le meme compte de service avec une portee differente : plutot
 * que d'en recopier la signature JWT, elle est isolee ici. Deux copies d'un
 * echange d'authentification finissent toujours par diverger sur le detail qui
 * compte.
 *
 * La cle privee est attendue en base64 : les antislashs des sauts de ligne PEM
 * ne survivent pas de maniere fiable au passage par un shell, un fichier .env
 * et l'interface de Vercel.
 */

export interface CompteDeService {
  email: string;
  clePrivee: string;
}

/** Renvoie `null` si la configuration est absente — l'appelant decide. */
export function lireCompteDeService(): CompteDeService | null {
  const email = process.env.GSC_CLIENT_EMAIL;
  const cleB64 = process.env.GSC_PRIVATE_KEY_B64;
  if (!email || !cleB64) return null;

  return { email, clePrivee: Buffer.from(cleB64, "base64").toString("utf8") };
}

const b64url = (v: unknown) =>
  Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

export async function jetonGoogle(portee: string): Promise<string> {
  const compte = lireCompteDeService();
  if (!compte) throw new Error("compte de service Google absent de l'environnement");

  const now = Math.floor(Date.now() / 1000);
  const entete = b64url({ alg: "RS256", typ: "JWT" });
  const charge = b64url({
    iss: compte.email,
    scope: portee,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(`${entete}.${charge}`), compte.clePrivee)
    .toString("base64url");

  const reponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${entete}.${charge}.${signature}`,
    }),
  });

  const jeton = (await reponse.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!reponse.ok || !jeton.access_token) {
    throw new Error(
      `authentification refusee : ${jeton.error_description ?? jeton.error ?? reponse.status}`
    );
  }
  return jeton.access_token;
}
