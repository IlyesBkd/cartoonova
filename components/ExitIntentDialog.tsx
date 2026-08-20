"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import NewsletterForm from "@/components/NewsletterForm";

const SEEN_KEY = "cartoonova_exit_intent_seen";
// Delai minimum sur la page avant d'armer le declencheur : personne ne doit
// voir cette pop-in dans les premieres secondes de sa visite.
const ARM_DELAY_MS = 20_000;

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // stockage indisponible (navigation privee) : la pop-in pourra reapparaitre
  }
}

export default function ExitIntentDialog() {
  const t = useTranslations("exitIntent");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (alreadySeen()) return;

    let armed = false;
    let lastScrollY = window.scrollY;
    let scrolledDown = false;

    const armTimer = window.setTimeout(() => {
      armed = true;
    }, ARM_DELAY_MS);

    const trigger = (reason: "pointer_out" | "scroll_up") => {
      if (!armed || alreadySeen()) return;
      // Ne jamais interrompre un checkout en cours.
      if (document.querySelector("[data-checkout-modal]")) return;

      markSeen();
      setOpen(true);
      posthog.capture("exit_intent_shown", { reason });
    };

    const onMouseOut = (e: MouseEvent) => {
      if (e.relatedTarget || e.clientY > 0) return;
      trigger("pointer_out");
    };

    // Pas d'equivalent du "curseur qui sort de la page" sur mobile : on utilise
    // un scroll vers le haut franc apres avoir parcouru la page.
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastScrollY + 10) scrolledDown = true;
      if (scrolledDown && y < lastScrollY - 120) trigger("scroll_up");
      lastScrollY = y;
    };

    document.addEventListener("mouseout", onMouseOut);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.clearTimeout(armTimer);
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    posthog.capture("exit_intent_dismissed");
  };

  return (
    <div className="modale" style={{ zIndex: 110 }}>
      <div className="modale__voile" onClick={close} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-intent-title"
        className="modale__boite" style={{ maxWidth: 460, padding: 28 }}
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("dismiss")}
          className="modale__fermer" style={{ position: "absolute", top: 14, right: 14, background: "var(--cendre)" }}
        >
          ×
        </button>

        <h2 id="exit-intent-title" style={{ fontSize: 25, marginBottom: 8, paddingRight: 34 }}>
          {t("title")}
        </h2>
        <p style={{ color: "var(--encre-doux)", margin: "0 0 18px" }}>{t("subtitle")}</p>

        <NewsletterForm source="exit_intent" />

        <button
          type="button"
          onClick={close}
          style={{ marginTop: 14, border: 0, background: "none", cursor: "pointer", font: "inherit", fontSize: 13, color: "var(--encre-doux)", textDecoration: "underline" }}
        >
          {t("dismiss")}
        </button>
      </div>
    </div>
  );
}
