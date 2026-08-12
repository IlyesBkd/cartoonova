"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import posthog from "posthog-js";

type Status = "idle" | "loading" | "success" | "error";

export default function NewsletterForm({
  source = "footer",
  className = "",
}: {
  source?: string;
  className?: string;
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

      posthog.capture("newsletter_subscribed", { source, locale });
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <p className={`text-sm font-bold text-black ${className}`}>
        ✅ {t("newsletterSuccess")}
      </p>
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
          className="flex-1 min-w-0 px-3 py-2 rounded-full border-2 border-black bg-white text-sm font-bold text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="px-4 py-2 rounded-full bg-black text-white text-sm font-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {t("subscribe")}
        </button>
      </div>
      {status === "error" && (
        <p className="mt-2 text-xs font-bold text-red-800" role="alert">
          {t("newsletterError")}
        </p>
      )}
    </form>
  );
}
