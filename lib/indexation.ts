import { sql } from "./db";

/**
 * Ce que Google dit de chaque page, et ce qu'on en fait.
 *
 * ── Pourquoi cette table ne sert pas qu'a regarder ───────────────────────
 *
 * La sonde d'indexation ecrit ici chaque nuit le verdict de Search Console
 * pour une soixantaine d'adresses. C'etait au depart une mesure : savoir
 * combien de pages sont dans l'index, et pourquoi les autres n'y sont pas.
 *
 * Mais un verdict est aussi une instruction. Quand Google repond « exploree,
 * actuellement non indexee », il dit qu'il a lu la page et ne l'a pas jugee
 * digne d'etre gardee — presque toujours parce qu'elle ressemble trop a une
 * autre. C'est exactement la liste des fiches que le generateur devrait
 * traiter en premier, et il l'ignorait : il parcourait le catalogue dans
 * l'ordre ou il est ecrit.
 *
 * Les deux bouts existaient sans se parler. Ce module les relie.
 */

/** Verdicts renvoyes par l'API d'inspection, stables quelle que soit la langue. */
export type Verdict = "PASS" | "NEUTRAL" | "FAIL" | "INCONNU";

export interface ReleveIndexation {
  url: string;
  locale: string;
  produit: string | null;
  verdict: string;
  motif: string;
  exploreeLe: string | null;
}

let schemaPret: Promise<void> | null = null;

export async function assurerSchemaIndexation(): Promise<void> {
  if (schemaPret) return schemaPret;
  schemaPret = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS indexation_pages (
        url          TEXT PRIMARY KEY,
        locale       TEXT,
        produit      TEXT,
        /* PASS / NEUTRAL / FAIL, stable quelle que soit la langue demandee. */
        verdict      TEXT,
        /* Le motif tel que Google le formule : c'est lui qui distingue une
           page trop pauvre d'une page bloquee, et les deux ne se corrigent
           pas de la meme facon. */
        motif        TEXT,
        exploree_le  TIMESTAMPTZ,
        releve_le    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS indexation_jours (
        jour       DATE PRIMARY KEY,
        indexees   INTEGER NOT NULL,
        connues    INTEGER NOT NULL,
        bloquees   INTEGER NOT NULL,
        releve_le  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  })().catch((e) => {
    schemaPret = null;
    throw e;
  });
  return schemaPret;
}

export async function enregistrerReleve(r: ReleveIndexation): Promise<void> {
  await assurerSchemaIndexation();
  await sql`
    INSERT INTO indexation_pages (url, locale, produit, verdict, motif, exploree_le, releve_le)
    VALUES (${r.url}, ${r.locale}, ${r.produit}, ${r.verdict}, ${r.motif}, ${r.exploreeLe}, NOW())
    ON CONFLICT (url) DO UPDATE SET
      locale = EXCLUDED.locale, produit = EXCLUDED.produit,
      verdict = EXCLUDED.verdict, motif = EXCLUDED.motif,
      exploree_le = EXCLUDED.exploree_le, releve_le = NOW()
  `;
}

/** Verdicts deja connus, pour reperer une sortie d'index d'un passage a l'autre. */
export async function verdictsConnus(): Promise<Map<string, string>> {
  await assurerSchemaIndexation();
  const rows = (await sql`SELECT url, verdict FROM indexation_pages`) as unknown as {
    url: string;
    verdict: string;
  }[];
  return new Map(rows.map((r) => [r.url, r.verdict]));
}

/** Date du dernier releve par adresse, pour choisir le lot le plus ancien. */
export async function dernierReleveParUrl(): Promise<Map<string, number>> {
  await assurerSchemaIndexation();
  const rows = (await sql`SELECT url, releve_le FROM indexation_pages`) as unknown as {
    url: string;
    releve_le: string;
  }[];
  return new Map(rows.map((r) => [r.url, new Date(r.releve_le).getTime()]));
}

export interface TotalIndexation {
  indexees: number;
  connues: number;
  bloquees: number;
}

export async function totalIndexation(): Promise<TotalIndexation> {
  await assurerSchemaIndexation();
  const rows = (await sql`
    SELECT
      count(*) FILTER (WHERE verdict = 'PASS')::int    AS indexees,
      count(*) FILTER (WHERE verdict = 'NEUTRAL')::int AS connues,
      count(*) FILTER (WHERE verdict = 'FAIL')::int    AS bloquees
    FROM indexation_pages
  `) as unknown as TotalIndexation[];
  return rows[0] ?? { indexees: 0, connues: 0, bloquees: 0 };
}

export async function enregistrerJour(t: TotalIndexation): Promise<number | null> {
  await assurerSchemaIndexation();
  const veille = (await sql`
    SELECT indexees FROM indexation_jours
    WHERE jour < CURRENT_DATE ORDER BY jour DESC LIMIT 1
  `) as unknown as { indexees: number }[];

  await sql`
    INSERT INTO indexation_jours (jour, indexees, connues, bloquees, releve_le)
    VALUES (CURRENT_DATE, ${t.indexees}, ${t.connues}, ${t.bloquees}, NOW())
    ON CONFLICT (jour) DO UPDATE SET
      indexees = EXCLUDED.indexees, connues = EXCLUDED.connues,
      bloquees = EXCLUDED.bloquees, releve_le = NOW()
  `;
  return veille[0] ? t.indexees - veille[0].indexees : null;
}

/* ═══ le verdict comme instruction ══════════════════════════════════════ */

/**
 * Motifs qui designent une page a reecrire, par ordre d'urgence.
 *
 * Les deux premiers disent la meme chose de deux facons : Google a lu la page
 * et l'a jugee redondante. Ce sont ceux que du texte propre corrige.
 *
 * « Detectee, actuellement non indexee » et « Google ne reconnait pas cette
 * URL » relevent d'un autre probleme — la page n'a pas ete lue, faute d'etre
 * assez liee. Du contenu n'y changera rien tant qu'elle n'est pas atteignable ;
 * c'est le maillage interne qui s'en charge. On les garde en fin de liste,
 * apres celles que la redaction peut reellement debloquer.
 */
const URGENCE = [
  "Autre page avec balise canonique correcte",
  "Explorée, actuellement non indexée",
  "Détectée, actuellement non indexée",
  "Google ne reconnaît pas cette URL",
];

/**
 * Fiches que Google a recalees dans cette langue, les plus urgentes d'abord.
 *
 * Ne leve jamais : la sonde n'a peut-etre jamais tourne, et le generateur doit
 * alors se rabattre sur l'ordre du catalogue plutot que de s'arreter.
 */
export async function produitsRecales(locale: string): Promise<string[]> {
  try {
    await assurerSchemaIndexation();
    const rows = (await sql`
      SELECT produit, motif FROM indexation_pages
      WHERE locale = ${locale} AND produit IS NOT NULL AND verdict <> 'PASS'
    `) as unknown as { produit: string; motif: string }[];

    return rows
      .sort((a, b) => {
        const ia = URGENCE.indexOf(a.motif);
        const ib = URGENCE.indexOf(b.motif);
        // Un motif inconnu passe apres ceux qu'on sait interpreter.
        return (ia < 0 ? URGENCE.length : ia) - (ib < 0 ? URGENCE.length : ib);
      })
      .map((r) => r.produit);
  } catch (erreur) {
    console.error("[indexation] verdicts illisibles:", erreur);
    return [];
  }
}

/**
 * Produits que Google n'a jamais lus, toutes langues confondues.
 *
 * Ceux-la ne manquent pas de texte, ils manquent de liens : personne n'y
 * conduit. C'est ce que le maillage interne va corriger, en les faisant
 * remonter dans les blocs de liens plutot que de tourner sur les memes fiches.
 */
export async function produitsJamaisLus(locale: string): Promise<string[]> {
  try {
    await assurerSchemaIndexation();
    const rows = (await sql`
      SELECT DISTINCT produit FROM indexation_pages
      WHERE locale = ${locale} AND produit IS NOT NULL
        AND motif IN ('Détectée, actuellement non indexée', 'Google ne reconnaît pas cette URL')
    `) as unknown as { produit: string }[];
    return rows.map((r) => r.produit);
  } catch {
    return [];
  }
}
