"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  accepterMesure,
  etatConsentement,
  refuserMesure,
  type EtatConsentement,
} from "@/lib/analytics";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

/**
 * Bandeau de consentement a la mesure.
 *
 * Il n'apparait que si `NEXT_PUBLIC_CONSENT_BANNER` vaut "1" — le drapeau est
 * lu dans `lib/analytics.ts`, qui conditionne aussi la configuration de
 * PostHog. Les deux vont ensemble : afficher le bandeau sans configurer le
 * SDK laisserait le site mesurer malgre un refus, ce qui est pire que pas de
 * bandeau du tout.
 *
 * Trois etats, et c'est PostHog qui les tient :
 *  - en attente : rien n'est capture, le bandeau s'affiche ;
 *  - refus     : mode sans cookie — le trafic reste compte, sans identifiant
 *                persistant, sans enregistrement de session, sans profil ;
 *  - accord    : mesure complete.
 *
 * Le refus n'eteint donc pas tout. C'est deliberé : un « non » ne doit pas
 * couter la connaissance du volume de trafic, et une mesure sans identifiant
 * ne releve pas du consentement.
 *
 * Les textes sont embarques plutot que tires de `next-intl`. Deux raisons :
 * ce composant est monte par `PostHogProvider`, qui enveloppe
 * `NextIntlClientProvider` et non l'inverse ; et il doit fonctionner sur
 * /success, qui n'a aucun fournisseur de traduction.
 */

interface Textes {
  titre: string;
  texte: string;
  accepter: string;
  refuser: string;
  enSavoirPlus: string;
}

const TEXTES: Record<Locale, Textes> = {
  fr: {
    titre: "Un mot sur la mesure d'audience",
    texte:
      "Nous mesurons la navigation pour comprendre ce qui fonctionne sur le site. Si vous refusez, nous continuons a compter les visites sans aucun identifiant ni cookie.",
    accepter: "Accepter",
    refuser: "Refuser",
    enSavoirPlus: "En savoir plus",
  },
  en: {
    titre: "A word about analytics",
    texte:
      "We measure browsing to understand what works on the site. If you decline, we keep counting visits without any identifier or cookie.",
    accepter: "Accept",
    refuser: "Decline",
    enSavoirPlus: "Learn more",
  },
  es: {
    titre: "Unas palabras sobre la analitica",
    texte:
      "Medimos la navegacion para entender que funciona en el sitio. Si lo rechazas, seguimos contando las visitas sin ningun identificador ni cookie.",
    accepter: "Aceptar",
    refuser: "Rechazar",
    enSavoirPlus: "Mas informacion",
  },
  de: {
    titre: "Kurz zur Reichweitenmessung",
    texte:
      "Wir messen die Navigation, um zu verstehen, was auf der Website funktioniert. Bei Ablehnung zahlen wir Besuche weiterhin ohne Kennung und ohne Cookie.",
    accepter: "Akzeptieren",
    refuser: "Ablehnen",
    enSavoirPlus: "Mehr erfahren",
  },
  it: {
    titre: "Due parole sulle statistiche",
    texte:
      "Misuriamo la navigazione per capire cosa funziona sul sito. Se rifiuti, continuiamo a contare le visite senza alcun identificativo ne cookie.",
    accepter: "Accetta",
    refuser: "Rifiuta",
    enSavoirPlus: "Scopri di piu",
  },
  nl: {
    titre: "Een woord over statistieken",
    texte:
      "We meten het surfgedrag om te begrijpen wat werkt op de site. Als u weigert, blijven we bezoeken tellen zonder enige identificatie of cookie.",
    accepter: "Accepteren",
    refuser: "Weigeren",
    enSavoirPlus: "Meer weten",
  },
  pl: {
    titre: "Slowo o pomiarach ruchu",
    texte:
      "Mierzymy ruch, aby zrozumiec, co dziala na stronie. Jesli odmowisz, nadal liczymy wizyty bez zadnego identyfikatora ani pliku cookie.",
    accepter: "Akceptuje",
    refuser: "Odrzucam",
    enSavoirPlus: "Dowiedz sie wiecej",
  },
  sv: {
    titre: "Om var besoksmatning",
    texte:
      "Vi matar navigeringen for att forsta vad som fungerar pa webbplatsen. Om du tackar nej fortsatter vi rakna besok utan nagon identifierare eller kaka.",
    accepter: "Acceptera",
    refuser: "Neka",
    enSavoirPlus: "Las mer",
  },
  da: {
    titre: "Om vores besogsmaling",
    texte:
      "Vi maler navigationen for at forsta, hvad der virker pa sitet. Hvis du afviser, fortsaetter vi med at taelle besog uden nogen identifikator eller cookie.",
    accepter: "Accepter",
    refuser: "Afvis",
    enSavoirPlus: "Laes mere",
  },
  pt: {
    titre: "Uma palavra sobre a medicao",
    texte:
      "Medimos a navegacao para perceber o que funciona no site. Se recusar, continuamos a contar as visitas sem qualquer identificador ou cookie.",
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
          {t.texte}{" "}
          <a
            href={`/${langue}/politique-de-confidentialite`}
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            {t.enSavoirPlus}
          </a>
        </p>
      </div>

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
