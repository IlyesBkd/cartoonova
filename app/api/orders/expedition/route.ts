import { emailLayout, emailParagraph, emailButton, emailNotice, escapeEmailHtml } from "@/lib/emailTemplate";
import { diagnosticJournal } from "@/lib/confidentialiteMesure";
import { NextRequest, NextResponse } from "next/server";
import { shippingEmail, langueCommande } from "@/lib/email-i18n";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { EXPEDITEUR, SUPPORT_EMAIL } from "@/lib/expediteur";
import { envoyerEmail } from "@/lib/envoiEmail";
import { patchShipping, notifyShipping, ShippingError } from "@/lib/orderDeliveryShipping";

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
/** Ce que le tableau de bord poste, dans les deux verbes. */
interface CorpsExpedition {
  orderId?: string;
  fournisseurRef?: string | null;
  suiviUrl?: string | null;
  transporteur?: string | null;
}

/** Empty strings and null explicitly clear; undefined is preserved by lireCorps. */
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
function lienSuiviValide(valeur: string | null | undefined): string | null {
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

/**
 * Un numero de suivi colle tel quel devient un lien.
 *
 * L'imprimeur donne un numero (`00340434886620302256`, `CC381022174DE`), pas
 * un lien : il fallait retrouver soi-meme la bonne page de transporteur, et
 * c'est a cette etape que le suivi d'une cliente est reste un mois dans le
 * compte imprimeur sans jamais lui parvenir. 17TRACK reconnait seul le
 * transporteur, ce qui evite de le deviner a partir du format.
 */
function lienDepuisNumero(valeur: string | null): string | null {
  if (!valeur) return null;
  const numero = valeur.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9]{8,40}$/.test(numero)) return valeur;
  return `https://t.17track.net/fr#nums=${numero.toUpperCase()}`;
}

/** Lit le corps commun aux deux verbes, une seule fois. */
async function lireCorps(req: NextRequest) {
  const corps = (await req.json().catch(() => { throw new ShippingError("Corps JSON invalide.", 400); })) as CorpsExpedition;
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) throw new ShippingError("Corps invalide.", 400);
  for (const key of ["fournisseurRef", "suiviUrl", "transporteur"] as const) {
    if (corps[key] !== undefined && corps[key] !== null && typeof corps[key] !== "string") {
      throw new ShippingError("Les champs d'expédition doivent être du texte ou null.", 400);
    }
  }
  return {
    orderId: typeof corps.orderId === "string" ? corps.orderId : "",
    fournisseurRef: corps.fournisseurRef === undefined ? undefined : texteOuNull(corps.fournisseurRef, 120),
    suiviUrl: corps.suiviUrl === undefined ? undefined : lienDepuisNumero(typeof corps.suiviUrl === "string" ? corps.suiviUrl.trim() || null : null),
    transporteur: corps.transporteur === undefined ? undefined : texteOuNull(corps.transporteur, 60),
  };
}

/** Enregistre le dossier sans prevenir le client. */
export async function PATCH(req: NextRequest) {
  const refus = await refuserSiPasAdmin(req);
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

    await patchShipping(orderId, { fournisseurRef, suiviUrl, transporteur });
    return NextResponse.json({ ok: true });
  } catch (erreur) {
    console.error("[expedition PATCH] échec:", diagnosticJournal(erreur));
    return NextResponse.json({ error: erreur instanceof ShippingError ? erreur.message : "Enregistrement impossible." }, { status: erreur instanceof ShippingError ? erreur.status : 500 });
  }
}

/** Enregistre, puis previent le client dans sa langue. */
export async function POST(req: NextRequest) {
  const refus = await refuserSiPasAdmin(req);
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

    const order = await notifyShipping(orderId, { fournisseurRef, suiviUrl: lien, transporteur }, async order => {
    const lang = langueCommande(order);
    const t = shippingEmail[lang];
    const ref = order.id.slice(0, 8);

    return envoyerEmail({
      from: EXPEDITEUR,
      to: [order.customer_email],
      replyTo: SUPPORT_EMAIL,
      subject: t.subject,
      html: emailLayout({
        lang,
        title: t.title,
        bodyHtml: emailParagraph(t.greeting(order.customer_name))
          // The translation owns the static strong tag; the order reference is escaped.
          + `<p style="margin:0 0 16px;line-height:1.6;">${t.intro(escapeEmailHtml(ref))}</p>`
          + emailParagraph(t.trackingIntro)
          + (order.suivi_transporteur ? emailParagraph(`${t.carrierLabel} ${order.suivi_transporteur}`) : "")
          + emailButton(t.cta, order.suivi_url!)
          + emailNotice(t.delay)
          + emailParagraph(t.help),
        footerHtml: emailParagraph(t.thanks) + emailParagraph(t.team),
      }),
    });

    });

    return NextResponse.json({ ok: true, lang: langueCommande(order), email: order.customer_email });
  } catch (erreur) {
    console.error("[expedition POST] échec:", diagnosticJournal(erreur));
    return NextResponse.json({ error: erreur instanceof ShippingError ? erreur.message : "Envoi impossible." }, { status: erreur instanceof ShippingError ? erreur.status : 500 });
  }
}
