import { chromium } from "playwright";
import fs from "node:fs";

const D = process.argv[2] ?? "captures";
fs.mkdirSync(D, { recursive: true });

const PAGES = [
  { nom: "accueil", url: "/fr" },
  { nom: "collections", url: "/fr/collections" },
  { nom: "produit-pourvu-simpson", url: "/fr/simpson" },
  { nom: "produit-pourvu-demonslayer", url: "/fr/portrait-demon-slayer-personnalise" },
  { nom: "produit-pauvre-batman", url: "/fr/portrait-batman-personnalise" },
  { nom: "produit-pauvre-strangerthings", url: "/fr/portrait-stranger-things-personnalise" },
  { nom: "avis", url: "/fr/avis" },
  { nom: "portfolio", url: "/fr/portfolio" },
  { nom: "a-propos", url: "/fr/a-propos" },
  { nom: "contact", url: "/fr/contact" },
  { nom: "cadeau", url: "/fr/cadeau" },
  { nom: "blog", url: "/fr/blog" },
  { nom: "cgv", url: "/fr/cgv" },
  { nom: "en-accueil", url: "/en" },
  { nom: "en-produit", url: "/en/portrait-attaque-des-titans-personnalise" },
];

const navigateur = await chromium.launch();
const rapport = [];

async function auditePage(ctx, p, mobile) {
  const page = await ctx.newPage();
  const erreurs = [];
  const requetesEchouees = [];
  page.on("pageerror", (e) => erreurs.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text().slice(0, 200)); });
  page.on("requestfailed", (r) => requetesEchouees.push(r.url().slice(0, 120)));
  page.on("response", (r) => { if (r.status() >= 400) requetesEchouees.push(`${r.status()} ${r.url().slice(0, 100)}`); });

  let statut = "";
  try {
    const resp = await page.goto(`http://localhost:3000${p.url}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    statut = resp ? String(resp.status()) : "?";
    await page.waitForTimeout(2200);
  } catch (e) {
    statut = "TIMEOUT/ECHEC: " + String(e).slice(0, 100);
  }

  // Images cassees : naturalWidth === 0 sur un <img> charge (hors lazy hors-ecran non forcees)
  const imagesCassees = await page.evaluate(() => {
    return [...document.querySelectorAll("img")]
      .filter((img) => img.complete && img.naturalWidth === 0 && img.src)
      .map((img) => img.src.slice(0, 140));
  });

  // Debordement horizontal
  const debordement = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);

  const nom = `${p.nom}${mobile ? "-m" : ""}`;
  await page.screenshot({ path: `${D}/${nom}.png`, fullPage: true }).catch(() => {});

  rapport.push({ nom, url: p.url, statut, erreurs, requetesEchouees, imagesCassees, debordement });
  await page.close();
}

const bureau = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
const mobile = await navigateur.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });

for (const p of PAGES) await auditePage(bureau, p, false);
for (const p of PAGES.slice(0, 6)) await auditePage(mobile, p, true);

await navigateur.close();

console.log("\n=== RAPPORT ===\n");
for (const r of rapport) {
  const soucis = r.erreurs.length || r.requetesEchouees.length || r.imagesCassees.length || r.debordement;
  console.log(`${r.nom.padEnd(32)} ${r.statut.padEnd(6)} ${soucis ? "⚠" : "ok"}`);
  if (r.erreurs.length) console.log("   erreurs JS      :", r.erreurs.slice(0, 3).join(" | "));
  if (r.requetesEchouees.length) console.log("   requetes KO    :", [...new Set(r.requetesEchouees)].slice(0, 5).join(" | "));
  if (r.imagesCassees.length) console.log("   images cassees :", r.imagesCassees.slice(0, 5).join(" | "));
  if (r.debordement) console.log("   debordement horizontal detecte");
}

fs.writeFileSync(`${D}/rapport.json`, JSON.stringify(rapport, null, 2));
