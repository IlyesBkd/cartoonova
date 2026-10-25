import { NextRequest, NextResponse } from "next/server";
import { createUploadContext, UploadError } from "@/lib/uploadPolicy";
export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return NextResponse.json({ error: "Contexte invalide." }, { status: 400 });
    }
    return NextResponse.json(await createUploadContext(req, input), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    console.error("[upload/context] Autorisation indisponible.");
    return NextResponse.json({ error: "Dépôt indisponible." }, { status: 503 });
  }
}
