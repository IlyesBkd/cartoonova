/**
 * Surveille le canal Google Shopping, le seul qui n'etait pas mesure.
 *
 *   npx tsx scripts/sonde-marchand.mts
 *
 * ── Pourquoi il fallait la poser ─────────────────────────────────────────
 *
 * Le compte marchand porte 385 fiches, toutes eligibles, aucune refusee. Et
 * personne ne regarde. Si Google en refusait trois cents demain matin — un
 * changement de politique, un prix qui diverge de la page, un visuel casse —
 * le canal s'eteindrait sans que rien ne le signale.
 *
 * La vigie du cron SEO verifie deja qu'il n'y a pas d'anomalie, mais elle ne
 * garde aucune trace : elle dit « tout va bien » ou « attention », jamais
 * « c'etait 385 hier et 84 aujourd'hui ». Sans serie, pas de tendance, et une
 * degradation lente ressemble a la normale.
 *
 * ── Ce qu'elle releve ────────────────────────────────────────────────────
 *
 * Le nombre de fiches diffusees, la part refusee, les problemes de compte, et
 * la performance des annonces gratuites : impressions et clics.
 *
 * Cette derniere est aujourd'hui a zero, sur quatre-vingt-dix jours et trois
 * cent quatre-vingt-cinq produits conformes. Ce n'est pas une panne, c'est un
 * classement : les annonces gratuites se classent, comme le reste, et un
 * marchand sans notoriete ne sort pas. La sonde est la pour dire le jour ou
 * ca change — et ce jour-la, ce sera la premiere bonne nouvelle mesurable du
 * canal.
 *
 * ── Ce qu'elle envoie ────────────────────────────────────────────────────
 *
 * Une alerte quand un probleme de compte apparait, quand la part refusee
 * grimpe, ou quand le catalogue diffuse s'effondre. Et un point le jour ou les
 * premieres impressions arrivent. Le reste dort en base.
 */

import { sql } from "../lib/db";
import { etatMerchant, anomaliesMerchant, compteMerchant } from "../lib/merchant";
import { jetonGoogle } from "../lib/googleAuth";

const DISCORD = process.env.DISCORD_WEBHOOK_URL || "";
const PORTEE = "https://www.googleapis.com/auth/content";
const RACINE = "https://merchantapi.googleapis.com";

/** Chute du catalogue diffuse au-dela de laquelle on alerte. */
const CHUTE_ALERTE = 0.2;
/** Part refusee au-dela de laquelle on alerte. */
const REFUS_ALERTE = 0.1;

/* ═══ schema ════════════════════════════════════════════════════════════ */

async function assurerSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS marchand_jours (
      jour         DATE PRIMARY KEY,
      produits     INTEGER NOT NULL,
      part_refusee REAL    NOT NULL,
      impressions  INTEGER NOT NULL DEFAULT 0,
      clics        INTEGER NOT NULL DEFAULT 0,
      /* Problemes de compte et de fiches, tels que Google les libelle. */
      problemes    JSONB   NOT NULL DEFAULT '[]',
      releve_le    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

/* ═══ performance des annonces gratuites ════════════════════════════════ */

interface Performance {
  impressions: number;
  clics: number;
}

/**
 * Impressions et clics sur trente jours.
 *
 * Ne leve pas : la performance est un supplement. Si le rapport est
 * indisponible, l'etat du catalogue merite quand meme d'etre enregistre.
 */
async function performance(compte: string, jours = 30): Promise<Performance> {
  const fin = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const debut = new Date(Date.now() - (jours + 3) * 864e5).toISOString().slice(0, 10);

  try {
    const jeton = await jetonGoogle(PORTEE);
    const r = await fetch(`${RACINE}/reports/v1/accounts/${compte}/reports:search`, {
      method: "POST",
      headers: { authorization: `Bearer ${jeton}`, "content-type": "application/json" },
      body: JSON.stringify({
        query:
          `SELECT date, marketing_method, clicks, impressions ` +
          `FROM product_performance_view WHERE date BETWEEN '${debut}' AND '${fin}'`,
      }),
    });
    if (!r.ok) {
      console.error(`  ! rapport refuse (${r.status})`);
      return { impressions: 0, clics: 0 };
    }
    const lignes = ((await r.json()).results ?? []) as {
      productPerformanceView?: { impressions?: string; clicks?: string };
    }[];
    let impressions = 0;
    let clics = 0;
    for (const l of lignes) {
      impressions += Number(l.productPerformanceView?.impressions ?? 0);
      clics += Number(l.productPerformanceView?.clicks ?? 0);
    }
    return { impressions, clics };
  } catch (e) {
    console.error(`  ! rapport injoignable — ${(e as Error).message}`);
    return { impressions: 0, clics: 0 };
  }
}

/* ═══ Discord ═══════════════════════════════════════════════════════════ */

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

/* ═══ passage ═══════════════════════════════════════════════════════════ */

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[marchand] DATABASE_URL manquante.");
    process.exit(1);
  }
  const compte = compteMerchant();
  if (!compte) {
    console.error("[marchand] MERCHANT_ACCOUNT_ID ou compte de service manquant.");
    process.exit(1);
  }

  await assurerSchema();

  const etat = await etatMerchant();
  const perf = await performance(compte);

  const langues = Object.entries(etat.parLangue)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([l, n]) => `${l} ${n}`)
    .join(" · ");

  console.log(`[marchand] compte ${compte}`);
  console.log(`  ${etat.produits} fiche(s) diffusees — ${langues}`);
  console.log(`  part refusee : ${(etat.partRefusee * 100).toFixed(1)} %`);
  console.log(`  annonces gratuites sur 30 j : ${perf.impressions} impressions, ${perf.clics} clics`);
  for (const p of etat.problemesCompte) console.log(`  ! compte : [${p.gravite}] ${p.titre}`);
  for (const p of etat.problemesProduit) console.log(`  · fiches : ${p.libelle} × ${p.nombre}`);

  /* ── la veille, pour comparer ── */
  const veille = (await sql`
    SELECT produits, part_refusee, impressions FROM marchand_jours
    WHERE jour < CURRENT_DATE ORDER BY jour DESC LIMIT 1
  `) as unknown as { produits: number; part_refusee: number; impressions: number }[];
  const hier = veille[0];

  const problemes = [
    ...etat.problemesCompte.map((p) => `[${p.gravite}] ${p.titre}`),
    ...etat.problemesProduit.map((p) => `${p.libelle} × ${p.nombre}`),
  ];

  await sql`
    INSERT INTO marchand_jours (jour, produits, part_refusee, impressions, clics, problemes, releve_le)
    VALUES (CURRENT_DATE, ${etat.produits}, ${etat.partRefusee},
            ${perf.impressions}, ${perf.clics}, ${JSON.stringify(problemes)}::jsonb, NOW())
    ON CONFLICT (jour) DO UPDATE SET
      produits = EXCLUDED.produits, part_refusee = EXCLUDED.part_refusee,
      impressions = EXCLUDED.impressions, clics = EXCLUDED.clics,
      problemes = EXCLUDED.problemes, releve_le = NOW()
  `;

  /* ── ce qui merite d'interrompre quelqu'un ── */
  const alertes = anomaliesMerchant(etat);

  if (hier && hier.produits > 0) {
    const chute = (hier.produits - etat.produits) / hier.produits;
    if (chute >= CHUTE_ALERTE) {
      alertes.push(
        `catalogue diffuse en chute : ${hier.produits} hier, ${etat.produits} aujourd'hui`
      );
    }
  }
  if (etat.partRefusee >= REFUS_ALERTE) {
    alertes.push(`${(etat.partRefusee * 100).toFixed(0)} % des fiches refusees`);
  }

  if (alertes.length) {
    await versDiscord(
      "⚠️ Google Shopping",
      alertes.map((a) => `• ${a}`).join("\n"),
      0xd94f4f
    );
  } else if (perf.impressions > 0 && (!hier || hier.impressions === 0)) {
    /* Le canal n'avait jamais rien produit. Ce jour-la merite d'etre dit. */
    await versDiscord(
      "Google Shopping — premières impressions",
      `**${perf.impressions}** impressions et ${perf.clics} clic(s) sur 30 jours.\n` +
        `${etat.produits} fiches diffusées.`,
      0x4f9d69
    );
  }
}

await main();
