import { PostHog } from "posthog-node";
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
 * Le `distinct_id` est l'adresse e-mail, la meme cle que `identifier()` cote
 * client : c'est ce qui recolle l'achat a la session qui l'a precede, et donc
 * ce qui permet a un entonnoir « vue produit → achat » de se fermer.
 */

let client: PostHog | null = null;
let clientTente = false;

function obtenirClient(): PostHog | null {
  if (clientTente) return client;
  clientTente = true;

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
  const posthog = obtenirClient();
  if (!posthog) return;

  try {
    posthog.capture({
      distinctId: identifiant,
      event: nom,
      properties: proprietes,
      /* Sans cela PostHog resout l'IP de l'appelant — celle du datacentre
         Vercel — et chaque commande semblerait venir de Francfort. Le pays
         reel du client est deja porte par `detected_country`. */
      disableGeoip: true,
    });
    await posthog.flush();
  } catch (erreur) {
    console.error("[mesure] envoi impossible:", erreur);
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
  const posthog = obtenirClient();
  if (!posthog) return;

  try {
    posthog.identify({ distinctId: identifiant, properties: proprietes, disableGeoip: true });
    await posthog.flush();
  } catch (erreur) {
    console.error("[mesure] identification impossible:", erreur);
  }
}

/**
 * Identifiant a utiliser quand aucune adresse n'est connue — un appel de cron,
 * une visite anonyme cote serveur. Les evenements restent groupables sans
 * inventer une fausse personne.
 */
export const IDENTIFIANT_SYSTEME = "systeme";
