import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Passe `detoure-bandeaux.mjs` sur toutes les fiches dont les visuels ont ete
 * deposes dans public/catalogue.
 *
 * Usage : node scripts/detoure-tout.mjs [--applique]
 * Sans --applique, chaque fiche recoit un dossier galerie-detouree/ a inspecter.
 *
 * Ne pas oublier d'incrementer VERSION_VISUELS apres un --applique : sans quoi
 * l'optimiseur d'images continue de servir les anciennes versions.
 */

const APPLIQUE = process.argv.includes("--applique");
const RACINE = "public/catalogue";

const slugs = fs
  .readdirSync(RACINE)
  .filter((d) => fs.existsSync(path.join(RACINE, d, "galerie")))
  .sort();

let total = 0;
let detoures = 0;
const partiels = [];

for (const slug of slugs) {
  const args = ["scripts/detoure-bandeaux.mjs", slug];
  if (APPLIQUE) args.push("--applique");

  let sortie;
  try {
    sortie = execFileSync("node", args, { encoding: "utf8" });
  } catch (e) {
    console.log(`${slug.padEnd(44)} ECHEC`);
    continue;
  }

  const m = sortie.match(/(\d+)\/(\d+) visuels nettoyés/);
  if (!m) {
    console.log(`${slug.padEnd(44)} sortie illisible`);
    continue;
  }
  const [, ok, sur] = m.map(Number);
  total += sur;
  detoures += ok;

  // Une ligne réussie porte « effacé : » ; toute autre ligne de fichier est un
  // échec. Se fier au tiret cadratin ne marche pas, les deux en ont un.
  const restants = sortie
    .split("\n")
    .filter((l) => /^\s*\d+\.(png|jpe?g|webp)/.test(l) && !l.includes("effacé"))
    .map((l) => l.trim().split(/\s+/)[0]);

  console.log(
    `${slug.padEnd(44)} ${String(ok).padStart(2)}/${sur}` +
      (restants.length ? `   non traité : ${restants.join(", ")}` : "")
  );
  if (restants.length) partiels.push({ slug, restants });
}

console.log(`\n${detoures}/${total} visuels détourés sur ${slugs.length} fiches`);
if (partiels.length) {
  console.log(`\n${partiels.length} fiche(s) avec des visuels non traités —`);
  console.log("le bandeau n'y est pas une bande de fond uni en haut :");
  for (const p of partiels) console.log(`  ${p.slug} : ${p.restants.join(", ")}`);
}
