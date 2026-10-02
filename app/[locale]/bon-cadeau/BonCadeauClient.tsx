"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useCurrency } from "@/components/CurrencyProvider";
import { montantsBon } from "@/lib/bonCadeauMontants";
import Icone from "@/components/tj/Icone";
import { emailValide } from "@/lib/email";

/* Achat d'un bon cadeau : un montant, l'e-mail de l'acheteur, un prenom et un
   message facultatifs, puis le paiement. Le bon (code + version imprimable)
   s'affiche sur la page de succes et part par e-mail. */

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

/* Meme habillage que l'iframe de paiement de la caisse (CheckoutModal). */
const APPARENCE = {
  theme: "flat" as const,
  variables: {
    colorBackground: "#FFFFFF",
    colorPrimary: "#E9BA3B",
    colorText: "#2A2552",
    colorDanger: "#C8202F",
    borderRadius: "14px",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  rules: {
    ".Input": { border: "1.5px solid rgba(42, 37, 82, .18)", boxShadow: "none" },
  },
};

function Paiement({ libelle, enCours }: { libelle: string; enCours: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const locale = useLocale();
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  // Le bouton attend que le formulaire Stripe soit pret : avant, un clic
  // partait sur un formulaire encore vide.
  const [pret, setPret] = useState(false);

  const payer = async () => {
    if (!stripe || !elements) return;
    setOccupe(true);
    setErreur("");
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/success?lang=${locale}` },
    });
    // On n'arrive ici qu'en cas d'echec : sinon Stripe a deja redirige.
    if (error) setErreur(error.message ?? "");
    setOccupe(false);
  };

  return (
    <div className="bon-achat__paiement">
      {/* Memes reglages que la caisse des portraits (CheckoutModal) : la carte
          ouverte d'emblee, en tete. Avec la disposition par defaut, la carte
          etait repliee parmi Klarna, Bancontact, EPS…, et rien ne disait
          qu'il fallait la toucher pour saisir son numero. */}
      <PaymentElement
        onReady={() => setPret(true)}
        options={{
          layout: { type: "accordion", defaultCollapsed: false, radios: false, spacedAccordionItems: true },
          paymentMethodOrder: ["card"],
        }}
      />
      {erreur && (
        <p className="alerte alerte--erreur" role="alert">
          <Icone nom="alerte" taille={16} />
          {erreur}
        </p>
      )}
      <button type="button" className="bouton bouton--primaire" disabled={!stripe || !pret || occupe} onClick={payer}>
        {occupe ? enCours : libelle}
      </button>
    </div>
  );
}

export default function BonCadeauClient() {
  const t = useTranslations("bonCadeau");
  const locale = useLocale();
  const { currency, formatRaw } = useCurrency();
  const montants = montantsBon(currency);

  const [montant, setMontant] = useState<number>(montants[1]);
  const [email, setEmail] = useState("");
  const [prenom, setPrenom] = useState("");
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  // La devise peut changer apres le premier rendu : le montant suit.
  const montantValide = montants.includes(montant) ? montant : montants[1];

  const continuer = async () => {
    setErreur("");
    if (!emailValide(email)) {
      setErreur(t("erreurEmail"));
      return;
    }
    setChargement(true);
    try {
      const r = await fetch("/api/bon-cadeau/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montant: montantValide, currency, email: email.trim(), prenom, message, lang: locale }),
      });
      const data = await r.json();
      if (!r.ok || !data.clientSecret) throw new Error(data.error);
      setSecret(data.clientSecret);
    } catch {
      setErreur(t("erreur"));
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="section">
      <div className="enveloppe bon-achat">
        <div className="chapeau">
          <h1>
            {t("titre")} <span className="accent">{t("accent")}</span>
          </h1>
          <p>{t("sous")}</p>
        </div>

        <ol className="bon-achat__etapes">
          <li>{t("etape1")}</li>
          <li>{t("etape2")}</li>
          <li>{t("etape3")}</li>
        </ol>

        <div className="bon-achat__carte">
          {!secret ? (
            <>
              <p className="champ-etiquette">{t("montant")}</p>
              <div className="bon-achat__montants" role="group" aria-label={t("montant")}>
                {montants.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="vignette vignette--texte"
                    aria-pressed={m === montantValide}
                    onClick={() => setMontant(m)}
                  >
                    <span className="vignette__nom">{formatRaw(m)}</span>
                  </button>
                ))}
              </div>

              <div className="champ-groupe">
                <label className="champ-etiquette" htmlFor="bon-email">{t("email")}</label>
                <input id="bon-email" type="email" autoComplete="email" className="champ-ligne" value={email} onChange={(e) => setEmail(e.target.value)} />
                <small className="cadeau__note">{t("emailAide")}</small>
              </div>
              <div className="champ-groupe">
                <label className="champ-etiquette" htmlFor="bon-prenom">{t("prenom")}</label>
                <input id="bon-prenom" className="champ-ligne" maxLength={40} value={prenom} onChange={(e) => setPrenom(e.target.value)} />
              </div>
              <div className="champ-groupe">
                <label className="champ-etiquette" htmlFor="bon-message">{t("message")}</label>
                <textarea id="bon-message" className="champ-ligne" maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} style={{ minHeight: 78 }} />
              </div>

              {erreur && (
                <p className="alerte alerte--erreur" role="alert">
                  <Icone nom="alerte" taille={16} />
                  {erreur}
                </p>
              )}
              <button type="button" className="bouton bouton--primaire" disabled={chargement} onClick={continuer}>
                {t("continuer", { prix: formatRaw(montantValide) })}
              </button>
            </>
          ) : (
            <Elements stripe={stripePromise} options={{ clientSecret: secret, appearance: APPARENCE, loader: "always" }}>
              <p className="bon-achat__recap">
                {t("recap", { prix: formatRaw(montantValide) })}
                <button type="button" className="lien-retour" onClick={() => setSecret("")}>
                  {t("modifier")}
                </button>
              </p>
              <Paiement libelle={t("payer", { prix: formatRaw(montantValide) })} enCours={t("paiementEnCours")} />
            </Elements>
          )}
          <p className="bon-achat__conditions">{t("conditions")}</p>
        </div>
      </div>
    </div>
  );
}
