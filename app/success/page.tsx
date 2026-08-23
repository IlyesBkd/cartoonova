import Stripe from "stripe";
import { getOrderByPaymentId } from "@/lib/db";
import SuccessClient from "@/app/success/SuccessClient";
import { orderTrackingToken } from "@/lib/emailToken";
import { finaliserCommande } from "@/lib/finaliserCommande";

/* L'e-mail de confirmation, la notification Discord et la mesure de l'achat
   ont demenage dans `lib/finaliserCommande.ts` : le webhook Stripe fait
   exactement le meme travail, et deux copies d'une sequence de notifications
   divergent toujours. Cette page en reste un appelant parmi deux. */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export default async function SuccessPage(props: {
  searchParams: Promise<{ payment_intent?: string; redirect_status?: string }>;
}) {
  const searchParams = await props.searchParams;
  console.log("[SUCCESS PAGE] 🚀 Chargement | searchParams:", JSON.stringify(searchParams));
  const paymentIntentId = searchParams.payment_intent;

  if (!paymentIntentId) {
    console.log("[SUCCESS PAGE] ❌ Pas de payment_intent dans l'URL → affichage erreur");
    return (
      <div style={{ padding: 40, fontFamily: "monospace" }}>
        <h1>Erreur : payment_intent manquant</h1>
        <p>searchParams reçu : <code>{JSON.stringify(searchParams)}</code></p>
        <a href="/">Retour à l&apos;accueil</a>
      </div>
    );
  }

  try {
    // 1. Vérifier le statut réel du paiement via Stripe
    console.log("[SUCCESS PAGE] 1. Retrieve PaymentIntent:", paymentIntentId);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log("[SUCCESS PAGE] Stripe status:", paymentIntent.status);

    if (paymentIntent.status !== "succeeded") {
      console.log("[SUCCESS PAGE] ❌ Paiement non réussi:", paymentIntent.status);
      return (
        <div style={{ padding: 40, fontFamily: "monospace" }}>
          <h1>Paiement non finalisé</h1>
          <p>Statut Stripe : <code>{paymentIntent.status}</code></p>
          <p>PI : <code>{paymentIntentId}</code></p>
          <a href="/">Retour à l&apos;accueil</a>
        </div>
      );
    }

    // 2. Chercher la commande PENDING correspondante
    console.log("[SUCCESS PAGE] 2. Recherche commande pour PI:", paymentIntentId);
    const order = await getOrderByPaymentId(paymentIntentId);
    console.log("[SUCCESS PAGE] Commande trouvée:", order ? `id=${order.id} status=${order.status}` : "NULL");

    if (!order) {
      console.error("[SUCCESS PAGE] ❌ Commande non trouvée pour PI:", paymentIntentId);
      return (
        <div style={{ padding: 40, fontFamily: "monospace" }}>
          <h1>Commande introuvable</h1>
          <p>Le paiement a réussi mais la commande n&apos;a pas été trouvée en base.</p>
          <p>PI : <code>{paymentIntentId}</code></p>
          <p>Contactez support@cartoonova.com avec ce numéro.</p>
          <a href="/">Retour à l&apos;accueil</a>
        </div>
      );
    }

    /* 3. Finaliser — sauf si le webhook Stripe est deja passe.
       Aucune verification prealable du statut ici : elle serait fausse. Le
       webhook arrive a l'instant meme de la redirection, donc lire le statut
       puis decider laisserait passer les deux chemins. C'est la requete SQL
       atomique de `marquerPayee` qui tranche, a l'interieur de
       `finaliserCommande`. */
    await finaliserCommande(order, "page_succes");

    /* Le resultat de la finalisation n'est PAS transmis au navigateur, et
       c'est deliberé.
       Il l'etait avant, sous le nom `isNewConversion`, et il commandait la
       conversion Google Ads. Ce cablage etait sans danger tant que cette page
       etait seule a finaliser : elle gagnait toujours. Avec le webhook, c'est
       lui qui gagne le plus souvent — la page aurait donc recu `false` a
       presque chaque commande et n'aurait plus jamais declenche la conversion.
       Google Ads aurait cesse de compter du jour au lendemain, sans erreur
       nulle part.
       La conversion publicitaire n'a de toute facon rien a voir avec la course
       en base : elle doit partir des que le navigateur affiche une commande
       payee. Sa protection contre le double comptage lui est propre —
       sessionStorage indexe par PaymentIntent, plus la deduplication que
       Google opere sur `transaction_id`. */
    return (
      <SuccessClient
        order={order}
        trackingUrl={`/suivi/${orderTrackingToken(order.id)}`}
      />
    );
  } catch (error) {
    console.error("[SUCCESS PAGE] 💥 Erreur:", error);
    return (
      <div style={{ padding: 40, fontFamily: "monospace" }}>
        <h1>Erreur technique</h1>
        <p>PI : <code>{paymentIntentId}</code></p>
        <p>Erreur : <code>{error instanceof Error ? error.message : String(error)}</code></p>
        <p>Contactez support@cartoonova.com avec ce numéro.</p>
        <a href="/">Retour à l&apos;accueil</a>
      </div>
    );
  }
}
