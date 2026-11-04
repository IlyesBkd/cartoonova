import { diagnosticJournal } from "@/lib/confidentialiteMesure";
import { NextRequest, NextResponse } from "next/server";
import { getSupportMessageById, getSupportMessages, markSupportMessageRead, withFreshDatabaseClient } from "@/lib/db";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { enrichSupportReplies } from "@/lib/supportReplyHistory";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const refus = await refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const idParam = new URL(req.url).searchParams.get("id");
    if (idParam !== null) {
      const id = Number(idParam);
      if (!/^[1-9]\d*$/.test(idParam) || !Number.isSafeInteger(id)) {
        return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
      }
      const message = await withFreshDatabaseClient(async db => {
        const found = await getSupportMessageById(id, db);
        if (!found) return null;
        return { ...found, replies: await enrichSupportReplies(db, found.replies) };
      });
      if (!message) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
      return NextResponse.json(message, { headers: { "Cache-Control": "private, no-store" } });
    }
    const messages = await withFreshDatabaseClient(async db => {
      const list = await getSupportMessages(db);
      const enriched = await enrichSupportReplies(db, list.flatMap(message => message.replies));
      const byId = new Map(enriched.map(reply => [reply.id, reply]));
      return list.map(message => ({ ...message, replies: message.replies.map(reply => byId.get(reply.id) ?? reply) }));
    });
    return NextResponse.json(messages);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/support/messages] Error:", diagnosticJournal(error));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const refus = await refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const { id }: { id: number } = await req.json();
    await markSupportMessageRead(id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[PATCH /api/support/messages] Error:", diagnosticJournal(error));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
