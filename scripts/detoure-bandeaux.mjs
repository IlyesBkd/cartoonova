import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

/**
 * Efface les incrustations de texte des visuels produit.
 *
 * La capture mélange deux générations de montages, et trois dispositions :
 *
 *   haut    « Transforme-Toi en… », « Imprimé en France… », étoiles + avis
 *   bas     le badge « dessiné à la main » des comparatifs Photo → Portrait
 *   droite  la colonne de pastilles « Cadre en bois noir / Poster A3… »,
 *           accompagnée du logo CARTOONTOI
 *
 * Toutes reposent sur le même fait : le bloc de texte est posé sur le fond uni,
 * séparé du sujet par une respiration. On balaie donc depuis chaque bord vers
 * l'intérieur, on cherche le plus long passage de lignes (ou de colonnes)
 * strictement au fond situé APRÈS du contenu, et on repeint tout ce qui se
 * trouve au-delà. Un visuel sans incrustation de ce côté ne déclenche rien :
 * le balayage rencontre le fond avant tout contenu et s'arrête.
 *
 * Le format d'origine est conservé : la galerie du système impose un carré
 * (`aspect-ratio: 1/1` + `object-fit: cover`), et rogner déformerait le sujet.
 *
 * Usage : node scripts/detoure-bandeaux.mjs <slug> [--applique]
 * Sans --applique, écrit dans galerie-detouree/ sans toucher aux originaux.
 */

const slug = process.argv[2];
const APPLIQUE = process.argv.includes("--applique");
if (!slug) {
  console.error("usage : node scripts/detoure-bandeaux.mjs <slug> [--applique]");
  process.exit(1);
}

const SOURCE = path.join("public/catalogue", slug, "galerie");
const CIBLE = path.join("public/catalogue", slug, APPLIQUE ? "galerie" : "galerie-detouree");

if (!fs.existsSync(SOURCE)) {
  console.error("dossier introuvable :", SOURCE);
  process.exit(1);
}

const fichiers = fs
  .readdirSync(SOURCE)
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  .sort();

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.goto("http://localhost:3000/fr", { waitUntil: "domcontentloaded" });

fs.mkdirSync(CIBLE, { recursive: true });
const rapport = [];

for (const nom of fichiers) {
  const r = await page.evaluate(async (u) => {
    const img = new Image();
    const ok = await new Promise((res) => {
      img.onload = () => res(true);
      img.onerror = () => res(false);
      img.src = u;
    });
    if (!ok) return { erreur: "chargement" };

    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);

    const fond = [data[0], data[1], data[2], data[3]];
    const loin = (i) => {
      // Deux pixels transparents sont le même fond, quelles que soient leurs
      // composantes de couleur.
      if (data[i + 3] < 12 && fond[3] < 12) return false;
      if (Math.abs(data[i + 3] - fond[3]) > 60) return true;
      return (
        Math.abs(data[i] - fond[0]) +
          Math.abs(data[i + 1] - fond[1]) +
          Math.abs(data[i + 2] - fond[2]) >
        60
      );
    };

    const pixel = (x, y) => (y * c.width + x) * 4;

    /** Densité de contenu d'une ligne (axe "y") ou d'une colonne (axe "x"). */
    const densite = (axe, k) => {
      const n = axe === "y" ? c.width : c.height;
      let compte = 0;
      for (let j = 0; j < n; j += 2) {
        if (loin(axe === "y" ? pixel(j, k) : pixel(k, j))) compte++;
      }
      return compte / (n / 2);
    };

    /**
     * Depuis un bord, cherche le bloc de texte : du contenu, puis une
     * respiration d'au moins 18 lignes de fond, le tout dans le premier
     * `part` de l'image. Renvoie la position de coupe, ou -1.
     */
    const trouveBloc = (axe, versLInterieur, taille, part) => {
      const limite = Math.floor(taille * part);
      const at = (i) => densite(axe, versLInterieur ? i : taille - 1 - i);
      // On ne renonce pas si le bord touche du contenu : les pastilles
      // d'arguments et le badge « dessiné à la main » débordent souvent
      // jusqu'au bord. Seule compte la respiration qui les sépare du sujet.

      let meilleur = { debut: -1, longueur: 0 };
      let i = 0;
      let contenuVu = false;
      while (i < limite) {
        if (at(i) > 0.02) { contenuVu = true; i++; continue; }
        let k = 0;
        while (i + k < limite && at(i + k) <= 0.02) k++;
        if (contenuVu && k > meilleur.longueur) meilleur = { debut: i, longueur: k };
        i += k || 1;
      }
      if (meilleur.debut < 0 || meilleur.longueur < 18) return -1;
      return meilleur.debut + meilleur.longueur - 12;
    };

    // Le haut porte les grands titres : on lui laisse plus de place.
    const haut = trouveBloc("y", true, c.height, 0.55);
    const bas = trouveBloc("y", false, c.height, 0.3);
    const droite = trouveBloc("x", false, c.width, 0.42);

    if (haut < 0 && bas < 0 && droite < 0) return { erreur: "aucune incrustation" };

    const sortie = document.createElement("canvas");
    sortie.width = c.width;
    sortie.height = c.height;
    const sx = sortie.getContext("2d");
    if (fond[3] >= 12) {
      sx.fillStyle = `rgba(${fond[0]},${fond[1]},${fond[2]},${fond[3] / 255})`;
      sx.fillRect(0, 0, c.width, c.height);
    }

    // Fenêtre du sujet, une fois les blocs de texte retirés.
    const x0 = 0;
    const x1 = droite >= 0 ? c.width - droite : c.width;
    const y0 = haut >= 0 ? haut : 0;
    const y1 = bas >= 0 ? c.height - bas : c.height;

    // Recentré dans le cadre libéré : le sujet ne se retrouve pas collé au bord.
    sx.drawImage(
      c, x0, y0, x1 - x0, y1 - y0,
      Math.round((c.width - (x1 - x0)) / 2),
      Math.round((c.height - (y1 - y0)) / 2),
      x1 - x0, y1 - y0
    );

    return {
      haut: haut >= 0 ? haut : null,
      bas: bas >= 0 ? bas : null,
      droite: droite >= 0 ? droite : null,
      dataUrl: sortie.toDataURL("image/webp", 0.92),
    };
  }, `/catalogue/${slug}/galerie/${nom}`);

  if (r.erreur) {
    rapport.push({ nom, statut: r.erreur });
    if (!APPLIQUE) fs.copyFileSync(path.join(SOURCE, nom), path.join(CIBLE, nom));
    continue;
  }

  const base = path.basename(nom, path.extname(nom));
  fs.writeFileSync(path.join(CIBLE, base + ".webp"), Buffer.from(r.dataUrl.split(",")[1], "base64"));
  if (APPLIQUE && path.extname(nom).toLowerCase() !== ".webp") fs.unlinkSync(path.join(SOURCE, nom));

  const cotes = [r.haut && `haut ${r.haut}`, r.bas && `bas ${r.bas}`, r.droite && `droite ${r.droite}`]
    .filter(Boolean)
    .join(" · ");
  rapport.push({ nom, statut: "ok", cotes });
}

await navigateur.close();

console.log(`${slug} — ${APPLIQUE ? "appliqué sur" : "aperçu dans"} ${CIBLE}\n`);
for (const l of rapport) {
  console.log(l.nom.padEnd(12), l.statut === "ok" ? `effacé : ${l.cotes}` : `— ${l.statut}`);
}
const ok = rapport.filter((l) => l.statut === "ok").length;
console.log(`\n${ok}/${rapport.length} visuels nettoyés`);
