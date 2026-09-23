import { NextRequest, NextResponse } from "next/server";
import { parsePhotoUrls, photosInvalides } from "@/lib/orderPhotos";
import { libelleSupportCourt } from "@/lib/supportCommande";
import { enregistrerRetouche, nombreRetouches } from "@/lib/retouches";
import { recordPosterConfirmationResponse } from "@/lib/db";

async function sendDiscordNotification(order: {
  id: string;
  customer_email: string;
  status: "confirmed" | "changes_requested";
  note?: string | null;
  photos?: string[] | null;
  rang?: number;
  support?: string;
  modified?: boolean;
}) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    const isConfirmed = order.status === "confirmed";
    const fields: { name: string; value: string; inline: boolean }[] = [
      { name: "📦 Numéro", value: order.id.slice(0, 8), inline: true },
      { name: "📧 Email", value: order.customer_email, inline: true },
    ];
    /* Le support reel, pas « poster » : vous en vendez trois, et c'est la
       premiere chose a saisir chez l'imprimeur. */
    if (order.support) {
      fields.push({ name: "🖼️ Support", value: order.support, inline: true });
    }
    if (!isConfirmed && order.note) {
      fields.push({
        name: `✏️ Modification demandée${order.rang && order.rang > 1 ? ` — demande n°${order.rang}` : ""}`,
        value: order.note.slice(0, 1000),
        inline: false,
      });
    }
    /* Les photos dans l'alerte elle-meme : une demande de retouche visuelle
       sans les images oblige a ouvrir le tableau de bord pour comprendre. */
    if (!isConfirmed && order.photos?.length) {
      fields.push({
        name: `📎 ${order.photos.length} photo(s) jointe(s)`,
        value: order.photos.map((u, i) => `[photo ${i + 1}](${u})`).join(" · ").slice(0, 1000),
        inline: false,
      });
    }

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: isConfirmed
              ? order.modified
                ? "🔄 Client a modifié sa réponse : portrait confirmé"
                : "✅ Client a confirmé son portrait !"
              : order.modified
                ? "🔄 Client a modifié sa réponse : modification demandée"
                : "✏️ Client demande une modification",
            color: isConfirmed ? 5763719 : 15844367,
            fields,
            footer: { text: "Cartoonova • Validation avant impression" },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (error) {
    console.error("[CONFIRM-POSTER] Erreur notification Discord:", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, action, note, photos, previousRespondedAt }: {
      token: string;
      action: "confirm" | "changes";
      note?: string;
      photos?: unknown;
      previousRespondedAt?: string | null;
    } = await req.json();

    if (!token || (action !== "confirm" && action !== "changes")) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }
    if (
      previousRespondedAt != null &&
      (typeof previousRespondedAt !== "string" || Number.isNaN(Date.parse(previousRespondedAt)))
    ) {
      return NextResponse.json({ error: "Date de réponse invalide." }, { status: 400 });
    }

    const status = action === "confirm" ? "confirmed" : "changes_requested";

    /* Meme validation de forme que les photos de commande : seules des URL
       https du stockage, dedoublonnees et plafonnees. Le corps de la requete
       vient du navigateur, on ne recopie pas ce qu'il envoie. */
    const jointes = action === "changes" ? parsePhotoUrls(photos) : [];
    if (photosInvalides(jointes)) {
      return NextResponse.json({ error: jointes.error }, { status: 400 });
    }
    const result = await recordPosterConfirmationResponse(
      token,
      status,
      action === "changes" ? note : null,
      jointes,
      previousRespondedAt
    );

    if (!result.order) {
      return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });
    }

    if (!result.changed) {
      if (result.conflict) {
        return NextResponse.json(
          {
            error: "response_conflict",
            status: result.order.poster_confirmation_status,
            respondedAt: result.order.poster_confirmation_responded_at,
          },
          { status: 409 }
        );
      }
      return NextResponse.json({
        ok: true,
        changed: false,
        status: result.order.poster_confirmation_status,
        respondedAt: result.order.poster_confirmation_responded_at,
      });
    }

    const order = result.order;

    /* L'historique, en plus des colonnes. Une retouche est une conversation :
       « We are almost there. One other edit. » suppose une demande precedente,
       que l'ecrasement faisait disparaitre. */
    let rang = 0;
    if (action === "changes") {
      await enregistrerRetouche(order.id, note ?? null, jointes);
      rang = await nombreRetouches(order.id);
    }

    await sendDiscordNotification({
      id: order.id,
      customer_email: order.customer_email,
      status,
      note: order.poster_confirmation_note,
      photos: jointes,
      rang,
      support: libelleSupportCourt(
        typeof order.options === "string" ? JSON.parse(order.options) : order.options
      ),
      modified: Boolean(previousRespondedAt),
    });

    return NextResponse.json({
      ok: true,
      changed: true,
      status,
      respondedAt: order.poster_confirmation_responded_at,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/orders/confirm-poster] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
