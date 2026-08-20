/**
 * Validation des photos d'une commande.
 *
 * Une commande sans photo est impossible a honorer : l'illustrateur n'a pas de
 * modele. Le formulaire bloquait nulle part — ni dans le navigateur, ni sur le
 * serveur — et on atteignait le formulaire de carte bancaire avec zero photo.
 *
 * La verification vit ici pour etre appliquee aux deux endroits ou une commande
 * peut naitre : la creation du PaymentIntent et l'enregistrement en base. Le
 * navigateur bloque aussi, mais c'est du confort : seule cette verification-ci
 * fait foi.
 */

export const MAX_PHOTOS = 8;

/** Longueur au-dela de laquelle on considere l'entree comme malveillante. */
const MAX_URL_LENGTH = 2048;

export interface PhotosInvalides {
  error: string;
}

/**
 * Renvoie la liste nettoyee, ou une erreur si aucune photo exploitable.
 * N'accepte que des URL https — les photos sont deposees sur un stockage blob
 * distant, jamais fournies en ligne par le navigateur.
 */
export function parsePhotoUrls(raw: unknown): string[] | PhotosInvalides {
  if (!Array.isArray(raw)) {
    return { error: "Au moins une photo est requise." };
  }

  const propres: string[] = [];
  for (const entree of raw) {
    if (typeof entree !== "string") continue;
    const url = entree.trim();
    if (!url || url.length > MAX_URL_LENGTH) continue;
    if (!/^https:\/\//i.test(url)) continue;
    if (propres.includes(url)) continue;
    propres.push(url);
    if (propres.length === MAX_PHOTOS) break;
  }

  if (propres.length === 0) {
    return { error: "Au moins une photo est requise." };
  }

  return propres;
}

/** Vrai si `parsePhotoUrls` a echoue. */
export function photosInvalides(
  resultat: string[] | PhotosInvalides
): resultat is PhotosInvalides {
  return !Array.isArray(resultat);
}
