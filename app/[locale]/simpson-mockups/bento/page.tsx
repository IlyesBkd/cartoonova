"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import MockupSwitcher from "../_shared/MockupSwitcher";
import {
  PRICES,
  formatEUR,
  computeTotal,
  type ConfiguratorState,
  type Format,
  PRINT_OPTIONS,
  BACKGROUNDS,
  GALLERY_PHOTOS,
  HERO_SLIDES,
  REVIEWS,
  FAQ_ITEMS,
  STATS,
  COPY,
} from "../_shared/content";

type Tone = "pink" | "blue" | "sky" | "orange" | "green" | "purple" | "yellow" | "ink" | "white";
const TONE_CYCLE: Tone[] = ["pink", "sky", "orange", "green", "purple", "yellow"];

interface UploadedPhoto {
  id: string;
  url: string;
  name: string;
}

function toneClass(tone: Tone) {
  return `mkb-tile-${tone}`;
}

function Counter({
  label,
  icon,
  value,
  min,
  max,
  hint,
  tone,
  onChange,
}: {
  label: string;
  icon: string;
  value: number;
  min: number;
  max: number;
  hint?: string;
  tone: Tone;
  onChange: (v: number) => void;
}) {
  return (
    <div className={`mkb-tile ${toneClass(tone)} h-full flex flex-col justify-between`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-3xl mkb-wiggle-target" aria-hidden="true">{icon}</span>
        <span className="mkb-display text-lg leading-tight">{label}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Diminuer ${label}`}
          className="mkb-round-btn mkb-press"
        >
          −
        </button>
        <div className="mkb-display text-4xl tabular-nums">{value}</div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Augmenter ${label}`}
          className="mkb-round-btn mkb-press"
        >
          +
        </button>
      </div>
      {hint && <div className="text-xs font-extrabold mt-3 opacity-80">{hint}</div>}
    </div>
  );
}

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
  const [activeHero, setActiveHero] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [pricePulse, setPricePulse] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const configRef = useRef<HTMLElement>(null);
  const photosRef = useRef<UploadedPhoto[]>([]);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTotalRef = useRef<number | null>(null);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // revoke any remaining object URLs on unmount
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const i = setInterval(() => setActiveHero((p) => (p + 1) % HERO_SLIDES.length), 3600);
    return () => clearInterval(i);
  }, []);

  const configState: ConfiguratorState = {
    format,
    people,
    animals,
    printKey: PRINT_OPTIONS[selectedPrint].key,
  };
  const total = computeTotal(configState);

  useEffect(() => {
    if (prevTotalRef.current !== null && prevTotalRef.current !== total) {
      setPricePulse(true);
      const t = setTimeout(() => setPricePulse(false), 380);
      return () => clearTimeout(t);
    }
    prevTotalRef.current = total;
  }, [total]);

  const scrollToConfig = useCallback(() => {
    configRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    setPhotos((prev) => {
      const room = Math.max(0, 8 - prev.length);
      const incoming = Array.from(files)
        .slice(0, room)
        .map((f) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          url: URL.createObjectURL(f),
          name: f.name,
        }));
      return [...prev, ...incoming].slice(0, 8);
    });
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const handleAddToCart = () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastVisible(true);
    toastTimeoutRef.current = setTimeout(() => setToastVisible(false), 2000);
  };

  const hoverOrSelectedBg = hoveredBg !== null ? hoveredBg : selectedBg;
  const previewBg = BACKGROUNDS[hoverOrSelectedBg];

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:ital,wght@0,400;0,600;0,700;0,800;0,900;1,700&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .mk-bento {
          --mkb-cream: #FFF8F1;
          --mkb-cream-deep: #FFEFDD;
          --mkb-ink: #201233;
          --mkb-ink-soft: #4B3B63;
          --mkb-pink: #FF4D8D;
          --mkb-pink-soft: #FFD9E7;
          --mkb-blue: #4F46E5;
          --mkb-blue-soft: #E1DFFF;
          --mkb-sky: #1FB6E8;
          --mkb-sky-soft: #D3F2FF;
          --mkb-orange: #FF7A33;
          --mkb-orange-soft: #FFE3CE;
          --mkb-green: #22C55E;
          --mkb-green-soft: #D8F7E3;
          --mkb-purple: #A855F7;
          --mkb-purple-soft: #F1E1FF;
          --mkb-yellow: #FFC738;
          --mkb-yellow-soft: #FFF3D0;
          --mkb-radius: 28px;
          --mkb-font-display: 'Fredoka', system-ui, sans-serif;
          --mkb-font-body: 'Nunito', system-ui, sans-serif;
          background: var(--mkb-cream);
          color: var(--mkb-ink);
          font-family: var(--mkb-font-body);
          -webkit-font-smoothing: antialiased;
        }
        .mk-bento * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        .mk-bento .mkb-display { font-family: var(--mkb-font-display); font-weight: 600; letter-spacing: -0.01em; }

        .mkb-tile {
          border-radius: var(--mkb-radius);
          padding: 1.4rem;
          position: relative;
          overflow: hidden;
          transition: transform 320ms cubic-bezier(.34,1.56,.64,1), box-shadow 280ms ease;
          box-shadow: 0 2px 0 rgba(32,18,51,0.06);
        }
        .mkb-tile:hover { transform: translateY(-5px) rotate(-0.4deg); box-shadow: 0 18px 34px -14px rgba(32,18,51,0.32); }
        .mkb-press:active { transform: scale(0.95) !important; }

        .mkb-tile-pink   { background: var(--mkb-pink-soft);   color: var(--mkb-ink); }
        .mkb-tile-blue   { background: var(--mkb-blue);        color: #fff; }
        .mkb-tile-sky    { background: var(--mkb-sky-soft);    color: var(--mkb-ink); }
        .mkb-tile-orange { background: var(--mkb-orange-soft); color: var(--mkb-ink); }
        .mkb-tile-green  { background: var(--mkb-green-soft);  color: var(--mkb-ink); }
        .mkb-tile-purple { background: var(--mkb-purple);      color: #fff; }
        .mkb-tile-yellow { background: var(--mkb-yellow-soft); color: var(--mkb-ink); }
        .mkb-tile-ink    { background: var(--mkb-ink);         color: var(--mkb-cream); }
        .mkb-tile-white  { background: #fff;                   color: var(--mkb-ink); border: 2px solid rgba(32,18,51,0.06); }

        .mkb-selected { outline: 4px solid var(--mkb-ink); outline-offset: 3px; }
        .mkb-selected::after {
          content: '✓';
          position: absolute; top: 10px; right: 10px;
          width: 26px; height: 26px; border-radius: 999px;
          background: var(--mkb-ink); color: var(--mkb-yellow);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--mkb-font-display); font-size: 13px;
          box-shadow: 0 2px 0 rgba(0,0,0,0.25);
        }

        .mkb-round-btn {
          width: 44px; height: 44px; border-radius: 999px; border: none;
          background: var(--mkb-ink); color: #fff; font-family: var(--mkb-font-display);
          font-size: 1.5rem; line-height: 1; display: flex; align-items: center; justify-content: center;
          transition: transform 150ms ease, opacity 150ms ease;
          cursor: pointer;
        }
        .mkb-round-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .mkb-round-btn:not(:disabled):hover { transform: scale(1.08); }

        .mkb-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          font-family: var(--mkb-font-display); font-weight: 600; font-size: 1.05rem;
          padding: 0.95rem 1.8rem; border-radius: 999px; border: none; cursor: pointer;
          background: var(--mkb-ink); color: var(--mkb-yellow);
          transition: transform 220ms cubic-bezier(.34,1.56,.64,1), box-shadow 220ms ease;
          box-shadow: 0 8px 0 0 rgba(0,0,0,0.18);
        }
        .mkb-btn:hover { transform: translateY(-3px); }
        .mkb-btn:active { transform: translateY(2px) scale(0.98); box-shadow: 0 4px 0 0 rgba(0,0,0,0.18); }
        .mkb-btn.mkb-btn-light { background: #fff; color: var(--mkb-ink); }
        .mkb-btn.mkb-btn-pink { background: var(--mkb-pink); color: #fff; }

        .mkb-eyebrow {
          display: inline-flex; align-items: center; gap: 0.4rem;
          background: var(--mkb-ink); color: var(--mkb-yellow);
          font-family: var(--mkb-font-display); font-size: 0.82rem;
          padding: 0.35rem 0.9rem; border-radius: 999px; letter-spacing: 0.03em; text-transform: uppercase;
        }

        @keyframes mkb-wiggle { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(-10deg); } 75% { transform: rotate(10deg); } }
        .mkb-tile:hover .mkb-wiggle-target { animation: mkb-wiggle 480ms ease; }

        @keyframes mkb-float { 0%,100% { transform: translateY(0) rotate(var(--mkb-r,0deg)); } 50% { transform: translateY(-10px) rotate(var(--mkb-r,0deg)); } }
        .mkb-float { animation: mkb-float 4.4s ease-in-out infinite; }

        @keyframes mkb-pop { 0% { opacity: 0; transform: scale(0.94) translateY(6px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        .mkb-pop { animation: mkb-pop 520ms cubic-bezier(.34,1.56,.64,1) both; }

        @keyframes mkb-pulse { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 100% { transform: scale(1); } }
        .mkb-pulse { animation: mkb-pulse 380ms cubic-bezier(.34,1.56,.64,1); }

        @keyframes mkb-toast-in { 0% { opacity: 0; transform: translateY(16px) scale(0.92); } 60% { opacity: 1; transform: translateY(-3px) scale(1.03); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .mkb-toast { animation: mkb-toast-in 380ms cubic-bezier(.34,1.56,.64,1) both; }

        @keyframes mkb-spin { to { transform: rotate(360deg); } }
        .mkb-spin { animation: mkb-spin 22s linear infinite; }

        .mkb-faq-chev { transition: transform 260ms cubic-bezier(.4,0,.2,1); }
        .mkb-faq-open .mkb-faq-chev { transform: rotate(45deg); }
        .mkb-faq-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 320ms ease; }
        .mkb-faq-open .mkb-faq-panel { grid-template-rows: 1fr; }
        .mkb-faq-panel > div { overflow: hidden; }

        .mkb-dropzone { border: 3px dashed rgba(32,18,51,0.28); transition: background 200ms ease, border-color 200ms ease; }
        .mkb-dropzone.mkb-drag-active { background: rgba(255,122,51,0.12); border-color: var(--mkb-orange); }

        @media (prefers-reduced-motion: reduce) {
          .mk-bento *, .mk-bento *::after { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div className="mk-bento min-h-screen">
        {/* ═══ HERO ═══ */}
        <section className="relative pt-8 pb-16 overflow-hidden">
          <div className="max-w-7xl mx-auto px-5 md:px-8">
            <div className="text-sm font-extrabold text-[var(--mkb-ink-soft)] mb-6 flex items-center gap-2">
              <span className="opacity-60">{COPY.universe}</span>
              <span className="opacity-40">›</span>
              <span>{COPY.simpsonStyle}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 md:gap-5 auto-rows-[104px] grid-flow-dense">
              {/* Photo tile */}
              <div className="col-span-2 md:col-span-2 row-span-3 mkb-tile mkb-tile-white p-0 mkb-pop">
                <div className="relative w-full h-full">
                  {HERO_SLIDES.map((src, i) => (
                    <div key={src} className={`absolute inset-0 transition-opacity duration-700 ${i === activeHero ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                      <Image
                        src={src}
                        alt="Portrait cartoon personnalisé style Simpson"
                        fill
                        className="object-cover"
                        priority={i === 0}
                        sizes="(max-width: 768px) 90vw, 320px"
                      />
                    </div>
                  ))}
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                    {HERO_SLIDES.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveHero(i)}
                        aria-label={`Aperçu ${i + 1}`}
                        className="h-2 rounded-full transition-all"
                        style={{ background: i === activeHero ? "var(--mkb-pink)" : "rgba(255,255,255,0.7)", width: i === activeHero ? 20 : 8 }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Headline tile */}
              <div className="col-span-2 md:col-span-3 row-span-2 mkb-tile mkb-tile-ink flex flex-col justify-center mkb-pop">
                <h1 className="mkb-display text-[clamp(1.9rem,4.4vw,3.2rem)] leading-[0.98] mb-3">
                  {COPY.heroTitle1} <span style={{ color: "var(--mkb-yellow)" }}>{COPY.heroTitle2}</span>
                </h1>
                <p className="text-sm md:text-base font-semibold opacity-90 max-w-md">{COPY.heroSubtitle}</p>
              </div>

              {/* Rating tile */}
              <div className="col-span-1 row-span-1 mkb-tile mkb-tile-yellow flex flex-col items-center justify-center text-center mkb-pop">
                <div className="mkb-display text-2xl leading-none">{STATS.rating}/5</div>
                <div className="text-[15px] leading-none mt-1" aria-hidden="true">★★★★★</div>
              </div>

              {/* Review count tile */}
              <div className="col-span-1 row-span-1 mkb-tile mkb-tile-sky flex flex-col items-center justify-center text-center mkb-pop">
                <div className="mkb-display text-lg leading-none">{STATS.reviewCount.toLocaleString("fr-FR")}</div>
                <div className="text-[11px] font-extrabold mt-1">{COPY.verifiedReviews}</div>
              </div>

              {/* CTA tile */}
              <div className="col-span-2 md:col-span-2 row-span-1 mkb-tile mkb-tile-pink flex items-center justify-center mkb-pop">
                <button type="button" onClick={scrollToConfig} className="mkb-btn mkb-btn-light w-full justify-center">
                  {COPY.orderCta} →
                </button>
              </div>

              {/* Trust tiles */}
              <div className="col-span-1 row-span-1 mkb-tile mkb-tile-orange flex flex-col items-center justify-center text-center mkb-pop">
                <span className="text-2xl mkb-wiggle-target" aria-hidden="true">⚡</span>
                <div className="text-xs font-extrabold mt-1">{COPY.delivered48h}</div>
              </div>
              <div className="col-span-1 row-span-1 mkb-tile mkb-tile-green flex flex-col items-center justify-center text-center mkb-pop">
                <span className="text-2xl mkb-wiggle-target" aria-hidden="true">🔒</span>
                <div className="text-xs font-extrabold mt-1">{COPY.satisfiedOrRefunded}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section className="py-14">
          <div className="max-w-7xl mx-auto px-5 md:px-8">
            <div className="text-center mb-8">
              <div className="mkb-eyebrow mb-3">{COPY.howItWorks}</div>
              <h2 className="mkb-display text-[clamp(1.7rem,3.4vw,2.6rem)] leading-tight">{COPY.howItWorksTitle}</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: "📸", title: COPY.step1Title, desc: COPY.step1Desc, tone: "sky" as Tone },
                { icon: "🎨", title: COPY.step2Title, desc: COPY.step2Desc, tone: "yellow" as Tone },
                { icon: "✅", title: COPY.step3Title, desc: COPY.step3Desc, tone: "pink" as Tone },
              ].map((s, i) => (
                <div key={i} className={`mkb-tile ${toneClass(s.tone)} text-center py-8`}>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/70 flex items-center justify-center text-3xl mkb-wiggle-target">
                    {s.icon}
                  </div>
                  <h3 className="mkb-display text-xl mb-1.5">{s.title}</h3>
                  <p className="text-sm font-semibold opacity-80">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CONFIGURATOR ═══ */}
        <section ref={configRef} className="py-16">
          <div className="max-w-7xl mx-auto px-5 md:px-8">
            <div className="text-center mb-10">
              <div className="mkb-eyebrow mb-4">{COPY.configurator}</div>
              <h2 className="mkb-display text-[clamp(1.9rem,3.8vw,3.2rem)] leading-tight">{COPY.composeYourPortrait}</h2>
              <p className="font-semibold text-[var(--mkb-ink-soft)] mt-3">{COPY.guidedSteps}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-12 gap-4 md:gap-5">
              {/* Framing */}
              <div className="col-span-2 md:col-span-4 mkb-tile mkb-tile-purple">
                <h3 className="mkb-display text-lg mb-3">{COPY.framingStep}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(["portrait", "fullbody"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      aria-pressed={format === f}
                      className={`mkb-press rounded-2xl bg-white/90 text-[var(--mkb-ink)] p-3 text-center transition ${format === f ? "mkb-selected" : ""}`}
                    >
                      <div className="text-3xl mb-1">{f === "portrait" ? "👤" : "🧍"}</div>
                      <div className="mkb-display text-sm leading-tight">{f === "portrait" ? COPY.portrait : COPY.fullbody}</div>
                      <div className="text-[11px] font-bold opacity-70">{f === "portrait" ? COPY.portraitSub : COPY.fullbodySub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Who counters group */}
              <div className="col-span-2 md:col-span-8 grid grid-cols-1">
                <div className="text-xs font-extrabold uppercase tracking-wide mb-2 text-[var(--mkb-ink-soft)]">{COPY.whoOnPortrait}</div>
                <div className="grid grid-cols-2 gap-4 md:gap-5">
                  <Counter
                    label={COPY.peopleLabel}
                    icon="🧍"
                    value={people}
                    min={1}
                    max={8}
                    tone="sky"
                    hint={`+${formatEUR(PRICES.extraPerson)} ${COPY.perExtraPerson}`}
                    onChange={setPeople}
                  />
                  <Counter
                    label={COPY.animalsLabel}
                    icon="🐾"
                    value={animals}
                    min={0}
                    max={4}
                    tone="green"
                    hint={`+${formatEUR(PRICES.extraAnimal)} ${COPY.perAnimal}`}
                    onChange={setAnimals}
                  />
                </div>
              </div>

              {/* Background picker */}
              <div className="col-span-2 md:col-span-8 mkb-tile mkb-tile-white">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <h3 className="mkb-display text-lg">{COPY.decorStep}</h3>
                  <span className="text-xs font-extrabold text-[var(--mkb-ink-soft)]">{COPY.hoverToPreview}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
                  {BACKGROUNDS.map((bg, i) => (
                    <button
                      key={bg.src}
                      type="button"
                      onMouseEnter={() => setHoveredBg(i)}
                      onMouseLeave={() => setHoveredBg(null)}
                      onClick={() => setSelectedBg(i)}
                      aria-pressed={selectedBg === i}
                      className={`mkb-press relative rounded-2xl overflow-hidden text-left ${selectedBg === i ? "mkb-selected" : ""}`}
                    >
                      <div className="relative aspect-square">
                        <Image src={bg.src} alt={bg.label} fill className="object-cover" sizes="140px" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/55 text-white text-[11px] font-bold px-2 py-1 leading-tight">
                        {bg.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Background live preview */}
              <div className="col-span-2 md:col-span-4 mkb-tile mkb-tile-orange p-0 overflow-hidden">
                <div className="relative w-full h-full min-h-[220px]">
                  <Image src={previewBg.src} alt={previewBg.label} fill className="object-cover transition-all duration-300" sizes="(max-width: 768px) 90vw, 320px" />
                  <div className="absolute top-3 left-3 bg-white/90 rounded-full px-3 py-1 text-xs font-extrabold">
                    {previewBg.label}
                  </div>
                </div>
              </div>

              {/* Upload */}
              <div className="col-span-2 md:col-span-7 mkb-tile mkb-tile-yellow">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <h3 className="mkb-display text-lg">{COPY.uploadStep}</h3>
                  <span className="text-xs font-extrabold text-[var(--mkb-ink-soft)]">{COPY.uploadMax8}</span>
                </div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                  className={`mkb-dropzone rounded-2xl bg-white/70 px-5 py-7 text-center ${dragOver ? "mkb-drag-active" : ""}`}
                >
                  <div className="text-4xl mb-2">📸</div>
                  <div className="mkb-display text-lg">{COPY.dragHere}</div>
                  <div className="text-sm font-bold text-[var(--mkb-ink-soft)] mb-4">{COPY.orWord}</div>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="mkb-btn">
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
                  <div className="text-xs font-bold text-[var(--mkb-ink-soft)] mt-3">{COPY.uploadHint}</div>
                </div>
                {photos.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {photos.map((p) => (
                      <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(p.id)}
                          aria-label={`Supprimer ${p.name}`}
                          className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full font-bold text-xs leading-none shadow"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {photos.length < 8 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-xl bg-white/70 flex items-center justify-center mkb-display text-2xl"
                      >
                        +
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="col-span-2 md:col-span-5 mkb-tile mkb-tile-pink">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="mkb-display text-lg">{COPY.noteForArtist}</h3>
                  <span className="text-xs font-extrabold opacity-70">{COPY.optional}</span>
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 400))}
                  rows={5}
                  placeholder={COPY.notePlaceholder}
                  className="w-full rounded-2xl bg-white/85 px-4 py-3 text-sm font-semibold text-[var(--mkb-ink)] placeholder:text-[var(--mkb-ink-soft)] outline-none resize-none"
                />
                <div className="text-xs font-bold opacity-70 mt-1 text-right">{note.length} / 400</div>
              </div>

              {/* Print / support */}
              <div className="col-span-2 md:col-span-12 mkb-tile mkb-tile-white">
                <h3 className="mkb-display text-lg mb-3">{COPY.printSupportStep}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {PRINT_OPTIONS.map((opt, i) => {
                    const tone = TONE_CYCLE[i % TONE_CYCLE.length];
                    const price = PRICES.base + opt.addon;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setSelectedPrint(i)}
                        aria-pressed={selectedPrint === i}
                        className={`mkb-press relative rounded-2xl overflow-hidden text-left ${toneClass(tone)} ${selectedPrint === i ? "mkb-selected" : ""}`}
                      >
                        {opt.badge && (
                          <div className="absolute top-2 left-2 z-10 bg-[var(--mkb-ink)] text-[var(--mkb-yellow)] rounded-full px-2 py-0.5 text-[10px] mkb-display">
                            {opt.badge}
                          </div>
                        )}
                        <div className="relative aspect-[5/3] bg-white/60">
                          <Image src={opt.img} alt={opt.label} fill className="object-contain p-3" sizes="220px" />
                        </div>
                        <div className="px-3 py-2.5 bg-white/80">
                          <div className="mkb-display text-sm leading-tight">{opt.label}</div>
                          <div className="text-[11px] font-bold opacity-70 mb-1">{opt.sub}</div>
                          <div className="mkb-display text-base">{formatEUR(price)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary / total */}
              <div className="col-span-2 md:col-span-12 mkb-tile mkb-tile-ink">
                <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
                  <div>
                    <div className="mkb-display text-lg mb-2">{COPY.summary}</div>
                    <div className="space-y-1 text-sm font-semibold opacity-90">
                      <div className="flex justify-between gap-4">
                        <span>{format === "portrait" ? COPY.portrait : COPY.fullbody} · {PRINT_OPTIONS[selectedPrint].label}</span>
                        <span>{formatEUR(PRICES.base + PRINT_OPTIONS[selectedPrint].addon)}</span>
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
                  <div className="text-center md:text-right">
                    <div className="text-xs font-extrabold uppercase tracking-wide opacity-70 mb-1">{COPY.total}</div>
                    <div className={`mkb-display text-4xl md:text-5xl mb-3 ${pricePulse ? "mkb-pulse" : ""}`} style={{ color: "var(--mkb-yellow)" }}>
                      {formatEUR(total)}
                    </div>
                    <div className="relative inline-block">
                      <button type="button" onClick={handleAddToCart} className="mkb-btn mkb-btn-pink">
                        {COPY.addToCart} →
                      </button>
                      {toastVisible && (
                        <div className="mkb-toast absolute bottom-full left-1/2 -translate-x-1/2 mb-3 whitespace-nowrap bg-white text-[var(--mkb-ink)] text-xs font-extrabold px-3 py-2 rounded-xl shadow-lg">
                          {COPY.previewOnlyToast}
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] font-bold opacity-70 mt-3">{COPY.paymentReassurance}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-sm font-bold text-[var(--mkb-ink-soft)] text-center">
              ⏱ {COPY.estimatedDelay} : <span className="text-[var(--mkb-ink)]">{COPY.digital48h}</span> · {COPY.print57Days}
            </div>
          </div>
        </section>

        {/* ═══ GALLERY ═══ */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-5 md:px-8">
            <div className="text-center mb-10">
              <div className="mkb-eyebrow mb-4">{COPY.galleryLabel}</div>
              <h2 className="mkb-display text-[clamp(1.9rem,3.8vw,3.2rem)] leading-tight">{COPY.galleryTitle}</h2>
              <p className="font-semibold text-[var(--mkb-ink-soft)] mt-3">{COPY.gallerySub}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {GALLERY_PHOTOS.map((src, i) => {
                const tone = TONE_CYCLE[i % TONE_CYCLE.length];
                return (
                  <div key={src} className="mkb-tile p-0 overflow-hidden">
                    <div className="relative aspect-square">
                      <Image src={src} alt="Réalisation portrait cartoon Cartoonova" fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" />
                      <div
                        className={`absolute top-2 right-2 ${toneClass(tone)} rounded-full px-2 py-0.5 text-[11px] mkb-display`}
                        style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}
                      >
                        ★ {(4.7 + (i % 4) * 0.07).toFixed(1)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ REVIEWS ═══ */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-5 md:px-8">
            <div className="grid md:grid-cols-2 gap-4 mb-10">
              <div className="mkb-tile mkb-tile-purple flex flex-col justify-center">
                <div className="mkb-eyebrow mb-4 bg-white/20">{COPY.reviewsLabel}</div>
                <div className="flex items-end gap-3">
                  <div className="mkb-display text-6xl leading-none">{STATS.rating}</div>
                  <div className="text-2xl font-bold opacity-80 mb-1">/5</div>
                </div>
                <div className="text-2xl mt-2" aria-hidden="true">★★★★★</div>
                <div className="font-bold mt-3 text-sm">
                  {COPY.basedOn} {STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}
                </div>
              </div>
              <div className="mkb-tile mkb-tile-white flex flex-col justify-center gap-2">
                {STATS.distribution.map((row) => (
                  <div key={row.stars} className="flex items-center gap-3">
                    <div className="text-xs font-extrabold w-8">{row.stars} ★</div>
                    <div className="flex-1 h-3 rounded-full bg-[var(--mkb-cream-deep)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: "var(--mkb-yellow)" }} />
                    </div>
                    <div className="text-xs font-extrabold w-10 text-right">{row.pct}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {REVIEWS.map((r, i) => {
                const tone = TONE_CYCLE[i % TONE_CYCLE.length];
                return (
                  <div key={r.name} className={`mkb-tile ${toneClass(tone)}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-full bg-white/70 flex items-center justify-center mkb-display text-lg">
                        {r.name.charAt(0)}
                      </div>
                      <div>
                        <div className="mkb-display text-base leading-tight">{r.name}</div>
                        <div className="text-xs font-extrabold opacity-70">{COPY.verified}</div>
                      </div>
                    </div>
                    <div className="text-base mb-2" aria-hidden="true">★★★★★</div>
                    <p className="text-sm font-semibold leading-snug opacity-90">&ldquo;{r.text}&rdquo;</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-5 md:px-8">
            <div className="text-center mb-10">
              <div className="mkb-eyebrow mb-4">FAQ</div>
              <h2 className="mkb-display text-[clamp(1.9rem,3.8vw,3.2rem)] leading-tight">{COPY.frequentQuestions}</h2>
            </div>
            <div className="space-y-3">
              {FAQ_ITEMS.map((f, i) => {
                const tone = TONE_CYCLE[i % TONE_CYCLE.length];
                const open = openFaq === i;
                return (
                  <div key={f.q} className={`mkb-tile ${toneClass(tone)} p-0 overflow-hidden ${open ? "mkb-faq-open" : ""}`}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      className="w-full flex items-center justify-between gap-4 text-left px-5 py-5 mkb-display text-base md:text-lg"
                    >
                      <span>{f.q}</span>
                      <span className="mkb-faq-chev w-9 h-9 shrink-0 rounded-full bg-white/70 flex items-center justify-center text-xl leading-none">
                        +
                      </span>
                    </button>
                    <div className="mkb-faq-panel">
                      <div>
                        <div className="px-5 pb-5 text-sm font-semibold leading-relaxed opacity-90">{f.a}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ FINAL CTA ═══ */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-5 md:px-8">
            <div className="mkb-tile mkb-tile-ink text-center py-16 px-6 relative overflow-hidden">
              <svg className="absolute inset-0 m-auto mkb-spin opacity-10 pointer-events-none" viewBox="0 0 600 600" style={{ width: "120%", height: "120%" }}>
                <circle cx="300" cy="300" r="260" fill="none" stroke="var(--mkb-yellow)" strokeWidth="3" strokeDasharray="2 20" />
              </svg>
              <div className="relative">
                <div className="inline-block bg-white/10 mkb-display rounded-full px-4 py-1.5 text-sm mb-6">
                  +{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.satisfiedClients}
                </div>
                <h2 className="mkb-display text-[clamp(2rem,5vw,4rem)] leading-[0.98] mb-4">{COPY.ctaTitle}</h2>
                <p className="text-lg font-semibold opacity-85 mb-8">{COPY.ctaSubtitle}</p>
                <div className="flex flex-wrap justify-center gap-3 mb-9 text-sm font-extrabold">
                  {[
                    { label: COPY.pillDrawnHand, icon: "✏️" },
                    { label: COPY.pillDelivered48h, icon: "⚡" },
                    { label: COPY.pillSatisfied, icon: "🔒" },
                    { label: COPY.madeInFrance, icon: "🇫🇷" },
                  ].map((pill) => (
                    <span key={pill.label} className="bg-white/10 rounded-full px-3 py-1.5">
                      {pill.icon} {pill.label}
                    </span>
                  ))}
                </div>
                <button type="button" onClick={scrollToConfig} className="mkb-btn">
                  {COPY.orderCta} →
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <MockupSwitcher />
    </>
  );
}
