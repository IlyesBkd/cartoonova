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

/* ───────────────────────── small vintage-newspaper building blocks ───────────────────────── */

function Grain() {
  return <div aria-hidden className="mkpv-grain" />;
}

function Halftone({ tone = "ink", className = "" }: { tone?: "red" | "teal" | "ink"; className?: string }) {
  return <div aria-hidden className={`mkpv-halftone mkpv-halftone--${tone} ${className}`} />;
}

function Fringe({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`mkpv-fringe ${className}`}>
      <span className="mkpv-fringe-layer mkpv-fringe-cyan" aria-hidden="true">{children}</span>
      <span className="mkpv-fringe-layer mkpv-fringe-red" aria-hidden="true">{children}</span>
      <span className="mkpv-fringe-main">{children}</span>
    </span>
  );
}

function Panel({
  children,
  rotate = 0,
  fringe = false,
  className = "",
}: {
  children: ReactNode;
  rotate?: number;
  fringe?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`mkpv-panel ${fringe ? "mkpv-panel--fringe" : ""} ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </div>
  );
}

function Seal({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mkpv-seal">
      <div className="mkpv-seal-ring" />
      <div className="mkpv-seal-ring--inner" />
      <div className="mkpv-seal-content">
        <span className="mkpv-seal-label">{label}</span>
        {sub && <span className="mkpv-seal-sub">{sub}</span>}
      </div>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="mkpv-chip">{children}</span>;
}

function Kicker({ children }: { children: ReactNode }) {
  return <div className="mkpv-kicker">{children}</div>;
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
    <div className="mkpv-panel mkpv-panel--flat p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl leading-none" aria-hidden>{icon}</span>
        <span className="font-mkpv-mono text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="mkpv-dial-btn mkpv-press"
          aria-label={`Réduire ${label}`}
        >
          −
        </button>
        <div className="font-mkpv-display text-3xl tabular-nums">{value}</div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="mkpv-dial-btn mkpv-press"
          aria-label={`Augmenter ${label}`}
        >
          +
        </button>
      </div>
      {hint && <div className="text-[10px] font-mkpv-mono text-black/55 mt-2 text-center">{hint}</div>}
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
    const id = setInterval(() => setHeroIndex((i) => (i + 1) % HERO_SLIDES.length), 3800);
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

  const steps = [
    { title: COPY.step1Title, desc: COPY.step1Desc, icon: "✉️" },
    { title: COPY.step2Title, desc: COPY.step2Desc, icon: "🖋️" },
    { title: COPY.step3Title, desc: COPY.step3Desc, icon: "☑️" },
  ];

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fredericka+the+Great&family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Special+Elite&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .mk-popart-vintage {
          --mkpv-cream: #F3E9D2;
          --mkpv-cream-deep: #E7D6AC;
          --mkpv-ink: #2A2118;
          --mkpv-ink-soft: rgba(42,33,24,0.62);
          --mkpv-ink-faint: rgba(42,33,24,0.35);
          --mkpv-red: #BE4A3C;
          --mkpv-red-deep: #8E362B;
          --mkpv-teal: #3F7C8A;
          --mkpv-teal-deep: #2C5A66;
          --mkpv-ochre: #C99A3E;
          --mkpv-ochre-soft: #EAD9A6;
          --mkpv-white: #FBF5E6;
          --mkpv-cyan-fringe: #57AFCB;
          --mkpv-red-fringe: #C85A46;
          background-color: var(--mkpv-cream);
          background-image:
            radial-gradient(ellipse 60% 40% at 12% 8%, rgba(190,74,60,0.05), transparent 60%),
            radial-gradient(ellipse 50% 35% at 88% 92%, rgba(63,124,138,0.06), transparent 60%),
            radial-gradient(circle at 24% 64%, rgba(42,33,24,0.05) 0px, transparent 3px),
            radial-gradient(circle at 76% 18%, rgba(42,33,24,0.04) 0px, transparent 3px),
            radial-gradient(circle at 52% 88%, rgba(42,33,24,0.04) 0px, transparent 3px);
          color: var(--mkpv-ink);
          font-family: 'PT Serif', Georgia, serif;
          -webkit-font-smoothing: antialiased;
          position: relative;
        }
        .mk-popart-vintage *, .mk-popart-vintage *::before, .mk-popart-vintage *::after { box-sizing: border-box; }
        .mk-popart-vintage .font-mkpv-display { font-family: 'Fredericka the Great', cursive; font-weight: 400; letter-spacing: 0.015em; line-height: 1.05; }
        .mk-popart-vintage .font-mkpv-mono { font-family: 'Special Elite', 'Courier New', monospace; }

        .mkpv-grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.05; mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
        }

        .mkpv-halftone { position: absolute; inset: 0; pointer-events: none; }
        .mkpv-halftone--red { background-image: radial-gradient(circle, rgba(190,74,60,0.18) 1.3px, transparent 1.4px); background-size: 10px 10px; opacity: 0.5; }
        .mkpv-halftone--teal { background-image: radial-gradient(circle, rgba(63,124,138,0.2) 1.3px, transparent 1.4px); background-size: 10px 10px; opacity: 0.45; }
        .mkpv-halftone--ink { background-image: radial-gradient(circle, rgba(42,33,24,0.16) 1.2px, transparent 1.3px); background-size: 9px 9px; opacity: 0.4; }

        .mkpv-panel { position: relative; background: var(--mkpv-white); border: 1.5px solid var(--mkpv-ink); border-radius: 4px; box-shadow: 3px 3px 0 rgba(42,33,24,0.2); }
        .mkpv-panel--flat { box-shadow: 2px 2px 0 rgba(42,33,24,0.16); }
        .mkpv-panel--fringe { box-shadow: 3px 3px 0 rgba(42,33,24,0.2), 2px 1.5px 0 rgba(200,90,70,0.28), -1.5px -1px 0 rgba(87,175,203,0.24); }

        .mkpv-press { transition: transform 130ms cubic-bezier(.34,1.56,.64,1), box-shadow 130ms ease; }
        .mkpv-press:active { transform: scale(0.96) !important; }
        button.mkpv-press, .mkpv-tile.mkpv-press { cursor: pointer; }

        .mkpv-btn {
          position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          font-family: 'Fredericka the Great', cursive; letter-spacing: 0.02em; font-size: 1.2rem;
          color: var(--mkpv-white); background: var(--mkpv-red);
          border: 1.5px solid var(--mkpv-ink); border-radius: 4px;
          padding: 0.85rem 1.9rem; box-shadow: 3px 3px 0 var(--mkpv-ink);
          transition: transform 130ms cubic-bezier(.34,1.56,.64,1), box-shadow 130ms ease;
          cursor: pointer; user-select: none;
        }
        .mkpv-btn:hover { transform: translate(-2px,-2px); box-shadow: 5px 5px 0 var(--mkpv-ink); }
        .mkpv-btn:active { transform: translate(2px,2px) scale(0.97); box-shadow: 1px 1px 0 var(--mkpv-ink); }
        .mkpv-btn.mkpv-btn--lg { padding: 1rem 2.4rem; font-size: 1.5rem; }
        .mkpv-btn.mkpv-btn--dark { background: var(--mkpv-ink); color: var(--mkpv-cream); }
        .mkpv-btn.mkpv-btn--ochre { background: var(--mkpv-ochre); color: var(--mkpv-ink); }
        .mkpv-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

        .mkpv-chip { display: inline-flex; align-items: center; gap: 0.3rem; background: var(--mkpv-white); border: 1px solid var(--mkpv-ink); border-radius: 999px; padding: 0.3rem 0.7rem; font-family: 'Special Elite', monospace; font-size: 0.66rem; letter-spacing: 0.03em; text-transform: uppercase; box-shadow: 1.5px 1.5px 0 rgba(42,33,24,0.16); }

        .mkpv-kicker { display: inline-flex; align-items: center; gap: 0.6rem; font-family: 'Special Elite', monospace; letter-spacing: 0.16em; text-transform: uppercase; font-size: 0.72rem; color: var(--mkpv-red-deep); }
        .mkpv-kicker::before, .mkpv-kicker::after { content: ''; width: 26px; height: 1.5px; background: var(--mkpv-ink); opacity: 0.4; }

        .mkpv-dial-btn { width: 40px; height: 40px; border-radius: 50%; background: var(--mkpv-white); border: 1.5px solid var(--mkpv-ink); font-family: 'Fredericka the Great', cursive; font-size: 1.3rem; line-height: 1; box-shadow: 2px 2px 0 var(--mkpv-ink); transition: transform 120ms ease; }
        .mkpv-dial-btn:active { transform: translate(1.5px,1.5px); box-shadow: 0.5px 0.5px 0 var(--mkpv-ink); }
        .mkpv-dial-btn:disabled { opacity: 0.35; }

        .mkpv-tile { position: relative; overflow: hidden; text-align: left; background: var(--mkpv-white); border: 1.5px solid var(--mkpv-ink); border-radius: 4px; box-shadow: 2px 2px 0 rgba(42,33,24,0.2); transition: transform 130ms ease, box-shadow 130ms ease; }
        .mkpv-tile:hover { transform: translate(-2px,-2px); box-shadow: 4px 4px 0 rgba(42,33,24,0.2); }
        .mkpv-tile--selected { outline: 2px solid var(--mkpv-ochre); outline-offset: 2px; }
        .mkpv-tile--selected::after { content: '✓'; position: absolute; top: -9px; right: -9px; width: 24px; height: 24px; background: var(--mkpv-red); color: var(--mkpv-white); border: 1.5px solid var(--mkpv-ink); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; z-index: 5; }

        .mkpv-dashed { border: 2px dashed var(--mkpv-ink); border-radius: 6px; }
        .mkpv-dashed.mkpv-drop-active { background: rgba(201,154,62,0.14); border-color: var(--mkpv-red); }

        .mkpv-fringe { position: relative; display: inline-block; }
        .mkpv-fringe-layer { position: absolute; inset: 0; z-index: 0; user-select: none; pointer-events: none; }
        .mkpv-fringe-cyan { color: var(--mkpv-cyan-fringe); transform: translate(-1.6px, -1.1px); opacity: 0.55; }
        .mkpv-fringe-red { color: var(--mkpv-red-fringe); transform: translate(1.6px, 1.1px); opacity: 0.6; }
        .mkpv-fringe-main { position: relative; z-index: 1; }

        .mkpv-strip { display: grid; grid-template-columns: 1fr; border: 1.5px solid var(--mkpv-ink); border-radius: 4px; overflow: hidden; background: var(--mkpv-white); box-shadow: 3px 3px 0 rgba(42,33,24,0.2); }
        @media (min-width: 768px) { .mkpv-strip { grid-template-columns: repeat(3, 1fr); } }
        .mkpv-strip-panel { position: relative; padding: 1.9rem 1.4rem 2.6rem; border-bottom: 1.5px dashed var(--mkpv-ink); }
        @media (min-width: 768px) { .mkpv-strip-panel { border-bottom: none; border-right: 1.5px dashed var(--mkpv-ink); } .mkpv-strip-panel:last-child { border-right: none; } }
        .mkpv-strip-panel:last-child { border-bottom: none; }
        .mkpv-strip-caption { position: absolute; bottom: 0.75rem; right: 1rem; font-family: 'Special Elite', monospace; font-size: 0.64rem; letter-spacing: 0.06em; color: var(--mkpv-ink-soft); }

        .mkpv-seal { position: relative; width: 122px; height: 122px; display: flex; align-items: center; justify-content: center; transform: rotate(-6deg); flex-shrink: 0; }
        .mkpv-seal-ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--mkpv-red-deep); }
        .mkpv-seal-ring--inner { position: absolute; inset: 9px; border-radius: 50%; border: 1px dashed var(--mkpv-red-deep); }
        .mkpv-seal-content { position: relative; text-align: center; }
        .mkpv-seal-label { font-family: 'Fredericka the Great', cursive; font-size: 1.3rem; line-height: 1; color: var(--mkpv-ink); display: block; }
        .mkpv-seal-sub { font-family: 'Special Elite', monospace; font-size: 0.52rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mkpv-red-deep); margin-top: 3px; display: block; }

        .mkpv-clip { position: relative; background: var(--mkpv-white); border: 1.5px solid var(--mkpv-ink); border-radius: 3px; overflow: hidden; box-shadow: 3px 3px 0 rgba(42,33,24,0.2); }
        .mkpv-tape { position: absolute; top: -8px; left: 50%; width: 54px; height: 20px; background: rgba(201,154,62,0.4); border: 1px solid rgba(42,33,24,0.25); transform: translateX(-50%) rotate(-3deg); z-index: 5; }

        .mkpv-letter { position: relative; background: var(--mkpv-white); border: 1.5px solid var(--mkpv-ink); border-radius: 3px; padding: 1.4rem; box-shadow: 3px 3px 0 rgba(42,33,24,0.2); }
        .mkpv-letter::before { content: ''; position: absolute; top: 0; right: 0; width: 0; height: 0; border-style: solid; border-width: 0 20px 20px 0; border-color: transparent var(--mkpv-cream-deep) transparent transparent; }
        .mkpv-letter-quote { font-family: 'Fredericka the Great', cursive; font-size: 2.5rem; line-height: 0.6; color: var(--mkpv-ochre); display: block; margin-bottom: 0.35rem; }

        @keyframes mkpv-pop { 0% { transform: scale(0.94) rotate(-1deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        .mkpv-pop-in { animation: mkpv-pop 520ms cubic-bezier(.22,1.15,.4,1) both; }
        @keyframes mkpv-toast-in { 0% { transform: translateY(14px) scale(0.92); opacity: 0; } 60% { transform: translateY(-2px) scale(1.02); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        .mkpv-toast-in { animation: mkpv-toast-in 380ms cubic-bezier(.2,.9,.3,1.2) both; }
        @keyframes mkpv-ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .mkpv-ticker-track { animation: mkpv-ticker 30s linear infinite; }
        .mkpv-faq-chev { transition: transform 220ms ease; }
        .mkpv-faq-open .mkpv-faq-chev { transform: rotate(45deg); }
        .mkpv-faq-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 300ms ease; }
        .mkpv-faq-open .mkpv-faq-panel { grid-template-rows: 1fr; }
        .mkpv-faq-panel > div { overflow: hidden; }
      `}</style>

      <div className="mk-popart-vintage min-h-screen overflow-x-hidden">
        <Grain />

        {/* ═══════════════════ HERO / MASTHEAD ═══════════════════ */}
        <section className="relative pt-10 pb-14 overflow-hidden border-b-[1.5px] border-[var(--mkpv-ink)]">
          <Halftone tone="red" className="opacity-40" />
          <div className="max-w-7xl mx-auto px-6 relative">
            <div className="flex items-center justify-between gap-3 border-t-[3px] border-b-[1.5px] border-double border-[var(--mkpv-ink)] py-2 mb-8 font-mkpv-mono text-[11px] uppercase tracking-wider text-[var(--mkpv-ink-soft)]">
              <span>Cartoonova Gazette</span>
              <span className="hidden sm:inline">Édition Pop-Art · Vintage</span>
              <span>No. 001</span>
            </div>

            <Kicker>
              <span>{COPY.universe}</span>
              <span className="text-[var(--mkpv-red-deep)]">{COPY.simpsonStyle}</span>
            </Kicker>

            <div className="grid lg:grid-cols-[1.05fr_1fr] gap-8 items-stretch mt-5">
              <Panel rotate={-0.4} fringe className="p-7 md:p-9 flex flex-col justify-center">
                <h1 className="font-mkpv-display text-[clamp(2.3rem,5.2vw,4.2rem)] leading-[0.98] mb-4">
                  {COPY.heroTitle1}{" "}
                  <Fringe className="text-[var(--mkpv-red-deep)]">{COPY.heroTitle2}</Fringe>
                </h1>
                <p className="text-base md:text-lg italic text-black/70 mb-6 max-w-xl leading-relaxed">
                  {COPY.heroSubtitle}
                </p>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <Chip>{COPY.delivered48h}</Chip>
                  <Chip>{COPY.satisfiedOrRefunded}</Chip>
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <button type="button" onClick={scrollToConfig} className="mkpv-btn mkpv-btn--lg mkpv-press">
                    {COPY.orderCta} →
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="flex text-[var(--mkpv-red-deep)] text-lg leading-none">{"★".repeat(5)}</div>
                    <div className="text-sm font-semibold font-mkpv-mono">
                      {STATS.rating}/5 · {STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}
                    </div>
                  </div>
                </div>
              </Panel>

              <div className="grid grid-rows-[1.4fr_1fr] gap-5">
                <Panel rotate={0.6} className="overflow-hidden relative">
                  <div className="relative aspect-[5/4] md:aspect-[16/11]">
                    {HERO_SLIDES.map((src, i) => (
                      <div
                        key={src}
                        className={`absolute inset-0 transition-opacity duration-700 ${i === heroIndex ? "opacity-100 mkpv-pop-in" : "opacity-0 pointer-events-none"}`}
                      >
                        <Image
                          src={src}
                          alt="Portrait cartoon jaune façon Simpson, réalisé sur mesure, style journal vintage"
                          fill
                          className="object-cover"
                          style={{ filter: "sepia(0.14) contrast(1.05) saturate(0.92)" }}
                          priority={i === 0}
                          sizes="(max-width: 1024px) 92vw, 46vw"
                        />
                      </div>
                    ))}
                    <div className="absolute inset-0 mkpv-halftone mkpv-halftone--ink opacity-25 pointer-events-none" />
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                      {HERO_SLIDES.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setHeroIndex(i)}
                          aria-label={`Photo ${i + 1}`}
                          className="h-2 rounded-full border border-[var(--mkpv-ink)] transition-all"
                          style={{ background: i === heroIndex ? "var(--mkpv-ochre)" : "var(--mkpv-white)", width: i === heroIndex ? 18 : 8 }}
                        />
                      ))}
                    </div>
                  </div>
                </Panel>

                <Panel rotate={-0.8} className="self-end p-4 flex items-center gap-3">
                  <Seal label={formatEUR(PRICES.base)} sub="À partir de" />
                  <div className="text-xs font-mkpv-mono text-black/65 leading-snug">
                    {COPY.digital48h}
                  </div>
                </Panel>
              </div>
            </div>
          </div>

          <div className="mt-12 border-y-[1.5px] border-[var(--mkpv-ink)] bg-[var(--mkpv-ink)] text-[var(--mkpv-cream)] overflow-hidden">
            <div className="flex mkpv-ticker-track whitespace-nowrap py-2.5 font-mkpv-mono text-[13px] tracking-wide">
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

        {/* ═══════════════════ HOW IT WORKS — SUNDAY STRIP ═══════════════════ */}
        <section className="py-16 relative border-b-[1.5px] border-[var(--mkpv-ink)]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-10">
              <Kicker>{COPY.howItWorks}</Kicker>
              <h2 className="font-mkpv-display text-[clamp(1.8rem,3.2vw,2.6rem)] leading-tight mt-3">{COPY.howItWorksTitle}</h2>
            </div>
            <div className="mkpv-strip">
              {steps.map((s, i) => (
                <div key={s.title} className="mkpv-strip-panel">
                  <div
                    className="w-14 h-14 mb-4 rounded-full border-[1.5px] border-[var(--mkpv-ink)] flex items-center justify-center text-2xl"
                    style={{ background: [ "var(--mkpv-cream-deep)", "var(--mkpv-ochre-soft)", "#E4CFC5" ][i % 3], boxShadow: "2px 2px 0 rgba(42,33,24,0.2)" }}
                  >
                    {s.icon}
                  </div>
                  <h3 className="font-mkpv-display text-xl mb-1.5">{s.title}</h3>
                  <p className="text-sm text-black/70 leading-snug">{s.desc}</p>
                  <span className="mkpv-strip-caption">PANEL 0{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ CONFIGURATOR ═══════════════════ */}
        <section ref={configRef} id="configurator" className="py-20 border-b-[1.5px] border-[var(--mkpv-ink)] relative">
          <Halftone tone="teal" className="opacity-30" />
          <div className="max-w-7xl mx-auto px-6 relative">
            <div className="text-center mb-12">
              <Kicker>{COPY.configurator}</Kicker>
              <h2 className="font-mkpv-display text-[clamp(1.9rem,3.6vw,3rem)] leading-tight mt-3">{COPY.composeYourPortrait}</h2>
              <p className="italic text-black/65 mt-3">{COPY.guidedSteps}</p>
            </div>

            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10">
              <div className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
                <Panel rotate={-0.4} className="overflow-hidden">
                  <div className="relative aspect-[4/5]">
                    <Image
                      src={selectedBackground.src}
                      alt={`Décor ${selectedBackground.label}`}
                      fill
                      className="object-cover transition-all duration-300"
                      style={{ filter: "sepia(0.12) contrast(1.04) saturate(0.9)" }}
                      sizes="(max-width: 1024px) 92vw, 520px"
                    />
                    <div className="absolute inset-0 mkpv-halftone mkpv-halftone--ink opacity-15" />
                    <div className="absolute top-3 left-3">
                      <Chip>{selectedBackground.label}</Chip>
                    </div>
                  </div>
                  <div className="border-t-[1.5px] border-[var(--mkpv-ink)] p-4 flex flex-wrap gap-2 bg-[var(--mkpv-cream-deep)]">
                    <Chip>{format === "portrait" ? COPY.portrait : COPY.fullbody}</Chip>
                    <Chip>{people} {people > 1 ? COPY.peoplePlural : COPY.peopleSingular}</Chip>
                    {animals > 0 && <Chip>{animals} {animals > 1 ? COPY.animalsPlural : COPY.animalsSingular}</Chip>}
                    <Chip>{selectedPrintOption.label}</Chip>
                  </div>
                </Panel>
                <div className="mt-4 text-sm font-mkpv-mono text-black/65 text-center">
                  {COPY.estimatedDelay} : <span className="text-black">{COPY.digital48h}</span> · {COPY.print57Days}
                </div>
              </div>

              <div className="space-y-7">
                {/* 01 framing */}
                <Panel rotate={0.25} className="p-5">
                  <h3 className="font-mkpv-display text-xl mb-4">01 — {COPY.framingStep}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(["portrait", "fullbody"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormat(f)}
                        className={`mkpv-tile mkpv-press ${format === f ? "mkpv-tile--selected" : ""}`}
                      >
                        <div className="aspect-[5/3] bg-[var(--mkpv-cream-deep)] flex items-center justify-center text-4xl">
                          {f === "portrait" ? "👤" : "🧍"}
                        </div>
                        <div className="px-3 py-2.5 border-t-[1.5px] border-[var(--mkpv-ink)]">
                          <div className="font-mkpv-display text-lg">{f === "portrait" ? COPY.portrait : COPY.fullbody}</div>
                          <div className="text-xs font-mkpv-mono text-black/60">{f === "portrait" ? COPY.portraitSub : COPY.fullbodySub}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>

                {/* 02 people/animals */}
                <Panel rotate={-0.25} className="p-5">
                  <h3 className="font-mkpv-display text-xl mb-4">02 — {COPY.whoOnPortrait}</h3>
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
                <Panel rotate={0.25} className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="font-mkpv-display text-xl">03 — {COPY.decorStep}</h3>
                    <span className="text-xs font-mkpv-mono text-black/55">{COPY.hoverToPreview}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {BACKGROUNDS.map((bg, i) => (
                      <button
                        key={bg.src}
                        type="button"
                        onMouseEnter={() => setHoveredBg(i)}
                        onMouseLeave={() => setHoveredBg(null)}
                        onClick={() => setSelectedBg(i)}
                        className={`mkpv-tile mkpv-press ${selectedBg === i ? "mkpv-tile--selected" : ""}`}
                      >
                        <div className="relative aspect-square">
                          <Image
                            src={bg.src}
                            alt={bg.label}
                            fill
                            className="object-cover"
                            style={{ filter: "sepia(0.12) saturate(0.9)" }}
                            sizes="180px"
                          />
                        </div>
                        <div className="px-2 py-1.5 border-t-[1.5px] border-[var(--mkpv-ink)] bg-[var(--mkpv-white)]">
                          <div className="font-mkpv-display text-[13px] leading-tight truncate">{bg.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>

                {/* 04 upload */}
                <Panel rotate={-0.25} className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="font-mkpv-display text-xl">04 — {COPY.uploadStep}</h3>
                    <span className="text-xs font-mkpv-mono text-black/55">{COPY.uploadMax8}</span>
                  </div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                    className={`mkpv-dashed px-5 py-8 text-center bg-[var(--mkpv-cream-deep)]/30 transition ${dragOver ? "mkpv-drop-active" : ""}`}
                  >
                    <div className="text-4xl mb-2" aria-hidden>📮</div>
                    <div className="font-mkpv-display text-xl">{COPY.dragHere}</div>
                    <div className="text-sm font-mkpv-mono text-black/55 mb-4">{COPY.orWord}</div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mkpv-btn mkpv-press"
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
                    <div className="text-xs font-mkpv-mono text-black/55 mt-3">{COPY.uploadHint}</div>
                  </div>
                  {photos.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {photos.map((p, i) => (
                        <div key={p.url} className="relative aspect-square border-[1.5px] border-[var(--mkpv-ink)] rounded overflow-hidden">
                          <Image src={p.url} alt={p.name || "Photo envoyée"} fill className="object-cover" unoptimized sizes="100px" />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            aria-label="Retirer la photo"
                            className="absolute top-1 right-1 w-6 h-6 bg-[var(--mkpv-white)] border border-[var(--mkpv-ink)] rounded-full font-bold text-xs leading-none mkpv-press"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {photos.length < 8 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square border-[1.5px] border-[var(--mkpv-ink)] rounded flex items-center justify-center font-mkpv-display text-2xl text-black/50 mkpv-press"
                        >
                          +
                        </button>
                      )}
                    </div>
                  )}
                </Panel>

                {/* 05 note */}
                <Panel rotate={0.25} className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-mkpv-display text-xl">05 — {COPY.noteForArtist}</h3>
                    <span className="text-xs font-mkpv-mono text-black/55">{COPY.optional}</span>
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 400))}
                    rows={4}
                    className="w-full border-[1.5px] border-[var(--mkpv-ink)] rounded px-4 py-3 text-base font-['PT_Serif'] outline-none resize-none focus:ring-2 focus:ring-[var(--mkpv-ochre)] bg-[var(--mkpv-white)]"
                    placeholder={COPY.notePlaceholder}
                  />
                  <div className="text-xs font-mkpv-mono text-black/50 mt-1 text-right">{note.length} / 400</div>
                </Panel>

                {/* 06 print options */}
                <Panel rotate={-0.25} className="p-5">
                  <h3 className="font-mkpv-display text-xl mb-4">06 — {COPY.printSupportStep}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {PRINT_OPTIONS.map((opt, i) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setSelectedPrint(i)}
                        className={`mkpv-tile mkpv-press relative ${selectedPrint === i ? "mkpv-tile--selected" : ""}`}
                      >
                        {opt.badge && (
                          <div className="absolute top-2 left-2 bg-[var(--mkpv-red)] text-[var(--mkpv-white)] border border-[var(--mkpv-ink)] rounded-full px-2 py-0.5 text-[9px] font-mkpv-mono uppercase z-10">
                            {opt.badge}
                          </div>
                        )}
                        <div className="aspect-[5/3] bg-[var(--mkpv-cream-deep)] relative">
                          <Image src={opt.img} alt={opt.label} fill className="object-contain p-3" sizes="260px" />
                        </div>
                        <div className="px-3 py-2.5 border-t-[1.5px] border-[var(--mkpv-ink)] bg-[var(--mkpv-white)] flex items-center justify-between gap-2">
                          <div>
                            <div className="font-mkpv-display text-base leading-tight">{opt.label}</div>
                            <div className="text-[10px] font-mkpv-mono text-black/55">{opt.sub}</div>
                          </div>
                          <div className="font-mkpv-display text-lg whitespace-nowrap">{formatEUR(PRICES.base + opt.addon)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>

                {/* summary */}
                <Panel rotate={0.35} fringe className="p-6 relative overflow-visible">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-mkpv-display text-2xl mb-3">{COPY.summary}</div>
                      <div className="space-y-1.5 text-sm">
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
                        <div className="flex justify-between gap-4 text-black/55">
                          <span>{COPY.revisionsIncluded}</span>
                          <span>{COPY.included}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-mkpv-mono uppercase tracking-wide text-black/55">{COPY.total}</span>
                      <Seal label={formatEUR(total)} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="mkpv-btn mkpv-btn--lg w-full mt-6 mkpv-press"
                  >
                    {COPY.addToCart} · {formatEUR(total)} →
                  </button>
                  <div className="text-xs font-mkpv-mono text-black/55 text-center mt-3">{COPY.paymentReassurance}</div>

                  {toastVisible && (
                    <div className="absolute left-1/2 -translate-x-1/2 -top-4 -translate-y-full mkpv-toast-in z-20">
                      <div className="mkpv-panel px-4 py-2.5 whitespace-nowrap bg-[var(--mkpv-ochre-soft)]">
                        <span className="font-mkpv-mono text-xs uppercase tracking-wide">{COPY.previewOnlyToast}</span>
                      </div>
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ GALLERY ═══════════════════ */}
        <section className="py-20 border-b-[1.5px] border-[var(--mkpv-ink)] relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <Kicker>{COPY.galleryLabel}</Kicker>
              <h2 className="font-mkpv-display text-[clamp(1.9rem,3.6vw,3rem)] leading-tight mt-3">{COPY.galleryTitle}</h2>
              <p className="italic text-black/65 mt-3">{COPY.gallerySub}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-7">
              {GALLERY_PHOTOS.map((src, i) => (
                <div
                  key={src}
                  className="mkpv-clip mkpv-press"
                  style={{ transform: `rotate(${((i % 4) - 1.5) * 0.6}deg)` }}
                >
                  {i % 3 === 0 && <div className="mkpv-tape" />}
                  <div className="relative aspect-square">
                    <Image
                      src={src}
                      alt="Réalisation cartoon jaune Cartoonova, style pop-art journal vintage"
                      fill
                      className="object-cover"
                      style={{ filter: "sepia(0.15) contrast(1.03) saturate(0.88)" }}
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  </div>
                  <div className="px-2.5 py-1.5 border-t-[1.5px] border-[var(--mkpv-ink)] font-mkpv-mono text-[10px] uppercase tracking-wide text-black/55">
                    Fig. {String(i + 1).padStart(2, "0")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ REVIEWS — LETTERS TO THE EDITOR ═══════════════════ */}
        <section className="py-20 border-b-[1.5px] border-[var(--mkpv-ink)] relative">
          <Halftone tone="red" className="opacity-20" />
          <div className="max-w-7xl mx-auto px-6 relative">
            <div className="grid md:grid-cols-[auto_1fr] gap-12 items-center mb-14">
              <div className="text-center md:text-left">
                <Kicker>{COPY.reviewsLabel}</Kicker>
                <div className="flex items-end gap-3 justify-center md:justify-start mt-3">
                  <div className="font-mkpv-display text-[5.2rem] leading-[0.85]">{STATS.rating.toString().replace(".", ",")}</div>
                  <div className="text-xl font-mkpv-mono text-black/45 mb-2">/5</div>
                </div>
                <div className="flex text-[var(--mkpv-red-deep)] text-2xl leading-none mt-1 justify-center md:justify-start">{"★".repeat(5)}</div>
                <div className="font-mkpv-mono text-sm mt-2">
                  {COPY.basedOn} <span className="bg-[var(--mkpv-ochre-soft)] px-1.5 rounded border border-[var(--mkpv-ink)]">{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}</span>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 max-w-md mx-auto md:mx-0">
                {STATS.distribution.map((r) => (
                  <div key={r.stars} className="contents">
                    <div className="text-sm font-mkpv-mono col-span-1">{r.stars} ★</div>
                    <div className="col-span-3 h-2.5 bg-[var(--mkpv-cream-deep)] border border-[var(--mkpv-ink)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--mkpv-red-deep)]" style={{ width: `${r.pct}%` }} />
                    </div>
                    <div className="text-sm font-mkpv-mono col-span-1 text-right">{r.pct}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {REVIEWS.map((r, i) => (
                <div key={r.name} className="mkpv-letter" style={{ transform: `rotate(${i % 2 === 0 ? -0.4 : 0.4}deg)` }}>
                  <span className="mkpv-letter-quote">&ldquo;</span>
                  <p className="text-[14px] text-black/75 leading-snug mb-4">{r.text}</p>
                  <div className="flex items-center justify-between gap-3 pt-3 border-t-[1.5px] border-dashed border-[var(--mkpv-ink-faint)]">
                    <div className="font-mkpv-mono text-xs uppercase tracking-wide">— {r.name}</div>
                    <div className="flex text-[var(--mkpv-red-deep)] text-xs leading-none">{"★".repeat(5)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ FAQ ═══════════════════ */}
        <section className="py-20 border-b-[1.5px] border-[var(--mkpv-ink)]">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-10">
              <Kicker>FAQ</Kicker>
              <h2 className="font-mkpv-display text-[clamp(1.9rem,3.6vw,3rem)] leading-tight mt-3">{COPY.frequentQuestions}</h2>
            </div>
            <div className="mkpv-panel divide-y-[1.5px] divide-[var(--mkpv-ink)] overflow-hidden">
              {FAQ_ITEMS.map((f, i) => (
                <div key={f.q} className={openFaq === i ? "mkpv-faq-open" : ""}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-5 font-mkpv-display text-lg md:text-xl"
                    aria-expanded={openFaq === i}
                  >
                    <span>{f.q}</span>
                    <span
                      className="mkpv-faq-chev w-8 h-8 shrink-0 rounded-full bg-[var(--mkpv-ochre-soft)] border-[1.5px] border-[var(--mkpv-ink)] flex items-center justify-center text-xl leading-none font-mkpv-mono"
                      style={{ boxShadow: "1.5px 1.5px 0 rgba(42,33,24,0.2)" }}
                    >
                      +
                    </span>
                  </button>
                  <div className="mkpv-faq-panel">
                    <div>
                      <div className="px-5 pb-5 text-black/70 leading-relaxed">{f.a}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ FINAL CTA ═══════════════════ */}
        <section className="relative overflow-hidden">
          <Halftone tone="teal" className="opacity-30" />
          <div className="relative max-w-5xl mx-auto px-6 py-20 text-center">
            <div className="inline-block border-t-[3px] border-b-[1.5px] border-double border-[var(--mkpv-ink)] font-mkpv-mono text-xs uppercase tracking-widest px-4 py-1.5 mb-6">
              +{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.satisfiedClients}
            </div>
            <h2 className="font-mkpv-display text-[clamp(2rem,5vw,3.8rem)] leading-[1] mb-4">
              <Fringe>{COPY.ctaTitle}</Fringe>
            </h2>
            <p className="text-lg md:text-xl italic mb-8 text-black/70">{COPY.ctaSubtitle}</p>
            <div className="flex flex-wrap justify-center gap-3 mb-9">
              <Chip>{COPY.pillDrawnHand}</Chip>
              <Chip>{COPY.pillDelivered48h}</Chip>
              <Chip>{COPY.pillSatisfied}</Chip>
              <Chip>{COPY.madeInFrance}</Chip>
            </div>
            <button type="button" onClick={scrollToConfig} className="mkpv-btn mkpv-btn--dark mkpv-btn--lg mkpv-press">
              {COPY.orderCta} →
            </button>
            <div className="text-sm font-mkpv-mono text-black/55 mt-4">{COPY.paymentReassurance}</div>
          </div>
        </section>
      </div>

      <PopartVariantSwitcher />
    </>
  );
}
