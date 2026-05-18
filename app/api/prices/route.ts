import { NextRequest, NextResponse } from "next/server";
import { getPricesForCurrency } from "@/lib/db";
import { currencies, type Currency } from "@/lib/currency";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const param = req.nextUrl.searchParams.get("currency")?.toUpperCase();
    const currency: Currency = (param && currencies.includes(param as Currency) ? param : "EUR") as Currency;
    const prices = await getPricesForCurrency(currency);
    return NextResponse.json(prices);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/prices] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
