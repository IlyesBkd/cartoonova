import { CATALOGUE_EN_LIGNE, slugProduit, universProduit, type Produit } from "./catalogue";
import { produitsJamaisLus } from "./indexation";
import { visuelsProduit } from "./visuels";
import type { Locale } from "@/i18n/config";

/**
 * Relie le blog aux pages qui vendent.
 *
 * ── Ce qui manquait ──────────────────────────────────────────────────────
 *
 * Le blog publie tous les jours et ne pointait vers aucune fiche. Pas un lien.
 * Un lecteur arrive sur « Offrir un portrait Simpson a Noel » et repart sans
 * qu'on lui ait montre le portrait Simpson.
 *
 * Cote moteur, c'est pire encore. Sur les adresses relevees, huit portent la
 * mention « Google ne reconnait pas cette URL » et douze « detectee,
 * actuellement non indexee ». Ces pages-la ne manquent pas de texte : elles
 * manquent de chemins. Personne n'y conduit, donc personne ne les explore, et
 * aucune quantite de contenu n'y changera rien tant que ce sera vrai.
 *
 * ── Comment les liens sont choisis ───────────────────────────────────────
 *
 * D'abord par le sujet : si l'article parle de Naruto, il pointe vers Naruto.
 * C'est le lien utile, celui qu'un lecteur suit.
 *
 * Ensuite, on complete avec les fiches que Google n'a jamais lues. C'est la
 * seule facon automatique de leur donner un chemin, et ca ne coute rien au
 * lecteur : ce sont de vrais produits, presentes comme tels.
 *
 * Le reste est comble par des univers de la meme famille, pour que le bloc
 * soit toujours plein plutot qu'a moitie vide.
 */

export interface LienProduit {
  /** Slug dans la langue courante — l'adresse reelle, pas le slug canonique. */
  slug: string;
  univers: string;
  visuel: string | null;
}

/** Retire accents et ponctuation, pour comparer un titre a un nom d'univers. */
function aplatir(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Le nom de l'univers apparait-il dans ce texte ? */
function evoque(produit: Produit, locale: Locale, texte: string): boolean {
  const nom = aplatir(universProduit(produit, locale));
  if (nom.length < 3) return false;
  // Bornes de mot : « lego » ne doit pas se declencher sur « allegorie ».
  return new RegExp(`(^| )${nom.replace(/ /g, " ")}( |$)`).test(texte);
}

/**
 * Decalage stable tire du titre.
 *
 * Sans lui, tous les articles d'une langue affichent les trois memes fiches :
 * un bloc identique partout se lit comme du gabarit, et surtout il ne donne un
 * chemin qu'a trois orphelines alors qu'il y en a douze. En decalant l'entree
 * dans la liste selon l'article, chaque page eclaire des fiches differentes,
 * et l'ensemble du blog finit par toutes les couvrir.
 *
 * Stable : le meme article montre toujours les memes liens d'un rendu a
 * l'autre, sinon le maillage changerait a chaque visite du robot.
 */
function decalage(graine: string, taille: number): number {
  if (taille <= 0) return 0;
  let somme = 0;
  for (const c of graine) somme = (somme * 31 + c.charCodeAt(0)) % 100003;
  return somme % taille;
}

/** Fait tourner une liste pour qu'elle commence a la position donnee. */
function pivoter<T>(liste: T[], depart: number): T[] {
  if (liste.length <= 1) return liste;
  const d = depart % liste.length;
  return [...liste.slice(d), ...liste.slice(0, d)];
}

function versLien(p: Produit, locale: Locale): LienProduit {
  return {
    slug: slugProduit(p, locale),
    univers: universProduit(p, locale),
    // Le visuel se lit toujours sous le slug canonique, qui nomme le dossier.
    visuel: visuelsProduit(p.slug).galerie[0] ?? null,
  };
}

/**
 * Fiches a mettre en avant sous un article.
 *
 * Ne leve jamais : un bloc de liens absent est un manque, une page d'article
 * en erreur est une perte. Si la base ne repond pas, on se rabat sur le seul
 * rapprochement par sujet, qui ne demande rien d'autre que le catalogue.
 */
export async function liensPourArticle(
  locale: Locale,
  titre: string,
  motsCles: string[] = [],
  combien = 3
): Promise<LienProduit[]> {
  const texte = aplatir([titre, ...motsCles].join(" "));

  const parSujet = CATALOGUE_EN_LIGNE.filter((p) => evoque(p, locale, texte));
  const retenus: Produit[] = [...parSujet];
  const pris = new Set(retenus.map((p) => p.slug));

  /* Les fiches sans chemin, ensuite : c'est ici qu'on leur en donne un. */
  if (retenus.length < combien) {
    let orphelines: string[] = [];
    try {
      orphelines = await produitsJamaisLus(locale);
    } catch {
      /* Sonde muette : on continue sans cette preference. */
    }
    for (const slug of pivoter(orphelines, decalage(titre, orphelines.length))) {
      if (retenus.length >= combien) break;
      if (pris.has(slug)) continue;
      const p = CATALOGUE_EN_LIGNE.find((x) => x.slug === slug);
      if (!p) continue; // retiree du catalogue depuis le dernier releve
      retenus.push(p);
      pris.add(slug);
    }
  }

  /* Puis la meme famille, pour finir de remplir le bloc. */
  if (retenus.length < combien) {
    const famille = parSujet[0]?.categorie;
    const reste = pivoter(
      CATALOGUE_EN_LIGNE.filter(
        (p) => !pris.has(p.slug) && (!famille || p.categorie === famille)
      ),
      decalage(titre, CATALOGUE_EN_LIGNE.length)
    );
    for (const p of reste) {
      if (retenus.length >= combien) break;
      retenus.push(p);
      pris.add(p.slug);
    }
  }

  return retenus.slice(0, combien).map((p) => versLien(p, locale));
}
