import { NextRequest, NextResponse } from "next/server";
import { getSupportOutbox } from "@/lib/db";
import { refuserSiPasAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/**
 * Tout ce qui est parti du support.
 *
 * L'onglet Support n'en a pas besoin — chaque message y porte deja ses
 * reponses. La fiche commande, si : un courrier qu'on a ouvert soi-meme n'est
 * accroche a aucun message recu, et resterait invisible la ou on vient
 * justement verifier si on a ecrit au client.
 */
export async function GET(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const sortants = await getSupportOutbox();
    return NextResponse.json(sortants);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/support/outbox] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
