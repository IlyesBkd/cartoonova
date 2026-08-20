import { NextRequest, NextResponse } from "next/server";
import { getOrders, updateOrderStatus } from "@/lib/db";
import { refuserSiPasAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const orders = await getOrders();
    return NextResponse.json(orders);
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
