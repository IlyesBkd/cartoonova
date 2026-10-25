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
import { optionsLivraisonCadeau, validerLivraisonCadeau, LivraisonCadeauInvalide } from "@/lib/livraisonCadeau";
import { downloadFinalImage, validateFinalImageUrl, FinalImageError } from "@/lib/finalImage";

/**
 * Depot de l'illustration finale, et son envoi.
 *
 * Trois gestes passent par ici, distingues par `action` :
 *   - depot   (`saveOnly`)   : enregistre l'image et pose le rendez-vous d'envoi
 *   - envoi   (defaut)       : envoie maintenant, sauf date cadeau future
 *   - report / annulation    : deplace ou retire le rendez-vous
 *
 * Le rendez-vous existe parce qu'un portrait livre dans l'heure se lit comme un
 * portrait genere dans l'heure. Le detail du calcul est dans lib/envoiProgramme.
 */

export async function POST(req: NextRequest) {
  const refus = await refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const {
      orderId,
      customerEmail,
      finalImageUrl,
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
      validateFinalImageUrl(order.final_image_url);
      if (demandee && Number.isNaN(demandee.getTime())) {
        return NextResponse.json({ error: "Date invalide." }, { status: 400 });
      }

      /* Une date saisie a la main reste soumise a la date du cadeau : c'est une
         promesse faite au client qui paie, pas un defaut qu'on ecrase. */
      const options = optionsLivraisonCadeau(order.options);
      validerLivraisonCadeau(options);
      const quand = demandee
        ? reporterApresDateCadeau(demandee, options)
        : dateEnvoiProgramme(new Date(), options, order.created_at);

      await programmerEnvoiImageFinale(orderId, quand);
      return NextResponse.json({ ok: true, scheduledAt: quand.toISOString() });
    }

    if (!finalImageUrl) {
      return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
    }

    // Recipient, gift promise and language come exclusively from the saved order.
    let order = await getOrderById(orderId);
    if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    if (customerEmail !== undefined && customerEmail !== order.customer_email) {
      return NextResponse.json({ error: "Destinataire différent de la commande enregistrée." }, { status: 409 });
    }
    if (!saveOnly && finalImageUrl !== order.final_image_url) {
      return NextResponse.json({ error: "Image différente de la commande enregistrée. Déposez-la avant l'envoi." }, { status: 409 });
    }
    let options = optionsLivraisonCadeau(order.options);
    validerLivraisonCadeau(options);

    // ── Depot de l'image ─────────────────────────────────────────────
    // Refuse unsafe destinations and bytes BEFORE persistence or scheduling.
    await downloadFinalImage(finalImageUrl);
    if (saveOnly) {
      await updateOrderFinalImage(orderId, finalImageUrl);
      const saved = await getOrderById(orderId);
      if (!saved || saved.final_image_url !== finalImageUrl || saved.customer_email !== order.customer_email) {
        throw new FinalImageError("La commande a changé. Rechargez-la avant l'envoi.", 409);
      }
      order = saved;
      options = optionsLivraisonCadeau(saved.options);
      validerLivraisonCadeau(options);

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

      /* Express : promis sous 24 h, week-end compris. La tache planifiee ne
         passe qu'une fois par jour a 09:00 UTC — une image deposee a 10 h
         partirait le lendemain. On l'envoie donc tout de suite, sauf si le
         client a demande une remise a une date de cadeau ulterieure. */
      if (options?.express) {
        const envoi = await envoyerImageFinale({
          ...order,
          options,
          final_image_url: finalImageUrl,
        });
        if (envoi.deferredUntil) return NextResponse.json({ ok: true, saved: true, scheduledAt: envoi.deferredUntil });
        return NextResponse.json({ ok: true, saved: true, scheduledAt: null, envoyeImmediatement: true, emailId: envoi.id });
      }

      const quand = await programmerEnvoiImageFinaleSiLibre(
        orderId,
        dateEnvoiProgramme(new Date(), options, order?.created_at),
        order
      );

      if (!quand) throw new FinalImageError("La commande a changé ou a déjà été envoyée. Rechargez-la avant de programmer.", 409);

      return NextResponse.json({
        ok: true,
        saved: true,
        scheduledAt: quand.toISOString(),
      });
    }

    // ── Envoi immediat ───────────────────────────────────────────────
    // Sending is not an upload: never overwrite an image changed since the read.
    const result = await envoyerImageFinale({
      ...order,
      options,
      final_image_url: finalImageUrl,
    });

    if (result.deferredUntil) return NextResponse.json({ ok: true, scheduledAt: result.deferredUntil });

    return NextResponse.json({ ok: true, emailId: result.id });
  } catch (error: unknown) {
    const message = error instanceof FinalImageError || error instanceof LivraisonCadeauInvalide ? error.message : "Envoi du portrait impossible.";
    console.error("[SEND-FINAL-IMAGE] Échec de livraison.");
    return NextResponse.json({ error: message }, { status: error instanceof FinalImageError ? error.status : error instanceof LivraisonCadeauInvalide ? 400 : 500 });
  }
}
