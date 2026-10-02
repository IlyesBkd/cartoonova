import { NextRequest, NextResponse } from "next/server";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { COOKIE_INTERNE } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;
  const reponse = new NextResponse(null, { status: 204 });
  /* Marque ce navigateur comme interne : la mesure PostHog l'ignore ensuite
     (voir `filtrerAvantEnvoi`). Sans cela, chaque passage de l'admin sur la
     boutique gonflait les vues et les entonnoirs. Lisible par le script (pas
     HttpOnly) : c'est le navigateur qui decide de ne pas envoyer. */
  reponse.cookies.set(COOKIE_INTERNE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return reponse;
}
