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
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-intent-title"
        className="relative w-full max-w-md bg-gradient-to-br from-yellow-50 to-yellow-100 border-4 border-black rounded-2xl shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-6"
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("dismiss")}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black text-white font-black leading-none border-2 border-black"
        >
          ×
        </button>

        <h2 id="exit-intent-title" className="text-2xl font-black text-black mb-2 pr-8">
          {t("title")}
        </h2>
        <p className="text-sm font-bold text-black/70 leading-relaxed mb-4">{t("subtitle")}</p>

        <NewsletterForm source="exit_intent" />

        <button
          type="button"
          onClick={close}
          className="mt-3 text-xs font-bold text-black/50 underline hover:text-black transition-colors"
        >
          {t("dismiss")}
        </button>
      </div>
    </div>
  );
}
