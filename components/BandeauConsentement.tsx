"use client";

import { COOKIE_CONSENT } from "@/lib/i18n/cookieConsent";
import CookiePreferences from "@/components/CookiePreferences";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  accepterMesure,
  etatConsentement,
  refuserMesure,
  type EtatConsentement,
} from "@/lib/analytics";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

/** Explicit opt-in, stored locally without loading either tracking SDK.
 * Kept independent of next-intl: token/success routes may lack its provider. */

interface Textes {
  titre: string;
  accepter: string;
  refuser: string;
  enSavoirPlus: string;
}

const TEXTES: Record<Locale, Textes> = {
  fr: {
    titre: "Un mot sur la mesure d'audience",
    accepter: "Accepter",
    refuser: "Refuser",
    enSavoirPlus: "En savoir plus",
  },
  en: {
    titre: "A word about analytics",
    accepter: "Accept",
    refuser: "Decline",
    enSavoirPlus: "Learn more",
  },
  es: {
    titre: "Unas palabras sobre la analitica",
    accepter: "Aceptar",
    refuser: "Rechazar",
    enSavoirPlus: "Mas informacion",
  },
  de: {
    titre: "Kurz zur Reichweitenmessung",
    accepter: "Akzeptieren",
    refuser: "Ablehnen",
    enSavoirPlus: "Mehr erfahren",
  },
  it: {
    titre: "Due parole sulle statistiche",
    accepter: "Accetta",
    refuser: "Rifiuta",
    enSavoirPlus: "Scopri di piu",
  },
  nl: {
    titre: "Een woord over statistieken",
    accepter: "Accepteren",
    refuser: "Weigeren",
    enSavoirPlus: "Meer weten",
  },
  pl: {
    titre: "Slowo o pomiarach ruchu",
    accepter: "Akceptuje",
    refuser: "Odrzucam",
    enSavoirPlus: "Dowiedz sie wiecej",
  },
  sv: {
    titre: "Om var besoksmatning",
    accepter: "Acceptera",
    refuser: "Neka",
    enSavoirPlus: "Las mer",
  },
  da: {
    titre: "Om vores besogsmaling",
    accepter: "Accepter",
    refuser: "Afvis",
    enSavoirPlus: "Laes mere",
  },
  pt: {
    titre: "Uma palavra sobre a medicao",
    accepter: "Aceitar",
    refuser: "Recusar",
    enSavoirPlus: "Saber mais",
  },
};

export default function BandeauConsentement() {
  const chemin = usePathname() ?? "/";
  const [etat, setEtat] = useState<EtatConsentement | null>(null);

  useEffect(() => {
    /* PostHog est charge paresseusement : l'etat n'est connu qu'apres. Tant
       qu'il est `null`, rien ne s'affiche — un bandeau qui apparait puis
       disparait chez un visiteur ayant deja repondu serait pire que son
       absence. */
    void etatConsentement().then(setEtat);
  }, []);

  if (etat !== "pending") return null;

  const segment = chemin.split("/")[1];
  const langue = ((locales as readonly string[]).includes(segment)
    ? segment
    : defaultLocale) as Locale;
  const t = TEXTES[langue];

  const repondre = (accepte: boolean) => {
    if (accepte) accepterMesure();
    else refuserMesure();
    setEtat(accepte ? "granted" : "denied");
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consentement-titre"
      style={{
        position: "fixed",
        insetInline: 0,
        bottom: 0,
        zIndex: 120,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        padding: "16px 20px",
        background: "var(--creme, #fdf6e3)",
        borderTop: "3px solid var(--encre, #000)",
        boxShadow: "0 -6px 0 rgba(0,0,0,.08)",
      }}
    >
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <p
          id="consentement-titre"
          style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "var(--encre, #000)" }}
        >
          {t.titre}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--encre-doux, #444)" }}>
          {COOKIE_CONSENT[langue].notice}{" "}
          <a
            href={`/${langue}/politique-de-confidentialite`}
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            {t.enSavoirPlus}
          </a>
        </p>
      </div>

      <CookiePreferences locale={langue} />
      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => repondre(false)}
          className="bouton bouton--fantome"
          style={{ padding: "9px 18px", fontSize: 14 }}
        >
          {t.refuser}
        </button>
        <button
          type="button"
          onClick={() => repondre(true)}
          className="bouton bouton--primaire"
          style={{ padding: "9px 18px", fontSize: 14 }}
        >
          {t.accepter}
        </button>
      </div>
    </div>
  );
}
