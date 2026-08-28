/**
 * Surveille la vitesse des gabarits, chaque nuit, sur la production.
 *
 *   npx tsx scripts/sonde-vitesse.mts
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────────
 *
 * `scripts/mesure-cwv.mjs` existait depuis des mois et ne tournait nulle part.
 * Une mesure qu'on lance a la main quand on y pense ne detecte rien : elle
 * confirme ce qu'on soupconnait deja. Une regression de vitesse, elle, arrive
 * sans prevenir — une image non compressee, une dependance qui grossit — et se
 * paie deux fois, au classement et a la conversion.
 *
 * ── Ce qu'elle mesure, et ce que ca vaut ─────────────────────────────────
 *
 * Cinq gabarits charges sur un profil mobile moyen (Pixel 7, processeur divise
 * par quatre, 1,6 Mbit/s), mediane de plusieurs passages. Ce ne sont pas des
 * donnees de terrain : c'est une mesure reproductible, faite dans les memes
 * conditions chaque nuit. Sa valeur est dans la comparaison, pas dans le
 * chiffre absolu.
 *
 * D'ou la mediane, et d'ou le seuil de bruit : sur un runner partage, deux
 * mesures du meme build s'ecartent facilement de dix pour cent. Alerter sur
 * cet ecart-la remplirait Discord de fausses alarmes, et la vraie regression
 * passerait avec les autres.
 */

import { sql } from "../lib/db";
import { mesurer } from "./mesure-cwv.mjs";

const BASE = (process.env.SITE_URL || "https://www.cartoonova.com").replace(/\/$/, "");
const DISCORD = process.env.DISCORD_WEBHOOK_URL || "";

/** Chargements par gabarit. Trois suffisent a une mediane stable en CI. */
const PASSAGES = Number(process.env.VITESSE_PASSAGES || 3);

/** Le seuil au-dela duquel Google considere un LCP mauvais. */
const LCP_SEUIL = 2500;

/**
 * Degradation relative a partir de laquelle on parle.
 *
 * Sous ce seuil, on regarde le bruit du runner plutot que le site. Il vaut
 * mieux rater une degradation de dix pour cent que crier chaque nuit.
 */
const DERIVE = Number(process.env.VITESSE_DERIVE || 0.25);

interface Mesure {
  nom: string;
  chemin: string;
  lcp: number;
  lcpMin: number;
  lcpMax: number;
  cls: number;
  ttfb: number;
  fcp: number;
  octets: number;
  js: number;
  cible: string;
}

async function assurerSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS vitesse_jours (
      jour      DATE NOT NULL,
      gabarit   TEXT NOT NULL,
      chemin    TEXT,
      lcp       INTEGER NOT NULL,
      cls       REAL    NOT NULL,
      ttfb      INTEGER NOT NULL,
      fcp       INTEGER NOT NULL,
      octets    INTEGER NOT NULL,
      js        INTEGER NOT NULL,
      /* L'element qui porte le LCP : sans lui, on sait qu'une page a ralenti
         mais pas ce qu'il faut regarder. */
      cible     TEXT,
      releve_le TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (jour, gabarit)
    )
  `;
}

async function versDiscord(titre: string, texte: string, couleur: number) {
  if (!DISCORD) return;
  try {
    await fetch(DISCORD, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{ title: titre, description: texte.slice(0, 3800), color: couleur }],
      }),
    });
  } catch {
    /* Un point manque ne doit pas faire echouer un releve deja ecrit. */
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[vitesse] DATABASE_URL manquante.");
    process.exit(1);
  }
  await assurerSchema();

  console.log(`[vitesse] ${BASE} · médiane de ${PASSAGES} passages`);
  const mesures = (await mesurer(BASE, PASSAGES)) as Mesure[];

  /* La veille, par gabarit, pour comparer a build egal. */
  const avant = new Map(
    ((await sql`
      SELECT DISTINCT ON (gabarit) gabarit, lcp
      FROM vitesse_jours WHERE jour < CURRENT_DATE
      ORDER BY gabarit, jour DESC
    `) as unknown as { gabarit: string; lcp: number }[]).map((r) => [r.gabarit, r.lcp])
  );

  const derives: string[] = [];
  const rouges: string[] = [];

  for (const m of mesures) {
    const lcp = Math.round(m.lcp);
    await sql`
      INSERT INTO vitesse_jours (jour, gabarit, chemin, lcp, cls, ttfb, fcp, octets, js, cible, releve_le)
      VALUES (CURRENT_DATE, ${m.nom}, ${m.chemin}, ${lcp}, ${m.cls},
              ${Math.round(m.ttfb)}, ${Math.round(m.fcp)},
              ${Math.round(m.octets)}, ${Math.round(m.js)}, ${m.cible}, NOW())
      ON CONFLICT (jour, gabarit) DO UPDATE SET
        chemin = EXCLUDED.chemin, lcp = EXCLUDED.lcp, cls = EXCLUDED.cls,
        ttfb = EXCLUDED.ttfb, fcp = EXCLUDED.fcp, octets = EXCLUDED.octets,
        js = EXCLUDED.js, cible = EXCLUDED.cible, releve_le = NOW()
    `;

    const etat = lcp <= LCP_SEUIL ? "vert" : lcp <= 4000 ? "orange" : "ROUGE";
    console.log(
      `  ${m.nom.padEnd(15)} LCP ${String(lcp).padStart(5)} ms  ${etat.padEnd(6)}` +
        `  CLS ${m.cls.toFixed(3)}  TTFB ${String(Math.round(m.ttfb)).padStart(4)}` +
        `  ${Math.round(m.octets / 1024)} ko  — ${m.cible}`
    );

    if (lcp > LCP_SEUIL) rouges.push(`**${m.nom}** : ${lcp} ms — ${m.cible}`);

    const veille = avant.get(m.nom);
    if (veille && veille > 0 && (lcp - veille) / veille >= DERIVE) {
      derives.push(`**${m.nom}** : ${veille} → ${lcp} ms (+${Math.round(((lcp - veille) / veille) * 100)} %)`);
    }
  }

  /* Une degradation soudaine se corrige ; un gabarit lent depuis toujours est
     un chantier, pas une urgence. On n'alerte donc que sur la derive, et on
     rappelle l'etat rouge seulement quand il y a deja une raison de parler. */
  if (derives.length) {
    await versDiscord(
      "⚠️ Vitesse — dégradation",
      derives.map((d) => `• ${d}`).join("\n") +
        (rouges.length ? `\n\nAu-dessus du seuil :\n${rouges.map((r) => `• ${r}`).join("\n")}` : ""),
      0xd94f4f
    );
  }

  console.log(
    `\n[vitesse] ${rouges.length}/${mesures.length} gabarit(s) au-dessus de ${LCP_SEUIL} ms` +
      (derives.length ? ` · ${derives.length} en dégradation` : "")
  );
}

await main();
