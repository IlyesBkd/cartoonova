import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { quoteOrder } from "@/lib/orderQuote";
import { parsePhotoUrls, photosInvalides } from "@/lib/orderPhotos";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderConfig, currency, promoCode, description, style, photoUrls } = body;

    /* Les photos sont nettoyees mais plus exigees : une commande peut naitre
       sans, le client les depose apres paiement (voir `lib/orderPhotos.ts`).
       Le nettoyage reste — seules des URL https du stockage distant passent. */
    const photos = parsePhotoUrls(photoUrls);
    if (photosInvalides(photos)) {
      return NextResponse.json({ error: photos.error }, { status: 400 });
    }

    // Le montant n'est plus accepte depuis le navigateur : il est recalcule
    // ici a partir des prix en base, sinon n'importe qui pourrait payer 1 €
    // une commande a 59 € en modifiant la requete.
    const result = await quoteOrder({ orderConfig, currency, promoCode });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { quote } = result;
    const amount = Math.round(quote.total * 100);

    if (amount < 100) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: quote.currency.toLowerCase(),
      description: typeof description === "string" ? description.slice(0, 500) : undefined,
      automatic_payment_methods: { enabled: true },
      metadata: {
        style: typeof style === "string" ? style.slice(0, 40) : "",
        promo_code: quote.promoCode ?? "",
        subtotal: quote.subtotal.toFixed(2),
        discount: quote.discount.toFixed(2),
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subtotal: quote.subtotal,
      discount: quote.discount,
      total: quote.total,
      currency: quote.currency,
      promoCode: quote.promoCode,
      promoRejected: quote.promoRejected,
    });
  } catch (error) {
    console.error("Stripe error:", error);
    return NextResponse.json({ error: "Erreur Stripe." }, { status: 500 });
  }
}
