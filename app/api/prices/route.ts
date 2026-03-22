import { NextRequest, NextResponse } from "next/server";
import { getPrices, updatePrices } from "@/lib/db";
import type { Prices } from "@/lib/types";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prices = await getPrices();
    return NextResponse.json(prices);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/prices] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const password = req.headers.get("x-admin-password");
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
    const prices: Prices = await req.json();
    await updatePrices(prices);

    // Purge Next.js cache so new prices appear immediately
    revalidatePath("/");
    revalidatePath("/product");
    revalidatePath("/[locale]");
    revalidatePath("/[locale]/product");

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[PUT /api/prices] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
