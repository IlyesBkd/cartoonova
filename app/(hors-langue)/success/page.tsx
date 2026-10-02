import Stripe from "stripe";
import { cookies } from "next/headers";
import { getOrderByPaymentId } from "@/lib/db";
import SuccessClient from "@/app/(hors-langue)/success/SuccessClient";
import EtatPaiement from "@/app/(hors-langue)/success/EtatPaiement";
import AttentePaiement from "@/app/(hors-langue)/success/AttentePaiement";
import { orderTrackingToken } from "@/lib/emailToken";
import { attendDesPhotos } from "@/lib/orderPhotos";
import { finaliserCommande } from "@/lib/finaliserCommande";
import { bonCadeauTextes, getLangFromCountry, langueDemandee, successPage } from "@/lib/email-i18n";
import { finaliserBonCadeau, formatMontant, lienImpression, type BonCadeau } from "@/lib/bonCadeau";

/* L'e-mail de confirmation, la notification Discord et la mesure de l'achat
   ont demenage dans `lib/finaliserCommande.ts` : le webhook Stripe fait
   exactement le meme travail, et deux copies d'une sequence de notifications
   divergent toujours. Cette page en reste un appelant parmi deux. */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

/* Statuts Stripe qui disent « ce paiement n'a pas abouti ». `processing` n'en
   fait PAS partie : PayPal et Revolut Pay y passent avant de confirmer, et
   cette page le traitait comme un echec — le client qui venait de payer lisait
   « Paiement non finalise ». */
const STATUTS_ECHEC = new Set(["requires_payment_method", "requires_action", "requires_confirmation", "canceled"]);

type Issue =
  | { etat: "attente" }
  | { etat: "echec" }
  | { etat: "introuvable" }
  | { etat: "erreur" }
  | { etat: "succes"; order: NonNullable<Awaited<ReturnType<typeof getOrderByPaymentId>>> }
  | { etat: "bon"; bon: BonCadeau };

/** Ce que Stripe et la base disent de ce paiement. Aucun rendu ici : le
    rendu se fait hors du try/catch (regle react-hooks/error-boundaries). */
async function issueDuPaiement(paymentIntentId: string): Promise<Issue> {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    /* Pas de finalisation en attente : elle partira du webhook Stripe a la
       confirmation. La page se relance d'elle-meme en attendant. */
    if (paymentIntent.status === "processing") return { etat: "attente" };
    if (STATUTS_ECHEC.has(paymentIntent.status)) return { etat: "echec" };
    if (paymentIntent.status !== "succeeded") {
      console.error("[SUCCESS PAGE] Statut Stripe inattendu:", paymentIntent.status, paymentIntentId);
      return { etat: "erreur" };
    }

    /* Un bon cadeau n'a pas de commande : on le cree (ou on retrouve celui
       que le webhook a deja cree) et on l'affiche. */
    if (paymentIntent.metadata?.type === "bon_cadeau") {
      return { etat: "bon", bon: await finaliserBonCadeau(paymentIntent) };
    }

    const order = await getOrderByPaymentId(paymentIntentId);
    if (!order) {
      console.error("[SUCCESS PAGE] ❌ Commande non trouvée pour PI:", paymentIntentId);
      return { etat: "introuvable" };
    }

    /* Finaliser — sauf si le webhook Stripe est deja passe.
       Aucune verification prealable du statut ici : elle serait fausse. Le
       webhook arrive a l'instant meme de la redirection, donc lire le statut
       puis decider laisserait passer les deux chemins. C'est la requete SQL
       atomique de `marquerPayee` qui tranche, a l'interieur de
       `finaliserCommande`.

       Le resultat de la finalisation n'est PAS transmis au navigateur, et
       c'est deliberé. Il l'etait avant, sous le nom `isNewConversion`, et il
       commandait la conversion Google Ads. Avec le webhook, c'est lui qui gagne
       le plus souvent la course — la page aurait recu `false` a presque chaque
       commande et n'aurait plus jamais declenche la conversion, sans erreur
       nulle part. La conversion doit partir des que le navigateur affiche une
       commande payee ; sa protection contre le double comptage lui est propre
       (sessionStorage indexe par PaymentIntent, plus la deduplication de
       Google sur `transaction_id`). */
    await finaliserCommande(order, "page_succes");
    return { etat: "succes", order };
  } catch (error) {
    console.error("[SUCCESS PAGE] 💥 Erreur:", error);
    return { etat: "erreur" };
  }
}

export default async function SuccessPage(props: {
  searchParams: Promise<{ payment_intent?: string; redirect_status?: string; lang?: string }>;
}) {
  const searchParams = await props.searchParams;
  const paymentIntentId = searchParams.payment_intent;

  /* Page hors de [locale] : la langue vient de la caisse (`?lang=`), sinon du
     cookie de langue du site (pose seulement quand on change de langue), sinon
     du pays detecte par `proxy.ts` ; le pays de la commande ne tranche qu'en
     dernier, une fois la commande lue. */
  const jar = await cookies();
  const pays = jar.get("cartoonova_country")?.value;
  const langueVisite =
    langueDemandee(searchParams.lang, jar.get("NEXT_LOCALE")?.value) ??
    (pays ? getLangFromCountry(pays) : null);
  const t = successPage[langueVisite ?? "en"];
  const boutique = { href: `/${langueVisite ?? "en"}`, libelle: t.retry };

  if (!paymentIntentId) {
    return <EtatPaiement titre={t.missingTitle} texte={t.missingBody} action={boutique} />;
  }

  const issue = await issueDuPaiement(paymentIntentId);

  switch (issue.etat) {
    case "succes":
      return (
        <SuccessClient
          order={issue.order}
          lang={langueVisite ?? getLangFromCountry(issue.order.detected_country)}
          trackingUrl={`/suivi/${orderTrackingToken(issue.order.id)}`}
          /* Commande payee sans photo : le depot devient la premiere action.
             Le jeton est signe ici, cote serveur, comme celui du suivi. */
          depotUrl={
            attendDesPhotos(issue.order.photo_urls)
              ? `/depot/${orderTrackingToken(issue.order.id)}`
              : undefined
          }
        />
      );
    case "bon": {
      const tb = bonCadeauTextes[langueVisite ?? issue.bon.lang];
      const l = langueVisite ?? issue.bon.lang;
      return (
        <EtatPaiement
          titre={tb.succesTitre}
          texte={tb.succesTexte}
          action={{ href: lienImpression(issue.bon.code), libelle: tb.imprimer }}
        >
          <div className="bon-code">
            <small>{tb.code} · {formatMontant(issue.bon.montant, issue.bon.devise, l)}</small>
            <b>{issue.bon.code}</b>
          </div>
        </EtatPaiement>
      );
    }
    case "attente":
      return (
        <EtatPaiement titre={t.processingTitle} texte={t.processingBody}>
          <AttentePaiement lent={t.processingSlow} />
        </EtatPaiement>
      );
    case "echec":
      return <EtatPaiement titre={t.failedTitle} texte={t.failedBody} action={boutique} />;
    case "introuvable":
      return (
        <EtatPaiement
          titre={t.notFoundTitle}
          texte={t.notFoundBody}
          reference={paymentIntentId}
          libelleReference={t.reference}
        />
      );
    case "erreur":
      return (
        <EtatPaiement
          titre={t.errorTitle}
          texte={t.errorBody}
          reference={paymentIntentId}
          libelleReference={t.reference}
        />
      );
  }
}
