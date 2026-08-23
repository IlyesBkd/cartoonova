"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { mesure, identifier } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";
import Icone from "@/components/tj/Icone";

type Status = "idle" | "loading" | "success" | "error";

export default function NewsletterForm({
  source = "footer",
  className = "",
  variant = "default",
}: {
  source?: string;
  className?: string;
  variant?: "default" | "pill";
}) {
  const t = useTranslations("footer");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, source }),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      /* Une inscription donne une adresse : c'est le seul autre moment que la
         caisse ou un visiteur cesse d'etre anonyme. Sans cet appel, un
         inscrit qui revient acheter trois jours plus tard reste un inconnu, et
         l'infolettre ne peut jamais etre creditee de la commande. */
      identifier(email, { source_inscription: source, locale });

      mesure(MESURES.inscriptionNewsletter, { source, locale });

      /* La relance de sortie ne pouvait etre jugee que sur son cout : on
         savait combien de fois elle s'affichait, jamais ce qu'elle rapportait. */
      if (source === "exit_intent") {
        mesure(MESURES.relanceSortieConvertie, { locale });
      }
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <p className={`newsletter-ok ${className}`}>
        <Icone nom="coche" taille={15} style={{ display: "inline-block", verticalAlign: "-3px", marginRight: 6 }} />{t("newsletterSuccess")}
      </p>
    );
  }

  if (variant === "pill") {
    return (
      <form onSubmit={submit} className={`footer__newsletter-form ${className}`}>
        <div className="form-control">
          <input
            id={`newsletter-email-${source}`}
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            placeholder=" "
            autoComplete="email"
            className="input is-floating"
          />
          <label htmlFor={`newsletter-email-${source}`} className="floating-label">
            {t("emailPlaceholder")}
          </label>
          <div className="self-submit-button">
            <button type="submit" disabled={status === "loading"} className="circle-chevron" aria-label={t("subscribe")}>
              <svg width="5" height="8" viewBox="0 0 5 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="m.75 7 3-3-3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        </div>
        {status === "error" && (
          <p className="depot__erreur" role="alert">
            {t("newsletterError")}
          </p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex flex-col sm:flex-row gap-2">
        <label htmlFor={`newsletter-email-${source}`} className="sr-only">
          {t("emailPlaceholder")}
        </label>
        <input
          id={`newsletter-email-${source}`}
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder={t("emailPlaceholder")}
          autoComplete="email"
          className="champ-ligne" style={{ flex: 1, minWidth: 0, borderRadius: 999, padding: "11px 18px" }}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="bouton bouton--primaire" style={{ padding: "11px 24px", fontSize: 16 }}
        >
          {t("subscribe")}
        </button>
      </div>
      {status === "error" && (
        <p className="depot__erreur" role="alert">
          {t("newsletterError")}
        </p>
      )}
    </form>
  );
}
