import { NextRequest, NextResponse } from "next/server";
import { getPrices, updatePrices } from "@/lib/db";
import type { Prices } from "@/lib/types";

export async function GET() {
  const prices = await getPrices();
  return NextResponse.json(prices);
}

export async function PUT(req: NextRequest) {
  try {
    const password = req.headers.get("x-admin-password");
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
    const prices: Prices = await req.json();
    await updatePrices(prices);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
