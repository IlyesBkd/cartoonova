/**
 * Limitation du nombre de tentatives, par cle (adresse IP en general).
 *
 * L'espace d'administration est protege par un unique mot de passe partage,
 * envoye en en-tete `x-admin-password`. Rien n'empechait de le deviner en
 * boucle : on pouvait enchainer les essais aussi vite que le reseau le
 * permettait, sur des routes qui exposent les commandes, les prix et la
 * messagerie du support.
 *
 * Compteur en memoire : sur un hebergement sans etat partage, chaque instance a
 * le sien. Ce n'est donc pas une barriere absolue, mais cela transforme une
 * attaque par force brute de quelques heures en quelque chose d'inatteignable,
 * pour zero dependance. Un magasin partage (Redis, base) serait la suite
 * logique si le besoin se confirme.
 */

interface Fenetre {
  /** Horodatages des tentatives echouees encore dans la fenetre. */
  echecs: number[];
  /** Fin du blocage en cours, le cas echeant. */
  bloqueJusqua: number;
}

const registre = new Map<string, Fenetre>();

/** Tentatives echouees tolerees avant blocage. */
const MAX_ECHECS = 8;
/** Duree d'observation des echecs. */
const FENETRE_MS = 10 * 60 * 1000;
/** Duree du blocage une fois le seuil franchi. */
const BLOCAGE_MS = 15 * 60 * 1000;
/** Au-dela, on purge les cles inactives pour ne pas faire enfler la memoire. */
const MAX_CLES = 5000;

function maintenant(): number {
  return Date.now();
}

function purger(now: number): void {
  if (registre.size < MAX_CLES) return;
  for (const [cle, f] of registre) {
    const inactif =
      f.bloqueJusqua < now && (f.echecs.length === 0 || f.echecs[f.echecs.length - 1] < now - FENETRE_MS);
    if (inactif) registre.delete(cle);
  }
}

export interface EtatLimite {
  bloque: boolean;
  /** Secondes a attendre avant de reessayer, quand `bloque` est vrai. */
  reessayerDans: number;
}

/** A appeler AVANT de verifier le mot de passe. */
export function verifierLimite(cle: string): EtatLimite {
  const now = maintenant();
  const f = registre.get(cle);
  if (!f) return { bloque: false, reessayerDans: 0 };

  if (f.bloqueJusqua > now) {
    return { bloque: true, reessayerDans: Math.ceil((f.bloqueJusqua - now) / 1000) };
  }
  return { bloque: false, reessayerDans: 0 };
}

/** A appeler quand le mot de passe fourni est faux. */
export function enregistrerEchec(cle: string): void {
  const now = maintenant();
  purger(now);

  const f = registre.get(cle) ?? { echecs: [], bloqueJusqua: 0 };
  f.echecs = f.echecs.filter((t) => t > now - FENETRE_MS);
  f.echecs.push(now);

  if (f.echecs.length >= MAX_ECHECS) {
    f.bloqueJusqua = now + BLOCAGE_MS;
    f.echecs = [];
  }

  registre.set(cle, f);
}

/** A appeler quand le mot de passe est bon : on repart de zero. */
export function reinitialiser(cle: string): void {
  registre.delete(cle);
}

/**
 * Cle de limitation d'une requete. On prend l'adresse la plus a gauche de
 * `x-forwarded-for`, qui est celle du client d'origine derriere un proxy.
 */
export function cleDepuisRequete(req: Request): string {
  const transmis = req.headers.get("x-forwarded-for");
  if (transmis) {
    const premiere = transmis.split(",")[0]?.trim();
    if (premiere) return premiere;
  }
  return req.headers.get("x-real-ip")?.trim() || "inconnue";
}
