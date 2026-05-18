import { NextRequest, NextResponse } from "next/server";
import { getAllPrices, updateAllPrices } from "@/lib/db";
import { currencies, type Currency } from "@/lib/currency";
import type { PriceSet, PricesByCurrency } from "@/lib/types";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const PRICE_FIELDS: (keyof PriceSet)[] = [
  "base", "fullbodyExtra", "extraPerson", "extraAnimal",
  "digital", "canvas", "poster", "posterSimple",
];

function checkAuth(req: NextRequest): NextResponse | null {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  return null;
}

function validatePayload(body: unknown): PricesByCurrency | string {
  if (!body || typeof body !== "object") return "Payload invalide.";
  const out = {} as PricesByCurrency;
  for (const c of currencies) {
    const set = (body as Record<string, unknown>)[c];
    if (!set || typeof set !== "object") return `Devise manquante : ${c}.`;
    const cleaned = {} as PriceSet;
    for (const f of PRICE_FIELDS) {
      const v = (set as Record<string, unknown>)[f];
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
        return `Valeur invalide pour ${c}.${f}.`;
      }
      cleaned[f] = v;
    }
    out[c as Currency] = cleaned;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const unauthorized = checkAuth(req);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json(await getAllPrices());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/prices/all] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const unauthorized = checkAuth(req);
  if (unauthorized) return unauthorized;
  try {
    const body = await req.json();
    const validated = validatePayload(body);
    if (typeof validated === "string") {
      return NextResponse.json({ error: validated }, { status: 400 });
    }
    await updateAllPrices(validated);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[PUT /api/prices/all] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
