import { NextRequest, NextResponse } from "next/server";
import { enregistrerPhotosCommande, getOrderById } from "@/lib/db";
import { parseOrderTrackingToken } from "@/lib/emailToken";
import { parsePhotoUrls, photosInvalides } from "@/lib/orderPhotos";
import { mesureServeur } from "@/lib/analyticsServeur";
import { MESURES } from "@/lib/evenementsMesure";
import { alerteDiscord, COULEUR_SOLEIL } from "@/lib/discord";

/**
 * Depot des photos apres paiement.
 *
 * L'acces se fait par le meme jeton signe que la page de suivi
 * (`orderTrackingToken`) : identifiant plus signature HMAC, calcule et non
 * stocke. Sans signature, essayer des identifiants suffirait a remplacer les
 * photos de n'importe quelle commande.
 *
 * La route est volontairement idempotente : le client peut revenir et renvoyer
 * une autre selection, la liste remplace la precedente.
 */
export async function POST(req: NextRequest) {
  try {
    const { token, photoUrls } = await req.json();

    if (typeof token !== "string") {
      return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
    }

    const orderId = parseOrderTrackingToken(token);
    if (!orderId) {
      return NextResponse.json({ error: "Lien invalide." }, { status: 403 });
    }

    /* Meme nettoyage qu'a la commande : seules des URL https du stockage
       distant passent, doublons retires, plafond applique. */
    const photos = parsePhotoUrls(photoUrls);
    if (photosInvalides(photos)) {
      return NextResponse.json({ error: photos.error }, { status: 400 });
    }
    if (photos.length === 0) {
      return NextResponse.json({ error: "Aucune photo exploitable." }, { status: 400 });
    }

    const avant = await getOrderById(orderId);
    if (!avant) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    const apres = await enregistrerPhotosCommande(orderId, photos);
    if (!apres) {
      return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
    }

    /* Le premier depot est ce qui debloque l'illustrateur : il merite une
       notification, au meme titre qu'une commande. Les depots suivants — le
       client qui se ravise — n'en valent pas une de plus. */
    const premierDepot = !Array.isArray(avant.photo_urls) || avant.photo_urls.length === 0;
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

    return NextResponse.json({ ok: true, photos: photos.length });
  } catch (erreur) {
    console.error("[orders/photos] échec:", erreur);
    return NextResponse.json({ error: "Erreur technique." }, { status: 500 });
  }
}
