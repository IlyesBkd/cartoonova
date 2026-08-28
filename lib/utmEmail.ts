/**
 * Marque les liens des e-mails pour que leurs clics soient attribuables.
 *
 * ── Ce qui manquait ─────────────────────────────────────────────────────
 *
 * Aucun lien d'e-mail ne portait de parametre de campagne. Les relances de
 * panier abandonne, la demande d'avis a dix jours, les rappels de photos, la
 * sequence de bienvenue : tout partait, et les visiteurs qui revenaient
 * arrivaient en trafic direct, indiscernables de quelqu'un qui tape l'adresse.
 *
 * Le canal e-mail etait donc invisible des deux cotes — ni les envois, ni les
 * clics. On ne pouvait pas repondre a la question la plus simple : est-ce que
 * ces e-mails servent a quelque chose ?
 *
 * ── Pourquoi ces trois parametres et pas d'autres ───────────────────────
 *
 * `utm_source`, `utm_medium` et `utm_campaign` suffisent, et PostHog comme
 * Search Console les lisent nativement. On s'arrete la : `utm_content` et
 * `utm_term` servent a departager des variantes d'annonce, ce qui n'existe pas
 * ici, et chaque parametre de plus est une chance de plus de casser un lien
 * signe en le recopiant mal.
 *
 * ── Ce qui n'est PAS marque ─────────────────────────────────────────────
 *
 * Le lien de desinscription. Marquer la sortie comme une campagne polluerait
 * les rapports d'acquisition avec des gens qui partent, et n'apprend rien
 * qu'un evenement de desinscription ne dise deja mieux.
 */

/** Campagnes existantes. Le type ferme evite qu'une faute de frappe cree une
    campagne jumelle qui n'apparait dans aucun rapport. */
export type CampagneEmail =
  | "confirmation"
  | "depot_photos"
  | "rappel_photos"
  | "suivi"
  | "demande_avis"
  | "rachat"
  | "panier_abandonne"
  | "bienvenue"
  | "poster";

/**
 * Ajoute les parametres de campagne a une URL du site.
 *
 * Conserve la chaine de requete existante : le lien d'avis porte deja `?c=`
 * avec le jeton signe de la commande, et l'ecraser rendrait le lien inutile.
 */
export function lienEmail(url: string, campagne: CampagneEmail): string {
  const separateur = url.includes("?") ? "&" : "?";
  return (
    `${url}${separateur}utm_source=email&utm_medium=cycle_de_vie` +
    `&utm_campaign=${encodeURIComponent(campagne)}`
  );
}
