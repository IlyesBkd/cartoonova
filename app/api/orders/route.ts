import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(orders);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/orders] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const password = req.headers.get("x-admin-password");
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
    const { id, status }: { id: string; status: string } = await req.json();
    await prisma.order.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[PATCH /api/orders] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
