import { NextRequest, NextResponse } from "next/server";
import { recordPosterConfirmationResponse } from "@/lib/db";

async function sendDiscordNotification(order: {
  id: string;
  customer_email: string;
  status: "confirmed" | "changes_requested";
}) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    const isConfirmed = order.status === "confirmed";
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: isConfirmed
              ? "✅ Client a confirmé son poster !"
              : "✏️ Client demande une modification",
            color: isConfirmed ? 5763719 : 15844367,
            fields: [
              { name: "📦 Numéro", value: order.id.slice(0, 8), inline: true },
              { name: "📧 Email", value: order.customer_email, inline: true },
            ],
            footer: { text: "Cartoonova • Confirmation poster" },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (error) {
    console.error("[CONFIRM-POSTER] Erreur notification Discord:", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, action }: { token: string; action: "confirm" | "changes" } = await req.json();

    if (!token || (action !== "confirm" && action !== "changes")) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    const status = action === "confirm" ? "confirmed" : "changes_requested";
    const order = await recordPosterConfirmationResponse(token, status);

    if (!order) {
      return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });
    }

    await sendDiscordNotification({
      id: order.id,
      customer_email: order.customer_email,
      status,
    });

    return NextResponse.json({ ok: true, status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/orders/confirm-poster] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
