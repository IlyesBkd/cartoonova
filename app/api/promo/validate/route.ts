import { NextRequest, NextResponse } from "next/server";
import { quoteOrder } from "@/lib/orderQuote";

export const dynamic = "force-dynamic";

/** Verification d'un code avant paiement, pour l'affichage. Ne consomme rien. */
export async function POST(req: NextRequest) {
  try {
    const { orderConfig, currency, promoCode } = await req.json();

    const result = await quoteOrder({ orderConfig, currency, promoCode });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { quote } = result;
    return NextResponse.json({
      valid: Boolean(quote.promoCode),
      reason: quote.promoRejected,
      subtotal: quote.subtotal,
      discount: quote.discount,
      total: quote.total,
      currency: quote.currency,
    });
  } catch (error) {
    console.error("[POST /api/promo/validate] Error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
