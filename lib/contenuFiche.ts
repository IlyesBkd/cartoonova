import { sql } from "./db";

/**
 * Contenu long propre a chaque fiche produit.
 *
 * ── Pourquoi cette table existe ──────────────────────────────────────────
 *
 * Les 36 fiches partagent 6 163 caracteres de gabarit identique — FAQ,
 * etapes, comparatif, blocs de reassurance — pour 140 caracteres propres :
 * un titre et une description. **2 % de texte unique.**
 *
 * Google en a indexe trois sur trente-huit. Un clic organique hors marque en
 * quatre-vingt-onze jours. Zero citation sur les vingt requetes de la sonde,
 * la ou le concurrent direct apparait partout. Ce n'est pas une punition :
 * trente-six pages quasi identiques sont un doublon, et un moteur n'en garde
 * qu'une.
 *
 * Rien d'autre ne se debloque avant : un assistant ne peut pas citer une page
 * qui n'est pas dans l'index, et aucun balisage ne rattrape un contenu absent.
 *
 * ── Pourquoi en base plutot que dans le catalogue ────────────────────────
 *
 * `lib/catalogue.ts` fait deja plus de mille lignes et part au navigateur.
 * Trois cent soixante textes de cinq cents mots y seraient illisibles et
 * pesants. Meme choix que pour le blog : le moteur de contenu ecrit en base,
 * la page lit au rendu, et publier ne demande aucun deploiement.
 *
 * ── Ce que la page fait sans contenu ─────────────────────────────────────
 *
 * Elle s'affiche exactement comme avant. Le contenu est un supplement, jamais
 * une dependance : une fiche sans texte reste vendable, et le deploiement de
 * cette table ne casse rien le jour ou elle est vide — c'est-a-dire
 * aujourd'hui.
 */

export interface SectionFiche {
  /** Titre de section, rendu en h2 sur la fiche. */
  titre: string;
  /** Corps en texte brut. Un paragraphe par ligne vide. */
  corps: string;
}

export interface QuestionFiche {
  question: string;
  reponse: string;
}

export interface ContenuFiche {
  produit: string;
  locale: string;
  /** Accroche courte, sous le titre de la fiche. */
  intro: string | null;
  sections: SectionFiche[];
  /** Remplace la FAQ partagee quand elle existe. */
  faq: QuestionFiche[];
  majLe: string;
}

let schemaPret: Promise<void> | null = null;

async function assurerSchema(): Promise<void> {
  if (schemaPret) return schemaPret;
  schemaPret = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS contenus_fiche (
        produit    TEXT NOT NULL,
        locale     TEXT NOT NULL,
        intro      TEXT,
        sections   JSONB NOT NULL DEFAULT '[]',
        faq        JSONB NOT NULL DEFAULT '[]',
        /* Empreinte du texte, pour reperer deux fiches qui se ressembleraient
           trop — c'est le defaut qu'on corrige, il serait absurde de le
           reintroduire en generant trente-six variantes du meme paragraphe. */
        empreinte  TEXT,
        maj_le     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (produit, locale)
      )
    `;
  })().catch((e) => {
    schemaPret = null;
    throw e;
  });
  return schemaPret;
}

/**
 * Contenu d'une fiche, ou null s'il n'a pas encore ete redige.
 *
 * Ne leve jamais : une base injoignable doit degrader la fiche, pas
 * l'empecher de se vendre. L'appelant recoit null et sert le gabarit.
 */
export async function contenuFiche(produit: string, locale: string): Promise<ContenuFiche | null> {
  try {
    await assurerSchema();
    const rows = await sql`
      SELECT produit, locale, intro, sections, faq, maj_le
      FROM contenus_fiche
      WHERE produit = ${produit} AND locale = ${locale}
    `;
    const r = rows[0] as Record<string, unknown> | undefined;
    if (!r) return null;

    const sections = (r.sections ?? []) as SectionFiche[];
    const faq = (r.faq ?? []) as QuestionFiche[];
    // Une ligne vide vaut une absence : mieux vaut le gabarit qu'un blanc.
    if (!r.intro && !sections.length && !faq.length) return null;

    return {
      produit: String(r.produit),
      locale: String(r.locale),
      intro: (r.intro as string) || null,
      sections,
      faq,
      majLe: String(r.maj_le),
    };
  } catch (erreur) {
    console.error("[contenuFiche] lecture impossible:", produit, locale, erreur);
    return null;
  }
}

/** Ecriture, utilisee par le generateur. Remplace la ligne existante. */
export async function enregistrerContenuFiche(
  contenu: Omit<ContenuFiche, "majLe"> & { empreinte?: string }
): Promise<void> {
  await assurerSchema();
  await sql`
    INSERT INTO contenus_fiche (produit, locale, intro, sections, faq, empreinte, maj_le)
    VALUES (
      ${contenu.produit}, ${contenu.locale}, ${contenu.intro},
      ${JSON.stringify(contenu.sections)}::jsonb,
      ${JSON.stringify(contenu.faq)}::jsonb,
      ${contenu.empreinte ?? null}, NOW()
    )
    ON CONFLICT (produit, locale) DO UPDATE SET
      intro = EXCLUDED.intro, sections = EXCLUDED.sections, faq = EXCLUDED.faq,
      empreinte = EXCLUDED.empreinte, maj_le = NOW()
  `;
}

/**
 * Tous les textes deja rediges dans une langue, pour la garde anti-doublon
 * du generateur.
 *
 * Sans elle, la garde ne comparerait qu'aux fiches ecrites pendant le passage
 * courant : des le deuxieme lancement elle ne comparerait plus a rien, et on
 * reintroduirait exactement le defaut que cette table corrige.
 *
 * On ne compare qu'a la meme langue : un texte francais et sa version
 * allemande ne partagent presque aucun mot, la mesure n'y voudrait rien dire.
 */
export async function textesDeLangue(locale: string): Promise<{ produit: string; texte: string }[]> {
  await assurerSchema();
  const rows = await sql`
    SELECT produit, intro, sections, faq FROM contenus_fiche WHERE locale = ${locale}
  `;
  return (rows as unknown as Record<string, unknown>[]).map((r) => {
    const sections = (r.sections ?? []) as SectionFiche[];
    const faq = (r.faq ?? []) as QuestionFiche[];
    return {
      produit: String(r.produit),
      texte: [
        (r.intro as string) || "",
        ...sections.map((s) => `${s.titre} ${s.corps}`),
        ...faq.map((f) => `${f.question} ${f.reponse}`),
      ].join(" "),
    };
  });
}

/** Etat d'avancement, pour le generateur et le suivi. */
export async function couvertureContenus(): Promise<
  { locale: string; redigees: number }[]
> {
  await assurerSchema();
  const rows = await sql`
    SELECT locale, count(*)::int AS redigees
    FROM contenus_fiche
    WHERE intro IS NOT NULL OR jsonb_array_length(sections) > 0
    GROUP BY locale ORDER BY locale
  `;
  return rows as unknown as { locale: string; redigees: number }[];
}
