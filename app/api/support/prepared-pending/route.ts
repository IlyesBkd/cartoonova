import { NextResponse } from "next/server";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { sql } from "@/lib/db";
import { readPreparedSupportReply } from "@/lib/supportPreparedReplies";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const refusal = await refuserSiPasAdmin(request);
  if (refusal) return refusal;
  try {
    const rows = await sql`SELECT id FROM support_prepared_replies WHERE status IN ('sending','uncertain') OR (status='sent' AND reply_id IS NULL) ORDER BY created_at`;
    const drafts = await Promise.all(rows.map(row => readPreparedSupportReply(String(row.id))));
    if (drafts.some(draft => !draft)) throw new Error("Brouillon manquant.");
    return NextResponse.json(drafts.map(draft => ({ ...draft, attachments: draft!.attachments.map(file => ({ name: file.name, contentType: file.contentType, size: file.bytes.length })) })), { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Impossible de vérifier les envois en attente." }, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
}
