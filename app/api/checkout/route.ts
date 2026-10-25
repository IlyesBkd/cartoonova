import { NextRequest, NextResponse } from "next/server";
import { serializeCheckoutQuote } from "@/lib/checkoutQuote";
import Stripe from "stripe";
import { quoteOrder } from "@/lib/orderQuote";
import { reservePromoForCheckout, releaseExpiredPromoReservations } from "@/lib/promoReservations";
import { parsePhotoUrls, photosInvalides } from "@/lib/orderPhotos";
import { OPTIONS_PAYANTES, parseOrderPricingInput } from "@/lib/pricing";
import { LANGS } from "@/lib/email-i18n";
import { signalerPanne } from "@/lib/alerteServeur";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderConfig, currency, promoCode, description, style, photoUrls, lang } = body;
    const langue = (LANGS as readonly string[]).includes(lang) ? (lang as string) : "";

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
    await releaseExpiredPromoReservations(promoCode, stripe);
    const result = await quoteOrder({ orderConfig, currency, promoCode });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { quote } = result;
    const amount = Math.round(quote.total * 100);

    /* Les options facturees sont posees sur le PaymentIntent : la commande les
       relit la (`order/create`), plutot que de croire le navigateur. Un
       express paye doit etre un express livre — et un express non paye ne
       doit pas passer devant les autres. */
    const config = parseOrderPricingInput(orderConfig);
    if (!config) return NextResponse.json({ error: "invalid_config" }, { status: 400 });
    const options = OPTIONS_PAYANTES.filter((o) => config[o]).join(",");
    const checkoutQuote = serializeCheckoutQuote(config, quote);

    if (amount < 100) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: quote.currency.toLowerCase(),
      description: typeof description === "string" ? description.slice(0, 500) : undefined,
      automatic_payment_methods: { enabled: true },
      /* Amazon Pay est actif sur le compte Stripe sans etre configure : il
         produisait des erreurs « merchantId=undefined » et posait des cookies
         Amazon avant tout consentement. Exclu ici, quel que soit le reglage du
         tableau de bord. */
      excluded_payment_method_types: ["amazon_pay"],
      metadata: {
        checkout_quote: checkoutQuote,
        style: typeof style === "string" ? style.slice(0, 40) : "",
        promo_code: quote.promoCode ?? "",
        subtotal: quote.subtotal.toFixed(2),
        discount: quote.discount.toFixed(2),
        shipping: quote.shipping.toFixed(2),
        options,
        lang: langue,
      },
    });

    // Never expose a discounted secret before its credit/quota is guaranteed.
    // On an uncertain SQL outcome, retain any hold: a failed cancellation must
    // never make the same credit available to a second payable intent.
    try {
      if (!await reservePromoForCheckout(paymentIntent.id, quote)) {
        await stripe.paymentIntents.cancel(paymentIntent.id);
        return NextResponse.json({ error: "Ce code vient d’être réservé. Veuillez actualiser votre devis." }, { status: 409 });
      }
    } catch (error) {
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => {});
      throw error;
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subtotal: quote.subtotal,
      shipping: quote.shipping,
      discount: quote.discount,
      total: quote.total,
      currency: quote.currency,
      promoCode: quote.promoCode,
      promoRejected: quote.promoRejected,
    });
  } catch (error) {
    await signalerPanne("creation du paiement (caisse)", error);
    return NextResponse.json({ error: "Erreur Stripe." }, { status: 500 });
  }
}
