import { ensurePaidAtSchema, runtimeSchemaBootstrapEnabled, sql } from "./db";

/**
 * Les visiteurs qui donnent leur e-mail a la caisse puis s'en vont.
 *
 * Huit personnes sur dix-sept qui atteignent la caisse saisissent leur adresse
 * et partent avant le paiement. La relance de panier abandonne ne les voyait
 * pas : elle ne connait que les commandes PENDING, creees a l'etape suivante.
 * Ces visiteurs-la ne laissaient donc aucune trace exploitable.
 *
 * Une ligne par passage a la caisse, sans photo ni nom : juste de quoi les
 * ramener sur la fiche qu'ils regardaient.
 */

let leadsSchemaReady: Promise<void> | null = null;

/** Miroir local de migrations/2026-10-relances.sql (en production, rien n'est cree ici). */
export async function ensureLeadsSchema(): Promise<void> {
  if (!runtimeSchemaBootstrapEnabled) return;
  if (leadsSchemaReady) return leadsSchemaReady;
  leadsSchemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS checkout_leads (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        locale TEXT NOT NULL,
        style TEXT,
        print_key TEXT,
        total NUMERIC,
        currency TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reminded_at TIMESTAMPTZ
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS checkout_leads_email_idx ON checkout_leads (lower(email), created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS checkout_leads_a_relancer_idx ON checkout_leads (created_at) WHERE reminded_at IS NULL`;
  })().catch((e) => {
    leadsSchemaReady = null;
    throw e;
  });
  return leadsSchemaReady;
}

export interface LeadCaisse {
  id: string;
  email: string;
  locale: string;
  style: string | null;
  print_key: string | null;
  total: number | null;
  currency: string | null;
  created_at: string;
}

/**
 * Enregistre un passage a la caisse, sauf si la meme adresse en a deja laisse
 * un dans les dernieres 24 h : rouvrir la modale trois fois dans la soiree ne
 * doit pas produire trois relances.
 *
 * Le test et l'insertion sont une seule requete, pour que deux appels
 * simultanes ne passent pas tous les deux le test.
 */
export async function enregistrerLead(lead: {
  email: string;
  locale: string;
  style: string | null;
  printKey: string | null;
  total: number | null;
  currency: string | null;
}): Promise<boolean> {
  await ensureLeadsSchema();
  const email = lead.email.trim().toLowerCase();
  const rows = await sql`
    INSERT INTO checkout_leads (email, locale, style, print_key, total, currency)
    SELECT ${email}, ${lead.locale}, ${lead.style}, ${lead.printKey}, ${lead.total}, ${lead.currency}
    WHERE NOT EXISTS (
      SELECT 1 FROM checkout_leads
      WHERE lower(email) = ${email} AND created_at > NOW() - INTERVAL '24 hours'
    )
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Leads a relancer : passes a la caisse il y a plus de `heures` heures et
 * moins de `maxJours` jours, jamais relances.
 *
 * Exclus :
 * - ceux qui ont paye une commande depuis (`paid_at`, jamais le statut : une
 *   commande reprise par l'admin n'est plus PAID mais reste payee) ;
 * - ceux qui ont cree une commande depuis, meme non payee : elle est deja
 *   couverte par la relance de panier abandonne, et deux e-mails pour un seul
 *   abandon, c'est un de trop ;
 * - les adresses desinscrites ;
 * - les adresses deja relancees pour la caisse dans les 7 derniers jours.
 *
 * Une seule ligne par adresse (la plus recente) : un visiteur revenu deux
 * jours de suite ne recoit qu'un e-mail.
 */
export async function getLeadsARelancer(heures: number, maxJours: number): Promise<LeadCaisse[]> {
  await ensureLeadsSchema();
  await ensurePaidAtSchema();
  const rows = await sql`
    SELECT DISTINCT ON (lower(l.email))
      l.id::text AS id, l.email, l.locale, l.style, l.print_key, l.total, l.currency, l.created_at
    FROM checkout_leads l
    WHERE l.reminded_at IS NULL
      AND l.created_at < NOW() - (${heures} * INTERVAL '1 hour')
      AND l.created_at > NOW() - (${maxJours} * INTERVAL '1 day')
      -- Une heure de marge : l'enregistrement du lead part sans etre attendu,
      -- il peut donc arriver en base apres la commande creee a l'etape suivante.
      AND NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE lower(o.customer_email) = lower(l.email)
          AND (o.created_at >= l.created_at - INTERVAL '1 hour'
               OR o.paid_at >= l.created_at - INTERVAL '1 hour')
      )
      AND NOT EXISTS (
        SELECT 1 FROM newsletter_subscribers n
        WHERE lower(n.email) = lower(l.email) AND n.unsubscribed_at IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM checkout_leads r
        WHERE lower(r.email) = lower(l.email)
          AND r.reminded_at > NOW() - INTERVAL '7 days'
      )
    ORDER BY lower(l.email), l.created_at DESC
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    email: String(r.email),
    locale: String(r.locale),
    style: (r.style as string | null) ?? null,
    print_key: (r.print_key as string | null) ?? null,
    total: r.total === null || r.total === undefined ? null : Number(r.total),
    currency: (r.currency as string | null) ?? null,
    created_at: String(r.created_at),
  }));
}

/**
 * Marque TOUS les leads non relances de cette adresse, pas seulement celui qui
 * a declenche l'envoi : les autres se seraient sinon presentes le lendemain.
 */
export async function marquerLeadRelance(email: string): Promise<void> {
  await ensureLeadsSchema();
  await sql`
    UPDATE checkout_leads SET reminded_at = NOW()
    WHERE lower(email) = lower(${email}) AND reminded_at IS NULL
  `;
}
