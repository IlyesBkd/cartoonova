"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { MAX_PHOTOS } from "@/lib/orderPhotos";
import { posterConfirmationPage, type Lang } from "@/lib/email-i18n";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";

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

  /* Une demande de retouche sur un portrait est presque toujours visuelle : un
     tatouage oublie, une coupe de cheveux, une photo de reference. Sans ce
     champ, le client devait sortir de la page et repondre par e-mail — c'est
     exactement ce qui est arrive en mai, et la reponse a fini dans une boite
     que personne ne relevait. */
  const [photos, setPhotos] = useState<string[]>([]);
  const [envoiPhotos, setEnvoiPhotos] = useState(false);
  const champFichier = useRef<HTMLInputElement>(null);

  const ajouterPhotos = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return;
    setEnvoiPhotos(true);
    try {
      const urls: string[] = [];
      for (const fichier of Array.from(fichiers).slice(0, MAX_PHOTOS)) {
        const blob = await upload(`retouches/${Date.now()}-${fichier.name}`, fichier, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });
        urls.push(blob.url);
      }
      setPhotos((p) => [...p, ...urls].slice(0, MAX_PHOTOS));
    } catch {
      setError(true);
    } finally {
      setEnvoiPhotos(false);
    }
  };

  const respond = async (action: "confirm" | "changes", noteText?: string) => {
    setSending(action);
    setError(false);
    try {
      const r = await fetch("/api/orders/confirm-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, note: noteText, photos }),
      });
      if (r.ok) {
        /* Le taux de demandes de retouche est la mesure de qualite du travail
           des illustrateurs, et la seule qui existe avant l'avis client. */
        mesure(MESURES.posterConfirme, { action, avec_note: Boolean(noteText) });
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

          <div>
            <input
              ref={champFichier}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => ajouterPhotos(e.target.files)}
            />
            <button
              type="button"
              onClick={() => champFichier.current?.click()}
              disabled={envoiPhotos || photos.length >= MAX_PHOTOS}
              className="w-full rounded-xl border-2 border-dashed border-black/30 px-4 py-3 text-sm font-bold text-black/70 hover:border-black/60 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {envoiPhotos ? t.sending : `📎 ${t.attachPhotos}`}
            </button>
            {photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {photos.map((url, i) => (
                  <div key={url} className="relative aspect-square rounded-lg overflow-hidden border-2 border-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                      aria-label={t.removePhoto}
                      className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-black/70 text-white text-xs leading-none cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
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
