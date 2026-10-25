import { NextRequest, NextResponse } from "next/server";
import { createUploadContext, UploadError } from "@/lib/uploadPolicy";
import { CHECKOUT_PHOTO_COOKIE } from "@/lib/checkoutPhotoSession";
export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return NextResponse.json({ error: "Contexte invalide." }, { status: 400 });
    }
    const { photoSession, ...context } = await createUploadContext(req, input);
    const response = NextResponse.json(context, { headers: { "Cache-Control": "no-store" } });
    if (photoSession) response.cookies.set(CHECKOUT_PHOTO_COOKIE, photoSession, {
      httpOnly: true, secure: true, sameSite: "strict", path: "/",
    });
    return response;
  } catch (error) {
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    console.error("[upload/context] Autorisation indisponible.");
    return NextResponse.json({ error: "Dépôt indisponible." }, { status: 503 });
  }
}
