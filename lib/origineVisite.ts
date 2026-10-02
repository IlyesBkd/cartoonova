/**
 * D'ou vient le client, retenu jusqu'a la commande.
 *
 * ── Pourquoi en base et pas seulement dans PostHog ───────────────────────
 *
 * La question « cette vente, elle vient d'ou ? » s'est posee et n'a pas pu
 * etre tranchee : la table des commandes ne gardait aucune origine, et la
 * reponse dormait dans PostHog, derriere une cle personnelle a revoquer.
 *
 * A trois ventes par trimestre, chacune merite d'etre expliquee, et cette
 * explication doit vivre a cote de la commande — pas dans un outil tiers dont
 * l'acces peut se perdre, dont l'historique s'efface, et qu'un bloqueur de
 * publicite empeche parfois de rapporter.
 *
 * ── Premier contact, pas dernier ─────────────────────────────────────────
 *
 * On retient la PREMIERE visite, pas celle qui precede immediatement l'achat.
 * Quelqu'un qui decouvre le site par un assistant, revient deux jours plus
 * tard en tapant l'adresse, puis commande, a ete amene par l'assistant : le
 * dernier contact ne dirait que « direct », ce qui est vrai et sans interet.
 *
 * L'origine est donc ecrite une seule fois, et jamais ecrasee ensuite.
 *
 * ── Ce qui n'est pas garde ───────────────────────────────────────────────
 *
 * Ni l'URL complete, ni les parametres inconnus : seulement le domaine
 * referent, les trois champs de campagne et le chemin d'arrivee. Un referent
 * peut contenir une requete de recherche, et un chemin des identifiants — on
 * coupe donc a la longueur utile plutot que de tout recopier.
 */

const CLE = "cartoonova_origine";
/** Un an : au-dela, rattacher une vente a une visite n'a plus de sens. */
const DUREE_JOURS = 365;

export interface OrigineVisite {
  /** Domaine referent, ou "direct". */
  referent: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  /** Chemin d'arrivee, sans la chaine de requete. */
  arrivee: string;
  /** Date du premier contact, en ISO. */
  le: string;
  /** Dernier clic publicitaire connu : plateforme et identifiant de clic
      (`oppref` ChatGPT, `gclid` Google, `fbclid` Meta). Contrairement au
      reste, il est mis a jour a chaque nouveau clic : c'est lui qui permet
      d'attribuer la vente a la campagne. */
  pub?: { plateforme: string; clic: string; le: string } | null;
}

function tronquer(v: string | null, max = 120): string | null {
  if (!v) return null;
  const t = v.trim().slice(0, max);
  return t || null;
}

/**
 * Ecrit l'origine au premier passage, et seulement au premier.
 *
 * Ne leve jamais : un cookie refuse ou un stockage indisponible ne doit pas
 * empecher de naviguer. On perd alors l'attribution, ce qui est un manque,
 * pas une panne.
 */
/** Clic publicitaire present dans l'URL d'arrivee, ou null. */
function clicPub(params: URLSearchParams): OrigineVisite["pub"] {
  const paires: [string, string][] = [["oppref", "chatgpt"], ["gclid", "google"], ["gbraid", "google"], ["wbraid", "google"], ["fbclid", "meta"]];
  for (const [param, plateforme] of paires) {
    const v = params.get(param);
    if (v) return { plateforme, clic: v.slice(0, 200), le: new Date().toISOString() };
  }
  return null;
}

function ecrire(origine: OrigineVisite): void {
  const expire = new Date(Date.now() + DUREE_JOURS * 864e5).toUTCString();
  document.cookie =
    `${CLE}=${encodeURIComponent(JSON.stringify(origine))}` +
    `; path=/; expires=${expire}; SameSite=Lax`;
}

export function capturerOrigine(): void {
  if (typeof document === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const pub = clicPub(params);

    if (document.cookie.includes(`${CLE}=`)) {
      // Origine deja connue : seul un nouveau clic publicitaire la complete.
      const connue = lireOrigine();
      if (pub && connue) ecrire({ ...connue, pub });
      return;
    }

    let referent = "direct";
    if (document.referrer) {
      try {
        const h = new URL(document.referrer).hostname.replace(/^www\./, "");
        // Une navigation interne n'est pas une origine.
        if (h && h !== window.location.hostname.replace(/^www\./, "")) referent = h;
      } catch {
        /* referent illisible : on reste sur "direct". */
      }
    }

    const origine: OrigineVisite = {
      referent,
      utm_source: tronquer(params.get("utm_source"), 60),
      utm_medium: tronquer(params.get("utm_medium"), 60),
      utm_campaign: tronquer(params.get("utm_campaign"), 60),
      arrivee: window.location.pathname.slice(0, 120),
      le: new Date().toISOString(),
      pub,
    };

    ecrire(origine);
  } catch {
    /* Stockage indisponible : on continue sans attribution. */
  }
}

/** Relit l'origine pour l'envoyer avec la commande. Null si inconnue. */
export function lireOrigine(): OrigineVisite | null {
  if (typeof document === "undefined") return null;
  try {
    const brut = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${CLE}=`))
      ?.slice(CLE.length + 1);
    if (!brut) return null;
    return JSON.parse(decodeURIComponent(brut)) as OrigineVisite;
  } catch {
    return null;
  }
}

/**
 * Valide ce qui arrive du navigateur avant de l'ecrire en base.
 *
 * Le cookie est modifiable par le visiteur : on ne recopie donc que des champs
 * connus, tronques, et on refuse tout le reste. Sans quoi n'importe quoi
 * finirait dans la colonne, y compris de quoi encombrer le tableau de bord.
 */
export function validerOrigine(valeur: unknown): OrigineVisite | null {
  if (!valeur || typeof valeur !== "object") return null;
  const o = valeur as Record<string, unknown>;
  const texte = (v: unknown, max: number) =>
    typeof v === "string" ? tronquer(v, max) : null;

  const referent = texte(o.referent, 120);
  const arrivee = texte(o.arrivee, 120);
  if (!referent && !arrivee) return null;

  return {
    referent: referent ?? "direct",
    utm_source: texte(o.utm_source, 60),
    utm_medium: texte(o.utm_medium, 60),
    utm_campaign: texte(o.utm_campaign, 60),
    arrivee: arrivee ?? "/",
    le: typeof o.le === "string" && !Number.isNaN(Date.parse(o.le))
      ? o.le
      : new Date().toISOString(),
    pub: validerPub(o.pub),
  };
}

/* Le cookie est modifiable : seules trois plateformes connues et un
   identifiant borne passent. */
function validerPub(v: unknown): OrigineVisite["pub"] {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  if (typeof p.plateforme !== "string" || !["chatgpt", "google", "meta"].includes(p.plateforme)) return null;
  if (typeof p.clic !== "string" || !p.clic.trim()) return null;
  const le = typeof p.le === "string" && !Number.isNaN(Date.parse(p.le)) ? p.le : new Date().toISOString();
  return { plateforme: p.plateforme, clic: p.clic.slice(0, 200), le };
}
