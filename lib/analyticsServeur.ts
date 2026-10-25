import { PostHog } from "posthog-node";
import { createHmac, randomUUID } from "node:crypto";
import { diagnosticErreur, proprietesMesure } from "@/lib/confidentialiteMesure";
import type { NomEvenement } from "@/lib/evenementsMesure";

/**
 * Mesure cote serveur.
 *
 * Pourquoi elle existe alors que le navigateur mesure deja.
 *
 * L'achat n'etait compte que par la page de succes, dans le navigateur. Or
 * cette page est la derniere du parcours, et c'est precisement celle qu'on
 * ferme : un client qui revient a son onglet de messagerie des la redirection
 * Stripe, un portefeuille mobile qui rend la main dans une vue integree, un
 * bloqueur de publicites, une coupure reseau — dans chacun de ces cas le
 * paiement a bien eu lieu, la commande passe en PAID, l'e-mail part, et
 * PostHog ne voit rien. Le chiffre d'affaires mesure est donc, par
 * construction, inferieur au chiffre d'affaires reel, d'une marge que
 * personne ne connait.
 *
 * Ici, l'evenement part du serveur, au moment exact ou la commande bascule en
 * PAID. Ce basculement est deja protege contre le double comptage — il
 * n'arrive qu'une fois par commande, quoi qu'il arrive au navigateur.
 *
 * Les adresses sont pseudonymisees par HMAC-SHA256 avec un secret serveur.
 * Le navigateur conserve son identite anonyme, jamais l'adresse client.
 */

let client: PostHog | null = null;
let clientTente = false;

function identiteMesure(identifiant: string): string {
  if (!identifiant.includes("@")) return identifiant;
  const secret = process.env.NEWSLETTER_SECRET || process.env.CRON_SECRET || process.env.STRIPE_SECRET_KEY;
  // Keep counting business events without merging people or hashing an email
  // with a public/weak salt when the deployment has no configured secret.
  if (!secret) return `anonymous_${randomUUID()}`;
  return `person_${createHmac("sha256", secret).update(`analytics:v1:${identifiant.trim().toLowerCase()}`).digest("hex")}`;
}

/* Seule la production mesure. Un serveur local ou une preview Vercel partagent
   la meme cle PostHog : le 2 octobre 2026, cinq achats de test passes en local
   (dont un bon cadeau de 40 EUR) sont arrives comme de vraies ventes. Le
   filtre du navigateur (`filtrerAvantEnvoi`) ne voyait pas ces envois-ci. */
// `VERCEL` vaut "1" sur toute fonction Vercel ; `VERCEL_ENV` distingue la
// production des previews quand il est expose (absent : on le traite comme la
// production, pour ne jamais couper la mesure des vraies ventes par erreur).
const MESURE_ACTIVE =
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV !== "preview" &&
  process.env.VERCEL_ENV !== "development";

/** Adresses reservees aux tests (Resend, exemples) : jamais des clients. */
export function estAdresseDeTest(identifiant: string): boolean {
  return /@(resend\.dev|example\.(com|org|net))$/i.test(identifiant.trim());
}

function obtenirClient(): PostHog | null {
  if (clientTente) return client;
  clientTente = true;

  if (!MESURE_ACTIVE) return null;
  const cle = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!cle) return null;

  client = new PostHog(cle, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    /* Une fonction serverless ne vit que le temps de la requete : un lot qui
       attend d'etre plein n'est jamais envoye. Chaque evenement part seul, et
       `mesureServeur` attend son depart. */
    flushAt: 1,
    flushInterval: 0,
  });

  return client;
}

/**
 * Envoie un evenement et attend sa remise.
 *
 * L'attente est volontaire, et c'est l'inverse du choix fait cote client. Sur
 * Vercel, l'execution est coupee des que la reponse est rendue : un envoi
 * lance sans etre attendu est simplement perdu. Le `catch` garantit en
 * revanche qu'une panne de PostHog ne fasse jamais echouer une commande.
 */
export async function mesureServeur(
  nom: NomEvenement,
  {
    identifiant,
    proprietes,
  }: { identifiant: string; proprietes?: Record<string, unknown> }
): Promise<void> {
  if (estAdresseDeTest(identifiant)) return;
  const posthog = obtenirClient();
  if (!posthog) return;

  try {
    posthog.capture({
      distinctId: identiteMesure(identifiant),
      event: nom,
      properties: proprietesMesure(proprietes),
      /* Sans cela PostHog resout l'IP de l'appelant — celle du datacentre
         Vercel — et chaque commande semblerait venir de Francfort. Le pays
         reel du client est deja porte par `detected_country`. */
      disableGeoip: true,
    });
    await posthog.flush();
  } catch (erreur) {
    console.error("[mesure] envoi impossible:", diagnosticErreur(erreur));
  }
}

/**
 * Renseigne les proprietes de la personne — marche, devise, nombre de
 * commandes. Utile pour segmenter sans avoir a rejouer tout l'historique.
 */
export async function personneServeur(
  identifiant: string,
  proprietes: Record<string, unknown>
): Promise<void> {
  if (estAdresseDeTest(identifiant)) return;
  const posthog = obtenirClient();
  if (!posthog) return;

  try {
    posthog.identify({ distinctId: identiteMesure(identifiant), properties: proprietesMesure(proprietes), disableGeoip: true });
    await posthog.flush();
  } catch (erreur) {
    console.error("[mesure] identification impossible:", diagnosticErreur(erreur));
  }
}

/**
 * Identifiant a utiliser quand aucune adresse n'est connue — un appel de cron,
 * une visite anonyme cote serveur. Les evenements restent groupables sans
 * inventer une fausse personne.
 */
export const IDENTIFIANT_SYSTEME = "systeme";
