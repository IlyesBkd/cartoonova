import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  try {
    console.log("Upload request received");
    
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    console.log("Files received:", files.length);

    if (!files.length) {
      return NextResponse.json({ error: "Aucun fichier." }, { status: 400 });
    }

    const urls: string[] = [];

    // Check if BLOB_READ_WRITE_TOKEN is set
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    
    if (!blobToken || blobToken === "vercel_blob_rw_6piUL4swibJ2CeN2_QMqhW70jRvKyQV8IgbF0ztPRyisp5D") {
      console.log("Using fallback - invalid or missing BLOB token");
      
      // Fallback: return fake URLs for testing
      for (const file of files) {
        // Create a fake URL for testing
        const fakeUrl = `https://picsum.photos/seed/${Date.now()}-${file.name}/200/200.jpg`;
        urls.push(fakeUrl);
        console.log("Fake URL generated:", fakeUrl);
      }
      
      return NextResponse.json({ 
        urls,
        warning: "Mode test - URLs factices générées"
      });
    }

    // Real Vercel Blob upload
    for (const file of files) {
      console.log("Uploading file:", file.name);
      
      const blob = await put(`orders/${Date.now()}-${file.name}`, file, {
        access: "public",
      });
      
      console.log("File uploaded:", blob.url);
      urls.push(blob.url);
    }

    return NextResponse.json({ urls });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ 
      error: "Erreur upload.", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
