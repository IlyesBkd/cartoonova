import { sql } from "./db";

/**
 * Petit magasin cle/valeur pour l'etat des taches SEO recurrentes.
 *
 * Il en faut un : sans memoire d'une execution a l'autre, la route cron
 * resignalerait chaque jour les memes URL a IndexNow, ce qui consomme le quota
 * sans rien apprendre aux moteurs. Une table plutot qu'un fichier, parce que le
 * systeme de fichiers d'une fonction serverless ne survit pas a l'appel.
 */

let schemaPret: Promise<void> | null = null;

async function assurerSchema(): Promise<void> {
  if (schemaPret) return schemaPret;
  schemaPret = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS seo_state (
        cle TEXT PRIMARY KEY,
        valeur JSONB NOT NULL,
        modifie_le TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  })().catch((e) => {
    schemaPret = null;
    throw e;
  });
  return schemaPret;
}

export async function lireEtat<T>(cle: string): Promise<T | null> {
  await assurerSchema();
  const rows = await sql`SELECT valeur FROM seo_state WHERE cle = ${cle} LIMIT 1`;
  const row = (rows as { valeur: T }[])[0];
  return row ? row.valeur : null;
}

export async function ecrireEtat<T>(cle: string, valeur: T): Promise<void> {
  await assurerSchema();
  await sql`
    INSERT INTO seo_state (cle, valeur, modifie_le)
    VALUES (${cle}, ${JSON.stringify(valeur)}, NOW())
    ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, modifie_le = NOW()
  `;
}
