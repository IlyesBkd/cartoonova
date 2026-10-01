import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { alerteDiscord, COULEUR_ALERTE } from "@/lib/discord";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Retouches restees sans reponse.
 *
 * Le client recoit un accuse promettant une reponse sous 24 h
 * (app/api/orders/confirm-poster). L'alerte Discord de la demande, elle, se
 * noie dans le fil des notifications : une demande peut donc rester sans suite
 * sans que personne ne s'en apercoive, et c'est exactement la plainte
 * « aucune reponse » qui a motive l'accuse. Cette route rattrape ce cas.
 *
 * ── Ce qui compte comme une reponse ─────────────────────────────────────
 *
 * Tout ce qui part vers le client apres la DERNIERE demande de la commande :
 *   - un nouveau visuel a valider (`poster_confirmation_sent_at`) ;
 *   - l'illustration finale (`final_image_sent_at`) ;
 *   - un e-mail depuis l'onglet Support (`support_replies`), rattache a la
 *     commande ou adresse au client.
 * Une confirmation du client apres coup clot aussi le sujet.
 *
 * Lecture seule : la route ne marque rien. Elle se repete tant que la demande
 * n'a pas de reponse — c'est voulu, une relance qui se tait d'elle-meme
 * reproduirait l'oubli qu'elle doit empecher.
 */

const DELAI_HEURES = 24;
/* Borne haute, pour la meme raison que la relance photos (lib/db.ts) : sans
   elle, une vieille demande close autrement (par telephone, par un e-mail
   parti hors de l'admin) ressortirait a chaque passage pendant des mois. */
const FENETRE_JOURS = 30;
/* Un champ Discord est limite a 1024 caracteres et un embed a 25 champs. */
const MAX_LIGNES = 15;

interface RetoucheEnAttente {
  order_id: string;
  customer_email: string;
  customer_name: string | null;
  note: string | null;
  demandee_le: string;
}

async function retouchesSansReponse(): Promise<RetoucheEnAttente[]> {
  const rows = await sql`
    WITH derniere AS (
      SELECT DISTINCT ON (r.order_id) r.order_id, r.note, r.demandee_le
      FROM retouches r
      ORDER BY r.order_id, r.demandee_le DESC, r.id DESC
    )
    SELECT d.order_id, o.customer_email, o.customer_name, d.note, d.demandee_le
    FROM derniere d
    JOIN orders o ON o.id = d.order_id
    WHERE d.demandee_le < NOW() - (${DELAI_HEURES} * INTERVAL '1 hour')
      AND d.demandee_le > NOW() - (${FENETRE_JOURS} * INTERVAL '1 day')
      AND (o.poster_confirmation_sent_at IS NULL OR o.poster_confirmation_sent_at <= d.demandee_le)
      AND (o.final_image_sent_at IS NULL OR o.final_image_sent_at <= d.demandee_le)
      AND NOT (
        o.poster_confirmation_status = 'confirmed'
        AND o.poster_confirmation_responded_at > d.demandee_le
      )
      AND NOT EXISTS (
        SELECT 1 FROM support_replies s
        WHERE s.sent_at > d.demandee_le
          AND (s.order_id = o.id OR lower(s.to_email) = lower(o.customer_email))
      )
    ORDER BY d.demandee_le ASC
  `;
  return rows as unknown as RetoucheEnAttente[];
}

function ageEnHeures(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 3_600_000);
}

export async function GET(req: NextRequest) {
  // Sans CRON_SECRET configure, la comparaison laisserait passer
  // « Bearer undefined » : on refuse explicitement.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[CRON retouches] CRON_SECRET manquant");
    return NextResponse.json({ error: "Non configuré." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const enAttente = await retouchesSansReponse();

    /* Une seule alerte pour toutes : une par commande toutes les trois heures
       transformerait le canal en bruit, et le bruit, on finit par ne plus le
       lire. */
    if (enAttente.length > 0) {
      const lignes = enAttente.slice(0, MAX_LIGNES).map((r) => ({
        name: `📦 ${r.order_id.slice(0, 8)} · ${r.customer_name || r.customer_email} · ${ageEnHeures(r.demandee_le)} h`,
        value: (r.note?.trim() || "(sans note, voir les photos jointes)").slice(0, 300),
        inline: false,
      }));
      if (enAttente.length > MAX_LIGNES) {
        lignes.push({
          name: "…",
          value: `${enAttente.length - MAX_LIGNES} autre(s), voir le tableau de bord.`,
          inline: false,
        });
      }
      await alerteDiscord({
        titre: `⏰ ${enAttente.length} RETOUCHE(S) SANS RÉPONSE DEPUIS PLUS DE ${DELAI_HEURES} H`,
        couleur: COULEUR_ALERTE,
        champs: lignes,
        piedDePage: "Cartoonova • Le client a reçu la promesse d'une réponse sous 24 h",
      });
    }

    const result = { enAttente: enAttente.length };
    console.log("[CRON retouches]", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[CRON retouches] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
