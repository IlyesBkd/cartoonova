import { NextResponse } from "next/server";
import { loginAdmin, logoutAdmin, requireAdmin } from "@/lib/adminAuth";
import { COOKIE_INTERNE } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const DELETE = logoutAdmin;
export async function POST(req: Request) {
  const response = await loginAdmin(req);
  if (response.status === 204) {
    // Analytics exclusion only; never an authentication credential.
    response.cookies.set(COOKIE_INTERNE, "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  }
  return response;
}
export async function GET(req: Request) {
  return await requireAdmin(req) ?? new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
