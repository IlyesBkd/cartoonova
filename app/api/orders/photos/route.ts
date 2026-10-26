import { NextRequest, NextResponse } from "next/server";
import { enregistrerPhotosCommande, getOrderById } from "@/lib/db";
import { ClientActionError } from "@/lib/clientActionError";
import { canDepositPhotos } from "@/lib/clientOrderPolicy";
import { parseOrderTrackingToken } from "@/lib/emailToken";
import { validatePhotoOwnership } from "@/lib/photoOwnership";
import { parsePhotoUrls, photosInvalides } from "@/lib/orderPhotos";
import { mesureServeur } from "@/lib/analyticsServeur";
import { MESURES } from "@/lib/evenementsMesure";
import { alerteDiscord, COULEUR_SOLEIL } from "@/lib/discord";
import { signalerPanne } from "@/lib/alerteServeur";

/**
 * Depot des photos apres paiement.
 *
 * L'acces se fait par le meme jeton signe que la page de suivi
 * (`orderTrackingToken`) : identifiant plus signature HMAC, calcule et non
 * stocke. Sans signature, essayer des identifiants suffirait a remplacer les
 * photos de n'importe quelle commande.
 *
 * Ajout non destructif par défaut. Retrait/remplacement explicites exigent
 * l'instantané affiché au client, vérifié sous verrou avec propriété et plafond.
 */
export async function POST(req: NextRequest) {
  try {
    const { token, photoUrls, operation = "add", expectedPhotos } = await req.json();
    if (!["add", "remove", "replace"].includes(operation) ||
      (operation !== "add" && (!Array.isArray(expectedPhotos) || expectedPhotos.length > 8 || expectedPhotos.some((v: unknown) => typeof v !== "string")))) {
      return NextResponse.json({ error: "Action ou version des photos invalide." }, { status: 400 });
    }

    if (typeof token !== "string") {
      return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
    }

    const orderId = parseOrderTrackingToken(token);
    if (!orderId) {
      return NextResponse.json({ error: "Lien invalide." }, { status: 403 });
    }

    const avant = await getOrderById(orderId);
    if (!avant) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    if (!canDepositPhotos(avant)) {
      return NextResponse.json({ error: "Le dépôt de photos est fermé pour cette commande." }, { status: 409 });
    }

    /* Authenticate and load the persisted attachments before any legacy exception. */
    const photos = parsePhotoUrls(photoUrls, operation === "remove" ? [...(avant.photo_urls ?? []), ...expectedPhotos] : avant.photo_urls);
    if (photosInvalides(photos)) {
      return NextResponse.json({ error: photos.error }, { status: 400 });
    }
    if (photos.length === 0 && operation !== "replace") {
      return NextResponse.json({ error: "Aucune photo exploitable." }, { status: 400 });
    }

    const ownershipError = operation === "remove" ? null : await validatePhotoOwnership(photos, avant, "depot");
    if (ownershipError) {
      return NextResponse.json({ error: ownershipError.error }, { status: 403 });
    }

    const result = await enregistrerPhotosCommande(orderId, photos, operation, expectedPhotos);
    const apres = result.order;
    if (!result.changed) return NextResponse.json({ ok: true, photos: apres.photo_urls.length, photoUrls: apres.photo_urls });

    /* Le premier depot est ce qui debloque l'illustrateur : il merite une
       notification, au meme titre qu'une commande. Les depots suivants — le
       client qui se ravise — n'en valent pas une de plus. */
    const premierDepot = result.firstDeposit;
    if (premierDepot) {
      await alerteDiscord({
        titre: "📸 PHOTOS REÇUES — la commande peut partir en dessin",
        couleur: COULEUR_SOLEIL,
        champs: [
          { name: "📦 Commande", value: orderId.slice(0, 8), inline: true },
          { name: "📧 Client", value: apres.customer_email, inline: true },
          { name: "🖼️ Photos", value: String(photos.length), inline: true },
        ],
        piedDePage: "Cartoonova • dépôt après paiement",
      });
    }

    await mesureServeur(MESURES.photosDeposees, {
      identifiant: apres.customer_email,
      proprietes: {
        order_id: orderId,
        photo_count: photos.length,
        premier_depot: premierDepot,
        /* Combien de temps le client a mis a revenir. C'est ce chiffre qui
           dira si la relance a J+1 est trop tot, trop tard, ou inutile. */
        heures_apres_commande: Math.round(
          (Date.now() - new Date(apres.created_at).getTime()) / 3_600_000
        ),
      },
    });

    return NextResponse.json({ ok: true, photos: apres.photo_urls.length, photoUrls: apres.photo_urls });
  } catch (erreur) {
    if (erreur instanceof ClientActionError) return NextResponse.json({ error: erreur.message }, { status: erreur.status });
    await signalerPanne("depot de photos apres paiement", erreur);
    return NextResponse.json({ error: "Erreur technique." }, { status: 500 });
  }
}
