import { chromium } from "playwright";
import fs from "node:fs";

/**
 * Detoure public/logo.png.
 *
 * Le fichier d'origine est un carre de 1024 px dont le lettrage n'occupe qu'une
 * bande centrale : pose dans un slot de 38 px de haut, le mot ne fait plus que
 * 14 px et devient illisible. Ce script recadre sur le contenu reel et ecrit
 * public/logo-detoure.png, aux proportions du lettrage seul.
 */

const SOURCE = "http://localhost:3000/logo.png";
const CIBLE = "public/logo-detoure.png";
const MARGE = 8; // quelques pixels de respiration autour du lettrage

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.goto("http://localhost:3000/fr", { waitUntil: "domcontentloaded" });

const resultat = await page.evaluate(async ({ source, marge }) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((ok, ko) => {
    img.onload = ok;
    img.onerror = ko;
    img.src = source;
  });

  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);

  // Fond = transparent, ou blanc/quasi blanc.
  const estFond = (i) => {
    const a = data[i + 3];
    if (a < 12) return true;
    return data[i] > 244 && data[i + 1] > 244 && data[i + 2] > 244;
  };

  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (!estFond((y * c.width + x) * 4)) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;

  x0 = Math.max(0, x0 - marge);
  y0 = Math.max(0, y0 - marge);
  x1 = Math.min(c.width - 1, x1 + marge);
  y1 = Math.min(c.height - 1, y1 + marge);

  const l = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const sortie = document.createElement("canvas");
  sortie.width = l;
  sortie.height = h;
  sortie.getContext("2d").drawImage(c, x0, y0, l, h, 0, 0, l, h);

  return { dataUrl: sortie.toDataURL("image/png"), l, h, source: [c.width, c.height] };
}, { source: SOURCE, marge: MARGE });

await navigateur.close();

if (!resultat) {
  console.error("image entierement vide — rien a detourer");
  process.exit(1);
}

fs.writeFileSync(CIBLE, Buffer.from(resultat.dataUrl.split(",")[1], "base64"));
console.log(
  `${resultat.source[0]}x${resultat.source[1]} -> ${resultat.l}x${resultat.h} ` +
    `(ratio ${(resultat.l / resultat.h).toFixed(2)}) ecrit dans ${CIBLE}`
);
