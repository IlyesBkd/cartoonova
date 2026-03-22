import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/lib/db";

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

    // 1. Créer le PaymentIntent Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: stripeCurrency,
      description,
      automatic_payment_methods: { enabled: true },
    });

    // 2. Construire l'objet options JSONB
    const options = JSON.stringify({
      format: orderData.format,
      people: orderData.people,
      animals: orderData.animals,
      background: orderData.background,
      printOption: orderData.printOption,
      description: description,
      phone: orderData.phone || null,
      postalCode: orderData.postalCode || null,
      city: orderData.city || null,
      country: orderData.country || null,
    });

    // 3. Construire le tableau photoUrls en JSONB
    const photoUrls = JSON.stringify(orderData.photoUrls || []);

    // 4. Construire le nom complet
    const customerName = [orderData.firstName, orderData.lastName].filter(Boolean).join(" ") || null;

    // 5. Insérer la commande en PENDING dans Neon
    const rows = await sql`
      INSERT INTO orders (
        payment_intent_id, customer_email, customer_name, customer_address,
        total_price, currency, options, photo_urls, status
      ) VALUES (
        ${paymentIntent.id},
        ${orderData.email},
        ${customerName},
        ${orderData.address || null},
        ${orderData.total},
        ${stripeCurrency.toUpperCase()},
        ${options}::jsonb,
        ${photoUrls}::jsonb,
        'PENDING'
      )
      RETURNING id
    `;

    const orderId = rows[0]?.id;
    console.log(`✅ Commande ${orderId} créée en PENDING | PI: ${paymentIntent.id}`);

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret,
      orderId 
    });
  } catch (error) {
    console.error("Stripe/DB error:", error);
    return NextResponse.json({ error: "Erreur de paiement." }, { status: 500 });
  }
}
