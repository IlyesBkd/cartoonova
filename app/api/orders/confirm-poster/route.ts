import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { parsePhotoUrls, photosInvalides } from "@/lib/orderPhotos";
import { libelleSupportCourt } from "@/lib/supportCommande";
import { enregistrerRetouche, nombreRetouches } from "@/lib/retouches";
import { recordPosterConfirmationResponse, setOrderLastOutboundMessageId, type DbOrder } from "@/lib/db";
import { langueCommande } from "@/lib/email-i18n";
import { accuseRetoucheEmail } from "@/lib/i18n/serveur";
import { EXPEDITEUR, SUPPORT_EMAIL } from "@/lib/expediteur";

const resend = new Resend(process.env.RESEND_API_KEY!);

function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Accuse de reception d'une demande de retouche.
 *
 * Un client s'est plaint de n'avoir « aucune reponse » : sa demande etait
 * enregistree et l'equipe alertee, mais lui ne recevait rien. Cet e-mail lui
 * dit que c'est arrive et quand il aura des nouvelles.
 *
 * Ne leve jamais : la demande est deja enregistree, et un echec de Resend ne
 * doit pas faire croire au client qu'elle est perdue (il la renverrait).
 */
async function envoyerAccuseRetouche(order: DbOrder, note: string | null): Promise<void> {
  try {
    if (!order.customer_email) return;
    const t = accuseRetoucheEmail[langueCommande(order)];
    const ref = order.id.slice(0, 8);
    const nom = order.customer_name ? echapper(order.customer_name) : null;
    /* La demande recopiee : le client voit ce qui a ete compris, et peut
       repondre a cet e-mail pour la completer sans tout reecrire. */
    const blocNote = note?.trim()
      ? `
          <div style="background: #fef3c7; border: 3px solid #000; border-radius: 12px; padding: 16px 20px; margin: 0 0 20px 0;">
            <p style="font-size: 14px; font-weight: 900; margin: 0 0 8px 0; color: #000;">${t.yourRequest}</p>
            <p style="font-size: 15px; line-height: 1.5; margin: 0; color: #000; white-space: pre-wrap;">${echapper(note.trim().slice(0, 2000))}</p>
          </div>`
      : "";

    const result = await resend.emails.send({
      from: EXPEDITEUR,
      to: [order.customer_email],
      replyTo: SUPPORT_EMAIL,
      subject: t.subject(ref),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef3c7; padding: 20px; border: 4px solid #000;">
          <div style="background: white; border: 3px solid #000; padding: 30px; margin: 20px 0; box-shadow: 8px 8px 0px rgba(0,0,0,1);">
            <h1 style="font-size: 28px; font-weight: 900; text-align: center; margin: 0 0 20px 0; color: #000; text-transform: uppercase;">
              ${t.title}
            </h1>
            <p style="font-size: 16px; margin: 0 0 16px 0; color: #000;">${t.greeting(nom)}</p>
            <p style="font-size: 16px; line-height: 1.55; margin: 0 0 12px 0; color: #000;">${t.body}</p>
            <p style="font-size: 16px; line-height: 1.55; margin: 0 0 20px 0; color: #000; font-weight: bold;">${t.delay}</p>
            ${blocNote}
            <p style="font-size: 14px; line-height: 1.55; margin: 0; color: #555;">${t.reply}</p>
          </div>
          <div style="text-align: center; font-size: 14px; color: #000; font-weight: bold;">
            <p>${t.thanks}</p>
            <p>${t.team}</p>
          </div>
        </div>
      `,
    });

    if (result.error) {
      console.error("[CONFIRM-POSTER] Accusé de retouche refusé par Resend:", result.error.message);
      return;
    }
    /* Meme raison que pour l'image finale : la reponse du client a cet e-mail
       doit se rattacher a sa commande dans la boite support. */
    if (result.data?.id) {
      await setOrderLastOutboundMessageId(order.id, result.data.id);
    }
  } catch (error) {
    console.error("[CONFIRM-POSTER] Accusé de retouche impossible:", error);
  }
}

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
      await envoyerAccuseRetouche(order, order.poster_confirmation_note);
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
