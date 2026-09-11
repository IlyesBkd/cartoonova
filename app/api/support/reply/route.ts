import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  getSupportMessageById,
  getOrderById,
  insertSupportReply,
  markSupportMessageRead,
  setOrderLastOutboundMessageId,
} from "@/lib/db";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { EXPEDITEUR, SUPPORT_EMAIL } from "@/lib/expediteur";

const resend = new Resend(process.env.RESEND_API_KEY!);

/** De quoi ecarter une adresse que la synchro n'a pas su lire. */
const ADRESSE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * L'objet d'une reponse.
 *
 * Un « Re: » deja present n'est pas redouble : les clients de messagerie
 * empilent sinon « Re: Re: Re: » au fil de l'echange, et la plupart cessent de
 * regrouper le fil des que le prefixe cesse d'etre reconnu. Les formes des dix
 * marches sont acceptees — « Re: », « RE: », « Rép: », « Antw: », « Odp: » —
 * parce que c'est le client qui ecrit la premiere et qu'il ecrit dans la
 * sienne.
 */
function objetDeReponse(sujet: string | null): string {
  const base = (sujet || "").trim();
  if (!base) return "Re: votre message";
  if (/^(re|ré|rép|rep|aw|antw|odp|sv|vs|r)\s*:/i.test(base)) return base;
  return `Re: ${base}`;
}

/**
 * Envoyer un courrier au client, depuis l'admin.
 *
 * `messageId` repond a un e-mail recu. `orderId` ouvre le fil sur une
 * commande — c'est par la que passe une question posee dans le formulaire de
 * commande, qui n'est jamais arrivee par e-mail et n'avait donc rien a quoi
 * repondre.
 */
export async function POST(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const {
      messageId,
      orderId,
      corps,
      objet,
      assisteeIa,
    }: {
      messageId?: number;
      orderId?: string;
      corps: string;
      objet?: string;
      assisteeIa?: boolean;
    } = await req.json();

    if (typeof corps !== "string" || !corps.trim()) {
      return NextResponse.json({ error: "Contenu manquant." }, { status: 400 });
    }
    if (!messageId && !orderId) {
      return NextResponse.json({ error: "messageId ou orderId requis." }, { status: 400 });
    }

    const message = messageId ? await getSupportMessageById(messageId) : null;
    if (messageId && !message) {
      return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
    }

    const idCommande = message?.order_id ?? orderId ?? null;
    const commande = idCommande ? await getOrderById(idCommande) : null;
    if (orderId && !commande) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    /* A qui on ecrit : l'expediteur du message quand il y en a un, sinon le
       client de la commande. Jamais les deux — repondre a un e-mail en
       l'envoyant a l'adresse de paiement raterait le client qui ecrit depuis
       une autre boite, ce qui arrive des qu'un cadeau change de mains. */
    const destinataire = message ? message.from_email : commande?.customer_email;

    /* La synchro IMAP ecrit « inconnu » quand l'en-tete From est illisible.
       Envoyer a cette adresse ferait rebondir le courrier sans que personne ne
       le sache : l'envoi serait enregistre comme parti, et le client n'aurait
       jamais rien recu. */
    if (!destinataire || !ADRESSE.test(destinataire)) {
      return NextResponse.json(
        { error: `Adresse destinataire inutilisable (« ${destinataire || "vide"} ») : impossible d'écrire.` },
        { status: 422 }
      );
    }

    const texte = corps.trim();
    const sujet = message
      ? objetDeReponse(message.subject)
      : (objet || "").trim() ||
        `Votre commande Cartoonova #${String(commande!.id).slice(0, 8)}`;

    /* Le rattachement du fil tient a ces deux en-tetes. Sans eux la reponse
       arrive comme un message isole, a cote de la question du client plutot
       qu'en dessous — et c'est precisement ce qui pousse quelqu'un a reecrire
       une troisieme fois en croyant n'avoir jamais eu de reponse.

       Un courrier qui OUVRE le fil n'en a pas : il n'y a rien avant lui. Et
       les identifiants fabriques par la synchro quand le courrier n'en portait
       pas (`uid-42@imap-fallback`) sont ecartes de la meme facon — ils ne
       designent rien, et un In-Reply-To qui pointe dans le vide desoriente
       certains clients au lieu de les aider. */
    const referencable = message && !message.message_id.endsWith("@imap-fallback");
    const reference = message
      ? message.message_id.startsWith("<")
        ? message.message_id
        : `<${message.message_id}>`
      : null;

    const envoi = await resend.emails.send({
      from: EXPEDITEUR,
      to: [destinataire],
      replyTo: SUPPORT_EMAIL,
      subject: sujet,
      /* Texte brut, et rien d'autre. Les e-mails transactionnels du site sont
         mis en page parce qu'ils annoncent quelque chose ; un courrier du
         support est une conversation, et l'habiller d'un cadre jaune et d'une
         ombre portee le ferait lire comme une notification automatique — ce
         qu'il n'est pas. */
      text: texte,
      ...(referencable && reference
        ? { headers: { "In-Reply-To": reference, References: reference } }
        : {}),
    });

    if (envoi.error) {
      console.error("[POST /api/support/reply] Resend:", envoi.error);
      return NextResponse.json({ error: envoi.error.message || "Envoi refusé." }, { status: 502 });
    }

    /* L'enregistrement vient APRES l'envoi, jamais avant. Un courrier inscrit
       au fil alors que Resend l'a refuse afficherait « répondu » a cote d'un
       client qui attend toujours — l'erreur la plus couteuse que cette page
       puisse commettre, parce qu'elle ferme le sujet. */
    const reponse = await insertSupportReply({
      supportMessageId: message?.id ?? null,
      orderId: idCommande,
      toEmail: destinataire,
      subject: sujet,
      bodyText: texte,
      assisteeIa: Boolean(assisteeIa),
      providerId: envoi.data?.id ?? null,
    });

    if (message && !message.read_at) await markSupportMessageRead(message.id);

    /* La commande retient le dernier courrier parti, comme apres l'envoi de
       l'illustration ou de la demande de validation : c'est par lui que la
       prochaine reponse du client se rattachera a sa commande. */
    if (idCommande && envoi.data?.id) {
      await setOrderLastOutboundMessageId(idCommande, envoi.data.id);
    }

    return NextResponse.json({ ok: true, reponse });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/support/reply] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
