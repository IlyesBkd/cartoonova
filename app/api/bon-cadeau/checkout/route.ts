import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { deviseValide, montantsBon } from "@/lib/bonCadeauMontants";
import { LANGS } from "@/lib/email-i18n";
import { emailValide } from "@/lib/email";
import { signalerPanne } from "@/lib/alerteServeur";

/* Prepare le paiement d'un bon cadeau.

   Le montant n'est jamais repris tel quel du navigateur : il doit faire partie
   des montants proposes pour la devise. Le type « bon_cadeau » dans les
   metadonnees est ce qui permet au webhook et a la page de succes de traiter
   ce paiement comme un bon, et non comme un portrait sans commande. */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

const court = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const devise = deviseValide(body.currency);
    const montant = Number(body.montant);
    const email = court(body.email, 160);

    if (!devise || !montantsBon(devise).includes(montant)) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }
    if (!emailValide(email)) {
      return NextResponse.json({ error: "E-mail invalide." }, { status: 400 });
    }
    const lang = (LANGS as readonly string[]).includes(body.lang) ? body.lang : "en";

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(montant * 100),
      currency: devise.toLowerCase(),
      description: `Bon cadeau Cartoonova ${montant} ${devise}`,
      receipt_email: email,
      automatic_payment_methods: { enabled: true },
      /* Amazon Pay est actif sur le compte Stripe sans etre configure : il
         produisait des erreurs « merchantId=undefined » et posait des cookies
         Amazon avant tout consentement. Exclu ici, quel que soit le reglage du
         tableau de bord. */
      excluded_payment_method_types: ["amazon_pay"],
      metadata: {
        type: "bon_cadeau",
        email,
        lang,
        prenom: court(body.prenom, 40),
        message: court(body.message, 300),
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (erreur) {
    await signalerPanne("creation du paiement (bon cadeau)", erreur);
    return NextResponse.json({ error: "Erreur Stripe." }, { status: 500 });
  }
}
