import { sql } from "./db";

/**
 * Journal des taches automatiques : qui a tourne, quand, et avec quel resultat.
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────────
 *
 * Le dispositif compte cinq workflows GitHub et trois crons Vercel. Aucun ne
 * laissait de trace. La consequence s'est vue en septembre 2026 : les credits
 * OpenAI et le quota SerpAPI se sont epuises, le redacteur de fiches s'est
 * arrete a 139 pages sur 350, le moteur de blog a cesse de generer — et les
 * workflows ont continue d'afficher une coche verte cinq fois par jour pendant
 * une semaine. Personne ne pouvait le voir, parce qu'il n'y avait rien a voir.
 *
 * Une tache qui echoue bruyamment est un incident. Une tache qui ne produit
 * rien en signalant un succes est un mensonge, et c'est plus cher : on croit
 * le probleme ailleurs.
 *
 * ── Ce qui est garde ─────────────────────────────────────────────────────
 *
 * Le nom, les deux bornes de temps, l'issue, et un resume libre — typiquement
 * le nombre de lignes ecrites. C'est ce dernier qui distingue « a tourne » de
 * « a servi a quelque chose » : une sonde qui rend 0 ligne trois nuits de
 * suite est en panne meme si chaque passage s'est termine sans erreur.
 *
 * ── Prefixe `ge_` ────────────────────────────────────────────────────────
 *
 * Les tables du domaine portent des noms francais (`indexation_pages`,
 * `citations_llm`). Celle-ci prend le prefixe `ge_` parce qu'elle n'appartient
 * pas au domaine : elle rejoindra le moteur portable commun aux projets. Le
 * prefixe dit ce qui demenagera.
 */

let schemaPret: Promise<void> | null = null;

async function assurerSchema(): Promise<void> {
  if (schemaPret) return schemaPret;
  schemaPret = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS ge_job_runs (
        id BIGSERIAL PRIMARY KEY,
        projet TEXT NOT NULL DEFAULT 'cartoonova',
        tache TEXT NOT NULL,
        demarre_le TIMESTAMPTZ NOT NULL,
        termine_le TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        duree_ms INTEGER,
        ok BOOLEAN NOT NULL,
        produit INTEGER,
        details JSONB,
        erreur TEXT
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS ge_job_runs_tache_demarre_idx
        ON ge_job_runs (projet, tache, demarre_le DESC)
    `;
  })().catch((e) => {
    schemaPret = null;
    throw e;
  });
  return schemaPret;
}

export interface ResumePassage {
  /** Lignes ecrites ou elements produits. `0` est une information, pas un vide. */
  produit?: number;
  [cle: string]: unknown;
}

/**
 * Enregistre un passage. Ne leve jamais.
 *
 * Le journal ne doit pas pouvoir casser ce qu'il observe : une base
 * injoignable au moment d'ecrire la ligne ferait echouer une sonde qui, elle,
 * avait reussi.
 */
export async function enregistrerPassage(
  tache: string,
  ok: boolean,
  demarreLe: Date,
  resume: ResumePassage = {},
  erreur?: string,
  projet = "cartoonova",
): Promise<void> {
  try {
    await assurerSchema();
    const { produit, ...details } = resume;
    await sql`
      INSERT INTO ge_job_runs (projet, tache, demarre_le, termine_le, duree_ms, ok, produit, details, erreur)
      VALUES (
        ${projet}, ${tache}, ${demarreLe.toISOString()}, NOW(),
        ${Date.now() - demarreLe.getTime()}, ${ok},
        ${produit ?? null},
        ${Object.keys(details).length ? JSON.stringify(details) : null}::text::jsonb,
        ${erreur ?? null}
      )
    `;
  } catch (e) {
    console.error(`[journal] passage non enregistre pour ${tache}:`, e);
  }
}

/**
 * Enveloppe une tache pour qu'elle laisse une trace, qu'elle reussisse ou non.
 *
 * L'echec est reenvoye apres avoir ete note : le journal observe, il n'avale
 * pas. Un workflow qui echoue doit continuer de le montrer dans GitHub.
 */
export async function avecJournal<T extends ResumePassage | void>(
  tache: string,
  executer: () => Promise<T>,
  projet = "cartoonova",
): Promise<T> {
  const demarreLe = new Date();
  try {
    const resultat = await executer();
    await enregistrerPassage(tache, true, demarreLe, resultat ?? {}, undefined, projet);
    return resultat;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await enregistrerPassage(tache, false, demarreLe, {}, message, projet);
    throw e;
  }
}

export interface DernierPassage {
  tache: string;
  demarre_le: string;
  ok: boolean;
  produit: number | null;
  erreur: string | null;
}

/** Dernier passage connu de chaque tache, tous projets confondus ou pour un seul. */
export async function derniersPassages(projet = "cartoonova"): Promise<DernierPassage[]> {
  await assurerSchema();
  const rows = await sql`
    SELECT DISTINCT ON (tache) tache, demarre_le, ok, produit, erreur
    FROM ge_job_runs
    WHERE projet = ${projet}
    ORDER BY tache, demarre_le DESC
  `;
  return rows as unknown as DernierPassage[];
}

/**
 * Les N derniers passages d'une tache, du plus recent au plus ancien.
 *
 * Sert a repondre a « produit-elle encore quelque chose ? », qui ne se lit pas
 * sur un seul passage.
 */
export async function passagesRecents(
  tache: string,
  limite = 5,
  projet = "cartoonova",
): Promise<DernierPassage[]> {
  await assurerSchema();
  const rows = await sql`
    SELECT tache, demarre_le, ok, produit, erreur
    FROM ge_job_runs
    WHERE projet = ${projet} AND tache = ${tache}
    ORDER BY demarre_le DESC
    LIMIT ${limite}
  `;
  return rows as unknown as DernierPassage[];
}
