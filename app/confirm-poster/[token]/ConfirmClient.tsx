"use client";

import { useState } from "react";
import { posterConfirmationPage, type Lang } from "@/lib/email-i18n";

type Status = "confirmed" | "changes_requested" | null;

export default function ConfirmClient({
  token,
  lang,
  initialStatus,
  respondedAt,
}: {
  token: string;
  lang: Lang;
  initialStatus: Status;
  respondedAt: string | null;
}) {
  const t = posterConfirmationPage[lang];
  const [status, setStatus] = useState<Status>(initialStatus);
  const [sending, setSending] = useState<"confirm" | "changes" | null>(null);
  const [error, setError] = useState(false);

  const respond = async (action: "confirm" | "changes") => {
    setSending(action);
    setError(false);
    try {
      const r = await fetch("/api/orders/confirm-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action }),
      });
      if (r.ok) {
        setStatus(action === "confirm" ? "confirmed" : "changes_requested");
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setSending(null);
  };

  const formattedDate = respondedAt
    ? new Date(respondedAt).toLocaleString(lang)
    : null;

  return (
    <div className="space-y-4">
      {status === "confirmed" && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl p-4 text-center">
          <p className="font-black text-emerald-700 mb-1">{t.confirmedTitle}</p>
          <p className="text-sm text-emerald-700">{t.confirmedBody}</p>
        </div>
      )}
      {status === "changes_requested" && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 text-center">
          <p className="font-black text-amber-700 mb-1">{t.changesTitle}</p>
          <p className="text-sm text-amber-700">{t.changesBody}</p>
        </div>
      )}

      {status && formattedDate && (
        <p className="text-xs text-center text-gray-500">
          {status === "confirmed"
            ? t.alreadyRespondedConfirmed(formattedDate)
            : t.alreadyRespondedChanges(formattedDate)}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={() => respond("confirm")}
          disabled={sending !== null}
          className="w-full bg-yellow-400 text-black font-black uppercase px-6 py-3 rounded-full border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 cursor-pointer"
        >
          {sending === "confirm" ? t.sending : t.confirmButton}
        </button>
        <button
          onClick={() => respond("changes")}
          disabled={sending !== null}
          className="w-full bg-white text-black font-black uppercase px-6 py-3 rounded-full border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 cursor-pointer"
        >
          {sending === "changes" ? t.sending : t.changesButton}
        </button>
      </div>

      {error && (
        <p className="text-xs text-center text-red-600 font-semibold">
          {t.invalidBody}
        </p>
      )}
    </div>
  );
}
