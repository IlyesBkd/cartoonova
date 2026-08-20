/**
 * Verifie sur le HTML reellement servi ce que la compilation ne dit pas.
 *
 *   node --experimental-strip-types --env-file=.env.local \
 *        --import ./scripts/charge-ts.mjs scripts/verifie-seo.mjs [base]
 *
 * `base` vaut http://localhost:3000 par defaut. Passer l'URL de production
 * pour rejouer les memes assertions apres un deploiement — c'est le seul
 * moyen de savoir que ce qui a ete verifie en local est bien ce qui est en
 * ligne.
 *
 * Chaque assertion correspond a un defaut releve dans l'audit du 2026-08-20.
 * Sortie 0 si tout passe, 1 sinon : utilisable en CI ou en post-deploiement.
 */

import { locales } from "../i18n/config.ts";
import { CATALOGUE_EN_LIGNE, produitParSlug, slugProduit, slugsProduit } from "../lib/catalogue.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const CANONIQUE = "https://www.cartoonova.com";

let echecs = 0;
let total = 0;

function verifie(nom, condition, detail = "") {
  total++;
  if (!condition) echecs++;
  console.log(`${condition ? "  ok  " : "ECHEC "} ${nom}${detail ? "  — " + detail : ""}`);
}

function section(titre) {
  console.log(`\n— ${titre} —`);
}

async function page(chemin) {
  const r = await fetch(BASE + chemin, { redirect: "manual" });
  if (r.status >= 300 && r.status < 400) {
    return { statut: r.status, location: r.headers.get("location"), html: "" };
  }
  const html = await r.text();
  return {
    statut: r.status,
    html,
    lang: (html.match(/<html[^>]*lang="([^"]*)"/) || [])[1],
    titre: (html.match(/<title>([^<]*)<\/title>/) || [])[1],
    canonical: (html.match(/rel="canonical" href="([^"]*)"/) || [])[1],
    robots: (html.match(/<meta name="robots" content="([^"]*)"/) || [])[1],
    hreflangs: Object.fromEntries(
      [...html.matchAll(/hrefLang="([^"]*)" href="([^"]*)"/gi)].map((m) => [m[1], m[2]])
    ),
    jsonld: [...html.matchAll(/application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
      .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
      .filter(Boolean),
  };
}

/* ─── langue declaree ──────────────────────────────────────────────────── */

section("attribut lang");
for (const l of locales) {
  const p = await page(`/${l}`);
  verifie(`/${l} declare lang="${l}"`, p.lang === l, `lu: ${p.lang}`);
}

/* ─── canonical et hreflang ────────────────────────────────────────────── */

section("canonical des gabarits qui pointaient vers l'accueil");
for (const chemin of ["/a-propos", "/avis", "/contact", "/portfolio"]) {
  for (const l of ["fr", "de"]) {
    const p = await page(`/${l}${chemin}`);
    verifie(`/${l}${chemin}`, p.canonical === `${CANONIQUE}/${l}${chemin}`, p.canonical);
  }
}

section("x-default");
for (const chemin of ["/fr", "/fr/simpson", "/fr/collections", "/fr/avis"]) {
  const p = await page(chemin);
  verifie(`${chemin}`, Boolean(p.hreflangs["x-default"]), Object.keys(p.hreflangs).join(","));
}

/* ─── slugs produit localises ──────────────────────────────────────────── */

section("slugs produit localises");

const naruto = produitParSlug("portrait-naruto-personnalise");
if (naruto) {
  const attendus = slugsProduit(naruto);
  for (const l of locales) {
    const p = await page(`/${l}/${attendus[l]}`);
    verifie(`/${l}/${attendus[l]} repond`, p.statut === 200, `statut ${p.statut}`);
  }

  // L'ancien slug francais doit rediriger de facon permanente hors francais.
  for (const l of ["en", "de", "es", "it"]) {
    const p = await page(`/${l}/portrait-naruto-personnalise`);
    verifie(
      `/${l}/portrait-naruto-personnalise → 308`,
      p.statut === 308 && p.location?.endsWith(attendus[l]),
      `${p.statut} → ${p.location}`
    );
  }

  // Les hreflang d'une fiche doivent porter le slug de chaque langue.
  const p = await page(`/en/${attendus.en}`);
  const coherents = locales.every((l) => p.hreflangs[l]?.endsWith(`/${l}/${attendus[l]}`));
  verifie("hreflang de la fiche portent chacun leur slug", coherents, JSON.stringify(p.hreflangs));
}

section("univers historiques inchanges");
for (const slug of ["simpson", "dbz", "disney", "ghibli", "onepiece", "rickandmorty"]) {
  const produit = produitParSlug(slug);
  const identique = produit && locales.every((l) => slugProduit(produit, l) === slug);
  verifie(`${slug} garde son slug dans les cinq langues`, Boolean(identique));
}

section("aucune collision de slug");
const vus = new Set();
let collisions = 0;
for (const l of locales) {
  for (const produit of CATALOGUE_EN_LIGNE) {
    const cle = `${l}:${slugProduit(produit, l)}`;
    if (vus.has(cle)) collisions++;
    vus.add(cle);
  }
}
verifie("175 slugs distincts", collisions === 0 && vus.size === locales.length * CATALOGUE_EN_LIGNE.length, `${vus.size} slugs, ${collisions} collisions`);

/* ─── indexation ───────────────────────────────────────────────────────── */

section("pages non traduites : noindex hors francais");
for (const chemin of ["/cgv", "/mentions-legales", "/politique-de-confidentialite", "/portrait-personnalise-cartoon"]) {
  const fr = await page(`/fr${chemin}`);
  const de = await page(`/de${chemin}`);
  verifie(`/fr${chemin} indexable`, !/noindex/.test(fr.robots ?? ""), fr.robots);
  verifie(`/de${chemin} noindex`, /noindex/.test(de.robots ?? ""), de.robots);
}

section("back-office");
const admin = await page("/fr/admin");
verifie("/fr/admin noindex", /noindex/.test(admin.robots ?? ""), admin.robots);

/* ─── redirections ─────────────────────────────────────────────────────── */

section("redirections");
const racine = await page("/");
verifie("/ en 307 — la cible depend du pays", racine.statut === 307, `${racine.statut} → ${racine.location}`);
for (const ancienne of ["/avis", "/a-propos", "/cgv", "/simpson", "/collections"]) {
  const r = await page(ancienne);
  verifie(`${ancienne} → 308`, r.statut === 308, `${r.statut} → ${r.location}`);
}

/* ─── balisage ─────────────────────────────────────────────────────────── */

section("balisage de l'accueil");
const accueil = await page("/fr");
const types = accueil.jsonld.flatMap((j) => (j["@graph"] ? j["@graph"].map((x) => x["@type"]) : [j["@type"]]));
verifie("Organization", types.includes("Organization"), types.join(", "));
verifie("WebSite", types.includes("WebSite"));
verifie("pas de SearchAction sans page de recherche", !JSON.stringify(accueil.jsonld).includes("SearchAction"));

/* ─── sitemap et robots ────────────────────────────────────────────────── */

section("sitemap et robots.txt");
const robots = await (await fetch(`${BASE}/robots.txt`)).text();
verifie("robots couvre /*/admin", robots.includes("/*/admin"));
verifie("robots couvre /*/simpson-mockups", robots.includes("/*/simpson-mockups"));

const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
verifie("portfolio dans le sitemap", locs.some((u) => u.endsWith("/fr/portfolio")));
verifie("avis dans le sitemap", locs.some((u) => u.endsWith("/fr/avis")));
verifie("cgv en francais seulement", locs.filter((u) => u.includes("/cgv")).length === 1);

if (naruto) {
  const attendus = slugsProduit(naruto);
  const localises = locales.every((l) => locs.includes(`${CANONIQUE}/${l}/${attendus[l]}`));
  verifie("sitemap porte les slugs localises", localises);
  verifie("sitemap ne porte plus le slug francais hors fr", !locs.some((u) => /\/(en|de|es|it)\/portrait-naruto-personnalise$/.test(u)));
}

console.log(`\n${echecs === 0 ? `TOUT PASSE — ${total} assertions` : `${echecs} ECHEC(S) sur ${total}`}`);
process.exit(echecs === 0 ? 0 : 1);
