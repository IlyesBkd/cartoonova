"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
type Tone = "pink" | "cyan" | "acid";

const TAGS = ["WAOUH !", "BOOM !", "TROP STYLE !", "ZAP !", "OH OUI !"];

/* ───────────────────────── small neon-graffiti building blocks ───────────────────────── */

function Splat({ tone = "pink", className = "", style }: { tone?: Tone; className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={`mkpn-splat mkpn-splat--${tone} ${className}`} style={style} />;
}

function NeonPanel({
  children,
  tone,
  rotate = 0,
  className = "",
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  rotate?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`mkpn-panel ${tone ? `mkpn-panel--${tone}` : ""} ${className}`}
      style={{ transform: `rotate(${rotate}deg)`, ...style }}
    >
      {children}
    </div>
  );
}

function TiltTag({
  children,
  tone = "pink",
  rotate = -8,
  size = "md",
  className = "",
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  rotate?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={`mkpn-tag mkpn-tag--${tone} mkpn-tag--${size} ${className}`}
      style={{ transform: `rotate(${rotate}deg)`, ...style }}
    >
      {children}
    </div>
  );
}

function Chip({ tone = "cyan", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`mkpn-chip mkpn-chip--${tone}`}>{children}</span>;
}

function DiagonalDivider({ flip = false }: { flip?: boolean }) {
  return <div aria-hidden className={`mkpn-divider ${flip ? "mkpn-divider--flip" : ""}`} />;
}

function StepDial({
  icon,
  label,
  value,
  min,
  max,
  hint,
  tone = "pink",
  onChange,
}: {
  icon: string;
  label: string;
  value: number;
  min: number;
  max: number;
  hint?: string;
  tone?: Tone;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mkpn-panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl leading-none" aria-hidden>{icon}</span>
        <span className="font-mkpn-display text-lg text-[var(--mkpn-text)]">{label}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className={`mkpn-dial-btn mkpn-dial-btn--${tone}`}
          aria-label={`Réduire ${label}`}
        >
          −
        </button>
        <div className="font-mkpn-display text-4xl tabular-nums text-[var(--mkpn-text)]">{value}</div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className={`mkpn-dial-btn mkpn-dial-btn--${tone}`}
          aria-label={`Augmenter ${label}`}
        >
          +
        </button>
      </div>
      {hint && <div className="text-[11px] font-semibold text-[var(--mkpn-text-soft)] mt-2 text-center">{hint}</div>}
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
        href="https://fonts.googleapis.com/css2?family=Righteous&family=Poppins:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .mk-popart-neon {
          --mkpn-bg: #0A0118;
          --mkpn-bg2: #130827;
          --mkpn-bg3: #1B0E38;
          --mkpn-pink: #FF00E5;
          --mkpn-cyan: #00FFF0;
          --mkpn-acid: #CCFF00;
          --mkpn-line: rgba(255,255,255,0.14);
          --mkpn-text: #F7F3FF;
          --mkpn-text-muted: #CBC2E4;
          --mkpn-text-soft: #9C90C4;
          --mkpn-ink: #0A0118;
          background: var(--mkpn-bg);
          color: var(--mkpn-text-muted);
          font-family: 'Poppins', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          position: relative;
        }
        .mk-popart-neon *, .mk-popart-neon *::before, .mk-popart-neon *::after { box-sizing: border-box; }
        .mk-popart-neon .font-mkpn-display {
          font-family: 'Righteous', 'Poppins', system-ui, sans-serif;
          letter-spacing: 0.01em;
          line-height: 1.05;
        }

        .mkpn-splat {
          position: absolute; z-index: 0; pointer-events: none;
          width: 340px; height: 340px; filter: blur(6px); opacity: 0.5;
          border-radius: 42% 58% 63% 37% / 41% 45% 55% 59%;
          mix-blend-mode: screen;
        }
        .mkpn-splat--pink { background: radial-gradient(circle at 35% 35%, rgba(255,0,229,0.55), rgba(255,0,229,0) 70%); }
        .mkpn-splat--cyan { background: radial-gradient(circle at 60% 40%, rgba(0,255,240,0.5), rgba(0,255,240,0) 70%); }
        .mkpn-splat--acid { background: radial-gradient(circle at 45% 55%, rgba(204,255,0,0.42), rgba(204,255,0,0) 70%); }

        .mkpn-panel {
          position: relative;
          background: var(--mkpn-bg2);
          border: 2px solid var(--mkpn-line);
          border-radius: 18px;
          box-shadow: 0 20px 46px rgba(0,0,0,0.55);
        }
        .mkpn-panel--pink { border-color: var(--mkpn-pink); box-shadow: 0 0 16px rgba(255,0,229,0.4), 0 0 42px rgba(255,0,229,0.16), 0 20px 46px rgba(0,0,0,0.5); }
        .mkpn-panel--cyan { border-color: var(--mkpn-cyan); box-shadow: 0 0 16px rgba(0,255,240,0.36), 0 0 42px rgba(0,255,240,0.14), 0 20px 46px rgba(0,0,0,0.5); }
        .mkpn-panel--acid { border-color: var(--mkpn-acid); box-shadow: 0 0 16px rgba(204,255,0,0.36), 0 0 42px rgba(204,255,0,0.14), 0 20px 46px rgba(0,0,0,0.5); }

        .mkpn-press { transition: transform 140ms cubic-bezier(.34,1.56,.64,1), box-shadow 140ms ease; }
        .mkpn-press:active { transform: scale(0.95) !important; }
        button.mkpn-press, .mkpn-tile.mkpn-press { cursor: pointer; }

        .mkpn-btn {
          position: relative;
          display: inline-flex; align-items: center; justify-content: center; gap: 0.55rem;
          font-family: 'Righteous', system-ui, sans-serif;
          letter-spacing: 0.02em;
          font-size: 1.05rem;
          color: var(--mkpn-ink);
          background: var(--mkpn-acid);
          border: none;
          border-radius: 999px;
          padding: 0.95rem 2rem;
          box-shadow: 0 0 0 2px rgba(204,255,0,0.35), 0 0 24px rgba(204,255,0,0.55), 0 10px 24px rgba(0,0,0,0.5);
          transition: transform 140ms cubic-bezier(.34,1.56,.64,1), box-shadow 140ms ease;
          cursor: pointer;
          user-select: none;
        }
        .mkpn-btn:hover { transform: translateY(-2px); box-shadow: 0 0 0 2px rgba(204,255,0,0.5), 0 0 34px rgba(204,255,0,0.7), 0 14px 28px rgba(0,0,0,0.55); }
        .mkpn-btn:active { transform: translateY(0) scale(0.97); }
        .mkpn-btn.mkpn-btn--lg { padding: 1.15rem 2.5rem; font-size: 1.35rem; }
        .mkpn-btn.mkpn-btn--outline {
          background: transparent; color: var(--mkpn-text);
          box-shadow: 0 0 0 2px var(--mkpn-cyan), 0 0 20px rgba(0,255,240,0.4);
        }
        .mkpn-btn.mkpn-btn--outline:hover { box-shadow: 0 0 0 2px var(--mkpn-cyan), 0 0 32px rgba(0,255,240,0.65); }
        .mkpn-btn.mkpn-btn--pink { background: var(--mkpn-pink); color: #1a0016; box-shadow: 0 0 0 2px rgba(255,0,229,0.4), 0 0 26px rgba(255,0,229,0.6), 0 10px 24px rgba(0,0,0,0.5); }
        .mkpn-btn.mkpn-btn--pink:hover { box-shadow: 0 0 0 2px rgba(255,0,229,0.55), 0 0 38px rgba(255,0,229,0.75), 0 14px 28px rgba(0,0,0,0.55); }
        .mkpn-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none !important; }

        .mkpn-chip {
          display: inline-flex; align-items: center; gap: 0.35rem;
          background: rgba(255,255,255,0.04); border: 1.5px solid var(--mkpn-line);
          border-radius: 999px; padding: 0.34rem 0.8rem; font-size: 0.72rem; font-weight: 700;
          color: var(--mkpn-text);
        }
        .mkpn-chip--pink { border-color: rgba(255,0,229,0.55); box-shadow: 0 0 10px rgba(255,0,229,0.25); }
        .mkpn-chip--cyan { border-color: rgba(0,255,240,0.55); box-shadow: 0 0 10px rgba(0,255,240,0.25); }
        .mkpn-chip--acid { border-color: rgba(204,255,0,0.55); box-shadow: 0 0 10px rgba(204,255,0,0.25); }

        .mkpn-tag {
          position: absolute; z-index: 6;
          font-family: 'Righteous', system-ui, sans-serif;
          -webkit-text-stroke: 1.5px rgba(10,1,24,0.9);
          white-space: nowrap;
        }
        .mkpn-tag--sm { font-size: clamp(1.1rem, 2.2vw, 1.5rem); }
        .mkpn-tag--md { font-size: clamp(1.6rem, 3.4vw, 2.4rem); }
        .mkpn-tag--lg { font-size: clamp(2.4rem, 6vw, 4.4rem); }
        .mkpn-tag--pink { color: var(--mkpn-pink); text-shadow: 0 0 8px var(--mkpn-pink), 0 0 22px rgba(255,0,229,0.7), 0 0 48px rgba(255,0,229,0.4); }
        .mkpn-tag--cyan { color: var(--mkpn-cyan); text-shadow: 0 0 8px var(--mkpn-cyan), 0 0 22px rgba(0,255,240,0.7), 0 0 48px rgba(0,255,240,0.4); }
        .mkpn-tag--acid { color: var(--mkpn-acid); text-shadow: 0 0 8px var(--mkpn-acid), 0 0 22px rgba(204,255,0,0.7), 0 0 48px rgba(204,255,0,0.4); }

        .mkpn-glow-pink { text-shadow: 0 0 8px var(--mkpn-pink), 0 0 24px rgba(255,0,229,0.65), 0 0 54px rgba(255,0,229,0.35); }
        .mkpn-glow-cyan { text-shadow: 0 0 8px var(--mkpn-cyan), 0 0 24px rgba(0,255,240,0.65), 0 0 54px rgba(0,255,240,0.35); }
        .mkpn-glow-acid { text-shadow: 0 0 8px var(--mkpn-acid), 0 0 24px rgba(204,255,0,0.65), 0 0 54px rgba(204,255,0,0.35); }

        .mkpn-dial-btn {
          width: 44px; height: 44px; border-radius: 999px;
          background: var(--mkpn-bg3); border: 2px solid var(--mkpn-line);
          font-family: 'Righteous', sans-serif; font-size: 1.5rem; line-height: 1; color: var(--mkpn-text);
          transition: transform 120ms ease, box-shadow 120ms ease;
        }
        .mkpn-dial-btn--pink { border-color: var(--mkpn-pink); box-shadow: 0 0 12px rgba(255,0,229,0.35); }
        .mkpn-dial-btn--cyan { border-color: var(--mkpn-cyan); box-shadow: 0 0 12px rgba(0,255,240,0.35); }
        .mkpn-dial-btn:active { transform: scale(0.9); }
        .mkpn-dial-btn:disabled { opacity: 0.3; }

        .mkpn-tile {
          position: relative; overflow: hidden; text-align: left;
          background: var(--mkpn-bg2); border: 2px solid var(--mkpn-line); border-radius: 14px;
          transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
        }
        .mkpn-tile:hover { transform: translateY(-3px); border-color: var(--mkpn-cyan); box-shadow: 0 0 20px rgba(0,255,240,0.3); }
        .mkpn-tile--selected { border-color: var(--mkpn-acid); box-shadow: 0 0 0 2px rgba(204,255,0,0.25), 0 0 26px rgba(204,255,0,0.45); }
        .mkpn-tile--selected::after {
          content: '✓'; position: absolute; top: -10px; right: -10px; width: 28px; height: 28px;
          background: var(--mkpn-acid); color: var(--mkpn-ink); border-radius: 999px;
          display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; z-index: 5;
          box-shadow: 0 0 14px rgba(204,255,0,0.7);
        }

        .mkpn-section-label {
          display: inline-flex; align-items: center; gap: 0.5rem;
          background: rgba(255,255,255,0.05); color: var(--mkpn-acid);
          border: 1.5px solid rgba(204,255,0,0.5);
          font-family: 'Righteous', sans-serif; letter-spacing: 0.1em; text-transform: uppercase;
          padding: 0.4rem 1.1rem; border-radius: 999px; font-size: 0.85rem;
          transform: rotate(-1.6deg);
          box-shadow: 0 0 16px rgba(204,255,0,0.25);
        }

        .mkpn-divider {
          position: relative; z-index: 4;
          height: 64px; margin-top: -32px; margin-bottom: -32px;
          background: linear-gradient(90deg, var(--mkpn-pink), var(--mkpn-cyan) 50%, var(--mkpn-acid));
          clip-path: polygon(0 38%, 100% 4%, 100% 62%, 0% 96%);
          filter: drop-shadow(0 0 14px rgba(255,0,229,0.35)) drop-shadow(0 0 14px rgba(0,255,240,0.25));
          opacity: 0.9;
        }
        .mkpn-divider--flip { clip-path: polygon(0 4%, 100% 38%, 100% 96%, 0% 62%); }

        .mkpn-dashed { border: 3px dashed var(--mkpn-line); border-radius: 16px; }
        .mkpn-dashed.mkpn-drop-active { border-color: var(--mkpn-pink); box-shadow: 0 0 24px rgba(255,0,229,0.35); background: rgba(255,0,229,0.06); }

        @keyframes mkpn-pop { 0% { transform: scale(0.92) rotate(-1.5deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        .mkpn-pop-in { animation: mkpn-pop 520ms cubic-bezier(.22,1.15,.4,1) both; }
        @keyframes mkpn-flicker {
          0%, 19%, 21%, 23%, 54%, 56%, 100% { opacity: 1; }
          20%, 22%, 55% { opacity: 0.72; }
        }
        .mkpn-flicker { animation: mkpn-flicker 5s linear infinite; }
        @keyframes mkpn-float { 0%, 100% { transform: translateY(0) rotate(var(--mkpn-r, -6deg)); } 50% { transform: translateY(-8px) rotate(var(--mkpn-r, -6deg)); } }
        .mkpn-float { animation: mkpn-float 4.2s ease-in-out infinite; }
        @keyframes mkpn-toast-in { 0% { transform: translateY(16px) scale(0.9); opacity: 0; } 60% { transform: translateY(-3px) scale(1.03); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        .mkpn-toast-in { animation: mkpn-toast-in 380ms cubic-bezier(.2,.9,.3,1.2) both; }
        @keyframes mkpn-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .mkpn-marquee-track { animation: mkpn-marquee 24s linear infinite; }
        .mkpn-faq-chev { transition: transform 220ms ease; color: var(--mkpn-acid); }
        .mkpn-faq-open .mkpn-faq-chev { transform: rotate(45deg); }
        .mkpn-faq-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 300ms ease; }
        .mkpn-faq-open .mkpn-faq-panel { grid-template-rows: 1fr; }
        .mkpn-faq-panel > div { overflow: hidden; }
      `}</style>

      <div className="mk-popart-neon min-h-screen overflow-x-hidden">
        {/* ═══════════════════ HERO ═══════════════════ */}
        <section className="relative pt-12 pb-20 overflow-hidden">
          <Splat tone="pink" style={{ top: -120, left: -100 }} />
          <Splat tone="cyan" style={{ bottom: -140, right: -80 }} />
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mkpn-text-soft)] mb-6 flex items-center gap-2">
              <span>{COPY.universe}</span>
              <span className="text-[var(--mkpn-pink)]">›</span>
              <span className="text-[var(--mkpn-cyan)] mkpn-glow-cyan">{COPY.simpsonStyle}</span>
            </div>

            <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 items-stretch">
              {/* headline + CTA */}
              <NeonPanel rotate={-0.5} className="p-7 md:p-10 flex flex-col justify-center relative overflow-visible">
                <TiltTag tone="acid" size="sm" rotate={-10} className="hidden md:block" style={{ top: -22, right: 18 }}>
                  {TAGS[0]}
                </TiltTag>
                <h1 className="font-mkpn-display text-[clamp(2.3rem,5.2vw,4.2rem)] leading-[1] mb-5 text-[var(--mkpn-text)]">
                  {COPY.heroTitle1}{" "}
                  <span className="text-[var(--mkpn-pink)] mkpn-glow-pink mkpn-flicker block sm:inline">{COPY.heroTitle2}</span>
                </h1>
                <p className="text-base md:text-lg font-medium text-[var(--mkpn-text-muted)] mb-7 max-w-xl">
                  {COPY.heroSubtitle}
                </p>
                <div className="flex flex-wrap items-center gap-3 mb-7">
                  <Chip tone="cyan">⚡ {COPY.delivered48h}</Chip>
                  <Chip tone="acid">🔒 {COPY.satisfiedOrRefunded}</Chip>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <button type="button" onClick={scrollToConfig} className="mkpn-btn mkpn-btn--lg mkpn-press">
                    {COPY.orderCta} →
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="flex text-[var(--mkpn-acid)] text-lg leading-none">{"★".repeat(5)}</div>
                    <div className="text-sm font-bold text-[var(--mkpn-text)]">
                      {STATS.rating}/5 · {STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}
                    </div>
                  </div>
                </div>
              </NeonPanel>

              {/* hero photos */}
              <div className="grid grid-rows-[1.5fr_auto] gap-6 relative">
                <NeonPanel tone="cyan" rotate={1} className="overflow-hidden relative">
                  <div className="relative aspect-[5/4] md:aspect-[16/11]">
                    {HERO_SLIDES.map((src, i) => (
                      <div
                        key={src}
                        className={`absolute inset-0 transition-opacity duration-700 ${i === heroIndex ? "opacity-100 mkpn-pop-in" : "opacity-0 pointer-events-none"}`}
                      >
                        <Image
                          src={src}
                          alt="Portrait cartoon façon pop-art néon, réalisé sur mesure"
                          fill
                          className="object-cover"
                          priority={i === 0}
                          sizes="(max-width: 1024px) 92vw, 46vw"
                        />
                        <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 60px rgba(10,1,24,0.55)" }} />
                      </div>
                    ))}
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                      {HERO_SLIDES.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setHeroIndex(i)}
                          aria-label={`Photo ${i + 1}`}
                          className="h-2.5 rounded-full transition-all"
                          style={{
                            background: i === heroIndex ? "var(--mkpn-acid)" : "rgba(255,255,255,0.35)",
                            width: i === heroIndex ? 22 : 9,
                            boxShadow: i === heroIndex ? "0 0 10px var(--mkpn-acid)" : "none",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </NeonPanel>

                <NeonPanel tone="pink" rotate={-1.5} className="self-end px-5 py-4 mkpn-float" style={{ "--mkpn-r": "-1.5deg" } as CSSProperties}>
                  <div className="font-mkpn-display text-2xl leading-none mb-1 text-[var(--mkpn-pink)] mkpn-glow-pink">
                    {COPY.orderCta.split(" ")[0]}&nbsp;{formatEUR(PRICES.base)}
                  </div>
                  <div className="text-xs font-bold text-[var(--mkpn-text-muted)]">{COPY.digital48h}</div>
                </NeonPanel>
              </div>
            </div>
          </div>

          <div className="mt-14 border-y-2 border-[var(--mkpn-line)] bg-[var(--mkpn-bg2)] overflow-hidden relative z-10">
            <div className="flex mkpn-marquee-track whitespace-nowrap py-3 font-mkpn-display text-lg">
              {Array.from({ length: 2 }).map((_, k) => (
                <div key={k} className="flex items-center gap-8 px-5">
                  <span className="text-[var(--mkpn-pink)]">+{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.portraitsDelivered}</span><span className="text-[var(--mkpn-text-soft)]">✦</span>
                  <span className="text-[var(--mkpn-cyan)]">{COPY.delivered48h}</span><span className="text-[var(--mkpn-text-soft)]">✦</span>
                  <span className="text-[var(--mkpn-acid)]">{COPY.handDrawn}</span><span className="text-[var(--mkpn-text-soft)]">✦</span>
                  <span className="text-[var(--mkpn-pink)]">{COPY.satisfiedOrRefunded}</span><span className="text-[var(--mkpn-text-soft)]">✦</span>
                  <span className="text-[var(--mkpn-cyan)]">{COPY.freeRevisions}</span><span className="text-[var(--mkpn-text-soft)]">✦</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <DiagonalDivider />

        {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
        <section className="py-20 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-center mb-12">
              <div className="mkpn-section-label mb-4">{COPY.howItWorks}</div>
              <h2 className="font-mkpn-display text-[clamp(1.9rem,3.4vw,2.8rem)] leading-tight text-[var(--mkpn-text)]">{COPY.howItWorksTitle}</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8 relative">
              {[
                { title: COPY.step1Title, desc: COPY.step1Desc, icon: "📸", tone: "pink" as Tone, rot: -1.4 },
                { title: COPY.step2Title, desc: COPY.step2Desc, icon: "🎨", tone: "cyan" as Tone, rot: 1.2 },
                { title: COPY.step3Title, desc: COPY.step3Desc, icon: "✅", tone: "acid" as Tone, rot: -0.8 },
              ].map((s, i) => (
                <NeonPanel key={i} tone={s.tone} rotate={s.rot} className="p-6 text-center relative">
                  <div
                    className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-3xl mkpn-panel mkpn-panel--${s.tone}`}
                  >
                    {s.icon}
                  </div>
                  <h3 className="font-mkpn-display text-2xl mb-2 text-[var(--mkpn-text)]">{s.title}</h3>
                  <p className="text-sm font-medium text-[var(--mkpn-text-muted)] mb-5">{s.desc}</p>
                  <div className={`font-mkpn-display text-lg mkpn-glow-${s.tone}`} style={{ color: `var(--mkpn-${s.tone})` }}>
                    {i + 1}/3
                  </div>
                </NeonPanel>
              ))}
            </div>
          </div>
        </section>

        <DiagonalDivider flip />

        {/* ═══════════════════ CONFIGURATOR ═══════════════════ */}
        <section ref={configRef} id="configurator" className="py-20 relative overflow-hidden">
          <Splat tone="acid" className="opacity-40" style={{ top: 200, right: -140 }} />
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-center mb-12">
              <div className="mkpn-section-label mb-4">{COPY.configurator}</div>
              <h2 className="font-mkpn-display text-[clamp(2rem,4vw,3.2rem)] leading-tight text-[var(--mkpn-text)]">{COPY.composeYourPortrait}</h2>
              <p className="font-medium text-[var(--mkpn-text-muted)] mt-3">{COPY.guidedSteps}</p>
            </div>

            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10">
              {/* live preview */}
              <div className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
                <NeonPanel tone="cyan" rotate={-0.6} className="overflow-hidden">
                  <div className="relative aspect-[4/5]">
                    <Image
                      src={selectedBackground.src}
                      alt={`Décor ${selectedBackground.label}`}
                      fill
                      className="object-cover transition-all duration-300"
                      sizes="(max-width: 1024px) 92vw, 520px"
                    />
                    <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 70px rgba(10,1,24,0.6)" }} />
                    <div className="absolute top-3 left-3">
                      <Chip tone="cyan">{selectedBackground.label}</Chip>
                    </div>
                  </div>
                  <div className="border-t-2 border-[var(--mkpn-line)] p-4 flex flex-wrap gap-2 bg-[var(--mkpn-bg2)]">
                    <Chip tone="pink">{format === "portrait" ? COPY.portrait : COPY.fullbody}</Chip>
                    <Chip tone="cyan">{people} {people > 1 ? COPY.peoplePlural : COPY.peopleSingular}</Chip>
                    {animals > 0 && <Chip tone="acid">{animals} {animals > 1 ? COPY.animalsPlural : COPY.animalsSingular}</Chip>}
                    <Chip tone="pink">{selectedPrintOption.label}</Chip>
                  </div>
                </NeonPanel>
                <div className="mt-4 text-sm font-semibold text-[var(--mkpn-text-muted)] text-center">
                  ⏱ {COPY.estimatedDelay} : <span className="text-[var(--mkpn-text)]">{COPY.digital48h}</span> · {COPY.print57Days}
                </div>
              </div>

              {/* steps */}
              <div className="space-y-7">
                {/* 01 framing */}
                <NeonPanel rotate={0.25} className="p-5">
                  <h3 className="font-mkpn-display text-xl mb-4 text-[var(--mkpn-text)]">01 — {COPY.framingStep}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(["portrait", "fullbody"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormat(f)}
                        className={`mkpn-tile mkpn-press ${format === f ? "mkpn-tile--selected" : ""}`}
                      >
                        <div className="aspect-[5/3] bg-[var(--mkpn-bg3)] flex items-center justify-center text-5xl">
                          {f === "portrait" ? "👤" : "🧍"}
                        </div>
                        <div className="px-3 py-2.5 border-t-2 border-[var(--mkpn-line)]">
                          <div className="font-mkpn-display text-lg text-[var(--mkpn-text)]">{f === "portrait" ? COPY.portrait : COPY.fullbody}</div>
                          <div className="text-xs font-semibold text-[var(--mkpn-text-soft)]">{f === "portrait" ? COPY.portraitSub : COPY.fullbodySub}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </NeonPanel>

                {/* 02 people/animals */}
                <NeonPanel rotate={-0.25} className="p-5">
                  <h3 className="font-mkpn-display text-xl mb-4 text-[var(--mkpn-text)]">02 — {COPY.whoOnPortrait}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <StepDial
                      icon="🧍"
                      label={COPY.peopleLabel}
                      value={people}
                      min={1}
                      max={8}
                      tone="pink"
                      hint={`+${formatEUR(PRICES.extraPerson)} ${COPY.perExtraPerson}`}
                      onChange={setPeople}
                    />
                    <StepDial
                      icon="🐾"
                      label={COPY.animalsLabel}
                      value={animals}
                      min={0}
                      max={4}
                      tone="cyan"
                      hint={`+${formatEUR(PRICES.extraAnimal)} ${COPY.perAnimal}`}
                      onChange={setAnimals}
                    />
                  </div>
                </NeonPanel>

                {/* 03 background */}
                <NeonPanel rotate={0.25} className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="font-mkpn-display text-xl text-[var(--mkpn-text)]">03 — {COPY.decorStep}</h3>
                    <span className="text-xs font-semibold text-[var(--mkpn-text-soft)]">{COPY.hoverToPreview}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {BACKGROUNDS.map((bg, i) => (
                      <button
                        key={bg.src}
                        type="button"
                        onMouseEnter={() => setHoveredBg(i)}
                        onMouseLeave={() => setHoveredBg(null)}
                        onClick={() => setSelectedBg(i)}
                        className={`mkpn-tile mkpn-press ${selectedBg === i ? "mkpn-tile--selected" : ""}`}
                      >
                        <div className="relative aspect-square">
                          <Image src={bg.src} alt={bg.label} fill className="object-cover" sizes="180px" />
                        </div>
                        <div className="px-2 py-1.5 border-t-2 border-[var(--mkpn-line)] bg-[var(--mkpn-bg2)]">
                          <div className="font-mkpn-display text-[13px] leading-tight truncate text-[var(--mkpn-text)]">{bg.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </NeonPanel>

                {/* 04 upload */}
                <NeonPanel rotate={-0.25} className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="font-mkpn-display text-xl text-[var(--mkpn-text)]">04 — {COPY.uploadStep}</h3>
                    <span className="text-xs font-semibold text-[var(--mkpn-text-soft)]">{COPY.uploadMax8}</span>
                  </div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                    className={`mkpn-dashed px-5 py-8 text-center bg-[var(--mkpn-bg3)]/40 transition ${dragOver ? "mkpn-drop-active" : ""}`}
                  >
                    <div className="text-5xl mb-2" aria-hidden>📸</div>
                    <div className="font-mkpn-display text-xl text-[var(--mkpn-text)]">{COPY.dragHere}</div>
                    <div className="text-sm font-semibold text-[var(--mkpn-text-soft)] mb-4">{COPY.orWord}</div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mkpn-btn mkpn-btn--outline mkpn-press"
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
                    <div className="text-xs font-semibold text-[var(--mkpn-text-soft)] mt-3">{COPY.uploadHint}</div>
                  </div>
                  {photos.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {photos.map((p, i) => (
                        <div key={p.url} className="relative aspect-square border-2 border-[var(--mkpn-line)] rounded overflow-hidden">
                          <Image src={p.url} alt={p.name || "Photo envoyée"} fill className="object-cover" unoptimized sizes="100px" />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            aria-label="Retirer la photo"
                            className="absolute top-1 right-1 w-6 h-6 bg-[var(--mkpn-bg2)] border border-[var(--mkpn-pink)] text-[var(--mkpn-text)] rounded-full font-black text-xs leading-none mkpn-press"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {photos.length < 8 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square border-2 border-dashed border-[var(--mkpn-line)] rounded flex items-center justify-center font-mkpn-display text-3xl text-[var(--mkpn-text-soft)] mkpn-press"
                        >
                          +
                        </button>
                      )}
                    </div>
                  )}
                </NeonPanel>

                {/* 05 note */}
                <NeonPanel rotate={0.25} className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-mkpn-display text-xl text-[var(--mkpn-text)]">05 — {COPY.noteForArtist}</h3>
                    <span className="text-xs font-semibold text-[var(--mkpn-text-soft)]">{COPY.optional}</span>
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 400))}
                    rows={4}
                    className="w-full border-2 border-[var(--mkpn-line)] bg-[var(--mkpn-bg3)] rounded-lg px-4 py-3 text-base text-[var(--mkpn-text)] outline-none resize-none focus:border-[var(--mkpn-cyan)] focus:shadow-[0_0_16px_rgba(0,255,240,0.3)] placeholder:text-[var(--mkpn-text-soft)]"
                    placeholder={COPY.notePlaceholder}
                  />
                  <div className="text-xs font-semibold text-[var(--mkpn-text-soft)] mt-1 text-right">{note.length} / 400</div>
                </NeonPanel>

                {/* 06 print options */}
                <NeonPanel rotate={-0.25} className="p-5">
                  <h3 className="font-mkpn-display text-xl mb-4 text-[var(--mkpn-text)]">06 — {COPY.printSupportStep}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {PRINT_OPTIONS.map((opt, i) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setSelectedPrint(i)}
                        className={`mkpn-tile mkpn-press relative ${selectedPrint === i ? "mkpn-tile--selected" : ""}`}
                      >
                        {opt.badge && (
                          <div className="absolute top-2 left-2 bg-[var(--mkpn-pink)] text-[#1a0016] rounded-full px-2 py-0.5 text-[10px] font-mkpn-display z-10">
                            {opt.badge}
                          </div>
                        )}
                        <div className="aspect-[5/3] bg-[var(--mkpn-bg3)] relative">
                          <Image src={opt.img} alt={opt.label} fill className="object-contain p-3" sizes="260px" />
                        </div>
                        <div className="px-3 py-2.5 border-t-2 border-[var(--mkpn-line)] bg-[var(--mkpn-bg2)] flex items-center justify-between gap-2">
                          <div>
                            <div className="font-mkpn-display text-base leading-tight text-[var(--mkpn-text)]">{opt.label}</div>
                            <div className="text-[11px] font-semibold text-[var(--mkpn-text-soft)]">{opt.sub}</div>
                          </div>
                          <div className="font-mkpn-display text-lg whitespace-nowrap text-[var(--mkpn-cyan)]">{formatEUR(PRICES.base + opt.addon)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </NeonPanel>

                {/* summary */}
                <NeonPanel tone="pink" rotate={0.35} className="p-6 relative overflow-visible">
                  <TiltTag tone="cyan" size="sm" rotate={7} className="hidden sm:block" style={{ top: -20, left: -12 }}>
                    {TAGS[1]}
                  </TiltTag>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-mkpn-display text-2xl mb-3 text-[var(--mkpn-text)]">{COPY.summary}</div>
                      <div className="space-y-1.5 text-sm font-medium text-[var(--mkpn-text-muted)]">
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
                        <div className="flex justify-between gap-4 text-[var(--mkpn-text-soft)]">
                          <span>{COPY.revisionsIncluded}</span>
                          <span>{COPY.included}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--mkpn-text-soft)]">{COPY.total}</span>
                      <span className="font-mkpn-display text-[2.6rem] leading-none text-[var(--mkpn-text)] mkpn-glow-acid" style={{ color: "var(--mkpn-acid)" }}>
                        {formatEUR(total)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="mkpn-btn mkpn-btn--pink mkpn-btn--lg w-full mt-6 mkpn-press"
                  >
                    {COPY.addToCart} · {formatEUR(total)} →
                  </button>
                  <div className="text-xs font-semibold text-[var(--mkpn-text-soft)] text-center mt-3">{COPY.paymentReassurance}</div>

                  {toastVisible && (
                    <div className="absolute left-1/2 -translate-x-1/2 -top-4 -translate-y-full mkpn-toast-in z-20">
                      <div className="mkpn-panel mkpn-panel--acid px-4 py-2.5 whitespace-nowrap">
                        <span className="font-mkpn-display text-base text-[var(--mkpn-acid)]">{COPY.previewOnlyToast}</span>
                      </div>
                    </div>
                  )}
                </NeonPanel>
              </div>
            </div>
          </div>
        </section>

        <DiagonalDivider />

        {/* ═══════════════════ GALLERY ═══════════════════ */}
        <section className="py-20 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-center mb-12">
              <div className="mkpn-section-label mb-4">{COPY.galleryLabel}</div>
              <h2 className="font-mkpn-display text-[clamp(2rem,4vw,3.2rem)] leading-tight text-[var(--mkpn-text)]">{COPY.galleryTitle}</h2>
              <p className="font-medium text-[var(--mkpn-text-muted)] mt-3">{COPY.gallerySub}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-7">
              {GALLERY_PHOTOS.map((src, i) => {
                const tones: Tone[] = ["pink", "cyan", "acid"];
                const tone = tones[i % tones.length];
                const rot = ((i % 5) - 2) * 1.5;
                return (
                  <div
                    key={src}
                    className={`relative rounded-xl overflow-hidden mkpn-panel mkpn-panel--${tone} mkpn-press`}
                    style={{ transform: `rotate(${rot}deg)` }}
                  >
                    <div className="relative aspect-square">
                      <Image
                        src={src}
                        alt="Réalisation cartoon pop-art néon Cartoonova"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    </div>
                    {i % 3 !== 2 && (
                      <TiltTag
                        tone={tones[(i + 1) % tones.length]}
                        size="sm"
                        rotate={i % 2 === 0 ? -9 : 9}
                        style={{ top: i % 2 === 0 ? "6%" : "auto", bottom: i % 2 === 0 ? "auto" : "6%", right: "6%" }}
                      >
                        {TAGS[i % TAGS.length]}
                      </TiltTag>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <DiagonalDivider flip />

        {/* ═══════════════════ REVIEWS ═══════════════════ */}
        <section className="py-20 relative overflow-hidden">
          <Splat tone="pink" className="opacity-30" style={{ top: -60, left: "40%" }} />
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="grid md:grid-cols-[auto_1fr] gap-12 items-center mb-14">
              <div className="text-center md:text-left">
                <div className="mkpn-section-label mb-4">{COPY.reviewsLabel}</div>
                <div className="flex items-end gap-3 justify-center md:justify-start">
                  <div className="font-mkpn-display text-[6rem] leading-[0.85] text-[var(--mkpn-cyan)] mkpn-glow-cyan">{STATS.rating.toString().replace(".", ",")}</div>
                  <div className="text-2xl font-mkpn-display text-[var(--mkpn-text-soft)] mb-2">/5</div>
                </div>
                <div className="flex text-[var(--mkpn-acid)] text-2xl leading-none mt-1 justify-center md:justify-start">{"★".repeat(5)}</div>
                <div className="font-semibold text-[var(--mkpn-text-muted)] mt-2">
                  {COPY.basedOn} <span className="text-[var(--mkpn-text)] font-bold">{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}</span>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 max-w-md mx-auto md:mx-0">
                {STATS.distribution.map((r) => (
                  <div key={r.stars} className="contents">
                    <div className="text-sm font-bold col-span-1 text-[var(--mkpn-text-muted)]">{r.stars} ★</div>
                    <div className="col-span-3 h-3 bg-[var(--mkpn-bg3)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--mkpn-pink)]" style={{ width: `${r.pct}%`, boxShadow: "0 0 10px var(--mkpn-pink)" }} />
                    </div>
                    <div className="text-sm font-bold col-span-1 text-right text-[var(--mkpn-text-muted)]">{r.pct}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {REVIEWS.map((r, i) => {
                const tones: Tone[] = ["pink", "cyan", "acid"];
                const tone = tones[i % tones.length];
                return (
                  <NeonPanel key={r.name} tone={tone} rotate={((i % 3) - 1) * 0.7} className="p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-mkpn-display text-base mkpn-panel mkpn-panel--${tone}`}
                        style={{ color: `var(--mkpn-${tone})` }}
                      >
                        {r.name.charAt(0)}
                      </div>
                      <div className="font-mkpn-display text-base leading-tight text-[var(--mkpn-text)]">{r.name}</div>
                    </div>
                    <div className="flex text-[var(--mkpn-acid)] text-sm leading-none mb-2">{"★".repeat(5)}</div>
                    <p className="text-[14px] font-medium text-[var(--mkpn-text-muted)] leading-snug">&ldquo;{r.text}&rdquo;</p>
                  </NeonPanel>
                );
              })}
            </div>
          </div>
        </section>

        <DiagonalDivider />

        {/* ═══════════════════ FAQ ═══════════════════ */}
        <section className="py-20 relative overflow-hidden">
          <div className="max-w-3xl mx-auto px-6 relative z-10">
            <div className="text-center mb-10">
              <div className="mkpn-section-label mb-4">FAQ</div>
              <h2 className="font-mkpn-display text-[clamp(2rem,4vw,3.2rem)] leading-tight text-[var(--mkpn-text)]">{COPY.frequentQuestions}</h2>
            </div>
            <div className="space-y-4">
              {FAQ_ITEMS.map((f, i) => (
                <NeonPanel key={f.q} rotate={i % 2 === 0 ? -0.2 : 0.2} className={`overflow-hidden ${openFaq === i ? "mkpn-faq-open" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-5 font-mkpn-display text-lg md:text-xl text-[var(--mkpn-text)]"
                    aria-expanded={openFaq === i}
                  >
                    <span>{f.q}</span>
                    <span className="mkpn-faq-chev w-9 h-9 shrink-0 rounded-full bg-[var(--mkpn-bg3)] border-2 border-[var(--mkpn-acid)] flex items-center justify-center text-2xl leading-none">
                      +
                    </span>
                  </button>
                  <div className="mkpn-faq-panel">
                    <div>
                      <div className="px-5 pb-5 text-[var(--mkpn-text-muted)] font-medium leading-relaxed">{f.a}</div>
                    </div>
                  </div>
                </NeonPanel>
              ))}
            </div>
          </div>
        </section>

        <DiagonalDivider flip />

        {/* ═══════════════════ FINAL CTA ═══════════════════ */}
        <section className="relative overflow-hidden">
          <Splat tone="cyan" style={{ top: -80, left: -100 }} />
          <Splat tone="acid" style={{ bottom: -100, right: -80 }} />
          <div className="relative max-w-5xl mx-auto px-6 py-24 text-center z-10">
            <TiltTag tone="pink" size="lg" rotate={-6} className="hidden md:block" style={{ top: -10, left: "6%" }}>
              {TAGS[1]}
            </TiltTag>
            <TiltTag tone="acid" size="md" rotate={9} className="hidden md:block" style={{ bottom: 10, right: "8%" }}>
              {TAGS[3]}
            </TiltTag>
            <div className="inline-block bg-[var(--mkpn-bg2)] border border-[var(--mkpn-line)] text-[var(--mkpn-cyan)] font-mkpn-display rounded-full px-4 py-1.5 text-sm mb-6">
              +{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.satisfiedClients}
            </div>
            <h2 className="font-mkpn-display text-[clamp(2.2rem,5.6vw,4.6rem)] leading-[1] mb-4 text-[var(--mkpn-text)]">{COPY.ctaTitle}</h2>
            <p className="text-lg md:text-xl font-semibold mb-8 text-[var(--mkpn-text-muted)]">{COPY.ctaSubtitle}</p>
            <div className="flex flex-wrap justify-center gap-3 mb-9 text-sm">
              <Chip tone="pink">✏️ {COPY.pillDrawnHand}</Chip>
              <Chip tone="cyan">⚡ {COPY.pillDelivered48h}</Chip>
              <Chip tone="acid">🔒 {COPY.pillSatisfied}</Chip>
              <Chip tone="pink">🇫🇷 {COPY.madeInFrance}</Chip>
            </div>
            <button type="button" onClick={scrollToConfig} className="mkpn-btn mkpn-btn--lg mkpn-press">
              {COPY.orderCta} →
            </button>
            <div className="text-sm font-semibold text-[var(--mkpn-text-soft)] mt-4">{COPY.paymentReassurance}</div>
          </div>
        </section>
      </div>

      <PopartVariantSwitcher />
    </>
  );
}
