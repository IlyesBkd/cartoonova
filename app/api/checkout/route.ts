import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

const SUPPORTED_CURRENCIES = ["eur", "usd", "gbp", "cad", "aud"];

export async function POST(req: NextRequest) {
  try {
    const { amount, description, currency } = await req.json();

    if (!amount || amount < 100) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }

    const stripeCurrency = (currency || "eur").toLowerCase();
    if (!SUPPORTED_CURRENCIES.includes(stripeCurrency)) {
      return NextResponse.json({ error: "Devise non supportée." }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: stripeCurrency,
      description,
      automatic_payment_methods: { enabled: true },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Stripe error:", error);
    return NextResponse.json({ error: "Erreur de paiement." }, { status: 500 });
  }
}
