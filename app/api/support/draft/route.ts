import { NextRequest, NextResponse } from "next/server";
import { getSupportMessageById, getOrderById, getSupportOutbox } from "@/lib/db";
import { redigerReponseSupport } from "@/lib/aiReponse";
import { refuserSiPasAdmin } from "@/lib/adminAuth";

/**
 * Le brouillon d'un courrier au client.
 *
 * Deux points d'entree pour la meme chose : `messageId` quand on repond a un
 * e-mail recu, `orderId` quand c'est nous qui ouvrons le fil — pour repondre
 * a une question posee dans le formulaire de commande, ou pour donner un
 * point d'etape.
 *
 * Rien n'est ecrit en base ici : un brouillon qu'on jette ne doit laisser
 * aucune trace, et deux clics sur le bouton doivent pouvoir donner deux
 * propositions differentes. Seul le courrier REELLEMENT envoye est
 * enregistre, par `/api/support/reply`.
 */
export async function POST(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const { messageId, orderId }: { messageId?: number; orderId?: string } = await req.json();

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

    /* L'historique, c'est tout ce qui est deja parti sur ce fil — et le fil
       n'est pas toujours celui d'un message. Quand on ecrit depuis une fiche
       commande, ce qui compte est ce qu'on a deja envoye A CETTE COMMANDE,
       y compris les reponses accrochees a d'anciens e-mails : sans elles le
       modele redirait ce qu'on vient d'annoncer. */
    const historique = message
      ? (message.replies ?? [])
      : (await getSupportOutbox())
          .filter((r) => r.order_id === idCommande)
          .sort((a, b) => +new Date(a.sent_at) - +new Date(b.sent_at));

    const resultat = await redigerReponseSupport({
      message: message
        ? { fromEmail: message.from_email, subject: message.subject, bodyText: message.body_text }
        : null,
      commande,
      historique,
    });

    /* 502 et non 500 : la panne vient du fournisseur du modele, pas d'ici. La
       distinction compte pour qui lit les journaux Vercel — une erreur 500 sur
       cette route ferait chercher un defaut dans le code. */
    if ("erreur" in resultat) {
      return NextResponse.json({ error: resultat.erreur }, { status: 502 });
    }

    return NextResponse.json({ brouillon: resultat.texte });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/support/draft] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
