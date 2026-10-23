import { sql } from "./db";
import { estPhysique, type OptionsSupport } from "./supportCommande";

/**
 * Ce qui attend une action de notre part et que personne n'a signale.
 *
 * Releve du 24 octobre 2026, sur onze commandes payees : trois tirages valides
 * par le client n'avaient jamais ete commandes chez l'imprimeur (le plus
 * ancien depuis 44 jours), une cliente avait demande un remboursement par
 * trois e-mails restes sans reponse, et le delai de l'apercu allait jusqu'a
 * onze jours pour une promesse de 48 h. Rien de tout cela n'etait cache : la
 * base le savait. Il manquait seulement quelqu'un pour le dire.
 *
 * Lecture seule. Le recapitulatif se repete chaque jour tant que la situation
 * dure — une alerte qui se tait d'elle-meme reproduirait l'oubli.
 */

/* Au-dela, une situation n'est plus un oubli a rattraper mais un dossier clos
   autrement (par telephone, hors de l'admin) : la relancer chaque jour pendant
   des mois noierait le reste. */
const FENETRE_JOURS = 60;

export interface ImpressionEnAttente {
  id: string;
  client: string;
  valideeLe: string;
}

export interface MessageSansReponse {
  id: number;
  orderId: string | null;
  de: string;
  objet: string | null;
  recuLe: string;
}

export interface ApercuEnRetard {
  id: string;
  client: string;
  payeeLe: string;
}

/** Tirages valides par le client, toujours pas commandes chez l'imprimeur. */
export async function impressionsEnAttente(heures = 24): Promise<ImpressionEnAttente[]> {
  const rows = (await sql`
    SELECT id::text AS id, coalesce(customer_name, customer_email) AS client,
           poster_confirmation_responded_at AS validee_le, options
    FROM orders
    WHERE paid_at IS NOT NULL
      AND poster_confirmation_status = 'confirmed'
      AND poster_confirmation_responded_at < NOW() - (${heures} * INTERVAL '1 hour')
      AND poster_confirmation_responded_at > NOW() - (${FENETRE_JOURS} * INTERVAL '1 day')
      AND fournisseur_ref IS NULL
      AND expedie_le IS NULL
      AND statut_force IS NULL
      AND status NOT IN ('shipped', 'completed')
    ORDER BY poster_confirmation_responded_at ASC
  `) as unknown as { id: string; client: string; validee_le: string; options: unknown }[];

  return rows
    .filter((r) => {
      const options = typeof r.options === "string" ? JSON.parse(r.options) : r.options;
      return estPhysique(options as OptionsSupport);
    })
    .map((r) => ({ id: r.id, client: r.client, valideeLe: String(r.validee_le) }));
}

/**
 * Messages clients restes sans reponse.
 *
 * Lu ne veut pas dire traite : la demande de remboursement qui a motive cette
 * alerte avait ete ouverte. On compte donc les messages sans AUCUNE reponse
 * partie depuis l'admin apres eux — ni au message, ni a l'adresse — et sans
 * envoi de portrait ou d'apercu posterieur sur la commande.
 *
 * Seuls les messages rattaches a une commande ou classes « client » comptent :
 * les non-classes melangent clients et notifications d'outils.
 */
export async function messagesSansReponse(heures = 24): Promise<MessageSansReponse[]> {
  const rows = (await sql`
    SELECT m.id, m.order_id::text AS order_id, m.from_email, m.subject, m.received_at
    FROM support_messages m
    LEFT JOIN orders o ON o.id = m.order_id
    WHERE m.received_at < NOW() - (${heures} * INTERVAL '1 hour')
      AND m.received_at > NOW() - (${FENETRE_JOURS} * INTERVAL '1 day')
      AND (m.order_id IS NOT NULL OR m.category = 'customer')
      AND m.category IS DISTINCT FROM 'spam'
      AND m.category IS DISTINCT FROM 'notification'
      AND NOT EXISTS (
        SELECT 1 FROM support_replies r
        WHERE r.support_message_id = m.id
           OR (r.sent_at > m.received_at AND lower(r.to_email) = lower(m.from_email))
      )
      AND (o.final_image_sent_at IS NULL OR o.final_image_sent_at < m.received_at)
      AND (o.poster_confirmation_sent_at IS NULL OR o.poster_confirmation_sent_at < m.received_at)
      AND (o.expedition_email_envoye_le IS NULL OR o.expedition_email_envoye_le < m.received_at)
    ORDER BY m.received_at ASC
  `) as unknown as { id: number; order_id: string | null; from_email: string; subject: string | null; received_at: string }[];

  /* Un client qui ecrit trois fois n'est qu'un seul dossier : on garde son
     message le plus ancien, celui qui dit depuis quand il attend. */
  const vus = new Set<string>();
  const uniques: MessageSansReponse[] = [];
  for (const r of rows) {
    const cle = r.order_id ?? r.from_email.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    uniques.push({ id: r.id, orderId: r.order_id, de: r.from_email, objet: r.subject, recuLe: String(r.received_at) });
  }
  return uniques;
}

/** Commandes payees, photos recues, sans apercu ni portrait apres `heures`. */
export async function apercusEnRetard(heures = 48): Promise<ApercuEnRetard[]> {
  const rows = (await sql`
    SELECT id::text AS id, coalesce(customer_name, customer_email) AS client, paid_at
    FROM orders
    WHERE paid_at < NOW() - (${heures} * INTERVAL '1 hour')
      AND paid_at > NOW() - (${FENETRE_JOURS} * INTERVAL '1 day')
      AND jsonb_typeof(photo_urls::jsonb) = 'array'
      AND jsonb_array_length(photo_urls::jsonb) > 0
      AND poster_confirmation_sent_at IS NULL
      AND final_image_sent_at IS NULL
      AND final_image_scheduled_at IS NULL
      AND statut_force IS NULL
      AND status NOT IN ('shipped', 'completed')
    ORDER BY paid_at ASC
  `) as unknown as { id: string; client: string; paid_at: string }[];
  return rows.map((r) => ({ id: r.id, client: r.client, payeeLe: String(r.paid_at) }));
}
