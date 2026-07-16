import { NextRequest, NextResponse } from "next/server";
import { getSupportMessages, markSupportMessageRead } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

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
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

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
