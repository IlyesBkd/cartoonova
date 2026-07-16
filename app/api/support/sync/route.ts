import { NextRequest, NextResponse } from "next/server";
import { syncSupportInbox } from "@/lib/imapSync";

export async function POST(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const result = await syncSupportInbox();
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/support/sync] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
