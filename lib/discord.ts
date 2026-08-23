/**
 * Notifications Discord.
 *
 * Le meme bloc `fetch` vers `DISCORD_WEBHOOK_URL` etait recopie a quatre
 * endroits. Il est regroupe ici pour les appelants qui en ont besoin
 * maintenant — la finalisation de commande et le webhook Stripe. Les trois
 * copies restantes (bulle d'aide, confirmation de poster, synchronisation
 * IMAP) fonctionnent et n'ont pas ete touchees : les migrer aurait melange
 * deux sujets dans le meme changement.
 *
 * Aucun appel ne doit jamais faire echouer ce qu'il accompagne : une commande
 * payee ne se perd pas parce que Discord ne repond pas.
 */

export interface ChampDiscord {
  name: string;
  value: string;
  inline?: boolean;
}

export interface MessageDiscord {
  titre: string;
  /** Entier decimal, pas hexadecimal — c'est ce qu'attend l'API Discord. */
  couleur: number;
  champs: ChampDiscord[];
  piedDePage?: string;
}

/** Jaune Cartoonova, pour les evenements normaux. */
export const COULEUR_SOLEIL = 16776960;
/** Rouge, pour ce qui demande une action immediate. */
export const COULEUR_ALERTE = 15158332;
/** Orange, pour ce qui merite un oeil sans etre urgent. */
export const COULEUR_ATTENTION = 16750848;

export async function alerteDiscord(message: MessageDiscord): Promise<void> {
  try {
    const url = process.env.DISCORD_WEBHOOK_URL;
    if (!url) return;

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: message.titre,
            color: message.couleur,
            fields: message.champs,
            footer: { text: message.piedDePage ?? "Cartoonova" },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (erreur) {
    console.error("[discord] notification impossible:", erreur);
  }
}
