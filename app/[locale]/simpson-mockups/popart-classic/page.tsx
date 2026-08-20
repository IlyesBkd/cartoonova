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

const SOUND_FX = ["VLAN!", "BADABOUM!", "SPLASH!", "KRAK!"];
const REVIEW_SPANS = [3, 3, 2, 4, 3, 3];

/* ───────────────────────── comic-page building blocks ───────────────────────── */

type Tone = "white" | "paper" | "yellow" | "yellowSoft" | "blue" | "red" | "ink";
type Cut = "none" | "tl" | "tr" | "bl" | "br" | "notch";

function toneClassName(tone: Tone) {
  switch (tone) {
    case "paper":
      return "mkpc-panel--paper";
    case "yellow":
      return "mkpc-panel--yellow";
    case "yellowSoft":
      return "mkpc-panel--yellow-soft";
    case "blue":
      return "mkpc-panel--blue";
    case "red":
      return "mkpc-panel--red";
    case "ink":
      return "mkpc-panel--ink";
    default:
      return "";
  }
}

function Panel({
  children,
  tone = "white",
  cut = "none",
  rotate = 0,
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  cut?: Cut;
  rotate?: number;
  className?: string;
}) {
  return (
    <div
      className={`mkpc-panel ${toneClassName(tone)} ${cut !== "none" ? `mkpc-cut-${cut}` : ""} ${className}`}
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
    >
      {children}
    </div>
  );
}

function Caption({
  children,
  tone = "yellow",
  rotate = -1,
  className = "",
}: {
  children: ReactNode;
  tone?: "yellow" | "white";
  rotate?: number;
  className?: string;
}) {
  return (
    <div
      className={`mkpc-caption font-mkpc-caption ${tone === "white" ? "mkpc-caption--white" : ""} ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </div>
  );
}

function SpeedBurst({ tone = "ink", className = "" }: { tone?: "ink" | "yellow"; className?: string }) {
  return <div aria-hidden className={`mkpc-speedlines ${tone === "yellow" ? "mkpc-speedlines--yellow" : ""} ${className}`} />;
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="mkpc-chip">{children}</span>;
}

function Stamp({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mkpc-stamp">
      <span className="font-mkpc-display text-2xl leading-none">{label}</span>
      {sub && <span className="text-[10px] font-bold uppercase tracking-wide mt-1 opacity-90">{sub}</span>}
    </div>
  );
}

function SpeechBubble({ children, tint = "white", className = "" }: { children: ReactNode; tint?: "white" | "yellow"; className?: string }) {
  return <div className={`mkpc-bubble mkpc-bubble--bl ${tint === "yellow" ? "mkpc-bubble--yellow" : ""} ${className}`}>{children}</div>;
}

function PlateNumber({ n }: { n: string }) {
  return <span className="mkpc-platenum">{n}</span>;
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
    <div className="border-3 border-black p-4" style={{ borderWidth: 3 }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl leading-none" aria-hidden>{icon}</span>
        <span className="font-mkpc-display text-lg">{label}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="mkpc-dial-btn"
          aria-label={`Réduire ${label}`}
        >
          −
        </button>
        <div className="font-mkpc-display text-4xl tabular-nums">{value}</div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="mkpc-dial-btn"
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
        href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=PT+Serif:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .mk-popart-classic {
          --mkpc-red: #E1251B;
          --mkpc-red-deep: #9C1710;
          --mkpc-blue: #0A3ED0;
          --mkpc-blue-deep: #062B94;
          --mkpc-blue-soft: #CFE0FF;
          --mkpc-yellow: #FFC10D;
          --mkpc-yellow-soft: #FFE9A8;
          --mkpc-ink: #0A0A0A;
          --mkpc-paper: #F1E7D0;
          --mkpc-white: #FFFFFF;
          background: var(--mkpc-paper);
          color: var(--mkpc-ink);
          font-family: 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          position: relative;
        }
        .mk-popart-classic *, .mk-popart-classic *::before, .mk-popart-classic *::after { box-sizing: border-box; }
        .mk-popart-classic .font-mkpc-display {
          font-family: 'Luckiest Guy', system-ui, sans-serif;
          letter-spacing: 0.02em;
          font-weight: 400;
          line-height: 1;
        }
        .mk-popart-classic .font-mkpc-caption {
          font-family: 'PT Serif', Georgia, serif;
          font-style: italic;
        }

        .mkpc-gutter {
          display: grid;
          grid-auto-flow: dense;
          gap: 5px;
          padding: 5px;
          background: var(--mkpc-ink);
          border: 5px solid var(--mkpc-ink);
        }
        @media (min-width: 768px) {
          .mkpc-gutter { gap: 8px; padding: 8px; border-width: 8px; }
        }

        .mkpc-panel { position: relative; background: var(--mkpc-white); overflow: hidden; }
        .mkpc-panel--paper { background: var(--mkpc-paper); }
        .mkpc-panel--yellow { background: var(--mkpc-yellow); }
        .mkpc-panel--yellow-soft { background: var(--mkpc-yellow-soft); }
        .mkpc-panel--blue { background: var(--mkpc-blue); color: var(--mkpc-white); }
        .mkpc-panel--red { background: var(--mkpc-red); color: var(--mkpc-white); }
        .mkpc-panel--ink { background: var(--mkpc-ink); color: var(--mkpc-yellow); }

        .mkpc-cut-tr { clip-path: polygon(0 0, 88% 0, 100% 12%, 100% 100%, 0 100%); }
        .mkpc-cut-bl { clip-path: polygon(0 0, 100% 0, 100% 100%, 12% 100%, 0 88%); }
        .mkpc-cut-tl { clip-path: polygon(12% 0, 100% 0, 100% 100%, 0 100%, 0 12%); }
        .mkpc-cut-br { clip-path: polygon(0 0, 100% 0, 100% 88%, 88% 100%, 0 100%); }
        .mkpc-cut-notch { clip-path: polygon(0 0, 92% 0, 100% 18%, 100% 100%, 8% 100%, 0 82%); }

        .mkpc-press { transition: transform 130ms cubic-bezier(.34,1.56,.64,1), box-shadow 130ms ease; }
        .mkpc-press:active { transform: scale(0.94) !important; }
        button.mkpc-press, .mkpc-tile.mkpc-press { cursor: pointer; }

        .mkpc-btn {
          position: relative;
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          font-family: 'Luckiest Guy', system-ui, sans-serif;
          letter-spacing: 0.02em;
          font-size: 1.05rem;
          color: var(--mkpc-ink);
          background: var(--mkpc-yellow);
          border: 4px solid var(--mkpc-ink);
          padding: 0.9rem 1.9rem;
          box-shadow: 6px 6px 0 var(--mkpc-ink);
          transition: transform 130ms cubic-bezier(.34,1.56,.64,1), box-shadow 130ms ease;
          cursor: pointer;
          user-select: none;
          clip-path: polygon(0 0, 100% 0, 100% 100%, 5% 100%, 0 86%);
        }
        .mkpc-btn:hover { transform: translate(-2px,-2px); box-shadow: 8px 8px 0 var(--mkpc-ink); }
        .mkpc-btn:active { transform: translate(3px,3px) scale(0.97); box-shadow: 2px 2px 0 var(--mkpc-ink); }
        .mkpc-btn--lg { padding: 1.05rem 2.3rem; font-size: 1.35rem; }
        .mkpc-btn--dark { background: var(--mkpc-ink); color: var(--mkpc-yellow); }
        .mkpc-btn--red { background: var(--mkpc-red); color: var(--mkpc-white); }
        .mkpc-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

        .mkpc-chip {
          display: inline-flex; align-items: center; gap: 0.3rem;
          background: var(--mkpc-white); border: 2.5px solid var(--mkpc-ink);
          padding: 0.3rem 0.7rem; font-size: 0.72rem; font-weight: 800;
          box-shadow: 2px 2px 0 var(--mkpc-ink);
        }

        .mkpc-caption {
          display: inline-block;
          background: var(--mkpc-yellow-soft);
          border: 3px solid var(--mkpc-ink);
          padding: 0.55rem 1rem;
          font-size: 0.92rem;
          line-height: 1.35;
          box-shadow: 3px 3px 0 var(--mkpc-ink);
        }
        .mkpc-caption--white { background: var(--mkpc-white); }

        .mkpc-speedlines {
          position: absolute; inset: -15%; z-index: 0; pointer-events: none;
          background: repeating-conic-gradient(var(--mkpc-ink) 0deg 2deg, transparent 2deg 9deg);
          opacity: 0.1;
        }
        .mkpc-speedlines--yellow {
          background: repeating-conic-gradient(var(--mkpc-yellow) 0deg 3deg, transparent 3deg 11deg);
          opacity: 0.4;
        }

        .mkpc-stamp {
          position: relative; display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
          background: var(--mkpc-red); color: var(--mkpc-white);
          border: 4px solid var(--mkpc-ink); padding: 1rem 1.4rem;
          box-shadow: 5px 5px 0 var(--mkpc-ink);
        }
        .mkpc-stamp::after {
          content: ''; position: absolute; inset: 6px; border: 2px dashed rgba(255,255,255,0.55); pointer-events: none;
        }

        .mkpc-bubble { position: relative; background: var(--mkpc-white); border: 3px solid var(--mkpc-ink); border-radius: 18px; padding: 0.8rem 1.05rem; }
        .mkpc-bubble--yellow { background: var(--mkpc-yellow); }
        .mkpc-bubble--bl::before, .mkpc-bubble--bl::after { content: ''; position: absolute; width: 0; height: 0; }
        .mkpc-bubble--bl::before { bottom: -15px; left: 26px; border-left: 11px solid transparent; border-right: 4px solid transparent; border-top: 17px solid var(--mkpc-ink); }
        .mkpc-bubble--bl::after { bottom: -9px; left: 29px; border-left: 8px solid transparent; border-right: 2px solid transparent; border-top: 11px solid var(--mkpc-white); }
        .mkpc-bubble--yellow.mkpc-bubble--bl::after { border-top-color: var(--mkpc-yellow); }

        .mkpc-platenum {
          position: absolute; top: 8px; left: 8px; z-index: 6;
          background: var(--mkpc-white); border: 2px solid var(--mkpc-ink);
          padding: 0.15rem 0.5rem; font-family: 'PT Serif', serif; font-style: italic; font-size: 0.7rem;
        }

        .mkpc-tile { position: relative; overflow: hidden; text-align: left; background: var(--mkpc-white); border: 3px solid var(--mkpc-ink); box-shadow: 4px 4px 0 var(--mkpc-ink); transition: transform 130ms ease, box-shadow 130ms ease; }
        .mkpc-tile:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 var(--mkpc-ink); }
        .mkpc-tile--selected { outline: 4px solid var(--mkpc-blue); outline-offset: 2px; }
        .mkpc-tile--selected::after {
          content: '✓'; position: absolute; top: -10px; right: -10px; width: 26px; height: 26px;
          background: var(--mkpc-blue); color: var(--mkpc-white); border: 3px solid var(--mkpc-ink); border-radius: 999px;
          display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 12px; z-index: 5;
        }

        .mkpc-dial-btn {
          width: 42px; height: 42px; border-radius: 999px;
          background: var(--mkpc-yellow); border: 3px solid var(--mkpc-ink);
          font-family: 'Luckiest Guy', sans-serif; font-size: 1.4rem; line-height: 1;
          box-shadow: 3px 3px 0 var(--mkpc-ink);
          transition: transform 120ms ease;
        }
        .mkpc-dial-btn:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 var(--mkpc-ink); }
        .mkpc-dial-btn:disabled { opacity: 0.35; }

        .mkpc-section-label {
          display: inline-flex; align-items: center; gap: 0.5rem;
          background: var(--mkpc-ink); color: var(--mkpc-yellow);
          font-family: 'Luckiest Guy', sans-serif; letter-spacing: 0.06em; text-transform: uppercase;
          padding: 0.4rem 1.1rem; font-size: 0.92rem;
          clip-path: polygon(0 0, 94% 0, 100% 30%, 100% 100%, 6% 100%, 0 70%);
        }

        .mkpc-onomato {
          position: absolute; z-index: 6; font-family: 'Luckiest Guy', sans-serif; color: var(--mkpc-yellow);
          -webkit-text-stroke: 2px var(--mkpc-ink); font-size: 1.5rem; transform: rotate(-6deg);
          filter: drop-shadow(2px 2px 0 var(--mkpc-ink));
        }

        .mkpc-dashed { border: 4px dashed var(--mkpc-ink); }
        .mkpc-dashed.mkpc-drop-active { background: var(--mkpc-yellow-soft); border-color: var(--mkpc-blue); }

        @keyframes mkpc-pop { 0% { transform: scale(0.9) rotate(-2deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        .mkpc-pop-in { animation: mkpc-pop 520ms cubic-bezier(.22,1.15,.4,1) both; }
        @keyframes mkpc-toast-in { 0% { transform: translateY(16px) scale(0.9); opacity: 0; } 60% { transform: translateY(-3px) scale(1.03); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        .mkpc-toast-in { animation: mkpc-toast-in 380ms cubic-bezier(.2,.9,.3,1.2) both; }
        @keyframes mkpc-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .mkpc-marquee-track { animation: mkpc-marquee 24s linear infinite; }
        .mkpc-faq-chev { transition: transform 220ms ease; }
        .mkpc-faq-open .mkpc-faq-chev { transform: rotate(45deg); }
        .mkpc-faq-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 300ms ease; }
        .mkpc-faq-open .mkpc-faq-panel { grid-template-rows: 1fr; }
        .mkpc-faq-panel > div { overflow: hidden; }
      `}</style>

      <div className="mk-popart-classic min-h-screen overflow-x-hidden">
        {/* ═══════════════════ HERO — cover page ═══════════════════ */}
        <section className="relative pt-8 pb-14 md:pb-16">
          <div className="max-w-7xl mx-auto px-3 md:px-6 relative">
            <div className="text-xs font-extrabold uppercase tracking-widest text-black/60 mb-4 flex items-center gap-2 px-1">
              <span>{COPY.universe}</span>
              <span>›</span>
              <span className="text-[var(--mkpc-red)]">{COPY.simpsonStyle}</span>
            </div>

            <div className="mkpc-gutter grid-cols-1 md:grid-cols-6 auto-rows-auto md:auto-rows-[120px]">
              {/* headline panel */}
              <Panel tone="white" cut="br" className="md:col-span-4 md:row-span-3 p-6 md:p-9 flex flex-col justify-center">
                <h1 className="font-mkpc-display text-[clamp(2.3rem,5.4vw,4.4rem)] leading-[0.92] mb-4">
                  {COPY.heroTitle1}{" "}
                  <span className="text-[var(--mkpc-red)]" style={{ WebkitTextStroke: "1.3px var(--mkpc-ink)" }}>
                    {COPY.heroTitle2}
                  </span>
                </h1>
                <p className="text-base md:text-lg font-semibold text-black/75 mb-6 max-w-xl">{COPY.heroSubtitle}</p>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <Chip>⚡ {COPY.delivered48h}</Chip>
                  <Chip>🔒 {COPY.satisfiedOrRefunded}</Chip>
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <button type="button" onClick={scrollToConfig} className="mkpc-btn mkpc-btn--lg mkpc-press">
                    {COPY.orderCta} →
                  </button>
                  <SpeechBubble className="hidden sm:block">
                    <div className="flex items-center gap-2">
                      <div className="flex text-[var(--mkpc-red)] text-base leading-none">{"★".repeat(5)}</div>
                      <div className="text-xs font-bold">
                        {STATS.rating}/5 · {STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}
                      </div>
                    </div>
                  </SpeechBubble>
                </div>
                <div className="sm:hidden mt-4 flex items-center gap-2">
                  <div className="flex text-[var(--mkpc-red)] text-base leading-none">{"★".repeat(5)}</div>
                  <div className="text-xs font-bold">
                    {STATS.rating}/5 · {STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}
                  </div>
                </div>
              </Panel>

              {/* hero photo panel */}
              <Panel tone="white" className="md:col-span-2 md:row-span-4 relative">
                <SpeedBurst tone="yellow" />
                <div className="relative aspect-[5/4] md:aspect-auto md:h-full z-[1]">
                  {HERO_SLIDES.map((src, i) => (
                    <div
                      key={src}
                      className={`absolute inset-0 transition-opacity duration-700 ${i === heroIndex ? "opacity-100 mkpc-pop-in" : "opacity-0 pointer-events-none"}`}
                    >
                      <Image
                        src={src}
                        alt="Portrait cartoon jaune façon Simpson, réalisé sur mesure"
                        fill
                        className="object-cover"
                        priority={i === 0}
                        sizes="(max-width: 768px) 92vw, 32vw"
                      />
                    </div>
                  ))}
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                    {HERO_SLIDES.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setHeroIndex(i)}
                        aria-label={`Photo ${i + 1}`}
                        className="h-2.5 border-2 border-black transition-all"
                        style={{ background: i === heroIndex ? "var(--mkpc-yellow)" : "#fff", width: i === heroIndex ? 20 : 9 }}
                      />
                    ))}
                  </div>
                </div>
              </Panel>

              {/* caption/price teaser panel */}
              <Panel tone="yellowSoft" cut="notch" className="md:col-span-2 md:row-span-1 p-4 flex flex-col justify-center gap-1">
                <div className="font-mkpc-display text-2xl leading-none">
                  {COPY.orderCta.split(" ")[0]}&nbsp;{formatEUR(PRICES.base)}
                </div>
                <div className="text-xs font-mkpc-caption font-bold text-black/70">{COPY.digital48h}</div>
              </Panel>

              {/* decorative narration panel */}
              <Panel tone="ink" cut="tl" className="md:col-span-2 md:row-span-1 p-4 flex flex-col justify-center gap-1.5">
                <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--mkpc-yellow)]/70">{COPY.handDrawn}</span>
                <span className="font-mkpc-display text-lg text-[var(--mkpc-yellow)]">{COPY.freeRevisions}</span>
              </Panel>
            </div>
          </div>

          <div className="mt-10 border-y-[6px] border-black bg-[var(--mkpc-ink)] text-[var(--mkpc-yellow)] overflow-hidden">
            <div className="flex mkpc-marquee-track whitespace-nowrap py-3 font-mkpc-display text-lg">
              {Array.from({ length: 2 }).map((_, k) => (
                <div key={k} className="flex items-center gap-8 px-5">
                  <span>+{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.portraitsDelivered}</span><span className="opacity-50">✦</span>
                  <span>{COPY.delivered48h}</span><span className="opacity-50">✦</span>
                  <span>{COPY.handDrawn}</span><span className="opacity-50">✦</span>
                  <span>{COPY.satisfiedOrRefunded}</span><span className="opacity-50">✦</span>
                  <span>{COPY.freeRevisions}</span><span className="opacity-50">✦</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ HOW IT WORKS — page 2 ═══════════════════ */}
        <section className="py-14 md:py-16">
          <div className="max-w-7xl mx-auto px-3 md:px-6">
            <div className="text-center mb-9">
              <div className="mkpc-section-label mb-4">{COPY.howItWorks}</div>
              <h2 className="font-mkpc-display text-[clamp(1.8rem,3.3vw,2.7rem)] leading-tight">{COPY.howItWorksTitle}</h2>
            </div>
            <div className="mkpc-gutter grid-cols-1 md:grid-cols-6 auto-rows-auto md:auto-rows-[100px]">
              {[
                { title: COPY.step1Title, desc: COPY.step1Desc, icon: "📸", tone: "white" as Tone, cut: "br" as Cut, span: "md:col-span-3 md:row-span-2" },
                { title: COPY.step2Title, desc: COPY.step2Desc, icon: "🎨", tone: "yellowSoft" as Tone, cut: "none" as Cut, span: "md:col-span-3 md:row-span-1" },
                { title: COPY.step3Title, desc: COPY.step3Desc, icon: "✅", tone: "white" as Tone, cut: "tl" as Cut, span: "md:col-span-3 md:row-span-1" },
              ].map((s, i) => (
                <Panel key={s.title} tone={s.tone} cut={s.cut} className={`${s.span} p-6 relative`}>
                  <PlateNumber n={`PLANCHE ${i + 1}`} />
                  <div className="mt-6">
                    <div
                      className="w-14 h-14 mb-4 rounded-full border-[3px] border-black flex items-center justify-center text-2xl"
                      style={{ background: "var(--mkpc-white)", boxShadow: "3px 3px 0 var(--mkpc-ink)" }}
                    >
                      {s.icon}
                    </div>
                    <h3 className="font-mkpc-display text-2xl mb-2">{s.title}</h3>
                    <p className="text-sm font-semibold text-black/70">{s.desc}</p>
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ CONFIGURATOR ═══════════════════ */}
        <section ref={configRef} id="configurator" className="py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-3 md:px-6">
            <div className="text-center mb-10">
              <div className="mkpc-section-label mb-4">{COPY.configurator}</div>
              <h2 className="font-mkpc-display text-[clamp(1.9rem,3.8vw,3rem)] leading-tight">{COPY.composeYourPortrait}</h2>
              <p className="font-semibold text-black/70 mt-3">{COPY.guidedSteps}</p>
            </div>

            <div className="lg:grid lg:grid-cols-[300px_1fr] gap-6">
              {/* live preview */}
              <div className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
                <Panel tone="white" cut="bl" className="relative">
                  <SpeedBurst tone="ink" className="opacity-60" />
                  <div className="relative aspect-[4/5] z-[1]">
                    <Image
                      src={selectedBackground.src}
                      alt={`Décor ${selectedBackground.label}`}
                      fill
                      className="object-cover transition-all duration-300"
                      sizes="300px"
                    />
                    <div className="absolute top-3 left-3">
                      <Chip>{selectedBackground.label}</Chip>
                    </div>
                  </div>
                  <div className="border-t-[3px] border-black p-4 flex flex-wrap gap-2 bg-[var(--mkpc-yellow-soft)] relative z-[1]">
                    <Chip>{format === "portrait" ? COPY.portrait : COPY.fullbody}</Chip>
                    <Chip>{people} {people > 1 ? COPY.peoplePlural : COPY.peopleSingular}</Chip>
                    {animals > 0 && <Chip>{animals} {animals > 1 ? COPY.animalsPlural : COPY.animalsSingular}</Chip>}
                    <Chip>{selectedPrintOption.label}</Chip>
                  </div>
                </Panel>
                <Caption tone="white" rotate={0.6} className="mt-4 block text-center">
                  {COPY.estimatedDelay} : <strong>{COPY.digital48h}</strong> · {COPY.print57Days}
                </Caption>
              </div>

              {/* steps grid */}
              <div className="mkpc-gutter grid-cols-1 md:grid-cols-4 auto-rows-auto">
                {/* 01 framing */}
                <div className="md:col-span-2 bg-white p-5">
                  <h3 className="font-mkpc-display text-xl mb-4">01 — {COPY.framingStep}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(["portrait", "fullbody"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormat(f)}
                        className={`mkpc-tile mkpc-press ${format === f ? "mkpc-tile--selected" : ""}`}
                      >
                        <div className="aspect-[5/3] bg-[var(--mkpc-yellow-soft)] flex items-center justify-center text-5xl">
                          {f === "portrait" ? "👤" : "🧍"}
                        </div>
                        <div className="px-3 py-2.5 border-t-[3px] border-black">
                          <div className="font-mkpc-display text-lg">{f === "portrait" ? COPY.portrait : COPY.fullbody}</div>
                          <div className="text-xs font-bold text-black/60">{f === "portrait" ? COPY.portraitSub : COPY.fullbodySub}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 02 people/animals */}
                <div className="md:col-span-2 bg-white p-5">
                  <h3 className="font-mkpc-display text-xl mb-4">02 — {COPY.whoOnPortrait}</h3>
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
                </div>

                {/* 03 background */}
                <div className="md:col-span-4 bg-white p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="font-mkpc-display text-xl">03 — {COPY.decorStep}</h3>
                    <span className="text-xs font-bold text-black/60">{COPY.hoverToPreview}</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {BACKGROUNDS.map((bg, i) => (
                      <button
                        key={bg.src}
                        type="button"
                        onMouseEnter={() => setHoveredBg(i)}
                        onMouseLeave={() => setHoveredBg(null)}
                        onClick={() => setSelectedBg(i)}
                        className={`mkpc-tile mkpc-press ${selectedBg === i ? "mkpc-tile--selected" : ""}`}
                      >
                        <div className="relative aspect-square">
                          <Image src={bg.src} alt={bg.label} fill className="object-cover" sizes="180px" />
                        </div>
                        <div className="px-2 py-1.5 border-t-[3px] border-black bg-white">
                          <div className="font-mkpc-display text-[13px] leading-tight truncate">{bg.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 04 upload */}
                <div className="md:col-span-2 bg-white p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="font-mkpc-display text-xl">04 — {COPY.uploadStep}</h3>
                    <span className="text-xs font-bold text-black/60">{COPY.uploadMax8}</span>
                  </div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                    className={`mkpc-dashed px-4 py-7 text-center bg-[var(--mkpc-yellow-soft)]/40 transition ${dragOver ? "mkpc-drop-active" : ""}`}
                  >
                    <div className="text-4xl mb-2" aria-hidden>📸</div>
                    <div className="font-mkpc-display text-lg">{COPY.dragHere}</div>
                    <div className="text-sm font-bold text-black/60 mb-3">{COPY.orWord}</div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mkpc-btn mkpc-press"
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
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {photos.map((p, i) => (
                        <div key={p.url} className="relative aspect-square border-[3px] border-black overflow-hidden">
                          <Image src={p.url} alt={p.name || "Photo envoyée"} fill className="object-cover" unoptimized sizes="100px" />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            aria-label="Retirer la photo"
                            className="absolute top-1 right-1 w-6 h-6 bg-white border-2 border-black rounded-full font-black text-xs leading-none mkpc-press"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {photos.length < 8 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square border-[3px] border-black flex items-center justify-center font-mkpc-display text-3xl text-black/50 mkpc-press"
                        >
                          +
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 05 note */}
                <div className="md:col-span-2 bg-white p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-mkpc-display text-xl">05 — {COPY.noteForArtist}</h3>
                    <span className="text-xs font-bold text-black/60">{COPY.optional}</span>
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 400))}
                    rows={4}
                    className="w-full border-[3px] border-black px-4 py-3 text-base outline-none resize-none focus:ring-2 focus:ring-[var(--mkpc-blue)]"
                    placeholder={COPY.notePlaceholder}
                  />
                  <div className="text-xs font-bold text-black/50 mt-1 text-right">{note.length} / 400</div>
                </div>

                {/* 06 print options */}
                <div className="md:col-span-4 bg-white p-5">
                  <h3 className="font-mkpc-display text-xl mb-4">06 — {COPY.printSupportStep}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {PRINT_OPTIONS.map((opt, i) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setSelectedPrint(i)}
                        className={`mkpc-tile mkpc-press relative ${selectedPrint === i ? "mkpc-tile--selected" : ""}`}
                      >
                        {opt.badge && (
                          <div className="absolute top-2 left-2 bg-[var(--mkpc-red)] text-white border-2 border-black px-2 py-0.5 text-[10px] font-mkpc-display z-10">
                            {opt.badge}
                          </div>
                        )}
                        <div className="aspect-[5/3] bg-[var(--mkpc-yellow-soft)] relative">
                          <Image src={opt.img} alt={opt.label} fill className="object-contain p-3" sizes="220px" />
                        </div>
                        <div className="px-3 py-2.5 border-t-[3px] border-black bg-white flex items-center justify-between gap-2">
                          <div>
                            <div className="font-mkpc-display text-base leading-tight">{opt.label}</div>
                            <div className="text-[11px] font-bold text-black/60">{opt.sub}</div>
                          </div>
                          <div className="font-mkpc-display text-lg whitespace-nowrap">{formatEUR(PRICES.base + opt.addon)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* summary */}
                <div className="md:col-span-4 relative">
                  <Panel tone="red" cut="notch" className="p-6 relative overflow-visible">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="font-mkpc-display text-2xl mb-3">{COPY.summary}</div>
                        <div className="space-y-1.5 text-sm font-semibold">
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
                          <div className="flex justify-between gap-4 text-white/75">
                            <span>{COPY.revisionsIncluded}</span>
                            <span>{COPY.included}</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-center gap-1">
                        <span className="text-xs font-extrabold uppercase tracking-wide text-white/80">{COPY.total}</span>
                        <Stamp label={formatEUR(total)} />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddToCart}
                      className="mkpc-btn mkpc-btn--dark mkpc-btn--lg w-full mt-6 mkpc-press"
                    >
                      {COPY.addToCart} · {formatEUR(total)} →
                    </button>
                    <div className="text-xs font-bold text-white/80 text-center mt-3">{COPY.paymentReassurance}</div>

                    {toastVisible && (
                      <div className="absolute left-1/2 -translate-x-1/2 -top-4 -translate-y-full mkpc-toast-in z-20">
                        <Caption tone="white" rotate={0} className="whitespace-nowrap shadow-lg">
                          <span className="font-mkpc-display text-base not-italic">{COPY.previewOnlyToast}</span>
                        </Caption>
                      </div>
                    )}
                  </Panel>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ GALLERY — page of small panels ═══════════════════ */}
        <section className="py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-3 md:px-6">
            <div className="text-center mb-10">
              <div className="mkpc-section-label mb-4">{COPY.galleryLabel}</div>
              <h2 className="font-mkpc-display text-[clamp(1.9rem,3.8vw,3rem)] leading-tight">{COPY.galleryTitle}</h2>
              <p className="font-semibold text-black/70 mt-3">{COPY.gallerySub}</p>
            </div>
            <div className="mkpc-gutter grid-cols-2 md:grid-cols-6 auto-rows-[90px] md:auto-rows-[110px]">
              {GALLERY_PHOTOS.map((src, i) => {
                const cuts: Cut[] = ["none", "tl", "tr", "br", "bl"];
                const cut = cuts[i % cuts.length];
                const rowSpan = i % 5 === 0 ? 2 : 1;
                return (
                  <div key={src} className="relative bg-white" style={{ gridColumn: "span 2 / span 2", gridRow: `span ${rowSpan} / span ${rowSpan}` }}>
                    <Panel tone="white" cut={cut} className="absolute inset-0">
                      <PlateNumber n={`Nº ${String(i + 1).padStart(2, "0")}`} />
                      <div className="relative w-full h-full">
                        <Image
                          src={src}
                          alt="Réalisation cartoon jaune Cartoonova"
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 45vw, 30vw"
                        />
                      </div>
                      {i % 3 === 1 && (
                        <span className="mkpc-onomato" style={{ bottom: "6%", right: "6%" }}>
                          {SOUND_FX[i % SOUND_FX.length]}
                        </span>
                      )}
                    </Panel>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════════ REVIEWS ═══════════════════ */}
        <section className="py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-3 md:px-6">
            <div className="grid md:grid-cols-[auto_1fr] gap-10 items-center mb-12">
              <div className="text-center md:text-left">
                <div className="mkpc-section-label mb-4">{COPY.reviewsLabel}</div>
                <div className="flex items-end gap-3 justify-center md:justify-start">
                  <div className="font-mkpc-display text-[5.5rem] leading-[0.85]">{STATS.rating.toString().replace(".", ",")}</div>
                  <div className="text-2xl font-mkpc-display text-black/50 mb-2">/5</div>
                </div>
                <div className="flex text-[var(--mkpc-red)] text-2xl leading-none mt-1 justify-center md:justify-start">{"★".repeat(5)}</div>
                <div className="font-bold mt-2">
                  {COPY.basedOn} <span className="bg-[var(--mkpc-yellow)] px-1.5 border-2 border-black">{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}</span>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 max-w-md mx-auto md:mx-0">
                {STATS.distribution.map((r) => (
                  <div key={r.stars} className="contents">
                    <div className="text-sm font-bold col-span-1">{r.stars} ★</div>
                    <div className="col-span-3 h-3 bg-white border-2 border-black overflow-hidden">
                      <div className="h-full bg-[var(--mkpc-red)]" style={{ width: `${r.pct}%` }} />
                    </div>
                    <div className="text-sm font-bold col-span-1 text-right">{r.pct}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mkpc-gutter grid-cols-1 md:grid-cols-6 auto-rows-auto">
              {REVIEWS.map((r, i) => (
                <div key={r.name} className="bg-white p-5" style={{ gridColumn: `span ${REVIEW_SPANS[i % REVIEW_SPANS.length]} / span ${REVIEW_SPANS[i % REVIEW_SPANS.length]}` }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center font-mkpc-display text-base"
                      style={{ background: ["var(--mkpc-blue-soft)", "var(--mkpc-yellow-soft)", "#F6D3D0"][i % 3] }}
                    >
                      {r.name.charAt(0)}
                    </div>
                    <div className="font-mkpc-display text-base leading-tight">{r.name}</div>
                  </div>
                  <div className="flex text-[var(--mkpc-red)] text-sm leading-none mb-2">{"★".repeat(5)}</div>
                  <Caption tone="white" rotate={0} className="block w-full">
                    &ldquo;{r.text}&rdquo;
                  </Caption>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ FAQ ═══════════════════ */}
        <section className="py-16 md:py-20">
          <div className="max-w-3xl mx-auto px-3 md:px-6">
            <div className="text-center mb-9">
              <div className="mkpc-section-label mb-4">FAQ</div>
              <h2 className="font-mkpc-display text-[clamp(1.9rem,3.8vw,3rem)] leading-tight">{COPY.frequentQuestions}</h2>
            </div>
            <div className="mkpc-gutter grid-cols-1 auto-rows-auto">
              {FAQ_ITEMS.map((f, i) => (
                <Panel
                  key={f.q}
                  tone="white"
                  cut={i % 2 === 0 ? "tr" : "bl"}
                  className={`overflow-hidden ${openFaq === i ? "mkpc-faq-open" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-5 font-mkpc-display text-lg md:text-xl"
                    aria-expanded={openFaq === i}
                  >
                    <span>{f.q}</span>
                    <span
                      className="mkpc-faq-chev w-9 h-9 shrink-0 rounded-full bg-[var(--mkpc-yellow)] border-[3px] border-black flex items-center justify-center text-2xl leading-none"
                      style={{ boxShadow: "2px 2px 0 var(--mkpc-ink)" }}
                    >
                      +
                    </span>
                  </button>
                  <div className="mkpc-faq-panel">
                    <div>
                      <div className="px-5 pb-5 text-black/70 font-semibold leading-relaxed">{f.a}</div>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ FINAL CTA — back cover ═══════════════════ */}
        <section className="py-14 md:py-16">
          <div className="max-w-5xl mx-auto px-3 md:px-6">
            <Panel tone="ink" cut="notch" className="relative text-center px-6 py-16 md:py-20">
              <SpeedBurst tone="yellow" />
              <div className="relative z-[1]">
                <div className="inline-block bg-[var(--mkpc-yellow)] text-black font-mkpc-display px-4 py-1.5 text-sm mb-6">
                  +{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.satisfiedClients}
                </div>
                <h2 className="font-mkpc-display text-[clamp(2.1rem,5.4vw,4.4rem)] leading-[0.95] mb-4 text-[var(--mkpc-yellow)]">{COPY.ctaTitle}</h2>
                <p className="text-lg md:text-xl font-bold mb-8 text-white/85">{COPY.ctaSubtitle}</p>
                <div className="flex flex-wrap justify-center gap-3 mb-9 font-bold text-sm">
                  <Chip>✏️ {COPY.pillDrawnHand}</Chip>
                  <Chip>⚡ {COPY.pillDelivered48h}</Chip>
                  <Chip>🔒 {COPY.pillSatisfied}</Chip>
                  <Chip>🇫🇷 {COPY.madeInFrance}</Chip>
                </div>
                <button type="button" onClick={scrollToConfig} className="mkpc-btn mkpc-btn--red mkpc-btn--lg mkpc-press">
                  {COPY.orderCta} →
                </button>
                <div className="text-sm font-bold text-white/70 mt-4">{COPY.paymentReassurance}</div>
              </div>
            </Panel>
          </div>
        </section>
      </div>

      <PopartVariantSwitcher />
    </>
  );
}
