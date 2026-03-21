"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, PaymentRequestButtonElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { processOrder } from "@/actions/order";

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
  onSuccess,
  onClose,
  clientSecret,
  formData,
  orderConfig,
  isDigital,
}: {
  onSuccess: (paymentId: string) => void;
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
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.origin + "/product" },
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message || "Erreur de paiement.");
      setLoading(false);
    } else {
      setLoading(false);
      onSuccess(paymentIntent?.id || "");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Payment Element - Apple Pay / Google Pay / Carte */}
      <div className="bg-white border-2 border-black rounded-xl p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">💳</span>
          <h4 className="font-black text-black text-sm">Méthodes de paiement</h4>
        </div>
        <PaymentElement 
          options={{
            paymentMethodOrder: ['apple_pay', 'google_pay', 'card'],
            fields: {
              billingDetails: "never"
            }
          }}
        />
      </div>

      {error && (
        <div className="bg-red-100 border-2 border-red-500 rounded-xl p-3 text-sm font-bold text-red-700 text-center shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 bg-white text-black font-black text-sm uppercase py-3.5 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-[2] bg-yellow-400 text-black font-black text-sm uppercase py-3.5 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Paiement en cours..." : "Payer maintenant 💳"}
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

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setStep("info");
      setClientSecret("");
      setFormError("");
      return;
    }
  }, [open]);

  // Create Payment Intent when moving to payment step
  const goToPayment = () => {
    setFormError("");

    // Validate
    if (!email.trim() || !email.includes("@")) {
      setFormError("Veuillez entrer un email valide.");
      return;
    }
    if (!isDigital) {
      if (!firstName.trim() || !lastName.trim()) {
        setFormError("Veuillez entrer votre prénom et nom.");
        return;
      }
      if (!address.trim() || !city.trim() || !postalCode.trim()) {
        setFormError("Veuillez remplir l'adresse complète.");
        return;
      }
      if (!phone.trim()) {
        setFormError("Veuillez entrer votre numéro de téléphone.");
        return;
      }
    }

    setStep("payment");
    setLoadingIntent(true);

    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: orderConfig.total * 100,
        description: orderConfig.description,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) setClientSecret(data.clientSecret);
        setLoadingIntent(false);
      })
      .catch(() => setLoadingIntent(false));
  };

  // After payment success → process order
  const handlePaymentSuccess = async (paymentId: string) => {
    setProcessing(true);
    try {
      await processOrder({
        email,
        firstName: isDigital ? undefined : firstName,
        lastName: isDigital ? undefined : lastName,
        address: isDigital ? undefined : address,
        city: isDigital ? undefined : city,
        postalCode: isDigital ? undefined : postalCode,
        country: isDigital ? undefined : country,
        phone: isDigital ? undefined : phone,
        format: orderConfig.format,
        people: orderConfig.people,
        animals: orderConfig.animals,
        background: orderConfig.background,
        printOption: orderConfig.printOption,
        total: orderConfig.total,
        description: orderConfig.description,
        photoUrls: orderConfig.photoUrls,
        stripePaymentId: paymentId,
      });
    } catch (e) {
      console.error("processOrder error:", e);
    }
    setProcessing(false);
    setStep("success");
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
                {step === "success" ? "Commande confirmée" : step === "payment" ? "Paiement sécurisé" : "Vos informations"}
              </p>
              <p className="text-xs font-bold text-black/60">
                {step === "success" ? "Merci !" : step === "payment" ? "Powered by Stripe" : isDigital ? "Livraison digitale" : "Livraison physique"}
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
                    <p className="text-xs font-black text-black/40 uppercase tracking-wider">Total à payer</p>
                    <p className="text-3xl font-black text-black">{orderConfig.total} €</p>
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
                <label className={labelClass}>📧 Adresse email *</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="votre@email.com" 
                  className={`${inputClass} focus:ring-4 focus:ring-yellow-300 transition-all`}
                />
              </div>

              {/* Physical-only fields */}
              {!isDigital && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Prénom *</label>
                      <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Nom *</label>
                      <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" className={inputClass} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>📍 Adresse *</label>
                    <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 rue de la Paix" className={inputClass} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Ville *</label>
                      <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Paris" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Code postal *</label>
                      <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="75001" className={inputClass} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>🌍 Pays</label>
                      <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>📞 Téléphone *</label>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+33 6 12 34 56 78" className={inputClass} />
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
                Continuer vers le paiement →
              </button>
            </div>
          )}

          {/* ─── STEP 2: PAYMENT ─── */}
          {step === "payment" && (
            <>
              {loadingIntent || !clientSecret ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 border-4 border-black border-t-yellow-400 rounded-full animate-spin mx-auto mb-4" />
                  <p className="font-black text-black/60 text-sm uppercase">Chargement du paiement...</p>
                </div>
              ) : (
                <>
                  <div className="bg-white border-2 border-black rounded-xl p-4 mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-black/40 uppercase">Total à payer</p>
                      <p className="text-2xl font-black text-black">{orderConfig.total} €</p>
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
                          colorPrimary: "#facc15",
                          colorBackground: "#ffffff",
                          colorText: "#000000",
                          borderRadius: "12px",
                          fontFamily: "Poppins, system-ui, sans-serif",
                          fontWeightNormal: "600",
                        },
                      },
                    }}
                  >
                    <PaymentForm
                      onSuccess={handlePaymentSuccess}
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
                  <p className="font-black text-black/60 text-sm uppercase">Enregistrement de votre commande...</p>
                </>
              ) : (
                <>
                  <span className="text-6xl block mb-4">🎉</span>
                  <h3 className="text-xl font-black text-black uppercase mb-2">Commande confirmée !</h3>
                  <p className="text-sm font-bold text-black/60 mb-2">
                    Un email de confirmation a été envoyé à <strong className="text-black">{email}</strong>.
                  </p>
                  <p className="text-sm font-bold text-black/60 mb-6">
                    Nos artistes se mettent au travail immédiatement pour créer votre chef-d&apos;œuvre cartoon !
                  </p>
                  <button
                    onClick={onClose}
                    className="bg-yellow-400 text-black font-black text-sm uppercase px-8 py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                  >
                    Fermer
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
