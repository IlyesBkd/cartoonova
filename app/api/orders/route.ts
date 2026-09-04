import { NextRequest, NextResponse } from "next/server";
import { getOrders, updateOrderStatus } from "@/lib/db";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { retouchesParCommande } from "@/lib/retouches";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const orders = await getOrders();

    /* L'historique des retouches, joint a chaque commande. Une seule requete
       pour toutes plutot qu'une par fiche : le tableau de bord les affiche au
       clic, et un aller-retour par ouverture serait du gaspillage. */
    const parCommande = await retouchesParCommande();
    return NextResponse.json(
      orders.map((o) => ({ ...o, retouches: parCommande.get(o.id) ?? [] }))
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/orders] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;
    const { id, status }: { id: string; status: string } = await req.json();
    await updateOrderStatus(id, status);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[PATCH /api/orders] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
