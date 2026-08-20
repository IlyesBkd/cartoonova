/**
 * Point de mesure « avant » : fige l'etat Search Console avant que la refonte
 * SEO ne touche au code, pour disposer d'une base de comparaison.
 *
 *   node scripts/gsc-baseline.mjs [--jours=90]
 *
 * Ecrit des CSV dans data/seo/baseline-AAAA-MM-JJ/ — a commiter : c'est la
 * reference contre laquelle l'apres sera lu.
 *
 * Deux limites de l'API a garder en tete en lisant les chiffres :
 *   - les donnees s'arretent 2 a 3 jours avant aujourd'hui ;
 *   - les requetes rares sont anonymisees. La somme des lignes « requete » est
 *     donc toujours inferieure au total reel. C'est normal, pas un bug — et
 *     c'est la raison d'etre de l'export BigQuery pour la suite.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const RACINE = "data/seo";
const PORTEE = "https://www.googleapis.com/auth/webmasters.readonly";
const LOCALES = ["fr", "en", "es", "de", "it"];
const PAGES_LEGALES = new Set(["cgv", "mentions-legales", "politique-de-confidentialite"]);
const PAGES_SIMPLES = new Set(["a-propos", "avis", "contact", "portfolio"]);

/* ─── identifiants ─────────────────────────────────────────────────────── */

function chargerEnv() {
  const fichier = ".env.local";
  if (!fs.existsSync(fichier)) return;
  for (const ligne of fs.readFileSync(fichier, "utf8").split(/\r?\n/)) {
    if (!ligne || ligne.startsWith("#")) continue;
    const i = ligne.indexOf("=");
    if (i === -1) continue;
    const cle = ligne.slice(0, i).trim();
    if (!process.env[cle]) process.env[cle] = ligne.slice(i + 1).replace(/^"|"$/g, "");
  }
}

chargerEnv();

const EMAIL = process.env.GSC_CLIENT_EMAIL;
const SITE = process.env.GSC_SITE_URL;
const CLE_B64 = process.env.GSC_PRIVATE_KEY_B64;

if (!EMAIL || !SITE || !CLE_B64) {
  console.error("Identifiants absents. Lancez d'abord : node scripts/gsc-setup.mjs");
  process.exit(1);
}

const clePrivee = Buffer.from(CLE_B64, "base64").toString("utf8");

async function obtenirJeton() {
  const b64url = (v) =>
    Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const entete = b64url({ alg: "RS256", typ: "JWT" });
  const charge = b64url({
    iss: EMAIL,
    scope: PORTEE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(`${entete}.${charge}`), clePrivee)
    .toString("base64url");

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${entete}.${charge}.${signature}`,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`authentification refusee : ${j.error_description ?? j.error}`);
  return j.access_token;
}

/* ─── appels API ───────────────────────────────────────────────────────── */

const jeton = await obtenirJeton();
const cible = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;

/** Une requete Search Analytics, paginee jusqu'a epuisement des lignes. */
async function interroger({ startDate, endDate, dimensions, rowLimit = 25000 }) {
  const lignes = [];
  for (let startRow = 0; ; startRow += rowLimit) {
    const r = await fetch(cible, {
      method: "POST",
      headers: { authorization: `Bearer ${jeton}`, "content-type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions, rowLimit, startRow, type: "web" }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      if (r.status === 403) {
        console.error(`\n✗ Acces refuse sur ${SITE}.\n`);
        console.error("Les identifiants sont bons — c'est l'autorisation dans Search Console");
        console.error("qui manque. Search Console › Parametres › Utilisateurs et autorisations");
        console.error(`› Ajouter un utilisateur › ${EMAIL}\n`);
        console.error("Si le compte y figure deja, verifiez que GSC_SITE_URL designe bien la");
        console.error("propriete : « sc-domain:cartoonova.com » pour une propriete de domaine,");
        console.error("« https://www.cartoonova.com/ » (avec la barre finale) pour un prefixe d'URL.");
        process.exit(1);
      }
      throw new Error(`${r.status} — ${e.error?.message ?? "erreur inconnue"}`);
    }
    const lot = (await r.json()).rows ?? [];
    lignes.push(...lot);
    if (lot.length < rowLimit) return lignes;
  }
}

/* ─── classement des URL ───────────────────────────────────────────────── */

function classer(url) {
  let chemin;
  try {
    chemin = new URL(url).pathname;
  } catch {
    return { locale: "?", gabarit: "?" };
  }
  const segments = chemin.split("/").filter(Boolean);
  const locale = LOCALES.includes(segments[0]) ? segments[0] : "(sans langue)";
  const reste = LOCALES.includes(segments[0]) ? segments.slice(1) : segments;

  if (reste.length === 0) return { locale, gabarit: "accueil" };
  const [tete, ...queue] = reste;

  if (tete === "cadeau") return { locale, gabarit: queue.length ? "cadeau-occasion" : "cadeau-index" };
  if (tete === "blog") return { locale, gabarit: queue.length ? "blog-article" : "blog-index" };
  if (tete === "collections") return { locale, gabarit: "collections" };
  if (tete === "portrait-personnalise-cartoon") return { locale, gabarit: "pilier" };
  if (PAGES_LEGALES.has(tete)) return { locale, gabarit: "legal" };
  if (PAGES_SIMPLES.has(tete)) return { locale, gabarit: tete };
  if (tete === "admin" || tete === "simpson-mockups") return { locale, gabarit: "(a desindexer)" };
  return { locale, gabarit: "fiche-produit" };
}

/* ─── ecriture CSV ─────────────────────────────────────────────────────── */

function ecrireCsv(fichier, entetes, lignes) {
  const echapper = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const contenu = [entetes.join(","), ...lignes.map((l) => l.map(echapper).join(","))].join("\n");
  fs.writeFileSync(fichier, contenu + "\n");
  return lignes.length;
}

const arrondi = (n) => Math.round(n * 100) / 100;

/* ─── deroule ──────────────────────────────────────────────────────────── */

const argJours = process.argv.find((a) => a.startsWith("--jours="));
const jours = argJours ? Number(argJours.split("=")[1]) : 90;

const finDispo = new Date(Date.now() - 3 * 86400000);
const endDate = finDispo.toISOString().slice(0, 10);
const startDate = new Date(finDispo.getTime() - jours * 86400000).toISOString().slice(0, 10);

console.log(`propriete : ${SITE}`);
console.log(`fenetre   : ${startDate} → ${endDate} (${jours} jours)\n`);

const parJour = await interroger({ startDate, endDate, dimensions: ["date"] });

if (parJour.length === 0) {
  console.log("Aucune donnee sur cette fenetre.");
  console.log("Soit la propriete vient d'etre verifiee — Search Console ne retropropage pas,");
  console.log("il faut laisser passer quelques jours — soit le site ne recoit pas encore");
  console.log("d'impressions. Relancez dans 3 a 7 jours.");
  process.exit(0);
}

const dossier = path.join(RACINE, `baseline-${endDate}`);
fs.mkdirSync(dossier, { recursive: true });

const total = parJour.reduce(
  (a, r) => ({ clics: a.clics + r.clicks, impressions: a.impressions + r.impressions }),
  { clics: 0, impressions: 0 }
);

console.log(`premier jour avec donnees : ${parJour[0].keys[0]}`);
console.log(`total : ${total.clics} clics, ${total.impressions} impressions\n`);

ecrireCsv(
  path.join(dossier, "par-jour.csv"),
  ["date", "clics", "impressions", "ctr", "position"],
  parJour.map((r) => [r.keys[0], r.clicks, r.impressions, arrondi(r.ctr * 100), arrondi(r.position)])
);

const parPage = await interroger({ startDate, endDate, dimensions: ["page"] });
ecrireCsv(
  path.join(dossier, "par-page.csv"),
  ["url", "langue", "gabarit", "clics", "impressions", "ctr", "position"],
  parPage.map((r) => {
    const { locale, gabarit } = classer(r.keys[0]);
    return [r.keys[0], locale, gabarit, r.clicks, r.impressions, arrondi(r.ctr * 100), arrondi(r.position)];
  })
);

const parRequete = await interroger({ startDate, endDate, dimensions: ["query"] });
ecrireCsv(
  path.join(dossier, "par-requete.csv"),
  ["requete", "clics", "impressions", "ctr", "position"],
  parRequete.map((r) => [r.keys[0], r.clicks, r.impressions, arrondi(r.ctr * 100), arrondi(r.position)])
);

const parPageRequete = await interroger({ startDate, endDate, dimensions: ["page", "query"] });
ecrireCsv(
  path.join(dossier, "par-page-et-requete.csv"),
  ["url", "langue", "gabarit", "requete", "clics", "impressions", "ctr", "position"],
  parPageRequete.map((r) => {
    const { locale, gabarit } = classer(r.keys[0]);
    return [r.keys[0], locale, gabarit, r.keys[1], r.clicks, r.impressions, arrondi(r.ctr * 100), arrondi(r.position)];
  })
);

const parPays = await interroger({ startDate, endDate, dimensions: ["country", "device"] });
ecrireCsv(
  path.join(dossier, "par-pays-et-appareil.csv"),
  ["pays", "appareil", "clics", "impressions", "ctr", "position"],
  parPays.map((r) => [r.keys[0], r.keys[1], r.clicks, r.impressions, arrondi(r.ctr * 100), arrondi(r.position)])
);

/* ─── synthese langue × gabarit ────────────────────────────────────────── */

const synthese = new Map();
for (const r of parPage) {
  const { locale, gabarit } = classer(r.keys[0]);
  const cle = `${locale} ${gabarit}`;
  const acc = synthese.get(cle) ?? { locale, gabarit, urls: 0, clics: 0, impressions: 0, pos: 0 };
  acc.urls += 1;
  acc.clics += r.clicks;
  acc.impressions += r.impressions;
  acc.pos += r.position * r.impressions;
  synthese.set(cle, acc);
}

const rangs = [...synthese.values()]
  .map((a) => ({ ...a, position: a.impressions ? a.pos / a.impressions : 0 }))
  .sort((a, b) => b.impressions - a.impressions);

ecrireCsv(
  path.join(dossier, "synthese-langue-gabarit.csv"),
  ["langue", "gabarit", "urls", "clics", "impressions", "position_moyenne"],
  rangs.map((a) => [a.locale, a.gabarit, a.urls, a.clics, a.impressions, arrondi(a.position)])
);

console.log("langue  gabarit           URL   clics  impressions  pos.");
for (const a of rangs) {
  console.log(
    `${a.locale.padEnd(7)} ${a.gabarit.padEnd(17)} ${String(a.urls).padStart(4)} ${String(a.clics).padStart(6)} ${String(a.impressions).padStart(12)}  ${arrondi(a.position)}`
  );
}

console.log(`\nURL distinctes vues par Google : ${parPage.length}`);
console.log(`requetes distinctes (hors anonymisees) : ${parRequete.length}`);
console.log(`\nCSV ecrits dans ${dossier}/`);
