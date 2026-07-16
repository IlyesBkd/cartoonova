import { NextRequest, NextResponse } from "next/server";
import { syncSupportInbox } from "@/lib/imapSync";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const result = await syncSupportInbox();
    console.log("[CRON sync-support-inbox]", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[CRON sync-support-inbox] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
