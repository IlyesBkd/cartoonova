import { NextRequest, NextResponse } from "next/server";
import { syncSupportInbox } from "@/lib/imapSync";
import { refuserSiPasAdmin } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const result = await syncSupportInbox();
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/support/sync] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
