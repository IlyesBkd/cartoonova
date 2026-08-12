import { NextRequest, NextResponse } from "next/server";
import { createPromoCode, listPromoCodes, setPromoActive, type PromoKind } from "@/lib/promoCodes";
import { currencies, type Currency } from "@/lib/currency";

export const dynamic = "force-dynamic";

function unauthorized(req: NextRequest): boolean {
  return req.headers.get("x-admin-password") !== process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (unauthorized(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  try {
    return NextResponse.json(await listPromoCodes());
  } catch (error) {
    console.error("[GET /api/promo] Error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (unauthorized(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const kind: PromoKind = body.kind === "amount" ? "amount" : "percent";
    const value = Number(body.value);

    if (!code) {
      return NextResponse.json({ error: "code_required" }, { status: 400 });
    }
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ error: "invalid_value" }, { status: 400 });
    }
    if (kind === "percent" && value > 100) {
      return NextResponse.json({ error: "invalid_percent" }, { status: 400 });
    }

    let currency: Currency | null = null;
    if (kind === "amount") {
      const raw = typeof body.currency === "string" ? body.currency.toUpperCase() : "";
      if (!(currencies as string[]).includes(raw)) {
        return NextResponse.json({ error: "currency_required" }, { status: 400 });
      }
      currency = raw as Currency;
    }

    await createPromoCode({
      code,
      kind,
      value,
      currency,
      minSubtotal: Number(body.minSubtotal) || 0,
      maxUses: body.maxUses === null || body.maxUses === undefined || body.maxUses === "" ? null : Number(body.maxUses),
      startsAt: body.startsAt || null,
      endsAt: body.endsAt || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/promo] Error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (unauthorized(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  try {
    const { code, active } = await req.json();
    if (typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ error: "code_required" }, { status: 400 });
    }
    await setPromoActive(code, Boolean(active));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/promo] Error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
