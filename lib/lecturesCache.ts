import { unstable_cache } from "next/cache";
import { getPricesForCurrency } from "./db";
import { lireContenuFiche } from "./contenuFiche";
import { avisPublies, statistiquesAvis } from "./reviewsDb";
import { getAllPublishedArticleRefs, getArticleBySlug, getPublishedArticles, getRelatedArticles } from "./blogDb";
import { produitsJamaisLus } from "./indexation";

/* Lectures en base mises en cache, pour les pages publiques.

   La base vit sur le VPS et chaque connexion depuis Vercel ouvre un tunnel
   SSH : une seule lecture non cachee coutait plusieurs secondes a froid, et
   une fiche en faisait trois a la suite (7 a 16 s mesures le 2 octobre 2026).
   L'accueil, dont le prix passait deja par \`unstable_cache\`, repondait en
   0,3 s. On etend le meme traitement a tout ce qu'affichent les pages.

   Le cache Vercel est partage entre les instances : une instance froide le
   lit sans ouvrir de tunnel. Une erreur n'est jamais mise en cache — c'est a
   l'appelant de degrader (prix par defaut, gabarit sans texte).

   Les etiquettes permettent d'invalider tout de suite apres une modification :
   \`revalidateTag("prix", "max")\` depuis l'admin des prix, etc. */

/** Prix d'une devise. Cinq minutes : un changement dans l'admin apparait vite. */
export const prixEnCache = unstable_cache(
  (devise: Parameters<typeof getPricesForCurrency>[0]) => getPricesForCurrency(devise),
  ["prix-devise"],
  { revalidate: 300, tags: ["prix"] }
);

/** Texte redige d'une fiche. Il change une fois par nuit au plus. */
export const contenuFicheEnCache = unstable_cache(
  (produit: string, locale: string) => lireContenuFiche(produit, locale),
  ["contenu-fiche"],
  { revalidate: 3600, tags: ["contenu"] }
);

export const statistiquesAvisEnCache = unstable_cache(() => statistiquesAvis(), ["avis-stats"], {
  revalidate: 300,
  tags: ["avis"],
});

export const avisPubliesEnCache = unstable_cache((limite?: number) => avisPublies(limite), ["avis-publies"], {
  revalidate: 300,
  tags: ["avis"],
});

export const articlesPubliesEnCache = unstable_cache(
  (locale: string, limite?: number, decalage?: number) => getPublishedArticles(locale, limite, decalage),
  ["blog-liste"],
  { revalidate: 300, tags: ["blog"] }
);

export const articleEnCache = unstable_cache(
  (locale: string, slug: string) => getArticleBySlug(locale, slug),
  ["blog-article"],
  { revalidate: 300, tags: ["blog"] }
);

export const articlesLiesEnCache = unstable_cache(
  (locale: string, categorie: string, sauf: string, limite?: number) =>
    getRelatedArticles(locale, categorie, sauf, limite),
  ["blog-lies"],
  { revalidate: 300, tags: ["blog"] }
);

/** Sert seulement a ordonner des liens : une heure de retard est sans effet. */
export const produitsJamaisLusEnCache = unstable_cache(
  (locale: string) => produitsJamaisLus(locale),
  ["produits-jamais-lus"],
  { revalidate: 3600, tags: ["indexation"] }
);

/** Toutes les references d'articles publies (langue, slug, sujet), pour les hreflang. */
export const refsArticlesEnCache = unstable_cache(() => getAllPublishedArticleRefs(), ["blog-refs"], {
  revalidate: 3600,
  tags: ["blog"],
});
