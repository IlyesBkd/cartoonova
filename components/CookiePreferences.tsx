"use client";
import { accepterMesure, refuserMesure } from "@/lib/analytics";
import { COOKIE_CONSENT, COOKIE_CHOICES } from "@/lib/i18n/cookieConsent";
import type { Locale } from "@/i18n/config";

export default function CookiePreferences({ locale }: { locale: string }) {
  const t = COOKIE_CONSENT[locale as Locale] ?? COOKIE_CONSENT.fr;
  const choix = COOKIE_CHOICES[locale as Locale] ?? COOKIE_CHOICES.fr;
  return (
    <details>
      <summary style={{ cursor: "pointer", textDecoration: "underline" }}>
        {t.preferences}
      </summary>
      <p>{t.notice}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <button type="button" className="bouton bouton--fantome" onClick={refuserMesure}>
          {choix.refuser}
        </button>
        <button type="button" className="bouton bouton--fantome" onClick={accepterMesure}>
          {choix.accepter}
        </button>
      </div>
    </details>
  );
}
