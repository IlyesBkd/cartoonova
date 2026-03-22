import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Authorize the upload — you can add auth checks here
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif",
          ],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10 MB per file
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("[Blob] Upload completed:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/upload] Error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
