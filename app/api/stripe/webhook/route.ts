import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getOrderByPaymentId } from "@/lib/db";
import { finaliserCommande } from "@/lib/finaliserCommande";
import { mesureServeur } from "@/lib/analyticsServeur";
import { MESURES } from "@/lib/evenementsMesure";
import { toEUR } from "@/lib/currency";
import { alerteDiscord, COULEUR_ALERTE, COULEUR_ATTENTION } from "@/lib/discord";

/**
 * Webhook Stripe.
 *
 * Ce qu'il repare : jusqu'ici, le passage d'une commande en PAID, l'e-mail de
 * confirmation et la notification Discord dependaient tous du chargement de
 * /success par le navigateur du client. Un onglet ferme trop tot, un
 * portefeuille mobile qui rend la main, un reseau qui lache — et la commande
 * restait PENDING pour toujours : le client ne recevait rien, et personne chez
 * Cartoonova ne savait qu'elle existait, alors que l'argent etait encaisse.
 *
 * Le cron `lifecycle-emails` detectait bien le cas, mais se contentait
 * d'ecrire « a rattraper a la main » dans les journaux avant de marquer la
 * commande comme traitee. Le rattrapage supposait donc que quelqu'un lise les
 * journaux Vercel tous les jours.
 *
 * Ici, Stripe previent le serveur directement. La page de succes reste en
 * place et fait exactement le meme travail : les deux chemins passent par
 * `finaliserCommande`, et c'est la requete SQL atomique de `marquerPayee` qui
 * garantit qu'un seul des deux declenche les effets de bord.
 */

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

/** Identifiant du PaymentIntent porte par une charge ou une contestation. */
function idPaiement(valeur: string | Stripe.PaymentIntent | null): string | null {
  if (!valeur) return null;
  return typeof valeur === "string" ? valeur : valeur.id;
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET manquant");
    return NextResponse.json({ error: "Non configuré." }, { status: 503 });
  }

  /* Le corps doit etre lu BRUT. La signature est calculee sur les octets
     exacts envoyes par Stripe : un `req.json()` suivi d'un `JSON.stringify`
     reordonnerait les cles et invaliderait tout. */
  const corps = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let evenement: Stripe.Event;
  try {
    evenement = stripe.webhooks.constructEvent(corps, signature, secret);
  } catch (erreur) {
    /* Signature invalide : la requete ne vient pas de Stripe, ou le secret
       configure n'est pas le bon (le secret de test et celui de production
       sont differents). On refuse sans reessai possible. */
    console.error("[stripe/webhook] signature refusée:", erreur);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  try {
    switch (evenement.type) {
      case "payment_intent.succeeded":
        return await surPaiementReussi(evenement.data.object);

      case "payment_intent.payment_failed":
        return await surPaiementEchoue(evenement.data.object);

      case "charge.refunded":
        return await surRemboursement(evenement.data.object);

      case "charge.dispute.created":
        return await surContestation(evenement.data.object);

      default:
        /* Un evenement non gere n'est pas une erreur : repondre 200 evite que
           Stripe le reessaie pendant trois jours et marque l'endpoint en
           echec. */
        return NextResponse.json({ ignore: evenement.type });
    }
  } catch (erreur) {
    /* 500 volontaire : Stripe reessaiera avec un delai croissant pendant
       trois jours. C'est ce qui rattrape une panne passagere de la base ou de
       Resend sans perdre la commande. */
    console.error(`[stripe/webhook] échec du traitement de ${evenement.type}:`, erreur);
    return NextResponse.json({ error: "Traitement impossible." }, { status: 500 });
  }
}

/* ═══ paiement reussi ═════════════════════════════════════════════════ */

async function surPaiementReussi(pi: Stripe.PaymentIntent): Promise<NextResponse> {
  const order = await getOrderByPaymentId(pi.id);

  if (!order) {
    /* De l'argent encaisse sans commande en base. Deux causes possibles : le
       webhook a devance l'insertion faite par le navigateur (une course de
       quelques centaines de millisecondes), ou `/api/order/create` a echoue —
       auquel cas la commande est perdue et il faut la reconstituer a la main.
       On repond 500 pour que Stripe reessaie : le premier cas se resout tout
       seul au premier reessai. Si les reessais continuent d'echouer, l'alerte
       Discord ci-dessous aura prevenu. */
    console.error("[stripe/webhook] paiement réussi sans commande en base:", pi.id);

    await alerteDiscord({
      titre: "🚨 PAIEMENT SANS COMMANDE",
      couleur: COULEUR_ALERTE,
      champs: [
        { name: "PaymentIntent", value: pi.id, inline: false },
        { name: "Montant", value: `${pi.amount / 100} ${pi.currency.toUpperCase()}`, inline: true },
        {
          name: "À faire",
          value:
            "Stripe va réessayer. Si l'alerte se répète, la commande n'a jamais été enregistrée : " +
            "la reconstituer à la main depuis le dashboard Stripe.",
          inline: false,
        },
      ],
      piedDePage: "Cartoonova • webhook Stripe",
    });

    return NextResponse.json({ error: "Commande introuvable." }, { status: 500 });
  }

  const finalisee = await finaliserCommande(order, "webhook");

  /* `false` signifie que la page de succes a gagne la course — cas normal
     quand le client reste sur son onglet. Rien a faire, et surtout pas une
     erreur. */
  return NextResponse.json({ order: order.id, finalisee });
}

/* ═══ paiement echoue ═════════════════════════════════════════════════ */

async function surPaiementEchoue(pi: Stripe.PaymentIntent): Promise<NextResponse> {
  const order = await getOrderByPaymentId(pi.id);

  /* Mesure cote serveur du refus bancaire. Le navigateur en emettait deja un,
     mais seulement quand il etait encore la pour le faire — et un refus
     survenu apres une redirection lui echappait entierement. */
  await mesureServeur(MESURES.paiementEchoue, {
    identifiant: order?.customer_email ?? pi.receipt_email ?? pi.id,
    proprietes: {
      transaction_id: pi.id,
      order_id: order?.id ?? null,
      value: pi.amount / 100,
      currency: pi.currency.toUpperCase(),
      /* Le code de refus de la banque : `insufficient_funds`,
         `card_declined`… C'est lui qui distingue un probleme de carte d'un
         probleme de tunnel. */
      decline_code: pi.last_payment_error?.decline_code ?? null,
      error_code: pi.last_payment_error?.code ?? null,
      method: pi.last_payment_error?.payment_method?.type ?? null,
      source: "webhook",
    },
  });

  return NextResponse.json({ mesure: true });
}

/* ═══ remboursement ═══════════════════════════════════════════════════ */

async function surRemboursement(charge: Stripe.Charge): Promise<NextResponse> {
  const piId = idPaiement(charge.payment_intent);
  const order = piId ? await getOrderByPaymentId(piId) : null;

  const devise = charge.currency.toUpperCase();
  const rembourse = charge.amount_refunded / 100;
  const total = charge.amount / 100;
  /* `charge.refunded` se declenche aussi sur un remboursement PARTIEL : le
     supposer total fausserait le chiffre d'affaires dans l'autre sens. */
  const partiel = charge.amount_refunded < charge.amount;

  await mesureServeur(MESURES.remboursement, {
    identifiant: order?.customer_email ?? charge.billing_details?.email ?? charge.id,
    proprietes: {
      transaction_id: piId,
      order_id: order?.id ?? null,
      amount_refunded: rembourse,
      amount_original: total,
      currency: devise,
      refunded_eur: toEUR(rembourse, devise),
      /* Negatif : c'est ce qui permet a la somme des `$revenue` de tomber
         juste sans retraitement. */
      $revenue: -toEUR(rembourse, devise),
      partiel,
      style: order?.options?.style ?? null,
      detected_country: order?.detected_country ?? null,
      source: "webhook",
    },
  });

  await alerteDiscord({
    titre: partiel ? "↩️ Remboursement partiel" : "↩️ Remboursement",
    couleur: COULEUR_ATTENTION,
    champs: [
      { name: "Commande", value: order ? order.id.slice(0, 8) : "inconnue", inline: true },
      { name: "Remboursé", value: `${rembourse} ${devise}`, inline: true },
      ...(partiel ? [{ name: "Sur", value: `${total} ${devise}`, inline: true }] : []),
    ],
    piedDePage: "Cartoonova • webhook Stripe",
  });

  return NextResponse.json({ mesure: true });
}

/* ═══ contestation ════════════════════════════════════════════════════ */

async function surContestation(litige: Stripe.Dispute): Promise<NextResponse> {
  const piId = idPaiement(litige.payment_intent);
  const order = piId ? await getOrderByPaymentId(piId) : null;

  const devise = litige.currency.toUpperCase();
  const montant = litige.amount / 100;

  await mesureServeur(MESURES.contestation, {
    identifiant: order?.customer_email ?? litige.id,
    proprietes: {
      transaction_id: piId,
      order_id: order?.id ?? null,
      value: montant,
      currency: devise,
      amount_eur: toEUR(montant, devise),
      reason: litige.reason,
      status: litige.status,
      source: "webhook",
    },
  });

  /* Une contestation se repond dans un delai court, fixe par la banque, et se
     perd par defaut si personne ne reagit. C'est la seule alerte de ce fichier
     qui demande une action humaine dans la journee. */
  await alerteDiscord({
    titre: "⚠️ CONTESTATION BANCAIRE — À TRAITER",
    couleur: COULEUR_ALERTE,
    champs: [
      { name: "Commande", value: order ? order.id.slice(0, 8) : "inconnue", inline: true },
      { name: "Montant", value: `${montant} ${devise}`, inline: true },
      { name: "Motif", value: litige.reason, inline: true },
      {
        name: "Échéance",
        value: litige.evidence_details?.due_by
          ? new Date(litige.evidence_details.due_by * 1000).toLocaleString("fr-FR")
          : "voir le dashboard Stripe",
        inline: false,
      },
      {
        name: "À faire",
        value:
          "Répondre depuis le dashboard Stripe avant l'échéance : preuve de livraison, " +
          "échanges avec le client, aperçu validé. Sans réponse, le litige est perdu d'office.",
        inline: false,
      },
    ],
    piedDePage: "Cartoonova • webhook Stripe",
  });

  return NextResponse.json({ mesure: true });
}
