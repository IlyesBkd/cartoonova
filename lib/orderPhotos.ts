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
 * N'accepte que les URL parseables du store Blob configuré par le même jeton
 * que l'upload. Une entrée invalide fait échouer toute la liste explicitement :
 * elle ne peut pas disparaître silencieusement derrière huit photos valides.
 * Cette validation synchrone porte sur la forme et le stockage, pas la propriété
 * de l'objet : les dépôts authentifiés vérifient aussi le registre CODE-04 via
 * `validatePhotoOwnership` avant toute écriture.
 */
export function parsePhotoUrls(raw: unknown, previouslyAttached: unknown = []): string[] | PhotosInvalides {
  // Supply only the persisted list from an already authenticated order, never
  // request data. Checkout uses the strict default with no legacy exception.
  const attached = new Set(Array.isArray(previouslyAttached) ? previouslyAttached : []);
  if (raw == null) return [];
  if (!Array.isArray(raw)) return { error: "La liste des photos est invalide." };

  const propres: string[] = [];
  for (const entree of raw) {
    if (typeof entree !== "string") return { error: "Une URL de photo est invalide." };
    const url = entree.trim();
    if (!url || url.length > MAX_URL_LENGTH) return { error: "Une URL de photo est invalide." };
    try {
      const parsed = new URL(url);
      // Match the SDK's getStoreIdFromToken/constructBlobUrl contract. No DNS,
      // wildcard Blob host or provider request is used to discover the store.
      const store = /^vercel_blob_rw_([a-zA-Z0-9-]+)_[a-zA-Z0-9_-]+$/.exec(process.env.BLOB_READ_WRITE_TOKEN ?? "")?.[1];
      const origin = store && /^[a-zA-Z0-9-]+$/.test(store)
        ? `https://${store.toLowerCase()}.public.blob.vercel-storage.com` : null;
      if (!origin) return { error: "Configuration du stockage des photos manquante ou invalide." };
      if (parsed.protocol !== "https:" || parsed.origin !== origin || !url.startsWith(origin + "/") || parsed.href !== url || /[?#]/.test(url) || parsed.username || parsed.password) {
        return { error: "Origine de photo interdite." };
      }
      const decodedPath = decodeURIComponent(parsed.pathname);
      // The old browser used timestamp + original filename (spaces and accents
      // included). Decode once, but never admit escaped separators/double escapes.
      const standardPath = /^\/(orders|retouches)\/(?:[a-zA-Z0-9_-]+\/)?[\p{L}\p{N}\p{M} _().-]+\.(?:jpe?g|png|webp|heic|heif)$/iu.test(decodedPath);
      const retainedLegacyPath = entree === url && attached.has(url)
        && /^\/(orders|retouches)\/\d+-[\p{L}\p{N}\p{M} _().+,\x27-]+\.(?:jpe?g|png|webp|heic|heif)$/iu.test(decodedPath);
      if (!/^\/(orders|retouches)\//.test(parsed.pathname) || /%(?:2f|5c|25)/i.test(parsed.pathname) || !(standardPath || retainedLegacyPath)) {
        return { error: "Chemin de photo interdit." };
      }
    } catch {
      return { error: "Une URL de photo est invalide." };
    }
    if (propres.includes(url)) continue;
    propres.push(url);
    if (propres.length > MAX_PHOTOS) return { error: `Un maximum de ${MAX_PHOTOS} photos est autorisé.` };
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
