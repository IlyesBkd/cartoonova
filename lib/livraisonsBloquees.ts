import { withFreshDatabaseClient } from "@/lib/db";
import { reconcileDelivery } from "@/lib/orderDelivery";

/* Réparation des livraisons restées « en cours ».

   Un envoi de portrait passe par quatre étapes : journal « sending », appel à
   Resend, historique e-mail « sent » avec l'identifiant Resend, puis journal
   « sent » et date d'envoi sur la commande. Quand la fonction est coupée entre
   les deux dernières (27/11/2026 : Jeanne puis Lisa, Resend lent), le mail est
   parti mais le journal reste « sending » et l'envoi programmé est bloqué pour
   ne jamais envoyer deux fois.

   La preuve existe pourtant déjà en base : l'historique e-mail (même clé
   anti-doublon delivery/<commande>/<type>/<version>) a noté l'acceptation de
   Resend et son identifiant. On ne répare QUE sur cette preuve locale ; sans
   elle, on ne renvoie rien et on laisse la main (agent, Ilyes). */

export type Reparation = { commande: string; type: string; emailId: string; envoyeLe: string };

export async function reparerLivraisonsBloquees(delaiMinutes = 10): Promise<{ reparees: Reparation[]; datesCompletees: number; restantes: number }> {
  const bloquees = await withFreshDatabaseClient(db => db`
    SELECT e.order_id::text AS order_id, e.kind, e.version, h.provider_id, h.sent_at
    FROM order_delivery_effects e
    LEFT JOIN LATERAL (
      SELECT x.provider_id, x.sent_at FROM customer_history_events x
      WHERE x.kind = 'email' AND x.status = 'sent' AND x.provider_id IS NOT NULL AND x.sent_at IS NOT NULL
        AND x.details->>'idempotencyKey' = 'delivery/' || e.order_id::text || '/' || e.kind || '/' || e.version
      ORDER BY x.at LIMIT 1) h ON true
    WHERE e.status IN ('sending', 'uncertain')
      AND e.updated_at < now() - make_interval(mins => ${delaiMinutes})`);
  const reparees: Reparation[] = [];
  let restantes = 0;
  for (const b of bloquees) {
    if (!b.provider_id) { restantes++; continue; }
    const envoyeLe = new Date(b.sent_at as string).toISOString();
    try {
      await reconcileDelivery(b.order_id as string, b.kind as "final_image" | "extras", b.version as string, {
        outcome: "sent", emailId: b.provider_id as string,
        reason: `Réparation automatique : l'historique e-mail montre Resend ${b.provider_id} accepté le ${envoyeLe} (même clé anti-doublon).`,
      });
      if (b.kind === "final_image") {
        await withFreshDatabaseClient(db => db`UPDATE orders SET final_image_sent_at = COALESCE(final_image_sent_at, ${envoyeLe}::timestamptz),
          final_image_scheduled_at = NULL WHERE id = ${b.order_id as string}::uuid`);
      }
      reparees.push({ commande: (b.order_id as string).slice(0, 8), type: b.kind as string, emailId: b.provider_id as string, envoyeLe });
    } catch {
      restantes++;  // verrou pris (envoi en cours) ou état changé entre-temps : on réessaiera au passage suivant
    }
  }
  // Le journal dit « envoyé » mais la commande n'a pas de date (cas de Jeanne) : on reporte la date du journal.
  const dates = await withFreshDatabaseClient(db => db`
    UPDATE orders o SET final_image_sent_at = COALESCE((e.artifacts #>> '{deliveryHistory,sentAt}')::timestamptz, e.updated_at),
      final_image_scheduled_at = NULL
    FROM order_delivery_effects e
    WHERE e.order_id = o.id AND e.kind = 'final_image' AND e.status = 'sent' AND o.final_image_sent_at IS NULL
      AND e.updated_at < now() - make_interval(mins => ${delaiMinutes})
    RETURNING o.id`);
  return { reparees, datesCompletees: dates.length, restantes };
}
