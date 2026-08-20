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
  const [showChangesForm, setShowChangesForm] = useState(false);
  const [note, setNote] = useState("");

  const respond = async (action: "confirm" | "changes", noteText?: string) => {
    setSending(action);
    setError(false);
    try {
      const r = await fetch("/api/orders/confirm-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, note: noteText }),
      });
      if (r.ok) {
        setStatus(action === "confirm" ? "confirmed" : "changes_requested");
        setShowChangesForm(false);
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

      {showChangesForm ? (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-bold text-black block mb-1">{t.changesPrompt}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.changesPlaceholder}
              rows={4}
              className="w-full rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => respond("changes", note)}
              disabled={sending !== null || note.trim().length === 0}
              className="w-full bg-amber-400 text-black font-black uppercase px-6 py-3 rounded-full hover: hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 cursor-pointer"
            >
              {sending === "changes" ? t.sending : t.changesSubmit}
            </button>
            <button
              onClick={() => setShowChangesForm(false)}
              disabled={sending !== null}
              className="w-full text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              ←
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => respond("confirm")}
            disabled={sending !== null}
            className="w-full bg-soleil text-black font-black uppercase px-6 py-3 rounded-full hover: hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 cursor-pointer"
          >
            {sending === "confirm" ? t.sending : t.confirmButton}
          </button>
          <button
            onClick={() => setShowChangesForm(true)}
            disabled={sending !== null}
            className="w-full bg-white text-black font-black uppercase px-6 py-3 rounded-full hover: hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 cursor-pointer"
          >
            {t.changesButton}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-center text-red-600 font-semibold">
          {t.invalidBody}
        </p>
      )}
    </div>
  );
}
