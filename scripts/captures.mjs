import { chromium } from "playwright";
import fs from "node:fs";

const SORTIE = process.argv[2] ?? "captures";
const BASE = "http://localhost:3000";

const pages = [
  { nom: "01-accueil", url: "/fr", pleine: true },
  { nom: "02-accueil-haut", url: "/fr", pleine: false },
  { nom: "03-collections", url: "/fr/collections", pleine: false },
  { nom: "04-produit-simpson", url: "/fr/simpson", pleine: false },
  { nom: "05-produit-batman", url: "/fr/portrait-batman-personnalise", pleine: false },
  { nom: "07-produit-naruto", url: "/fr/portrait-naruto-personnalise", pleine: false },
  { nom: "08-produit-pokemon", url: "/fr/carte-pokemon-personnalisee", pleine: false },
];

fs.mkdirSync(SORTIE, { recursive: true });

const navigateur = await chromium.launch();

// Bureau
const bureau = await navigateur.newContext({ viewport: { width: 1440, height: 950 } });
for (const p of pages) {
  const page = await bureau.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") erreurs.push(m.text());
  });

  await page.goto(BASE + p.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SORTIE}/${p.nom}.png`, fullPage: p.pleine });

  const titre = await page.title();
  console.log(`${p.nom.padEnd(22)} ${p.url.padEnd(38)} « ${titre} »`);
  if (erreurs.length) console.log(`   ⚠ ${erreurs.length} erreur(s) : ${erreurs.slice(0, 3).join(" | ").slice(0, 300)}`);
  await page.close();
}

// Mobile
const mobile = await navigateur.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
for (const p of [pages[1], pages[2], pages[3]]) {
  const page = await mobile.newPage();
  await page.goto(BASE + p.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${SORTIE}/m-${p.nom}.png` });
  await page.close();
}

await navigateur.close();
console.log("captures ecrites dans " + SORTIE);
