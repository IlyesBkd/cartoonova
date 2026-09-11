import { NextRequest, NextResponse } from "next/server";
import { traduireEnFrancais } from "@/lib/traduction";
import { refuserSiPasAdmin } from "@/lib/adminAuth";

/* L'admin demande par lots ce qu'il affiche. Plafonner le lot borne le temps
   d'une requete : trente traductions manquantes, a cinq en parallele, tiennent
   largement dans la duree d'une fonction. */
const LOT_MAX = 30;

/** Traduit en francais les textes clients affiches dans l'admin. */
export async function POST(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const { textes }: { textes?: unknown } = await req.json();

    if (!Array.isArray(textes) || textes.length === 0 || !textes.every((t) => typeof t === "string")) {
      return NextResponse.json({ error: "`textes` doit être une liste de chaînes." }, { status: 400 });
    }
    if (textes.length > LOT_MAX) {
      return NextResponse.json({ error: `Au plus ${LOT_MAX} textes par requête.` }, { status: 400 });
    }

    const resultats = await traduireEnFrancais(textes as string[]);
    return NextResponse.json({ resultats });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/traductions] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
