import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Lang } from "@/lib/email-i18n";
import { SITE_URL } from "@/lib/site";

/**
 * Carte de voeux a imprimer (option F-6) : un PDF A5 paysage de deux pages,
 * le recto avec le portrait du client et les voeux, le verso avec un court
 * message et l'adresse du site.
 *
 * Les helpers communs (polices, image, couleurs) vivent ici et sont repris
 * par `calendrier.ts` : deux copies divergeraient a la premiere retouche.
 */

/* ─── Formats (points PDF, 1 pt = 1/72 pouce) ──────────────────────────── */
const MM = 72 / 25.4;
export const A5_PAYSAGE: [number, number] = [210 * MM, 148 * MM];
export const A4_PORTRAIT: [number, number] = [210 * MM, 297 * MM];

/* ─── Couleurs de la marque ────────────────────────────────────────────── */
export const COULEURS = {
  encre: rgb(0x2a / 255, 0x25 / 255, 0x52 / 255),
  encreDouce: rgb(0x5c / 255, 0x57 / 255, 0x80 / 255),
  soleil: rgb(0xe9 / 255, 0xba / 255, 0x3b / 255),
  soleilPale: rgb(0xfd / 255, 0xf3 / 255, 0xd4 / 255),
  creme: rgb(0xff / 255, 0xfb / 255, 0xf0 / 255),
  blanc: rgb(1, 1, 1),
};

/* ─── Polices ──────────────────────────────────────────────────────────────
   Les polices standard de pdf-lib (Helvetica...) ne couvrent que WinAnsi :
   « ł », « ś » ou « ż » y sont impossibles, et la carte polonaise planterait.
   Rebond Grotesque, la police du site, couvre le polonais, le suedois et le
   danois ; elle est embarquee (sous-ensemble) via fontkit, qui lit le WOFF.
   Lue sur le disque quand le fichier est la (local, ou trace dans la
   fonction), sinon telechargee depuis le site lui-meme. */
const POLICES = { titre: "rebond-700.woff", texte: "rebond-600.woff" } as const;

async function lirePolice(nom: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(path.join(process.cwd(), "public", "polices", nom)));
  } catch {
    const reponse = await fetch(`${SITE_URL}/polices/${nom}`);
    if (!reponse.ok) throw new Error(`Police introuvable : ${nom} (${reponse.status})`);
    return new Uint8Array(await reponse.arrayBuffer());
  }
}

export interface Polices {
  titre: PDFFont;
  texte: PDFFont;
}

export async function embarquerPolices(doc: PDFDocument): Promise<Polices> {
  doc.registerFontkit(fontkit);
  const [titre, texte] = await Promise.all([lirePolice(POLICES.titre), lirePolice(POLICES.texte)]);
  return {
    titre: await doc.embedFont(titre, { subset: true }),
    texte: await doc.embedFont(texte, { subset: true }),
  };
}

/* ─── Image ───────────────────────────────────────────────────────────────
   pdf-lib ne lit que le JPEG et le PNG. Les portraits finaux sont parfois en
   WebP : ceux-la passent par sharp (charge a la demande, seulement alors). */
export type SourceImage = string | Uint8Array;

async function octetsImage(source: SourceImage): Promise<Uint8Array> {
  if (typeof source !== "string") return source;
  const reponse = await fetch(source);
  if (!reponse.ok) throw new Error(`Image injoignable (${reponse.status})`);
  return new Uint8Array(await reponse.arrayBuffer());
}

function estJpeg(o: Uint8Array) {
  return o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff;
}
function estPng(o: Uint8Array) {
  return o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4e && o[3] === 0x47;
}

export async function embarquerImage(doc: PDFDocument, source: SourceImage): Promise<PDFImage> {
  const octets = await octetsImage(source);
  if (estJpeg(octets)) return doc.embedJpg(octets);
  if (estPng(octets)) return doc.embedPng(octets);
  const sharp = (await import("sharp")).default;
  const png = await sharp(Buffer.from(octets)).png().toBuffer();
  return doc.embedPng(new Uint8Array(png));
}

/** Place l'image entiere (sans recadrage) au centre du cadre donne. */
export function dessinerImageContenue(
  page: PDFPage,
  image: PDFImage,
  cadre: { x: number; y: number; largeur: number; hauteur: number },
  { bordure = true }: { bordure?: boolean } = {}
) {
  const echelle = Math.min(cadre.largeur / image.width, cadre.hauteur / image.height);
  const largeur = image.width * echelle;
  const hauteur = image.height * echelle;
  const x = cadre.x + (cadre.largeur - largeur) / 2;
  const y = cadre.y + (cadre.hauteur - hauteur) / 2;
  if (bordure) {
    page.drawRectangle({
      x: x - 4,
      y: y - 4,
      width: largeur + 8,
      height: hauteur + 8,
      color: COULEURS.blanc,
      borderColor: COULEURS.encre,
      borderWidth: 2,
    });
  }
  page.drawImage(image, { x, y, width: largeur, height: hauteur });
}

/** Texte centre horizontalement, reduit si besoin pour tenir dans `largeurMax`. */
export function texteCentre(
  page: PDFPage,
  texte: string,
  { police, taille, y, couleur = COULEURS.encre, largeurMax }: {
    police: PDFFont;
    taille: number;
    y: number;
    couleur?: ReturnType<typeof rgb>;
    largeurMax?: number;
  }
) {
  const limite = largeurMax ?? page.getWidth() - 40;
  let corps = taille;
  while (corps > 6 && police.widthOfTextAtSize(texte, corps) > limite) corps -= 0.5;
  const largeur = police.widthOfTextAtSize(texte, corps);
  page.drawText(texte, { x: (page.getWidth() - largeur) / 2, y, size: corps, font: police, color: couleur });
}

/** L'annee des voeux : celle qui commence au prochain 1er janvier (ou l'annee en cours en janvier). */
export function anneeDesVoeux(date: Date = new Date()): number {
  return date.getMonth() === 0 ? date.getFullYear() : date.getFullYear() + 1;
}

/* ─── Textes de la carte ─────────────────────────────────────────────────
   La carte est envoyee PAR le client a ses proches : le verso s'adresse a
   eux, sans tutoiement ni vouvoiement marques. */
const TEXTES: Record<Lang, { voeux: string; annee: (a: number) => string; message: string; credit: string }> = {
  fr: { voeux: "Joyeux Noël", annee: (a) => `et bonne année ${a} !`, message: "Plein de bonheur et de douceur pour la nouvelle année.", credit: "Portrait dessiné à la main par Cartoonova" },
  en: { voeux: "Merry Christmas", annee: (a) => `and a Happy New Year ${a}!`, message: "Wishing you joy and warmth all through the new year.", credit: "Portrait hand-drawn by Cartoonova" },
  es: { voeux: "Feliz Navidad", annee: (a) => `¡y próspero año ${a}!`, message: "Mucha alegría y cariño para el nuevo año.", credit: "Retrato dibujado a mano por Cartoonova" },
  de: { voeux: "Frohe Weihnachten", annee: (a) => `und ein gutes neues Jahr ${a}!`, message: "Viel Freude und Herzlichkeit im neuen Jahr.", credit: "Porträt von Hand gezeichnet von Cartoonova" },
  it: { voeux: "Buon Natale", annee: (a) => `e felice ${a}!`, message: "Tanta gioia e serenità per il nuovo anno.", credit: "Ritratto disegnato a mano da Cartoonova" },
  nl: { voeux: "Vrolijk kerstfeest", annee: (a) => `en een gelukkig ${a}!`, message: "Veel geluk en warmte in het nieuwe jaar.", credit: "Portret met de hand getekend door Cartoonova" },
  pl: { voeux: "Wesołych Świąt", annee: (a) => `i szczęśliwego Nowego Roku ${a}!`, message: "Dużo radości i ciepła w nowym roku.", credit: "Portret narysowany ręcznie przez Cartoonova" },
  sv: { voeux: "God jul", annee: (a) => `och gott nytt år ${a}!`, message: "Massor av glädje och värme under det nya året.", credit: "Porträtt handritat av Cartoonova" },
  da: { voeux: "Glædelig jul", annee: (a) => `og godt nytår ${a}!`, message: "Masser af glæde og varme i det nye år.", credit: "Portræt håndtegnet af Cartoonova" },
  pt: { voeux: "Feliz Natal", annee: (a) => `e um feliz ${a}!`, message: "Muita alegria e carinho no novo ano.", credit: "Retrato desenhado à mão pela Cartoonova" },
};

/** Petites etoiles decoratives, dessinees (aucune police n'est sure d'avoir le glyphe). */
function etoile(page: PDFPage, cx: number, cy: number, r: number) {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const rayon = i % 2 === 0 ? r : r * 0.45;
    points.push(`${(Math.cos(angle) * rayon).toFixed(2)} ${(Math.sin(angle) * rayon).toFixed(2)}`);
  }
  page.drawSvgPath(`M ${points.join(" L ")} Z`, { x: cx, y: cy, color: COULEURS.soleil });
}

/**
 * Genere la carte. `image` : URL du portrait final ou ses octets.
 * Renvoie les octets du PDF.
 */
export async function genererCarteVoeux(
  image: SourceImage,
  lang: Lang,
  { date = new Date() }: { date?: Date } = {}
): Promise<Uint8Array> {
  const t = TEXTES[lang] ?? TEXTES.en;
  const annee = anneeDesVoeux(date);

  const doc = await PDFDocument.create();
  doc.setTitle(`${t.voeux} ${annee}`);
  doc.setAuthor("Cartoonova");
  doc.setCreator("cartoonova.com");

  const polices = await embarquerPolices(doc);
  const portrait = await embarquerImage(doc, image);
  const [L, H] = A5_PAYSAGE;
  const marge = 10 * MM;

  /* ── Recto : le portrait, puis les voeux dans le bandeau du bas ── */
  const recto = doc.addPage(A5_PAYSAGE);
  recto.drawRectangle({ x: 0, y: 0, width: L, height: H, color: COULEURS.creme });
  const bandeau = 30 * MM;
  recto.drawRectangle({ x: 0, y: 0, width: L, height: bandeau, color: COULEURS.soleilPale });
  dessinerImageContenue(recto, portrait, {
    x: marge,
    y: bandeau + 6 * MM,
    largeur: L - 2 * marge,
    hauteur: H - bandeau - 6 * MM - marge,
  });
  texteCentre(recto, t.voeux, { police: polices.titre, taille: 30, y: bandeau - 15 * MM, largeurMax: L - 2 * marge });
  texteCentre(recto, t.annee(annee), {
    police: polices.texte,
    taille: 15,
    y: bandeau - 23 * MM,
    couleur: COULEURS.encreDouce,
    largeurMax: L - 2 * marge,
  });
  etoile(recto, marge + 6, bandeau - 11 * MM, 9);
  etoile(recto, L - marge - 6, bandeau - 11 * MM, 9);

  /* ── Verso : message court, puis l'adresse du site ── */
  const verso = doc.addPage(A5_PAYSAGE);
  verso.drawRectangle({ x: 0, y: 0, width: L, height: H, color: COULEURS.creme });
  etoile(verso, L / 2, H * 0.68, 14);
  texteCentre(verso, t.message, { police: polices.texte, taille: 16, y: H * 0.52, largeurMax: L - 4 * marge });
  texteCentre(verso, t.credit, {
    police: polices.texte,
    taille: 9,
    y: marge + 12,
    couleur: COULEURS.encreDouce,
  });
  texteCentre(verso, "cartoonova.com", { police: polices.titre, taille: 11, y: marge });

  return doc.save();
}
