/**
 * Journal des taches, pour les scripts en JavaScript simple.
 *
 * Jumeau de `lib/journalTaches.ts`, qui est la version de reference et porte
 * l'explication complete. Celle-ci existe parce que les scripts `.mjs` sont
 * lances par `node` avec la seule dependance `postgres` :
 * importer un module TypeScript depuis `lib/` demanderait le crochet de
 * resolution et un `npm install` complet dans le workflow, soit plus de
 * changement que de valeur. Les deux disparaitront ensemble quand les sondes
 * rejoindront le moteur portable.
 *
 * La connexion est passee en argument plutot qu'ouverte ici : les scripts
 * `.mjs` ouvrent la leur paresseusement pour que l'absence de `DATABASE_URL`
 * donne un message qui la nomme.
 */

/** Ne leve jamais : le journal observe, il ne casse pas ce qu'il observe. */
export async function enregistrerPassage(sql, tache, ok, demarreLe, resume = {}, erreur) {
  try {
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
    const { produit, ...details } = resume;
    await sql`
      INSERT INTO ge_job_runs (projet, tache, demarre_le, termine_le, duree_ms, ok, produit, details, erreur)
      VALUES (
        'cartoonova', ${tache}, ${demarreLe.toISOString()}, NOW(),
        ${Date.now() - demarreLe.getTime()}, ${ok},
        ${produit ?? null},
        ${Object.keys(details).length ? JSON.stringify(details) : null},
        ${erreur ?? null}
      )
    `;
  } catch (e) {
    console.error(`[journal] passage non enregistre pour ${tache}:`, e);
  }
}

/** Enveloppe une tache. L'echec est note puis reenvoye. */
export async function avecJournal(sql, tache, executer) {
  const demarreLe = new Date();
  try {
    const resultat = await executer();
    await enregistrerPassage(sql, tache, true, demarreLe, resultat ?? {});
    return resultat;
  } catch (e) {
    await enregistrerPassage(sql, tache, false, demarreLe, {}, e instanceof Error ? e.message : String(e));
    throw e;
  }
}
