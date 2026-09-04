import { NextRequest, NextResponse } from "next/server";
import { getOrders, updateOrderStatus, enregistrerCoutCommande } from "@/lib/db";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { retouchesParCommande } from "@/lib/retouches";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const orders = await getOrders();

    /* L'historique des retouches, joint a chaque commande. Une seule requete
       pour toutes plutot qu'une par fiche : le tableau de bord les affiche au
       clic, et un aller-retour par ouverture serait du gaspillage. */
    const parCommande = await retouchesParCommande();
    return NextResponse.json(
      orders.map((o) => ({ ...o, retouches: parCommande.get(o.id) ?? [] }))
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/orders] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;
    const { id, status, cout, coutNote }: {
      id: string;
      status?: string;
      cout?: number | string | null;
      coutNote?: string | null;
    } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Commande manquante." }, { status: 400 });
    }

    if (status) await updateOrderStatus(id, status);

    /* `undefined` = le champ n'est pas dans la requete, on n'y touche pas.
       `null` ou chaine vide = l'utilisateur efface la saisie. Confondre les
       deux ferait disparaitre un cout a chaque changement de statut. */
    if (cout !== undefined || coutNote !== undefined) {
      const valeur =
        cout === null || cout === "" || cout === undefined
          ? null
          : Number(String(cout).replace(",", "."));
      if (valeur !== null && (!Number.isFinite(valeur) || valeur < 0)) {
        return NextResponse.json({ error: "Coût invalide." }, { status: 400 });
      }
      const note = typeof coutNote === "string" ? coutNote.trim().slice(0, 200) || null : null;
      await enregistrerCoutCommande(id, valeur, note);
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[PATCH /api/orders] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
