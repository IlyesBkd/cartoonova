import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";
import { nanoid } from "nanoid";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

const SUPPORTED_CURRENCIES = ["eur", "usd", "gbp", "cad", "aud"];

export async function POST(req: NextRequest) {
  try {
    const { amount, description, currency, orderData } = await req.json();

    if (!amount || amount < 100) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }

    const stripeCurrency = (currency || "eur").toLowerCase();
    if (!SUPPORTED_CURRENCIES.includes(stripeCurrency)) {
      return NextResponse.json({ error: "Devise non supportée." }, { status: 400 });
    }

    // 1. Créer le PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: stripeCurrency,
      description,
      automatic_payment_methods: { enabled: true },
    });

    // 2. Sauvegarder la commande en PENDING dans Neon
    const sql = neon(process.env.DATABASE_URL!);
    const orderId = nanoid(8); // ID court et unique
    
    await sql`
      INSERT INTO orders (
        id, customer_email, customer_name, customer_phone, customer_address,
        customer_postal, customer_city, customer_country, format, people, animals,
        background, print_option, total_price, currency, photo_urls, description,
        stripe_payment_id, status, created_at
      ) VALUES (
        ${orderId},
        ${orderData.email},
        ${orderData.firstName || null},
        ${orderData.phone || null},
        ${orderData.address || null},
        ${orderData.postalCode || null},
        ${orderData.city || null},
        ${orderData.country || null},
        ${orderData.format},
        ${orderData.people},
        ${orderData.animals},
        ${orderData.background},
        ${orderData.printOption},
        ${orderData.total},
        ${currency.toUpperCase()},
        ${JSON.stringify(orderData.photoUrls || [])},
        ${description},
        ${paymentIntent.id},
        'PENDING',
        NOW()
      )
    `;

    console.log(`✅ Commande ${orderId} créée en PENDING avec PaymentIntent ${paymentIntent.id}`);

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret,
      orderId: orderId 
    });
  } catch (error) {
    console.error("Stripe/DB error:", error);
    return NextResponse.json({ error: "Erreur de paiement." }, { status: 500 });
  }
}
