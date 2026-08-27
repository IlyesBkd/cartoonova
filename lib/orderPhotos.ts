/**
 * Validation des photos d'une commande.
 *
 * La verification vit ici pour etre appliquee aux deux endroits ou une commande
 * peut naitre : la creation du PaymentIntent et l'enregistrement en base. Le
 * navigateur nettoie aussi, mais c'est du confort : seule cette
 * verification-ci fait foi.
 *
 * ── Pourquoi la photo n'est plus obligatoire pour payer ──────────────────
 *
 * Elle l'etait, aux deux bouts. La mesure a montre ce que ca coutait : sur
 * trente jours, dix visiteurs configurent leur portrait et trois seulement
 * envoient une photo. Sept sur dix s'arretent la. Et aucun evenement
 * `purchase_blocked` n'est jamais parti — personne ne se heurtait au refus,
 * les gens partaient avant meme d'essayer.
 *
 * Demander des photos de famille avant d'avoir rien recu de nous est un
 * engagement que la plupart des visiteurs ne prennent pas. La commande peut
 * donc naitre sans photo : le client paie, recoit un lien signe pour les
 * deposer, et une relance s'il ne le fait pas.
 *
 * Ce qui n'a pas bouge : seules des URL https du stockage distant sont
 * acceptees, les doublons tombent, et le plafond reste. Ouvrir la porte a zero
 * photo n'ouvre rien d'autre.
 */

export const MAX_PHOTOS = 8;

/** Longueur au-dela de laquelle on considere l'entree comme malveillante. */
const MAX_URL_LENGTH = 2048;

export interface PhotosInvalides {
  error: string;
}

/**
 * Renvoie la liste nettoyee — eventuellement vide.
 *
 * N'accepte que des URL https : les photos sont deposees sur un stockage blob
 * distant, jamais fournies en ligne par le navigateur. Une entree hors format
 * est ecartee en silence plutot que de faire echouer la commande — c'est du
 * bruit, pas une intention.
 *
 * Le type de retour garde sa forme d'union : `parsePhotoUrls` ne renvoie plus
 * d'erreur aujourd'hui, mais les appelants la traitent deja et une regle
 * future (un format refuse, un quota) retrouverait sa place sans les rouvrir.
 */
export function parsePhotoUrls(raw: unknown): string[] | PhotosInvalides {
  // Champ absent ou mal forme : commande sans photo, pas commande invalide.
  if (!Array.isArray(raw)) return [];

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

  return propres;
}

/** Vrai si `parsePhotoUrls` a echoue. */
export function photosInvalides(
  resultat: string[] | PhotosInvalides
): resultat is PhotosInvalides {
  return !Array.isArray(resultat);
}

/**
 * Vrai si la commande attend encore ses photos.
 *
 * Derive de la liste plutot que stocke : une colonne de plus serait une
 * seconde source de verite a maintenir en phase avec `photo_urls`, et c'est
 * exactement ainsi que deux champs finissent par se contredire.
 */
export function attendDesPhotos(photoUrls: unknown): boolean {
  const photos = parsePhotoUrls(photoUrls);
  return !photosInvalides(photos) && photos.length === 0;
}
