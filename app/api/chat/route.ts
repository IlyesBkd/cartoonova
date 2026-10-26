import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { emailValide } from "@/lib/email";
import { diagnosticJournal } from "@/lib/confidentialiteMesure";
import { cleDepuisRequete, limiteur } from "@/lib/rateLimit";

const tropDeMessages = limiteur(5, 10 * 60 * 1000);

export async function POST(req: NextRequest) {
  if (tropDeMessages(cleDepuisRequete(req))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  // Limiter les octets effectivement lus, sans faire confiance à Content-Length.
  const maxOctets = 32 * 1024;
  const lecteur = req.body?.getReader();
  let body: unknown;
  try {
    const morceaux: Uint8Array[] = [];
    let taille = 0;
    if (lecteur) {
      while (true) {
        const { done, value } = await lecteur.read();
        if (done) break;
        taille += value.byteLength;
        if (taille > maxOctets) {
          void lecteur.cancel().catch(() => {});
          return NextResponse.json({ error: "body_too_large" }, { status: 413 });
        }
        morceaux.push(value);
      }
    }
    const octets = new Uint8Array(taille);
    let offset = 0;
    for (const morceau of morceaux) { octets.set(morceau, offset); offset += morceau.byteLength; }
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(octets));
  } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";
  const key = typeof data.idempotencyKey === "string" ? data.idempotencyKey : "";
  if (!emailValide(email) || !message || message.length > 5000 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  let inserted: boolean;
  try {
    // L'unicité de message_id sérialise aussi les tentatives concurrentes.
    const rows = await sql`
      WITH message AS (
        INSERT INTO support_messages (message_id, from_email, subject, body_text, received_at, category)
        VALUES (${`chat-${key}`}, ${email}, '[Chat] Message client', ${message}, NOW(), 'customer')
        ON CONFLICT (message_id) DO UPDATE SET message_id = EXCLUDED.message_id
        WHERE support_messages.from_email = EXCLUDED.from_email AND support_messages.body_text = EXCLUDED.body_text
        RETURNING id, (xmax = 0) AS inserted
      ), notification AS (
        INSERT INTO chat_telegram_notifications (support_message_id)
        SELECT id FROM message WHERE inserted
        RETURNING id
      )
      SELECT inserted FROM message
    `;
    if (!rows.length) return NextResponse.json({ error: "idempotency_conflict" }, { status: 409 });
    inserted = rows[0].inserted;
  } catch (error) {
    console.error("[POST /api/chat]", diagnosticJournal(error));
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // Discord est un signal facultatif : sa panne ne remet pas en cause la sauvegarde.
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (webhook && inserted) {
    try {
      const response = await fetch(webhook, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [{ title: "💬 Nouveau message — Chat Cartoonova", color: 0xffc82c,
          fields: [{ name: "📧 Email", value: email, inline: true }, { name: "💬 Message", value: message.slice(0, 1024) }],
          footer: { text: "Cartoonova Chat Widget" } }] }),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) console.error("[POST /api/chat] Discord indisponible", response.status);
    } catch (error) { console.error("[POST /api/chat] Discord indisponible", diagnosticJournal(error)); }
  }
  return NextResponse.json({ ok: true });
}
