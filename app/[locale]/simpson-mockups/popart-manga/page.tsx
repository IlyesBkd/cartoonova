"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  PRICES,
  formatEUR,
  computeTotal,
  type ConfiguratorState,
  type Format,
  type PrintKey,
  PRINT_OPTIONS,
  BACKGROUNDS,
  GALLERY_PHOTOS,
  HERO_SLIDES,
  REVIEWS,
  FAQ_ITEMS,
  STATS,
  COPY,
} from "../_shared/content";
import PopartVariantSwitcher from "../_shared/PopartVariantSwitcher";

type UploadedPhoto = { url: string; name: string };

const SHOUTS = ["WAOUH !", "PARFAIT !", "SUPER !", "GÉNIAL !"];

/* ───────────────────────── manga building blocks ───────────────────────── */

function SpeedLines({
  variant = "radial",
  tone = "black",
  className = "",
  style,
}: {
  variant?: "radial" | "flat";
  tone?: "black" | "white";
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={`mkpm-speedlines mkpm-speedlines--${variant} mkpm-speedlines--${tone} ${className}`}
      style={style}
    />
  );
}

function Screentone({
  size = "fine",
  tone = "black",
  className = "",
}: {
  size?: "fine" | "regular";
  tone?: "black" | "white";
  className?: string;
}) {
  return <div aria-hidden className={`mkpm-tone mkpm-tone--${size} mkpm-tone--${tone} ${className}`} />;
}

function Panel({
  children,
  rotate = 0,
  cut = false,
  tone = "white",
  className = "",
}: {
  children: ReactNode;
  rotate?: number;
  cut?: boolean;
  tone?: "white" | "black";
  className?: string;
}) {
  return (
    <div
      className={`mkpm-panel mkpm-panel--${tone} ${cut ? "mkpm-panel--cut" : ""} ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </div>
  );
}

function Bubble({
  children,
  tail = "bl",
  tone = "white",
  className = "",
}: {
  children: ReactNode;
  tail?: "bl" | "br" | "none";
  tone?: "white" | "black";
  className?: string;
}) {
  return (
    <div className={`mkpm-bubble mkpm-bubble--${tail} mkpm-bubble--${tone} ${className}`}>{children}</div>
  );
}

function Shout({
  text,
  rotate = -6,
  size = "md",
  className = "",
}: {
  text: string;
  rotate?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`mkpm-shout mkpm-shout--${size} ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {text}
    </span>
  );
}

function ImpactBadge({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mkpm-impact">
      <SpeedLines variant="radial" tone="black" className="mkpm-impact-lines" />
      <div className="mkpm-impact-plate">
        <span className="mkpm-impact-label">{label}</span>
        {sub && <span className="mkpm-impact-sub">{sub}</span>}
      </div>
    </div>
  );
}

function Chip({ children, tone = "white" }: { children: ReactNode; tone?: "white" | "red" }) {
  return <span className={`mkpm-chip mkpm-chip--${tone}`}>{children}</span>;
}

function StepDial({
  icon,
  label,
  value,
  min,
  max,
  hint,
  onChange,
}: {
  icon: string;
  label: string;
  value: number;
  min: number;
  max: number;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mkpm-panel mkpm-panel--white mkpm-panel--flat p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl leading-none" aria-hidden>
          {icon}
        </span>
        <span className="font-mkpm-display text-lg">{label}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="mkpm-dial-btn"
          aria-label={`Réduire ${label}`}
        >
          −
        </button>
        <div className="font-mkpm-display text-4xl tabular-nums">{value}</div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="mkpm-dial-btn"
          aria-label={`Augmenter ${label}`}
        >
          +
        </button>
      </div>
      {hint && <div className="text-[11px] font-bold text-black/60 mt-2 text-center">{hint}</div>}
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function Page() {
  const [format, setFormat] = useState<Format>("portrait");
  const [people, setPeople] = useState(1);
  const [animals, setAnimals] = useState(0);
  const [selectedBg, setSelectedBg] = useState(0);
  const [hoveredBg, setHoveredBg] = useState<number | null>(null);
  const [selectedPrint, setSelectedPrint] = useState(0);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const configRef = useRef<HTMLElement>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photosRef = useRef<UploadedPhoto[]>([]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setHeroIndex((i) => (i + 1) % HERO_SLIDES.length), 3600);
    return () => clearInterval(id);
  }, []);

  const printKey: PrintKey = PRINT_OPTIONS[selectedPrint].key;
  const configState: ConfiguratorState = { format, people, animals, printKey };
  const total = computeTotal(configState);
  const selectedPrintOption = PRINT_OPTIONS[selectedPrint];
  const selectedBackground = BACKGROUNDS[hoveredBg ?? selectedBg];

  const scrollToConfig = () => {
    configRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const addFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const room = Math.max(0, 8 - photos.length);
    if (room <= 0) return;
    const additions = Array.from(files)
      .slice(0, room)
      .map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
    if (additions.length) setPhotos((prev) => [...prev, ...additions].slice(0, 8));
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleAddToCart = () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastVisible(true);
    toastTimeoutRef.current = setTimeout(() => setToastVisible(false), 2000);
  };

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Anton&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .mk-popart-manga {
          --mkpm-black: #0A0A0A;
          --mkpm-paper: #F5F4F0;
          --mkpm-white: #FFFFFF;
          --mkpm-red: #E10600;
          --mkpm-red-deep: #A30500;
          --mkpm-gray: #6B6B6B;
          --mkpm-gray-line: #D9D8D2;
          background: var(--mkpm-paper);
          color: var(--mkpm-black);
          font-family: 'Zen Kaku Gothic New', 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          position: relative;
        }
        .mk-popart-manga *, .mk-popart-manga *::before, .mk-popart-manga *::after { box-sizing: border-box; }
        .mk-popart-manga .font-mkpm-display {
          font-family: 'Anton', 'Impact', sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.01em;
          line-height: 0.92;
          font-weight: 400;
        }

        /* speed lines */
        .mkpm-speedlines { position: absolute; inset: -15%; pointer-events: none; }
        .mkpm-speedlines--radial.mkpm-speedlines--black {
          background-image: repeating-conic-gradient(from 0deg, rgba(10,10,10,0.95) 0deg 0.9deg, transparent 0.9deg 6.5deg);
          -webkit-mask-image: radial-gradient(circle at 50% 50%, black 4%, black 14%, transparent 60%);
          mask-image: radial-gradient(circle at 50% 50%, black 4%, black 14%, transparent 60%);
          opacity: 0.16;
        }
        .mkpm-speedlines--radial.mkpm-speedlines--white {
          background-image: repeating-conic-gradient(from 0deg, rgba(255,255,255,0.95) 0deg 0.9deg, transparent 0.9deg 6.5deg);
          -webkit-mask-image: radial-gradient(circle at 50% 50%, black 4%, black 14%, transparent 60%);
          mask-image: radial-gradient(circle at 50% 50%, black 4%, black 14%, transparent 60%);
          opacity: 0.22;
        }
        .mkpm-speedlines--flat.mkpm-speedlines--black {
          background-image: repeating-linear-gradient(112deg, rgba(10,10,10,0.9) 0 3px, transparent 3px 17px);
          -webkit-mask-image: radial-gradient(ellipse 62% 55% at 50% 50%, black 25%, transparent 78%);
          mask-image: radial-gradient(ellipse 62% 55% at 50% 50%, black 25%, transparent 78%);
          opacity: 0.16;
        }
        .mkpm-speedlines--flat.mkpm-speedlines--white {
          background-image: repeating-linear-gradient(112deg, rgba(255,255,255,0.9) 0 3px, transparent 3px 17px);
          -webkit-mask-image: radial-gradient(ellipse 62% 55% at 50% 50%, black 25%, transparent 78%);
          mask-image: radial-gradient(ellipse 62% 55% at 50% 50%, black 25%, transparent 78%);
          opacity: 0.22;
        }

        /* screentone / halftone */
        .mkpm-tone { position: absolute; inset: 0; pointer-events: none; }
        .mkpm-tone--fine.mkpm-tone--black { background-image: radial-gradient(circle, rgba(10,10,10,0.55) 1px, transparent 1.1px); background-size: 6px 6px; opacity: 0.4; }
        .mkpm-tone--fine.mkpm-tone--white { background-image: radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1.1px); background-size: 6px 6px; opacity: 0.4; }
        .mkpm-tone--regular.mkpm-tone--black { background-image: radial-gradient(circle, rgba(10,10,10,0.5) 1.6px, transparent 1.7px); background-size: 11px 11px; opacity: 0.35; }
        .mkpm-tone--regular.mkpm-tone--white { background-image: radial-gradient(circle, rgba(255,255,255,0.55) 1.6px, transparent 1.7px); background-size: 11px 11px; opacity: 0.3; }

        .mkpm-photo-tone { filter: grayscale(0.3) contrast(1.08) saturate(0.85); }

        /* panels */
        .mkpm-panel { position: relative; border: 4px solid var(--mkpm-black); border-radius: 2px; }
        .mkpm-panel--white { background: var(--mkpm-white); box-shadow: 7px 7px 0 var(--mkpm-black); }
        .mkpm-panel--black { background: var(--mkpm-black); color: var(--mkpm-white); box-shadow: 7px 7px 0 var(--mkpm-red); border-color: var(--mkpm-black); }
        .mkpm-panel--flat { box-shadow: 4px 4px 0 var(--mkpm-black); }
        .mkpm-panel--cut { clip-path: polygon(0 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%); }

        .mkpm-press { transition: transform 130ms cubic-bezier(.34,1.56,.64,1), box-shadow 130ms ease; }
        .mkpm-press:active { transform: scale(0.94) !important; }
        button.mkpm-press, .mkpm-tile.mkpm-press { cursor: pointer; }

        .mkpm-btn {
          position: relative;
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          font-family: 'Anton', sans-serif; text-transform: uppercase; letter-spacing: 0.03em;
          font-size: 1.05rem;
          color: var(--mkpm-white);
          background: var(--mkpm-black);
          border: 4px solid var(--mkpm-black);
          border-radius: 3px;
          padding: 0.9rem 1.9rem;
          box-shadow: 6px 6px 0 var(--mkpm-red);
          transition: transform 130ms cubic-bezier(.34,1.56,.64,1), box-shadow 130ms ease;
          cursor: pointer; user-select: none;
        }
        .mkpm-btn:hover { transform: translate(-2px,-2px); box-shadow: 8px 8px 0 var(--mkpm-red); }
        .mkpm-btn:active { transform: translate(3px,3px) scale(0.97); box-shadow: 2px 2px 0 var(--mkpm-red); }
        .mkpm-btn.mkpm-btn--lg { padding: 1.1rem 2.4rem; font-size: 1.35rem; }
        .mkpm-btn.mkpm-btn--red { background: var(--mkpm-red); border-color: var(--mkpm-black); box-shadow: 6px 6px 0 var(--mkpm-black); }
        .mkpm-btn.mkpm-btn--red:hover { box-shadow: 8px 8px 0 var(--mkpm-black); }
        .mkpm-btn.mkpm-btn--red:active { box-shadow: 2px 2px 0 var(--mkpm-black); }
        .mkpm-btn.mkpm-btn--ghost { background: var(--mkpm-white); color: var(--mkpm-black); box-shadow: 6px 6px 0 var(--mkpm-black); }
        .mkpm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

        /* speech bubbles */
        .mkpm-bubble { position: relative; border: 3.5px solid var(--mkpm-black); border-radius: 4px; padding: 0.85rem 1.15rem; }
        .mkpm-bubble--white { background: var(--mkpm-white); color: var(--mkpm-black); }
        .mkpm-bubble--black { background: var(--mkpm-black); color: var(--mkpm-white); }
        .mkpm-bubble--bl::before { content: ''; position: absolute; bottom: -15px; left: 28px; width: 0; height: 0; border-left: 4px solid transparent; border-right: 20px solid transparent; border-top: 16px solid var(--mkpm-black); }
        .mkpm-bubble--bl::after { content: ''; position: absolute; bottom: -9.5px; left: 32.5px; width: 0; height: 0; border-left: 2px solid transparent; border-right: 15px solid transparent; border-top: 11px solid var(--mkpm-white); }
        .mkpm-bubble--black.mkpm-bubble--bl::after { border-top-color: var(--mkpm-black); }
        .mkpm-bubble--br::before { content: ''; position: absolute; bottom: -15px; right: 28px; width: 0; height: 0; border-right: 4px solid transparent; border-left: 20px solid transparent; border-top: 16px solid var(--mkpm-black); }
        .mkpm-bubble--br::after { content: ''; position: absolute; bottom: -9.5px; right: 32.5px; width: 0; height: 0; border-right: 2px solid transparent; border-left: 15px solid transparent; border-top: 11px solid var(--mkpm-white); }

        .mkpm-chip { display: inline-flex; align-items: center; gap: 0.3rem; border-radius: 2px; padding: 0.32rem 0.7rem; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; border: 2.5px solid var(--mkpm-black); box-shadow: 2px 2px 0 var(--mkpm-black); }
        .mkpm-chip--white { background: var(--mkpm-white); color: var(--mkpm-black); }
        .mkpm-chip--red { background: var(--mkpm-red); color: var(--mkpm-white); border-color: var(--mkpm-black); }

        .mkpm-dial-btn { width: 42px; height: 42px; border-radius: 2px; background: var(--mkpm-black); color: var(--mkpm-white); border: 3px solid var(--mkpm-black); font-family: 'Anton', sans-serif; font-size: 1.4rem; line-height: 1; box-shadow: 3px 3px 0 var(--mkpm-red); transition: transform 120ms ease; }
        .mkpm-dial-btn:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 var(--mkpm-red); }
        .mkpm-dial-btn:disabled { opacity: 0.35; }

        .mkpm-tile { position: relative; overflow: hidden; text-align: left; background: var(--mkpm-white); border: 3.5px solid var(--mkpm-black); border-radius: 3px; box-shadow: 4px 4px 0 var(--mkpm-black); transition: transform 130ms ease, box-shadow 130ms ease; }
        .mkpm-tile:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 var(--mkpm-black); }
        .mkpm-tile--selected { outline: 4px solid var(--mkpm-red); outline-offset: 2px; }
        .mkpm-tile--selected::after {
          content: '✓'; position: absolute; top: -10px; right: -10px; width: 28px; height: 28px;
          background: var(--mkpm-red); color: var(--mkpm-white); border: 3px solid var(--mkpm-black); border-radius: 999px;
          display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; z-index: 5;
        }

        .mkpm-section-label {
          display: inline-flex; align-items: center; gap: 0.5rem;
          background: var(--mkpm-black); color: var(--mkpm-white);
          font-family: 'Anton', sans-serif; letter-spacing: 0.08em; text-transform: uppercase;
          padding: 0.4rem 1rem; border-radius: 2px; font-size: 0.9rem;
          transform: rotate(-1.4deg);
          border: 2px solid var(--mkpm-red);
        }

        /* onomatopoeia shouts */
        .mkpm-shout {
          display: inline-block;
          font-family: 'Anton', sans-serif; text-transform: uppercase;
          color: var(--mkpm-red);
          -webkit-text-stroke: 2px var(--mkpm-black);
          paint-order: stroke fill;
          filter: drop-shadow(3px 3px 0 var(--mkpm-black));
        }
        .mkpm-shout--sm { font-size: clamp(1.3rem, 2.4vw, 1.9rem); }
        .mkpm-shout--md { font-size: clamp(1.9rem, 4vw, 3rem); }
        .mkpm-shout--lg { font-size: clamp(2.6rem, 7vw, 5.2rem); }

        /* impact badge (price) */
        .mkpm-impact { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 148px; height: 148px; }
        .mkpm-impact-lines { inset: -60%; }
        .mkpm-impact-plate {
          position: relative; z-index: 2; width: 128px; height: 128px; border-radius: 999px;
          background: var(--mkpm-red); border: 4px solid var(--mkpm-black);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          box-shadow: 5px 5px 0 var(--mkpm-black);
        }
        .mkpm-impact-label { font-family: 'Anton', sans-serif; font-size: 1.5rem; line-height: 1; color: var(--mkpm-white); text-align: center; }
        .mkpm-impact-sub { font-family: 'Anton', sans-serif; font-size: 0.62rem; color: var(--mkpm-white); opacity: 0.85; margin-top: 3px; text-transform: uppercase; }

        @keyframes mkpm-pop { 0% { transform: scale(0.9) rotate(-2deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        .mkpm-pop-in { animation: mkpm-pop 520ms cubic-bezier(.22,1.15,.4,1) both; }
        @keyframes mkpm-flicker { 0%,100% { opacity: 1; } 50% { opacity: 0.85; } }
        .mkpm-flicker { animation: mkpm-flicker 2.4s ease-in-out infinite; }
        @keyframes mkpm-toast-in { 0% { transform: translateY(16px) scale(0.9); opacity: 0; } 60% { transform: translateY(-3px) scale(1.03); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        .mkpm-toast-in { animation: mkpm-toast-in 380ms cubic-bezier(.2,.9,.3,1.2) both; }
        @keyframes mkpm-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .mkpm-marquee-track { animation: mkpm-marquee 24s linear infinite; }
        .mkpm-faq-chev { transition: transform 220ms ease; }
        .mkpm-faq-open .mkpm-faq-chev { transform: rotate(45deg); background: var(--mkpm-red) !important; }
        .mkpm-faq-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 300ms ease; }
        .mkpm-faq-open .mkpm-faq-panel { grid-template-rows: 1fr; }
        .mkpm-faq-panel > div { overflow: hidden; }
        .mkpm-dashed { border: 4px dashed var(--mkpm-black); border-radius: 4px; }
        .mkpm-dashed.mkpm-drop-active { background: var(--mkpm-white); border-color: var(--mkpm-red); }
      `}</style>

      <div className="mk-popart-manga min-h-screen overflow-x-hidden">
        {/* ═══════════════════ HERO ═══════════════════ */}
        <section className="relative pt-10 pb-16 overflow-hidden border-b-4 border-black bg-[var(--mkpm-black)] text-white">
          <SpeedLines variant="radial" tone="white" style={{ top: "-30%", right: "-10%", left: "auto", width: "80%", height: "160%" }} />
          <Screentone size="fine" tone="white" className="opacity-30" />
          <div className="max-w-7xl mx-auto px-6 relative">
            <div className="text-xs font-extrabold uppercase tracking-widest text-white/50 mb-5 flex items-center gap-2">
              <span>{COPY.universe}</span>
              <span>›</span>
              <span className="text-[var(--mkpm-red)]">{COPY.simpsonStyle}</span>
            </div>

            <div className="grid lg:grid-cols-[1.05fr_1fr] gap-8 items-stretch">
              {/* headline + CTA */}
              <Panel rotate={-0.6} tone="black" className="p-7 md:p-9 flex flex-col justify-center relative overflow-hidden">
                <h1 className="font-mkpm-display text-[clamp(2.4rem,5.6vw,4.6rem)] mb-4 relative z-10">
                  {COPY.heroTitle1}{" "}
                  <span className="text-[var(--mkpm-red)]" style={{ WebkitTextStroke: "1.5px #fff" }}>
                    {COPY.heroTitle2}
                  </span>
                </h1>
                <p className="text-base md:text-lg font-bold text-white/75 mb-6 max-w-xl relative z-10">{COPY.heroSubtitle}</p>
                <div className="flex flex-wrap items-center gap-3 mb-6 relative z-10">
                  <Chip tone="white">⚡ {COPY.delivered48h}</Chip>
                  <Chip tone="white">🔒 {COPY.satisfiedOrRefunded}</Chip>
                </div>
                <div className="flex flex-wrap items-center gap-5 relative z-10">
                  <button type="button" onClick={scrollToConfig} className="mkpm-btn mkpm-btn--red mkpm-btn--lg mkpm-press">
                    {COPY.orderCta} →
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="flex text-[var(--mkpm-red)] text-lg leading-none">{"★".repeat(5)}</div>
                    <div className="text-sm font-bold text-white">
                      {STATS.rating}/5 · {STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}
                    </div>
                  </div>
                </div>
                <Shout text="WAOUH !" size="sm" rotate={9} className="absolute -top-2 -right-2 z-0 opacity-90" />
              </Panel>

              {/* hero photos */}
              <div className="grid grid-rows-[1.4fr_1fr] gap-5">
                <Panel rotate={0.9} tone="white" className="overflow-hidden relative">
                  <div className="relative aspect-[5/4] md:aspect-[16/11]">
                    {HERO_SLIDES.map((src, i) => (
                      <div
                        key={src}
                        className={`absolute inset-0 transition-opacity duration-700 ${i === heroIndex ? "opacity-100 mkpm-pop-in" : "opacity-0 pointer-events-none"}`}
                      >
                        <Image
                          src={src}
                          alt="Portrait cartoon jaune façon Simpson, réalisé sur mesure"
                          fill
                          className="object-cover mkpm-photo-tone"
                          priority={i === 0}
                          sizes="(max-width: 1024px) 92vw, 46vw"
                        />
                      </div>
                    ))}
                    <Screentone size="fine" tone="black" className="opacity-25 pointer-events-none" />
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                      {HERO_SLIDES.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setHeroIndex(i)}
                          aria-label={`Photo ${i + 1}`}
                          className="h-2.5 rounded-full border-2 border-black transition-all"
                          style={{ background: i === heroIndex ? "var(--mkpm-red)" : "#fff", width: i === heroIndex ? 20 : 9 }}
                        />
                      ))}
                    </div>
                  </div>
                </Panel>

                <Bubble tail="bl" tone="white" className="self-end mkpm-flicker">
                  <div className="font-mkpm-display text-2xl mb-1">
                    {COPY.orderCta.split(" ")[0]}&nbsp;<span className="text-[var(--mkpm-red)]">{formatEUR(PRICES.base)}</span>
                  </div>
                  <div className="text-xs font-bold text-black/70">{COPY.digital48h}</div>
                </Bubble>
              </div>
            </div>
          </div>

          <div className="mt-12 border-y-4 border-black bg-[var(--mkpm-red)] text-white overflow-hidden">
            <div className="flex mkpm-marquee-track whitespace-nowrap py-3 font-mkpm-display text-lg">
              {Array.from({ length: 2 }).map((_, k) => (
                <div key={k} className="flex items-center gap-8 px-5">
                  <span>+{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.portraitsDelivered}</span><span className="opacity-60">✦</span>
                  <span>{COPY.delivered48h}</span><span className="opacity-60">✦</span>
                  <span>{COPY.handDrawn}</span><span className="opacity-60">✦</span>
                  <span>{COPY.satisfiedOrRefunded}</span><span className="opacity-60">✦</span>
                  <span>{COPY.freeRevisions}</span><span className="opacity-60">✦</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
        <section className="py-16 relative border-b-4 border-black">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-10">
              <div className="mkpm-section-label mb-4">{COPY.howItWorks}</div>
              <h2 className="font-mkpm-display text-[clamp(1.9rem,3.4vw,2.8rem)]">{COPY.howItWorksTitle}</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: COPY.step1Title, desc: COPY.step1Desc, icon: "📸" },
                { title: COPY.step2Title, desc: COPY.step2Desc, icon: "🖋️" },
                { title: COPY.step3Title, desc: COPY.step3Desc, icon: "✅" },
              ].map((s, i) => (
                <Panel key={i} rotate={i % 2 === 0 ? -0.7 : 0.7} tone="white" className="p-6 text-center">
                  <div
                    className="w-16 h-16 mx-auto mb-4 rounded-full border-3 border-black flex items-center justify-center text-3xl bg-white"
                    style={{ boxShadow: "3px 3px 0 var(--mkpm-black)", borderWidth: 3 }}
                  >
                    {s.icon}
                  </div>
                  <h3 className="font-mkpm-display text-2xl mb-2">{s.title}</h3>
                  <p className="text-sm font-semibold text-black/70 mb-5">{s.desc}</p>
                  <Bubble tail="bl" tone="white" className="inline-block text-left">
                    <span className="font-mkpm-display text-lg text-[var(--mkpm-red)]">{i + 1}/3</span>
                  </Bubble>
                </Panel>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ CONFIGURATOR ═══════════════════ */}
        <section ref={configRef} id="configurator" className="py-20 border-b-4 border-black relative">
          <Screentone size="regular" tone="black" className="opacity-[0.06]" />
          <div className="max-w-7xl mx-auto px-6 relative">
            <div className="text-center mb-12">
              <div className="mkpm-section-label mb-4">{COPY.configurator}</div>
              <h2 className="font-mkpm-display text-[clamp(2rem,4vw,3.2rem)]">{COPY.composeYourPortrait}</h2>
              <p className="font-semibold text-black/70 mt-3">{COPY.guidedSteps}</p>
            </div>

            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10">
              {/* live preview */}
              <div className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
                <Panel rotate={-0.5} tone="white" className="overflow-hidden">
                  <div className="relative aspect-[4/5]">
                    <Image
                      src={selectedBackground.src}
                      alt={`Décor ${selectedBackground.label}`}
                      fill
                      className="object-cover mkpm-photo-tone transition-all duration-300"
                      sizes="(max-width: 1024px) 92vw, 520px"
                    />
                    <Screentone size="fine" tone="black" className="opacity-20" />
                    <div className="absolute top-3 left-3">
                      <Chip tone="red">{selectedBackground.label}</Chip>
                    </div>
                  </div>
                  <div className="border-t-4 border-black p-4 flex flex-wrap gap-2 bg-[var(--mkpm-paper)]">
                    <Chip>{format === "portrait" ? COPY.portrait : COPY.fullbody}</Chip>
                    <Chip>{people} {people > 1 ? COPY.peoplePlural : COPY.peopleSingular}</Chip>
                    {animals > 0 && <Chip>{animals} {animals > 1 ? COPY.animalsPlural : COPY.animalsSingular}</Chip>}
                    <Chip>{selectedPrintOption.label}</Chip>
                  </div>
                </Panel>
                <div className="mt-4 text-sm font-bold text-black/70 text-center">
                  ⏱ {COPY.estimatedDelay} : <span className="text-black">{COPY.digital48h}</span> · {COPY.print57Days}
                </div>
              </div>

              {/* steps */}
              <div className="space-y-7">
                {/* 01 framing */}
                <Panel rotate={0.3} tone="white" className="p-5">
                  <h3 className="font-mkpm-display text-xl mb-4">01 — {COPY.framingStep}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(["portrait", "fullbody"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormat(f)}
                        className={`mkpm-tile mkpm-press ${format === f ? "mkpm-tile--selected" : ""}`}
                      >
                        <div className="aspect-[5/3] bg-[var(--mkpm-paper)] flex items-center justify-center text-5xl">
                          {f === "portrait" ? "👤" : "🧍"}
                        </div>
                        <div className="px-3 py-2.5 border-t-3 border-black" style={{ borderTopWidth: 3 }}>
                          <div className="font-mkpm-display text-lg">{f === "portrait" ? COPY.portrait : COPY.fullbody}</div>
                          <div className="text-xs font-bold text-black/60">{f === "portrait" ? COPY.portraitSub : COPY.fullbodySub}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>

                {/* 02 people/animals */}
                <Panel rotate={-0.3} tone="white" className="p-5">
                  <h3 className="font-mkpm-display text-xl mb-4">02 — {COPY.whoOnPortrait}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <StepDial
                      icon="🧍"
                      label={COPY.peopleLabel}
                      value={people}
                      min={1}
                      max={8}
                      hint={`+${formatEUR(PRICES.extraPerson)} ${COPY.perExtraPerson}`}
                      onChange={setPeople}
                    />
                    <StepDial
                      icon="🐾"
                      label={COPY.animalsLabel}
                      value={animals}
                      min={0}
                      max={4}
                      hint={`+${formatEUR(PRICES.extraAnimal)} ${COPY.perAnimal}`}
                      onChange={setAnimals}
                    />
                  </div>
                </Panel>

                {/* 03 background */}
                <Panel rotate={0.3} tone="white" className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="font-mkpm-display text-xl">03 — {COPY.decorStep}</h3>
                    <span className="text-xs font-bold text-black/60">{COPY.hoverToPreview}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {BACKGROUNDS.map((bg, i) => (
                      <button
                        key={bg.src}
                        type="button"
                        onMouseEnter={() => setHoveredBg(i)}
                        onMouseLeave={() => setHoveredBg(null)}
                        onClick={() => setSelectedBg(i)}
                        className={`mkpm-tile mkpm-press ${selectedBg === i ? "mkpm-tile--selected" : ""}`}
                      >
                        <div className="relative aspect-square">
                          <Image src={bg.src} alt={bg.label} fill className="object-cover mkpm-photo-tone" sizes="180px" />
                        </div>
                        <div className="px-2 py-1.5 border-t-3 border-black bg-white" style={{ borderTopWidth: 3 }}>
                          <div className="font-mkpm-display text-[13px] leading-tight truncate">{bg.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>

                {/* 04 upload */}
                <Panel rotate={-0.3} tone="white" className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="font-mkpm-display text-xl">04 — {COPY.uploadStep}</h3>
                    <span className="text-xs font-bold text-black/60">{COPY.uploadMax8}</span>
                  </div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                    className={`mkpm-dashed px-5 py-8 text-center bg-black/[0.03] transition ${dragOver ? "mkpm-drop-active" : ""}`}
                  >
                    <div className="text-5xl mb-2" aria-hidden>📸</div>
                    <div className="font-mkpm-display text-xl">{COPY.dragHere}</div>
                    <div className="text-sm font-bold text-black/60 mb-4">{COPY.orWord}</div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mkpm-btn mkpm-press"
                      disabled={photos.length >= 8}
                    >
                      {COPY.choosePhoto}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                      className="hidden"
                    />
                    <div className="text-xs font-bold text-black/60 mt-3">{COPY.uploadHint}</div>
                  </div>
                  {photos.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {photos.map((p, i) => (
                        <div key={p.url} className="relative aspect-square border-3 border-black rounded overflow-hidden" style={{ borderWidth: 3 }}>
                          <Image src={p.url} alt={p.name || "Photo envoyée"} fill className="object-cover" unoptimized sizes="100px" />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            aria-label="Retirer la photo"
                            className="absolute top-1 right-1 w-6 h-6 bg-white border-2 border-black rounded-full font-black text-xs leading-none mkpm-press"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {photos.length < 8 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square border-3 border-black rounded flex items-center justify-center font-mkpm-display text-3xl text-black/50 mkpm-press"
                          style={{ borderWidth: 3 }}
                        >
                          +
                        </button>
                      )}
                    </div>
                  )}
                </Panel>

                {/* 05 note */}
                <Panel rotate={0.3} tone="white" className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-mkpm-display text-xl">05 — {COPY.noteForArtist}</h3>
                    <span className="text-xs font-bold text-black/60">{COPY.optional}</span>
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 400))}
                    rows={4}
                    className="w-full border-3.5 border-black rounded px-4 py-3 text-base outline-none resize-none focus:ring-2 focus:ring-[var(--mkpm-red)]"
                    style={{ borderWidth: 3.5 }}
                    placeholder={COPY.notePlaceholder}
                  />
                  <div className="text-xs font-bold text-black/50 mt-1 text-right">{note.length} / 400</div>
                </Panel>

                {/* 06 print options */}
                <Panel rotate={-0.3} tone="white" className="p-5">
                  <h3 className="font-mkpm-display text-xl mb-4">06 — {COPY.printSupportStep}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {PRINT_OPTIONS.map((opt, i) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setSelectedPrint(i)}
                        className={`mkpm-tile mkpm-press relative ${selectedPrint === i ? "mkpm-tile--selected" : ""}`}
                      >
                        {opt.badge && (
                          <div
                            className="absolute top-2.5 -left-7 bg-[var(--mkpm-red)] text-white border-y-2 border-black px-8 py-0.5 text-[10px] font-mkpm-display z-10"
                            style={{ transform: "rotate(-8deg)" }}
                          >
                            {opt.badge}
                          </div>
                        )}
                        <div className="aspect-[5/3] bg-[var(--mkpm-paper)] relative">
                          <Image src={opt.img} alt={opt.label} fill className="object-contain p-3" sizes="260px" />
                        </div>
                        <div className="px-3 py-2.5 border-t-3 border-black bg-white flex items-center justify-between gap-2" style={{ borderTopWidth: 3 }}>
                          <div>
                            <div className="font-mkpm-display text-base leading-tight">{opt.label}</div>
                            <div className="text-[11px] font-bold text-black/60">{opt.sub}</div>
                          </div>
                          <div className="font-mkpm-display text-lg whitespace-nowrap text-[var(--mkpm-red)]">{formatEUR(PRICES.base + opt.addon)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>

                {/* summary */}
                <Panel rotate={0.4} tone="black" className="p-6 relative overflow-visible">
                  <SpeedLines variant="flat" tone="white" className="opacity-40" />
                  <Shout text="PARFAIT !" size="sm" rotate={-8} className="absolute -top-5 right-4 z-10" />
                  <div className="flex items-start justify-between gap-4 flex-wrap relative z-10">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-mkpm-display text-2xl mb-3">{COPY.summary}</div>
                      <div className="space-y-1.5 text-sm font-semibold text-white/85">
                        <div className="flex justify-between gap-4">
                          <span>{format === "portrait" ? COPY.portrait : COPY.fullbody} · {selectedPrintOption.label}</span>
                          <span>{formatEUR(PRICES.base + selectedPrintOption.addon)}</span>
                        </div>
                        {format === "fullbody" && (
                          <div className="flex justify-between gap-4">
                            <span>+ {COPY.fullbody}</span>
                            <span>+{formatEUR(PRICES.fullbodyExtra)}</span>
                          </div>
                        )}
                        {people > 1 && (
                          <div className="flex justify-between gap-4">
                            <span>+{people - 1} {COPY.peoplePlural}</span>
                            <span>+{formatEUR((people - 1) * PRICES.extraPerson)}</span>
                          </div>
                        )}
                        {animals > 0 && (
                          <div className="flex justify-between gap-4">
                            <span>+{animals} {animals > 1 ? COPY.animalsPlural : COPY.animalsSingular}</span>
                            <span>+{formatEUR(animals * PRICES.extraAnimal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between gap-4 text-white/50">
                          <span>{COPY.revisionsIncluded}</span>
                          <span>{COPY.included}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-white/60">{COPY.total}</span>
                      <ImpactBadge label={formatEUR(total)} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="mkpm-btn mkpm-btn--red mkpm-btn--lg w-full mt-6 mkpm-press relative z-10"
                  >
                    {COPY.addToCart} · {formatEUR(total)} →
                  </button>
                  <div className="text-xs font-bold text-white/60 text-center mt-3 relative z-10">{COPY.paymentReassurance}</div>

                  {toastVisible && (
                    <div className="absolute left-1/2 -translate-x-1/2 -top-4 -translate-y-full mkpm-toast-in z-20">
                      <Bubble tail="none" tone="white" className="whitespace-nowrap shadow-lg">
                        <span className="font-mkpm-display text-base">{COPY.previewOnlyToast}</span>
                      </Bubble>
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ GALLERY ═══════════════════ */}
        <section className="py-20 border-b-4 border-black relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <div className="mkpm-section-label mb-4">{COPY.galleryLabel}</div>
              <h2 className="font-mkpm-display text-[clamp(2rem,4vw,3.2rem)]">{COPY.galleryTitle}</h2>
              <p className="font-semibold text-black/70 mt-3">{COPY.gallerySub}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {GALLERY_PHOTOS.map((src, i) => (
                <div
                  key={src}
                  className="relative border-4 border-black overflow-hidden bg-white mkpm-press mkpm-panel--cut"
                  style={{ boxShadow: "5px 5px 0 var(--mkpm-black)", transform: `rotate(${((i % 4) - 1.5) * 0.7}deg)` }}
                >
                  <div className="relative aspect-square">
                    <Image
                      src={src}
                      alt="Réalisation cartoon jaune Cartoonova"
                      fill
                      className="object-cover mkpm-photo-tone"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                    <Screentone size="fine" tone="black" className="opacity-15" />
                  </div>
                  {i % 3 !== 2 && (
                    <Shout
                      text={SHOUTS[i % SHOUTS.length]}
                      size="sm"
                      rotate={i % 2 === 0 ? -8 : 8}
                      className="absolute z-10"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ REVIEWS ═══════════════════ */}
        <section className="py-20 border-b-4 border-black relative bg-[var(--mkpm-black)] text-white overflow-hidden">
          <Screentone size="fine" tone="white" className="opacity-20" />
          <div className="max-w-7xl mx-auto px-6 relative">
            <div className="grid md:grid-cols-[auto_1fr] gap-12 items-center mb-14">
              <div className="text-center md:text-left relative">
                <div className="mkpm-section-label mb-4">{COPY.reviewsLabel}</div>
                <Shout text="SUPER !" size="sm" rotate={7} className="absolute -top-4 right-0 md:right-auto md:-left-2 z-10" />
                <div className="flex items-end gap-3 justify-center md:justify-start">
                  <div className="font-mkpm-display text-[6rem] leading-[0.85] text-[var(--mkpm-red)]">{STATS.rating.toString().replace(".", ",")}</div>
                  <div className="text-2xl font-mkpm-display text-white/40 mb-2">/5</div>
                </div>
                <div className="flex text-[var(--mkpm-red)] text-2xl leading-none mt-1 justify-center md:justify-start">{"★".repeat(5)}</div>
                <div className="font-bold mt-2">
                  {COPY.basedOn} <span className="bg-white text-black px-1.5 rounded border-2 border-black">{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}</span>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 max-w-md mx-auto md:mx-0">
                {STATS.distribution.map((r) => (
                  <div key={r.stars} className="contents">
                    <div className="text-sm font-bold col-span-1">{r.stars} ★</div>
                    <div className="col-span-3 h-3 bg-white/10 border-2 border-white/30 rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--mkpm-red)]" style={{ width: `${r.pct}%` }} />
                    </div>
                    <div className="text-sm font-bold col-span-1 text-right">{r.pct}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {REVIEWS.map((r, i) => (
                <Bubble key={r.name} tail={i % 2 === 0 ? "bl" : "br"} tone="white" className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-full border-2.5 border-black flex items-center justify-center font-mkpm-display text-base bg-[var(--mkpm-paper)]"
                      style={{ borderWidth: 2.5 }}
                    >
                      {r.name.charAt(0)}
                    </div>
                    <div className="font-mkpm-display text-base leading-tight">{r.name}</div>
                  </div>
                  <div className="flex text-[var(--mkpm-red)] text-sm leading-none mb-2">{"★".repeat(5)}</div>
                  <p className="text-[14px] font-semibold text-black/75 leading-snug">&ldquo;{r.text}&rdquo;</p>
                </Bubble>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ FAQ ═══════════════════ */}
        <section className="py-20 border-b-4 border-black">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-10">
              <div className="mkpm-section-label mb-4">FAQ</div>
              <h2 className="font-mkpm-display text-[clamp(2rem,4vw,3.2rem)]">{COPY.frequentQuestions}</h2>
            </div>
            <div className="space-y-4">
              {FAQ_ITEMS.map((f, i) => (
                <Panel key={f.q} rotate={i % 2 === 0 ? -0.25 : 0.25} tone="white" className={`overflow-hidden ${openFaq === i ? "mkpm-faq-open" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-5 font-mkpm-display text-lg md:text-xl"
                    aria-expanded={openFaq === i}
                  >
                    <span>{f.q}</span>
                    <span
                      className="mkpm-faq-chev w-9 h-9 shrink-0 rounded-full bg-black text-white border-3 border-black flex items-center justify-center text-2xl leading-none"
                      style={{ boxShadow: "2px 2px 0 var(--mkpm-red)", borderWidth: 3 }}
                    >
                      +
                    </span>
                  </button>
                  <div className="mkpm-faq-panel">
                    <div>
                      <div className="px-5 pb-5 text-black/70 font-semibold leading-relaxed">{f.a}</div>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ FINAL CTA ═══════════════════ */}
        <section className="relative overflow-hidden border-b-4 border-black bg-[var(--mkpm-black)] text-white">
          <SpeedLines variant="radial" tone="white" style={{ inset: "-30%" }} />
          <Screentone size="fine" tone="white" className="opacity-15" />
          <div className="relative max-w-5xl mx-auto px-6 py-20 text-center">
            <div className="inline-block bg-white text-black font-mkpm-display rounded-full px-4 py-1.5 text-sm mb-6 border-2 border-[var(--mkpm-red)]">
              +{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.satisfiedClients}
            </div>
            <div className="relative inline-block mb-4">
              <h2 className="font-mkpm-display text-[clamp(2.2rem,5.6vw,4.6rem)] relative z-10">{COPY.ctaTitle}</h2>
              <Shout text="WAOUH !" size="lg" rotate={-6} className="absolute -top-10 -right-6 md:-right-16 z-0 opacity-95" />
            </div>
            <p className="text-lg md:text-xl font-bold mb-8 text-white/75">{COPY.ctaSubtitle}</p>
            <div className="flex flex-wrap justify-center gap-3 mb-9 font-bold text-sm">
              <Chip tone="white">✏️ {COPY.pillDrawnHand}</Chip>
              <Chip tone="white">⚡ {COPY.pillDelivered48h}</Chip>
              <Chip tone="white">🔒 {COPY.pillSatisfied}</Chip>
              <Chip tone="white">🇫🇷 {COPY.madeInFrance}</Chip>
            </div>
            <button type="button" onClick={scrollToConfig} className="mkpm-btn mkpm-btn--red mkpm-btn--lg mkpm-press">
              {COPY.orderCta} →
            </button>
            <div className="text-sm font-bold text-white/60 mt-4">{COPY.paymentReassurance}</div>
          </div>
        </section>
      </div>

      <PopartVariantSwitcher />
    </>
  );
}
