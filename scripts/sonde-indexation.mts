/**
 * Releve chaque nuit combien de pages sont reellement indexees, et lesquelles.
 *
 *   npx tsx scripts/sonde-indexation.mts
 *
 * ── Pourquoi cette sonde existe ──────────────────────────────────────────
 *
 * On publie du texte sur 350 pages et on le signale aux moteurs. Sans mesure,
 * on ne saurait pas si ca marche : combien de pages sont entrees dans l'index,
 * lesquelles restent dehors, et pourquoi. C'est exactement ce qu'on serait
 * alle chercher a la main dans une console de webmaster.
 *
 * L'API d'inspection d'URL de Search Console repond a la question sans qu'on
 * ouvre quoi que ce soit : pour chaque adresse, un verdict, un motif, et la
 * date de derniere exploration. Le compte de service du depot y a deja acces —
 * c'est celui qui resoumet le plan du site.
 *
 * ── Ce qu'elle mesure ────────────────────────────────────────────────────
 *
 *   PASS     la page est indexee
 *   NEUTRAL  connue mais pas indexee — le cas courant ici : « exploree,
 *            actuellement non indexee », qui est la signature d'une page jugee
 *            trop pauvre ou trop semblable a une autre
 *   FAIL     un blocage : robots, noindex, canonique divergente, erreur
 *
 * Le motif brut est conserve tel que Google le formule. C'est lui qui dit si
 * une page manque de contenu ou si elle est bloquee — deux problemes qui
 * n'ont rien a voir et ne se corrigent pas pareil.
 *
 * ── Pourquoi par lots tournants ──────────────────────────────────────────
 *
 * Le quota autorise deux mille inspections par jour, largement de quoi tout
 * relever d'un coup. On prefere un lot quotidien qui reprend toujours les
 * adresses vues il y a le plus longtemps : la charge reste plate, la serie
 * historique se construit sans a-coups, et une panne d'un jour ne laisse pas
 * de trou.
 *
 * ── Ce qu'elle envoie ────────────────────────────────────────────────────
 *
 * Un point Discord quand le total bouge, et une alerte quand une page qui
 * etait indexee ne l'est plus. Le reste dort en base : personne n'a a lire
 * un rapport tous les matins pour que la mesure serve.
 */

import { jetonGoogle, lireCompteDeService } from "../lib/googleAuth";
import {
  enregistrerReleve,
  verdictsConnus,
  dernierReleveParUrl,
  totalIndexation,
  enregistrerJour,
} from "../lib/indexation";
import { CATALOGUE_EN_LIGNE, slugsProduit } from "../lib/catalogue";
import { locales, type Locale } from "../i18n/config";

/* ═══ reglages ══════════════════════════════════════════════════════════ */

const SITE = process.env.GSC_SITE_URL || "";
const SITE_URL = process.env.SITE_URL || "https://www.cartoonova.com";
const DISCORD = process.env.DISCORD_WEBHOOK_URL || "";

/** Adresses inspectees par passage. Le quota en autorise 2 000 ; on reste bas
    pour que la serie soit reguliere plutot que par a-coups. */
const PAR_PASSAGE = Number(process.env.INDEX_PAR_PASSAGE || 60);

/** Pause entre deux appels : le quota par minute est de 600. */
const PAUSE_MS = Number(process.env.INDEX_PAUSE_MS || 150);

const PORTEE = "https://www.googleapis.com/auth/webmasters";

const dors = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ═══ le perimetre ══════════════════════════════════════════════════════ */

interface Cible {
  url: string;
  locale: string;
  produit: string | null;
}

/** Toutes les adresses qui doivent etre indexees, dans toutes les langues. */
function perimetre(): Cible[] {
  const cibles: Cible[] = [];
  for (const locale of locales as readonly Locale[]) {
    cibles.push({ url: `${SITE_URL}/${locale}`, locale, produit: null });
    cibles.push({ url: `${SITE_URL}/${locale}/collections`, locale, produit: null });
    for (const p of CATALOGUE_EN_LIGNE) {
      cibles.push({
        url: `${SITE_URL}/${locale}/${slugsProduit(p)[locale]}`,
        locale,
        produit: p.slug,
      });
    }
  }
  return cibles;
}

/** Le lot du jour : les adresses jamais vues d'abord, puis les plus anciennes. */
async function lotDuJour(cibles: Cible[]): Promise<Cible[]> {
  const vues = await dernierReleveParUrl();
  return [...cibles]
    .sort((a, b) => (vues.get(a.url) ?? 0) - (vues.get(b.url) ?? 0))
    .slice(0, PAR_PASSAGE);
}

/* ═══ inspection ════════════════════════════════════════════════════════ */

interface Releve {
  verdict: string;
  motif: string;
  exploreeLe: string | null;
}

async function inspecter(url: string, jeton: string): Promise<Releve | null> {
  try {
    const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      method: "POST",
      headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: SITE, languageCode: "fr" }),
    });
    if (!r.ok) {
      console.error(`  ! ${r.status} ${url} — ${(await r.text()).slice(0, 120)}`);
      return null;
    }
    const i = (await r.json())?.inspectionResult?.indexStatusResult ?? {};
    return {
      verdict: i.verdict ?? "INCONNU",
      motif: i.coverageState ?? "",
      exploreeLe: i.lastCrawlTime ?? null,
    };
  } catch (e) {
    console.error(`  ! reseau ${url} — ${(e as Error).message}`);
    return null;
  }
}

/* ═══ Discord ═══════════════════════════════════════════════════════════ */

async function versDiscord(titre: string, texte: string, couleur: number) {
  if (!DISCORD) return;
  try {
    await fetch(DISCORD, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{ title: titre, description: texte.slice(0, 3800), color: couleur }],
      }),
    });
  } catch {
    /* Un point manque ne doit pas faire echouer un releve deja ecrit. */
  }
}

/* ═══ passage ═══════════════════════════════════════════════════════════ */

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[indexation] DATABASE_URL manquante.");
    process.exit(1);
  }
  if (!SITE || !lireCompteDeService()) {
    console.error("[indexation] GSC_SITE_URL / GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY_B64 manquantes.");
    process.exit(1);
  }

  const cibles = perimetre();
  const lot = await lotDuJour(cibles);
  console.log(`[indexation] ${lot.length} adresse(s) sur ${cibles.length} · site ${SITE}`);

  /* Ce qui etait indexe avant ce passage, pour reperer une sortie d'index. */
  const avant = await verdictsConnus();

  const jeton = await jetonGoogle(PORTEE);
  const perdues: string[] = [];
  let ok = 0;

  for (const c of lot) {
    const r = await inspecter(c.url, jeton);
    if (!r) continue;
    ok++;

    if (avant.get(c.url) === "PASS" && r.verdict !== "PASS") perdues.push(c.url);

    await enregistrerReleve({
      url: c.url,
      locale: c.locale,
      produit: c.produit,
      verdict: r.verdict,
      motif: r.motif,
      exploreeLe: r.exploreeLe,
    });

    const etiquette = r.verdict === "PASS" ? "indexée" : r.verdict === "FAIL" ? "bloquée" : "connue";
    console.log(`  ${etiquette.padEnd(8)} ${c.url}${r.motif ? ` — ${r.motif}` : ""}`);
    await dors(PAUSE_MS);
  }

  /* ── total du jour ── */
  const t = await totalIndexation();
  const ecart = await enregistrerJour(t);

  const signe = ecart === null ? "" : ecart > 0 ? ` (+${ecart})` : ecart < 0 ? ` (${ecart})` : " (stable)";
  console.log(
    `\n[indexation] ${ok}/${lot.length} relevées · ${t.indexees} indexées${signe}, ` +
      `${t.connues} connues non indexées, ${t.bloquees} bloquées`
  );

  /* Une page qui sort de l'index est le seul evenement qui merite d'interrompre
     quelqu'un : c'est du trafic acquis qui disparait. */
  if (perdues.length) {
    await versDiscord(
      `⚠️ ${perdues.length} page(s) sorties de l'index`,
      perdues.map((u) => `• ${u}`).join("\n"),
      0xd94f4f
    );
  } else if (ecart !== null && ecart !== 0) {
    await versDiscord(
      "Indexation",
      `**${t.indexees}** pages indexées${signe} sur ${cibles.length}.\n` +
        `${t.connues} connues mais pas indexées · ${t.bloquees} bloquées.`,
      ecart > 0 ? 0xe9ba3b : 0x8a83ac
    );
  }
}

await main();
