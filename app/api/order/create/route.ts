import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/lib/db";
import { consumePromoCode } from "@/lib/promoCodes";

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
    } = await req.json();

    if (!paymentIntentId || !email) {
      return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
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

    const options = JSON.stringify({
      format,
      people,
      animals,
      background,
      printOption,
      style: style || null,
      description,
      phone: phone || null,
      postalCode: postalCode || null,
      city: city || null,
      country: country || null,
      addressLine2: addressLine2 || null,
    });

    const photoUrlsJson = JSON.stringify(photoUrls || []);

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

    return NextResponse.json({ orderId });
  } catch (error) {
    console.error("DB insert error:", error);
    return NextResponse.json({ error: "Erreur création commande." }, { status: 500 });
  }
}
