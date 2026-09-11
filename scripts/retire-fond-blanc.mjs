import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

/**
 * Rend transparent le mur clair des visuels produit.
 *
 * Les montages deposes posent le cadre (ou les cartes Photo → Portrait) sur un
 * mur blanc cassé. Dans la galerie, ce blanc fait une tache sur la toile beige
 * du site. Transparent, le cadre repose directement sur la page.
 *
 * Le mur est trouvé par remplissage depuis les bords : on progresse de pixel
 * en pixel tant que la couleur reste neutre, pas plus claire que le mur, et
 * change doucement. Les ombres portées, qui fondent progressivement, sont
 * donc prises ; le bord net du cadre et les cartes blanches, plus claires que
 * le mur, arrêtent la progression.
 *
 * L'ombre n'est pas effacée mais convertie : un pixel de mur assombri devient
 * du noir à l'opacité qui reproduit cet assombrissement. Posé sur le beige,
 * le cadre garde son ombre et ne semble pas découpé aux ciseaux.
 *
 * Le liseré d'anticrénelage entre le mur et le sujet est démélangé : chaque
 * pixel y est lu comme un mélange de la couleur du sujet voisin et du mur, et
 * reçoit l'opacité correspondante. Sans cela, un fil clair entourerait le
 * cadre sur fond beige.
 *
 * Le fond peut être coloré : mur de studio bleu, ciel à nuages. Seuls les
 * visuels dont le pourtour est clair sont traités ; une scène ou une photo
 * (plage, mur orange) est laissée telle quelle.
 *
 * Usage : node scripts/retire-fond-blanc.mjs [slug…] [--applique]
 * Sans slug, toutes les fiches de public/catalogue.
 * Sans --applique, écrit dans galerie-detouree/ sans toucher aux originaux.
 * Avec --applique, l'original est rangé dans galerie/opaque/ : l'og:image et
 * le flux marchand le servent toujours (voir lib/visuels.ts).
 *
 * Incrémenter VERSION_VISUELS après un --applique.
 */

const APPLIQUE = process.argv.includes("--applique");
const RACINE = "public/catalogue";
// Fiches qui ne sont pas des portraits : leurs visuels ne suivent pas le gabarit.
const EXCLUS = new Set(["super-cafe"]);

const demandes = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const slugs = (demandes.length ? demandes : fs.readdirSync(RACINE))
  .filter((s) => !EXCLUS.has(s) && fs.existsSync(path.join(RACINE, s, "galerie")))
  .sort();

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Teinte en degrés, 0–360. */
function teinte(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const t = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (t * 60 + 360) % 360;
}

/**
 * Lit le fond sur le pourtour de l'image, ou renvoie null s'il n'est pas un
 * fond de studio (pourtour sombre ou bariolé : une scène, une photo).
 *
 *  · palette  toutes les teintes du pourtour, à un cran près : le mur, et le
 *             cas échéant les nuages d'un ciel — ils touchent le bord, donc
 *             ils font partie du décor et partent avec lui.
 *  · lMur     luminance du mur à son plus clair, hors nuages : la teinte
 *             dominante, dont on garde les pixels les plus clairs.
 *  · chroma   teinte du mur, pour reconnaître ses ombres, plus sombres mais
 *             de même couleur.
 */
function analysePourtour(data, w, h) {
  const bords = [];
  const lit = (x, y) => {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 250) return; // déjà détouré
    bords.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let x = 0; x < w; x++) { lit(x, 0); lit(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { lit(0, y); lit(w - 1, y); }
  const attendus = 2 * w + 2 * (h - 2);
  if (bords.length < attendus * 0.99) return null;
  if (bords.filter((p) => lum(...p) >= 150).length / bords.length < 0.97) return null;

  const cle = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  const comptes = new Map();
  for (const p of bords) { const k = cle(...p); comptes.set(k, (comptes.get(k) ?? 0) + 1); }

  // Cases présentes au moins 3 fois (le bruit de compression n'y entre pas),
  // élargies d'un cran dans chaque canal.
  const palette = new Uint8Array(32768);
  for (const [k, n] of comptes) {
    if (n < 3) continue;
    const r = k >> 10, g = (k >> 5) & 31, b = k & 31;
    for (let dr = -1; dr <= 1; dr++) for (let dg = -1; dg <= 1; dg++) for (let db = -1; db <= 1; db++) {
      const rr = r + dr, gg = g + dg, bb = b + db;
      if (rr >= 0 && rr < 32 && gg >= 0 && gg < 32 && bb >= 0 && bb < 32) palette[(rr << 10) | (gg << 5) | bb] = 1;
    }
  }

  let mode = 0, max = 0;
  for (const [k, n] of comptes) if (n > max) { max = n; mode = k; }
  const centre = [(mode >> 10) * 8 + 4, ((mode >> 5) & 31) * 8 + 4, (mode & 31) * 8 + 4];
  const duMur = bords.filter((p) => (p[0] - centre[0]) ** 2 + (p[1] - centre[1]) ** 2 + (p[2] - centre[2]) ** 2 <= 24 ** 2);
  duMur.sort((a, b) => lum(...b) - lum(...a));
  const tete = duMur.slice(0, Math.max(1, Math.floor(duMur.length * 0.05)));
  const mur = [0, 1, 2].map((c) => tete.reduce((s, p) => s + p[c], 0) / tete.length);
  const somme = mur[0] + mur[1] + mur[2];

  const lMur = lum(...mur);
  return {
    mur,
    lMur,
    // Un ciel à nuages : du blanc bien plus clair que le ciel touche le bord.
    nuages: bords.filter((p) => lum(...p) > lMur + 20).length / bords.length >= 0.003,
    chroma: mur.map((c) => c / somme),
    teinte: teinte(...mur),
    satMur: Math.max(...mur) - Math.min(...mur),
    // Jamais plus clair que le mur : le nuage clair d'une affiche sans cadre,
    // collée au mur bleu, se faisait mordre, et le blanc des bandeaux d'un
    // comparatif partait avec les nuages du ciel. Les nuages ont leur propre
    // passe (voir « nuages » dans detoure).
    dansPalette: (r, g, b) => lum(r, g, b) <= lMur + 6 && palette[cle(r, g, b)] === 1,
  };
}

// Sous Windows, libvips garde les fichiers lus ouverts : l'original ne
// pourrait plus être rangé dans opaque/ (EBUSY). On lui passe donc un tampon.
sharp.cache(false);

async function detoure(fichier) {
  const { data, info } = await sharp(fs.readFileSync(fichier))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const pourtour = analysePourtour(data, w, h);
  if (!pourtour) return null;
  const { mur, lMur, nuages, chroma, teinte: teinteMur, satMur, dansPalette } = pourtour;
  const dominant = mur.indexOf(Math.max(...mur));

  // --- remplissage du mur depuis les bords ---
  const estMur = new Uint8Array(w * h);
  const file = new Int32Array(w * h);
  let debut = 0, fin = 0;

  // Du mur ou de son ombre : même teinte, pas plus clair, pas trop sombre.
  // Ou une teinte du pourtour, nuages compris.
  const admissible = (k) => {
    const i = k * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (dansPalette(r, g, b)) return true;
    const l = lum(r, g, b);
    if (l > lMur + 6 || l < 110) return false;
    const s = r + g + b || 1;
    const ecart = Math.abs(r / s - chroma[0]) + Math.abs(g / s - chroma[1]) + Math.abs(b / s - chroma[2]);
    if (ecart <= 0.05) return true;
    // Sur un mur coloré, l'ombre fonce ET sature — le bleu clair d'un studio
    // vire au bleu profond au pied du cadre. On la reconnaît à sa teinte.
    if (satMur < 20) return false;
    const dt = Math.abs(teinte(r, g, b) - teinteMur);
    if (Math.max(r, g, b) - Math.min(r, g, b) < 15 || Math.min(dt, 360 - dt) > 25) return false;
    // Une ombre retire de la lumière à tous les canaux, le dominant compris ;
    // un ciel d'illustration, lui, garde son bleu presque à fond. Sans ce
    // garde-fou, le ciel d'une affiche sans cadre partait avec le mur.
    const canal = [r, g, b][dominant];
    return (mur[dominant] - canal) / mur[dominant] >= 0.45 * (1 - l / lMur);
  };
  // Une ombre portée s'éclaircit de 2 à 3 niveaux par pixel. Au-delà de 6,
  // c'est un bord : l'arrondi anticrénelé d'une carte suffisait, à 10, pour
  // entrer dans le rideau gris d'une photo Photo → Portrait.
  const doux = (k, v) => {
    const i = k * 4, j = v * 4;
    return (
      Math.abs(data[i] - data[j]) <= 6 &&
      Math.abs(data[i + 1] - data[j + 1]) <= 6 &&
      Math.abs(data[i + 2] - data[j + 2]) <= 6
    );
  };
  // Une teinte du pourtour : prise même après une marche. Rattrape les
  // interstices étroits, où les ombres croisées de deux cartes font des
  // marches de plus de 6, et les contours nets des nuages d'un ciel — sans
  // rouvrir la photo d'un comparatif, dont aucune teinte ne touche le bord.
  const presqueMur = (v) => {
    const j = v * 4;
    return dansPalette(data[j], data[j + 1], data[j + 2]);
  };
  const sème = (k) => {
    if (!estMur[k] && admissible(k)) { estMur[k] = 1; file[fin++] = k; }
  };
  for (let x = 0; x < w; x++) { sème(x); sème((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { sème(y * w); sème(y * w + w - 1); }

  while (debut < fin) {
    const k = file[debut++];
    const x = k % w, y = (k - x) / w;
    for (const v of [x > 0 && k - 1, x < w - 1 && k + 1, y > 0 && k - w, y < h - 1 && k + w]) {
      if (v === false || estMur[v]) continue;
      if (admissible(v) && (doux(k, v) || presqueMur(v))) { estMur[v] = 1; file[fin++] = v; }
    }
  }

  // --- nuages ---
  // Le blanc n'est jamais pris par le remplissage : les bandeaux et cadres
  // blancs d'un comparatif Avant / Après sont du même blanc que les nuages.
  // Un bloc nuageux — clair et moins saturé que le ciel, qu'il soit blanc ou
  // dans son ombrage bleu grisé — rejoint le fond s'il le touche ET s'il est
  // coupé par le bord de l'image (un nuage du décor) ou petit (un bout de
  // nuage contre le cadre). Un bandeau, grand et posé au milieu, reste ; un
  // reflet blanc dans l'illustration ne touche pas le fond.
  const MIETTE = 1500;
  if (nuages) {
    const nuageux = (k) => {
      const i = k * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      return lum(r, g, b) > lMur - 10 && Math.max(r, g, b) - Math.min(r, g, b) <= satMur * 0.7;
    };
    const vuNuage = new Uint8Array(w * h);
    for (let k0 = 0; k0 < w * h; k0++) {
      if (estMur[k0] || vuNuage[k0] || !nuageux(k0)) continue;
      debut = fin = 0;
      file[fin++] = k0;
      vuNuage[k0] = 1;
      // Contacts du bloc : avec le fond, avec le sujet. Un nuage flotte dans
      // le ciel ; un cadre blanc tient une photo et ses légendes, et le ciel
      // pâle d'une photo borde des visages. Seul compte comme sujet ce qui est
      // franchement plus sombre que le ciel : le contour gris-bleu d'un nuage
      // de dessin animé n'en est pas.
      let contactFond = 0, contactSujet = 0, auBord = false;
      const sombre = (v) => { const j = v * 4; return lum(data[j], data[j + 1], data[j + 2]) < lMur * 0.75; };
      while (debut < fin) {
        const k = file[debut++];
        const x = k % w, y = (k - x) / w;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) auBord = true;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const v = yy * w + xx;
            if (estMur[v]) { contactFond++; continue; }
            if (vuNuage[v]) continue;
            if (nuageux(v)) { vuNuage[v] = 1; file[fin++] = v; } else if (sombre(v)) contactSujet++;
          }
        }
      }
      const flotte = contactFond > 0 && contactFond >= 2 * contactSujet;
      if (flotte && (auBord || fin < MIETTE)) for (let n = 0; n < fin; n++) estMur[file[n]] = 2;
    }
  }

  // --- miettes claires ---
  // Contours de nuage orphelins, ligne de plinthe entre deux objets : petites
  // îles claires restées hors du mur. Effacées (marquées 2). Le texte, les
  // flèches et les badges, sombres, restent.
  const vu = new Uint8Array(w * h);
  for (let k0 = 0; k0 < w * h; k0++) {
    if (estMur[k0] || vu[k0]) continue;
    debut = fin = 0;
    file[fin++] = k0;
    vu[k0] = 1;
    let somme = 0;
    while (debut < fin) {
      const k = file[debut++], i = k * 4;
      somme += lum(data[i], data[i + 1], data[i + 2]);
      const x = k % w, y = (k - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const v = yy * w + xx;
          if (!estMur[v] && !vu[v]) { vu[v] = 1; file[fin++] = v; }
        }
      }
    }
    if (fin < MIETTE && somme / fin >= lMur * 0.75) for (let n = 0; n < fin; n++) estMur[file[n]] = 2;
  }

  // --- distance au sujet, en pixels (Tchebychev) ---
  // Une ombre portée ne s'écarte guère du sujet : moins de 2 % d'assombrissement
  // à 60 px sur les cadres mesurés. Plus loin, un écart de teinte n'est plus une
  // ombre mais un défaut du mur — typiquement la colonne de pastilles effacée
  // par detoure-bandeaux.mjs, repeinte d'un gris uni aux bords nets.
  const PLEINE = 30, NULLE = 80;
  const distance = new Uint16Array(w * h).fill(65535);
  debut = fin = 0;
  for (let k = 0; k < w * h; k++) if (!estMur[k]) { distance[k] = 0; file[fin++] = k; }
  while (debut < fin) {
    const k = file[debut++];
    if (distance[k] >= NULLE) continue;
    const x = k % w, y = (k - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const v = yy * w + xx;
        if (distance[v] > distance[k] + 1) { distance[v] = distance[k] + 1; file[fin++] = v; }
      }
    }
  }

  const sortie = Buffer.from(data);

  // --- mur : ombre convertie en noir translucide ---
  for (let k = 0; k < w * h; k++) {
    if (!estMur[k]) continue;
    const i = k * 4;
    const assombri = (lMur - lum(data[i], data[i + 1], data[i + 2])) / lMur;
    const portee = Math.min(1, Math.max(0, (NULLE - distance[k]) / (NULLE - PLEINE)));
    // Zone morte : les variations d'éclairage du mur à peine perceptibles ne
    // doivent pas laisser un voile gris sur la page.
    const a = estMur[k] === 2 ? 0 : Math.min(1, Math.max(0, (assombri - 0.02) / 0.98)) * portee;
    sortie[i] = sortie[i + 1] = sortie[i + 2] = 0;
    sortie[i + 3] = Math.round(a * 255);
  }

  // --- liseré : démélange sujet / mur ---
  const R = 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (estMur[k]) continue;

      let nMur = 0;
      const W = [0, 0, 0];
      let F = null, dF = -1;
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const v = yy * w + xx, j = v * 4;
          if (estMur[v]) { nMur++; W[0] += data[j]; W[1] += data[j + 1]; W[2] += data[j + 2]; }
        }
      }
      if (!nMur) continue;
      W[0] /= nMur; W[1] /= nMur; W[2] /= nMur;

      // Couleur du sujet : le voisin (hors mur) qui s'écarte le plus du mur.
      const R2 = R + 1;
      for (let dy = -R2; dy <= R2; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -R2; dx <= R2; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const v = yy * w + xx, j = v * 4;
          if (estMur[v]) continue;
          const d = (data[j] - W[0]) ** 2 + (data[j + 1] - W[1]) ** 2 + (data[j + 2] - W[2]) ** 2;
          if (d > dF) { dF = d; F = [data[j], data[j + 1], data[j + 2]]; }
        }
      }
      if (!F || dF < 1) continue;

      const i = k * 4;
      const P = [data[i], data[i + 1], data[i + 2]];
      const a = Math.min(1, Math.max(0,
        ((P[0] - W[0]) * (F[0] - W[0]) + (P[1] - W[1]) * (F[1] - W[1]) + (P[2] - W[2]) * (F[2] - W[2])) / dF
      ));
      if (a > 0.98) continue;
      sortie[i] = F[0]; sortie[i + 1] = F[1]; sortie[i + 2] = F[2];
      sortie[i + 3] = Math.round(a * 255);
    }
  }

  let transparents = 0;
  for (let k = 0; k < w * h; k++) if (sortie[k * 4 + 3] < 8) transparents++;

  const webp = await sharp(sortie, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toBuffer();
  return { webp, part: transparents / (w * h) };
}

let traites = 0, total = 0;
for (const slug of slugs) {
  const source = path.join(RACINE, slug, "galerie");
  const cible = path.join(RACINE, slug, APPLIQUE ? "galerie" : "galerie-detouree");
  const opaque = path.join(source, "opaque");
  const fichiers = fs.readdirSync(source).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();

  const lignes = [];
  for (const nom of fichiers) {
    total++;
    const r = await detoure(path.join(source, nom));
    if (!r) { lignes.push(`${nom.padEnd(10)} — fond non uni, laissé`); continue; }

    const base = path.basename(nom, path.extname(nom));
    fs.mkdirSync(cible, { recursive: true });
    if (APPLIQUE) {
      fs.mkdirSync(opaque, { recursive: true });
      fs.renameSync(path.join(source, nom), path.join(opaque, nom));
    }
    fs.writeFileSync(path.join(cible, base + ".webp"), r.webp);
    traites++;
    lignes.push(`${nom.padEnd(10)} fond retiré (${Math.round(r.part * 100)} % transparent)`);
  }
  console.log(`${slug}\n  ${lignes.join("\n  ")}`);
}

console.log(`\n${traites}/${total} visuels détourés — ${APPLIQUE ? "appliqué" : "aperçu dans galerie-detouree/"}`);
