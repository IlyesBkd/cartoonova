import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  getOrderById,
  enregistrerExpedition,
  marquerExpediee,
  setOrderLastOutboundMessageId,
} from "@/lib/db";
import { getLangFromCountry, shippingEmail } from "@/lib/email-i18n";
import { estPhysique } from "@/lib/supportCommande";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { EXPEDITEUR, SUPPORT_EMAIL } from "@/lib/expediteur";

/**
 * Le dossier d'expedition d'une commande physique.
 *
 * ── Ce qui manquait ──────────────────────────────────────────────────────
 *
 * Une toile est commandee chez l'imprimeur, a l'adresse du client. Deux
 * informations naissent alors, et aucune n'avait ou se poser : le numero de
 * commande chez l'imprimeur — la seule reference qui permette de retrouver le
 * dossier quand un colis se perd — et, quelques jours plus tard, le lien de
 * suivi du transporteur.
 *
 * Cote client, le silence commencait a la validation de l'apercu et durait
 * jusqu'a la sonnette. C'est precisement la fenetre ou l'on ecrit au support
 * pour demander ou en est la commande.
 *
 * ── Deux verbes, deux moments ────────────────────────────────────────────
 *
 * PATCH enregistre, sans rien envoyer : la reference imprimeur se saisit le
 * jour de la commande, quand aucun colis n'existe encore.
 *
 * POST enregistre PUIS previent le client : c'est le geste du jour ou le
 * transporteur a pris le colis. Separer les deux evite l'e-mail « votre
 * portrait est parti » envoye par reflexe en notant un numero de commande.
 *
 * La reference imprimeur ne quitte jamais le serveur : elle sert a nous, pas
 * au client, et un client qui la lit n'a rien a en faire sinon deviner chez
 * qui nous imprimons.
 */
const resend = new Resend(process.env.RESEND_API_KEY!);

/** Ce que le tableau de bord poste, dans les deux verbes. */
interface CorpsExpedition {
  orderId?: string;
  fournisseurRef?: string | null;
  suiviUrl?: string | null;
  transporteur?: string | null;
}

/** Vide et absent sont la meme chose ici : rien de saisi. */
function texteOuNull(valeur: unknown, max: number): string | null {
  if (typeof valeur !== "string") return null;
  return valeur.trim().slice(0, max) || null;
}

/**
 * Le lien de suivi, valide ou rien.
 *
 * Ce lien finit dans un `href` envoye a un client. Accepter n'importe quelle
 * chaine y laisserait passer un `javascript:` ; accepter un chemin relatif
 * produirait un lien mort une fois sorti du navigateur. Seuls `http` et
 * `https` absolus passent.
 */
function lienSuiviValide(valeur: string | null): string | null {
  if (!valeur) return null;
  /* Refuse plutot que tronque : un lien coupe reste souvent analysable, donc
     il passerait la validation et arriverait mort chez le client. */
  if (valeur.length > 500) return null;
  try {
    const url = new URL(valeur);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Neutralise ce que l'admin a tape avant de le coller dans du HTML. */
function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Lit le corps commun aux deux verbes, une seule fois. */
async function lireCorps(req: NextRequest) {
  const corps = (await req.json()) as CorpsExpedition;
  return {
    orderId: typeof corps.orderId === "string" ? corps.orderId : "",
    fournisseurRef: texteOuNull(corps.fournisseurRef, 120),
    suiviUrl: typeof corps.suiviUrl === "string" ? corps.suiviUrl.trim() || null : null,
    transporteur: texteOuNull(corps.transporteur, 60),
  };
}

/** Enregistre le dossier sans prevenir le client. */
export async function PATCH(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const { orderId, fournisseurRef, suiviUrl, transporteur } = await lireCorps(req);
    if (!orderId) {
      return NextResponse.json({ error: "orderId manquant." }, { status: 400 });
    }

    /* Un lien invalide est refuse des la saisie plutot qu'a l'envoi : le
       decouvrir au moment de prevenir le client, c'est le decouvrir le jour ou
       l'on est presse. */
    if (suiviUrl && !lienSuiviValide(suiviUrl)) {
      return NextResponse.json(
        { error: "Lien de suivi invalide (il doit commencer par https://)." },
        { status: 400 }
      );
    }

    await enregistrerExpedition(orderId, fournisseurRef, suiviUrl, transporteur);
    return NextResponse.json({ ok: true });
  } catch (erreur) {
    console.error("[expedition PATCH] échec:", erreur);
    return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
  }
}

/** Enregistre, puis previent le client dans sa langue. */
export async function POST(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const { orderId, fournisseurRef, suiviUrl, transporteur } = await lireCorps(req);
    if (!orderId) {
      return NextResponse.json({ error: "orderId manquant." }, { status: 400 });
    }

    const lien = lienSuiviValide(suiviUrl);
    if (!lien) {
      return NextResponse.json(
        { error: "Lien de suivi manquant ou invalide (il doit commencer par https://)." },
        { status: 400 }
      );
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }
    if (!order.customer_email) {
      return NextResponse.json({ error: "Commande sans adresse e-mail." }, { status: 400 });
    }

    /* Une commande numerique n'a pas de colis. Annoncer une expedition a un
       client qui a paye un fichier lui ferait attendre un facteur qui ne
       viendra pas — la meme confusion, dans l'autre sens, que celle qui a
       impose `estPhysique` aux deux boutons d'envoi. */
    const options = typeof order.options === "string" ? JSON.parse(order.options) : order.options;
    if (!estPhysique(options)) {
      return NextResponse.json(
        { error: "Cette commande est numérique : il n'y a pas de colis à suivre." },
        { status: 409 }
      );
    }

    await enregistrerExpedition(orderId, fournisseurRef, lien, transporteur);

    const lang = getLangFromCountry(order.detected_country);
    const t = shippingEmail[lang];
    const ref = order.id.slice(0, 8);
    const lienHtml = echapper(lien);

    const resultat = await resend.emails.send({
      from: EXPEDITEUR,
      to: [order.customer_email],
      replyTo: SUPPORT_EMAIL,
      subject: t.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fef3c7; padding: 20px; border: 4px solid #000;">
          <div style="background: white; border: 3px solid #000; padding: 30px;">
            <h1 style="font-size: 26px; font-weight: 900; text-align: center; margin: 0 0 20px; color: #000; text-transform: uppercase;">${t.title}</h1>
            <p style="font-size: 16px; margin: 0 0 16px; color: #000;">${t.greeting(order.customer_name)}</p>
            <p style="font-size: 16px; margin: 0 0 16px; color: #333;">${t.intro(ref)}</p>
            <p style="font-size: 16px; margin: 0 0 8px; color: #333;">${t.trackingIntro}</p>
            ${
              transporteur
                ? `<p style="font-size: 14px; margin: 0 0 16px; color: #555;">${t.carrierLabel} <strong>${echapper(transporteur)}</strong></p>`
                : ""
            }
            <div style="text-align: center; margin: 24px 0;">
              <a href="${lienHtml}" target="_blank" style="display: inline-block; background: #facc15; color: #000; font-weight: 900; text-transform: uppercase; padding: 14px 32px; border: 3px solid #000; border-radius: 12px; text-decoration: none; font-size: 14px; box-shadow: 4px 4px 0px rgba(0,0,0,1);">${t.cta}</a>
            </div>
            <!-- Le lien en clair sous le bouton : certains clients de messagerie
                 n'affichent pas les boutons, et un lien de suivi qu'on ne peut
                 pas copier ne sert a rien. -->
            <p style="font-size: 12px; text-align: center; margin: 0 0 20px; color: #777; word-break: break-all;">
              <a href="${lienHtml}" target="_blank" style="color: #777;">${lienHtml}</a>
            </p>
            <p style="font-size: 14px; margin: 0 0 12px; color: #555;">${t.delay}</p>
            <p style="font-size: 14px; margin: 0; color: #555;">${t.help}</p>
          </div>
          <div style="text-align: center; font-size: 14px; color: #000; font-weight: bold; margin-top: 16px;">
            <p>${t.thanks}</p>
            <p>${t.team}</p>
          </div>
        </div>
      `,
    });

    /* Rattache les reponses du client a cette commande : « le suivi n'avance
       pas » arrive en reponse a CET e-mail, et doit se lire sur la fiche. */
    if (resultat.data?.id) {
      await setOrderLastOutboundMessageId(orderId, resultat.data.id).catch((e) =>
        console.error("[expedition] rattachement du message impossible:", e)
      );
    }

    await marquerExpediee(orderId);

    return NextResponse.json({ ok: true, lang, email: order.customer_email });
  } catch (erreur) {
    console.error("[expedition POST] échec:", erreur);
    return NextResponse.json({ error: "Envoi impossible." }, { status: 500 });
  }
}
