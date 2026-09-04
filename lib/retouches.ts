import { sql } from "./db";

/**
 * L'historique des retouches demandees sur une commande.
 *
 * ── Pourquoi une table et pas une colonne ────────────────────────────────
 *
 * `poster_confirmation_note` ne garde qu'une demande : la derniere ecrase la
 * precedente. Or une retouche n'est pas un evenement, c'est une conversation.
 * Un client ecrit « We are almost there. One other edit. » — le « one OTHER »
 * dit tout : il y en avait une avant, et elle n'existe plus.
 *
 * Pire, l'envoi d'une nouvelle demande de validation remet cette colonne a
 * NULL. Le deuxieme aller-retour effacait donc le premier deux fois : a
 * l'ecriture de la reponse, et au renvoi du visuel corrige.
 *
 * Une ligne par demande resout les deux : rien n'ecrase rien, et l'historique
 * survit a la reinitialisation du jeton.
 *
 * ── Ce qui reste dans les colonnes ───────────────────────────────────────
 *
 * `poster_confirmation_note` et `_photos` continuent de porter la DERNIERE
 * demande. Elles alimentent l'alerte Discord et le statut de la commande, et
 * les vider casserait ce qui marche pour aucun gain. L'historique s'ajoute a
 * cote plutot que de remplacer.
 */

export interface Retouche {
  id: number;
  orderId: string;
  note: string | null;
  photos: string[];
  demandeeLe: string;
}

let schemaPret: Promise<void> | null = null;

async function assurerSchema(): Promise<void> {
  if (schemaPret) return schemaPret;
  schemaPret = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS retouches (
        id          SERIAL PRIMARY KEY,
        order_id    UUID NOT NULL REFERENCES orders(id),
        note        TEXT,
        photos      JSONB NOT NULL DEFAULT '[]',
        demandee_le TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    /* La lecture se fait toujours par commande, du plus recent au plus ancien. */
    await sql`
      CREATE INDEX IF NOT EXISTS retouches_commande
      ON retouches (order_id, demandee_le DESC)
    `;
  })().catch((e) => {
    schemaPret = null;
    throw e;
  });
  return schemaPret;
}

/**
 * Ajoute une demande a l'historique.
 *
 * Ne leve jamais : perdre une ligne d'historique est regrettable, mais faire
 * echouer la reponse du client l'est bien davantage — il croirait sa demande
 * perdue et la renverrait, ou pire, abandonnerait.
 */
export async function enregistrerRetouche(
  orderId: string,
  note: string | null,
  photos: string[] = []
): Promise<void> {
  try {
    await assurerSchema();
    await sql`
      INSERT INTO retouches (order_id, note, photos)
      VALUES (${orderId}::uuid, ${note}, ${JSON.stringify(photos)}::jsonb)
    `;
  } catch (erreur) {
    console.error("[retouches] enregistrement impossible:", orderId, erreur);
  }
}

/** Toutes les demandes d'une commande, la plus recente d'abord. */
export async function retouchesDeCommande(orderId: string): Promise<Retouche[]> {
  try {
    await assurerSchema();
    const rows = (await sql`
      SELECT id, order_id, note, photos, demandee_le
      FROM retouches WHERE order_id = ${orderId}::uuid
      ORDER BY demandee_le DESC, id DESC
    `) as unknown as Record<string, unknown>[];
    return rows.map((r) => ({
      id: Number(r.id),
      orderId: String(r.order_id),
      note: (r.note as string) ?? null,
      photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
      demandeeLe: String(r.demandee_le),
    }));
  } catch (erreur) {
    console.error("[retouches] lecture impossible:", orderId, erreur);
    return [];
  }
}

/** Combien de demandes pour cette commande — sert a numeroter l'alerte. */
export async function nombreRetouches(orderId: string): Promise<number> {
  try {
    await assurerSchema();
    const rows = (await sql`
      SELECT count(*)::int AS n FROM retouches WHERE order_id = ${orderId}::uuid
    `) as unknown as { n: number }[];
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

/** Historique de plusieurs commandes d'un coup, pour le tableau de bord. */
export async function retouchesParCommande(): Promise<Map<string, Retouche[]>> {
  try {
    await assurerSchema();
    const rows = (await sql`
      SELECT id, order_id, note, photos, demandee_le
      FROM retouches ORDER BY demandee_le DESC, id DESC LIMIT 500
    `) as unknown as Record<string, unknown>[];
    const par = new Map<string, Retouche[]>();
    for (const r of rows) {
      const cle = String(r.order_id);
      const liste = par.get(cle) ?? [];
      liste.push({
        id: Number(r.id),
        orderId: cle,
        note: (r.note as string) ?? null,
        photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
        demandeeLe: String(r.demandee_le),
      });
      par.set(cle, liste);
    }
    return par;
  } catch (erreur) {
    console.error("[retouches] lecture globale impossible:", erreur);
    return new Map();
  }
}
