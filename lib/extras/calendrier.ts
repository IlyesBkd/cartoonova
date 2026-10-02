import { PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import type { Lang } from "@/lib/email-i18n";
import {
  A4_PORTRAIT,
  COULEURS,
  anneeDesVoeux,
  dessinerImageContenue,
  embarquerImage,
  embarquerPolices,
  texteCentre,
  type SourceImage,
} from "./carteVoeux";

/**
 * Calendrier a imprimer (option F-7) : un PDF A4 portrait de 13 pages — une
 * couverture, puis un mois par page, le portrait en haut et la grille en bas.
 *
 * Les noms de mois et de jours viennent d'`Intl.DateTimeFormat` dans la langue
 * de la commande : aucune table a tenir, et le polonais ou le danois sont
 * justes sans relecture. La semaine commence le lundi partout, sauf en
 * anglais (marche americain, voir `lib/evenements.ts`) ou elle commence le
 * dimanche.
 */

const MM = 72 / 25.4;

function majuscule(texte: string, lang: Lang) {
  return texte.charAt(0).toLocaleUpperCase(lang) + texte.slice(1);
}

function nomMois(annee: number, mois: number, lang: Lang) {
  const nom = new Intl.DateTimeFormat(lang, { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(annee, mois, 1))
  );
  return majuscule(nom, lang);
}

/** Les 7 en-tetes de colonne, dans l'ordre de la semaine du marche. */
function joursSemaine(lang: Lang, premierJour: number) {
  const format = new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" });
  // 4 janvier 1970 : un dimanche.
  return Array.from({ length: 7 }, (_, i) =>
    majuscule(format.format(new Date(Date.UTC(1970, 0, 4 + ((premierJour + i) % 7)))).replace(/\.$/, ""), lang)
  );
}

function dessinerGrille(
  page: PDFPage,
  polices: { titre: PDFFont; texte: PDFFont },
  { annee, mois, lang, premierJour, cadre }: {
    annee: number;
    mois: number;
    lang: Lang;
    premierJour: number;
    cadre: { x: number; y: number; largeur: number; hauteur: number };
  }
) {
  const entetes = joursSemaine(lang, premierJour);
  const colonne = cadre.largeur / 7;
  const hauteurEntete = 9 * MM;
  const rangees = 6;
  const rangee = (cadre.hauteur - hauteurEntete) / rangees;
  const haut = cadre.y + cadre.hauteur;

  // En-tetes des jours.
  page.drawRectangle({
    x: cadre.x,
    y: haut - hauteurEntete,
    width: cadre.largeur,
    height: hauteurEntete,
    color: COULEURS.soleil,
  });
  entetes.forEach((nom, i) => {
    const taille = 10;
    const largeur = polices.titre.widthOfTextAtSize(nom, taille);
    page.drawText(nom, {
      x: cadre.x + i * colonne + (colonne - largeur) / 2,
      y: haut - hauteurEntete + (hauteurEntete - taille) / 2 + 2,
      size: taille,
      font: polices.titre,
      color: COULEURS.encre,
    });
  });

  // Cases des jours.
  const premier = new Date(Date.UTC(annee, mois, 1)).getUTCDay();
  const decalage = (premier - premierJour + 7) % 7;
  const nbJours = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
  const finDeSemaine = [0, 6]; // dimanche, samedi

  for (let r = 0; r < rangees; r++) {
    for (let c = 0; c < 7; c++) {
      const x = cadre.x + c * colonne;
      const y = haut - hauteurEntete - (r + 1) * rangee;
      page.drawRectangle({
        x,
        y,
        width: colonne,
        height: rangee,
        borderColor: COULEURS.encre,
        borderWidth: 0.6,
        color: finDeSemaine.includes((premierJour + c) % 7) ? COULEURS.soleilPale : COULEURS.blanc,
      });
      const jour = r * 7 + c - decalage + 1;
      if (jour < 1 || jour > nbJours) continue;
      page.drawText(String(jour), {
        x: x + 2.5 * MM,
        y: y + rangee - 6 * MM,
        size: 12,
        font: polices.titre,
        color: COULEURS.encre,
      });
    }
  }
}

/**
 * Genere le calendrier. `image` : URL du portrait final ou ses octets.
 * `annee` : par defaut l'annee qui vient (2027 pour une commande d'octobre 2026
 * a janvier 2027).
 */
export async function genererCalendrier(
  image: SourceImage,
  lang: Lang,
  { annee = anneeDesVoeux() }: { annee?: number } = {}
): Promise<Uint8Array> {
  const premierJour = lang === "en" ? 0 : 1;

  const doc = await PDFDocument.create();
  doc.setTitle(`Calendrier ${annee}`);
  doc.setAuthor("Cartoonova");
  doc.setCreator("cartoonova.com");

  const polices = await embarquerPolices(doc);
  const portrait = await embarquerImage(doc, image);
  const [L, H] = A4_PORTRAIT;
  const marge = 12 * MM;

  /* ── Couverture ── */
  const couverture = doc.addPage(A4_PORTRAIT);
  couverture.drawRectangle({ x: 0, y: 0, width: L, height: H, color: COULEURS.creme });
  dessinerImageContenue(couverture, portrait, {
    x: marge,
    y: 75 * MM,
    largeur: L - 2 * marge,
    hauteur: H - 75 * MM - marge,
  });
  texteCentre(couverture, String(annee), { police: polices.titre, taille: 96, y: 35 * MM });
  texteCentre(couverture, "cartoonova.com", {
    police: polices.texte,
    taille: 11,
    y: marge,
    couleur: COULEURS.encreDouce,
  });

  /* ── Un mois par page ── */
  for (let mois = 0; mois < 12; mois++) {
    const page = doc.addPage(A4_PORTRAIT);
    page.drawRectangle({ x: 0, y: 0, width: L, height: H, color: COULEURS.creme });

    // Moitie haute : le portrait.
    dessinerImageContenue(page, portrait, {
      x: marge,
      y: H / 2 + 4 * MM,
      largeur: L - 2 * marge,
      hauteur: H / 2 - 4 * MM - marge,
    });

    // Titre du mois.
    const titre = `${nomMois(annee, mois, lang)} ${annee}`;
    texteCentre(page, titre, { police: polices.titre, taille: 26, y: H / 2 - 14 * MM });

    // Grille.
    dessinerGrille(page, polices, {
      annee,
      mois,
      lang,
      premierJour,
      cadre: { x: marge, y: marge + 6 * MM, largeur: L - 2 * marge, hauteur: H / 2 - 22 * MM - marge - 6 * MM },
    });

    texteCentre(page, "cartoonova.com", {
      police: polices.texte,
      taille: 8,
      y: marge - 2 * MM,
      couleur: COULEURS.encreDouce,
    });
  }

  return doc.save();
}
