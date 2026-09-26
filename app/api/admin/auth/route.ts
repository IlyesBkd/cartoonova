import { NextRequest, NextResponse } from "next/server";
import { refuserSiPasAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;
  return new NextResponse(null, { status: 204 });
}
