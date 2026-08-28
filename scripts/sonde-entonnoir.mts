/**
 * Releve chaque semaine ou les visiteurs s'arretent.
 *
 *   npx tsx scripts/sonde-entonnoir.mts
 *
 * ── Pourquoi maintenant, alors qu'il n'y a personne ──────────────────────
 *
 * Depuis mai : trois commandes creees, aucune payee. A cinquante-trois
 * visiteurs par mois, doubler la conversion rapporte une vente de plus — donc
 * aucun changement de tunnel n'est mesurable aujourd'hui, et la levee de la
 * barriere photo ne peut rien prouver.
 *
 * C'est precisement pour ca qu'il faut poser la mesure maintenant. Le jour ou
 * le trafic arrive, on saura des la premiere semaine ou il meurt. Poser la
 * sonde apres coup, c'est perdre les premieres semaines — les seules ou une
 * correction change encore la trajectoire.
 *
 * ── Ce qu'elle sait, et ce qu'elle ignore ────────────────────────────────
 *
 * Deux sources font autorite, et aucune ne ment :
 *
 *   Search Console  impressions, puis clics  — la demande, puis les arrivees
 *   la base          commandes creees, puis payees — l'intention, puis l'acte
 *
 * Entre le clic et la commande creee, il manque deux marches : la fiche vue et
 * le configurateur rempli. Elles ne vivent que dans le navigateur, et rien ne
 * les enregistre cote serveur. La sonde ne les invente pas. Elle mesure les
 * quatre qu'elle peut prouver et laisse le trou visible, plutot que de donner
 * un taux de conversion faux avec deux decimales.
 *
 * ── Ce qu'elle envoie ────────────────────────────────────────────────────
 *
 * Un point hebdomadaire, et une alerte quand une marche s'effondre d'une
 * semaine sur l'autre. Une alerte qui se declenche pour rien cesse d'etre lue :
 * en dessous d'un seuil de volume, on se tait.
 */

import { sql } from "../lib/db";
import { jetonGoogle, lireCompteDeService } from "../lib/googleAuth";

const SITE = process.env.GSC_SITE_URL || "";
const DISCORD = process.env.DISCORD_WEBHOOK_URL || "";
const PORTEE = "https://www.googleapis.com/auth/webmasters";

/**
 * En dessous, une chute n'est que du bruit. Passer de 4 clics a 1 n'a aucune
 * signification, et une alerte a chaque fois rendrait toutes les suivantes
 * invisibles.
 */
const VOLUME_MIN = Number(process.env.ENTONNOIR_VOLUME_MIN || 30);
/** Chute relative au-dela de laquelle on parle. */
const CHUTE = Number(process.env.ENTONNOIR_CHUTE || 0.4);

/* ═══ schema ════════════════════════════════════════════════════════════ */

async function assurerSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS entonnoir_semaines (
      /* Lundi de la semaine mesuree. */
      semaine      DATE PRIMARY KEY,
      impressions  INTEGER NOT NULL DEFAULT 0,
      clics        INTEGER NOT NULL DEFAULT 0,
      commandes    INTEGER NOT NULL DEFAULT 0,
      payees       INTEGER NOT NULL DEFAULT 0,
      releve_le    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

/* ═══ Search Console ════════════════════════════════════════════════════ */

/**
 * Impressions et clics sur une periode.
 *
 * Ne leve pas : la moitie base de l'entonnoir vaut d'etre enregistree meme si
 * Search Console est indisponible. Un zero franc vaudrait mensonge, donc on
 * renvoie null et l'appelant garde la valeur precedente.
 */
async function rechercheGoogle(debut: string, fin: string) {
  if (!SITE || !lireCompteDeService()) return null;
  try {
    const jeton = await jetonGoogle(PORTEE);
    const r = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: debut, endDate: fin, dimensions: [] }),
      }
    );
    if (!r.ok) {
      console.error(`  ! Search Console (${r.status})`);
      return null;
    }
    const ligne = ((await r.json()).rows ?? [])[0];
    return {
      impressions: Math.round(ligne?.impressions ?? 0),
      clics: Math.round(ligne?.clicks ?? 0),
    };
  } catch (e) {
    console.error(`  ! Search Console injoignable — ${(e as Error).message}`);
    return null;
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

const jour = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[entonnoir] DATABASE_URL manquante.");
    process.exit(1);
  }
  await assurerSchema();

  /* Search Console accuse trois jours de retard. On mesure donc la semaine
     complete qui precede cette fenetre, jamais la semaine en cours — sinon
     chaque releve comparerait une semaine pleine a une semaine entamee. */
  const fin = new Date(Date.now() - 3 * 864e5);
  const finSemaine = new Date(fin);
  finSemaine.setUTCDate(finSemaine.getUTCDate() - ((finSemaine.getUTCDay() + 6) % 7) - 1);
  const debutSemaine = new Date(finSemaine);
  debutSemaine.setUTCDate(debutSemaine.getUTCDate() - 6);

  const d = jour(debutSemaine);
  const f = jour(finSemaine);
  console.log(`[entonnoir] semaine du ${d} au ${f}`);

  const recherche = await rechercheGoogle(d, f);

  const commandes = (await sql`
    SELECT count(*)::int AS creees,
           count(*) FILTER (WHERE status = 'PAID')::int AS payees
    FROM orders
    WHERE created_at >= ${d}::date AND created_at < (${f}::date + 1)
  `) as unknown as { creees: number; payees: number }[];
  const c = commandes[0] ?? { creees: 0, payees: 0 };

  const ligne = {
    impressions: recherche?.impressions ?? 0,
    clics: recherche?.clics ?? 0,
    commandes: c.creees,
    payees: c.payees,
  };

  await sql`
    INSERT INTO entonnoir_semaines (semaine, impressions, clics, commandes, payees, releve_le)
    VALUES (${d}::date, ${ligne.impressions}, ${ligne.clics}, ${ligne.commandes}, ${ligne.payees}, NOW())
    ON CONFLICT (semaine) DO UPDATE SET
      impressions = EXCLUDED.impressions, clics = EXCLUDED.clics,
      commandes = EXCLUDED.commandes, payees = EXCLUDED.payees, releve_le = NOW()
  `;

  const taux = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)} %` : "—");
  console.log(`  impressions      ${ligne.impressions}`);
  console.log(`  clics            ${ligne.clics}   (${taux(ligne.clics, ligne.impressions)} des impressions)`);
  console.log(`  commandes créées ${ligne.commandes}   (${taux(ligne.commandes, ligne.clics)} des clics)`);
  console.log(`  payées           ${ligne.payees}   (${taux(ligne.payees, ligne.commandes)} des commandes)`);
  console.log("  · la fiche vue et le configurateur rempli ne sont pas mesurés côté serveur");

  /* ── comparaison avec la semaine precedente ── */
  const avant = (await sql`
    SELECT impressions, clics, commandes, payees FROM entonnoir_semaines
    WHERE semaine < ${d}::date ORDER BY semaine DESC LIMIT 1
  `) as unknown as typeof ligne[];
  const veille = avant[0];

  const chutes: string[] = [];
  if (veille) {
    const marches: [string, number, number][] = [
      ["impressions", ligne.impressions, veille.impressions],
      ["clics", ligne.clics, veille.clics],
      ["commandes", ligne.commandes, veille.commandes],
      ["paiements", ligne.payees, veille.payees],
    ];
    for (const [nom, maintenant, precedent] of marches) {
      // Le seuil de volume porte sur la semaine PRECEDENTE : c'est elle qui
      // dit si la marche avait assez de matiere pour qu'une chute veuille dire
      // quelque chose.
      if (precedent < VOLUME_MIN) continue;
      const perte = (precedent - maintenant) / precedent;
      if (perte >= CHUTE) {
        chutes.push(`**${nom}** : ${precedent} → ${maintenant} (−${Math.round(perte * 100)} %)`);
      }
    }
  }

  if (chutes.length) {
    await versDiscord(
      "⚠️ Entonnoir — une marche s'effondre",
      `Semaine du ${d} :\n${chutes.map((c) => `• ${c}`).join("\n")}`,
      0xd94f4f
    );
  } else {
    await versDiscord(
      "Entonnoir de la semaine",
      `${ligne.impressions} impressions → ${ligne.clics} clics → ` +
        `${ligne.commandes} commande(s) → **${ligne.payees} payée(s)**\n` +
        `_Semaine du ${d} au ${f}._`,
      ligne.payees > 0 ? 0x4f9d69 : 0xe9ba3b
    );
  }
}

await main();
