import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getOrderById, type OrderOptions } from "@/lib/db";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { optionsCommande, langueCommande } from "@/lib/email-i18n";
import { EXPEDITEUR, SUPPORT_EMAIL } from "@/lib/expediteur";
import { genererCarteVoeux } from "@/lib/extras/carteVoeux";
import { genererCalendrier } from "@/lib/extras/calendrier";
import { envoyerEmail } from "@/lib/envoiEmail";

/**
 * Carte de voeux et calendrier (options F-6/F-7) : genere les PDF a partir du
 * portrait final, les depose sur le stockage et les envoie au client.
 *
 * Declenche a la main depuis l'admin (bouton « Envoyer carte / calendrier »),
 * jamais automatiquement : le portrait doit d'abord etre valide et livre.
 * Relancer renvoie de nouveaux fichiers — utile si le portrait a ete retouche.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

/** `options` revient parfois en texte de la base selon le chemin de lecture. */
function lireOptions(brut: unknown): Partial<OrderOptions> {
  if (typeof brut === "string") {
    try {
      return JSON.parse(brut) as Partial<OrderOptions>;
    } catch {
      return {};
    }
  }
  return (brut as Partial<OrderOptions>) ?? {};
}

export async function POST(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const { orderId } = (await req.json()) as { orderId?: unknown };
    if (typeof orderId !== "string" || !orderId) {
      return NextResponse.json({ error: "orderId manquant." }, { status: 400 });
    }

    const order = await getOrderById(orderId);
    if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    if (!order.final_image_url) {
      return NextResponse.json({ error: "Pas encore de portrait final sur cette commande." }, { status: 400 });
    }

    const options = lireOptions(order.options);
    if (!options.carteVoeux && !options.calendrier) {
      return NextResponse.json({ error: "Cette commande n'a ni carte de voeux ni calendrier." }, { status: 400 });
    }

    const lang = langueCommande(order);
    const oc = optionsCommande[lang];
    const ref = order.id.slice(0, 8);

    /* L'image est telechargee une seule fois pour les deux documents. */
    const reponse = await fetch(order.final_image_url);
    if (!reponse.ok) {
      return NextResponse.json({ error: `Portrait injoignable (${reponse.status}).` }, { status: 502 });
    }
    const image = new Uint8Array(await reponse.arrayBuffer());

    const fichiers: { cle: "carteVoeux" | "calendrier"; libelle: string; url: string }[] = [];

    if (options.carteVoeux) {
      const pdf = await genererCarteVoeux(image, lang);
      const blob = await put(`extras/${ref}/carte-voeux-cartoonova.pdf`, Buffer.from(pdf), {
        access: "public",
        contentType: "application/pdf",
        addRandomSuffix: true,
      });
      fichiers.push({ cle: "carteVoeux", libelle: oc.extrasCarte, url: blob.url });
    }

    if (options.calendrier) {
      const pdf = await genererCalendrier(image, lang);
      const blob = await put(`extras/${ref}/calendrier-cartoonova.pdf`, Buffer.from(pdf), {
        access: "public",
        contentType: "application/pdf",
        addRandomSuffix: true,
      });
      fichiers.push({ cle: "calendrier", libelle: oc.extrasCalendrier, url: blob.url });
    }

    const boutons = fichiers
      .map(
        (f) => `
          <p style="margin: 14px 0;">
            <a href="${f.url}" style="display: inline-block; background: #000; color: #fff; font-weight: 900; text-transform: uppercase; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-size: 14px;">
              ${f.libelle}
            </a>
          </p>`
      )
      .join("");

    const envoi = await envoyerEmail({
      from: EXPEDITEUR,
      to: [order.customer_email],
      replyTo: SUPPORT_EMAIL,
      subject: oc.extrasSujet,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef3c7; padding: 20px; border: 4px solid #000;">
          <div style="background: white; border: 3px solid #000; padding: 30px; margin: 20px 0; box-shadow: 8px 8px 0px rgba(0,0,0,1); text-align: center;">
            <h1 style="font-size: 28px; font-weight: 900; margin: 0 0 16px 0; color: #000; text-transform: uppercase;">
              ${oc.extrasTitre}
            </h1>
            <p style="font-size: 16px; margin: 0 0 20px 0; color: #000;">${oc.extrasIntro}</p>
            ${boutons}
            <p style="font-size: 13px; margin: 24px 0 0 0; color: #555;">${oc.extrasConseil}</p>
            <p style="font-size: 12px; margin: 16px 0 0 0; color: #888;">#${ref}</p>
          </div>
        </div>
      `,
    });

    if (envoi.error) {
      console.error("[EXTRAS] envoi refuse :", order.id, envoi.error);
      return NextResponse.json(
        { error: `Fichiers generes mais e-mail non envoye : ${envoi.error.message}`, fichiers },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, fichiers, emailId: envoi.data?.id ?? null });
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : "Erreur inconnue";
    console.error("[EXTRAS] echec :", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
