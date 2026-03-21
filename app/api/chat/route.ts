import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, message } = await req.json();

    if (!email || !message) {
      return NextResponse.json({ error: "Email et message requis." }, { status: 400 });
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      console.error("DISCORD_WEBHOOK_URL is not set");
      return NextResponse.json({ error: "Configuration serveur manquante." }, { status: 500 });
    }

    const now = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "💬 Nouveau message — Chat Cartoonova",
            color: 0xffc82c,
            fields: [
              { name: "📧 Email", value: email, inline: true },
              { name: "🕐 Date", value: now, inline: true },
              { name: "💬 Message", value: message },
            ],
            footer: { text: "Cartoonova Chat Widget" },
          },
        ],
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Chat webhook error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
