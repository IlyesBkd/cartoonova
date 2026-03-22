"use server";

import { Resend } from "resend";
import { insertOrder } from "@/lib/db";
import type { Order } from "@/lib/types";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function processOrder(orderData: any) {
  // La logique est maintenant gérée dans /success/page.tsx
  // Cette fonction est conservée pour compatibilité mais ne fait rien
  console.log("processOrder appelé - logique déplacée vers /success");
  return { success: true };
}

// ─── Email HTML Template ─────────────────────────────────────────────
function buildEmailHTML(order: Order): string {
  const isPhysical = order.printOption !== "Digital";
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#fefce8;font-family:'Poppins',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    
    <!-- Header -->
    <div style="background:#facc15;border:4px solid #000;border-radius:16px;padding:24px;text-align:center;box-shadow:6px 6px 0 0 #000;">
      <h1 style="margin:0;font-size:28px;color:#000;font-weight:900;text-transform:uppercase;">🎨 Merci pour votre commande !</h1>
      <p style="margin:8px 0 0;color:#000;opacity:0.6;font-weight:700;">Commande ${order.id}</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;border:4px solid #000;border-radius:16px;margin-top:16px;padding:24px;box-shadow:6px 6px 0 0 #000;">
      
      <p style="font-size:16px;font-weight:700;color:#000;margin:0 0 16px;">
        Bonjour${order.firstName ? ` ${order.firstName}` : ""} ! 👋
      </p>
      <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 20px;">
        Votre commande a bien été enregistrée. Nos artistes se mettent au travail immédiatement pour créer votre chef-d'œuvre cartoon !
      </p>

      <!-- Order details -->
      <div style="background:#fefce8;border:2px solid #000;border-radius:12px;padding:16px;margin-bottom:20px;">
        <h3 style="margin:0 0 12px;font-size:14px;font-weight:900;text-transform:uppercase;color:#000;">📋 Récapitulatif</h3>
        <table style="width:100%;font-size:13px;color:#333;" cellpadding="4">
          <tr><td style="font-weight:800;">Format</td><td style="text-align:right;">${order.format === "fullbody" ? "Corps Entier" : "Portrait"}</td></tr>
          <tr><td style="font-weight:800;">Personnes</td><td style="text-align:right;">${order.people}</td></tr>
          <tr><td style="font-weight:800;">Animaux</td><td style="text-align:right;">${order.animals}</td></tr>
          <tr><td style="font-weight:800;">Arrière-plan</td><td style="text-align:right;">${order.background}</td></tr>
          <tr><td style="font-weight:800;">Impression</td><td style="text-align:right;">${order.printOption}</td></tr>
          <tr><td style="font-weight:800;">Photos envoyées</td><td style="text-align:right;">${order.photoUrls.length} fichier(s)</td></tr>
        </table>
        <div style="border-top:2px solid #000;margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:900;font-size:16px;color:#000;">TOTAL</span>
          <span style="font-weight:900;font-size:24px;color:#000;">${order.total} €</span>
        </div>
      </div>

      ${
        isPhysical
          ? `
      <div style="background:#dbeafe;border:2px solid #000;border-radius:12px;padding:16px;margin-bottom:20px;">
        <h3 style="margin:0 0 8px;font-size:14px;font-weight:900;text-transform:uppercase;color:#000;">📦 Adresse de livraison</h3>
        <p style="margin:0;font-size:13px;color:#333;line-height:1.6;">
          ${order.firstName} ${order.lastName}<br/>
          ${order.address}<br/>
          ${order.postalCode} ${order.city}<br/>
          ${order.country}<br/>
          📞 ${order.phone}
        </p>
      </div>`
          : ""
      }

      <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 8px;">
        📩 Vous recevrez un email lorsque votre caricature sera prête${isPhysical ? " et un numéro de suivi pour la livraison" : ""}.
      </p>
      <p style="font-size:14px;color:#333;line-height:1.6;margin:0;">
        Une question ? Répondez à cet email ou contactez-nous à <a href="mailto:support@cartoonova.com" style="color:#000;font-weight:800;">support@cartoonova.com</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:16px;padding:16px;">
      <p style="font-size:12px;color:#666;font-weight:600;">© ${new Date().getFullYear()} Cartoonova — Tous droits réservés</p>
    </div>
  </div>
</body>
</html>`;
}
