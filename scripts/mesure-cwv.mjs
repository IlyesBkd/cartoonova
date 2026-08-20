/**
 * Mesure les Core Web Vitals gabarit par gabarit, et dit quel element porte
 * le LCP.
 *
 *   node scripts/mesure-cwv.mjs [base] [--passes=5]
 *
 * `base` vaut http://localhost:3000 par defaut ; passer l'URL de production
 * pour comparer. Emulation Pixel 7, CPU divise par quatre, 1,6 Mbit/s : le
 * profil « mobile moyen » sur lequel Google juge.
 *
 * Chaque gabarit est charge plusieurs fois et la MEDIANE est retenue. Ce
 * n'est pas un raffinement : en un seul passage, l'ecart entre deux mesures
 * du meme build atteint 40 %, de quoi faire croire a une amelioration ou a
 * une regression qui n'existe pas. L'ecart entre le minimum et le maximum est
 * affiche pour qu'on sache quelle confiance accorder au chiffre.
 *
 * Ce n'est pas Lighthouse et ce ne sont pas des donnees de terrain. C'est une
 * mesure reproductible, faite dans les memes conditions avant et apres.
 * L'INP n'y figure pas : il demande une interaction reelle, pas un chargement.
 */

import { chromium, devices } from "playwright";

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000").replace(/\/$/, "");
const PASSAGES = Number(args.find((a) => a.startsWith("--passes="))?.split("=")[1] ?? 5);

const mediane = (valeurs) => {
  const tri = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(tri.length / 2);
  return tri.length % 2 ? tri[m] : (tri[m - 1] + tri[m]) / 2;
};
const GABARITS = [
  ["accueil", "/fr"],
  ["fiche produit", "/fr/simpson"],
  ["catalogue", "/fr/collections"],
  ["cadeau", "/fr/cadeau/simpson-anniversaire"],
  ["pilier", "/fr/portrait-personnalise-cartoon"],
];

const navigateur = await chromium.launch();
const resultats = [];

for (const [nom, chemin] of GABARITS) {
 const passages = [];
 for (let passage = 0; passage < PASSAGES; passage++) {
  const ctx = await navigateur.newContext({ ...devices["Pixel 7"] });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);

  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  let octets = 0;
  let js = 0;
  let images = 0;
  let requetes = 0;
  page.on("response", async (r) => {
    requetes++;
    try {
      const entetes = r.headers();
      let taille = Number(entetes["content-length"] ?? 0);
      if (!taille) {
        try { taille = (await r.body()).length; } catch { taille = 0; }
      }
      octets += taille;
      const type = entetes["content-type"] ?? "";
      if (type.includes("javascript")) js += taille;
      if (type.startsWith("image/")) images += taille;
    } catch { /* reponse annulee */ }
  });

  await page.addInitScript(() => {
    window.__m = { lcp: 0, cls: 0, cible: "", url: "", fcp: 0 };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__m.lcp = e.startTime;
        window.__m.url = e.url || "";
        const el = e.element;
        window.__m.cible = el
          ? el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : "")
          : "(detache)";
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });

    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });

    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.name === "first-contentful-paint") window.__m.fcp = e.startTime;
    }).observe({ type: "paint", buffered: true });
  });

  await page.goto(BASE + chemin, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(1500);

  const m = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0] ?? {};
    const ressource = window.__m.url
      ? performance.getEntriesByType("resource").find((r) => r.name === window.__m.url)
      : null;
    return {
      ...window.__m,
      ttfb: n.responseStart ?? 0,
      htmlFini: n.responseEnd ?? 0,
      ressourceDebut: ressource?.startTime ?? 0,
      ressourceFin: ressource?.responseEnd ?? 0,
    };
  });

  passages.push({ ...m, octets, js, images, requetes });
  await ctx.close();
 }

 const dernier = passages[passages.length - 1];
 const lcps = passages.map((p) => p.lcp);
 resultats.push({
   nom,
   chemin,
   cible: dernier.cible,
   url: dernier.url,
   htmlFini: dernier.htmlFini,
   ressourceDebut: dernier.ressourceDebut,
   ressourceFin: dernier.ressourceFin,
   lcp: mediane(lcps),
   lcpMin: Math.min(...lcps),
   lcpMax: Math.max(...lcps),
   cls: mediane(passages.map((p) => p.cls)),
   ttfb: mediane(passages.map((p) => p.ttfb)),
   fcp: mediane(passages.map((p) => p.fcp)),
   octets: mediane(passages.map((p) => p.octets)),
   js: mediane(passages.map((p) => p.js)),
   requetes: mediane(passages.map((p) => p.requetes)),
 });
}

await navigateur.close();

const ms = (v) => `${Math.round(v)}`;
const ko = (v) => `${Math.round(v / 1024)}`;
const vert = (lcp) => (lcp <= 2500 ? "vert" : lcp <= 4000 ? "orange" : "ROUGE");

console.log(`\nbase : ${BASE}   —   Pixel 7, CPU /4, 1,6 Mbit/s, mediane de ${PASSAGES} passages\n`);
console.log("gabarit         LCP med  etat    ecart min-max     CLS     TTFB    FCP     poids   JS");
for (const r of resultats) {
  const ecart = `${ms(r.lcpMin)}–${ms(r.lcpMax)}`;
  console.log(
    `${r.nom.padEnd(15)} ${ms(r.lcp).padStart(5)}    ${vert(r.lcp).padEnd(6)}  ${ecart.padStart(12)}      ${r.cls.toFixed(3)}   ${ms(r.ttfb).padStart(4)}    ${ms(r.fcp).padStart(4)}    ${ko(r.octets).padStart(5)}   ${ko(r.js).padStart(5)}`
  );
}

console.log("\nce qui porte le LCP");
for (const r of resultats) {
  console.log(`  ${r.nom.padEnd(15)} ${r.cible}`);
  if (r.url) {
    console.log(`  ${" ".repeat(15)} ${r.url.replace(BASE, "").slice(0, 88)}`);
    console.log(`  ${" ".repeat(15)} decouverte ${ms(r.ressourceDebut - r.htmlFini)} ms apres la fin du HTML, recue a ${ms(r.ressourceFin)} ms`);
  }
}

const rouges = resultats.filter((r) => r.lcp > 2500).length;
console.log(`\n${rouges} gabarit(s) sur ${resultats.length} au-dessus du seuil LCP de 2 500 ms.`);
