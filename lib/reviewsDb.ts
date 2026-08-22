import { sql } from "./db";

/**
 * Avis clients.
 *
 * Les temoignages affiches jusqu'ici vivaient dans `messages/*.json` : chaque
 * avis recu demandait une edition de code et un deploiement, et rien ne les
 * rattachait a une commande. C'est aussi pour cela que la page `/avis`
 * n'emettait volontairement aucun balisage `Review` — baliser des temoignages
 * invérifiables expose a une action manuelle de Google.
 *
 * Un avis passe ici par un lien signe envoye au client dix jours apres la
 * livraison. Le jeton porte l'identifiant de commande : sa validite prouve
 * l'achat, et c'est ce qui autorise la publication sans relecture.
 */

export type StatutAvis = "publie" | "en_attente" | "rejete";

export interface Avis {
  id: number;
  orderId: string | null;
  auteur: string;
  locale: string;
  note: number;
  texte: string;
  /** Rattache a une commande reelle via un lien signe. */
  verifie: boolean;
  statut: StatutAvis;
  creeLe: string;
}

let schemaPret: Promise<void> | null = null;

async function assurerSchema(): Promise<void> {
  if (schemaPret) return schemaPret;
  schemaPret = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        order_id TEXT,
        auteur TEXT NOT NULL,
        locale TEXT NOT NULL,
        note INTEGER NOT NULL CHECK (note BETWEEN 1 AND 5),
        texte TEXT NOT NULL,
        verifie BOOLEAN NOT NULL DEFAULT FALSE,
        statut TEXT NOT NULL DEFAULT 'en_attente',
        cree_le TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        modere_le TIMESTAMPTZ
      )
    `;
    /* Une commande ne donne qu'un avis : le lien reste valable indefiniment,
       rien n'empecherait sinon de le rejouer. */
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS reviews_order_unique ON reviews (order_id) WHERE order_id IS NOT NULL`;
    await sql`CREATE INDEX IF NOT EXISTS reviews_statut_idx ON reviews (statut, cree_le DESC)`;
  })().catch((e) => {
    schemaPret = null;
    throw e;
  });
  return schemaPret;
}

function versAvis(row: Record<string, unknown>): Avis {
  return {
    id: row.id as number,
    orderId: (row.order_id as string) ?? null,
    auteur: row.auteur as string,
    locale: row.locale as string,
    note: Number(row.note),
    texte: row.texte as string,
    verifie: Boolean(row.verifie),
    statut: row.statut as StatutAvis,
    creeLe: new Date(row.cree_le as string).toISOString(),
  };
}

export interface DepotAvis {
  orderId: string | null;
  auteur: string;
  locale: string;
  note: number;
  texte: string;
  verifie: boolean;
}

/**
 * Enregistre un avis.
 *
 * Un avis verifie est publie tel quel, quelle que soit la note. Ne publier
 * automatiquement que les bonnes notes et retenir les autres en moderation
 * produirait une moyenne fausse — c'est exactement ce que Google qualifie de
 * manipulation d'avis. Les notes basses declenchent une alerte (voir la route),
 * pas une retenue.
 *
 * Un avis non verifie reste en attente : sans jeton, rien ne distingue un
 * client d'un robot.
 */
export async function deposerAvis(depot: DepotAvis): Promise<{ id: number; statut: StatutAvis } | null> {
  await assurerSchema();
  const statut: StatutAvis = depot.verifie ? "publie" : "en_attente";

  const rows = await sql`
    INSERT INTO reviews (order_id, auteur, locale, note, texte, verifie, statut, modere_le)
    VALUES (
      ${depot.orderId},
      ${depot.auteur},
      ${depot.locale},
      ${depot.note},
      ${depot.texte},
      ${depot.verifie},
      ${statut},
      ${depot.verifie ? new Date().toISOString() : null}
    )
    ON CONFLICT DO NOTHING
    RETURNING id, statut
  `;

  const row = (rows as { id: number; statut: StatutAvis }[])[0];
  return row ? { id: row.id, statut: row.statut } : null;
}

/** Un client ne doit pas pouvoir deposer deux fois depuis le meme lien. */
export async function avisExistePourCommande(orderId: string): Promise<boolean> {
  await assurerSchema();
  const rows = await sql`SELECT 1 FROM reviews WHERE order_id = ${orderId} LIMIT 1`;
  return rows.length > 0;
}

export async function avisPublies(limite = 60): Promise<Avis[]> {
  await assurerSchema();
  const rows = await sql`
    SELECT * FROM reviews WHERE statut = 'publie' ORDER BY cree_le DESC LIMIT ${limite}
  `;
  return (rows as Record<string, unknown>[]).map(versAvis);
}

export interface StatistiquesAvis {
  nombre: number;
  moyenne: number;
}

/**
 * Moyenne calculee sur l'ensemble des avis publies, sans filtre de note :
 * c'est la seule facon d'annoncer un `aggregateRating` exact.
 */
export async function statistiquesAvis(): Promise<StatistiquesAvis> {
  await assurerSchema();
  const rows = await sql`
    SELECT COUNT(*)::int AS nombre, COALESCE(AVG(note), 0)::float AS moyenne
    FROM reviews WHERE statut = 'publie'
  `;
  const row = (rows as { nombre: number; moyenne: number }[])[0];
  return {
    nombre: Number(row?.nombre ?? 0),
    moyenne: Math.round(Number(row?.moyenne ?? 0) * 10) / 10,
  };
}

/* ─── Moderation ─────────────────────────────────────────────────────── */

export async function tousLesAvis(): Promise<Avis[]> {
  await assurerSchema();
  const rows = await sql`SELECT * FROM reviews ORDER BY cree_le DESC LIMIT 200`;
  return (rows as Record<string, unknown>[]).map(versAvis);
}

export async function changerStatutAvis(id: number, statut: StatutAvis): Promise<void> {
  await assurerSchema();
  await sql`UPDATE reviews SET statut = ${statut}, modere_le = NOW() WHERE id = ${id}`;
}
