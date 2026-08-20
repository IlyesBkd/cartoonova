import fs from "node:fs";
import path from "node:path";

/**
 * Importe les visuels des fiches produit depuis la capture de cartoontoi.fr
 * vers public/catalogue/<slug>/, a la convention que lib/visuels.ts sait lire.
 *
 * Source  : <SOURCE>/donnees/produits.json + <SOURCE>/assets/produits/
 *           nommage <handle>-g-N.<ext> (galerie), <handle>-fond-N.<ext> (decors),
 *           <handle>-fmt-N.<ext> (supports d'impression).
 * Cible   : public/catalogue/<slug>/galerie/N.<ext>
 *           public/catalogue/<slug>/decors/decor-N.<ext>
 *
 * Deux mises a l'ecart volontaires :
 *
 *  · Les six univers deja pourvus (Simpson, Dragon Ball, One Piece, Rick et
 *    Morty, Disney, Ghibli) ne sont pas touches : ils ont les photos produit
 *    de Cartoonova, et melanger deux sources sur une meme page se verrait.
 *
 *  · Les images `-fmt-` ne sont pas importees. Chez CartoonToi les quatre
 *    formats sont Digital / Poster / Cadre noir / Cadre bois ; chez Cartoonova
 *    ce sont Digital / Poster / Toile / Encadre. Il n'y a pas de visuel de
 *    toile en face, et poser une photo de cadre bois sur l'option « Portrait
 *    sur Toile » facturee 39 € de plus tromperait l'acheteur. Les visuels de
 *    support de Cartoonova, eux, montrent le bon produit.
 *
 * Usage : node scripts/importe-visuels-catalogue.mjs [--essai]
 */

const SOURCE = "C:/Users/ilyee/Documents/copy-website/accueil";
const CIBLE = "public/catalogue";
const ESSAI = process.argv.includes("--essai");

// Slugs deja pourvus de leurs propres visuels (cf. VISUELS_LIVRES).
const DEJA_POURVUS = new Set(["simpson", "dbz", "disney", "ghibli", "onepiece", "rickandmorty"]);

// handle cartoontoi -> slug Cartoonova, quand ils different.
const SLUGS = {
  "affiche-wanted-one-piece-personnalise": "onepiece",
  "portrait-dragon-ball-personnalise": "dbz",
  "portrait-rick-et-morty-personnalise": "rickandmorty",
  "portrait-simpson-personnalise": "simpson",
  "brume-truefilter™": "super-cafe",
};

const produits = JSON.parse(fs.readFileSync(path.join(SOURCE, "donnees/produits.json"), "utf8"));

let fiches = 0;
let copiees = 0;
let octets = 0;
const ignorees = [];

function copie(relatifSource, dossierCible, nomCible) {
  const src = path.join(SOURCE, relatifSource);
  if (!fs.existsSync(src)) {
    ignorees.push(relatifSource);
    return;
  }
  const dest = path.join(dossierCible, nomCible + path.extname(src));
  if (!ESSAI) {
    fs.mkdirSync(dossierCible, { recursive: true });
    fs.copyFileSync(src, dest);
  }
  copiees++;
  octets += fs.statSync(src).size;
}

for (const p of produits) {
  const slug = SLUGS[p.handle] ?? p.handle;
  if (DEJA_POURVUS.has(slug)) continue;
  if (p.images.length === 0 && p.fonds.length === 0) continue;

  const racine = path.join(CIBLE, slug);
  p.images.forEach((rel, i) => copie(rel, path.join(racine, "galerie"), String(i + 1).padStart(2, "0")));
  p.fonds.forEach((rel, i) => copie(rel, path.join(racine, "decors"), `decor-${i + 1}`));

  fiches++;
  console.log(
    `  ${slug.padEnd(42)} ${String(p.images.length).padStart(2)} galerie` +
      (p.fonds.length ? ` · ${p.fonds.length} décors` : "")
  );
}

console.log(
  `\n${ESSAI ? "[essai] " : ""}${fiches} fiches · ${copiees} fichiers · ${(octets / 1024 / 1024).toFixed(1)} Mo`
);
if (ignorees.length) console.log(`${ignorees.length} sources introuvables :`, ignorees.slice(0, 5));
