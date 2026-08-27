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

import { neon } from "@neondatabase/serverless";
import { jetonGoogle, lireCompteDeService } from "../lib/googleAuth";
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

/* La connexion est ouverte tard : sans elle, une configuration incomplete
   echouerait sur une erreur de pilote au lieu du message qui explique quoi
   definir. Meme raison que dans la sonde de citation. */
let _sql: ReturnType<typeof neon> | null = null;
const sql = () => (_sql ??= neon(process.env.DATABASE_URL!));

const dors = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ═══ schema ════════════════════════════════════════════════════════════ */

async function assurerSchema() {
  await sql()`
    CREATE TABLE IF NOT EXISTS indexation_pages (
      url          TEXT PRIMARY KEY,
      locale       TEXT,
      produit      TEXT,
      /* PASS / NEUTRAL / FAIL, stable quelle que soit la langue demandee. */
      verdict      TEXT,
      /* Le motif tel que Google le formule : c'est lui qui distingue une page
         trop pauvre d'une page bloquee. */
      motif        TEXT,
      exploree_le  TIMESTAMPTZ,
      releve_le    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql()`
    CREATE TABLE IF NOT EXISTS indexation_jours (
      jour       DATE PRIMARY KEY,
      indexees   INTEGER NOT NULL,
      connues    INTEGER NOT NULL,
      bloquees   INTEGER NOT NULL,
      releve_le  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

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
  const rows = (await sql()`
    SELECT url, releve_le FROM indexation_pages
  `) as unknown as { url: string; releve_le: string }[];

  const vues = new Map(rows.map((r) => [r.url, new Date(r.releve_le).getTime()]));
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

  await assurerSchema();

  const cibles = perimetre();
  const lot = await lotDuJour(cibles);
  console.log(`[indexation] ${lot.length} adresse(s) sur ${cibles.length} · site ${SITE}`);

  /* Ce qui etait indexe avant ce passage, pour reperer une sortie d'index. */
  const avant = new Map(
    ((await sql()`SELECT url, verdict FROM indexation_pages`) as unknown as {
      url: string;
      verdict: string;
    }[]).map((r) => [r.url, r.verdict])
  );

  const jeton = await jetonGoogle(PORTEE);
  const perdues: string[] = [];
  let ok = 0;

  for (const c of lot) {
    const r = await inspecter(c.url, jeton);
    if (!r) continue;
    ok++;

    if (avant.get(c.url) === "PASS" && r.verdict !== "PASS") perdues.push(c.url);

    await sql()`
      INSERT INTO indexation_pages (url, locale, produit, verdict, motif, exploree_le, releve_le)
      VALUES (${c.url}, ${c.locale}, ${c.produit}, ${r.verdict}, ${r.motif}, ${r.exploreeLe}, NOW())
      ON CONFLICT (url) DO UPDATE SET
        locale = EXCLUDED.locale, produit = EXCLUDED.produit,
        verdict = EXCLUDED.verdict, motif = EXCLUDED.motif,
        exploree_le = EXCLUDED.exploree_le, releve_le = NOW()
    `;

    const etiquette = r.verdict === "PASS" ? "indexée" : r.verdict === "FAIL" ? "bloquée" : "connue";
    console.log(`  ${etiquette.padEnd(8)} ${c.url}${r.motif ? ` — ${r.motif}` : ""}`);
    await dors(PAUSE_MS);
  }

  /* ── total du jour ── */
  const t = ((await sql()`
    SELECT
      count(*) FILTER (WHERE verdict = 'PASS')::int    AS indexees,
      count(*) FILTER (WHERE verdict = 'NEUTRAL')::int AS connues,
      count(*) FILTER (WHERE verdict = 'FAIL')::int    AS bloquees
    FROM indexation_pages
  `) as unknown as { indexees: number; connues: number; bloquees: number }[])[0];

  const veille = ((await sql()`
    SELECT indexees FROM indexation_jours
    WHERE jour < CURRENT_DATE ORDER BY jour DESC LIMIT 1
  `) as unknown as { indexees: number }[])[0];

  await sql()`
    INSERT INTO indexation_jours (jour, indexees, connues, bloquees, releve_le)
    VALUES (CURRENT_DATE, ${t.indexees}, ${t.connues}, ${t.bloquees}, NOW())
    ON CONFLICT (jour) DO UPDATE SET
      indexees = EXCLUDED.indexees, connues = EXCLUDED.connues,
      bloquees = EXCLUDED.bloquees, releve_le = NOW()
  `;

  const ecart = veille ? t.indexees - veille.indexees : null;
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
