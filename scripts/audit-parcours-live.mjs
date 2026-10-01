import { chromium, devices } from "playwright";
import fs from "node:fs";

/** Audit du parcours client sur le site en ligne : balayage des pages sur
    mobile et bureau, puis parcours d'achat jusqu'au formulaire de carte.
    Aucun paiement n'est lance. La mesure PostHog est coupee pour ne pas
    fausser l'entonnoir avec des visites d'audit. */

const D = process.argv[2] ?? "captures-audit";
const BASE = process.argv[3] ?? "https://www.cartoonova.com";
fs.mkdirSync(D, { recursive: true });

const PAGES = [
  { nom: "accueil", url: "/fr" },
  { nom: "collections", url: "/fr/collections" },
  { nom: "simpson", url: "/fr/simpson" },
  { nom: "pokemon", url: "/fr/carte-pokemon-personnalisee" },
  { nom: "starwars", url: "/fr/portrait-star-wars-personnalise" },
  { nom: "batman", url: "/fr/portrait-batman-personnalise" },
  { nom: "landing", url: "/fr/portrait-personnalise-cartoon" },
  { nom: "avis", url: "/fr/avis" },
  { nom: "portfolio", url: "/fr/portfolio" },
  { nom: "cadeau", url: "/fr/cadeau" },
  { nom: "a-propos", url: "/fr/a-propos" },
  { nom: "contact", url: "/fr/contact" },
  { nom: "blog", url: "/fr/blog" },
  { nom: "cgv", url: "/fr/cgv" },
  { nom: "en-accueil", url: "/en" },
  { nom: "sv-simpson", url: "/sv/simpson" },
  { nom: "introuvable", url: "/fr/cette-page-n-existe-pas" },
];

const navigateur = await chromium.launch();
const rapport = { pages: [], parcours: [] };

async function contexte(mobile) {
  const ctx = await navigateur.newContext(
    mobile
      ? { ...devices["iPhone 13"], locale: "fr-FR" }
      : { viewport: { width: 1440, height: 900 }, locale: "fr-FR" }
  );
  await ctx.route(/posthog|\/ingest\//, (r) => r.abort());
  return ctx;
}

function ecoute(page) {
  const erreurs = [];
  const ko = [];
  page.on("pageerror", (e) => erreurs.push(String(e).slice(0, 220)));
  page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text().slice(0, 220)); });
  page.on("response", (r) => {
    if (r.status() >= 400 && !/posthog|ingest/.test(r.url())) ko.push(`${r.status()} ${r.url().slice(0, 130)}`);
  });
  return { erreurs, ko };
}

const releve = () => {
  const vw = document.documentElement.clientWidth;
  const vh = innerHeight;
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const cliquables = [...document.querySelectorAll("a, button, input, select, textarea, summary")].filter(visible);
  const petits = cliquables
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.width < 40 || r.height < 40)
    .map(({ e, r }) => `${e.tagName.toLowerCase()}[${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 24)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
  const petitsTextes = new Set();
  for (const e of document.querySelectorAll("p, span, a, li, small, label, button, em, b")) {
    if (!visible(e) || !e.textContent.trim() || e.children.length) continue;
    const t = parseFloat(getComputedStyle(e).fontSize);
    if (t < 12) petitsTextes.add(`${t}px « ${e.textContent.trim().slice(0, 30)} »`);
  }
  const debordants = [...document.querySelectorAll("body *")]
    .filter((e) => visible(e) && e.getBoundingClientRect().right > vw + 2)
    .slice(0, 5)
    .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`);
  const imgs = [...document.querySelectorAll("img")];
  return {
    titre: document.title,
    h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim().slice(0, 80)),
    hauteur: document.documentElement.scrollHeight,
    ecrans: +(document.documentElement.scrollHeight / vh).toFixed(1),
    debordement: document.documentElement.scrollWidth > vw + 2,
    debordants,
    imagesCassees: imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.src).map((i) => i.src.slice(0, 140)),
    imagesSansAlt: imgs.filter((i) => !i.hasAttribute("alt")).length,
    nbPetitesCibles: petits.length,
    petitesCibles: [...new Set(petits)].slice(0, 14),
    petitsTextes: [...petitsTextes].slice(0, 10),
    langue: document.documentElement.lang,
  };
};

async function balayer(mobile) {
  const ctx = await contexte(mobile);
  for (const p of PAGES) {
    const page = await ctx.newPage();
    const { erreurs, ko } = ecoute(page);
    const suffixe = mobile ? "m" : "d";
    let statut = "?";
    const debut = Date.now();
    try {
      const rep = await page.goto(BASE + p.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      statut = String(rep?.status());
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    } catch (e) {
      statut = "ECHEC " + String(e).slice(0, 80);
    }
    const duree = Date.now() - debut;
    // Force le chargement des images paresseuses avant de compter les cassees.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      scrollTo(0, 0);
    }).catch(() => {});
    await page.waitForTimeout(900);
    const r = await page.evaluate(releve).catch((e) => ({ erreur: String(e) }));
    await page.screenshot({ path: `${D}/${p.nom}-${suffixe}-1.png` }).catch(() => {});
    if (mobile) {
      await page.evaluate(() => scrollTo(0, innerHeight * 0.95));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${D}/${p.nom}-${suffixe}-2.png` }).catch(() => {});
    }
    rapport.pages.push({ nom: `${p.nom}-${suffixe}`, url: p.url, statut, duree, erreurs: [...new Set(erreurs)], ko: [...new Set(ko)], ...r });
    await page.close();
  }
  await ctx.close();
}

async function parcours(mobile, url, support, nom) {
  const ctx = await contexte(mobile);
  const page = await ctx.newPage();
  const { erreurs, ko } = ecoute(page);
  const j = { nom, url, etapes: [] };
  const note = (k, v) => { j.etapes.push([k, v]); };
  const photo = (n) => page.screenshot({ path: `${D}/parcours-${nom}-${n}.png` }).catch(() => {});
  try {
    await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(".total__prix", { timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector(".total__prix")?.textContent.includes("—"), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);

    const y = (sel) => page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null;
    }, sel);
    note("hauteur ecran", page.viewportSize().height);
    note("y prix haut", await y(".panneau__prix"));
    note("y h1", await y("h1"));
    note("y configurateur", await y("#configurateur"));
    note("y depot photo", await y(".depot"));
    note("y bouton achat", await y(".ajouter"));
    note("y avis", await y("#avis"));
    note("hauteur page", await page.evaluate(() => document.documentElement.scrollHeight));
    note("etapes", await page.locator(".etape-conf__titre").evaluateAll((n) => n.map((e) => e.textContent.replace(/\s+/g, " ").trim())));
    note("preuve", await page.locator(".panneau__preuve").innerText().catch(() => ""));
    note("prix depart", await page.locator(".panneau__prix").innerText());
    note("livraison", await page.locator(".livraison").innerText().catch(() => ""));
    note("supports", await page.locator(".vignette--large").evaluateAll((n) => n.map((e) => e.innerText.replace(/\n+/g, " / "))));
    note("note depot", await page.locator(".depot__note").innerText().catch(() => ""));
    note("garantie", await page.locator(".garantie").innerText().catch(() => ""));
    await photo("01-haut");

    // Configurateur, ecran par ecran.
    const conf = await y("#configurateur");
    for (let i = 0; i < 4; i++) {
      await page.evaluate((v) => scrollTo(0, v), conf + i * page.viewportSize().height * 0.9);
      await page.waitForTimeout(350);
      await photo(`02-conf-${i + 1}`);
    }

    await page.locator(".pastilles").first().locator("button").nth(1).click();
    await page.waitForTimeout(250);
    note("prix 2 personnes", await page.locator(".total__prix").innerText());
    if (support > 0) {
      await page.locator(".vignette--large").nth(support).click();
      await page.waitForTimeout(250);
      note("prix avec support", await page.locator(".total__prix").innerText());
    }
    note("total bas", await page.locator(".total").innerText());

    // Barre collante : visible une fois le bouton depasse ?
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight * 0.6));
    await page.waitForTimeout(600);
    note("barre collante visible", await page.locator(".barre-achat--visible").count());
    await photo("03-barre-collante");

    await page.locator(".ajouter").scrollIntoViewIfNeeded();
    await page.locator(".ajouter").click();
    await page.waitForSelector("[data-checkout-modal]", { timeout: 20000 });
    await page.waitForTimeout(1200);
    note("caisse champs", await page.locator("[data-checkout-modal] input, [data-checkout-modal] select, [data-checkout-modal] textarea").count());
    await photo("04-caisse-1");
    await page.locator(".modale__corps").evaluate((e) => e.scrollTo(0, e.scrollHeight));
    await page.waitForTimeout(300);
    await photo("05-caisse-1-bas");

    await page.locator(".modale__pied .bouton--primaire").click();
    await page.waitForTimeout(400);
    note("erreur champ vide", await page.locator(".modale__pied .alerte--erreur").innerText().catch(() => "AUCUN MESSAGE"));
    await photo("06-caisse-erreur");

    if (support === 0) {
      await page.locator("#checkout-email").fill("audit-parcours@example.com");
      await page.locator(".modale__pied .bouton--primaire").click();
      await page.waitForTimeout(9000);
      note("etape paiement", await page.locator(".modale__titre").innerText());
      note("iframes stripe", await page.locator("[data-checkout-modal] iframe").evaluateAll((n) => n.map((f) => `${f.title || f.name} ${Math.round(f.getBoundingClientRect().height)}px`)));
      note("erreur paiement", await page.locator("[data-checkout-modal] .alerte--erreur").innerText().catch(() => "aucune"));
      await photo("07-paiement");
      await page.locator(".modale__corps").evaluate((e) => e.scrollTo(0, e.scrollHeight)).catch(() => {});
      await page.waitForTimeout(300);
      await photo("08-paiement-bas");
    }
  } catch (e) {
    note("ECHEC", String(e).slice(0, 300));
    await photo("99-echec");
  }
  j.erreurs = [...new Set(erreurs)];
  j.ko = [...new Set(ko)];
  rapport.parcours.push(j);
  await ctx.close();
}

async function divers() {
  const ctx = await contexte(true);
  const page = await ctx.newPage();
  await page.goto(BASE + "/fr", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.locator(".burger").click().catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${D}/divers-menu-m.png` });
  await page.goto(BASE + "/fr/collections", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  for (let i = 1; i <= 3; i++) {
    await page.evaluate((k) => scrollTo(0, innerHeight * k), i);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${D}/divers-collections-m-${i}.png` });
  }
  await page.goto(BASE + "/fr", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  for (let i = 2; i <= 7; i++) {
    await page.evaluate((k) => scrollTo(0, innerHeight * k * 0.95), i);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${D}/divers-accueil-m-${i + 1}.png` });
  }
  await page.goto(BASE + "/fr/simpson", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const h = await page.evaluate(() => document.querySelector("#avis")?.getBoundingClientRect().top + scrollY);
  if (h) {
    for (let i = 0; i < 5; i++) {
      await page.evaluate(([v, k]) => scrollTo(0, v + innerHeight * k * 0.95), [h, i]);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${D}/divers-fiche-suite-m-${i + 1}.png` });
    }
  }
  await ctx.close();
}

await balayer(true);
await balayer(false);
await parcours(true, "/fr/simpson", 0, "m-numerique");
await parcours(true, "/fr/carte-pokemon-personnalisee", 1, "m-poster");
await parcours(false, "/fr/simpson", 0, "d-numerique");
await divers();
await navigateur.close();

fs.writeFileSync(`${D}/rapport.json`, JSON.stringify(rapport, null, 2));

console.log("=== PAGES ===");
for (const r of rapport.pages) {
  console.log(`\n${r.nom.padEnd(18)} ${r.statut} ${r.duree}ms  ${r.ecrans} ecrans  h1=${JSON.stringify(r.h1)}`);
  if (r.debordement) console.log("   DEBORDEMENT :", r.debordants.join(" | "));
  if (r.erreurs.length) console.log("   erreurs :", r.erreurs.slice(0, 3).join(" | "));
  if (r.ko.length) console.log("   requetes KO :", r.ko.slice(0, 5).join(" | "));
  if (r.imagesCassees?.length) console.log("   images cassees :", r.imagesCassees.slice(0, 5).join(" | "));
  if (r.nom.endsWith("-m")) {
    console.log(`   petites cibles (${r.nbPetitesCibles}) :`, r.petitesCibles.join(" | "));
    if (r.petitsTextes.length) console.log("   petits textes :", r.petitsTextes.join(" | "));
  }
}
console.log("\n=== PARCOURS ===");
for (const j of rapport.parcours) {
  console.log(`\n--- ${j.nom} ${j.url}`);
  for (const [k, v] of j.etapes) console.log(`   ${k.padEnd(24)} ${typeof v === "string" ? v.replace(/\n+/g, " / ") : JSON.stringify(v)}`);
  if (j.erreurs.length) console.log("   erreurs :", j.erreurs.slice(0, 4).join(" | "));
  if (j.ko.length) console.log("   KO :", j.ko.slice(0, 4).join(" | "));
}
