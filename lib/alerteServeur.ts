import { alerteDiscord, COULEUR_ALERTE } from "@/lib/discord";
import { mesureServeur, IDENTIFIANT_SYSTEME } from "@/lib/analyticsServeur";
import { MESURES } from "@/lib/evenementsMesure";

/**
 * Panne cote serveur sur un chemin critique : creation du paiement, de la
 * commande, e-mail de confirmation, webhook Stripe, depot de photos…
 *
 * Jusqu'ici ces erreurs n'allaient que dans les journaux Vercel, que personne
 * ne lit : un client pouvait payer sans recevoir son e-mail, ou echouer a
 * payer, sans que la boutique le sache. Ici elles partent aussi sur Discord
 * (et dans PostHog, pour les compter).
 *
 * Une alerte par contexte toutes les 10 minutes au plus et par instance : une
 * panne de Resend ou de la base ne doit pas inonder Discord. Ne leve jamais.
 */
const DELAI_MS = 10 * 60 * 1000;
const derniereAlerte = new Map<string, number>();

export async function signalerPanne(
  contexte: string,
  erreur: unknown,
  details: Record<string, string | number | null | undefined> = {}
): Promise<void> {
  const message = erreur instanceof Error ? erreur.message : String(erreur);
  console.error(`[panne] ${contexte}:`, erreur);

  try {
    await mesureServeur(MESURES.panneServeur, {
      identifiant: IDENTIFIANT_SYSTEME,
      proprietes: { contexte, message: message.slice(0, 300), ...details },
    });

    const maintenant = Date.now();
    if (maintenant - (derniereAlerte.get(contexte) ?? 0) < DELAI_MS) return;
    derniereAlerte.set(contexte, maintenant);

    await alerteDiscord({
      titre: `⚠️ Panne : ${contexte}`,
      couleur: COULEUR_ALERTE,
      champs: [
        { name: "Erreur", value: message.slice(0, 1000) || "(sans message)" },
        ...Object.entries(details)
          .filter(([, v]) => v !== null && v !== undefined && v !== "")
          .slice(0, 8)
          .map(([k, v]) => ({ name: k, value: String(v).slice(0, 200), inline: true })),
      ],
      piedDePage: "Journaux complets : Vercel → Logs",
    });
  } catch (e) {
    console.error("[panne] signalement impossible:", e);
  }
}
