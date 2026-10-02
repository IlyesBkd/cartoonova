"use client";

import { useEffect, useRef, useState } from "react";
import { bonusPage, type Lang, type OccasionCarte } from "@/lib/email-i18n";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";

/* Fond d'ecran 1080x1920 et avatar 1024x1024, dessines dans des canvas a
   partir du portrait final ; carte A6 en HTML, imprimee par le navigateur
   (« Enregistrer au format PDF » pour garder un fichier).

   L'image est lue sur /api/bonus/[token]/image, donc sur le domaine du site :
   un canvas qui a dessine une image d'un autre domaine refuse de s'exporter. */

const FOND = { l: 1080, h: 1920 };
const AVATAR = 1024;

function charger(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Dimensions pour couvrir (cover) ou contenir (contain) un cadre. */
function cadrer(img: HTMLImageElement, l: number, h: number, mode: "cover" | "contain", zoom = 1) {
  const echelle =
    (mode === "cover" ? Math.max(l / img.width, h / img.height) : Math.min(l / img.width, h / img.height)) * zoom;
  const w = img.width * echelle;
  const hh = img.height * echelle;
  return { x: (l - w) / 2, y: (h - hh) / 2, w, h: hh };
}

function dessinerFond(canvas: HTMLCanvasElement, img: HTMLImageElement) {
  canvas.width = FOND.l;
  canvas.height = FOND.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Fond : le portrait agrandi et floute, assombri pour que le premier plan ressorte.
  const fond = cadrer(img, FOND.l, FOND.h, "cover", 1.15);
  ctx.filter = "blur(48px)";
  ctx.drawImage(img, fond.x, fond.y, fond.w, fond.h);
  ctx.filter = "none";
  ctx.fillStyle = "rgba(20, 16, 50, 0.28)";
  ctx.fillRect(0, 0, FOND.l, FOND.h);

  // Premier plan : le portrait entier, un peu au-dessus du centre — l'heure et
  // les notifications occupent le haut de l'ecran, les icones le bas.
  const avant = cadrer(img, FOND.l * 0.92, FOND.h * 0.62, "contain");
  const x = (FOND.l - avant.w) / 2;
  const y = FOND.h * 0.24 + (FOND.h * 0.62 - avant.h) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 40;
  ctx.drawImage(img, x, y, avant.w, avant.h);
  ctx.restore();
}

function dessinerAvatar(canvas: HTMLCanvasElement, img: HTMLImageElement, zoom: number) {
  canvas.width = AVATAR;
  canvas.height = AVATAR;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, AVATAR, AVATAR);
  ctx.save();
  ctx.beginPath();
  ctx.arc(AVATAR / 2, AVATAR / 2, AVATAR / 2, 0, Math.PI * 2);
  ctx.clip();
  const c = cadrer(img, AVATAR, AVATAR, "cover", zoom);
  ctx.drawImage(img, c.x, c.y, c.w, c.h);
  ctx.restore();
}

function telecharger(canvas: HTMLCanvasElement | null, nom: string) {
  canvas?.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

/** Textes deja resolus cote serveur : la page n'embarque pas les dix langues. */
export interface ParrainageBonus {
  code: string;
  titre: string;
  offre: string;
  etiquette: string;
  copier: string;
  copie: string;
}

function CarteParrainage({ p }: { p: ParrainageBonus }) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(p.code);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers refuse (iframe, vieux navigateur) : le code reste lisible et selectionnable.
    }
  }

  return (
    <section className="suivi__carte bonus__bloc">
      <h2>{p.titre}</h2>
      <p>{p.offre}</p>
      {/* Meme encadre pointille que le code d'un bon cadeau : deja style, et
          le client reconnaitra la meme forme quand il recevra son bon. */}
      <div className="bon-code">
        <small>{p.etiquette}</small>
        <b>{p.code}</b>
      </div>
      <button type="button" className="bouton bouton--primaire" onClick={() => {
        mesure(MESURES.bonusUtilise, { gift: "referral_code", action: "copy" });
        copier();
      }} aria-live="polite">
        {copie ? p.copie : p.copier}
      </button>
    </section>
  );
}

export default function BonusClient({
  token,
  lang,
  ref8,
  parrainage,
}: {
  token: string;
  lang: Lang;
  ref8: string;
  parrainage: ParrainageBonus | null;
}) {
  const t = bonusPage[lang];
  const source = `/api/bonus/${encodeURIComponent(token)}/image`;

  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1.6);
  const [prenom, setPrenom] = useState("");
  const [occasion, setOccasion] = useState<OccasionCarte>("anniversaire");
  const [texteLibre, setTexteLibre] = useState("");
  const fond = useRef<HTMLCanvasElement>(null);
  const avatar = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    charger(source).then(setImg).catch(() => setImg(null));
  }, [source]);

  useEffect(() => {
    if (img && fond.current) dessinerFond(fond.current, img);
  }, [img]);

  useEffect(() => {
    if (img && avatar.current) dessinerAvatar(avatar.current, img, zoom);
  }, [img, zoom]);

  const voeu = occasion === "libre" ? texteLibre : t.greeting[occasion](prenom.trim());

  return (
    <main className="suivi bonus">
      <div className="suivi__carte bonus__entete">
        <h1>{t.heading}</h1>
        <p>{t.intro}</p>
      </div>

      <section className="suivi__carte bonus__bloc">
        <h2>{t.wallpaperTitle}</h2>
        <p>{t.wallpaperBody}</p>
        <canvas ref={fond} className="bonus__fond" aria-label={t.wallpaperTitle} />
        <button
          type="button"
          className="bouton bouton--primaire"
          disabled={!img}
          onClick={() => {
            mesure(MESURES.bonusUtilise, { gift: "wallpaper", action: "download" });
            telecharger(fond.current, `cartoonova-fond-ecran-${ref8}.png`);
          }}
        >
          {t.download}
        </button>
      </section>

      <section className="suivi__carte bonus__bloc">
        <h2>{t.avatarTitle}</h2>
        <p>{t.avatarBody}</p>
        <canvas ref={avatar} className="bonus__avatar" aria-label={t.avatarTitle} />
        <label className="bonus__zoom">
          {t.zoom}
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          className="bouton bouton--primaire"
          disabled={!img}
          onClick={() => {
            mesure(MESURES.bonusUtilise, { gift: "avatar", action: "download" });
            telecharger(avatar.current, `cartoonova-avatar-${ref8}.png`);
          }}
        >
          {t.download}
        </button>
      </section>

      <section className="suivi__carte bonus__bloc">
        <h2>{t.cardTitle}</h2>
        <p>{t.cardBody}</p>
        <div className="bonus__champs">
          <label className="champ-groupe">
            <span className="champ-etiquette">{t.occasion}</span>
            <select
              className="champ-ligne"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value as OccasionCarte)}
            >
              {(Object.keys(t.occasions) as OccasionCarte[]).map((o) => (
                <option key={o} value={o}>
                  {t.occasions[o]}
                </option>
              ))}
            </select>
          </label>
          {occasion === "libre" ? (
            <label className="champ-groupe">
              <span className="champ-etiquette">{t.freeText}</span>
              <input
                className="champ-ligne"
                maxLength={60}
                value={texteLibre}
                onChange={(e) => setTexteLibre(e.target.value)}
              />
            </label>
          ) : (
            <label className="champ-groupe">
              <span className="champ-etiquette">{t.firstName}</span>
              <input
                className="champ-ligne"
                maxLength={30}
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
              />
            </label>
          )}
        </div>

        {/* La carte elle-meme : seule chose imprimee (voir @media print). */}
        <div className="carte-a6">
          {/* Portrait servi par le site lui-meme, hors de l'optimiseur d'images. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={source} alt="" className="carte-a6__portrait" />
          <p className="carte-a6__voeu">{voeu}</p>
        </div>

        <button type="button" className="bouton bouton--primaire" onClick={() => {
          mesure(MESURES.bonusUtilise, { gift: "card", action: "print" });
          window.print();
        }}>
          {t.print}
        </button>
        <p className="bonus__aide">{t.printHint}</p>
      </section>

      {/* En dernier : les cadeaux promis d'abord, la demande ensuite. */}
      {parrainage && <CarteParrainage p={parrainage} />}
    </main>
  );
}
