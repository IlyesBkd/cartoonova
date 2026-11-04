import { NextRequest, NextResponse } from "next/server";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { approvePreparedSupportReply } from "@/lib/supportPreparedDelivery";

export async function POST(request: NextRequest) {
  const forbidden = await refuserSiPasAdmin(request);
  if (forbidden) return forbidden;
  try {
    const body = await request.json();
    if (body?.confirmed !== true || typeof body.id !== "string" || typeof body.approvalFingerprint !== "string") {
      return NextResponse.json({ error: "Confirmation explicite requise." }, { status: 400 });
    }
    await approvePreparedSupportReply(body.id, body.approvalFingerprint);
    return NextResponse.json({ approved: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Approbation impossible : préparez un nouvel aperçu." }, { status: 409 });
  }
}
