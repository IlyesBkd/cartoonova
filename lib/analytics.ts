import type { PostHog, Properties, CaptureResult } from "posthog-js";
import type { NomEvenement } from "@/lib/evenementsMesure";

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

/** Proprietes dont la valeur ne doit jamais quitter le navigateur. */
const PROPRIETES_INTERDITES = [
  "email",
  "customer_email",
  "recipientEmail",
  "recipient_email",
  "firstName",
  "lastName",
  "first_name",
  "last_name",
  "address",
  "addressLine2",
  "postalCode",
  "postal_code",
  "phone",
  "photoUrls",
  "photo_urls",
  "message",
  "description",
  "note",
];

/** Une adresse e-mail, ou qu'elle se trouve dans une chaine. */
const MOTIF_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/** URL d'une photo client deposee sur Vercel Blob. */
const MOTIF_BLOB = /https?:\/\/[\w-]+\.public\.blob\.vercel-storage\.com\/\S*/g;

function nettoyerChaine(valeur: string): string {
  return valeur.replace(MOTIF_EMAIL, "<email>").replace(MOTIF_BLOB, "<photo>");
}

/**
 * Les cles qui portent l'IDENTITE et non une donnee incidente. Elles doivent
 * traverser le filtre intactes.
 *
 * `posthog-js` range `distinct_id` DANS `properties` — ce n'est pas un champ
 * de premier niveau comme on pourrait le croire. Le nettoyage l'attrapait donc
 * au passage et remplacait l'adresse par la chaine litterale « <email> ».
 *
 * Les consequences etaient bien pires qu'une propriete perdue :
 *
 *  - tous les visiteurs identifies partageaient le meme identifiant, donc
 *    la MEME personne. Au 25 aout, deux clients distincts et 33 evenements
 *    etaient deja confondus sous « <email> » ;
 *  - la mesure serveur, elle, envoie la vraie adresse (posthog-node ne passe
 *    pas par ce filtre). Navigation et achat vivaient donc sous deux personnes
 *    differentes, et aucun tunnel ne pouvait relier une vente a la session qui
 *    l'avait produite.
 *
 * Identifier un client par son adresse est ici deliberé — c'est ce que fait
 * `identifier()`, et ce que fait deja le serveur. Le filtre est la pour les
 * adresses ACCIDENTELLES : celle qui traine dans un parametre d'URL, dans le
 * libelle d'un bouton capture automatiquement, dans un lien de suivi.
 */
const CLES_IDENTITE = [
  "distinct_id",
  "$anon_distinct_id",
  "$device_id",
  "$user_id",
  "alias",
];

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
  if (!evenement?.properties) return evenement;

  for (const [cle, valeur] of Object.entries(evenement.properties)) {
    /* L'identite passe avant tout le reste : la reecrire revient a fusionner
       des personnes distinctes. Voir CLES_IDENTITE. */
    if (CLES_IDENTITE.includes(cle)) continue;

    if (PROPRIETES_INTERDITES.includes(cle)) {
      delete evenement.properties[cle];
      continue;
    }
    if (typeof valeur === "string") {
      evenement.properties[cle] = nettoyerChaine(valeur);
    }
  }

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

        /* Enregistrement de session. Le tunnel de commande manipule photos de
           famille, adresse postale et carte bancaire : tout est masque par
           defaut, et le formulaire de paiement Stripe est purement et
           simplement exclu du film. */
        disable_session_recording: false,
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
  void client().then((posthog) => posthog?.capture(nom, proprietes));
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
  globalesEnAttente = { ...globalesEnAttente, ...proprietes };
  void client().then((posthog) => posthog?.register(proprietes));
}

/**
 * Rattache la session a une personne.
 *
 * Sans cet appel, `person_profiles: "identified_only"` ne cree jamais aucun
 * profil : tout le trafic reste anonyme, et deux visites du meme client depuis
 * le meme navigateur restent deux inconnus. C'est ce qui manquait pour qu'un
 * entonnoir « vue produit → commande » puisse traverser une nuit de reflexion.
 *
 * L'identifiant est l'adresse e-mail, seule cle stable dont le site dispose —
 * il n'y a pas de compte client. Elle n'est pas envoyee comme propriete : le
 * filtre s'en chargerait de toute facon, mais le distinct_id, lui, doit rester
 * lisible pour rapprocher une commande d'une session.
 */
export function identifier(email: string, proprietes?: Properties): void {
  const propre = email.trim().toLowerCase();
  if (!propre.includes("@")) return;
  void client().then((posthog) => posthog?.identify(propre, proprietes));
}

/** Proprietes de la personne (et non de l'evenement) : marche, devise, LTV. */
export function proprietesPersonne(proprietes: Properties): void {
  void client().then((posthog) => posthog?.setPersonProperties(proprietes));
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
