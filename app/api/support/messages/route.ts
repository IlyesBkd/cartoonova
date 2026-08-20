import { NextRequest, NextResponse } from "next/server";
import { getSupportMessages, markSupportMessageRead } from "@/lib/db";
import { refuserSiPasAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const messages = await getSupportMessages();
    return NextResponse.json(messages);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/support/messages] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const { id }: { id: number } = await req.json();
    await markSupportMessageRead(id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[PATCH /api/support/messages] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
