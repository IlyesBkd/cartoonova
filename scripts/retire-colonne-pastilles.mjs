import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

/**
 * Retire la colonne de pastilles d'arguments des visuels « encadrement ».
 *
 * Dix visuels du catalogue portent, à droite, une colonne de pastilles bleues :
 * « Cadre en bois noir · Prêt à être accroché · Poster A3 (30x40cm) · Qualité
 * Premium », parfois avec le logo CARTOONTOI. Du texte français, et une marque
 * qui n'est pas celle du site.
 *
 * `detoure-bandeaux.mjs` ne les attrape pas : son principe est de repérer le
 * texte par écart à un fond uni, or ces montages-là ont un fond dégradé. Ici on
 * s'appuie sur la seule chose fiable : le bleu très saturé des pastilles, qui
 * n'existe pas dans le fond. On coupe à gauche de la première colonne qui en
 * contient, puis on ré-étale la partie utile sur tout le carré — pas de fond
 * repeint, donc pas de raccord visible.
 *
 * Le message de ces pastilles n'est pas perdu : la fiche produit l'affiche
 * désormais en HTML, traduit (« Cadre en bois premium · prêt à accrocher »).
 *
 * Usage : node scripts/retire-colonne-pastilles.mjs [--applique]
 */

const APPLIQUE = process.argv.includes("--applique");
const RACINE = "public/catalogue";

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.goto("http://localhost:3000/fr", { waitUntil: "domcontentloaded" });

const cibles = [];
for (const dossier of fs.readdirSync(RACINE).sort()) {
  const galerie = path.join(RACINE, dossier, "galerie");
  if (!fs.existsSync(galerie)) continue;
  for (const f of fs.readdirSync(galerie).sort()) {
    if (/\.(png|jpe?g|webp)$/i.test(f)) cibles.push({ dossier, fichier: f });
  }
}

let traites = 0;
const rapport = [];

for (const { dossier, fichier } of cibles) {
  const r = await page.evaluate(async (u) => {
    const img = new Image();
    const ok = await new Promise((res) => {
      img.onload = () => res(true);
      img.onerror = () => res(false);
      img.src = u;
    });
    if (!ok) return null;

    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);

    // Bleu des pastilles : très saturé, franchement plus bleu que rouge/vert.
    const pastille = (i) => {
      const R = data[i], G = data[i + 1], B = data[i + 2];
      return B > 170 && B - R > 90 && B - G > 60 && G > 60 && G < 160;
    };

    // Colonnes contenant ce bleu, dans la moitié droite seulement.
    const debut = Math.floor(c.width * 0.5);
    let premiere = -1;
    let total = 0;
    for (let x = debut; x < c.width; x++) {
      let n = 0;
      for (let y = 0; y < c.height; y += 3) if (pastille((y * c.width + x) * 4)) n++;
      const part = n / (c.height / 3);
      if (part > 0.06) {
        total++;
        if (premiere < 0) premiere = x;
      }
    }

    /* Trois garde-fous, pour ne pas confondre la colonne de pastilles avec du
       bleu d'illustration — le ciel de Hunter x Hunter, les combinaisons des
       Indestructibles, les briques Lego en contiennent aussi.
       La colonne, elle, commence toujours au-delà des deux tiers de la largeur
       et court sur une bonne partie de la hauteur ; le bleu d'illustration,
       lui, se déclenche dès le bord de la fenêtre de balayage. */
    if (premiere < 0) return { ignore: true };
    if (premiere < c.width * 0.6) return { ignore: true };
    if (total < c.width * 0.12) return { ignore: true };

    const coupe = Math.max(Math.floor(c.width * 0.45), premiere - 24);

    /* On garde l'échelle d'origine — ré-étaler la zone utile sur tout le carré
       zoomerait au point de rogner le cadre, c'est-à-dire le produit lui-même.
       La zone utile est recentrée, et les marges laissées de part et d'autre
       sont comblées en étirant la colonne de fond qui les borde. Le fond de ces
       montages est un dégradé doux : l'étirement ne se voit pas. */
    const sortie = document.createElement("canvas");
    sortie.width = c.width;
    sortie.height = c.height;
    const sx = sortie.getContext("2d");

    const marge = Math.round((c.width - coupe) / 2);

    /* La colonne à étirer doit être du fond, pas un bord d'ombre : on cherche,
       en partant du bord de coupe et en remontant vers le sujet, la première
       colonne vraiment uniforme. Étirer une colonne sombre créerait une bande
       verticale qu'on prendrait pour un défaut. */
    const colonneUnie = (depart, sens) => {
      for (let x = depart; x > 0 && x < c.width; x += sens) {
        let min = 255, max = 0;
        for (let y = 0; y < c.height; y += 4) {
          const v = data[(y * c.width + x) * 4 + 1]; // le vert suffit à juger
          if (v < min) min = v;
          if (v > max) max = v;
        }
        if (max - min < 26) return x;
      }
      return depart;
    };

    if (marge > 0) {
      const gauche = colonneUnie(0, 1);
      const droite2 = colonneUnie(coupe - 1, -1);
      sx.drawImage(c, gauche, 0, 1, c.height, 0, 0, marge, c.height);
      sx.drawImage(c, droite2, 0, 1, c.height, marge + coupe, 0, c.width - marge - coupe, c.height);
    }
    // La zone utile, à l'échelle, recentrée.
    sx.drawImage(c, 0, 0, coupe, c.height, marge, 0, coupe, c.height);

    return { coupe, part: +((coupe / c.width) * 100).toFixed(1), dataUrl: sortie.toDataURL("image/webp", 0.92) };
  }, `/catalogue/${dossier}/galerie/${fichier}`);

  if (!r || r.ignore) continue;

  const base = path.basename(fichier, path.extname(fichier));
  const cible = path.join(RACINE, dossier, APPLIQUE ? "galerie" : "galerie-sans-pastilles");
  fs.mkdirSync(cible, { recursive: true });
  fs.writeFileSync(path.join(cible, base + ".webp"), Buffer.from(r.dataUrl.split(",")[1], "base64"));
  if (APPLIQUE && path.extname(fichier).toLowerCase() !== ".webp") {
    fs.unlinkSync(path.join(RACINE, dossier, "galerie", fichier));
  }
  traites++;
  rapport.push(`${dossier}/${fichier}`.padEnd(56) + `coupé à ${r.part}% de la largeur`);
}

await navigateur.close();

console.log(APPLIQUE ? "appliqué\n" : "aperçu dans galerie-sans-pastilles/\n");
rapport.forEach((l) => console.log("  " + l));
console.log(`\n${traites} visuel(s) traité(s) sur ${cibles.length} examinés`);
