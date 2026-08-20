"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

/* ───────────────────────── Icons (inline SVG, no emoji) ───────────────────────── */

function IconCamera({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h1.6l1.1-1.6a1.5 1.5 0 0 1 1.24-.65h4.1a1.5 1.5 0 0 1 1.24.65l1.1 1.6h1.6A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
function IconBrush({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 3.5c2 0 4 2 4 4-3 0-5.5 1.5-7.5 4l-2-2c2.5-2 4-6 5.5-6Z" />
      <path d="M9 9.5 4.5 14c-.9.9-.9 2.6 0 3.5.9.9 2.6.9 3.5 0L12.5 13" />
      <path d="M4.2 19.8c1-.3 2-1 2.6-1.9" />
    </svg>
  );
}
function IconCheckBadge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 12.2 11 14l4.2-4.4" />
      <path d="M12 3.2 14 4.6l2.5-.2 1 2.3 2.1 1.3-.5 2.4 1 2.2-1.8 1.7.2 2.4-2.3.8-1.1 2.1-2.4-.4-2 1.4-2-1.4-2.4.4-1.1-2.1-2.3-.8.2-2.4-1.8-1.7 1-2.2-.5-2.4 2.1-1.3 1-2.3 2.5.2Z" />
    </svg>
  );
}
function IconUser({ className, full }: { className?: string; full?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy={full ? 6 : 9} r={full ? 2.6 : 3.6} />
      {full ? <path d="M7 21v-3.2c0-2.3 2-4.1 5-4.1s5 1.8 5 4.1V21" /> : <path d="M5.5 20c.6-3.4 3.2-5.2 6.5-5.2s5.9 1.8 6.5 5.2" />}
      {full && <path d="M9 21v-4M15 21v-4" />}
    </svg>
  );
}
function IconPaw({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <ellipse cx="12" cy="15.3" rx="4.6" ry="4" />
      <ellipse cx="6.3" cy="9.2" rx="1.7" ry="2.2" />
      <ellipse cx="10.6" cy="6.4" rx="1.7" ry="2.3" />
      <ellipse cx="15.4" cy="6.4" rx="1.7" ry="2.3" />
      <ellipse cx="17.9" cy="9.2" rx="1.7" ry="2.2" />
    </svg>
  );
}
function IconUpload({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 15V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M4.5 14v3.5A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V14" />
    </svg>
  );
}
function IconStar({ className, fill = "currentColor" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill={fill} className={className}>
      <path d="M10 1.6 12.6 7l6 .87-4.3 4.2 1 5.93L10 15.1l-5.3 2.9 1-5.93L1.4 7.87 7.4 7 10 1.6Z" />
    </svg>
  );
}
function IconClose({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/* ───────────────────────── Small building blocks ───────────────────────── */

function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="mkg-eyebrow">{children}</span>;
}

function GlassCard({ children, className = "", hoverable = false }: { children: ReactNode; className?: string; hoverable?: boolean }) {
  return <div className={`mkg-card ${hoverable ? "mkg-hoverable" : ""} ${className}`}>{children}</div>;
}

function StepCard({ n, title, extra, children }: { n: number; title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <GlassCard className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center mkg-heading text-sm text-white shrink-0" style={{ background: "linear-gradient(135deg, var(--mkg-primary), #9B6BFF)" }}>
            {n}
          </div>
          <h3 className="mkg-heading text-lg md:text-xl">{title}</h3>
        </div>
        {extra}
      </div>
      {children}
    </GlassCard>
  );
}

function Counter({ icon, label, value, min, max, hint, onChange }: { icon: ReactNode; label: string; value: number; min: number; max: number; hint: string; onChange: (v: number) => void }) {
  return (
    <div className="mkg-card p-4">
      <div className="flex items-center gap-2 mb-3 text-[var(--mkg-ink)]">
        <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--mkg-glass-strong)" }}>
          {icon}
        </span>
        <span className="mkg-heading text-sm">{label}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-11 h-11 rounded-full mkg-heading text-xl text-white disabled:opacity-30 disabled:cursor-not-allowed transition-transform active:scale-95"
          style={{ background: "linear-gradient(135deg, var(--mkg-primary), #9B6BFF)" }}
          aria-label={`Diminuer ${label}`}
        >
          −
        </button>
        <div className="mkg-heading text-3xl tabular-nums">{value}</div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-11 h-11 rounded-full mkg-heading text-xl text-white disabled:opacity-30 disabled:cursor-not-allowed transition-transform active:scale-95"
          style={{ background: "linear-gradient(135deg, var(--mkg-primary), #9B6BFF)" }}
          aria-label={`Augmenter ${label}`}
        >
          +
        </button>
      </div>
      {hint && <div className="text-[11px] font-semibold text-[var(--mkg-ink-soft)] mt-2 text-center">{hint}</div>}
    </div>
  );
}

function AnimatedTotal({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    const from = ref.current;
    const to = value;
    if (from === to) return;
    const dur = 420;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else ref.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{formatEUR(Math.round(displayed * 100) / 100)}</>;
}

/* ───────────────────────── Page ───────────────────────── */

export default function Page() {
  const [format, setFormat] = useState<Format>("portrait");
  const [people, setPeople] = useState(1);
  const [animals, setAnimals] = useState(0);
  const [selectedBg, setSelectedBg] = useState(0);
  const [hoveredBg, setHoveredBg] = useState<number | null>(null);
  const [selectedPrint, setSelectedPrint] = useState(0);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<{ url: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeHero, setActiveHero] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [pulse, setPulse] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const photosRef = useRef<{ url: string }[]>([]);
  const prevTotalRef = useRef<number | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setActiveHero((p) => (p + 1) % HERO_SLIDES.length), 3600);
    return () => clearInterval(id);
  }, []);

  const printOption = PRINT_OPTIONS[selectedPrint];
  const state: ConfiguratorState = { format, people, animals, printKey: printOption.key };
  const total = computeTotal(state);

  useEffect(() => {
    if (prevTotalRef.current !== null && prevTotalRef.current !== total) {
      setPulse(true);
      const id = setTimeout(() => setPulse(false), 650);
      prevTotalRef.current = total;
      return () => clearTimeout(id);
    }
    prevTotalRef.current = total;
  }, [total]);

  const scrollToConfig = useCallback(() => {
    configRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || !files.length) return;
    setPhotos((prev) => {
      const remaining = 8 - prev.length;
      if (remaining <= 0) return prev;
      const additions = Array.from(files)
        .slice(0, remaining)
        .map((file) => ({ url: URL.createObjectURL(file) }));
      return [...prev, ...additions];
    });
  }, []);

  const removePhoto = useCallback((i: number) => {
    setPhotos((prev) => {
      const target = prev[i];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, j) => j !== i);
    });
  }, []);

  const onAddToCart = () => {
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2000);
  };

  const previewBgIndex = hoveredBg !== null ? hoveredBg : selectedBg;
  const previewBg = BACKGROUNDS[previewBgIndex];
  const currentBg = BACKGROUNDS[selectedBg];

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .mk-glass {
          --mkg-bg-1:#DCEEFF;
          --mkg-bg-2:#E9E1FF;
          --mkg-bg-3:#FFE2F1;
          --mkg-bg-4:#FFF3DE;
          --mkg-primary:#6D5DFC;
          --mkg-primary-dark:#5747E0;
          --mkg-accent:#22C7B5;
          --mkg-coral:#FF7AA8;
          --mkg-amber:#FFB648;
          --mkg-ink:#241E3D;
          --mkg-ink-soft:#5E5782;
          --mkg-glass:rgba(255,255,255,0.55);
          --mkg-glass-strong:rgba(255,255,255,0.78);
          --mkg-glass-soft:rgba(255,255,255,0.35);
          --mkg-shadow-sm:0 8px 24px rgba(109,93,252,0.10);
          --mkg-shadow-md:0 16px 44px rgba(109,93,252,0.16);
          --mkg-shadow-lg:0 26px 70px rgba(109,93,252,0.22);
          font-family:'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
          color:var(--mkg-ink);
          min-height:100vh;
          overflow-x:hidden;
          position:relative;
          background:
            radial-gradient(circle at 8% 8%, rgba(255,255,255,0.85), transparent 38%),
            radial-gradient(circle at 92% 15%, rgba(255,209,236,0.65), transparent 42%),
            radial-gradient(circle at 85% 90%, rgba(198,229,255,0.65), transparent 45%),
            radial-gradient(circle at 10% 90%, rgba(255,238,204,0.55), transparent 40%),
            linear-gradient(135deg, var(--mkg-bg-1) 0%, var(--mkg-bg-2) 38%, var(--mkg-bg-3) 70%, var(--mkg-bg-4) 100%);
        }
        .mk-glass * { box-sizing:border-box; }
        .mkg-heading { font-family:'Outfit', system-ui, sans-serif; font-weight:700; letter-spacing:-0.02em; }
        .mkg-eyebrow { display:inline-flex; align-items:center; gap:8px; font-family:'Outfit',sans-serif; font-weight:600; font-size:0.78rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--mkg-primary-dark); background:var(--mkg-glass-strong); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); padding:8px 18px; border-radius:999px; box-shadow:var(--mkg-shadow-sm); }
        .mkg-card { background:var(--mkg-glass); backdrop-filter:blur(22px) saturate(160%); -webkit-backdrop-filter:blur(22px) saturate(160%); border-radius:28px; box-shadow:var(--mkg-shadow-sm), inset 0 1px 0 rgba(255,255,255,0.6); transition:transform 320ms cubic-bezier(.2,.8,.2,1), box-shadow 320ms ease; }
        .mkg-card.mkg-hoverable:hover { transform:translateY(-6px); box-shadow:var(--mkg-shadow-md), inset 0 1px 0 rgba(255,255,255,0.7); }
        .mkg-card-strong { background:var(--mkg-glass-strong); }
        .mkg-btn { position:relative; display:inline-flex; align-items:center; justify-content:center; gap:10px; font-family:'Outfit',sans-serif; font-weight:600; font-size:1rem; padding:1rem 2rem; border-radius:999px; border:none; cursor:pointer; color:#fff; background:linear-gradient(135deg, var(--mkg-primary), #9B6BFF); box-shadow:0 12px 28px rgba(109,93,252,0.35); transition:transform 260ms cubic-bezier(.2,.8,.2,1), box-shadow 260ms ease, opacity 260ms ease; }
        .mkg-btn:hover { transform:translateY(-3px); box-shadow:0 18px 38px rgba(109,93,252,0.42); }
        .mkg-btn:active { transform:translateY(0) scale(.98); }
        .mkg-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
        .mkg-btn-ghost { color:var(--mkg-ink); background:var(--mkg-glass-strong); box-shadow:var(--mkg-shadow-sm); }
        .mkg-btn-dark { background:linear-gradient(135deg,#2A2350,#4A3D8A); box-shadow:0 14px 32px rgba(36,30,61,0.35); }
        .mkg-tile { position:relative; text-align:left; border-radius:22px; overflow:hidden; background:var(--mkg-glass); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); box-shadow:var(--mkg-shadow-sm); border:1.5px solid transparent; transition:transform 260ms ease, box-shadow 260ms ease, border-color 260ms ease; cursor:pointer; }
        .mkg-tile:hover { transform:translateY(-4px); box-shadow:var(--mkg-shadow-md); }
        .mkg-tile.mkg-selected { border-color:var(--mkg-primary); box-shadow:0 0 0 4px rgba(109,93,252,0.18), var(--mkg-shadow-md); }
        .mkg-tile.mkg-selected::after { content:'\\2713'; position:absolute; top:10px; right:10px; width:26px; height:26px; border-radius:999px; background:var(--mkg-primary); box-shadow:0 4px 10px rgba(109,93,252,.4); color:#fff; font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; }
        .mkg-chip { display:inline-flex; align-items:center; gap:6px; font-family:'Outfit',sans-serif; font-weight:600; font-size:0.75rem; padding:6px 14px; border-radius:999px; background:var(--mkg-glass-strong); backdrop-filter:blur(12px); box-shadow:var(--mkg-shadow-sm); color:var(--mkg-ink); }
        .mkg-chip-accent { background:linear-gradient(135deg, var(--mkg-primary), #9B6BFF); color:#fff; }
        .mkg-total-chip { background:var(--mkg-glass-strong); backdrop-filter:blur(20px); border-radius:24px; box-shadow:var(--mkg-shadow-md); transition:box-shadow 400ms ease, transform 400ms ease; }
        .mkg-total-chip.mkg-pulse { animation:mkg-glow 650ms ease; }
        @keyframes mkg-glow { 0%{box-shadow:var(--mkg-shadow-md);} 40%{box-shadow:0 0 0 10px rgba(109,93,252,0.16), var(--mkg-shadow-lg); transform:scale(1.015);} 100%{box-shadow:var(--mkg-shadow-md); transform:scale(1);} }
        @keyframes mkg-float { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-14px);} }
        .mkg-floaty { animation:mkg-float 5.5s ease-in-out infinite; }
        @keyframes mkg-fade-up { from{opacity:0; transform:translateY(16px);} to{opacity:1; transform:translateY(0);} }
        .mkg-fade-up { animation:mkg-fade-up 700ms cubic-bezier(.2,.8,.2,1) both; }
        @keyframes mkg-toast-in { 0%{opacity:0; transform:translate(-50%, 16px) scale(.94);} 100%{opacity:1; transform:translate(-50%, 0) scale(1);} }
        .mkg-toast { animation:mkg-toast-in 320ms cubic-bezier(.2,.8,.3,1.1) both; }
        .mkg-faq-panel { display:grid; grid-template-rows:0fr; transition:grid-template-rows 340ms ease; }
        .mkg-faq-open .mkg-faq-panel { grid-template-rows:1fr; }
        .mkg-faq-panel > div { overflow:hidden; }
        .mkg-faq-icon { transition:transform 280ms ease; }
        .mkg-faq-open .mkg-faq-icon { transform:rotate(45deg); }
        .mkg-gallery-img { filter:saturate(0.92) blur(2px); transform:scale(1.03); transition:filter 420ms ease, transform 420ms ease; }
        .mkg-gallery-tile:hover .mkg-gallery-img { filter:saturate(1.05) blur(0px); transform:scale(1.07); }
        .mkg-gallery-overlay { opacity:0; transform:translateY(8px); transition:opacity 320ms ease, transform 320ms ease; }
        .mkg-gallery-tile:hover .mkg-gallery-overlay { opacity:1; transform:translateY(0); }
        .mkg-dropzone { border:2px dashed rgba(109,93,252,0.35); border-radius:26px; background:var(--mkg-glass-soft); transition:background 260ms ease, border-color 260ms ease; }
        .mkg-dropzone.mkg-drop-active { background:rgba(109,93,252,0.14); border-color:var(--mkg-primary); }
        .mk-glass button:focus-visible, .mk-glass a:focus-visible, .mk-glass input:focus-visible, .mk-glass textarea:focus-visible { outline:3px solid var(--mkg-primary); outline-offset:2px; }
        @media (prefers-reduced-motion: reduce) {
          .mk-glass, .mk-glass * { animation-duration:0.001ms !important; animation-iteration-count:1 !important; transition-duration:0.001ms !important; }
        }
      `}</style>

      <div className="mk-glass">
        {/* ═══ HERO ═══ */}
        <section className="relative pt-10 pb-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-xs font-semibold text-[var(--mkg-ink-soft)] mb-6 flex items-center gap-2">
              <span className="opacity-70">{COPY.universe}</span>
              <span className="opacity-40">/</span>
              <span>{COPY.simpsonStyle}</span>
            </div>

            <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center">
              <GlassCard className="p-7 md:p-10 mkg-fade-up">
                <Eyebrow>{COPY.handDrawn}</Eyebrow>
                <h1 className="mkg-heading text-[clamp(2.2rem,5vw,4rem)] leading-[1.03] mt-5 mb-4">
                  {COPY.heroTitle1}{" "}
                  <span style={{ background: "linear-gradient(135deg, var(--mkg-primary), var(--mkg-coral))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                    {COPY.heroTitle2}
                  </span>
                </h1>
                <p className="text-base md:text-lg text-[var(--mkg-ink-soft)] font-medium mb-8 max-w-lg">{COPY.heroSubtitle}</p>

                <div className="flex flex-wrap items-center gap-4 mb-6">
                  <button type="button" onClick={scrollToConfig} className="mkg-btn">
                    {COPY.orderCta}
                    <IconArrowRight className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-3">
                      {GALLERY_PHOTOS.slice(0, 4).map((src, i) => (
                        <div key={i} className="w-9 h-9 rounded-full overflow-hidden relative" style={{ boxShadow: "0 0 0 2.5px var(--mkg-glass-strong)" }}>
                          <Image src={src} alt="" fill className="object-cover" sizes="36px" />
                        </div>
                      ))}
                    </div>
                    <div className="leading-tight">
                      <div className="flex text-[var(--mkg-amber)] gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <IconStar key={i} className="w-3.5 h-3.5" />
                        ))}
                      </div>
                      <div className="text-xs font-semibold text-[var(--mkg-ink-soft)]">
                        {STATS.rating}/5 · {STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="mkg-chip">{COPY.delivered48h}</span>
                  <span className="mkg-chip">{COPY.satisfiedOrRefunded}</span>
                  <span className="mkg-chip">{COPY.freeRevisions}</span>
                </div>
              </GlassCard>

              <div className="relative h-[420px] md:h-[540px]">
                <div className="absolute inset-6 rounded-[36px] overflow-hidden opacity-70 pointer-events-none" aria-hidden>
                  <Image src={HERO_SLIDES[0]} alt="" fill className="object-cover" style={{ filter: "blur(38px) saturate(140%)" }} sizes="600px" />
                </div>

                <GlassCard className="absolute inset-0 overflow-hidden mkg-fade-up" hoverable>
                  <div className="relative w-full h-full">
                    {HERO_SLIDES.map((src, i) => (
                      <div key={i} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: i === activeHero ? 1 : 0, pointerEvents: i === activeHero ? "auto" : "none" }}>
                        <Image src={src} alt="Portrait Simpson personnalisé, exemple de réalisation" fill className="object-cover" priority={i === 0} sizes="(max-width: 1024px) 92vw, 46vw" />
                      </div>
                    ))}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
                      {HERO_SLIDES.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveHero(i)}
                          aria-label={`Illustration ${i + 1}`}
                          className="h-2 rounded-full transition-all"
                          style={{ background: i === activeHero ? "var(--mkg-primary)" : "rgba(255,255,255,0.7)", width: i === activeHero ? 20 : 8 }}
                        />
                      ))}
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="absolute -bottom-6 -left-6 px-4 py-3 max-w-[210px] mkg-floaty hidden sm:block">
                  <div className="flex text-[var(--mkg-amber)] gap-0.5 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <IconStar key={i} className="w-3.5 h-3.5" />
                    ))}
                  </div>
                  <div className="text-sm font-semibold leading-snug text-[var(--mkg-ink)]">&ldquo;{REVIEWS[0].text}&rdquo;</div>
                  <div className="text-xs text-[var(--mkg-ink-soft)] mt-1">— {REVIEWS[0].name}</div>
                </GlassCard>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section className="py-14 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <Eyebrow>{COPY.howItWorks}</Eyebrow>
              <h2 className="mkg-heading text-[clamp(1.7rem,3.2vw,2.6rem)] leading-tight mt-4">{COPY.howItWorksTitle}</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: <IconCamera className="w-7 h-7" />, title: COPY.step1Title, desc: COPY.step1Desc },
                { icon: <IconBrush className="w-7 h-7" />, title: COPY.step2Title, desc: COPY.step2Desc },
                { icon: <IconCheckBadge className="w-7 h-7" />, title: COPY.step3Title, desc: COPY.step3Desc },
              ].map((s, i) => (
                <GlassCard key={i} className="p-7 text-center" hoverable>
                  <div
                    className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-[var(--mkg-primary-dark)]"
                    style={{ background: "linear-gradient(135deg, rgba(109,93,252,0.16), rgba(255,122,168,0.16))" }}
                  >
                    {s.icon}
                  </div>
                  <h3 className="mkg-heading text-lg mb-1.5">{s.title}</h3>
                  <p className="text-sm text-[var(--mkg-ink-soft)] font-medium">{s.desc}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CONFIGURATOR ═══ */}
        <section ref={configRef} className="py-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <Eyebrow>{COPY.configurator}</Eyebrow>
              <h2 className="mkg-heading text-[clamp(1.9rem,3.6vw,3.2rem)] leading-tight mt-4">{COPY.composeYourPortrait}</h2>
              <p className="text-[var(--mkg-ink-soft)] font-medium mt-3">{COPY.guidedSteps}</p>
            </div>

            <div className="grid lg:grid-cols-[1fr_1.05fr] gap-8">
              {/* LIVE PREVIEW */}
              <div className="hidden md:block lg:sticky lg:top-6 lg:self-start">
                <GlassCard className="overflow-hidden">
                  <div className="relative aspect-[4/5]">
                    <Image src={previewBg.src} alt={previewBg.label} fill className="object-cover transition-all duration-300" sizes="(max-width: 1024px) 92vw, 520px" />
                    <div className="absolute top-3 left-3 mkg-chip mkg-chip-accent">{previewBg.label}</div>
                  </div>
                  <div className="p-4 flex flex-wrap gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.5)" }}>
                    <span className="mkg-chip">{format === "portrait" ? COPY.portrait : COPY.fullbody}</span>
                    <span className="mkg-chip">
                      {people} {people > 1 ? COPY.peoplePlural : COPY.peopleSingular}
                    </span>
                    {animals > 0 && (
                      <span className="mkg-chip">
                        {animals} {animals > 1 ? COPY.animalsPlural : COPY.animalsSingular}
                      </span>
                    )}
                    <span className="mkg-chip">{currentBg.label}</span>
                    <span className="mkg-chip mkg-chip-accent">{printOption.label}</span>
                  </div>
                </GlassCard>
                <div className="mt-4 text-sm font-semibold text-[var(--mkg-ink-soft)] text-center">
                  {COPY.estimatedDelay} : <span className="text-[var(--mkg-ink)]">{COPY.digital48h}</span> · {COPY.print57Days}
                </div>
              </div>

              {/* STEPS */}
              <div className="space-y-6">
                <StepCard n={1} title={COPY.framingStep}>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { key: "portrait" as Format, label: COPY.portrait, sub: COPY.portraitSub, full: false },
                      { key: "fullbody" as Format, label: COPY.fullbody, sub: COPY.fullbodySub, full: true },
                    ]).map((f) => (
                      <button key={f.key} type="button" onClick={() => setFormat(f.key)} className={`mkg-tile ${format === f.key ? "mkg-selected" : ""}`}>
                        <div className="aspect-[5/3] flex items-center justify-center text-[var(--mkg-primary-dark)]" style={{ background: "linear-gradient(135deg, rgba(109,93,252,0.10), rgba(255,122,168,0.12))" }}>
                          <IconUser full={f.full} className="w-10 h-10" />
                        </div>
                        <div className="px-3.5 py-3">
                          <div className="mkg-heading text-sm">{f.label}</div>
                          <div className="text-xs font-medium text-[var(--mkg-ink-soft)]">{f.sub}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </StepCard>

                <StepCard n={2} title={COPY.whoOnPortrait}>
                  <div className="grid grid-cols-2 gap-3">
                    <Counter
                      icon={<IconUser className="w-4 h-4" />}
                      label={COPY.peopleLabel}
                      value={people}
                      min={1}
                      max={8}
                      hint={`+${formatEUR(PRICES.extraPerson)} ${COPY.perExtraPerson}`}
                      onChange={setPeople}
                    />
                    <Counter
                      icon={<IconPaw className="w-4 h-4" />}
                      label={COPY.animalsLabel}
                      value={animals}
                      min={0}
                      max={4}
                      hint={`+${formatEUR(PRICES.extraAnimal)} ${COPY.perAnimal}`}
                      onChange={setAnimals}
                    />
                  </div>
                </StepCard>

                <StepCard n={3} title={COPY.decorStep} extra={<span className="text-xs font-semibold text-[var(--mkg-ink-soft)]">{COPY.hoverToPreview}</span>}>
                  <div className="grid grid-cols-3 gap-3">
                    {BACKGROUNDS.map((bg, i) => (
                      <button
                        key={bg.src}
                        type="button"
                        onMouseEnter={() => setHoveredBg(i)}
                        onMouseLeave={() => setHoveredBg(null)}
                        onClick={() => setSelectedBg(i)}
                        className={`mkg-tile ${selectedBg === i ? "mkg-selected" : ""}`}
                      >
                        <div className="aspect-square relative">
                          <Image src={bg.src} alt={bg.label} fill className="object-cover" sizes="140px" />
                        </div>
                        <div className="px-2 py-1.5">
                          <div className="mkg-heading text-[11px] leading-tight">{bg.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </StepCard>

                <StepCard n={4} title={COPY.uploadStep} extra={<span className="text-xs font-semibold text-[var(--mkg-ink-soft)]">{COPY.uploadMax8}</span>}>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleFiles(e.dataTransfer.files);
                    }}
                    className={`mkg-dropzone px-5 py-8 text-center ${dragOver ? "mkg-drop-active" : ""}`}
                  >
                    <IconUpload className="w-9 h-9 mx-auto mb-2 text-[var(--mkg-primary)]" />
                    <div className="mkg-heading text-base">{COPY.dragHere}</div>
                    <div className="text-sm font-semibold text-[var(--mkg-ink-soft)] mb-4">{COPY.orWord}</div>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="mkg-btn mkg-btn-ghost">
                      {COPY.choosePhoto}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleFiles(e.target.files)}
                      className="hidden"
                    />
                    <div className="text-xs text-[var(--mkg-ink-soft)] font-medium mt-3">{COPY.uploadHint}</div>
                  </div>
                  {photos.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {photos.map((p, i) => (
                        <div key={p.url} className="relative aspect-square rounded-2xl overflow-hidden" style={{ boxShadow: "var(--mkg-shadow-sm)" }}>
                          <Image src={p.url} alt={`Photo envoyée ${i + 1}`} fill className="object-cover" sizes="100px" unoptimized />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            aria-label="Retirer la photo"
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center"
                          >
                            <IconClose className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {photos.length < 8 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square rounded-2xl flex items-center justify-center mkg-heading text-2xl text-[var(--mkg-primary)]"
                          style={{ background: "var(--mkg-glass-soft)" }}
                        >
                          +
                        </button>
                      )}
                    </div>
                  )}
                </StepCard>

                <StepCard n={5} title={COPY.noteForArtist} extra={<span className="text-xs font-semibold text-[var(--mkg-ink-soft)]">{COPY.optional}</span>}>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 400))}
                    rows={4}
                    className="w-full rounded-2xl px-4 py-3 text-sm font-medium outline-none resize-none"
                    style={{ background: "var(--mkg-glass-strong)", color: "var(--mkg-ink)" }}
                    placeholder={COPY.notePlaceholder}
                  />
                  <div className="text-xs text-[var(--mkg-ink-soft)] font-semibold mt-1 text-right">{note.length} / 400</div>
                </StepCard>

                <StepCard n={6} title={COPY.printSupportStep}>
                  <div className="grid grid-cols-2 gap-3">
                    {PRINT_OPTIONS.map((opt, i) => (
                      <button key={opt.key} type="button" onClick={() => setSelectedPrint(i)} className={`mkg-tile ${selectedPrint === i ? "mkg-selected" : ""}`}>
                        {opt.badge && (
                          <div className="absolute top-2 left-2 mkg-chip mkg-chip-accent z-10" style={{ fontSize: "9px", padding: "4px 10px" }}>
                            {opt.badge}
                          </div>
                        )}
                        <div className="aspect-[5/3] relative p-3" style={{ background: "linear-gradient(135deg, rgba(109,93,252,0.08), rgba(255,182,72,0.12))" }}>
                          <Image src={opt.img} alt={opt.label} fill className="object-contain p-3" sizes="240px" />
                        </div>
                        <div className="px-3.5 py-3 flex items-center justify-between gap-2">
                          <div>
                            <div className="mkg-heading text-sm leading-tight">{opt.label}</div>
                            <div className="text-[11px] text-[var(--mkg-ink-soft)] font-medium">{opt.sub}</div>
                          </div>
                          <div className="mkg-heading text-sm whitespace-nowrap">{formatEUR(PRICES.base + opt.addon)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </StepCard>

                {/* SUMMARY */}
                <GlassCard className="p-6">
                  <div className="mkg-heading text-lg mb-3">{COPY.summary}</div>
                  <div className="space-y-2 text-sm font-medium">
                    <div className="flex justify-between">
                      <span>
                        {format === "fullbody" ? COPY.fullbody : COPY.portrait} · {printOption.label}
                      </span>
                      <span>{formatEUR(PRICES.base + printOption.addon)}</span>
                    </div>
                    {format === "fullbody" && (
                      <div className="flex justify-between text-[var(--mkg-ink-soft)]">
                        <span>+ {COPY.fullbody}</span>
                        <span>+{formatEUR(PRICES.fullbodyExtra)}</span>
                      </div>
                    )}
                    {people > 1 && (
                      <div className="flex justify-between text-[var(--mkg-ink-soft)]">
                        <span>
                          +{people - 1} {COPY.peoplePlural}
                        </span>
                        <span>+{formatEUR((people - 1) * PRICES.extraPerson)}</span>
                      </div>
                    )}
                    {animals > 0 && (
                      <div className="flex justify-between text-[var(--mkg-ink-soft)]">
                        <span>
                          +{animals} {animals > 1 ? COPY.animalsPlural : COPY.animalsSingular}
                        </span>
                        <span>+{formatEUR(animals * PRICES.extraAnimal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[var(--mkg-ink-soft)]">
                      <span>{COPY.revisionsIncluded}</span>
                      <span>{COPY.included}</span>
                    </div>
                    <div className="my-2" style={{ borderTop: "1px solid rgba(109,93,252,0.16)" }} />
                    <div className="flex items-center justify-between pt-1">
                      <span className="mkg-heading text-base">{COPY.total}</span>
                      <span className={`mkg-total-chip px-4 py-2 mkg-heading text-xl ${pulse ? "mkg-pulse" : ""}`}>
                        <AnimatedTotal value={total} />
                      </span>
                    </div>
                  </div>

                  <div className="relative mt-4">
                    <button type="button" onClick={onAddToCart} className="mkg-btn w-full">
                      {COPY.addToCart} · <AnimatedTotal value={total} />
                      <IconArrowRight className="w-5 h-5" />
                    </button>
                    {toastVisible && (
                      <div className="mkg-toast absolute left-1/2 -translate-x-1/2 -top-14 mkg-chip mkg-chip-accent whitespace-nowrap px-4 py-2.5 shadow-lg z-20">
                        {COPY.previewOnlyToast}
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-[var(--mkg-ink-soft)] text-center mt-3">{COPY.paymentReassurance}</div>
                </GlassCard>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ GALLERY ═══ */}
        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <Eyebrow>{COPY.galleryLabel}</Eyebrow>
              <h2 className="mkg-heading text-[clamp(1.9rem,3.6vw,3.2rem)] leading-tight mt-4">{COPY.galleryTitle}</h2>
              <p className="text-[var(--mkg-ink-soft)] font-medium mt-3">{COPY.gallerySub}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {GALLERY_PHOTOS.map((src, i) => {
                const review = REVIEWS[i % REVIEWS.length];
                return (
                  <GlassCard key={src} className="mkg-gallery-tile overflow-hidden relative" hoverable>
                    <div className="relative aspect-square">
                      <Image src={src} alt={`Réalisation Cartoonova ${i + 1}`} fill className="object-cover mkg-gallery-img" sizes="(max-width: 768px) 50vw, 25vw" />
                      <div className="mkg-gallery-overlay absolute inset-x-0 bottom-0 p-3">
                        <div className="rounded-2xl px-3 py-2.5" style={{ background: "var(--mkg-glass-strong)", backdropFilter: "blur(14px)" }}>
                          <div className="text-[11px] font-semibold leading-snug text-[var(--mkg-ink)] line-clamp-2">&ldquo;{review.text}&rdquo;</div>
                          <div className="text-[10px] text-[var(--mkg-ink-soft)] mt-1">— {review.name}</div>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ REVIEWS ═══ */}
        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto">
            <GlassCard className="p-7 md:p-10 mb-8">
              <div className="grid md:grid-cols-[auto_1fr] gap-10 items-center">
                <div className="text-center md:text-left">
                  <Eyebrow>{COPY.reviewsLabel}</Eyebrow>
                  <div className="flex items-end gap-3 justify-center md:justify-start mt-4">
                    <div className="mkg-heading text-[5rem] leading-[0.85]">{STATS.rating}</div>
                    <div className="text-2xl mkg-heading text-[var(--mkg-ink-soft)] mb-2">/5</div>
                  </div>
                  <div className="flex text-[var(--mkg-amber)] gap-1 mt-2 justify-center md:justify-start">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <IconStar key={i} className="w-5 h-5" />
                    ))}
                  </div>
                  <div className="font-semibold mt-2 text-sm text-[var(--mkg-ink-soft)]">
                    {COPY.basedOn} <span className="mkg-chip mkg-chip-accent ml-1">{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}</span>
                  </div>
                </div>
                <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-2 items-center max-w-md mx-auto md:mx-0 w-full">
                  {STATS.distribution.map((r) => (
                    <div key={r.stars} className="contents">
                      <div className="text-sm font-semibold">{r.stars} ★</div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(109,93,252,0.12)" }}>
                        <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: "linear-gradient(90deg, var(--mkg-primary), var(--mkg-coral))" }} />
                      </div>
                      <div className="text-sm font-semibold text-right w-10">{r.pct}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {REVIEWS.map((r, i) => (
                <GlassCard key={r.name} className="p-6" hoverable>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center mkg-heading text-base text-white shrink-0"
                      style={{ background: ["#6D5DFC", "#FF7AA8", "#22C7B5", "#FFB648", "#9B6BFF", "#5747E0"][i % 6] }}
                    >
                      {r.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="mkg-heading text-sm leading-tight">{r.name}</div>
                      <div className="text-xs text-[var(--mkg-ink-soft)] font-medium">{COPY.verified}</div>
                    </div>
                  </div>
                  <div className="flex text-[var(--mkg-amber)] gap-0.5 mb-2">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <IconStar key={si} className="w-3.5 h-3.5" />
                    ))}
                  </div>
                  <p className="text-[var(--mkg-ink-soft)] font-medium text-[14px] leading-snug">&ldquo;{r.text}&rdquo;</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <Eyebrow>FAQ</Eyebrow>
              <h2 className="mkg-heading text-[clamp(1.9rem,3.6vw,3.2rem)] leading-tight mt-4">{COPY.frequentQuestions}</h2>
            </div>
            <div className="space-y-3">
              {FAQ_ITEMS.map((f, i) => (
                <GlassCard key={f.q} className={`overflow-hidden ${openFaq === i ? "mkg-faq-open" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-5 mkg-heading text-base md:text-lg"
                    aria-expanded={openFaq === i}
                  >
                    <span>{f.q}</span>
                    <span
                      className="mkg-faq-icon w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-lg leading-none text-white"
                      style={{ background: "linear-gradient(135deg, var(--mkg-primary), #9B6BFF)" }}
                    >
                      +
                    </span>
                  </button>
                  <div className="mkg-faq-panel">
                    <div>
                      <div className="px-5 pb-5 text-[var(--mkg-ink-soft)] font-medium leading-relaxed text-sm">{f.a}</div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FINAL CTA ═══ */}
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <GlassCard className="p-10 md:p-16 text-center relative overflow-hidden">
              <div
                className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-40 pointer-events-none"
                style={{ background: "radial-gradient(circle, var(--mkg-primary), transparent 70%)" }}
                aria-hidden
              />
              <div
                className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full opacity-30 pointer-events-none"
                style={{ background: "radial-gradient(circle, var(--mkg-coral), transparent 70%)" }}
                aria-hidden
              />
              <div className="relative">
                <div className="mkg-chip mkg-chip-accent mb-6 inline-flex">
                  {STATS.reviewCount.toLocaleString("fr-FR")}+ {COPY.satisfiedClients}
                </div>
                <h2 className="mkg-heading text-[clamp(2rem,5vw,3.6rem)] leading-[1.03] mb-4">{COPY.ctaTitle}</h2>
                <p className="text-lg font-medium mb-8 text-[var(--mkg-ink-soft)] max-w-xl mx-auto">{COPY.ctaSubtitle}</p>
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                  <span className="mkg-chip">{COPY.pillDrawnHand}</span>
                  <span className="mkg-chip">{COPY.pillDelivered48h}</span>
                  <span className="mkg-chip">{COPY.pillSatisfied}</span>
                  <span className="mkg-chip">{COPY.madeInFrance}</span>
                </div>
                <button type="button" onClick={scrollToConfig} className="mkg-btn mkg-btn-dark">
                  {COPY.orderCta}
                  <IconArrowRight className="w-5 h-5" />
                </button>
                <div className="text-sm font-semibold text-[var(--mkg-ink-soft)] mt-4">{COPY.paymentReassurance}</div>
              </div>
            </GlassCard>
          </div>
        </section>
      </div>

      <MockupSwitcher />
    </>
  );
}
