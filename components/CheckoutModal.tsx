"use client";

import { useState, useEffect, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, ExpressCheckoutElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useCurrency } from "@/components/CurrencyProvider";
import { useTranslations } from "next-intl";
import { mesure } from "@/lib/analytics";
import { COUNTRIES, getCallingCode } from "@/lib/countries";
import type { PrintKey } from "@/lib/pricing";
import Icone from "@/components/tj/Icone";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

/* ─── Shared input style ──────────────────────────────────────────── */
const inputClass =
  "champ-ligne";
const labelClass = "champ-etiquette";

/* ─── Types ───────────────────────────────────────────────────────── */
interface OrderConfig {
  format: "portrait" | "fullbody";
  people: number;
  animals: number;
  background: string;
  printOption: string;
  /** Cle stable du support choisi — sert au calcul du prix cote serveur. */
  printKey: PrintKey;
  total: number;
  description: string;
  photoUrls: string[];
  style: string;
}

/** Message lisible d'une erreur attrapee, quelle que soit sa forme. */
function messageErreur(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Une erreur technique est survenue.";
}

/** Ce que le serveur a besoin de connaitre pour recalculer le prix lui-meme. */
const pricingPayload = (orderConfig: OrderConfig) => ({
  format: orderConfig.format,
  people: orderConfig.people,
  animals: orderConfig.animals,
  printKey: orderConfig.printKey,
});

/* ─── Payment Form ────────────────────────────────────────────────── */
function PaymentForm({
  onClose,
  clientSecret,
  formData,
  orderConfig,
  montant,
}: {
  onClose: () => void;
  clientSecret: string;
  /** Montant du a payer, deja formate dans la devise du visiteur. */
  montant: string;
  formData: {
    email: string;
    firstName?: string;
    lastName?: string;
    address?: string;
    addressLine2?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
    gift?: {
      message: string | null;
      recipientEmail: string | null;
      deliverAfter: string | null;
    } | null;
  };
  orderConfig: OrderConfig;
}) {
  const t = useTranslations("checkout");
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Extract PaymentIntent ID from clientSecret (format: pi_xxx_secret_yyy)
  const getPaymentIntentId = () => {
    console.log("[CHECKOUT] clientSecret raw:", clientSecret);
    const match = clientSecret.match(/^(pi_[^_]+)/);
    const id = match ? match[1] : "";
    console.log("[CHECKOUT] Extracted PI ID:", id);
    return id;
  };

  // Insert order as PENDING in Neon
  const insertPendingOrder = async () => {
    const paymentIntentId = getPaymentIntentId();
    if (!paymentIntentId) {
      console.error("[CHECKOUT] ❌ paymentIntentId est VIDE! clientSecret:", clientSecret);
      throw new Error("PaymentIntent ID manquant.");
    }
    console.log("[CHECKOUT] 📝 INSERT PENDING | PI:", paymentIntentId, "| email:", formData.email);

    const detectedCountry = document.cookie.match(/(?:^| )cartoonova_country=([^;]+)/)?.[1] || null;

    const res = await fetch("/api/order/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        address: formData.address,
        addressLine2: formData.addressLine2,
        city: formData.city,
        postalCode: formData.postalCode,
        country: formData.country,
        phone: formData.phone,
        format: orderConfig.format,
        people: orderConfig.people,
        animals: orderConfig.animals,
        background: orderConfig.background,
        printOption: orderConfig.printOption,
        // Montant et devise ne sont pas transmis : le serveur les lit sur le
        // PaymentIntent Stripe, seule source fiable de ce qui a ete paye.
        description: orderConfig.description,
        photoUrls: orderConfig.photoUrls,
        style: orderConfig.style,
        detectedCountry,
        gift: formData.gift ?? null,
      }),
    });

    console.log("[CHECKOUT] /api/order/create response status:", res.status);

    if (!res.ok) {
      const err = await res.json();
      console.error("[CHECKOUT] ❌ Erreur création commande:", err);
      throw new Error("Erreur lors de l'enregistrement de la commande.");
    }

    const data = await res.json();
    console.log("[CHECKOUT] ✅ Commande PENDING créée, orderId:", data.orderId);
  };

  // ─── Card payment flow ─────────────────────────────────────────────
  const handleCardPayment = async () => {
    console.log("[CARD] 🚀 Début handleCardPayment");
    if (!stripe || !elements) {
      console.error("[CARD] ❌ stripe ou elements null");
      setError("Le système de paiement n'est pas prêt.");
      return;
    }

    setLoading(true);
    setError("");
    mesure("payment_initiated", { method: "card", value: orderConfig.total, style: orderConfig.style });

    try {
      // 1. Validate elements
      console.log("[CARD] 1. Appel elements.submit()...");
      const { error: submitError } = await elements.submit();
      if (submitError) {
        console.error("[CARD] ❌ elements.submit() erreur:", submitError);
        setError(submitError.message || "Erreur de validation.");
        return;
      }
      console.log("[CARD] ✅ elements.submit() OK");

      // 2. Insert PENDING order
      console.log("[CARD] 2. Insertion commande PENDING...");
      await insertPendingOrder();

      // 3. Confirm payment
      const successUrl = `${window.location.origin}/success`;
      console.log("[CARD] 3. Appel stripe.confirmPayment() | return_url:", successUrl);

      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: successUrl },
        redirect: "if_required",
      });

      console.log("[CARD] 4. Résultat confirmPayment:", {
        error: stripeError?.message || null,
        paymentIntentId: paymentIntent?.id || null,
        paymentIntentStatus: paymentIntent?.status || null,
      });

      if (stripeError) {
        console.error("[CARD] ❌ Erreur Stripe:", stripeError);
        mesure("payment_error", { method: "card", error: stripeError.message, style: orderConfig.style });
        setError(stripeError.message || "Erreur de paiement.");
      } else if (paymentIntent) {
        // Payment succeeded inline — manually redirect
        const redirectUrl = `/success?payment_intent=${paymentIntent.id}`;
        console.log("[CARD] ✅ Paiement inline OK, redirect manuel vers:", redirectUrl);
        window.location.href = redirectUrl;
      } else {
        console.log("[CARD] ℹ️ Ni error ni paymentIntent → Stripe a redirigé automatiquement");
      }
    } catch (err) {
      console.error("[CARD] 💥 Erreur critique:", err);
      setError(messageErreur(err));
    } finally {
      setLoading(false);
    }
  };

  // ─── Express Checkout flow (Apple Pay / Google Pay) ────────────────
  const handleExpressPayment = async () => {
    console.log("[EXPRESS] 🚀 Début handleExpressPayment");
    if (!stripe || !elements) {
      console.error("[EXPRESS] ❌ stripe ou elements null");
      return;
    }

    setLoading(true);
    setError("");
    mesure("payment_initiated", { method: "express", value: orderConfig.total, style: orderConfig.style });

    try {
      // 1. Do NOT call elements.submit() — the wallet already submitted
      // 2. Insert PENDING order BEFORE confirming (redirect will lose JS context)
      console.log("[EXPRESS] 1. Insertion commande PENDING (avant confirm)...");
      await insertPendingOrder();

      // 3. Confirm — no redirect option = defaults to "always"
      const successUrl = `${window.location.origin}/success`;
      console.log("[EXPRESS] 2. Appel stripe.confirmPayment() | return_url:", successUrl);

      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: successUrl },
      });

      // If we reach here, there was an error (redirect didn't happen)
      console.log("[EXPRESS] 3. confirmPayment retourné (pas de redirect!), error:", stripeError?.message || "aucune");
      if (stripeError) {
        console.error("[EXPRESS] ❌ Erreur Express Checkout:", stripeError);
        mesure("payment_error", { method: "express", error: stripeError.message, style: orderConfig.style });
        setError(stripeError.message || "Erreur de paiement.");
      } else {
        // Fallback: shouldn't happen but just in case
        const piId = getPaymentIntentId();
        console.log("[EXPRESS] ⚠️ Pas d'erreur mais pas de redirect. Fallback redirect. PI:", piId);
        window.location.href = `/success?payment_intent=${piId}`;
      }
    } catch (err) {
      console.error("[EXPRESS] 💥 Erreur Express:", err);
      setError(messageErreur(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleCardPayment();
  };

  return (
    /* Le formulaire EST l'etage central de la modale : c'est lui qui defile,
       et son pied reste visible. Avant, les deux boutons se trouvaient au bas
       d'un bloc qui defilait avec le reste. */
    <form onSubmit={handleSubmit} className="paiement-forme">
      <div className="modale__corps">
        <div className="recap-commande">
          <span className="recap-commande__photo">
            {orderConfig.photoUrls[0] ? (
              /* Blob Vercel : hors du domaine configure pour l'optimiseur. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={orderConfig.photoUrls[0]} alt="" />
            ) : (
              <Icone nom="image" taille={22} />
            )}
          </span>
          <div className="recap-commande__corps">
            <div className="recap-commande__support">{orderConfig.printOption}</div>
            <p className="recap-commande__detail">{formData.email}</p>
          </div>
          <div className="recap-commande__prix">
            <b>{montant}</b>
          </div>
        </div>

        {/* Achat express : Apple Pay / Google Pay natifs. */}
        <div className="bloc">
          <div className="bloc__tete">
            <Icone nom="eclair" taille={17} />
            {t("expressCheckout")}
          </div>
          <ExpressCheckoutElement
            onConfirm={async () => {
              await handleExpressPayment();
            }}
          />
        </div>

        <div className="separateur-ou">{t("or")}</div>

        <div className="bloc">
          <div className="bloc__tete">
            <Icone nom="carte-bancaire" taille={17} />
            {t("cardPayment")}
          </div>
          <PaymentElement
            options={{
              fields: {
                billingDetails: {
                  email: "auto" as const,
                  name: "auto" as const,
                  phone: "auto" as const,
                  address: "auto" as const,
                },
              },
            }}
          />
        </div>

        {error && (
          <p className="alerte alerte--erreur" role="alert">
            <Icone nom="alerte" taille={16} />
            {error}
          </p>
        )}
      </div>

      <div className="modale__pied">
        <div className="modale__pied-duo">
          <button type="button" onClick={onClose} className="bouton bouton--fantome">
            {t("cancel")}
          </button>
          <button type="submit" disabled={!stripe || loading} className="bouton bouton--primaire">
            {loading ? t("paymentInProgress") : t("payNow")}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ═══ MODAL ═══════════════════════════════════════════════════════════ */
export default function CheckoutModal({
  open,
  onClose,
  orderConfig,
}: {
  open: boolean;
  onClose: () => void;
  orderConfig: OrderConfig;
}) {
  const t = useTranslations("checkout");
  const [step, setStep] = useState<"info" | "payment" | "success">("info");
  const [clientSecret, setClientSecret] = useState("");
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState("FR");
  const [phonePrefix, setPhonePrefix] = useState("+33");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState("");
  const tCountry = useTranslations("checkout.countries");

  // Options cadeau
  const [estCadeau, setEstCadeau] = useState(false);
  const [messageCadeau, setMessageCadeau] = useState("");
  const [emailDestinataire, setEmailDestinataire] = useState("");
  const [dateRemise, setDateRemise] = useState("");

  /* Une date de remise dans le passe n'a pas de sens : le selecteur commence
     demain. Calcule une fois au montage — `new Date()` au rendu changerait de
     valeur a chaque passage et ferait diverger serveur et navigateur. */
  const [demain] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });

  // Code promo
  const [promoInput, setPromoInput] = useState("");
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number; total: number } | null>(null);

  // Prefill country/phone prefix from the IP-detected country cookie
  useEffect(() => {
    const detected = document.cookie.match(/(?:^| )cartoonova_country=([^;]+)/)?.[1]?.toUpperCase();
    if (detected && COUNTRIES.some((c) => c.code === detected)) {
      setCountryCode(detected);
      setPhonePrefix(getCallingCode(detected));
    }
  }, []);

  /* Comparaison sur la cle du support, pas sur son libelle : `printOption` est
     traduit, et vaut "Digitale" en italien. La comparaison au mot "Digital"
     echouait donc, et le client italien devait remplir nom, adresse, ville,
     code postal et telephone — 13 champs — pour recevoir un fichier par
     e-mail. `printKey` est stable quelle que soit la langue. */
  const isDigital = orderConfig.printKey === "digital";
  const { currency, formatRaw: formatPrice } = useCurrency();

  /** Signature du montant pour lequel `clientSecret` a ete cree, "" si aucun. */
  const signaturePreparee = useRef("");
  /** Numero de la derniere requete lancee : une reponse plus ancienne est ignoree. */
  const numeroRequete = useRef(0);

  // Reset on open/close + track modal open
  useEffect(() => {
    if (!open) {
      setStep("info");
      setClientSecret("");
      // Le secret prepare meurt avec la modale : rouverte, la commande peut
      // avoir change de support ou de devise.
      signaturePreparee.current = "";
      numeroRequete.current++;
      setFormError("");
      setPromoInput("");
      setPromoError("");
      setApplied(null);
      setEstCadeau(false);
      setMessageCadeau("");
      setEmailDestinataire("");
      setDateRemise("");
      return;
    }
    mesure("checkout_modal_opened", {
      style: orderConfig.style,
      value: orderConfig.total,
      format: orderConfig.format,
      print_option: orderConfig.printOption,
      people: orderConfig.people,
      animals: orderConfig.animals,
    });
  }, [open, orderConfig]);

  /* Une boite de dialogue doit se fermer a Echap, et la page derriere ne doit
     pas defiler quand on fait defiler la modale. Ni l'un ni l'autre n'etait
     gere : sur mobile, un doigt sur le formulaire emportait la fiche produit. */
  const boiteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", auClavier);
    const debordementInitial = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    boiteRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", auClavier);
      document.body.style.overflow = debordementInitial;
    };
  }, [open, onClose]);

  const amountDue = applied ? applied.total : orderConfig.total;

  /* ─── preparation anticipee du paiement ───────────────────────────────
     Le PaymentIntent etait cree au clic sur « Continuer vers le paiement » :
     le client attendait alors l'aller-retour serveur (Stripe cree l'intent
     cote API) AVANT que l'iframe de paiement ne commence seulement a se
     monter. On le prepare maintenant des l'ouverture de la modale, pendant
     qu'il remplit ses coordonnees.

     Un intent vaut pour UN montant, et `/api/checkout` en cree un nouveau a
     chaque appel — il n'en met aucun a jour. La signature ci-dessous retient
     le montant pour lequel le secret courant a ete cree ; code promo compris.
     Sans elle, un client qui saisit un code apres l'ouverture paierait le
     montant plein via un secret perime. */
  const signatureMontant = JSON.stringify({
    ...pricingPayload(orderConfig),
    currency,
    promoCode: applied?.code ?? null,
  });
  const preparerPaiement = (signature: string): Promise<boolean> => {
    const numero = ++numeroRequete.current;
    // Pose des maintenant : une seconde passe de l'effet pendant que la
    // requete est en vol ne doit pas creer un intent de plus.
    signaturePreparee.current = signature;

    return fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderConfig: pricingPayload(orderConfig),
        currency,
        promoCode: applied?.code ?? null,
        description: orderConfig.description,
        style: orderConfig.style,
        // Le serveur refuse de creer un PaymentIntent sans photo.
        photoUrls: orderConfig.photoUrls,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (numero !== numeroRequete.current) return false;
        if (!data.clientSecret) {
          signaturePreparee.current = "";
          return false;
        }
        /* On retient le code que le serveur a REELLEMENT accorde, pas celui
           qu'on lui a demande. Un code refuse (expire, inconnu) revient a
           `promoCode: null` et l'intent est deja au montant plein : sans
           cette correction, `setApplied(null)` juste en dessous faisait
           repasser la signature a « sans promo », l'effet ne s'y retrouvait
           plus et creait un troisieme intent pour rien. */
        signaturePreparee.current = JSON.stringify({
          ...pricingPayload(orderConfig),
          currency,
          promoCode: data.promoCode ?? null,
        });
        setClientSecret(data.clientSecret);
        // Le serveur fait foi sur le montant : si le code a expire entre la
        // verification et le paiement, l'affichage suit le montant reel.
        if (typeof data.total === "number") {
          setApplied(
            data.promoCode
              ? { code: data.promoCode, discount: data.discount, total: data.total }
              : null
          );
        }
        return true;
      })
      .catch(() => {
        if (numero === numeroRequete.current) signaturePreparee.current = "";
        return false;
      });
  };

  /* Prepare a l'ouverture, puis a chaque fois que le montant change (code
     promo applique ou retire). En silence : un echec ici ne doit rien
     afficher a quelqu'un qui remplit encore son adresse — `goToPayment`
     reessaiera et parlera, lui. */
  useEffect(() => {
    if (!open || signaturePreparee.current === signatureMontant) return;
    preparerPaiement(signatureMontant);
    // preparerPaiement est recreee a chaque rendu ; la garde de signature
    // ci-dessus est ce qui empeche les appels en double, pas les dependances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, signatureMontant]);

  /* Le recapitulatif titre deja le support choisi : le repeter dans la ligne
     de detail donnait « Portrait Encadré / Portrait · 1 personne · Namek ·
     Portrait Encadré ». La note libre pour l'artiste, elle, est ajoutee apres
     un « | » et doit rester intacte. */
  const [optionsCommande, noteCommande] = orderConfig.description.split(" | ");
  const detailCommande = optionsCommande
    .split(" · ")
    .filter((part) => part !== orderConfig.printOption)
    .join(" · ");

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code || promoChecking) return;

    setPromoChecking(true);
    setPromoError("");

    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderConfig: pricingPayload(orderConfig),
          currency,
          promoCode: code,
        }),
      });
      const data = await res.json();

      if (res.ok && data.valid) {
        setApplied({ code, discount: data.discount, total: data.total });
        mesure("promo_code_applied", { code, discount: data.discount, style: orderConfig.style });
      } else {
        setApplied(null);
        setPromoError(t("promoInvalid"));
        mesure("promo_code_rejected", { code, reason: data.reason ?? "unknown" });
      }
    } catch {
      setApplied(null);
      setPromoError(t("errorTechnical"));
    } finally {
      setPromoChecking(false);
    }
  };

  // Create Payment Intent when moving to payment step (NO DB insert here)
  const goToPayment = () => {
    setFormError("");

    if (!email.trim() || !email.includes("@")) {
      setFormError(t("errorValidEmail"));
      return;
    }
    if (!isDigital) {
      if (!firstName.trim() || !lastName.trim()) {
        setFormError(t("errorNameRequired"));
        return;
      }
      if (!address.trim() || !city.trim() || !postalCode.trim()) {
        setFormError(t("errorAddressRequired"));
        return;
      }
      if (!phone.trim()) {
        setFormError(t("errorPhoneRequired"));
        return;
      }
    }

    // L'e-mail du destinataire est facultatif, mais s'il est saisi il doit etre
    // valide : c'est la seule adresse qui recevra le portrait.
    if (estCadeau && emailDestinataire.trim() && !emailDestinataire.includes("@")) {
      setFormError(t("errorValidEmail"));
      return;
    }

    mesure("checkout_info_completed", {
      style: orderConfig.style,
      value: orderConfig.total,
      is_digital: isDigital,
      has_address: !isDigital,
    });

    setStep("payment");

    // Prepare pendant la saisie et toujours valable pour ce montant : on
    // enchaine directement sur le formulaire de carte, sans attente.
    if (clientSecret && signaturePreparee.current === signatureMontant) return;

    setLoadingIntent(true);
    preparerPaiement(signatureMontant).then((pret) => {
      setLoadingIntent(false);
      if (pret) return;
      /* Echec : on ramene a l'etape 1 pour montrer l'erreur. Avant, l'etape
         de paiement restait affichee sans secret — et comme sa condition
         d'attente est `loadingIntent || !clientSecret`, le rond tournait
         indefiniment sur un tunnel deja mort. */
      setStep("info");
      setFormError(t("errorPaymentInit"));
    });
  };

  if (!open) return null;

  const titreEtape =
    step === "success" ? t("orderConfirmed") : step === "payment" ? t("securePayment") : t("yourInfo");
  const sousEtape =
    step === "success"
      ? t("thankYou")
      : step === "payment"
        ? t("paymentMethods")
        : isDigital
          ? t("digitalDelivery")
          : t("physicalDelivery");

  return (
    <div data-checkout-modal className="modale animate-fadeIn">
      <div className="modale__voile" onClick={onClose} />

      <div
        className="modale__boite"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modale-titre"
        ref={boiteRef}
      >
        <div className="modale__entete">
          <span className="modale__entete-icone">
            <Icone
              nom={step === "success" ? "fete" : step === "payment" ? "carte-bancaire" : "presse-papiers"}
              taille={22}
            />
          </span>
          <div className="modale__entete-texte">
            <p className="modale__titre" id="modale-titre">{titreEtape}</p>
            <p className="modale__sous">{sousEtape}</p>
          </div>
          {step !== "success" && (
            <span className="modale__compteur">
              {step === "info" ? t("step1Of2") : t("step2Of2")}
            </span>
          )}
          <button type="button" onClick={onClose} className="modale__fermer" aria-label={t("close")}>
            <Icone nom="croix" taille={15} />
          </button>
        </div>

        {/* Avancement du tunnel : lisible sans être lu. */}
        <div className="modale__jauge" aria-hidden="true">
          <span style={{ width: step === "info" ? "50%" : "100%" }} />
        </div>

        {/* ─── STEP 1: INFO ─── */}
        {step === "info" && (
          <>
            <div className="modale__corps">
              {/* Recapitulatif. La photo envoyee par le client n'apparaissait
                  nulle part dans le tunnel : c'est pourtant la seule chose qui
                  prouve qu'on paie pour LE bon portrait. */}
              <div className="recap-commande">
                <span className="recap-commande__photo">
                  {orderConfig.photoUrls[0] ? (
                    /* Blob Vercel : hors du domaine configure pour l'optimiseur. */
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={orderConfig.photoUrls[0]} alt="" />
                  ) : (
                    <Icone nom="image" taille={22} />
                  )}
                </span>
                <div className="recap-commande__corps">
                  <div className="recap-commande__support">{orderConfig.printOption}</div>
                  <p className="recap-commande__detail">
                    {detailCommande}
                    {noteCommande && ` — « ${noteCommande} »`}
                  </p>
                </div>
                <div className="recap-commande__prix">
                  {applied && <s>{formatPrice(orderConfig.total)}</s>}
                  <b>{formatPrice(amountDue)}</b>
                </div>
              </div>

              {!isDigital && (
                <p className="modale__rassurance">
                  <Icone nom="cadeau" taille={13} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
                  {t("orderByGuidance")}
                </p>
              )}

              <div className="champ-groupe">
                <label className={labelClass} htmlFor="checkout-email">{t("emailAddress")}</label>
                <input
                  id="checkout-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className={inputClass}
                />
              </div>

              {/* Physical-only fields */}
              {!isDigital && (
                <>
                  <div className="champ-duo">
                    <div className="champ-groupe">
                      <label className={labelClass} htmlFor="checkout-prenom">{t("firstName")}</label>
                      <input id="checkout-prenom" type="text" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t("firstNamePlaceholder")} className={inputClass} />
                    </div>
                    <div className="champ-groupe">
                      <label className={labelClass} htmlFor="checkout-nom">{t("lastName")}</label>
                      <input id="checkout-nom" type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t("lastNamePlaceholder")} className={inputClass} />
                    </div>
                  </div>

                  <div className="champ-groupe">
                    <label className={labelClass} htmlFor="checkout-adresse">{t("address")}</label>
                    <input id="checkout-adresse" type="text" autoComplete="address-line1" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("addressPlaceholder")} className={inputClass} />
                  </div>

                  <div className="champ-groupe">
                    <label className={labelClass} htmlFor="checkout-adresse2">{t("addressLine2")}</label>
                    <input id="checkout-adresse2" type="text" autoComplete="address-line2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder={t("addressLine2Placeholder")} className={inputClass} />
                  </div>

                  <div className="champ-duo">
                    <div className="champ-groupe">
                      <label className={labelClass} htmlFor="checkout-ville">{t("city")}</label>
                      <input id="checkout-ville" type="text" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("cityPlaceholder")} className={inputClass} />
                    </div>
                    <div className="champ-groupe">
                      <label className={labelClass} htmlFor="checkout-cp">{t("postalCode")}</label>
                      <input id="checkout-cp" type="text" autoComplete="postal-code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder={t("postalCodePlaceholder")} className={inputClass} />
                    </div>
                  </div>

                  <div className="champ-groupe">
                    <label className={labelClass} htmlFor="checkout-pays">{t("country")}</label>
                    <select id="checkout-pays" autoComplete="country-name" value={countryCode} onChange={(e) => { setCountryCode(e.target.value); setPhonePrefix(getCallingCode(e.target.value)); }} className={inputClass}>
                      {[...COUNTRIES]
                        .sort((a, b) => tCountry(a.code).localeCompare(tCountry(b.code)))
                        .map((c) => (
                          <option key={c.code} value={c.code}>{tCountry(c.code)}</option>
                        ))}
                    </select>
                  </div>

                  <div className="champ-duo champ-duo--prefixe">
                    <div className="champ-groupe">
                      <label className={labelClass} htmlFor="checkout-prefixe">{t("phonePrefix")}</label>
                      <select id="checkout-prefixe" value={phonePrefix} onChange={(e) => setPhonePrefix(e.target.value)} className={inputClass}>
                        {[...new Set(COUNTRIES.map((c) => c.callingCode))]
                          .sort((a, b) => Number(a.replace("+", "")) - Number(b.replace("+", "")))
                          .map((code) => (
                            <option key={code} value={code}>{code}</option>
                          ))}
                      </select>
                    </div>
                    <div className="champ-groupe">
                      <label className={labelClass} htmlFor="checkout-tel">{t("phone")}</label>
                      <input id="checkout-tel" type="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("phonePlaceholder")} className={inputClass} />
                    </div>
                  </div>
                </>
              )}

              <div className="champ-groupe">
                <label className={labelClass} htmlFor="promo-code">{t("promoLabel")}</label>
                <div className="champ-avec-bouton">
                  <input
                    id="promo-code"
                    type="text"
                    value={promoInput}
                    onChange={(e) => {
                      setPromoInput(e.target.value.toUpperCase());
                      setPromoError("");
                    }}
                    placeholder={t("promoPlaceholder")}
                    autoComplete="off"
                    className={inputClass}
                    style={{ textTransform: "uppercase" }}
                  />
                  <button
                    type="button"
                    onClick={applyPromo}
                    disabled={promoChecking || !promoInput.trim()}
                    className="bouton bouton--fantome"
                    style={{ padding: "12px 20px", fontSize: 15, minHeight: 0, flex: "none" }}
                  >
                    {t("promoApply")}
                  </button>
                </div>
                {applied && (
                  <p className="alerte alerte--succes">
                    <Icone nom="coche" taille={15} />
                    {t("promoApplied", { code: applied.code })} — −{formatPrice(applied.discount)}
                  </p>
                )}
                {promoError && (
                  <p className="alerte alerte--erreur" role="alert">
                    <Icone nom="alerte" taille={15} />
                    {promoError}
                  </p>
                )}
              </div>

              {/* ─── OPTIONS CADEAU ───
                  Toute la marque parle de cadeau — pages « idées cadeaux »,
                  date limite de commande, occasions — mais au moment de payer
                  rien n'était prévu pour offrir. Replié par défaut : ceux qui
                  achètent pour eux ne voient qu'une ligne de plus. */}
              <div className="bloc">
                <button
                  type="button"
                  onClick={() => setEstCadeau((v) => !v)}
                  aria-expanded={estCadeau}
                  className="cadeau__bascule"
                >
                  <span className="cadeau__case" aria-hidden="true">
                    {estCadeau && <Icone nom="coche" taille={13} />}
                  </span>
                  <span className="cadeau__titre">
                    <Icone nom="cadeau" taille={15} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 7 }} />
                    {t("giftToggle")}
                  </span>
                  <span className="cadeau__aide">{t("giftHint")}</span>
                </button>

                {estCadeau && (
                  <div className="cadeau__champs">
                    <div className="champ-groupe">
                      <label className={labelClass} htmlFor="cadeau-message">
                        {t("giftMessageLabel")}
                      </label>
                      <textarea
                        id="cadeau-message"
                        value={messageCadeau}
                        maxLength={300}
                        onChange={(e) => setMessageCadeau(e.target.value)}
                        placeholder={t("giftMessagePlaceholder")}
                        className={inputClass}
                        style={{ minHeight: 78, resize: "vertical" }}
                      />
                    </div>

                    <div className="champ-groupe">
                      <label className={labelClass} htmlFor="cadeau-email">
                        {t("giftRecipientLabel")}
                      </label>
                      <input
                        id="cadeau-email"
                        type="email"
                        value={emailDestinataire}
                        onChange={(e) => setEmailDestinataire(e.target.value)}
                        placeholder="destinataire@email.com"
                        autoComplete="off"
                        className={inputClass}
                      />
                      <p className="cadeau__note">{t("giftRecipientHint")}</p>
                    </div>

                    <div className="champ-groupe">
                      <label className={labelClass} htmlFor="cadeau-date">
                        {t("giftDateLabel")}
                      </label>
                      <input
                        id="cadeau-date"
                        type="date"
                        value={dateRemise}
                        min={demain}
                        onChange={(e) => setDateRemise(e.target.value)}
                        className={inputClass}
                      />
                      <p className="cadeau__note">{t("giftDateHint")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pied fixe : le total et l'action ne quittent plus l'ecran. Sur
                un support physique, le formulaire fait treize champs — le
                bouton se trouvait tout en bas, apres le telephone. */}
            <div className="modale__pied">
              {formError && (
                <p className="alerte alerte--erreur" role="alert">
                  <Icone nom="alerte" taille={16} />
                  {formError}
                </p>
              )}
              <div className="modale__total">
                <span>{t("totalToPay")}</span>
                <b>
                  {applied && <s>{formatPrice(orderConfig.total)}</s>}
                  {formatPrice(amountDue)}
                </b>
              </div>
              <button type="button" onClick={goToPayment} className="bouton bouton--primaire">
                {t("continueToPayment")}
              </button>
              <p className="modale__rassurance">
                <Icone nom="cadenas" taille={13} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
                {t("securePayment")} · {t("cardNeverStored")}
              </p>
            </div>
          </>
        )}

        {/* ─── STEP 2: PAYMENT ─── */}
        {step === "payment" && (
          <>
            {loadingIntent || !clientSecret ? (
              <div className="modale__corps">
                <div className="modale__chargement">
                  <div className="rotatif" />
                  <p>{t("loadingPayment")}</p>
                </div>
              </div>
            ) : (
              /* Habillage de l'iframe Stripe. Il portait encore le theme
                 neo-brutaliste du site precedent : bordures noires de 2px,
                 ombre portee dure « 4px 4px 0 noir », jaune #facc15 (celui de
                 Tailwind, pas le notre) et une police Poppins que le site ne
                 charge plus depuis le passage a ToonJaune — le cadre de
                 paiement s'affichait donc dans une autre typographie, une
                 autre couleur et un autre style que la modale qui l'entoure.
                 Recale sur les jetons : #E9BA3B, encre #2A2552, rayon 14. */
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      appearance: {
                        theme: "flat",
                        variables: {
                          colorBackground: "#FFFFFF",
                          colorPrimary: "#E9BA3B",
                          colorText: "#2A2552",
                          colorTextSecondary: "#5A5578",
                          colorDanger: "#C8202F",
                          borderRadius: "14px",
                          spacingUnit: "4px",
                          /* Rebond est servi depuis /public : une iframe d'un
                             autre domaine ne peut pas la charger sans en-tetes
                             CORS. Pile systeme plutot qu'une police fantome. */
                          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
                          fontWeightNormal: "500",
                        },
                        rules: {
                          ".Input": {
                            border: "1.5px solid rgba(42, 37, 82, .18)",
                            boxShadow: "none",
                            padding: "12px 14px",
                          },
                          ".Input:focus": {
                            border: "1.5px solid transparent",
                            outline: "2px solid #E9BA3B",
                            boxShadow: "none",
                          },
                          ".Label": {
                            fontWeight: "700",
                            fontSize: "12.5px",
                            textTransform: "uppercase",
                            letterSpacing: ".05em",
                            color: "#5A5578",
                          },
                          ".AccordionItem": {
                            border: "1.5px solid rgba(42, 37, 82, .18)",
                            borderRadius: "14px",
                            marginBottom: "10px",
                            boxShadow: "none",
                          },
                          ".AccordionItem--selected": {
                            backgroundColor: "#FFF9ED",
                            border: "2px solid #E9BA3B",
                          },
                          ".Tab": {
                            border: "1.5px solid rgba(42, 37, 82, .18)",
                            borderRadius: "14px",
                            boxShadow: "none",
                          },
                          ".Tab--selected": {
                            backgroundColor: "#FFF9ED",
                            border: "2px solid #E9BA3B",
                            color: "#2A2552",
                          },
                        },
                      },
                    }}
                  >
                    <PaymentForm
                      onClose={() => setStep("info")}
                      clientSecret={clientSecret}
                      formData={{
                        email,
                        firstName,
                        lastName,
                        address,
                        addressLine2,
                        city,
                        postalCode,
                        country: tCountry(countryCode),
                        phone: `${phonePrefix} ${phone}`.trim(),
                        gift: estCadeau
                          ? {
                              message: messageCadeau.trim() || null,
                              recipientEmail: emailDestinataire.trim() || null,
                              deliverAfter: dateRemise || null,
                            }
                          : null,
                      }}
                      orderConfig={orderConfig}
                      montant={formatPrice(amountDue)}
                    />
                  </Elements>
            )}
          </>
        )}

        {/* ─── STEP 3: SUCCESS ─── */}
        {step === "success" && (
          <>
            <div className="modale__corps">
              {processing ? (
                <div className="modale__chargement">
                  <div className="rotatif" />
                  <p>{t("savingOrder")}</p>
                </div>
              ) : (
                <div className="modale__succes">
                  <Icone nom="fete" taille={54} style={{ margin: "0 auto 16px", color: "var(--accent-texte)" }} />
                  <h3>{t("orderConfirmedTitle")}</h3>
                  <p>
                    {t("confirmationEmailSent")} <strong>{email}</strong>.
                  </p>
                  <p>{t("artistsAtWork")}</p>
                </div>
              )}
            </div>
            {!processing && (
              <div className="modale__pied">
                <button type="button" onClick={onClose} className="bouton bouton--primaire">
                  {t("close")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
