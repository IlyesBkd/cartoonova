import { jetonGoogle, lireCompteDeService } from "./googleAuth";

/**
 * Acces Search Console par compte de service.
 *
 * La meme logique existait dans `scripts/soumet-sitemap.mjs`, lance a la main.
 * Elle est reprise ici pour que la route cron puisse resoumettre le sitemap
 * sans intervention. Le script reste utile en usage ponctuel depuis un poste,
 * ou les identifiants viennent de `.env.local` plutot que de l'environnement
 * Vercel.
 */

const PORTEE_ECRITURE = "https://www.googleapis.com/auth/webmasters";

/** Renvoie `null` si la configuration est absente — l'appelant decide. */
export function lireIdentifiantsGsc(): { site: string } | null {
  const site = process.env.GSC_SITE_URL;
  if (!site || !lireCompteDeService()) return null;
  return { site };
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

  const jeton = await jetonGoogle(PORTEE_ECRITURE);
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
