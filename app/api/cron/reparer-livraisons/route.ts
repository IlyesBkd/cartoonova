import { reparerLivraisonsBloquees } from "@/lib/livraisonsBloquees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Toutes les 10 min depuis le VPS (vps/executer.sh cron-reparer). Répare seulement sur preuve locale (historique e-mail). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Cron unavailable" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const r = await reparerLivraisonsBloquees();
    return Response.json({ reparees: r.reparees.length, datesCompletees: r.datesCompletees, restantes: r.restantes });
  } catch {
    console.error("[REPARER-LIVRAISONS] passage impossible.");
    return Response.json({ error: "Réparation indisponible" }, { status: 503 });
  }
}
