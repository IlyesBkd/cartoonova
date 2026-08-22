import crypto from "node:crypto";

/**
 * Acces Search Console par compte de service.
 *
 * La meme logique existait dans `scripts/soumet-sitemap.mjs`, lance a la main.
 * Elle est reprise ici pour que la route cron puisse resoumettre le sitemap
 * sans intervention : deux copies du meme JWT finiraient par diverger, mais le
 * script reste utile en usage ponctuel depuis un poste, ou les identifiants
 * viennent de `.env.local` plutot que de l'environnement Vercel.
 *
 * La cle privee est attendue en base64 : les antislashs des sauts de ligne PEM
 * ne survivent pas de maniere fiable au passage par un shell, un fichier .env
 * et l'interface de Vercel.
 */

const PORTEE_ECRITURE = "https://www.googleapis.com/auth/webmasters";

export interface IdentifiantsGsc {
  email: string;
  clePrivee: string;
  site: string;
}

/** Renvoie `null` si la configuration est absente — l'appelant decide. */
export function lireIdentifiantsGsc(): IdentifiantsGsc | null {
  const email = process.env.GSC_CLIENT_EMAIL;
  const cleB64 = process.env.GSC_PRIVATE_KEY_B64;
  const site = process.env.GSC_SITE_URL;
  if (!email || !cleB64 || !site) return null;

  return {
    email,
    clePrivee: Buffer.from(cleB64, "base64").toString("utf8"),
    site,
  };
}

const b64url = (v: unknown) =>
  Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

async function obtenirJeton(ids: IdentifiantsGsc): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const entete = b64url({ alg: "RS256", typ: "JWT" });
  const charge = b64url({
    iss: ids.email,
    scope: PORTEE_ECRITURE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(`${entete}.${charge}`), ids.clePrivee)
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
    throw new Error(`authentification refusee : ${jeton.error_description ?? jeton.error ?? reponse.status}`);
  }
  return jeton.access_token;
}

export interface EtatSitemap {
  soumis: boolean;
  dernierTelechargement: string | null;
  urlRelevees: number | null;
  avertissements: number;
  erreurs: number;
}

/**
 * Resoumet le sitemap et relit l'etat que Google en a.
 *
 * Une resoumission ne garantit aucun delai, mais un sitemap resoumis passe
 * devant un sitemap simplement decouvert. L'operation est idempotente : la
 * relancer chaque jour ne cree pas de doublon.
 */
export async function soumettreSitemap(urlSitemap: string): Promise<EtatSitemap> {
  const ids = lireIdentifiantsGsc();
  if (!ids) throw new Error("identifiants Search Console absents");

  const jeton = await obtenirJeton(ids);
  const cible =
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(ids.site)}` +
    `/sitemaps/${encodeURIComponent(urlSitemap)}`;

  const soumission = await fetch(cible, {
    method: "PUT",
    headers: { authorization: `Bearer ${jeton}` },
  });

  if (!soumission.ok) {
    const detail = (await soumission.json().catch(() => ({}))) as { error?: { message?: string } };
    /* 403 signale presque toujours une permission « Restreint » sur la
       propriete la ou « Complet » est requis pour ecrire. */
    throw new Error(
      `soumission refusee (${soumission.status}) : ${detail.error?.message ?? "erreur inconnue"}` +
        (soumission.status === 403 ? " — permission « Complet » requise sur la propriete" : "")
    );
  }

  const etat = await fetch(cible, { headers: { authorization: `Bearer ${jeton}` } });
  if (!etat.ok) {
    return { soumis: true, dernierTelechargement: null, urlRelevees: null, avertissements: 0, erreurs: 0 };
  }

  const s = (await etat.json()) as {
    lastDownloaded?: string;
    contents?: { submitted?: string }[];
    warnings?: string;
    errors?: string;
  };

  return {
    soumis: true,
    dernierTelechargement: s.lastDownloaded ?? null,
    urlRelevees: s.contents?.[0]?.submitted ? Number(s.contents[0].submitted) : null,
    avertissements: Number(s.warnings ?? 0),
    erreurs: Number(s.errors ?? 0),
  };
}
