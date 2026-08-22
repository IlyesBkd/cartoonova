import { NextRequest, NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import { locales } from "@/i18n/config";
import { soumettreSitemap, lireIdentifiantsGsc } from "@/lib/gsc";
import { signalerAIndexNow } from "@/lib/indexnow";
import { lireEtat, ecrireEtat } from "@/lib/seoState";
import { getArticlesPublishedSince, getAllPublishedArticleRefs } from "@/lib/blogDb";
import { getPricesForCurrency } from "@/lib/db";
import { CATALOGUE_EN_LIGNE, slugsProduit } from "@/lib/catalogue";
import { compteMerchant, etatMerchant, anomaliesMerchant } from "@/lib/merchant";

/**
 * Entretien SEO quotidien, et vigie du site.
 *
 * Trois taches se partagent une seule route parce qu'elles se partagent un
 * rapport : resoumettre le sitemap, signaler les nouveautes a IndexNow, et
 * verifier que ce dont vivent les canaux d'acquisition repond encore. Les
 * separer multiplierait les crons — un plan Vercel Hobby n'en autorise que
 * deux — sans rien clarifier.
 *
 * Aucune des trois ne doit faire echouer les autres : chacune est capturee
 * separement et rapportee telle quelle.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CLE_INDEXNOW = "indexnow:dernier-signalement";

/** Au-dela, un blog qui a deja publie est considere a l'arret. */
const FRAICHEUR_BLOG_JOURS = 7;

interface EtatIndexNow {
  dernierSignalement: string;
  socleEnvoye: boolean;
}

/* ─── IndexNow ──────────────────────────────────────────────────────────── */

/**
 * URL permanentes du site : accueil, collections, blog et fiches produit, dans
 * toutes les langues. Envoyees une seule fois, au premier passage — ensuite
 * seules les nouveautes justifient un signalement.
 */
function socleUrl(): string[] {
  const urls: string[] = [];
  for (const locale of locales) {
    urls.push(`${SITE_URL}/${locale}`);
    urls.push(`${SITE_URL}/${locale}/collections`);
    urls.push(`${SITE_URL}/${locale}/blog`);
    for (const produit of CATALOGUE_EN_LIGNE) {
      urls.push(`${SITE_URL}/${locale}/${slugsProduit(produit)[locale]}`);
    }
  }
  return urls;
}

async function tacheIndexNow() {
  const etat = await lireEtat<EtatIndexNow>(CLE_INDEXNOW);

  if (!etat?.socleEnvoye) {
    const resultat = await signalerAIndexNow(socleUrl());
    await ecrireEtat<EtatIndexNow>(CLE_INDEXNOW, {
      dernierSignalement: new Date().toISOString(),
      socleEnvoye: true,
    });
    return { type: "socle" as const, ...resultat };
  }

  /* Une heure de recouvrement sur la fenetre : deux executions qui se suivent
     ne doivent pas laisser passer un article publie entre les deux. Un doublon
     de signalement est sans consequence, une omission est definitive. */
  const depuis = new Date(new Date(etat.dernierSignalement).getTime() - 3_600_000);
  const articles = await getArticlesPublishedSince(depuis);
  const urls = articles.map((a) => `${SITE_URL}/${a.locale}/blog/${a.slug}`);

  const resultat = urls.length ? await signalerAIndexNow(urls) : { envoyees: 0, statut: null };

  await ecrireEtat<EtatIndexNow>(CLE_INDEXNOW, {
    dernierSignalement: new Date().toISOString(),
    socleEnvoye: true,
  });

  return { type: "nouveautes" as const, ...resultat };
}

/* ─── Vigie ─────────────────────────────────────────────────────────────── */

interface Verification {
  nom: string;
  ok: boolean;
  detail: string;
}

async function verifierSitemap(): Promise<Verification> {
  try {
    const r = await fetch(`${SITE_URL}/sitemap.xml`, { cache: "no-store" });
    if (!r.ok) return { nom: "sitemap", ok: false, detail: `HTTP ${r.status}` };
    const xml = await r.text();
    const nb = (xml.match(/<url>/g) ?? []).length;
    return nb > 0
      ? { nom: "sitemap", ok: true, detail: `${nb} URL` }
      : { nom: "sitemap", ok: false, detail: "aucune URL" };
  } catch (e) {
    return { nom: "sitemap", ok: false, detail: e instanceof Error ? e.message : "injoignable" };
  }
}

/**
 * Le flux marchand est verifie sur le fond, pas seulement sur son code HTTP :
 * un ecart entre le prix annonce dans le flux et celui de la page est le motif
 * de suspension le plus courant d'un compte Merchant Center.
 */
async function verifierFluxMarchand(): Promise<Verification> {
  try {
    const r = await fetch(`${SITE_URL}/api/feed/google/fr`, { cache: "no-store" });
    if (!r.ok) return { nom: "flux Merchant", ok: false, detail: `HTTP ${r.status}` };

    const xml = await r.text();
    const articles = (xml.match(/<item>/g) ?? []).length;
    if (articles === 0) return { nom: "flux Merchant", ok: false, detail: "flux vide" };

    const prixFlux = xml.match(/<g:price>([\d.]+) EUR<\/g:price>/)?.[1];
    const attendu = (await getPricesForCurrency("EUR")).base.toFixed(2);

    if (prixFlux !== attendu) {
      return {
        nom: "flux Merchant",
        ok: false,
        detail: `prix du flux ${prixFlux} EUR, prix en base ${attendu} EUR`,
      };
    }
    return { nom: "flux Merchant", ok: true, detail: `${articles} articles a ${attendu} EUR` };
  } catch (e) {
    return { nom: "flux Merchant", ok: false, detail: e instanceof Error ? e.message : "injoignable" };
  }
}

async function verifierBlog(): Promise<Verification> {
  try {
    const refs = await getAllPublishedArticleRefs();
    if (refs.length === 0) {
      /* Pas une anomalie : le moteur de publication n'a simplement pas encore
         de cles d'API. L'information remonte dans le rapport, sans alerte
         quotidienne qui finirait par etre ignoree. */
      return { nom: "blog", ok: true, detail: "aucun article publie (moteur non active)" };
    }

    const dernier = refs.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
    const jours = Math.floor((Date.now() - new Date(dernier.updatedAt).getTime()) / 86_400_000);

    return jours > FRAICHEUR_BLOG_JOURS
      ? { nom: "blog", ok: false, detail: `${refs.length} articles, rien depuis ${jours} jours` }
      : { nom: "blog", ok: true, detail: `${refs.length} articles, dernier il y a ${jours} j` };
  } catch (e) {
    return { nom: "blog", ok: false, detail: e instanceof Error ? e.message : "base injoignable" };
  }
}

/* ─── Rapport ───────────────────────────────────────────────────────────── */

async function previenirDiscord(titre: string, lignes: string[], alerte: boolean): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: titre,
          description: lignes.join("\n"),
          color: alerte ? 0xdc2626 : 0x16a34a,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  }).catch(() => {
    /* Une alerte non delivree ne doit pas faire echouer l'entretien lui-meme. */
  });
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[CRON seo] CRON_SECRET manquant");
    return NextResponse.json({ error: "Non configuré." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const rapport: Record<string, unknown> = {};
  const anomalies: string[] = [];

  // 1. Sitemap
  if (lireIdentifiantsGsc()) {
    try {
      rapport.sitemap = await soumettreSitemap(`${SITE_URL}/sitemap.xml`);
      const etat = rapport.sitemap as { erreurs: number };
      if (etat.erreurs > 0) anomalies.push(`Search Console signale ${etat.erreurs} erreurs sur le sitemap`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      rapport.sitemap = { erreur: message };
      anomalies.push(`Soumission du sitemap impossible : ${message}`);
    }
  } else {
    rapport.sitemap = { ignore: "identifiants Search Console absents de l'environnement" };
  }

  // 2. IndexNow
  try {
    const resultat = await tacheIndexNow();
    rapport.indexnow = resultat;
    if (resultat.statut !== null && resultat.statut >= 400) {
      anomalies.push(`IndexNow a repondu ${resultat.statut}`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    rapport.indexnow = { erreur: message };
    anomalies.push(`IndexNow : ${message}`);
  }

  // 3. Vigie
  const verifications = await Promise.all([verifierSitemap(), verifierFluxMarchand(), verifierBlog()]);
  rapport.verifications = verifications;
  for (const v of verifications) {
    if (!v.ok) anomalies.push(`${v.nom} : ${v.detail}`);
  }

  /* 4. Merchant Center. Verifier que notre flux repond ne dit rien de ce que
     Google en fait : un compte peut etre suspendu, ou refuser la moitie des
     fiches, avec un flux parfaitement valide en face. C'est ce que cette
     lecture apporte, et c'est le seul endroit d'ou l'information vient. */
  if (compteMerchant()) {
    try {
      const etat = await etatMerchant();
      rapport.merchant = {
        produits: etat.produits,
        parLangue: etat.parLangue,
        problemesCompte: etat.problemesCompte,
        problemesProduit: etat.problemesProduit,
        partRefusee: Math.round(etat.partRefusee * 100) / 100,
      };
      anomalies.push(...anomaliesMerchant(etat));
      verifications.push({
        nom: "Merchant Center",
        ok: anomaliesMerchant(etat).length === 0,
        detail: `${etat.produits} fiches, ${Math.round(etat.partRefusee * 100)} % refusees`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      rapport.merchant = { erreur: message };
      anomalies.push(`Merchant Center : ${message}`);
    }
  } else {
    rapport.merchant = { ignore: "MERCHANT_ACCOUNT_ID absent de l'environnement" };
  }

  /* Discord n'est sollicite qu'en cas d'anomalie, plus un battement
     hebdomadaire le lundi : une notification quotidienne « tout va bien »
     cesse d'etre lue au bout d'une semaine, et son absence ne signifierait
     plus rien. */
  const lundi = new Date().getUTCDay() === 1;
  if (anomalies.length > 0) {
    await previenirDiscord("⚠️ Vigie Cartoonova", anomalies.map((a) => `• ${a}`), true);
  } else if (lundi) {
    await previenirDiscord(
      "✅ Vigie Cartoonova — hebdo",
      verifications.map((v) => `• ${v.nom} : ${v.detail}`),
      false
    );
  }

  return NextResponse.json({ ok: anomalies.length === 0, anomalies, rapport });
}
