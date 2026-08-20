import { chromium } from "playwright";

/** Pilote la fiche produit comme un client : options, prix, tunnel de commande. */

const SORTIE = process.argv[2] ?? "captures";
const BASE = "http://localhost:3000";

const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1440, height: 950 } });

const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text().slice(0, 200));
});

await page.goto(`${BASE}/fr/simpson`, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".total__prix", { timeout: 30000 });

const prix = () => page.locator(".total__prix").innerText();
const etapes = async () =>
  page.locator(".etape-conf__titre").evaluateAll((n) =>
    n.map((e) => e.textContent.replace(/\s+/g, " ").trim())
  );

console.log("étapes du configurateur :");
for (const e of await etapes()) console.log("   ·", e);

console.log("\nprix de départ            :", await prix());

await page.locator('.pastilles button[data-essai], .pastilles button').nth(2).click();
await page.waitForTimeout(400);
console.log("après 3 personnages       :", await prix());

await page.locator(".vignette--texte").nth(1).click();
await page.waitForTimeout(400);
console.log("après cadrage corps entier:", await prix());

await page.locator(".vignette--large").nth(2).click();
await page.waitForTimeout(400);
console.log("après support « toile »   :", await prix());

const recap = await page.locator(".recap span").evaluateAll((n) => n.map((e) => e.textContent));
console.log("récapitulatif             :", recap.join(" · "));

// Zone de dépôt présente et cliquable
console.log("zone de dépôt photo       :", (await page.locator(".depot").count()) > 0 ? "présente" : "ABSENTE");
console.log("champ fichier             :", (await page.locator('input[type="file"]').count()) > 0 ? "présent" : "ABSENT");

// Tunnel de commande
await page.locator(".ajouter").click();
await page.waitForSelector("[data-checkout-modal]", { timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SORTIE}/06-tunnel.png` });
console.log("tunnel de commande        : ouvert");

console.log("\nerreurs console/page      :", erreurs.length === 0 ? "aucune" : erreurs.slice(0, 5).join(" | "));

await navigateur.close();
