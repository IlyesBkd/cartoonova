import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/db";
import { parseOrderTrackingToken } from "@/lib/emailToken";
import { downloadFinalImage } from "@/lib/finalImage";

/* Le portrait final, servi depuis le domaine du site.

   La page /bonus fabrique le fond d'ecran et l'avatar dans un canvas, puis les
   exporte en PNG. Un canvas qui a dessine une image d'un autre domaine est
   « contamine » : `toBlob` echoue, sauf si le stockage renvoie les bons
   en-tetes CORS — ce qu'on ne controle pas. Passer par ici supprime la
   question.

   Meme jeton que /suivi : sans signature valide, rien n'est servi. */

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const orderId = parseOrderTrackingToken(decodeURIComponent(token));
  const order = orderId ? await getOrderById(orderId) : null;

  if (!order?.final_image_url || !order.final_image_sent_at) {
    return NextResponse.json({ error: "indisponible" }, { status: 404 });
  }

  try {
    const image = await downloadFinalImage(order.final_image_url);
    return new Response(Buffer.from(image.bytes), {
      headers: {
        "content-type": image.contentType,
        "x-content-type-options": "nosniff",
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "stockage" }, { status: 502 });
  }
}
