import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

/**
 * Essai : le bandeau de texte des visuels produit est-il détachable ?
 *
 * Les gabarits g1/g2/g3 de la capture posent tous un titre français sur une
 * bande de fond uni, en haut, au-dessus du montage produit. Si cette bande se
 * détecte, on peut la recadrer et rendre le titre en HTML — donc traduisible
 * dans les 20 langues sans produire 20 images.
 *
 * Le script ne modifie rien : il mesure et écrit un aperçu avant/après.
 */

const ECHANTILLON = [
  "portrait-naruto-personnalise/galerie/01",
  "portrait-naruto-personnalise/galerie/02",
  "portrait-naruto-personnalise/galerie/03",
  "portrait-lego-personnalise/galerie/01",
  "carte-pokemon-personnalisee/galerie/02",
  "portrait-tintin-personnalise/galerie/03",
];

const SORTIE = process.argv[2] ?? "essai";
fs.mkdirSync(SORTIE, { recursive: true });

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.goto("http://localhost:3000/fr", { waitUntil: "domcontentloaded" });

const resultats = [];

for (const rel of ECHANTILLON) {
  for (const ext of [".png", ".webp", ".jpg"]) {
    const url = `/catalogue/${rel}${ext}`;
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

      // Couleur de fond : le pixel du coin haut-gauche.
      const fond = [data[0], data[1], data[2]];
      const loin = (i) =>
        Math.abs(data[i] - fond[0]) + Math.abs(data[i + 1] - fond[1]) + Math.abs(data[i + 2] - fond[2]) > 60;

      // Part de pixels non-fond, ligne par ligne.
      const densite = [];
      for (let y = 0; y < c.height; y++) {
        let n = 0;
        for (let x = 0; x < c.width; x += 2) if (loin((y * c.width + x) * 4)) n++;
        densite.push(n / (c.width / 2));
      }

      // Le bandeau de titre : premier groupe de lignes chargées, puis une
      // zone vide avant que le montage produit ne commence.
      let finTitre = -1;
      let vues = false;
      for (let y = 0; y < Math.floor(c.height * 0.45); y++) {
        if (densite[y] > 0.02) vues = true;
        else if (vues) {
          // 25 lignes de fond d'affilée = fin du bandeau
          let creux = 0;
          while (y + creux < c.height && densite[y + creux] <= 0.02) creux++;
          if (creux >= 25) { finTitre = y + Math.min(creux - 4, 20); break; }
          y += creux;
        }
      }

      return {
        largeur: c.width,
        hauteur: c.height,
        fond: `rgb(${fond.join(",")})`,
        coupe: finTitre,
        part: finTitre > 0 ? +(finTitre / c.height * 100).toFixed(1) : 0,
      };
    }, url);

    if (r) {
      resultats.push({ fichier: rel + ext, ...r });
      break;
    }
  }
}

await navigateur.close();

console.log("fichier".padEnd(46), "taille".padEnd(12), "fond".padEnd(18), "coupe");
for (const r of resultats) {
  console.log(
    r.fichier.padEnd(46),
    `${r.largeur}x${r.hauteur}`.padEnd(12),
    r.fond.padEnd(18),
    r.coupe > 0 ? `y=${r.coupe} (${r.part}% du haut)` : "NON DETECTE"
  );
}

const ok = resultats.filter((r) => r.coupe > 0).length;
console.log(`\n${ok}/${resultats.length} bandeaux détectés automatiquement`);
fs.writeFileSync(path.join(SORTIE, "mesures.json"), JSON.stringify(resultats, null, 2));
