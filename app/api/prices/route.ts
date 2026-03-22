import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Prices } from "@/lib/types";
import { DEFAULT_PRICES } from "@/lib/types";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

export async function GET() {
  try {
    let row = await prisma.price.findUnique({ where: { id: SINGLETON_ID } });
    if (!row) {
      row = await prisma.price.create({ data: { id: SINGLETON_ID, ...DEFAULT_PRICES } });
    }
    const prices: Prices = {
      base: row.base,
      fullbodyExtra: row.fullbodyExtra,
      extraPerson: row.extraPerson,
      extraAnimal: row.extraAnimal,
      digital: row.digital,
      canvas: row.canvas,
      poster: row.poster,
      posterSimple: row.posterSimple,
    };
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
    await prisma.price.upsert({
      where: { id: SINGLETON_ID },
      update: prices,
      create: { id: SINGLETON_ID, ...prices },
    });

    // Purge Next.js cache so new prices appear immediately
    revalidatePath("/");
    revalidatePath("/simpson");
    revalidatePath("/[locale]");
    revalidatePath("/[locale]/simpson");

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[PUT /api/prices] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
