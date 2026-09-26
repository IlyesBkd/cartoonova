export const TYPES_PHOTO_AUTORISES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const TAILLE_MAX_PHOTO = 10 * 1024 * 1024;

type TypePhotoAutorise = (typeof TYPES_PHOTO_AUTORISES)[number];
type DossierPhoto = "orders" | "retouches" | "final";

const EXTENSION_PAR_TYPE: Record<TypePhotoAutorise, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const TYPE_PAR_EXTENSION: Record<string, TypePhotoAutorise> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export interface PhotoUpload {
  pathname: string;
  contentType: TypePhotoAutorise;
}

/**
 * Construit un chemin opaque pour que le nom choisi par le client ne se retrouve
 * pas dans l'URL publique du blob. Si le navigateur ne renseigne pas le MIME,
 * seule l'extension connue du fichier sert de repli.
 */
export function creerCheminPhoto(
  dossier: DossierPhoto,
  typeMime: string,
  nomFichier?: string
): PhotoUpload | null {
  const typeNormalise = typeMime.trim().toLowerCase();
  let typeAutorise = TYPES_PHOTO_AUTORISES.find((type) => type === typeNormalise);

  if (!typeAutorise && !typeNormalise) {
    const extension = nomFichier?.split(/[./\\\\]/).pop()?.toLowerCase();
    typeAutorise = extension ? TYPE_PAR_EXTENSION[extension] : undefined;
  }
  if (!typeAutorise) return null;

  const identifiant = globalThis.crypto.randomUUID();
  const extension = EXTENSION_PAR_TYPE[typeAutorise];
  const nom = dossier === "final" ? `cartoonova-${identifiant}.${extension}` : `${identifiant}.${extension}`;
  return { pathname: `${dossier}/${nom}`, contentType: typeAutorise };
}
