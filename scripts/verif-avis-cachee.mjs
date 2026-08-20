import { chromium } from "playwright";

const D = process.argv[2] ?? "captures";
const CAS = [
  { slug: "portrait-batman-personnalise", attendu: "absente" },
  { slug: "portrait-demon-slayer-personnalise", attendu: "presente" },
  { slug: "simpson", attendu: "presente" },
];

const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1440, height: 950 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text().slice(0, 200)); });

for (const c of CAS) {
  await page.goto(`http://localhost:3000/fr/${c.slug}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".galerie__vue", { timeout: 30000 });
  await page.waitForTimeout(1200);

  const section = page.locator("#avis");
  const present = (await section.count()) > 0;
  const cartes = present ? await page.locator("#avis .avis-carte").count() : 0;
  const substituts = present ? await page.locator("#avis .substitut").count() : 0;

  const etat = present ? "presente" : "absente";
  const ok = etat === c.attendu && substituts === 0;
  console.log(
    `${c.slug.padEnd(38)} section=${etat.padEnd(9)} cartes=${cartes}  substituts=${substituts}  ${ok ? "OK" : "ECART"}`
  );

  await page.screenshot({ path: `${D}/avis-${c.slug}.png`, fullPage: false });
}

console.log("\nerreurs console/page :", erreurs.length === 0 ? "aucune" : erreurs.slice(0, 5).join(" | "));
await navigateur.close();
