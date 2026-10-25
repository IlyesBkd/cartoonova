import type { PostHog, Properties, CaptureResult } from "posthog-js";
import type { NomEvenement } from "@/lib/evenementsMesure";
import { proprietesMesure } from "@/lib/confidentialiteMesure";

/**
 * Chargement differe de PostHog.
 *
 * Le SDK etait importe en statique par le provider qui enveloppe toute
 * l'application, donc present dans le bundle initial de chaque page : 282 Ko
 * mesures sur l'accueil, 18 % de tout le JavaScript charge. Il n'a pourtant
 * rien a faire avant que la page ne soit interactive — aucun de ses appels ne
 * participe au rendu.
 *
 * Ici il est importe a la premiere mesure, c'est-a-dire juste apres
 * l'hydratation, quand la vue de page part. Le telechargement quitte le
 * chemin critique sans qu'aucun evenement ne soit perdu : la promesse est
 * partagee, les appels suivants la reutilisent.
 *
 * Ce module est le SEUL point d'entree cote client. Rien d'autre n'importe
 * `posthog-js` : c'est ce qui garantit que la configuration de
 * confidentialite ci-dessous s'applique partout, sans exception.
 */

/* ═══ ou partent les evenements ═════════════════════════════════════════
   Pas `eu.i.posthog.com` en direct. Ce domaine figure dans EasyPrivacy, que
   uBlock Origin et Brave appliquent par defaut : sur un trafic europeen, la
   part de visiteurs qui le bloquent est loin d'etre marginale, et ce sont
   silencieusement les memes visiteurs qui manquent dans chaque entonnoir.
   Les requetes passent donc par notre propre domaine, reecrit vers PostHog
   dans `next.config.ts`. `ui_host` reste le vrai domaine : c'est lui qui
   construit les liens « voir dans PostHog » de la barre d'outils. */
const CHEMIN_INGESTION = "/ingest";

/* Le domaine de l'application, pas celui de l'ingestion : `NEXT_PUBLIC_POSTHOG_HOST`
   vaut `eu.i.posthog.com`, qui recoit les evenements mais ne sert aucune page. */
const HOTE_INTERFACE = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://eu.posthog.com";

/* Bandeau de consentement. Tant que ce drapeau est absent, le comportement est
   celui d'avant : PostHog mesure des l'arrivee. Mis a "1", plus rien n'est
   capture avant un choix explicite, et un refus bascule en mode sans cookie
   plutot qu'en silence complet — voir `components/BandeauConsentement.tsx`.
   ATTENTION : le mode sans cookie doit aussi etre active dans les reglages du
   projet PostHog, sinon ces evenements-la sont ignores a l'arrivee. */
const CONSENTEMENT_REQUIS = process.env.NEXT_PUBLIC_CONSENT_BANNER === "1";

/* ═══ hygiene des donnees personnelles ══════════════════════════════════
   Trois fuites possibles, toutes fermees ici plutot que sur chaque appel :
   un oubli sur un seul appel suffirait a envoyer l'adresse d'un client. */

/** Adresses reservees aux tests : une session de test ne doit rien compter. */
const MOTIF_ADRESSE_TEST = /@(resend\.dev|example\.(com|org|net))$/i;

/** Identity fields must never be redacted into a shared person. */
const CLES_IDENTITE = ["distinct_id", "$anon_distinct_id", "$device_id", "$user_id", "alias"];

/** Cookie pose par `/api/admin/auth` sur le navigateur de l'admin. */
export const COOKIE_INTERNE = "cn_interne";

/**
 * Trafic qui ne vient pas d'un client : robots d'audit (Playwright, Chrome
 * sans tete, Lighthouse), developpement local, et le navigateur de l'admin.
 * Au 30/09/2026, ces visites pesaient plus que les vraies dans les
 * entonnoirs : avec 0 a 2 commandes par mois, quelques passages de test
 * suffisaient a fausser chaque taux.
 */
function traficInterne(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (navigator.webdriver) return true;
    if (/HeadlessChrome|Lighthouse|Chrome-Lighthouse|PTST/i.test(navigator.userAgent)) return true;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return true;
    return document.cookie.split("; ").includes(`${COOKIE_INTERNE}=1`);
  } catch {
    return false;
  }
}

/**
 * Dernier filet avant l'envoi. Il s'applique a TOUS les evenements, y compris
 * ceux que PostHog genere lui-meme — `$autocapture`, `$exception`,
 * `$pageview` — que notre code ne construit pas et ou une adresse peut donc
 * arriver par un chemin qu'on n'a pas prevu : un e-mail dans un parametre
 * d'URL, un lien de suivi, le libelle d'un bouton.
 */
/* Exporte pour etre testable : c'est la fonction qui, mal ecrite, a confondu
   deux clients sous une meme identite. Elle ne merite pas de rester hors de
   portee d'une verification. */
export function filtrerAvantEnvoi(evenement: CaptureResult | null): CaptureResult | null {
  if (traficInterne()) return null;
  if (!evenement?.properties) return evenement;
  const id = evenement.properties.distinct_id;
  if (typeof id === "string" && MOTIF_ADRESSE_TEST.test(id)) return null;

  // Never merge legacy email identities into one redacted person. Drop only
  // this unsafe event; client() resets legacy persisted identities below.
  for (const cle of CLES_IDENTITE) {
    const identite = evenement.properties[cle];
    if (typeof identite === "string" && /@|%40|https?:|\//i.test(identite)) return null;
  }
  // The SDK token is the PUBLIC project key, required for ingestion, not an
  // access token from a customer URL. Restore this one SDK-owned field only.
  const tokenProjet = evenement.properties.token;
  evenement = proprietesMesure(evenement);
  if (tokenProjet === process.env.NEXT_PUBLIC_POSTHOG_KEY) evenement.properties.token = tokenProjet;

  return evenement;
}

/* ═══ le client ═════════════════════════════════════════════════════════ */

let chargement: Promise<PostHog | null> | null = null;

/** Proprietes globales posees avant que le SDK ne soit charge. */
let globalesEnAttente: Properties = {};

function client(): Promise<PostHog | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  const cle = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!cle) return Promise.resolve(null);

  /* Ni robots, ni nous-memes. Releve d'octobre 2026 sur 60 jours : 91 sessions
     « Chrome / Linux / Etats-Unis » — des navigateurs pilotes, qui faisaient
     croire que /en ne convertissait rien — et 35 sessions sur l'admin, comptees
     comme des visites. `navigator.webdriver` est leve par Playwright, Puppeteer
     et Selenium ; les robots des assistants qui affichent la page aussi. */
  if (navigator.webdriver || /^\/(?:[a-z]{2}\/)?admin(?:\/|$)/.test(window.location.pathname)) {
    return Promise.resolve(null);
  }

  chargement ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(cle, {
        /* Notre domaine, reecrit vers PostHog. Voir CHEMIN_INGESTION. */
        api_host: CHEMIN_INGESTION,
        ui_host: HOTE_INTERFACE,

        /* Les defauts de la bibliotheque ont change plusieurs fois ; les
           epingler evite qu'une montee de version modifie en silence ce qui
           est mesure. */
        defaults: "2026-01-30",

        person_profiles: "identified_only",
        // No feature flags are used here. Their evaluation transport bypasses
        // before_send and includes the raw initial URL/person properties.
        advanced_disable_feature_flags: true,

        /* La vue de page est envoyee a la main par `PostHogProvider` : avec
           l'App Router, une navigation client ne recharge pas la page et
           l'automatisme en manquerait la majorite. */
        capture_pageview: false,
        capture_pageleave: true,

        /* Erreurs JavaScript non rattrapees et promesses rejetees. Sans elles,
           un tunnel casse par une exception ne se voit que par la chute des
           conversions, sans jamais dire pourquoi. */
        capture_exceptions: true,

        /* Web Vitals. Le suivi des Core Web Vitals existait par releves
           manuels (`data/seo/cwv-local-*.md`) ; la mesure de terrain, elle,
           dit ce que vivent les vrais visiteurs. */
        capture_performance: { web_vitals: true },

        /* Clics morts et clics de rage : les deux signaux qui designent un
           element qui parait cliquable et ne l'est pas. Sur une fiche produit
           a configurateur, c'est exactement le type de panne qui coute une
           commande sans laisser de trace. */
        capture_dead_clicks: true,
        rageclick: true,

        /* Carte de chaleur des clics et du defilement. */
        enable_heatmaps: true,

        /* Masque gclid, fbclid et consorts dans les URL enregistrees, plus la
           liste ci-dessous : la page de suivi porte un jeton signe dans son
           chemin, et le lien de desinscription une adresse e-mail. */
        mask_personal_data_properties: true,
        custom_personal_data_properties: ["email", "token", "payment_intent"],

        /* Les valeurs saisies ne sont jamais envoyees, quelle que soit la
           propriete qui les porterait. */
        before_send: filtrerAvantEnvoi,

        /* Les snapshots compresses du replay ne passent pas par notre filtre
           de donnees. Pas de film tant que ce transport prive n'est pas audite ;
           les evenements commerciaux anonymes restent actifs et testes. */
        disable_session_recording: true,
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: "[data-prive]",
          blockSelector: ".StripeElement, iframe[name^='__privateStripeFrame'], [data-prive-bloc]",
        },

        /* Aucun sondage n'existe dans le code, et PostHog telechargeait tout
           de meme surveys.js — 98 Ko sur chaque page. */
        disable_surveys: true,

        /* Un visiteur qui a demande a ne pas etre suivi ne l'est pas. */
        respect_dnt: true,

        ...(CONSENTEMENT_REQUIS
          ? ({
              /* Rien avant un choix. Un refus bascule en mode sans cookie :
                 le trafic reste compte, sans identifiant persistant. */
              opt_out_capturing_by_default: true,
              cookieless_mode: "on_reject",
            } as const)
          : {}),
      });

      // Existing local storage may still contain an email distinct_id from
      // the old release. Reset before flags/events can reuse that identity.
      if (posthog.get_distinct_id()?.includes("@")) posthog.reset();
      if (Object.keys(globalesEnAttente).length) {
        posthog.register(globalesEnAttente);
      }

      return posthog;
    })
    .catch(() => null);

  return chargement;
}

/* ═══ surface publique ══════════════════════════════════════════════════ */

/**
 * Enregistre un evenement. Volontairement sans valeur de retour et sans
 * attente : la mesure ne doit jamais retarder ni faire echouer ce qu'elle
 * observe — surtout dans le tunnel de commande.
 *
 * Le nom est contraint par `NomEvenement` : une faute de frappe cree sinon un
 * evenement jumeau qui n'apparait dans aucun entonnoir et que personne ne
 * remarque avant des semaines.
 */
export function mesure(nom: NomEvenement, proprietes?: Record<string, unknown>): void {
  void client().then((posthog) => posthog?.capture(nom, proprietesMesure(proprietes)));
}

/**
 * Proprietes jointes a tous les evenements suivants — langue, devise, pays.
 *
 * Elles etaient jusqu'ici recopiees a la main dans quelques appels et absentes
 * de tous les autres, ce qui rendait impossible la seule question qui compte
 * pour l'ouverture des marches anglophones : est-ce que le taux de conversion
 * differe par marche.
 *
 * L'appel fonctionne avant que le SDK ne soit charge : les valeurs sont mises
 * de cote et posees a l'initialisation.
 */
export function contexte(proprietes: Properties): void {
  proprietes = proprietesMesure(proprietes);
  globalesEnAttente = { ...globalesEnAttente, ...proprietes };
  void client().then((posthog) => posthog?.register(proprietes));
}

/** Identify with a server-provided pseudonym or order ID, never an email.
 * Existing email callers keep the anonymous session and safe segmentation.
 */
export function identifier(identifiant: string, proprietes?: Properties): void {
  // No browser-side email hash: it is dictionary-reversible. Email callers
  // retain the SDK anonymous identity and safe business segmentation.
  if (/@|%40|https?:|\//i.test(identifiant)) {
    if (proprietes) proprietesPersonne(proprietes);
    return;
  }
  if (!/^(?:person_[a-f0-9]{64}|order_[a-zA-Z0-9_-]+)$/.test(identifiant)) return;
  void client().then((posthog) => posthog?.identify(identifiant, proprietesMesure(proprietes)));
}

/** Proprietes de la personne (et non de l'evenement) : marche, devise, LTV. */
export function proprietesPersonne(proprietes: Properties): void {
  void client().then((posthog) => posthog?.setPersonProperties(proprietesMesure(proprietes)));
}

/**
 * Detache la session de la personne. A appeler quand un visiteur repart d'une
 * page de commande partagee — sans quoi le poste d'un cybercafe attribuerait
 * les commandes suivantes au client precedent.
 */
export function oublier(): void {
  void client().then((posthog) => posthog?.reset());
}

/* ═══ consentement ══════════════════════════════════════════════════════ */

export type EtatConsentement = "granted" | "denied" | "pending";

/** Choix deja exprime, ou `pending` si le bandeau doit encore etre montre. */
export async function etatConsentement(): Promise<EtatConsentement> {
  const posthog = await client();
  return posthog?.get_explicit_consent_status() ?? "pending";
}

export function accepterMesure(): void {
  void client().then((posthog) => posthog?.opt_in_capturing());
}

export function refuserMesure(): void {
  void client().then((posthog) => posthog?.opt_out_capturing());
}

/** Le bandeau n'a de raison d'exister que si le drapeau est leve. */
export const bandeauConsentementActif = CONSENTEMENT_REQUIS;
