/**
 * Note un passage de tache dans `ge_job_runs`, depuis le lanceur du VPS.
 *
 *   node scripts/noter-passage.mjs <tache> <code-de-sortie> <debut-en-ms>
 *
 * La veille (`scripts/veille-taches.mts`) lit ce journal pour reperer les
 * taches qui ne tournent plus. Aucune tache ne l'alimentait : c'est donc
 * `vps/executer.sh` qui ecrit la ligne apres chaque etape, a partir du code de
 * sortie. On sait ainsi si une tache a tourne et si elle a reussi. On ne sait
 * pas ce qu'elle a produit (`produit` reste vide), si bien que la detection de
 * sterilite ne s'applique qu'aux taches qui se journalisent elles-memes.
 *
 * Ne fait jamais echouer l'appelant : sortie 0 meme si la base est injoignable.
 */

import postgres from "postgres";
import { enregistrerPassage } from "./journal.mjs";

const [tache, codeTexte, debutTexte] = process.argv.slice(2);
const code = Number(codeTexte);
const debut = new Date(Number(debutTexte));

if (!tache || !Number.isInteger(code) || Number.isNaN(debut.getTime())) {
  console.error("usage: node scripts/noter-passage.mjs <tache> <code> <debut-ms>");
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.error(`[journal] DATABASE_URL absente, passage de ${tache} non note`);
  process.exit(0);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
try {
  await enregistrerPassage(
    sql,
    tache,
    code === 0,
    debut,
    {},
    code === 0 ? undefined : `code de sortie ${code}`,
  );
} finally {
  await sql.end({ timeout: 5 });
}
