import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { reserveUpload, UploadError } from "@/lib/uploadPolicy";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as HandleUploadBody;
    if (body?.type !== "blob.generate-client-token" && body?.type !== "blob.upload-completed") {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }
    if (body.type === "blob.generate-client-token" && !body.payload?.clientPayload) {
      return NextResponse.json({ error: "Contexte requis." }, { status: 403 });
    }
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: (pathname, context) => reserveUpload(req, pathname, context),
      // The SDK verifies the provider callback signature. No quota refund or
      // auth context is required for this callback; it cannot mint a token.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    console.error("[upload] Autorisation ou fournisseur indisponible.");
    return NextResponse.json({ error: "Dépôt indisponible." }, { status: 503 });
  }
}
