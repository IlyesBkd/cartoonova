"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, ExpressCheckoutElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useCurrency } from "@/components/CurrencyProvider";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

/* ─── Shared input style ──────────────────────────────────────────── */
const inputClass =
  "w-full px-4 py-3 text-sm font-bold bg-white border-2 border-black rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-black/30";
const labelClass = "text-xs font-black text-black uppercase mb-1 block";

/* ─── Types ───────────────────────────────────────────────────────── */
interface OrderConfig {
  format: "portrait" | "fullbody";
  people: number;
  animals: number;
  background: string;
  printOption: string;
  total: number;
  description: string;
  photoUrls: string[];
}

/* ─── Payment Form ────────────────────────────────────────────────── */
function PaymentForm({
  onClose,
  clientSecret,
  formData,
  orderConfig,
  isDigital,
  currency,
}: {
  onClose: () => void;
  clientSecret: string;
  formData: {
    email: string;
    firstName?: string;
    lastName?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  };
  orderConfig: OrderConfig;
  isDigital: boolean;
  currency: string;
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

    const res = await fetch("/api/order/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        address: formData.address,
        city: formData.city,
        postalCode: formData.postalCode,
        country: formData.country,
        phone: formData.phone,
        format: orderConfig.format,
        people: orderConfig.people,
        animals: orderConfig.animals,
        background: orderConfig.background,
        printOption: orderConfig.printOption,
        total: orderConfig.total,
        currency,
        description: orderConfig.description,
        photoUrls: orderConfig.photoUrls,
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
        setError(stripeError.message || "Erreur de paiement.");
      } else if (paymentIntent) {
        // Payment succeeded inline — manually redirect
        const redirectUrl = `/success?payment_intent=${paymentIntent.id}`;
        console.log("[CARD] ✅ Paiement inline OK, redirect manuel vers:", redirectUrl);
        window.location.href = redirectUrl;
      } else {
        console.log("[CARD] ℹ️ Ni error ni paymentIntent → Stripe a redirigé automatiquement");
      }
    } catch (err: any) {
      console.error("[CARD] 💥 Erreur critique:", err);
      setError(err.message || "Une erreur technique est survenue.");
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
        setError(stripeError.message || "Erreur de paiement.");
      } else {
        // Fallback: shouldn't happen but just in case
        const piId = getPaymentIntentId();
        console.log("[EXPRESS] ⚠️ Pas d'erreur mais pas de redirect. Fallback redirect. PI:", piId);
        window.location.href = `/success?payment_intent=${piId}`;
      }
    } catch (err: any) {
      console.error("[EXPRESS] 💥 Erreur Express:", err);
      setError(err.message || "Une erreur technique est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleCardPayment();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Express Checkout - Apple Pay / Google Pay natif */}
      <div className="bg-white border-2 border-black rounded-xl p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">⚡</span>
          <h4 className="font-black text-black text-sm">{t("expressCheckout") || "Achat express"}</h4>
        </div>
        <ExpressCheckoutElement
          onConfirm={async () => {
            await handleExpressPayment();
          }}
        />
      </div>

      {/* Séparateur */}
      <div className="flex items-center gap-4 my-2">
        <div className="flex-1 h-px bg-black/20"></div>
        <span className="text-xs font-black text-black/40 uppercase">{t("or") || "OU"}</span>
        <div className="flex-1 h-px bg-black/20"></div>
      </div>

      {/* Payment Element - Carte classique */}
      <div className="bg-white border-2 border-black rounded-xl p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">💳</span>
          <h4 className="font-black text-black text-sm">{t("cardPayment") || "Paiement par carte"}</h4>
        </div>
        <PaymentElement 
          options={{
            paymentMethodOrder: ['card'],
            fields: {
              billingDetails: {
                email: 'auto' as const,
                name: 'auto' as const,
                phone: 'auto' as const,
                address: 'auto' as const
              }
            }
          }}
        />
      </div>

      {error && (
        <div className="bg-red-100 border-2 border-red-500 rounded-xl p-3 text-sm font-bold text-red-700 text-center">
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 bg-white text-black font-black text-sm uppercase py-3.5 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-[2] bg-yellow-400 text-black font-black text-sm uppercase py-3.5 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t("paymentInProgress") : t("payNow")}
        </button>
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
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("France");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState("");

  const isDigital = orderConfig.printOption === "Digital";
  const { currency, format: formatPrice, convert } = useCurrency();

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setStep("info");
      setClientSecret("");
      setFormError("");
      return;
    }
  }, [open]);

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

    setStep("payment");
    setLoadingIntent(true);

    const convertedTotal = convert(orderConfig.total);

    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(convertedTotal * 100),
        currency: currency.toLowerCase(),
        description: orderConfig.description,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setFormError(t("errorPaymentInit"));
        }
        setLoadingIntent(false);
      })
      .catch(() => {
        setFormError(t("errorTechnical"));
        setLoadingIntent(false);
      });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-gradient-to-br from-yellow-50 to-yellow-100 border-4 border-black rounded-2xl shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transform transition-all duration-300 scale-100 hover:scale-[1.02]">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-300 border-b-4 border-black px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-bounce">{step === "success" ? "🎉" : step === "payment" ? "💳" : "📋"}</span>
            <div>
              <p className="font-black text-black text-sm uppercase tracking-wide">
                {step === "success" ? t("orderConfirmed") : step === "payment" ? t("securePayment") : t("yourInfo")}
              </p>
              <p className="text-xs font-bold text-black/60">
                {step === "success" ? t("thankYou") : step === "payment" ? t("poweredByStripe") : isDigital ? t("digitalDelivery") : t("physicalDelivery")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center font-black text-black text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer hover:bg-red-50"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {/* ─── STEP 1: INFO ─── */}
          {step === "info" && (
            <div className="flex flex-col gap-4">
              {/* Order summary */}
              <div className="bg-gradient-to-r from-white to-yellow-50 border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-black/40 uppercase tracking-wider">{t("totalToPay")}</p>
                    <p className="text-3xl font-black text-black">{formatPrice(orderConfig.total)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-black/40 max-w-[200px]">{orderConfig.description}</p>
                    <div className="mt-2 px-3 py-1 bg-yellow-400 border border-black rounded-full inline-block">
                      <span className="text-xs font-black text-black uppercase">{orderConfig.printOption}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Email — always required */}
              <div className="space-y-2">
                <label className={labelClass}>{t("emailAddress")}</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder={t("emailPlaceholder")} 
                  className={`${inputClass} focus:ring-4 focus:ring-yellow-300 transition-all`}
                />
              </div>

              {/* Physical-only fields */}
              {!isDigital && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>{t("firstName")}</label>
                      <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t("firstNamePlaceholder")} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>{t("lastName")}</label>
                      <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t("lastNamePlaceholder")} className={inputClass} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>{t("address")}</label>
                    <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("addressPlaceholder")} className={inputClass} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>{t("city")}</label>
                      <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("cityPlaceholder")} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>{t("postalCode")}</label>
                      <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder={t("postalCodePlaceholder")} className={inputClass} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>{t("country")}</label>
                      <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>{t("phone")}</label>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("phonePlaceholder")} className={inputClass} />
                    </div>
                  </div>
                </>
              )}

              {formError && (
                <div className="bg-red-100 border-2 border-red-500 rounded-xl p-3 text-sm font-bold text-red-700 text-center">
                  {formError}
                </div>
              )}

              <button
                onClick={goToPayment}
                className="w-full bg-yellow-400 text-black font-black text-sm uppercase py-4 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
              >
                {t("continueToPayment")}
              </button>
            </div>
          )}

          {/* ─── STEP 2: PAYMENT ─── */}
          {step === "payment" && (
            <>
              {loadingIntent || !clientSecret ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 border-4 border-black border-t-yellow-400 rounded-full animate-spin mx-auto mb-4" />
                  <p className="font-black text-black/60 text-sm uppercase">{t("loadingPayment")}</p>
                </div>
              ) : (
                <>
                  <div className="bg-white border-2 border-black rounded-xl p-4 mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-black/40 uppercase">{t("totalToPay")}</p>
                      <p className="text-2xl font-black text-black">{formatPrice(orderConfig.total)}</p>
                    </div>
                    <p className="text-xs font-bold text-black/40">{email}</p>
                  </div>

                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      appearance: {
                        theme: "flat",
                        variables: {
                          colorBackground: "#ffffff",
                          colorPrimary: "#facc15",
                          colorText: "#000000",
                          borderRadius: "8px",
                          fontFamily: "Poppins, system-ui, sans-serif",
                          fontWeightNormal: "600",
                        },
                        rules: {
                          ".Input": {
                            border: "2px solid #000",
                            boxShadow: "none",
                          },
                          ".Input:focus": {
                            border: "2px solid #000",
                            boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
                          },
                          ".AccordionItem": {
                            border: "2px solid #000",
                            borderRadius: "8px",
                            marginBottom: "12px",
                          },
                          ".AccordionItem--selected": {
                            backgroundColor: "#fefce8",
                            border: "3px solid #000",
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
                        city,
                        postalCode,
                        country,
                        phone,
                      }}
                      orderConfig={orderConfig}
                      isDigital={isDigital}
                      currency={currency.toLowerCase()}
                    />
                  </Elements>
                </>
              )}
            </>
          )}

          {/* ─── STEP 3: SUCCESS ─── */}
          {step === "success" && (
            <div className="text-center py-6">
              {processing ? (
                <>
                  <div className="w-12 h-12 border-4 border-black border-t-yellow-400 rounded-full animate-spin mx-auto mb-4" />
                  <p className="font-black text-black/60 text-sm uppercase">{t("savingOrder")}</p>
                </>
              ) : (
                <>
                  <span className="text-6xl block mb-4">🎉</span>
                  <h3 className="text-xl font-black text-black uppercase mb-2">{t("orderConfirmedTitle")}</h3>
                  <p className="text-sm font-bold text-black/60 mb-2">
                    {t("confirmationEmailSent")} <strong className="text-black">{email}</strong>.
                  </p>
                  <p className="text-sm font-bold text-black/60 mb-6">
                    {t("artistsAtWork")}
                  </p>
                  <button
                    onClick={onClose}
                    className="bg-yellow-400 text-black font-black text-sm uppercase px-8 py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                  >
                    {t("close")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
