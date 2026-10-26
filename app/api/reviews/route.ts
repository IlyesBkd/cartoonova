import { getOrderById } from "@/lib/db";
import { canReviewOrder } from "@/lib/clientOrderPolicy";
import { ClientActionError } from "@/lib/clientActionError";
import { diagnosticJournal } from "@/lib/confidentialiteMesure";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { recompenserAvis } from "@/lib/recompenseAvis";
import {
  deposerAvis,
  tousLesAvis,
  changerStatutAvis,
  type StatutAvis,
} from "@/lib/reviewsDb";
import { parseOrderTrackingToken } from "@/lib/emailToken";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { cleDepuisRequete } from "@/lib/rateLimit";
import { locales } from "@/i18n/config";

export const dynamic = "force-dynamic";

/**
 * Limitation de debit du depot public.
 *
 * Un compteur en memoire ne survit pas au recyclage d'une instance et n'est pas
 * partage entre elles : il ne pretend pas arreter un attaquant determine. Il
 * suffit en revanche a empecher qu'un formulaire relance en boucle remplisse la
 * table et sature le webhook Discord, ce qui est le risque reel ici. Le vrai
 * garde-fou reste le jeton de commande : sans lui, rien n'est publie.
 */
const DEPOTS_MAX = 3;
const FENETRE_MS = 60 * 60 * 1000;
const depots = new Map<string, number[]>();

function tropDeDepots(cle: string): boolean {
  const maintenant = Date.now();
  const recents = (depots.get(cle) ?? []).filter((t) => t > maintenant - FENETRE_MS);

  if (recents.length >= DEPOTS_MAX) {
    depots.set(cle, recents);
    return true;
  }

  recents.push(maintenant);
  depots.set(cle, recents);

  // Purge opportuniste : sans elle la table grossirait indefiniment.
  if (depots.size > 500) {
    for (const [autre, dates] of depots) {
      if (dates.every((t) => t <= maintenant - FENETRE_MS)) depots.delete(autre);
    }
  }
  return false;
}

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
  if (tropDeDepots(cleDepuisRequete(req))) {
    return NextResponse.json({ error: "trop_de_depots" }, { status: 429 });
  }

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
    if (jeton && !orderId) return NextResponse.json({ error: "lien_invalide" }, { status: 403 });
    if (orderId) {
      const order = await getOrderById(orderId);
      if (!order) return NextResponse.json({ error: "commande_introuvable" }, { status: 404 });
      if (!canReviewOrder(order)) return NextResponse.json({ error: "avis_indisponible" }, { status: 409 });
    }

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
    // Un avis verifie est publie d'office : les pages qui l'affichent sont en cache.
    if (resultat.statut === "publie") revalidateTag("avis", { expire: 0 });

    /* Bon de remerciement, quelle que soit la note : seulement pour un avis
       rattache a une vraie commande (lien signe), une fois par commande. */
    if (orderId) await recompenserAvis(orderId);

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
    if (error instanceof ClientActionError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[POST /api/reviews]", diagnosticJournal(error));
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/** Liste complete, pour la moderation depuis l'administration. */
export async function GET(req: NextRequest) {
  const refus = await refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    return NextResponse.json(await tousLesAvis());
  } catch (error) {
    console.error("[GET /api/reviews]", diagnosticJournal(error));
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

const STATUTS: StatutAvis[] = ["publie", "en_attente", "rejete"];

export async function PATCH(req: NextRequest) {
  const refus = await refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const body = (await req.json()) as { id?: unknown; statut?: unknown };
    const id = Number(body.id);
    const statut = body.statut as StatutAvis;

    if (!Number.isInteger(id) || !STATUTS.includes(statut)) {
      return NextResponse.json({ error: "requete_invalide" }, { status: 400 });
    }

    await changerStatutAvis(id, statut);
    // Publie ou retire : /avis et les etoiles des fiches doivent suivre tout de suite.
    revalidateTag("avis", { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/reviews]", diagnosticJournal(error));
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
