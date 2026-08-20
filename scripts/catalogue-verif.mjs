import { chromium } from "playwright";

/** Vérifie la page catalogue comme un visiteur : filtres, recherche, survol. */

const SORTIE = process.argv[2] ?? "captures";
const BASE = "http://localhost:3000";

const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1440, height: 950 } });

const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text().slice(0, 200));
});

await page.goto(`${BASE}/fr/collections`, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".carte", { timeout: 30000 });
await page.waitForTimeout(1500);

const cartes = () => page.locator(".carte").count();
const compte = () => page.locator(".catalogue-compte").innerText();

console.log("à l'ouverture        :", await cartes(), "cartes ·", await compte());
await page.screenshot({ path: `${SORTIE}/09-catalogue.png` });
await page.screenshot({ path: `${SORTIE}/09-catalogue-pleine.png`, fullPage: true });

// Filtre par catégorie
await page.locator(".filtre").nth(3).click();
await page.waitForTimeout(500);
console.log("filtre « Comics »    :", await cartes(), "cartes ·", await compte());

await page.locator(".filtre").first().click();
await page.waitForTimeout(400);

// Recherche
await page.locator(".recherche input").fill("bat");
await page.waitForTimeout(500);
const noms = await page.locator(".carte h3").evaluateAll((n) => n.map((e) => e.textContent));
console.log('recherche « bat »    :', await cartes(), "carte(s) ·", noms.join(", "));
await page.screenshot({ path: `${SORTIE}/10-catalogue-recherche.png` });

await page.locator(".recherche input").fill("zzzz");
await page.waitForTimeout(500);
const vide = await page.locator(".catalogue-vide h3").count();
console.log("recherche sans suite :", vide ? "état vide affiché" : "AUCUN état vide");

await page.locator(".recherche button").click();
await page.waitForTimeout(400);
console.log("après effacement     :", await cartes(), "cartes");

// Barre collante : reste-t-elle visible en défilant ?
await page.evaluate(() => window.scrollTo(0, 2200));
await page.waitForTimeout(700);
const barre = await page.locator(".barre-tri").boundingBox();
console.log("barre de tri à 2200px:", barre && barre.y >= 0 && barre.y < 200 ? `collée (y=${Math.round(barre.y)})` : `PERDUE (y=${barre && Math.round(barre.y)})`);
await page.screenshot({ path: `${SORTIE}/11-catalogue-collant.png` });

// Survol : le second visuel apparaît-il ?
await page.evaluate(() => window.scrollTo(0, 900));
await page.waitForTimeout(500);
const survolAvant = await page.locator(".carte__image--survol").first().evaluate((n) => getComputedStyle(n).opacity);
await page.locator(".carte").first().hover();
await page.waitForTimeout(700);
const survolApres = await page.locator(".carte__image--survol").first().evaluate((n) => getComputedStyle(n).opacity);
console.log(`survol carte         : opacité ${survolAvant} -> ${survolApres}`);

console.log("\nerreurs console      :", erreurs.length === 0 ? "aucune" : erreurs.slice(0, 4).join(" | "));

// Mobile
const mobile = await navigateur.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const pm = await mobile.newPage();
await pm.goto(`${BASE}/fr/collections`, { waitUntil: "domcontentloaded" });
await pm.waitForTimeout(2000);
await pm.screenshot({ path: `${SORTIE}/12-catalogue-mobile.png` });

await navigateur.close();
