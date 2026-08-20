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
import MockupSwitcher from "../_shared/MockupSwitcher";

type UploadedPhoto = { url: string; name: string };

const ONOMATOPOEIA = ["POW!", "WOW!", "BAM!", "ZAP!"];

/* ───────────────────────── small comic-style building blocks ───────────────────────── */

function Halftone({ tone = "yellow", className = "" }: { tone?: "yellow" | "blue" | "ink"; className?: string }) {
  return <div aria-hidden className={`mkp-halftone mkp-halftone--${tone} ${className}`} />;
}

function Bubble({
  children,
  tail = "bl",
  tint = "white",
  className = "",
}: {
  children: ReactNode;
  tail?: "bl" | "br" | "tl" | "tr" | "none";
  tint?: "white" | "yellow";
  className?: string;
}) {
  return (
    <div className={`mkp-bubble mkp-bubble--${tail} mkp-bubble--${tint} ${className}`}>
      {children}
    </div>
  );
}

function Panel({
  children,
  rotate = 0,
  className = "",
  bg,
}: {
  children: ReactNode;
  rotate?: number;
  className?: string;
  bg?: string;
}) {
  return (
    <div
      className={`mkp-panel ${className}`}
      style={{ transform: `rotate(${rotate}deg)`, background: bg }}
    >
      {children}
    </div>
  );
}

function PowBadge({ label, sub, size = "md" }: { label: string; sub?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`mkp-pow mkp-pow--${size}`}>
      <div className="mkp-pow-star mkp-pow-star--a" />
      <div className="mkp-pow-star mkp-pow-star--b" />
      <div className="mkp-pow-content">
        <span className="mkp-pow-label">{label}</span>
        {sub && <span className="mkp-pow-sub">{sub}</span>}
      </div>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="mkp-chip">{children}</span>;
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
    <div className="mkp-panel mkp-panel--flat p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl leading-none" aria-hidden>{icon}</span>
        <span className="font-mkp-display text-lg">{label}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="mkp-dial-btn"
          aria-label={`Réduire ${label}`}
        >
          −
        </button>
        <div className="font-mkp-display text-4xl tabular-nums">{value}</div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="mkp-dial-btn"
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

  // revoke every remaining object URL on unmount
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
        href="https://fonts.googleapis.com/css2?family=Bangers&family=Inter:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .mk-popart {
          --mkp-red: #ED1C24;
          --mkp-red-deep: #B30F17;
          --mkp-blue: #0057B7;
          --mkp-blue-soft: #CFE6FF;
          --mkp-yellow: #FFD400;
          --mkp-yellow-soft: #FFF0AD;
          --mkp-magenta: #FF2D78;
          --mkp-ink: #101010;
          --mkp-paper: #FFF8E7;
          --mkp-white: #FFFFFF;
          background: var(--mkp-paper);
          color: var(--mkp-ink);
          font-family: 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          position: relative;
        }
        .mk-popart *, .mk-popart *::before, .mk-popart *::after { box-sizing: border-box; }
        .mk-popart .font-mkp-display {
          font-family: 'Bangers', 'Luckiest Guy', system-ui, sans-serif;
          letter-spacing: 0.03em;
          font-weight: 400;
          line-height: 1;
        }

        .mkp-halftone { position: absolute; inset: 0; pointer-events: none; opacity: 0.55; }
        .mkp-halftone--yellow { background-image: radial-gradient(circle, rgba(16,16,16,0.16) 1.6px, transparent 1.7px); background-size: 13px 13px; }
        .mkp-halftone--blue { background-image: radial-gradient(circle, rgba(0,87,183,0.28) 1.8px, transparent 1.9px); background-size: 14px 14px; }
        .mkp-halftone--ink { background-image: radial-gradient(circle, rgba(255,255,255,0.5) 1.6px, transparent 1.7px); background-size: 12px 12px; }

        .mkp-panel {
          position: relative;
          background: var(--mkp-white);
          border: 4px solid var(--mkp-ink);
          box-shadow: 7px 7px 0 var(--mkp-ink);
          border-radius: 6px;
        }
        .mkp-panel--flat { box-shadow: 4px 4px 0 var(--mkp-ink); }

        .mkp-press { transition: transform 130ms cubic-bezier(.34,1.56,.64,1), box-shadow 130ms ease; }
        .mkp-press:active { transform: scale(0.94) !important; }
        button.mkp-press, .mkp-tile.mkp-press { cursor: pointer; }

        .mkp-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-family: 'Bangers', system-ui, sans-serif;
          letter-spacing: 0.04em;
          font-size: 1.15rem;
          color: var(--mkp-ink);
          background: var(--mkp-yellow);
          border: 4px solid var(--mkp-ink);
          border-radius: 999px;
          padding: 0.9rem 1.9rem;
          box-shadow: 6px 6px 0 var(--mkp-ink);
          transition: transform 130ms cubic-bezier(.34,1.56,.64,1), box-shadow 130ms ease;
          cursor: pointer;
          user-select: none;
        }
        .mkp-btn:hover { transform: translate(-2px,-2px); box-shadow: 8px 8px 0 var(--mkp-ink); }
        .mkp-btn:active { transform: translate(3px,3px) scale(0.97); box-shadow: 2px 2px 0 var(--mkp-ink); }
        .mkp-btn.mkp-btn--lg { padding: 1.1rem 2.4rem; font-size: 1.5rem; }
        .mkp-btn.mkp-btn--dark { background: var(--mkp-ink); color: var(--mkp-yellow); }
        .mkp-btn.mkp-btn--red { background: var(--mkp-red); color: var(--mkp-white); }
        .mkp-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

        .mkp-bubble {
          position: relative;
          background: var(--mkp-white);
          border: 3.5px solid var(--mkp-ink);
          border-radius: 22px;
          padding: 0.85rem 1.15rem;
        }
        .mkp-bubble--yellow { background: var(--mkp-yellow); }
        .mkp-bubble--bl::before, .mkp-bubble--bl::after { content: ''; position: absolute; width: 0; height: 0; }
        .mkp-bubble--bl::before { bottom: -17px; left: 30px; border-left: 13px solid transparent; border-right: 5px solid transparent; border-top: 19px solid var(--mkp-ink); }
        .mkp-bubble--bl::after { bottom: -10.5px; left: 34px; border-left: 9px solid transparent; border-right: 3px solid transparent; border-top: 13px solid var(--mkp-white); }
        .mkp-bubble--yellow.mkp-bubble--bl::after { border-top-color: var(--mkp-yellow); }
        .mkp-bubble--br::before, .mkp-bubble--br::after { content: ''; position: absolute; width: 0; height: 0; }
        .mkp-bubble--br::before { bottom: -17px; right: 30px; border-right: 13px solid transparent; border-left: 5px solid transparent; border-top: 19px solid var(--mkp-ink); }
        .mkp-bubble--br::after { bottom: -10.5px; right: 34px; border-right: 9px solid transparent; border-left: 3px solid transparent; border-top: 13px solid var(--mkp-white); }
        .mkp-bubble--tl::before, .mkp-bubble--tl::after { content: ''; position: absolute; width: 0; height: 0; }
        .mkp-bubble--tl::before { top: -17px; left: 30px; border-left: 13px solid transparent; border-right: 5px solid transparent; border-bottom: 19px solid var(--mkp-ink); }
        .mkp-bubble--tl::after { top: -10.5px; left: 34px; border-left: 9px solid transparent; border-right: 3px solid transparent; border-bottom: 13px solid var(--mkp-white); }

        .mkp-chip {
          display: inline-flex; align-items: center; gap: 0.3rem;
          background: var(--mkp-white); border: 2.5px solid var(--mkp-ink);
          border-radius: 999px; padding: 0.3rem 0.7rem; font-size: 0.72rem; font-weight: 800;
          box-shadow: 2px 2px 0 var(--mkp-ink);
        }

        .mkp-dial-btn {
          width: 42px; height: 42px; border-radius: 999px;
          background: var(--mkp-yellow); border: 3px solid var(--mkp-ink);
          font-family: 'Bangers', sans-serif; font-size: 1.4rem; line-height: 1;
          box-shadow: 3px 3px 0 var(--mkp-ink);
          transition: transform 120ms ease;
        }
        .mkp-dial-btn:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 var(--mkp-ink); }
        .mkp-dial-btn:disabled { opacity: 0.35; }

        .mkp-tile { position: relative; overflow: hidden; text-align: left; background: var(--mkp-white); border: 3.5px solid var(--mkp-ink); border-radius: 10px; box-shadow: 4px 4px 0 var(--mkp-ink); transition: transform 130ms ease, box-shadow 130ms ease; }
        .mkp-tile:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 var(--mkp-ink); }
        .mkp-tile--selected { outline: 4px solid var(--mkp-magenta); outline-offset: 2px; }
        .mkp-tile--selected::after {
          content: '✓'; position: absolute; top: -10px; right: -10px; width: 28px; height: 28px;
          background: var(--mkp-magenta); color: var(--mkp-white); border: 3px solid var(--mkp-ink); border-radius: 999px;
          display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; z-index: 5;
        }

        .mkp-section-label {
          display: inline-flex; align-items: center; gap: 0.5rem;
          background: var(--mkp-ink); color: var(--mkp-yellow);
          font-family: 'Bangers', sans-serif; letter-spacing: 0.08em; text-transform: uppercase;
          padding: 0.4rem 1rem; border-radius: 999px; font-size: 0.95rem;
          transform: rotate(-1.4deg);
        }

        .mkp-onomato {
          position: absolute; z-index: 6; font-family: 'Bangers', sans-serif; color: var(--mkp-magenta);
          -webkit-text-stroke: 2px var(--mkp-ink); font-size: 1.6rem; transform: rotate(-8deg);
          filter: drop-shadow(2px 2px 0 var(--mkp-ink));
        }

        .mkp-pow { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 132px; height: 132px; }
        .mkp-pow--sm { width: 100px; height: 100px; }
        .mkp-pow--lg { width: 168px; height: 168px; }
        .mkp-pow-star {
          position: absolute; inset: 0;
          background: var(--mkp-yellow);
          border: 3.5px solid var(--mkp-ink);
          clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
        }
        .mkp-pow-star--a { transform: rotate(0deg); }
        .mkp-pow-star--b { transform: rotate(24deg); background: var(--mkp-yellow); opacity: 0.96; }
        .mkp-pow-content { position: relative; z-index: 2; text-align: center; display: flex; flex-direction: column; align-items: center; }
        .mkp-pow-label { font-family: 'Bangers', sans-serif; font-size: 1.55rem; line-height: 1; color: var(--mkp-ink); }
        .mkp-pow-sub { font-family: 'Bangers', sans-serif; font-size: 0.72rem; color: var(--mkp-red-deep); margin-top: 2px; }

        @keyframes mkp-pop { 0% { transform: scale(0.9) rotate(-2deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        .mkp-pop-in { animation: mkp-pop 520ms cubic-bezier(.22,1.15,.4,1) both; }
        @keyframes mkp-wobble { 0%,100% { transform: rotate(-2.2deg); } 50% { transform: rotate(2.2deg); } }
        .mkp-wobble { animation: mkp-wobble 3.6s ease-in-out infinite; }
        @keyframes mkp-toast-in { 0% { transform: translateY(16px) scale(0.9); opacity: 0; } 60% { transform: translateY(-3px) scale(1.03); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        .mkp-toast-in { animation: mkp-toast-in 380ms cubic-bezier(.2,.9,.3,1.2) both; }
        @keyframes mkp-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .mkp-marquee-track { animation: mkp-marquee 26s linear infinite; }
        .mkp-faq-chev { transition: transform 220ms ease; }
        .mkp-faq-open .mkp-faq-chev { transform: rotate(45deg); }
        .mkp-faq-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 300ms ease; }
        .mkp-faq-open .mkp-faq-panel { grid-template-rows: 1fr; }
        .mkp-faq-panel > div { overflow: hidden; }
        .mkp-dashed { border: 4px dashed var(--mkp-ink); border-radius: 12px; }
        .mkp-dashed.mkp-drop-active { background: var(--mkp-yellow-soft); border-color: var(--mkp-magenta); }
      `}</style>

      <div className="mk-popart min-h-screen overflow-x-hidden">
        {/* ═══════════════════ HERO ═══════════════════ */}
        <section className="relative pt-10 pb-16 overflow-hidden border-b-4 border-black">
          <Halftone tone="yellow" />
          <div className="max-w-7xl mx-auto px-6 relative">
            <div className="text-xs font-extrabold uppercase tracking-widest text-black/60 mb-5 flex items-center gap-2">
              <span>{COPY.universe}</span>
              <span>›</span>
              <span className="text-[var(--mkp-red)]">{COPY.simpsonStyle}</span>
            </div>

            <div className="grid lg:grid-cols-[1.05fr_1fr] gap-8 items-stretch">
              {/* Panel 1: headline + CTA */}
              <Panel rotate={-0.6} className="p-7 md:p-9 flex flex-col justify-center">
                <h1 className="font-mkp-display text-[clamp(2.4rem,5.6vw,4.6rem)] leading-[0.92] mb-4">
                  {COPY.heroTitle1}{" "}
                  <span className="text-[var(--mkp-red)]" style={{ WebkitTextStroke: "1.5px var(--mkp-ink)" }}>
                    {COPY.heroTitle2}
                  </span>
                </h1>
                <p className="text-base md:text-lg font-semibold text-black/75 mb-6 max-w-xl">
                  {COPY.heroSubtitle}
                </p>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <Chip>⚡ {COPY.delivered48h}</Chip>
                  <Chip>🔒 {COPY.satisfiedOrRefunded}</Chip>
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <button type="button" onClick={scrollToConfig} className="mkp-btn mkp-btn--lg mkp-press">
                    {COPY.orderCta} →
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="flex text-[var(--mkp-red)] text-lg leading-none">{"★".repeat(5)}</div>
                    <div className="text-sm font-bold">
                      {STATS.rating}/5 · {STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}
                    </div>
                  </div>
                </div>
              </Panel>

              {/* Panel grid 2 + 3: hero photos */}
              <div className="grid grid-rows-[1.4fr_1fr] gap-5">
                <Panel rotate={0.9} className="overflow-hidden relative">
                  <div className="relative aspect-[5/4] md:aspect-[16/11]">
                    {HERO_SLIDES.map((src, i) => (
                      <div
                        key={src}
                        className={`absolute inset-0 transition-opacity duration-700 ${i === heroIndex ? "opacity-100 mkp-pop-in" : "opacity-0 pointer-events-none"}`}
                      >
                        <Image
                          src={src}
                          alt="Portrait cartoon jaune façon Simpson, réalisé sur mesure"
                          fill
                          className="object-cover"
                          priority={i === 0}
                          sizes="(max-width: 1024px) 92vw, 46vw"
                        />
                      </div>
                    ))}
                    <div className="absolute inset-0 mkp-halftone mkp-halftone--ink opacity-20 pointer-events-none" />
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                      {HERO_SLIDES.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setHeroIndex(i)}
                          aria-label={`Photo ${i + 1}`}
                          className="h-2.5 rounded-full border-2 border-black transition-all"
                          style={{ background: i === heroIndex ? "var(--mkp-yellow)" : "#fff", width: i === heroIndex ? 20 : 9 }}
                        />
                      ))}
                    </div>
                  </div>
                </Panel>

                <Bubble tail="tl" tint="yellow" className="self-end mkp-wobble">
                  <div className="font-mkp-display text-2xl leading-none mb-1">
                    {COPY.orderCta.split(" ")[0]}&nbsp;{formatEUR(PRICES.base)}
                  </div>
                  <div className="text-xs font-bold text-black/70">{COPY.digital48h}</div>
                </Bubble>
              </div>
            </div>
          </div>

          <div className="mt-12 border-y-4 border-black bg-[var(--mkp-ink)] text-[var(--mkp-yellow)] overflow-hidden">
            <div className="flex mkp-marquee-track whitespace-nowrap py-3 font-mkp-display text-lg">
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

        {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
        <section className="py-16 relative border-b-4 border-black">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-10">
              <div className="mkp-section-label mb-4">{COPY.howItWorks}</div>
              <h2 className="font-mkp-display text-[clamp(1.9rem,3.4vw,2.8rem)] leading-tight">{COPY.howItWorksTitle}</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: COPY.step1Title, desc: COPY.step1Desc, icon: "📸", tint: "var(--mkp-blue-soft)" },
                { title: COPY.step2Title, desc: COPY.step2Desc, icon: "🎨", tint: "var(--mkp-yellow-soft)" },
                { title: COPY.step3Title, desc: COPY.step3Desc, icon: "✅", tint: "#FFD3E5" },
              ].map((s, i) => (
                <Panel key={i} rotate={i % 2 === 0 ? -0.7 : 0.7} className="p-6 text-center">
                  <div
                    className="w-16 h-16 mx-auto mb-4 rounded-full border-3 border-black flex items-center justify-center text-3xl"
                    style={{ background: s.tint, boxShadow: "3px 3px 0 var(--mkp-ink)", borderWidth: 3 }}
                  >
                    {s.icon}
                  </div>
                  <h3 className="font-mkp-display text-2xl mb-2">{s.title}</h3>
                  <p className="text-sm font-semibold text-black/70 mb-5">{s.desc}</p>
                  <Bubble tail="bl" className="inline-block text-left">
                    <span className="font-mkp-display text-lg">{i + 1}/3</span>
                  </Bubble>
                </Panel>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ CONFIGURATOR ═══════════════════ */}
        <section ref={configRef} id="configurator" className="py-20 border-b-4 border-black relative">
          <Halftone tone="blue" className="opacity-30" />
          <div className="max-w-7xl mx-auto px-6 relative">
            <div className="text-center mb-12">
              <div className="mkp-section-label mb-4">{COPY.configurator}</div>
              <h2 className="font-mkp-display text-[clamp(2rem,4vw,3.2rem)] leading-tight">{COPY.composeYourPortrait}</h2>
              <p className="font-semibold text-black/70 mt-3">{COPY.guidedSteps}</p>
            </div>

            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10">
              {/* live preview */}
              <div className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
                <Panel rotate={-0.5} className="overflow-hidden">
                  <div className="relative aspect-[4/5]">
                    <Image
                      src={selectedBackground.src}
                      alt={`Décor ${selectedBackground.label}`}
                      fill
                      className="object-cover transition-all duration-300"
                      sizes="(max-width: 1024px) 92vw, 520px"
                    />
                    <div className="absolute inset-0 mkp-halftone mkp-halftone--ink opacity-15" />
                    <div className="absolute top-3 left-3">
                      <Chip>{selectedBackground.label}</Chip>
                    </div>
                  </div>
                  <div className="border-t-4 border-black p-4 flex flex-wrap gap-2 bg-[var(--mkp-yellow-soft)]">
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
                <Panel rotate={0.3} className="p-5">
                  <h3 className="font-mkp-display text-xl mb-4">01 — {COPY.framingStep}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(["portrait", "fullbody"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormat(f)}
                        className={`mkp-tile mkp-press ${format === f ? "mkp-tile--selected" : ""}`}
                      >
                        <div className="aspect-[5/3] bg-[var(--mkp-yellow-soft)] flex items-center justify-center text-5xl">
                          {f === "portrait" ? "👤" : "🧍"}
                        </div>
                        <div className="px-3 py-2.5 border-t-3 border-black" style={{ borderTopWidth: 3 }}>
                          <div className="font-mkp-display text-lg">{f === "portrait" ? COPY.portrait : COPY.fullbody}</div>
                          <div className="text-xs font-bold text-black/60">{f === "portrait" ? COPY.portraitSub : COPY.fullbodySub}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>

                {/* 02 people/animals */}
                <Panel rotate={-0.3} className="p-5">
                  <h3 className="font-mkp-display text-xl mb-4">02 — {COPY.whoOnPortrait}</h3>
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
                <Panel rotate={0.3} className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="font-mkp-display text-xl">03 — {COPY.decorStep}</h3>
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
                        className={`mkp-tile mkp-press ${selectedBg === i ? "mkp-tile--selected" : ""}`}
                      >
                        <div className="relative aspect-square">
                          <Image src={bg.src} alt={bg.label} fill className="object-cover" sizes="180px" />
                        </div>
                        <div className="px-2 py-1.5 border-t-3 border-black bg-white" style={{ borderTopWidth: 3 }}>
                          <div className="font-mkp-display text-[13px] leading-tight truncate">{bg.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>

                {/* 04 upload */}
                <Panel rotate={-0.3} className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="font-mkp-display text-xl">04 — {COPY.uploadStep}</h3>
                    <span className="text-xs font-bold text-black/60">{COPY.uploadMax8}</span>
                  </div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                    className={`mkp-dashed px-5 py-8 text-center bg-[var(--mkp-yellow-soft)]/40 transition ${dragOver ? "mkp-drop-active" : ""}`}
                  >
                    <div className="text-5xl mb-2" aria-hidden>📸</div>
                    <div className="font-mkp-display text-xl">{COPY.dragHere}</div>
                    <div className="text-sm font-bold text-black/60 mb-4">{COPY.orWord}</div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mkp-btn mkp-press"
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
                            className="absolute top-1 right-1 w-6 h-6 bg-white border-2 border-black rounded-full font-black text-xs leading-none mkp-press"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {photos.length < 8 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square border-3 border-black rounded flex items-center justify-center font-mkp-display text-3xl text-black/50 mkp-press"
                          style={{ borderWidth: 3 }}
                        >
                          +
                        </button>
                      )}
                    </div>
                  )}
                </Panel>

                {/* 05 note */}
                <Panel rotate={0.3} className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-mkp-display text-xl">05 — {COPY.noteForArtist}</h3>
                    <span className="text-xs font-bold text-black/60">{COPY.optional}</span>
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 400))}
                    rows={4}
                    className="w-full border-3.5 border-black rounded-lg px-4 py-3 text-base outline-none resize-none focus:ring-2 focus:ring-[var(--mkp-magenta)]"
                    style={{ borderWidth: 3.5 }}
                    placeholder={COPY.notePlaceholder}
                  />
                  <div className="text-xs font-bold text-black/50 mt-1 text-right">{note.length} / 400</div>
                </Panel>

                {/* 06 print options */}
                <Panel rotate={-0.3} className="p-5">
                  <h3 className="font-mkp-display text-xl mb-4">06 — {COPY.printSupportStep}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {PRINT_OPTIONS.map((opt, i) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setSelectedPrint(i)}
                        className={`mkp-tile mkp-press relative ${selectedPrint === i ? "mkp-tile--selected" : ""}`}
                      >
                        {opt.badge && (
                          <div className="absolute top-2 left-2 bg-[var(--mkp-red)] text-white border-2 border-black rounded-full px-2 py-0.5 text-[10px] font-mkp-display z-10">
                            {opt.badge}
                          </div>
                        )}
                        <div className="aspect-[5/3] bg-[var(--mkp-yellow-soft)] relative">
                          <Image src={opt.img} alt={opt.label} fill className="object-contain p-3" sizes="260px" />
                        </div>
                        <div className="px-3 py-2.5 border-t-3 border-black bg-white flex items-center justify-between gap-2" style={{ borderTopWidth: 3 }}>
                          <div>
                            <div className="font-mkp-display text-base leading-tight">{opt.label}</div>
                            <div className="text-[11px] font-bold text-black/60">{opt.sub}</div>
                          </div>
                          <div className="font-mkp-display text-lg whitespace-nowrap">{formatEUR(PRICES.base + opt.addon)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>

                {/* summary */}
                <Panel rotate={0.4} className="p-6 relative overflow-visible">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-mkp-display text-2xl mb-3">{COPY.summary}</div>
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
                        <div className="flex justify-between gap-4 text-black/60">
                          <span>{COPY.revisionsIncluded}</span>
                          <span>{COPY.included}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-black/60">{COPY.total}</span>
                      <PowBadge label={formatEUR(total)} size="md" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="mkp-btn mkp-btn--red mkp-btn--lg w-full mt-6 mkp-press"
                  >
                    {COPY.addToCart} · {formatEUR(total)} →
                  </button>
                  <div className="text-xs font-bold text-black/60 text-center mt-3">{COPY.paymentReassurance}</div>

                  {toastVisible && (
                    <div className="absolute left-1/2 -translate-x-1/2 -top-4 -translate-y-full mkp-toast-in z-20">
                      <Bubble tail="none" tint="yellow" className="whitespace-nowrap shadow-lg">
                        <span className="font-mkp-display text-base">{COPY.previewOnlyToast}</span>
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
              <div className="mkp-section-label mb-4">{COPY.galleryLabel}</div>
              <h2 className="font-mkp-display text-[clamp(2rem,4vw,3.2rem)] leading-tight">{COPY.galleryTitle}</h2>
              <p className="font-semibold text-black/70 mt-3">{COPY.gallerySub}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {GALLERY_PHOTOS.map((src, i) => (
                <div
                  key={src}
                  className="relative border-4 border-black rounded-lg overflow-hidden bg-white mkp-press"
                  style={{ boxShadow: "5px 5px 0 var(--mkp-ink)", transform: `rotate(${((i % 4) - 1.5) * 0.7}deg)` }}
                >
                  <div className="relative aspect-square">
                    <Image
                      src={src}
                      alt="Réalisation cartoon jaune Cartoonova"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  </div>
                  {i % 3 !== 2 && (
                    <span className="mkp-onomato" style={{ top: i % 2 === 0 ? "6%" : "auto", bottom: i % 2 === 0 ? "auto" : "6%", right: "6%" }}>
                      {ONOMATOPOEIA[i % ONOMATOPOEIA.length]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ REVIEWS ═══════════════════ */}
        <section className="py-20 border-b-4 border-black relative">
          <Halftone tone="yellow" className="opacity-25" />
          <div className="max-w-7xl mx-auto px-6 relative">
            <div className="grid md:grid-cols-[auto_1fr] gap-12 items-center mb-14">
              <div className="text-center md:text-left">
                <div className="mkp-section-label mb-4">{COPY.reviewsLabel}</div>
                <div className="flex items-end gap-3 justify-center md:justify-start">
                  <div className="font-mkp-display text-[6rem] leading-[0.85]">{STATS.rating.toString().replace(".", ",")}</div>
                  <div className="text-2xl font-mkp-display text-black/50 mb-2">/5</div>
                </div>
                <div className="flex text-[var(--mkp-red)] text-2xl leading-none mt-1 justify-center md:justify-start">{"★".repeat(5)}</div>
                <div className="font-bold mt-2">
                  {COPY.basedOn} <span className="bg-[var(--mkp-yellow)] px-1.5 rounded border-2 border-black">{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}</span>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 max-w-md mx-auto md:mx-0">
                {STATS.distribution.map((r) => (
                  <div key={r.stars} className="contents">
                    <div className="text-sm font-bold col-span-1">{r.stars} ★</div>
                    <div className="col-span-3 h-3 bg-white border-2 border-black rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--mkp-red)]" style={{ width: `${r.pct}%` }} />
                    </div>
                    <div className="text-sm font-bold col-span-1 text-right">{r.pct}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {REVIEWS.map((r, i) => (
                <Bubble key={r.name} tail={i % 2 === 0 ? "bl" : "br"} className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-full border-2.5 border-black flex items-center justify-center font-mkp-display text-base"
                      style={{ background: ["var(--mkp-blue-soft)", "var(--mkp-yellow-soft)", "#FFD3E5"][i % 3], borderWidth: 2.5 }}
                    >
                      {r.name.charAt(0)}
                    </div>
                    <div className="font-mkp-display text-base leading-tight">{r.name}</div>
                  </div>
                  <div className="flex text-[var(--mkp-red)] text-sm leading-none mb-2">{"★".repeat(5)}</div>
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
              <div className="mkp-section-label mb-4">FAQ</div>
              <h2 className="font-mkp-display text-[clamp(2rem,4vw,3.2rem)] leading-tight">{COPY.frequentQuestions}</h2>
            </div>
            <div className="space-y-4">
              {FAQ_ITEMS.map((f, i) => (
                <Panel key={f.q} rotate={i % 2 === 0 ? -0.25 : 0.25} className={`overflow-hidden ${openFaq === i ? "mkp-faq-open" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-5 font-mkp-display text-lg md:text-xl"
                    aria-expanded={openFaq === i}
                  >
                    <span>{f.q}</span>
                    <span
                      className="mkp-faq-chev w-9 h-9 shrink-0 rounded-full bg-[var(--mkp-yellow)] border-3 border-black flex items-center justify-center text-2xl leading-none"
                      style={{ boxShadow: "2px 2px 0 var(--mkp-ink)", borderWidth: 3 }}
                    >
                      +
                    </span>
                  </button>
                  <div className="mkp-faq-panel">
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
        <section className="relative overflow-hidden border-b-4 border-black">
          <Halftone tone="blue" className="opacity-30" />
          <div className="relative max-w-5xl mx-auto px-6 py-20 text-center">
            <div className="inline-block bg-black text-[var(--mkp-yellow)] font-mkp-display rounded-full px-4 py-1.5 text-sm mb-6">
              +{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.satisfiedClients}
            </div>
            <h2 className="font-mkp-display text-[clamp(2.2rem,5.6vw,4.6rem)] leading-[0.95] mb-4">{COPY.ctaTitle}</h2>
            <p className="text-lg md:text-xl font-bold mb-8 text-black/75">{COPY.ctaSubtitle}</p>
            <div className="flex flex-wrap justify-center gap-3 mb-9 font-bold text-sm">
              <Chip>✏️ {COPY.pillDrawnHand}</Chip>
              <Chip>⚡ {COPY.pillDelivered48h}</Chip>
              <Chip>🔒 {COPY.pillSatisfied}</Chip>
              <Chip>🇫🇷 {COPY.madeInFrance}</Chip>
            </div>
            <button type="button" onClick={scrollToConfig} className="mkp-btn mkp-btn--dark mkp-btn--lg mkp-press">
              {COPY.orderCta} →
            </button>
            <div className="text-sm font-bold text-black/60 mt-4">{COPY.paymentReassurance}</div>
          </div>
        </section>
      </div>

      <MockupSwitcher />
    </>
  );
}
