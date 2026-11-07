import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isSyntheticHeaders, SYNTHETIC_PAID, SYNTHETIC_PENDING } from "@/lib/syntheticOrder";

/**
 * Permet au controle quotidien de relire, puis de supprimer, la commande
 * synthetique qu'il vient de passer. Repond 404 pour toute commande qui n'est
 * pas synthetique : le secret ne permet ni de lire ni d'effacer une vraie
 * commande.
 */

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function introuvable() {
  return NextResponse.json({ error: "Introuvable." }, { status: 404 });
}

export async function GET(req: NextRequest) {
  if (!isSyntheticHeaders(req.headers)) return introuvable();
  const orderId = req.nextUrl.searchParams.get("orderId") ?? "";
  if (!UUID.test(orderId)) return introuvable();
  const rows = await sql`
    SELECT status, payment_intent_id, paid_at FROM orders
    WHERE id = ${orderId}::uuid AND status IN (${SYNTHETIC_PENDING}, ${SYNTHETIC_PAID})
  `;
  if (!rows[0]) return introuvable();
  return NextResponse.json({
    status: rows[0].status,
    paymentIntentId: rows[0].payment_intent_id,
    paidAt: rows[0].paid_at,
  });
}

export async function DELETE(req: NextRequest) {
  if (!isSyntheticHeaders(req.headers)) return introuvable();
  const orderId = req.nextUrl.searchParams.get("orderId") ?? "";
  if (!UUID.test(orderId)) return introuvable();
  const rows = await sql`
    DELETE FROM orders
    WHERE id = ${orderId}::uuid AND status IN (${SYNTHETIC_PENDING}, ${SYNTHETIC_PAID})
    RETURNING status
  `;
  if (!rows[0]) return introuvable();
  return NextResponse.json({ deleted: true, status: rows[0].status });
}
