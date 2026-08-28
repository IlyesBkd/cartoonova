"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { depotPhotosPage, type Lang } from "@/lib/email-i18n";
import { MAX_PHOTOS } from "@/lib/orderPhotos";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";

/**
 * Depot des photos apres paiement.
 *
 * Reprend le mecanisme de la fiche produit — `upload` de `@vercel/blob/client`
 * vers `/api/upload` — parce que c'est le meme geste : le fichier part
 * directement au stockage, jamais par notre serveur. Ce qui change est ce qui
 * suit : la liste d'URL est confiee a `/api/orders/photos`, qui la rattache a
 * la commande grace au jeton signe du lien.
 */
export default function DepotClient({ token, lang }: { token: string; lang: Lang }) {
  const t = depotPhotosPage[lang];
  const champFichier = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<string[]>([]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [survol, setSurvol] = useState(false);
  const [erreur, setErreur] = useState("");
  const [termine, setTermine] = useState(false);

  /* L'ouverture de la page compte autant que l'envoi : sans elle, on sait
     combien de clients deposent leurs photos, jamais combien ont ouvert le
     lien sans aller au bout. C'est cette difference qui dira si le probleme
     est l'e-mail ou la page. */
  useEffect(() => {
    mesure(MESURES.depotOuvert, { langue: lang });
  }, [lang]);

  const envoyer = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return;
    setEnvoiEnCours(true);
    setErreur("");
    try {
      const urls: string[] = [];
      for (const fichier of Array.from(fichiers).slice(0, MAX_PHOTOS)) {
        const blob = await upload(`orders/${Date.now()}-${fichier.name}`, fichier, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });
        urls.push(blob.url);
      }
      setPhotos((p) => [...p, ...urls].slice(0, MAX_PHOTOS));
    } catch {
      setErreur(t.error);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const valider = async () => {
    if (!photos.length || enregistrement) return;
    setEnregistrement(true);
    setErreur("");
    try {
      const r = await fetch("/api/orders/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, photoUrls: photos }),
      });
      if (!r.ok) {
        setErreur(t.error);
        return;
      }
      /* La mesure part du navigateur ET du serveur : celle-ci dit que le
         client a vu l'ecran de confirmation, celle du serveur que la commande
         est reellement debloquee. Les deux ne racontent pas la meme chose. */
      mesure(MESURES.photosDeposees, { photo_count: photos.length, source: "page_depot" });
      setTermine(true);
    } catch {
      setErreur(t.error);
    } finally {
      setEnregistrement(false);
    }
  };

  if (termine) {
    return (
      <div className="text-center space-y-1 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <p className="font-black text-emerald-700">{t.doneTitle}</p>
        <p className="text-sm text-emerald-700">{t.doneBody}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bouton et non <div onClick> : le depot doit rester atteignable au
          clavier, et le glisser-deposer fonctionne a l'identique. */}
      <button
        type="button"
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          envoyer(e.dataTransfer.files);
        }}
        onClick={() => champFichier.current?.click()}
        disabled={envoiEnCours}
        className={`w-full rounded-xl border-2 border-dashed p-6 text-sm font-bold transition-colors cursor-pointer disabled:opacity-60 ${
          survol ? "border-yellow-500 bg-yellow-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        }`}
      >
        {envoiEnCours ? t.sending : t.dropzone}
      </button>

      {/* Hors du bouton : un champ imbrique dans un bouton est du HTML
          invalide, et son clic remonterait au parent. */}
      <input
        ref={champFichier}
        type="file"
        multiple
        accept="image/*"
        hidden
        onChange={(e) => {
          envoyer(e.target.files);
          e.target.value = "";
        }}
      />

      <p className="text-xs text-black/50">{t.hint}</p>

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              className="w-full aspect-square object-cover rounded-lg border border-gray-200"
            />
          ))}
        </div>
      )}

      {erreur && (
        <p className="text-sm font-bold text-red-600" role="alert">
          {erreur}
        </p>
      )}

      <button
        type="button"
        onClick={valider}
        disabled={!photos.length || enregistrement || envoiEnCours}
        className="w-full bg-black text-white font-black text-sm py-3 rounded-xl hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {enregistrement ? t.sending : t.submit}
      </button>
    </div>
  );
}
