import Stripe from "stripe";
import { Resend } from "resend";
import { getOrderByPaymentId, updateOrderStatus } from "@/lib/db";
import type { DbOrder } from "@/lib/db";
import SuccessClient from "@/app/success/SuccessClient";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

const resend = new Resend(process.env.RESEND_API_KEY!);

async function sendOrderConfirmation(order: DbOrder) {
  try {
    console.log("[RESEND] Début envoi email à:", order.customer_email);
    console.log("[RESEND] API Key présente:", !!process.env.RESEND_API_KEY);
    console.log("[RESEND] API Key (4 premiers chars):", process.env.RESEND_API_KEY?.slice(0, 4));

    const opts = order.options;
    const result = await resend.emails.send({
      from: "Cartoonova <noreply@cartoonova.com>",
      to: [order.customer_email],
      subject: "🎉 Commande confirmée - Vos artistes commencent !",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef3c7; padding: 20px; border: 4px solid #000;">
          <div style="background: white; border: 3px solid #000; padding: 30px; margin: 20px 0; box-shadow: 8px 8px 0px rgba(0,0,0,1);">
            <h1 style="font-size: 32px; font-weight: 900; text-align: center; margin: 0 0 20px 0; color: #000; text-transform: uppercase;">
              🎉 BOOM ! C'est dans la boîte !
            </h1>
            <p style="font-size: 18px; font-weight: bold; text-align: center; margin: 0 0 30px 0; color: #000;">
              Votre commande #${order.id.slice(0, 8)} est confirmée
            </p>
            <div style="background: #fef3c7; border: 2px solid #000; padding: 20px; margin: 20px 0;">
              <h2 style="font-size: 20px; font-weight: 900; margin: 0 0 15px 0; color: #000;">Récapitulatif</h2>
              <ul style="font-size: 16px; font-weight: bold; margin: 0; padding: 0 0 0 20px; color: #000;">
                <li>Format: ${opts.format === 'portrait' ? 'Portrait' : 'Full Body'}</li>
                <li>Personnes: ${opts.people}</li>
                ${opts.animals > 0 ? `<li>Animaux: ${opts.animals}</li>` : ''}
                <li>Option: ${opts.printOption}</li>
                <li>Total: ${order.total_price} ${order.currency}</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <p style="font-size: 18px; font-weight: bold; color: #000;">🎨 Nos artistes se mettent au travail !</p>
              <p style="font-size: 16px; color: #000;">Vous recevrez votre caricature dans 3-5 jours ouvrables.</p>
            </div>
          </div>
          <div style="text-align: center; font-size: 14px; color: #000; font-weight: bold;">
            <p>Merci pour votre confiance ! 🎨</p>
            <p>L'équipe Cartoonova</p>
          </div>
        </div>
      `,
    });
    console.log("[RESEND] ✅ Résultat envoi:", JSON.stringify(result));
  } catch (error) {
    console.error("[RESEND] ❌ Erreur envoi email:", error);
  }
}

async function sendDiscordNotification(order: DbOrder) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;
    const opts = order.options;

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: "🎉 NOUVELLE COMMANDE REÇUE !",
          color: 16776960,
          fields: [
            { name: "📦 Numéro", value: order.id.slice(0, 8), inline: true },
            { name: "📧 Email", value: order.customer_email, inline: true },
            { name: "🎨 Format", value: opts.format, inline: true },
            { name: "👥 Personnes", value: opts.animals > 0 ? `${opts.people} + ${opts.animals} animaux` : opts.people.toString(), inline: true },
            { name: "🖼️ Option", value: opts.printOption, inline: true },
            { name: "💰 Total", value: `${order.total_price} ${order.currency}`, inline: true },
          ],
          footer: { text: "Cartoonova • Paiement réussi" },
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    console.log("✅ Notification Discord envoyée");
  } catch (error) {
    console.error("❌ Erreur notification Discord:", error);
  }
}

export default async function SuccessPage(props: {
  searchParams: Promise<{ payment_intent?: string; redirect_status?: string }>;
}) {
  const searchParams = await props.searchParams;
  console.log("[SUCCESS PAGE] 🚀 Chargement | searchParams:", JSON.stringify(searchParams));
  const paymentIntentId = searchParams.payment_intent;

  if (!paymentIntentId) {
    console.log("[SUCCESS PAGE] ❌ Pas de payment_intent dans l'URL → affichage erreur");
    return (
      <div style={{ padding: 40, fontFamily: "monospace" }}>
        <h1>Erreur : payment_intent manquant</h1>
        <p>searchParams reçu : <code>{JSON.stringify(searchParams)}</code></p>
        <a href="/">Retour à l&apos;accueil</a>
      </div>
    );
  }

  try {
    // 1. Vérifier le statut réel du paiement via Stripe
    console.log("[SUCCESS PAGE] 1. Retrieve PaymentIntent:", paymentIntentId);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log("[SUCCESS PAGE] Stripe status:", paymentIntent.status);

    if (paymentIntent.status !== "succeeded") {
      console.log("[SUCCESS PAGE] ❌ Paiement non réussi:", paymentIntent.status);
      return (
        <div style={{ padding: 40, fontFamily: "monospace" }}>
          <h1>Paiement non finalisé</h1>
          <p>Statut Stripe : <code>{paymentIntent.status}</code></p>
          <p>PI : <code>{paymentIntentId}</code></p>
          <a href="/">Retour à l&apos;accueil</a>
        </div>
      );
    }

    // 2. Chercher la commande PENDING correspondante
    console.log("[SUCCESS PAGE] 2. Recherche commande pour PI:", paymentIntentId);
    const order = await getOrderByPaymentId(paymentIntentId);
    console.log("[SUCCESS PAGE] Commande trouvée:", order ? `id=${order.id} status=${order.status}` : "NULL");

    if (!order) {
      console.error("[SUCCESS PAGE] ❌ Commande non trouvée pour PI:", paymentIntentId);
      return (
        <div style={{ padding: 40, fontFamily: "monospace" }}>
          <h1>Commande introuvable</h1>
          <p>Le paiement a réussi mais la commande n&apos;a pas été trouvée en base.</p>
          <p>PI : <code>{paymentIntentId}</code></p>
          <p>Contactez support@cartoonova.com avec ce numéro.</p>
          <a href="/">Retour à l&apos;accueil</a>
        </div>
      );
    }

    // 3. Si déjà PAID, ne rien refaire (anti-double envoi)
    if (order.status === "PAID") {
      console.log("[SUCCESS PAGE] ℹ️ Déjà PAID, affichage sans re-notification");
      return <SuccessClient order={order} />;
    }

    // 4. Mettre à jour le statut à PAID
    console.log("[SUCCESS PAGE] 4. UPDATE status → PAID pour:", order.id);
    await updateOrderStatus(order.id, "PAID");
    console.log("[SUCCESS PAGE] ✅ Commande", order.id, "marquée PAID");

    // 5. Envoyer les notifications (une seule fois)
    console.log("[SUCCESS PAGE] 5. Envoi notifications Discord + Resend...");
    await Promise.all([
      sendOrderConfirmation(order),
      sendDiscordNotification(order),
    ]);
    console.log("[SUCCESS PAGE] ✅ Notifications envoyées");

    return <SuccessClient order={order} />;
  } catch (error) {
    console.error("[SUCCESS PAGE] 💥 Erreur:", error);
    return (
      <div style={{ padding: 40, fontFamily: "monospace" }}>
        <h1>Erreur technique</h1>
        <p>PI : <code>{paymentIntentId}</code></p>
        <p>Erreur : <code>{error instanceof Error ? error.message : String(error)}</code></p>
        <p>Contactez support@cartoonova.com avec ce numéro.</p>
        <a href="/">Retour à l&apos;accueil</a>
      </div>
    );
  }
}
