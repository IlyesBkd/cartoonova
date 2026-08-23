import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/lib/db";
import { consumePromoCode } from "@/lib/promoCodes";
import { parsePhotoUrls, photosInvalides } from "@/lib/orderPhotos";
import { mesureServeur } from "@/lib/analyticsServeur";
import { MESURES } from "@/lib/evenementsMesure";
import { toEUR } from "@/lib/currency";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

let orderPromoSchemaReady: Promise<void> | null = null;

async function ensureOrderPromoSchema(): Promise<void> {
  if (orderPromoSchemaReady) return orderPromoSchemaReady;
  orderPromoSchemaReady = (async () => {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC`;
  })().catch((e) => {
    orderPromoSchemaReady = null;
    throw e;
  });
  return orderPromoSchemaReady;
}

export async function POST(req: NextRequest) {
  try {
    const {
      paymentIntentId,
      email,
      firstName,
      lastName,
      address,
      addressLine2,
      city,
      postalCode,
      country,
      phone,
      format,
      people,
      animals,
      background,
      printOption,
      description,
      photoUrls,
      style,
      detectedCountry,
      gift,
    } = await req.json();

    if (!paymentIntentId || !email) {
      return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
    }

    // Second verrou : cette route est appelee juste avant la confirmation du
    // paiement, donc un refus ici arrete la commande avant le debit.
    const photos = parsePhotoUrls(photoUrls);
    if (photosInvalides(photos)) {
      return NextResponse.json({ error: photos.error }, { status: 400 });
    }

    await ensureOrderPromoSchema();

    // Le montant enregistre vient de Stripe, pas du navigateur : c'est le seul
    // chiffre dont on sait qu'il correspond a ce qui a reellement ete demande
    // au client.
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const total = paymentIntent.amount / 100;
    const currency = paymentIntent.currency.toUpperCase();
    const promoCode = paymentIntent.metadata?.promo_code || null;
    const discount = Number(paymentIntent.metadata?.discount || 0) || 0;

    const customerName = [firstName, lastName].filter(Boolean).join(" ") || null;

    /* Options cadeau. Champs libres saisis par le client : on borne la
       longueur et on ne garde une date que si elle a la forme AAAA-MM-JJ,
       pour ne pas stocker n'importe quoi dans le JSON de la commande. */
    const texte = (v: unknown, max: number): string | null => {
      if (typeof v !== "string") return null;
      const propre = v.trim().slice(0, max);
      return propre || null;
    };
    const cadeau =
      gift && typeof gift === "object"
        ? {
            message: texte(gift.message, 300),
            recipientEmail: texte(gift.recipientEmail, 160),
            deliverAfter: /^\d{4}-\d{2}-\d{2}$/.test(String(gift.deliverAfter ?? ""))
              ? String(gift.deliverAfter)
              : null,
          }
        : null;
    const estCadeau = Boolean(
      cadeau && (cadeau.message || cadeau.recipientEmail || cadeau.deliverAfter)
    );

    const options = JSON.stringify({
      format,
      people,
      animals,
      background,
      printOption,
      gift: estCadeau ? cadeau : null,
      style: style || null,
      description,
      phone: phone || null,
      postalCode: postalCode || null,
      city: city || null,
      country: country || null,
      addressLine2: addressLine2 || null,
    });

    // Liste nettoyee par parsePhotoUrls : doublons retires, plafond applique.
    const photoUrlsJson = JSON.stringify(photos);

    const rows = await sql`
      INSERT INTO orders (
        payment_intent_id, customer_email, customer_name, customer_address,
        total_price, currency, options, photo_urls, status, detected_country,
        promo_code, discount_amount
      ) VALUES (
        ${paymentIntentId},
        ${email},
        ${customerName},
        ${address || null},
        ${total},
        ${currency},
        ${options}::jsonb,
        ${photoUrlsJson}::jsonb,
        'PENDING',
        ${detectedCountry || null},
        ${promoCode || null},
        ${discount || null}
      )
      RETURNING id
    `;

    const orderId = rows[0]?.id;
    console.log(`✅ Commande ${orderId} créée en PENDING | PI: ${paymentIntentId}`);

    if (promoCode) {
      await consumePromoCode(promoCode).catch((error) =>
        console.error("[order/create] increment du code promo impossible:", error)
      );
    }

    /* La commande existe, le paiement n'est pas encore confirme.
       C'est le denominateur qui manquait : sans lui, un `payment_error` ne
       peut etre rapporte a rien, et l'ecart entre commandes creees et
       commandes payees — les paniers morts entre le formulaire de carte et la
       banque — reste invisible. Le rapprochement se fait sur
       `payment_intent_id`, present ici comme sur l'achat confirme. */
    await mesureServeur(MESURES.commandeCreee, {
      identifiant: email,
      proprietes: {
        order_id: orderId,
        transaction_id: paymentIntentId,
        value: total,
        currency,
        revenue_eur: toEUR(total, currency),
        style: style || null,
        format,
        people,
        animals,
        print_option: printOption,
        is_gift: estCadeau,
        promo_code: promoCode || null,
        detected_country: detectedCountry || null,
        photo_count: photos.length,
      },
    });

    return NextResponse.json({ orderId });
  } catch (error) {
    console.error("DB insert error:", error);
    return NextResponse.json({ error: "Erreur création commande." }, { status: 500 });
  }
}
