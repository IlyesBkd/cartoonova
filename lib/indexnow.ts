import { SITE_URL } from "./site";

/**
 * IndexNow : signalement direct des URL nouvelles ou modifiees a Bing, Yandex,
 * Seznam et Naver, qui partagent le meme point d'entree.
 *
 * C'est le seul canal d'indexation qui ne demande ni compte, ni validation de
 * propriete, ni cle fournie par un tiers : la cle est choisie par le site, et
 * la preuve de propriete consiste a la servir en clair a la racine du domaine.
 * D'ou le fichier `public/<cle>.txt`, dont le contenu est la cle elle-meme.
 *
 * Google n'y participe pas. Pour lui, le levier reste le sitemap (voir
 * `scripts/soumet-sitemap.mjs` et la route cron `/api/cron/seo`).
 */

/* La cle n'est pas un secret : elle est publiquement lisible a la racine du
   site, c'est meme la condition pour qu'elle fonctionne. La garder ici en clair
   evite qu'une variable d'environnement manquante desactive silencieusement le
   signalement. */
export const INDEXNOW_KEY = "673995d9fd7385eb18eb209dc34a4b9e";

const ENDPOINT = "https://api.indexnow.org/indexnow";

/* Le protocole plafonne a 10 000 URL par requete. On reste tres en dessous :
   au-dela de quelques centaines d'URL d'un coup, un lot ressemble a une
   soumission de masse plutot qu'a une notification de changement. */
const MAX_URLS_PAR_LOT = 500;

export interface ResultatIndexNow {
  envoyees: number;
  /** Code HTTP renvoye par le point d'entree, ou `null` si l'appel a echoue. */
  statut: number | null;
  erreur?: string;
}

/**
 * Signale un lot d'URL. Ne leve jamais : un echec de signalement ne doit pas
 * faire echouer la publication qui l'a declenche.
 *
 * Les URL etrangeres au domaine sont ecartees avant l'envoi — IndexNow rejette
 * l'ensemble du lot (422) des qu'une seule n'appartient pas a l'hote declare.
 */
export async function signalerAIndexNow(urls: string[]): Promise<ResultatIndexNow> {
  const hote = new URL(SITE_URL).host;

  const retenues = Array.from(new Set(urls)).filter((u) => {
    try {
      return new URL(u).host === hote;
    } catch {
      return false;
    }
  });

  if (retenues.length === 0) return { envoyees: 0, statut: null };

  const lot = retenues.slice(0, MAX_URLS_PAR_LOT);

  try {
    const reponse = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: hote,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: lot,
      }),
    });

    /* 200 et 202 valent tous deux acceptation ; 429 signale un exces de
       soumissions, ce qui merite d'apparaitre dans le rapport sans etre traite
       comme une panne. */
    return { envoyees: lot.length, statut: reponse.status };
  } catch (error) {
    return {
      envoyees: 0,
      statut: null,
      erreur: error instanceof Error ? error.message : String(error),
    };
  }
}
