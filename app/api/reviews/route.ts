import { NextRequest, NextResponse } from "next/server";
import {
  deposerAvis,
  tousLesAvis,
  changerStatutAvis,
  type StatutAvis,
} from "@/lib/reviewsDb";
import { parseOrderTrackingToken } from "@/lib/emailToken";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { locales } from "@/i18n/config";

export const dynamic = "force-dynamic";

const TEXTE_MIN = 20;
const TEXTE_MAX = 2000;
const AUTEUR_MAX = 60;

/** En dessous, l'avis merite qu'on previenne avant que le client ne s'en aille. */
const NOTE_ALERTE = 3;

async function alerterDiscord(titre: string, lignes: string[], rouge: boolean): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: titre,
          description: lignes.join("\n"),
          color: rouge ? 0xdc2626 : 0x16a34a,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  }).catch(() => {
    /* Une alerte perdue ne doit pas faire echouer le depot de l'avis. */
  });
}

/**
 * Depot d'un avis.
 *
 * Le jeton `c` est celui des liens de suivi de commande : sa validite prouve
 * l'achat. Sans lui, l'avis part en moderation plutot que d'etre refuse — un
 * client qui a perdu son email doit pouvoir s'exprimer.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const auteur = typeof body.auteur === "string" ? body.auteur.trim().slice(0, AUTEUR_MAX) : "";
    const texte = typeof body.texte === "string" ? body.texte.trim() : "";
    const note = Number(body.note);
    const rawLocale = typeof body.locale === "string" ? body.locale : "";
    const locale = (locales as readonly string[]).includes(rawLocale) ? rawLocale : "fr";
    const jeton = typeof body.jeton === "string" ? body.jeton : "";

    if (!auteur) {
      return NextResponse.json({ error: "auteur_manquant" }, { status: 400 });
    }
    if (!Number.isInteger(note) || note < 1 || note > 5) {
      return NextResponse.json({ error: "note_invalide" }, { status: 400 });
    }
    if (texte.length < TEXTE_MIN || texte.length > TEXTE_MAX) {
      return NextResponse.json({ error: "texte_invalide" }, { status: 400 });
    }

    const orderId = jeton ? parseOrderTrackingToken(jeton) : null;

    const resultat = await deposerAvis({
      orderId,
      auteur,
      locale,
      note,
      texte,
      verifie: Boolean(orderId),
    });

    /* `null` signifie que la commande a deja donne un avis : on repond comme
       si tout allait bien, sans reveler l'existence du precedent. */
    if (!resultat) {
      return NextResponse.json({ ok: true, statut: "deja_depose" });
    }

    if (note <= NOTE_ALERTE) {
      await alerterDiscord(
        "⭐ Avis a traiter",
        [
          `Note : ${note}/5 ${orderId ? "(achat verifie)" : "(non verifie)"}`,
          `Auteur : ${auteur}`,
          texte.slice(0, 400),
          orderId ? `Commande : ${orderId}` : "",
        ].filter(Boolean),
        true
      );
    } else if (resultat.statut === "en_attente") {
      await alerterDiscord("⭐ Avis en attente de moderation", [`${note}/5 — ${auteur}`], false);
    }

    return NextResponse.json({ ok: true, statut: resultat.statut });
  } catch (error) {
    console.error("[POST /api/reviews]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/** Liste complete, pour la moderation depuis l'administration. */
export async function GET(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    return NextResponse.json(await tousLesAvis());
  } catch (error) {
    console.error("[GET /api/reviews]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

const STATUTS: StatutAvis[] = ["publie", "en_attente", "rejete"];

export async function PATCH(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const body = (await req.json()) as { id?: unknown; statut?: unknown };
    const id = Number(body.id);
    const statut = body.statut as StatutAvis;

    if (!Number.isInteger(id) || !STATUTS.includes(statut)) {
      return NextResponse.json({ error: "requete_invalide" }, { status: 400 });
    }

    await changerStatutAvis(id, statut);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/reviews]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
