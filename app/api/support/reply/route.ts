import { NextResponse } from "next/server";
import { refuserSiPasAdmin } from "@/lib/adminAuth";

/** L'ancien envoi direct ne garantit ni aperçu approuvé ni protection contre les doublons. */
export async function POST(request: Request) {
  const refusal = await refuserSiPasAdmin(request);
  if (refusal) return refusal;
  return NextResponse.json(
    { error: "Envoi direct désactivé : préparez et approuvez la réponse avant l'envoi." },
    { status: 410, headers: { "Cache-Control": "private, no-store" } },
  );
}
