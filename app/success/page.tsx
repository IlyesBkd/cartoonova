import { redirect } from "next/navigation";
import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";
import SuccessClient from "@/app/success/SuccessClient";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

const resend = new Resend(process.env.RESEND_API_KEY!);

async function sendOrderConfirmation(order: any) {
  try {
    await resend.emails.send({
      from: "Cartoonova <contact@cartoonova.fr>",
      to: [order.customer_email],
      subject: "🎉 Commande confirmée - Vos artistes commencent !",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef3c7; padding: 20px; border: 4px solid #000;">
          <div style="background: white; border: 3px solid #000; padding: 30px; margin: 20px 0; box-shadow: 8px 8px 0px rgba(0,0,0,1);">
            <h1 style="font-size: 32px; font-weight: 900; text-align: center; margin: 0 0 20px 0; color: #000; text-transform: uppercase;">
              🎉 BOOM ! C'est dans la boîte !
            </h1>
            <p style="font-size: 18px; font-weight: bold; text-align: center; margin: 0 0 30px 0; color: #000;">
              Votre commande #${order.id} est confirmée
            </p>
            
            <div style="background: #fef3c7; border: 2px solid #000; padding: 20px; margin: 20px 0;">
              <h2 style="font-size: 20px; font-weight: 900; margin: 0 0 15px 0; color: #000;">Récapitulatif de votre commande</h2>
              <ul style="font-size: 16px; font-weight: bold; margin: 0; padding: 0 0 0 20px; color: #000;">
                <li>Format: ${order.format === 'portrait' ? 'Portrait' : 'Full Body'}</li>
                <li>Personnes: ${order.people}</li>
                ${order.animals > 0 ? `<li>Animaux: ${order.animals}</li>` : ''}
                <li>Option: ${order.print_option}</li>
                <li>Total: ${order.total_price} ${order.currency}</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 10px 0;">
                🎨 Nos artistes se mettent au travail !
              </p>
              <p style="font-size: 16px; color: #000; margin: 0;">
                Vous recevrez votre caricature dans 3-5 jours ouvrables.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; font-size: 14px; color: #000; font-weight: bold;">
            <p>Merci pour votre confiance ! 🎨</p>
            <p>L'équipe Cartoonova</p>
          </div>
        </div>
      `,
    });
    
    console.log("✅ Email de confirmation envoyé à", order.customer_email);
  } catch (error) {
    console.error("❌ Erreur envoi email:", error);
  }
}

async function sendDiscordNotification(order: any) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: "🎉 NOUVELLE COMMANDE REÇUE !",
          color: 16776960, // Jaune
          fields: [
            { name: "📦 Numéro", value: order.id, inline: true },
            { name: "📧 Email", value: order.customer_email, inline: true },
            { name: "🎨 Format", value: order.format, inline: true },
            { name: "👥 Personnes", value: order.animals > 0 ? `${order.people} + ${order.animals} animaux` : order.people.toString(), inline: true },
            { name: "🖼️ Option", value: order.print_option, inline: true },
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

async function getOrderData(paymentIntentId: string) {
  const sql = neon(process.env.DATABASE_URL!);
  
  const orders = await sql`
    SELECT * FROM orders WHERE stripe_payment_id = ${paymentIntentId}
  `;
  
  return orders[0] || null;
}

async function updateOrderStatus(orderId: string, status: string) {
  const sql = neon(process.env.DATABASE_URL!);
  
  await sql`
    UPDATE orders SET status = ${status} WHERE id = ${orderId}
  `;
}

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { payment_intent?: string };
}) {
  const paymentIntentId = searchParams.payment_intent;

  if (!paymentIntentId) {
    redirect("/");
  }

  try {
    // 1. Vérifier le statut réel du paiement via Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== "succeeded") {
      console.log("❌ Paiement non réussi:", paymentIntent.status);
      redirect("/");
    }

    // 2. Chercher la commande PENDING correspondante
    const order = await getOrderData(paymentIntentId);
    
    if (!order) {
      console.error("❌ Commande non trouvée pour PaymentIntent:", paymentIntentId);
      redirect("/");
    }

    // 3. Si déjà paid, ne rien refaire
    if (order.status === "PAID") {
      console.log("ℹ️ Commande déjà marquée comme paid");
      return <SuccessClient order={order} />;
    }

    // 4. Mettre à jour le statut à PAID
    await updateOrderStatus(order.id, "PAID");
    console.log(`✅ Commande ${order.id} marquée comme PAID`);

    // 5. Envoyer les notifications (une seule fois)
    await Promise.all([
      sendOrderConfirmation(order),
      sendDiscordNotification(order),
    ]);

    return <SuccessClient order={order} />;
  } catch (error) {
    console.error("❌ Erreur page succès:", error);
    redirect("/");
  }
}
