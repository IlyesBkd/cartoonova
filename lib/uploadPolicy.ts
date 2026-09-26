export type PorteeUpload = "checkout" | "order" | "retouch" | "admin";

export type IntentionUpload =
  | { scope: "checkout" }
  | { scope: "order"; token: string }
  | { scope: "retouch"; token: string }
  | { scope: "admin" };

export const FENETRE_UPLOAD_MS = 10 * 60 * 1000;
export const MAX_UPLOADS_CHECKOUT = 12;
export const MAX_UPLOADS_AUTORISES = 24;
export const MAX_TENTATIVES_UPLOAD = 60;

const TOKEN_COMMANDE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[0-9a-f]{32}$/i;
const TOKEN_RETOUCHE = /^[0-9a-f]{48}$/i;
const UUID_FICHIER = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const EXTENSION_PHOTO = "(?:jpg|png|webp|heic|heif)";

interface FenetreQuota {
  nombre: number;
  expireA: number;
}

/* Ce compteur protège les routes chaudes sans service payant. Comme celui de
   l'admin, il est propre à chaque instance serverless : c'est un frein à l'abus,
   pas une garantie globale. */
const quotas = new Map<string, FenetreQuota>();
const MAX_CLES_QUOTA = 5000;

export function parseUploadIntent(clientPayload: string | null): IntentionUpload | null {
  if (!clientPayload || clientPayload.length > 1024) return null;

  let valeur: unknown;
  try {
    valeur = JSON.parse(clientPayload);
  } catch {
    return null;
  }
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return null;

  const payload = valeur as Record<string, unknown>;
  if (payload.scope === "checkout" || payload.scope === "admin") {
    if ("token" in payload) return null;
    return { scope: payload.scope };
  }
  if (payload.scope === "order" && typeof payload.token === "string" && TOKEN_COMMANDE.test(payload.token)) {
    return { scope: "order", token: payload.token };
  }
  if (payload.scope === "retouch" && typeof payload.token === "string" && TOKEN_RETOUCHE.test(payload.token)) {
    return { scope: "retouch", token: payload.token };
  }
  return null;
}

/** Le nom est aléatoire et sans sous-dossier ; chaque parcours reste isolé. */
export function pathnameAutoriseUpload(scope: PorteeUpload, pathname: string): boolean {
  const photo = `${UUID_FICHIER}\\.${EXTENSION_PHOTO}`;
  switch (scope) {
    case "checkout":
    case "order":
      return new RegExp(`^orders/${photo}$`, "i").test(pathname);
    case "retouch":
      return new RegExp(`^retouches/${photo}$`, "i").test(pathname);
    case "admin":
      return new RegExp(`^final/cartoonova-${photo}$`, "i").test(pathname);
  }
}

export function consommerQuotaUpload(
  cle: string,
  maximum: number,
  maintenant = Date.now()
): { autorise: boolean; reessayerDans: number } {
  const quotaExistant = quotas.get(cle);
  if (quotaExistant && quotaExistant.expireA > maintenant) {
    if (quotaExistant.nombre >= maximum) {
      return { autorise: false, reessayerDans: Math.ceil((quotaExistant.expireA - maintenant) / 1000) };
    }
    quotaExistant.nombre += 1;
    return { autorise: true, reessayerDans: 0 };
  }

  if (quotas.size >= MAX_CLES_QUOTA) {
    for (const [cleInutilisee, entree] of quotas) {
      if (entree.expireA <= maintenant) quotas.delete(cleInutilisee);
    }
    if (quotas.size >= MAX_CLES_QUOTA) {
      return { autorise: false, reessayerDans: 60 };
    }
  }

  quotas.set(cle, { nombre: 1, expireA: maintenant + FENETRE_UPLOAD_MS });
  return { autorise: true, reessayerDans: 0 };
}

/** Lit un corps de requete par chunks sans conserver plus que la limite. */
export async function lireCorpsBorne(
  corps: ReadableStream<Uint8Array> | null,
  tailleMax: number
): Promise<string | null> {
  if (!corps) return "";

  const lecteur = corps.getReader();
  const morceaux: Uint8Array[] = [];
  let taille = 0;

  try {
    while (true) {
      const { done, value } = await lecteur.read();
      if (done) break;
      taille += value.byteLength;
      if (taille > tailleMax) {
        try {
          await lecteur.cancel();
        } catch {
          // Le flux peut deja etre ferme par le serveur ou le client.
        }
        return null;
      }
      morceaux.push(value);
    }
  } finally {
    lecteur.releaseLock();
  }

  const octets = new Uint8Array(taille);
  let decalage = 0;
  for (const morceau of morceaux) {
    octets.set(morceau, decalage);
    decalage += morceau.byteLength;
  }
  return new TextDecoder().decode(octets);
}
