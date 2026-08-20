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

const TONES = ["magenta", "cyan", "yellow", "orange", "mono"] as const;
type Tone = (typeof TONES)[number];

/* ───────────────────────── small Warhol-esque building blocks ───────────────────────── */

function DuotoneTile({
  src,
  alt,
  tone,
  priority,
  sizes,
}: {
  src: string;
  alt: string;
  tone: Tone;
  priority?: boolean;
  sizes: string;
}) {
  return (
    <div className="relative w-full h-full overflow-hidden bg-[var(--mkpw-ink)]">
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover mkpw-duotone-img"
      />
      <div className={`absolute inset-0 mkpw-duotone-overlay mkpw-duotone-overlay--${tone}`} />
    </div>
  );
}

function Block({
  children,
  className = "",
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone?: "paper" | "ink" | "magenta" | "cyan" | "yellow" | "orange";
}) {
  return (
    <div className={`mkpw-block ${tone ? `mkpw-block--${tone}` : ""} ${className}`}>
      {children}
    </div>
  );
}

function Chip({ children, tone = "paper" }: { children: ReactNode; tone?: "paper" | "ink" }) {
  return <span className={`mkpw-chip mkpw-chip--${tone}`}>{children}</span>;
}

function Benday({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`mkpw-benday ${className}`} />;
}

function Dial({
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
    <div className="mkpw-block p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl leading-none" aria-hidden>
          {icon}
        </span>
        <span className="font-mkpw-display text-base tracking-wide">{label}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="mkpw-dial-btn"
          aria-label={`Réduire ${label}`}
        >
          −
        </button>
        <div className="font-mkpw-display text-3xl tabular-nums">{value}</div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="mkpw-dial-btn"
          aria-label={`Augmenter ${label}`}
        >
          +
        </button>
      </div>
      {hint && <div className="text-[11px] font-bold uppercase tracking-wide text-black/55 mt-2 text-center">{hint}</div>}
    </div>
  );
}

function StepLabel({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="mkpw-step-n">{String(n).padStart(2, "0")}</span>
      <h3 className="font-mkpw-display text-xl md:text-2xl tracking-wide">{children}</h3>
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
    const id = setInterval(() => setHeroIndex((i) => (i + 1) % HERO_SLIDES.length), 4200);
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

  const heroPhoto = HERO_SLIDES[heroIndex];

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .mk-popart-warhol {
          --mkpw-magenta: #FF1F8F;
          --mkpw-cyan: #00C2FF;
          --mkpw-yellow: #F5E400;
          --mkpw-orange: #FF5A1F;
          --mkpw-ink: #0D0D0D;
          --mkpw-paper: #F7F4EC;
          --mkpw-white: #FFFFFF;
          background: var(--mkpw-paper);
          color: var(--mkpw-ink);
          font-family: 'Archivo', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          position: relative;
        }
        .mk-popart-warhol *, .mk-popart-warhol *::before, .mk-popart-warhol *::after { box-sizing: border-box; }
        .mk-popart-warhol .font-mkpw-display {
          font-family: 'Anton', 'Archivo Black', system-ui, sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.01em;
          line-height: 0.92;
          font-weight: 400;
        }

        /* ---- duotone photo treatment ---- */
        .mkpw-duotone-img { filter: grayscale(1) contrast(1.45) brightness(1.1); }
        .mkpw-duotone-overlay { mix-blend-mode: multiply; }
        .mkpw-duotone-overlay--magenta { background: var(--mkpw-magenta); }
        .mkpw-duotone-overlay--cyan { background: var(--mkpw-cyan); }
        .mkpw-duotone-overlay--yellow { background: var(--mkpw-yellow); }
        .mkpw-duotone-overlay--orange { background: var(--mkpw-orange); }
        .mkpw-duotone-overlay--mono { background: var(--mkpw-ink); opacity: 0.08; mix-blend-mode: normal; }

        /* ---- ben-day dot accent (sparing use only) ---- */
        .mkpw-benday {
          background-image: radial-gradient(circle, rgba(13,13,13,0.85) 1.7px, transparent 1.8px);
          background-size: 10px 10px;
          opacity: 0.16;
        }

        /* ---- flat blocks, no gradients, no rounded corners ---- */
        .mkpw-block {
          position: relative;
          background: var(--mkpw-white);
          border: 3px solid var(--mkpw-ink);
          border-radius: 2px;
        }
        .mkpw-block--paper { background: var(--mkpw-paper); }
        .mkpw-block--ink { background: var(--mkpw-ink); color: var(--mkpw-white); }
        .mkpw-block--magenta { background: var(--mkpw-magenta); color: var(--mkpw-white); }
        .mkpw-block--cyan { background: var(--mkpw-cyan); color: var(--mkpw-ink); }
        .mkpw-block--yellow { background: var(--mkpw-yellow); color: var(--mkpw-ink); }
        .mkpw-block--orange { background: var(--mkpw-orange); color: var(--mkpw-white); }

        .mkpw-press { transition: transform 120ms ease, box-shadow 120ms ease; }
        .mkpw-press:active { transform: translate(2px,2px) !important; box-shadow: none !important; }

        .mkpw-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          font-family: 'Anton', sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          font-size: 1rem;
          color: var(--mkpw-white);
          background: var(--mkpw-ink);
          border: 3px solid var(--mkpw-ink);
          border-radius: 2px;
          padding: 0.95rem 1.9rem;
          box-shadow: 5px 5px 0 var(--mkpw-magenta);
          transition: transform 130ms ease, box-shadow 130ms ease;
          cursor: pointer;
          user-select: none;
        }
        .mkpw-btn:hover { transform: translate(-2px,-2px); box-shadow: 7px 7px 0 var(--mkpw-magenta); }
        .mkpw-btn:active { transform: translate(3px,3px); box-shadow: 2px 2px 0 var(--mkpw-magenta); }
        .mkpw-btn.mkpw-btn--lg { padding: 1.15rem 2.5rem; font-size: 1.3rem; }
        .mkpw-btn.mkpw-btn--yellow { background: var(--mkpw-yellow); color: var(--mkpw-ink); border-color: var(--mkpw-ink); box-shadow: 5px 5px 0 var(--mkpw-ink); }
        .mkpw-btn.mkpw-btn--yellow:hover { box-shadow: 7px 7px 0 var(--mkpw-ink); }
        .mkpw-btn.mkpw-btn--yellow:active { box-shadow: 2px 2px 0 var(--mkpw-ink); }
        .mkpw-btn.mkpw-btn--cyan { background: var(--mkpw-cyan); color: var(--mkpw-ink); border-color: var(--mkpw-ink); box-shadow: 5px 5px 0 var(--mkpw-orange); }
        .mkpw-btn.mkpw-btn--cyan:hover { box-shadow: 7px 7px 0 var(--mkpw-orange); }
        .mkpw-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

        .mkpw-chip {
          display: inline-flex; align-items: center; gap: 0.35rem;
          border: 2px solid var(--mkpw-ink);
          border-radius: 999px; padding: 0.32rem 0.75rem; font-size: 0.72rem; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .mkpw-chip--paper { background: var(--mkpw-white); color: var(--mkpw-ink); }
        .mkpw-chip--ink { background: var(--mkpw-ink); color: var(--mkpw-yellow); border-color: var(--mkpw-ink); }

        .mkpw-dial-btn {
          width: 40px; height: 40px; border-radius: 999px;
          background: var(--mkpw-yellow); border: 2.5px solid var(--mkpw-ink);
          font-family: 'Anton', sans-serif; font-size: 1.3rem; line-height: 1;
          transition: transform 120ms ease;
        }
        .mkpw-dial-btn:active { transform: scale(0.88); }
        .mkpw-dial-btn:disabled { opacity: 0.3; }

        .mkpw-tile { position: relative; overflow: hidden; text-align: left; background: var(--mkpw-white); border: 3px solid var(--mkpw-ink); border-radius: 2px; transition: transform 130ms ease, box-shadow 130ms ease; }
        .mkpw-tile:hover { transform: translate(-2px,-2px); box-shadow: 5px 5px 0 var(--mkpw-ink); }
        .mkpw-tile--selected { box-shadow: 5px 5px 0 var(--mkpw-magenta); outline: 3px solid var(--mkpw-magenta); outline-offset: -3px; }
        .mkpw-tile--selected::after {
          content: '✓'; position: absolute; top: -3px; right: -3px; width: 26px; height: 26px;
          background: var(--mkpw-magenta); color: var(--mkpw-white); border: 2px solid var(--mkpw-ink);
          display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 12px; z-index: 5;
        }

        .mkpw-section-label {
          display: inline-flex; align-items: center; gap: 0.5rem;
          background: var(--mkpw-ink); color: var(--mkpw-yellow);
          font-family: 'Anton', sans-serif; letter-spacing: 0.12em; text-transform: uppercase;
          padding: 0.4rem 1rem; font-size: 0.85rem; border-radius: 2px;
        }

        .mkpw-misprint {
          text-shadow: 5px 5px 0 var(--mkpw-cyan), -5px -5px 0 var(--mkpw-magenta);
        }
        @media (max-width: 640px) {
          .mkpw-misprint { text-shadow: 3px 3px 0 var(--mkpw-cyan), -3px -3px 0 var(--mkpw-magenta); }
        }

        .mkpw-stamp {
          position: relative;
          display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
          min-width: 130px; padding: 0.9rem 1.1rem;
          background: var(--mkpw-yellow); border: 3px solid var(--mkpw-ink);
          box-shadow: 6px 6px 0 var(--mkpw-ink);
        }
        .mkpw-stamp-label { font-family: 'Anton', sans-serif; font-size: 1.7rem; line-height: 1; }
        .mkpw-stamp-sub { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 3px; }

        .mkpw-dashed { border: 3px dashed var(--mkpw-ink); border-radius: 2px; }
        .mkpw-dashed.mkpw-drop-active { background: rgba(245,228,0,0.28); border-color: var(--mkpw-magenta); }

        @keyframes mkpw-pop { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
        .mkpw-pop-in { animation: mkpw-pop 480ms ease both; }
        @keyframes mkpw-toast-in { 0% { transform: translateY(14px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        .mkpw-toast-in { animation: mkpw-toast-in 320ms cubic-bezier(.2,.9,.3,1.2) both; }
        @keyframes mkpw-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .mkpw-marquee-track { animation: mkpw-marquee 22s linear infinite; }
        .mkpw-faq-chev { transition: transform 220ms ease; }
        .mkpw-faq-open .mkpw-faq-chev { transform: rotate(45deg); }
        .mkpw-faq-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 280ms ease; }
        .mkpw-faq-open .mkpw-faq-panel { grid-template-rows: 1fr; }
        .mkpw-faq-panel > div { overflow: hidden; }

        .mkpw-step-n {
          font-family: 'Anton', sans-serif; font-size: 0.9rem; line-height: 1;
          background: var(--mkpw-ink); color: var(--mkpw-white); padding: 0.35rem 0.5rem;
        }
      `}</style>

      <div className="mk-popart-warhol min-h-screen overflow-x-hidden">
        {/* ═══════════════════ HERO ═══════════════════ */}
        <section className="relative pt-10 pb-0 border-b-[3px] border-black overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 relative">
            <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-black/55 mb-5 flex items-center gap-2">
              <span>{COPY.universe}</span>
              <span>›</span>
              <span className="text-[var(--mkpw-magenta)]">{COPY.simpsonStyle}</span>
            </div>

            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 items-center pb-12">
              {/* headline + CTA */}
              <div className="relative z-10">
                <Benday className="absolute -top-6 -left-6 w-24 h-24 pointer-events-none hidden md:block" />
                <h1 className="relative font-mkpw-display text-[clamp(2.6rem,6.4vw,5.2rem)] mb-5">
                  <span className="block mkpw-misprint">{COPY.heroTitle1}</span>
                  <span className="block text-[var(--mkpw-magenta)] mkpw-misprint">{COPY.heroTitle2}</span>
                </h1>
                <p className="text-base md:text-lg font-semibold text-black/75 mb-7 max-w-xl">
                  {COPY.heroSubtitle}
                </p>
                <div className="flex flex-wrap items-center gap-3 mb-7">
                  <Chip>⚡ {COPY.delivered48h}</Chip>
                  <Chip>🔒 {COPY.satisfiedOrRefunded}</Chip>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <button type="button" onClick={scrollToConfig} className="mkpw-btn mkpw-btn--lg mkpw-press">
                    {COPY.orderCta} →
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="flex text-[var(--mkpw-magenta)] text-lg leading-none">{"★".repeat(5)}</div>
                    <div className="text-sm font-bold">
                      {STATS.rating}/5 · {STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}
                    </div>
                  </div>
                </div>
              </div>

              {/* Warhol contact-sheet: same photo repeated, each tile a different flat duotone */}
              <div className="relative">
                <div className="grid grid-cols-3 grid-rows-2 gap-[3px] border-[3px] border-black bg-black aspect-[3/2] mkpw-pop-in" key={heroIndex}>
                  {TONES.concat(["magenta"]).map((tone, i) => (
                    <div key={`${tone}-${i}`} className="relative">
                      <DuotoneTile
                        src={heroPhoto}
                        alt="Portrait cartoon jaune façon Simpson, imprimé façon sérigraphie pop-art"
                        tone={tone}
                        priority={i === 0}
                        sizes="(max-width: 1024px) 30vw, 18vw"
                      />
                    </div>
                  ))}
                </div>
                <div className="absolute -bottom-6 -right-4 md:-right-8 z-10">
                  <div className="mkpw-stamp">
                    <span className="mkpw-stamp-label">{formatEUR(PRICES.base)}</span>
                    <span className="mkpw-stamp-sub">{COPY.digital48h}</span>
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
                  {HERO_SLIDES.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setHeroIndex(i)}
                      aria-label={`Photo ${i + 1}`}
                      className="h-2 border border-black transition-all"
                      style={{ background: i === heroIndex ? "var(--mkpw-yellow)" : "#fff", width: i === heroIndex ? 18 : 8 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="border-y-[3px] border-black bg-[var(--mkpw-ink)] text-[var(--mkpw-yellow)] overflow-hidden">
            <div className="flex mkpw-marquee-track whitespace-nowrap py-3 font-mkpw-display text-base">
              {Array.from({ length: 2 }).map((_, k) => (
                <div key={k} className="flex items-center gap-8 px-5">
                  <span>+{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.portraitsDelivered}</span><span className="opacity-50">·</span>
                  <span>{COPY.delivered48h}</span><span className="opacity-50">·</span>
                  <span>{COPY.handDrawn}</span><span className="opacity-50">·</span>
                  <span>{COPY.satisfiedOrRefunded}</span><span className="opacity-50">·</span>
                  <span>{COPY.freeRevisions}</span><span className="opacity-50">·</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
        <section className="py-16 border-b-[3px] border-black">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-10">
              <div className="mkpw-section-label mb-4">{COPY.howItWorks}</div>
              <h2 className="font-mkpw-display text-[clamp(1.9rem,3.6vw,3rem)]">{COPY.howItWorksTitle}</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { title: COPY.step1Title, desc: COPY.step1Desc, icon: "📸", tone: "cyan" as const },
                { title: COPY.step2Title, desc: COPY.step2Desc, icon: "🎨", tone: "yellow" as const },
                { title: COPY.step3Title, desc: COPY.step3Desc, icon: "✅", tone: "orange" as const },
              ].map((s, i) => (
                <Block key={i} tone={s.tone} className="p-7 text-center">
                  <div className="font-mkpw-display text-6xl mb-3 opacity-90">{i + 1}</div>
                  <div className="text-3xl mb-3" aria-hidden>{s.icon}</div>
                  <h3 className="font-mkpw-display text-xl mb-2">{s.title}</h3>
                  <p className="text-sm font-semibold opacity-80">{s.desc}</p>
                </Block>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ CONFIGURATOR ═══════════════════ */}
        <section ref={configRef} id="configurator" className="py-20 border-b-[3px] border-black relative">
          <div className="max-w-7xl mx-auto px-6 relative">
            <div className="text-center mb-12">
              <div className="mkpw-section-label mb-4">{COPY.configurator}</div>
              <h2 className="font-mkpw-display text-[clamp(2rem,4.2vw,3.4rem)]">{COPY.composeYourPortrait}</h2>
              <p className="font-semibold text-black/70 mt-3">{COPY.guidedSteps}</p>
            </div>

            <div className="grid lg:grid-cols-[1fr_1.15fr] gap-10">
              {/* live preview */}
              <div className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
                <Block className="overflow-hidden">
                  <div className="relative aspect-[4/5]">
                    <Image
                      src={selectedBackground.src}
                      alt={`Décor ${selectedBackground.label}`}
                      fill
                      className="object-cover transition-all duration-300"
                      sizes="(max-width: 1024px) 92vw, 520px"
                    />
                    <div className="absolute top-3 left-3">
                      <Chip>{selectedBackground.label}</Chip>
                    </div>
                  </div>
                  <div className="border-t-[3px] border-black p-4 flex flex-wrap gap-2 bg-[var(--mkpw-yellow)]">
                    <Chip>{format === "portrait" ? COPY.portrait : COPY.fullbody}</Chip>
                    <Chip>{people} {people > 1 ? COPY.peoplePlural : COPY.peopleSingular}</Chip>
                    {animals > 0 && <Chip>{animals} {animals > 1 ? COPY.animalsPlural : COPY.animalsSingular}</Chip>}
                    <Chip>{selectedPrintOption.label}</Chip>
                  </div>
                </Block>
                <div className="mt-4 text-sm font-bold text-black/70 text-center">
                  {COPY.estimatedDelay} : <span className="text-black">{COPY.digital48h}</span> · {COPY.print57Days}
                </div>
              </div>

              {/* steps */}
              <div className="space-y-6">
                {/* 01 framing */}
                <Block className="p-5">
                  <StepLabel n={1}>{COPY.framingStep}</StepLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {(["portrait", "fullbody"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormat(f)}
                        className={`mkpw-tile mkpw-press ${format === f ? "mkpw-tile--selected" : ""}`}
                      >
                        <div className="aspect-[5/3] bg-[var(--mkpw-cyan)] flex items-center justify-center text-5xl">
                          {f === "portrait" ? "👤" : "🧍"}
                        </div>
                        <div className="px-3 py-2.5 border-t-[3px] border-black">
                          <div className="font-mkpw-display text-lg">{f === "portrait" ? COPY.portrait : COPY.fullbody}</div>
                          <div className="text-xs font-bold text-black/60">{f === "portrait" ? COPY.portraitSub : COPY.fullbodySub}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Block>

                {/* 02 people/animals */}
                <Block className="p-5">
                  <StepLabel n={2}>{COPY.whoOnPortrait}</StepLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <Dial
                      icon="🧍"
                      label={COPY.peopleLabel}
                      value={people}
                      min={1}
                      max={8}
                      hint={`+${formatEUR(PRICES.extraPerson)} ${COPY.perExtraPerson}`}
                      onChange={setPeople}
                    />
                    <Dial
                      icon="🐾"
                      label={COPY.animalsLabel}
                      value={animals}
                      min={0}
                      max={4}
                      hint={`+${formatEUR(PRICES.extraAnimal)} ${COPY.perAnimal}`}
                      onChange={setAnimals}
                    />
                  </div>
                </Block>

                {/* 03 background */}
                <Block className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <StepLabel n={3}>{COPY.decorStep}</StepLabel>
                    <span className="text-xs font-bold text-black/60 shrink-0">{COPY.hoverToPreview}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {BACKGROUNDS.map((bg, i) => (
                      <button
                        key={bg.src}
                        type="button"
                        onMouseEnter={() => setHoveredBg(i)}
                        onMouseLeave={() => setHoveredBg(null)}
                        onClick={() => setSelectedBg(i)}
                        className={`mkpw-tile mkpw-press ${selectedBg === i ? "mkpw-tile--selected" : ""}`}
                      >
                        <div className="relative aspect-square">
                          <Image src={bg.src} alt={bg.label} fill className="object-cover" sizes="180px" />
                        </div>
                        <div className="px-2 py-1.5 border-t-[3px] border-black bg-white">
                          <div className="font-mkpw-display text-[12px] leading-tight truncate">{bg.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Block>

                {/* 04 upload */}
                <Block className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <StepLabel n={4}>{COPY.uploadStep}</StepLabel>
                    <span className="text-xs font-bold text-black/60 shrink-0">{COPY.uploadMax8}</span>
                  </div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                    className={`mkpw-dashed px-5 py-8 text-center bg-[var(--mkpw-cyan)]/10 transition ${dragOver ? "mkpw-drop-active" : ""}`}
                  >
                    <div className="text-5xl mb-2" aria-hidden>📸</div>
                    <div className="font-mkpw-display text-xl">{COPY.dragHere}</div>
                    <div className="text-sm font-bold text-black/60 mb-4">{COPY.orWord}</div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mkpw-btn mkpw-btn--yellow mkpw-press"
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
                        <div key={p.url} className="relative aspect-square border-[3px] border-black overflow-hidden">
                          <Image src={p.url} alt={p.name || "Photo envoyée"} fill className="object-cover" unoptimized sizes="100px" />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            aria-label="Retirer la photo"
                            className="absolute top-1 right-1 w-6 h-6 bg-white border-2 border-black font-black text-xs leading-none mkpw-press"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {photos.length < 8 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square border-[3px] border-black flex items-center justify-center font-mkpw-display text-3xl text-black/50 mkpw-press"
                        >
                          +
                        </button>
                      )}
                    </div>
                  )}
                </Block>

                {/* 05 note */}
                <Block className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <StepLabel n={5}>{COPY.noteForArtist}</StepLabel>
                    <span className="text-xs font-bold text-black/60 shrink-0">{COPY.optional}</span>
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 400))}
                    rows={4}
                    className="w-full border-[3px] border-black px-4 py-3 text-base outline-none resize-none focus:ring-2 focus:ring-[var(--mkpw-magenta)]"
                    placeholder={COPY.notePlaceholder}
                  />
                  <div className="text-xs font-bold text-black/50 mt-1 text-right">{note.length} / 400</div>
                </Block>

                {/* 06 print options */}
                <Block className="p-5">
                  <StepLabel n={6}>{COPY.printSupportStep}</StepLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {PRINT_OPTIONS.map((opt, i) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setSelectedPrint(i)}
                        className={`mkpw-tile mkpw-press relative ${selectedPrint === i ? "mkpw-tile--selected" : ""}`}
                      >
                        {opt.badge && (
                          <div className="absolute top-2 left-2 bg-[var(--mkpw-magenta)] text-white border-2 border-black px-2 py-0.5 text-[9px] font-mkpw-display z-10">
                            {opt.badge}
                          </div>
                        )}
                        <div className="aspect-[5/3] bg-[var(--mkpw-yellow)] relative">
                          <Image src={opt.img} alt={opt.label} fill className="object-contain p-3" sizes="260px" />
                        </div>
                        <div className="px-3 py-2.5 border-t-[3px] border-black bg-white flex items-center justify-between gap-2">
                          <div>
                            <div className="font-mkpw-display text-base leading-tight">{opt.label}</div>
                            <div className="text-[11px] font-bold text-black/60">{opt.sub}</div>
                          </div>
                          <div className="font-mkpw-display text-lg whitespace-nowrap">{formatEUR(PRICES.base + opt.addon)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Block>

                {/* summary */}
                <Block tone="ink" className="p-6 relative overflow-visible">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-mkpw-display text-2xl mb-3">{COPY.summary}</div>
                      <div className="space-y-1.5 text-sm font-semibold opacity-90">
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
                        <div className="flex justify-between gap-4 opacity-70">
                          <span>{COPY.revisionsIncluded}</span>
                          <span>{COPY.included}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <span className="text-xs font-extrabold uppercase tracking-wide opacity-70">{COPY.total}</span>
                      <div className="mkpw-stamp">
                        <span className="mkpw-stamp-label">{formatEUR(total)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="mkpw-btn mkpw-btn--cyan mkpw-btn--lg w-full mt-6 mkpw-press"
                  >
                    {COPY.addToCart} · {formatEUR(total)} →
                  </button>
                  <div className="text-xs font-bold opacity-70 text-center mt-3">{COPY.paymentReassurance}</div>

                  {toastVisible && (
                    <div className="absolute left-1/2 -translate-x-1/2 -top-4 -translate-y-full mkpw-toast-in z-20">
                      <div className="mkpw-block mkpw-block--yellow px-4 py-2.5 whitespace-nowrap">
                        <span className="font-mkpw-display text-sm">{COPY.previewOnlyToast}</span>
                      </div>
                    </div>
                  )}
                </Block>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ GALLERY ═══════════════════ */}
        <section className="py-20 border-b-[3px] border-black relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <div className="mkpw-section-label mb-4">{COPY.galleryLabel}</div>
              <h2 className="font-mkpw-display text-[clamp(2rem,4.2vw,3.4rem)]">{COPY.galleryTitle}</h2>
              <p className="font-semibold text-black/70 mt-3">{COPY.gallerySub}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[3px] border-[3px] border-black bg-black">
              {GALLERY_PHOTOS.map((src, i) => (
                <div key={src} className="relative aspect-square mkpw-press">
                  <DuotoneTile
                    src={src}
                    alt="Réalisation cartoon jaune Cartoonova, tirage façon sérigraphie pop-art"
                    tone={TONES[i % TONES.length]}
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ REVIEWS ═══════════════════ */}
        <section className="py-20 border-b-[3px] border-black relative">
          <div className="max-w-7xl mx-auto px-6 relative">
            <div className="grid md:grid-cols-[auto_1fr] gap-12 items-center mb-14">
              <div className="text-center md:text-left">
                <div className="mkpw-section-label mb-4">{COPY.reviewsLabel}</div>
                <div className="flex items-end gap-3 justify-center md:justify-start">
                  <div className="font-mkpw-display text-[6rem]">{STATS.rating.toString().replace(".", ",")}</div>
                  <div className="text-2xl font-mkpw-display text-black/50 mb-2">/5</div>
                </div>
                <div className="flex text-[var(--mkpw-magenta)] text-2xl leading-none mt-1 justify-center md:justify-start">{"★".repeat(5)}</div>
                <div className="font-bold mt-2">
                  {COPY.basedOn} <span className="bg-[var(--mkpw-yellow)] px-1.5 border-2 border-black">{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}</span>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 max-w-md mx-auto md:mx-0">
                {STATS.distribution.map((r) => (
                  <div key={r.stars} className="contents">
                    <div className="text-sm font-bold col-span-1">{r.stars} ★</div>
                    <div className="col-span-3 h-3 bg-white border-2 border-black overflow-hidden">
                      <div className="h-full bg-[var(--mkpw-magenta)]" style={{ width: `${r.pct}%` }} />
                    </div>
                    <div className="text-sm font-bold col-span-1 text-right">{r.pct}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-[3px] border-[3px] border-black bg-black">
              {REVIEWS.map((r, i) => {
                const tones: ("paper" | "yellow" | "cyan" | "magenta" | "orange")[] = ["paper", "yellow", "cyan", "paper", "orange", "yellow"];
                const tone = tones[i % tones.length];
                return (
                  <Block key={r.name} tone={tone} className="p-5 border-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 border-2 border-black flex items-center justify-center font-mkpw-display text-sm bg-black text-white">
                        {r.name.charAt(0)}
                      </div>
                      <div className="font-mkpw-display text-base">{r.name}</div>
                    </div>
                    <div className="flex text-current text-sm leading-none mb-2 opacity-80">{"★".repeat(5)}</div>
                    <p className="text-[14px] font-semibold leading-snug opacity-90">&ldquo;{r.text}&rdquo;</p>
                  </Block>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════════ FAQ ═══════════════════ */}
        <section className="py-20 border-b-[3px] border-black">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-10">
              <div className="mkpw-section-label mb-4">FAQ</div>
              <h2 className="font-mkpw-display text-[clamp(2rem,4.2vw,3.4rem)]">{COPY.frequentQuestions}</h2>
            </div>
            <div className="space-y-3">
              {FAQ_ITEMS.map((f, i) => (
                <Block key={f.q} className={`overflow-hidden ${openFaq === i ? "mkpw-faq-open" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-5 font-mkpw-display text-lg md:text-xl"
                    aria-expanded={openFaq === i}
                  >
                    <span>{f.q}</span>
                    <span className="mkpw-faq-chev w-8 h-8 shrink-0 bg-[var(--mkpw-yellow)] border-2 border-black flex items-center justify-center text-2xl leading-none">
                      +
                    </span>
                  </button>
                  <div className="mkpw-faq-panel">
                    <div>
                      <div className="px-5 pb-5 text-black/70 font-semibold leading-relaxed">{f.a}</div>
                    </div>
                  </div>
                </Block>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ FINAL CTA ═══════════════════ */}
        <section className="relative overflow-hidden border-b-[3px] border-black bg-[var(--mkpw-ink)] text-white">
          <Benday className="absolute inset-0 pointer-events-none opacity-[0.07]" />
          <div className="relative max-w-5xl mx-auto px-6 py-20 text-center">
            <div className="inline-block bg-[var(--mkpw-yellow)] text-black font-mkpw-display px-4 py-1.5 text-sm mb-6">
              +{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.satisfiedClients}
            </div>
            <h2 className="font-mkpw-display text-[clamp(2.2rem,5.8vw,4.8rem)] mb-4 mkpw-misprint">{COPY.ctaTitle}</h2>
            <p className="text-lg md:text-xl font-bold mb-8 opacity-85">{COPY.ctaSubtitle}</p>
            <div className="flex flex-wrap justify-center gap-3 mb-9 font-bold text-sm">
              <Chip tone="ink">✏️ {COPY.pillDrawnHand}</Chip>
              <Chip tone="ink">⚡ {COPY.pillDelivered48h}</Chip>
              <Chip tone="ink">🔒 {COPY.pillSatisfied}</Chip>
              <Chip tone="ink">🇫🇷 {COPY.madeInFrance}</Chip>
            </div>
            <button type="button" onClick={scrollToConfig} className="mkpw-btn mkpw-btn--yellow mkpw-btn--lg mkpw-press">
              {COPY.orderCta} →
            </button>
            <div className="text-sm font-bold opacity-70 mt-4">{COPY.paymentReassurance}</div>
          </div>
        </section>
      </div>

      <PopartVariantSwitcher />
    </>
  );
}
