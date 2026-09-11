import { NextRequest, NextResponse } from "next/server";
import {
  getOrderById,
  updateOrderFinalImage,
  programmerEnvoiImageFinale,
  programmerEnvoiImageFinaleSiLibre,
  annulerEnvoiImageFinale,
} from "@/lib/db";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { envoyerImageFinale } from "@/lib/emailImageFinale";
import { dateEnvoiProgramme, reporterApresDateCadeau } from "@/lib/envoiProgramme";
import { estPhysique } from "@/lib/supportCommande";

/**
 * Depot de l'illustration finale, et son envoi.
 *
 * Trois gestes passent par ici, distingues par `action` :
 *   - depot   (`saveOnly`)   : enregistre l'image et pose le rendez-vous d'envoi
 *   - envoi   (defaut)       : envoie maintenant, quel que soit le rendez-vous
 *   - report / annulation    : deplace ou retire le rendez-vous
 *
 * Le rendez-vous existe parce qu'un portrait livre dans l'heure se lit comme un
 * portrait genere dans l'heure. Le detail du calcul est dans lib/envoiProgramme.
 */

/** `options` revient parfois en texte de la base selon le chemin de lecture. */
function lireOptions(brut: unknown) {
  if (typeof brut === "string") {
    try {
      return JSON.parse(brut);
    } catch {
      return null;
    }
  }
  return brut ?? null;
}

export async function POST(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const {
      orderId,
      customerEmail,
      customerName,
      finalImageUrl,
      detectedCountry,
      saveOnly,
      action,
      scheduledAt,
    } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
    }

    // ── Annulation ───────────────────────────────────────────────────
    if (action === "cancel") {
      await annulerEnvoiImageFinale(orderId);
      return NextResponse.json({ ok: true, scheduledAt: null });
    }

    // ── Report, ou programmation forcee ──────────────────────────────
    /* Forcee : c'est le bouton que l'admin utilise quand le depot n'a rien
       programme de lui-meme — un tirage physique pas encore valide, typiquement
       (voir plus bas) — ou pour deplacer une date deja posee. */
    if (action === "schedule") {
      const order = await getOrderById(orderId);
      if (!order) {
        return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
      }
      if (!order.final_image_url) {
        return NextResponse.json(
          { error: "Aucune image finale à envoyer." },
          { status: 400 }
        );
      }

      const demandee = scheduledAt ? new Date(scheduledAt) : null;
      if (demandee && Number.isNaN(demandee.getTime())) {
        return NextResponse.json({ error: "Date invalide." }, { status: 400 });
      }

      /* Une date saisie a la main reste soumise a la date du cadeau : c'est une
         promesse faite au client qui paie, pas un defaut qu'on ecrase. */
      const quand = demandee
        ? reporterApresDateCadeau(demandee, lireOptions(order.options))
        : dateEnvoiProgramme(new Date(), lireOptions(order.options), order.created_at);

      await programmerEnvoiImageFinale(orderId, quand);
      return NextResponse.json({ ok: true, scheduledAt: quand.toISOString() });
    }

    if (!finalImageUrl) {
      return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
    }

    // ── Depot de l'image ─────────────────────────────────────────────
    if (saveOnly) {
      await updateOrderFinalImage(orderId, finalImageUrl);

      const order = await getOrderById(orderId);
      const options = lireOptions(order?.options);

      /* Un tirage physique que le client n'a pas encore valide ne se programme
         pas tout seul. L'e-mail dit « telechargez votre portrait » ; sur une
         toile, ce qu'on attend d'abord du client c'est son accord avant que
         l'impression parte. Le tableau de bord refusait deja l'envoi par
         inadvertance, il serait absurde qu'un depot d'image le declenche a
         retardement, sans personne devant l'ecran pour s'en apercevoir.
         L'admin garde le bouton « Programmer » pour le faire sciemment. */
      const attenteValidation =
        estPhysique(options) && order?.poster_confirmation_status !== "confirmed";

      if (attenteValidation) {
        return NextResponse.json({
          ok: true,
          saved: true,
          scheduledAt: null,
          raisonNonProgramme: "validation_tirage",
        });
      }

      const quand = await programmerEnvoiImageFinaleSiLibre(
        orderId,
        dateEnvoiProgramme(new Date(), options, order?.created_at)
      );

      return NextResponse.json({
        ok: true,
        saved: true,
        /* null quand un rendez-vous existait deja, ou que la commande est deja
           partie : le tableau de bord affiche alors ce qu'il avait en memoire. */
        scheduledAt: quand ? quand.toISOString() : null,
      });
    }

    // ── Envoi immediat ───────────────────────────────────────────────
    if (!customerEmail) {
      return NextResponse.json({ error: "Email client manquant." }, { status: 400 });
    }

    await updateOrderFinalImage(orderId, finalImageUrl);

    const result = await envoyerImageFinale({
      id: orderId,
      customer_email: customerEmail,
      customer_name: customerName ?? null,
      detected_country: detectedCountry ?? null,
      final_image_url: finalImageUrl,
    });

    return NextResponse.json({ ok: true, emailId: result.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/orders/send-final-image] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
