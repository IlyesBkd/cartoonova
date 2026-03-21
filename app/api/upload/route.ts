import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "Aucun fichier." }, { status: 400 });
    }

    const urls: string[] = [];

    for (const file of files) {
      const blob = await put(`orders/${Date.now()}-${file.name}`, file, {
        access: "public",
      });
      urls.push(blob.url);
    }

    return NextResponse.json({ urls });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Erreur upload." }, { status: 500 });
  }
}
