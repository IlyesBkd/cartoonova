"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import MockupSwitcher from "../_shared/MockupSwitcher";
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

const GALLERY_LAYOUT: { col: 1 | 2; row: 1 | 2 }[] = [
  { col: 2, row: 2 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 1, row: 2 },
  { col: 1, row: 1 },
  { col: 2, row: 1 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 1, row: 2 },
  { col: 1, row: 1 },
  { col: 2, row: 1 },
  { col: 1, row: 1 },
];

function Stepper({
  label,
  value,
  min,
  max,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  hint: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mke-stepper">
      <div className="mke-stepper-label">{label}</div>
      <div className="mke-stepper-controls">
        <button
          type="button"
          className="mke-stepper-btn"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`- ${label}`}
        >
          −
        </button>
        <span className="mke-stepper-value">{value}</span>
        <button
          type="button"
          className="mke-stepper-btn"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`+ ${label}`}
        >
          +
        </button>
      </div>
      <div className="mke-stepper-hint">{hint}</div>
    </div>
  );
}

export default function Page() {
  const [format, setFormat] = useState<Format>("portrait");
  const [people, setPeople] = useState(1);
  const [animals, setAnimals] = useState(0);
  const [selectedBg, setSelectedBg] = useState(0);
  const [selectedPrint, setSelectedPrint] = useState(0);
  const [note, setNote] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [toastVisible, setToastVisible] = useState(false);

  const previewsRef = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const scrollToConfig = useCallback(() => {
    configRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || !files.length) return;
      setPreviews((prev) => {
        const room = Math.max(0, 8 - prev.length);
        if (room <= 0) return prev;
        const additions = Array.from(files)
          .slice(0, room)
          .map((f) => URL.createObjectURL(f));
        return [...prev, ...additions];
      });
    },
    []
  );

  const removePreview = useCallback((index: number) => {
    setPreviews((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const printKey: PrintKey = PRINT_OPTIONS[selectedPrint].key;
  const configuratorState: ConfiguratorState = { format, people, animals, printKey };
  const total = computeTotal(configuratorState);
  const selectedPrintOption = PRINT_OPTIONS[selectedPrint];
  const selectedBackground = BACKGROUNDS[selectedBg];
  const heroPhoto = HERO_SLIDES[0];

  const onAddToCart = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2000);
  };

  return (
    <div className="mk-editorial">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Libre+Bodoni:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Public+Sans:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .mk-editorial {
          --mke-paper: #FAFAF9;
          --mke-paper-alt: #F2F0EC;
          --mke-ink: #1C1917;
          --mke-ink-soft: #44403C;
          --mke-muted: #78716C;
          --mke-accent: #A16207;
          --mke-border: #D6D3D1;
          background: var(--mke-paper);
          color: var(--mke-ink);
          font-family: 'Public Sans', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .mk-editorial .mke-serif { font-family: 'Libre Bodoni', Georgia, serif; }
        .mke-eyebrow {
          font-family: 'Public Sans', system-ui, sans-serif;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--mke-muted);
        }
        @keyframes mke-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .mke-fade { animation: mke-fade-in 700ms cubic-bezier(.2,.7,.2,1) both; }
        .mke-rule { border: none; border-top: 1px solid var(--mke-border); margin: 0; }
        .mke-container { max-width: 1180px; margin: 0 auto; padding: 0 clamp(1.25rem, 4vw, 3rem); }
        .mke-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          background: var(--mke-ink);
          color: var(--mke-paper);
          font-family: 'Public Sans', system-ui, sans-serif;
          font-weight: 600;
          font-size: 0.95rem;
          letter-spacing: 0.02em;
          padding: 1rem 1.9rem;
          border: 1px solid var(--mke-ink);
          border-radius: 2px;
          cursor: pointer;
          transition: background 200ms ease, color 200ms ease, transform 150ms ease;
        }
        .mke-btn:hover { background: var(--mke-accent); border-color: var(--mke-accent); }
        .mke-btn:active { transform: translateY(1px); }
        .mke-btn-ghost {
          background: transparent;
          color: var(--mke-ink);
          border: 1px solid var(--mke-ink);
        }
        .mke-btn-ghost:hover { background: var(--mke-ink); color: var(--mke-paper); }
        .mke-hero-grid {
          display: grid;
          grid-template-columns: 1fr;
          align-items: stretch;
        }
        @media (min-width: 900px) {
          .mke-hero-grid { grid-template-columns: 0.92fr 1fr; min-height: 86vh; }
        }
        .mke-hero-photo { position: relative; min-height: 46vh; }
        @media (min-width: 900px) { .mke-hero-photo { min-height: 100%; } }
        .mke-hero-text {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: clamp(2.5rem, 6vw, 5rem) clamp(1.25rem, 5vw, 4rem);
        }
        .mke-hero-title {
          font-size: clamp(2.6rem, 5.4vw, 4.6rem);
          line-height: 1.02;
          font-weight: 500;
          margin: 0 0 1.4rem;
        }
        .mke-hero-title em {
          font-style: italic;
          color: var(--mke-accent);
        }
        .mke-hero-subtitle {
          font-size: 1.05rem;
          line-height: 1.65;
          color: var(--mke-ink-soft);
          max-width: 34rem;
          margin: 0 0 2.2rem;
        }
        .mke-rating-line {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-top: 1.6rem;
          font-size: 0.92rem;
          color: var(--mke-ink-soft);
        }
        .mke-stars { color: var(--mke-accent); letter-spacing: 0.05em; }
        .mke-section { padding: clamp(3.5rem, 8vw, 6rem) 0; }
        .mke-section-head { margin-bottom: clamp(2rem, 5vw, 3.2rem); }
        .mke-section-title {
          font-size: clamp(1.9rem, 3.4vw, 2.9rem);
          font-weight: 500;
          line-height: 1.1;
          margin: 0.5rem 0 0;
        }
        .mke-section-sub {
          color: var(--mke-ink-soft);
          font-size: 1rem;
          margin-top: 0.6rem;
          max-width: 40rem;
        }
        .mke-step-row {
          display: grid;
          grid-template-columns: 4.5rem 1fr;
          gap: 1.5rem;
          padding: 2rem 0;
          align-items: baseline;
        }
        .mke-step-num {
          font-size: 1.1rem;
          color: var(--mke-muted);
          font-variant-numeric: tabular-nums;
        }
        .mke-step-title { font-size: 1.35rem; font-weight: 600; margin: 0 0 0.4rem; }
        .mke-step-desc { color: var(--mke-ink-soft); margin: 0; max-width: 34rem; }

        .mke-config-layout { display: grid; grid-template-columns: 1fr; gap: 3rem; }
        @media (min-width: 1000px) { .mke-config-layout { grid-template-columns: 1fr 1.15fr; } }
        .mke-preview-frame {
          position: relative;
          aspect-ratio: 4 / 5;
          overflow: hidden;
          background: var(--mke-paper-alt);
        }
        @media (min-width: 1000px) { .mke-preview-frame { position: sticky; top: 2rem; } }
        .mke-preview-tag {
          position: absolute;
          top: 1rem;
          left: 1rem;
          background: rgba(28,25,23,0.82);
          color: var(--mke-paper);
          font-size: 0.68rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 0.4rem 0.7rem;
        }

        .mke-config-row { padding: 2.1rem 0; }
        .mke-config-row-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.3rem;
        }
        .mke-config-row-title { font-size: 1.05rem; font-weight: 600; }
        .mke-config-row-note { font-size: 0.82rem; color: var(--mke-muted); }

        .mke-format-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--mke-border); border: 1px solid var(--mke-border); }
        .mke-format-tile {
          background: var(--mke-paper);
          padding: 1.4rem 1.2rem;
          text-align: left;
          cursor: pointer;
          border: none;
          transition: background 180ms ease;
        }
        .mke-format-tile:hover { background: var(--mke-paper-alt); }
        .mke-format-tile[data-active="true"] { background: var(--mke-ink); color: var(--mke-paper); }
        .mke-format-tile-label { font-size: 1.05rem; font-weight: 600; margin-bottom: 0.2rem; }
        .mke-format-tile-sub { font-size: 0.82rem; opacity: 0.75; }

        .mke-stepper-group { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; }
        .mke-stepper-label { font-size: 0.92rem; font-weight: 600; margin-bottom: 0.8rem; }
        .mke-stepper-controls { display: flex; align-items: center; gap: 1rem; }
        .mke-stepper-btn {
          width: 2.5rem; height: 2.5rem;
          border: 1px solid var(--mke-ink);
          background: transparent;
          font-size: 1.2rem;
          cursor: pointer;
          transition: background 150ms ease, color 150ms ease;
        }
        .mke-stepper-btn:hover:not(:disabled) { background: var(--mke-ink); color: var(--mke-paper); }
        .mke-stepper-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .mke-stepper-value { font-size: 1.5rem; font-variant-numeric: tabular-nums; min-width: 2ch; text-align: center; }
        .mke-stepper-hint { font-size: 0.78rem; color: var(--mke-muted); margin-top: 0.7rem; }

        .mke-bg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.9rem; }
        @media (min-width: 640px) { .mke-bg-grid { grid-template-columns: repeat(5, 1fr); } }
        .mke-bg-tile { cursor: pointer; border: none; background: none; padding: 0; text-align: left; }
        .mke-bg-thumb { position: relative; aspect-ratio: 1; overflow: hidden; outline: 1px solid var(--mke-border); outline-offset: -1px; }
        .mke-bg-tile[data-active="true"] .mke-bg-thumb { outline: 2px solid var(--mke-ink); outline-offset: -2px; }
        .mke-bg-label {
          font-size: 0.66rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-top: 0.5rem;
          color: var(--mke-ink-soft);
        }
        .mke-bg-tile[data-active="true"] .mke-bg-label { color: var(--mke-ink); font-weight: 600; }

        .mke-dropzone {
          border: 1px dashed var(--mke-border);
          padding: 2.6rem 1.5rem;
          text-align: center;
          transition: border-color 180ms ease, background 180ms ease;
        }
        .mke-dropzone[data-drag="true"] { border-color: var(--mke-accent); background: var(--mke-paper-alt); }
        .mke-dropzone-title { font-size: 1.05rem; font-weight: 600; margin-bottom: 0.3rem; }
        .mke-dropzone-or { font-size: 0.8rem; color: var(--mke-muted); margin: 0.6rem 0; }
        .mke-dropzone-hint { font-size: 0.76rem; color: var(--mke-muted); margin-top: 1rem; }
        .mke-preview-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; margin-top: 1rem; }
        @media (min-width: 640px) { .mke-preview-grid { grid-template-columns: repeat(6, 1fr); } }
        .mke-preview-thumb { position: relative; aspect-ratio: 1; overflow: hidden; background: var(--mke-paper-alt); }
        .mke-preview-remove {
          position: absolute; top: 0.25rem; right: 0.25rem;
          width: 1.4rem; height: 1.4rem;
          background: var(--mke-paper);
          border: 1px solid var(--mke-ink);
          font-size: 0.75rem; line-height: 1;
          cursor: pointer;
        }
        .mke-preview-add {
          aspect-ratio: 1;
          border: 1px dashed var(--mke-border);
          background: none;
          font-size: 1.4rem;
          color: var(--mke-muted);
          cursor: pointer;
        }

        .mke-textarea {
          width: 100%;
          border: 1px solid var(--mke-border);
          background: var(--mke-paper);
          padding: 0.9rem 1rem;
          font-family: 'Public Sans', system-ui, sans-serif;
          font-size: 0.95rem;
          color: var(--mke-ink);
          resize: none;
          outline: none;
        }
        .mke-textarea:focus { border-color: var(--mke-ink); }
        .mke-char-count { font-size: 0.75rem; color: var(--mke-muted); text-align: right; margin-top: 0.4rem; }

        .mke-print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--mke-border); border: 1px solid var(--mke-border); }
        .mke-print-tile {
          background: var(--mke-paper);
          text-align: left;
          border: none;
          cursor: pointer;
          padding: 0;
        }
        .mke-print-tile[data-active="true"] { outline: 2px solid var(--mke-ink); outline-offset: -2px; }
        .mke-print-thumb { position: relative; aspect-ratio: 5 / 3; background: var(--mke-paper-alt); }
        .mke-print-badge {
          position: absolute; top: 0.5rem; left: 0.5rem;
          background: var(--mke-accent); color: #fff;
          font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase;
          padding: 0.25rem 0.5rem;
        }
        .mke-print-info { display: flex; align-items: baseline; justify-content: space-between; padding: 0.9rem 1rem; gap: 0.5rem; }
        .mke-print-name { font-weight: 600; font-size: 0.95rem; }
        .mke-print-sub { font-size: 0.76rem; color: var(--mke-muted); margin-top: 0.15rem; }
        .mke-print-price { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }

        .mke-summary-line { display: flex; justify-content: space-between; gap: 1rem; padding: 0.55rem 0; font-size: 0.92rem; }
        .mke-summary-line.muted { color: var(--mke-ink-soft); }
        .mke-summary-total { display: flex; justify-content: space-between; align-items: baseline; padding-top: 1.1rem; margin-top: 0.4rem; border-top: 1px solid var(--mke-ink); }
        .mke-summary-total-label { font-size: 1.1rem; font-weight: 600; }
        .mke-summary-total-value { font-size: 2rem; font-family: 'Libre Bodoni', Georgia, serif; font-variant-numeric: tabular-nums; }
        .mke-summary-note { font-size: 0.78rem; color: var(--mke-muted); margin-top: 1rem; text-align: center; }
        .mke-delay-note { font-size: 0.82rem; color: var(--mke-ink-soft); margin-top: 1rem; text-align: center; }

        .mke-gallery-grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 190px; gap: 6px; }
        @media (max-width: 640px) { .mke-gallery-grid { grid-template-columns: repeat(2, 1fr); grid-auto-rows: 180px; } }
        .mke-gallery-item { position: relative; overflow: hidden; background: var(--mke-paper-alt); }
        .mke-gallery-img { transition: transform 500ms ease; }
        .mke-gallery-item:hover .mke-gallery-img { transform: scale(1.04); }
        .mke-gallery-caption {
          position: absolute; left: 0.7rem; bottom: 0.6rem;
          font-size: 0.64rem; letter-spacing: 0.1em; text-transform: uppercase;
          color: #fff; background: rgba(28,25,23,0.72);
          padding: 0.28rem 0.55rem;
        }

        .mke-rating-block { display: grid; grid-template-columns: auto 1fr; gap: 3rem; align-items: center; }
        @media (max-width: 720px) { .mke-rating-block { grid-template-columns: 1fr; gap: 1.5rem; } }
        .mke-rating-num { font-family: 'Libre Bodoni', Georgia, serif; font-size: 5rem; line-height: 0.9; }
        .mke-dist-row { display: grid; grid-template-columns: 2.4rem 1fr 2.6rem; gap: 0.7rem; align-items: center; font-size: 0.82rem; margin-bottom: 0.5rem; }
        .mke-dist-bar { height: 2px; background: var(--mke-border); position: relative; }
        .mke-dist-fill { position: absolute; inset: 0; background: var(--mke-ink); }

        .mke-reviews-grid { display: grid; grid-template-columns: 1fr; gap: 0; margin-top: 2.5rem; }
        @media (min-width: 720px) { .mke-reviews-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1040px) { .mke-reviews-grid { grid-template-columns: 1fr 1fr 1fr; } }
        .mke-review-card { padding: 1.6rem; border-top: 1px solid var(--mke-border); }
        .mke-review-name { font-weight: 600; font-size: 0.92rem; margin-bottom: 0.5rem; }
        .mke-review-text { color: var(--mke-ink-soft); font-size: 0.9rem; line-height: 1.6; }

        .mke-faq-item { border-top: 1px solid var(--mke-border); }
        .mke-faq-item:last-child { border-bottom: 1px solid var(--mke-border); }
        .mke-faq-trigger {
          width: 100%;
          display: flex; align-items: center; justify-content: space-between; gap: 1rem;
          background: none; border: none; cursor: pointer;
          padding: 1.4rem 0;
          text-align: left;
          font-size: 1.05rem;
          font-weight: 500;
          color: var(--mke-ink);
        }
        .mke-faq-icon { font-size: 1.3rem; color: var(--mke-muted); transition: transform 220ms ease; flex-shrink: 0; }
        .mke-faq-item[data-open="true"] .mke-faq-icon { transform: rotate(45deg); }
        .mke-faq-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 260ms ease; }
        .mke-faq-item[data-open="true"] .mke-faq-panel { grid-template-rows: 1fr; }
        .mke-faq-panel-inner { overflow: hidden; }
        .mke-faq-answer { color: var(--mke-ink-soft); font-size: 0.92rem; line-height: 1.65; padding-bottom: 1.5rem; max-width: 42rem; }

        .mke-cta-section { background: var(--mke-ink); color: var(--mke-paper); text-align: center; }
        .mke-cta-title { font-size: clamp(2rem, 4.6vw, 3.4rem); font-weight: 500; margin: 0.8rem 0 1rem; }
        .mke-cta-sub { color: rgba(250,250,249,0.72); font-size: 1.02rem; max-width: 34rem; margin: 0 auto 2rem; }
        .mke-pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.8rem; margin-bottom: 2.4rem; }
        .mke-pill {
          font-size: 0.78rem;
          letter-spacing: 0.04em;
          border: 1px solid rgba(250,250,249,0.35);
          padding: 0.5rem 1rem;
          color: rgba(250,250,249,0.88);
        }
        .mke-cta-section .mke-btn { background: var(--mke-paper); color: var(--mke-ink); border-color: var(--mke-paper); }
        .mke-cta-section .mke-btn:hover { background: var(--mke-accent); color: #fff; border-color: var(--mke-accent); }

        .mke-toast {
          position: fixed;
          bottom: 5.5rem;
          right: 1.25rem;
          z-index: 9998;
          background: var(--mke-ink);
          color: var(--mke-paper);
          font-size: 0.85rem;
          padding: 0.85rem 1.2rem;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          animation: mke-fade-in 220ms ease both;
        }
      `}</style>

      {/* ═══ MASTHEAD / HERO ═══ */}
      <section className="mke-hero-grid mke-fade">
        <div className="mke-hero-text">
          <div className="mke-eyebrow">{COPY.universe} — {COPY.simpsonStyle}</div>
          <h1 className="mke-serif mke-hero-title">
            {COPY.heroTitle1} <em>{COPY.heroTitle2}</em>
          </h1>
          <p className="mke-hero-subtitle">{COPY.heroSubtitle}</p>
          <div>
            <button type="button" className="mke-btn" onClick={scrollToConfig}>
              {COPY.orderCta}
              <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="mke-rating-line">
            <span className="mke-stars">★★★★★</span>
            <span>
              {STATS.rating}/5 · {STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}
            </span>
          </div>
        </div>
        <div className="mke-hero-photo">
          <Image
            src={heroPhoto}
            alt="Portrait Simpson personnalisé, style cartoon jaune"
            fill
            priority
            className="object-cover"
            sizes="(max-width: 900px) 100vw, 50vw"
          />
        </div>
      </section>

      {/* ═══ COMMENT ÇA MARCHE ═══ */}
      <section className="mke-section">
        <div className="mke-container">
          <div className="mke-section-head">
            <div className="mke-eyebrow">{COPY.howItWorks}</div>
            <h2 className="mke-serif mke-section-title">{COPY.howItWorksTitle}</h2>
          </div>
          <div>
            <hr className="mke-rule" />
            <div className="mke-step-row">
              <div className="mke-serif mke-step-num">01</div>
              <div>
                <h3 className="mke-step-title">{COPY.step1Title}</h3>
                <p className="mke-step-desc">{COPY.step1Desc}</p>
              </div>
            </div>
            <hr className="mke-rule" />
            <div className="mke-step-row">
              <div className="mke-serif mke-step-num">02</div>
              <div>
                <h3 className="mke-step-title">{COPY.step2Title}</h3>
                <p className="mke-step-desc">{COPY.step2Desc}</p>
              </div>
            </div>
            <hr className="mke-rule" />
            <div className="mke-step-row">
              <div className="mke-serif mke-step-num">03</div>
              <div>
                <h3 className="mke-step-title">{COPY.step3Title}</h3>
                <p className="mke-step-desc">{COPY.step3Desc}</p>
              </div>
            </div>
            <hr className="mke-rule" />
          </div>
        </div>
      </section>

      {/* ═══ CONFIGURATEUR ═══ */}
      <section className="mke-section" style={{ background: "var(--mke-paper-alt)" }} ref={configRef}>
        <div className="mke-container">
          <div className="mke-section-head">
            <div className="mke-eyebrow">{COPY.configurator}</div>
            <h2 className="mke-serif mke-section-title">{COPY.composeYourPortrait}</h2>
            <p className="mke-section-sub">{COPY.guidedSteps}</p>
          </div>

          <div className="mke-config-layout">
            {/* LIVE PREVIEW */}
            <div>
              <div className="mke-preview-frame">
                <Image
                  src={selectedBackground.src}
                  alt={selectedBackground.label}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1000px) 92vw, 480px"
                />
                <div className="mke-preview-tag">{selectedBackground.label}</div>
              </div>
              <div className="mke-delay-note">
                {COPY.estimatedDelay} — {COPY.digital48h} · {COPY.print57Days}
              </div>
            </div>

            {/* STEPS */}
            <div>
              <hr className="mke-rule" />

              {/* Framing */}
              <div className="mke-config-row">
                <div className="mke-config-row-head">
                  <div className="mke-config-row-title">{COPY.framingStep}</div>
                </div>
                <div className="mke-format-grid">
                  {(["portrait", "fullbody"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className="mke-format-tile"
                      data-active={format === f}
                      onClick={() => setFormat(f)}
                    >
                      <div className="mke-format-tile-label">
                        {f === "portrait" ? COPY.portrait : COPY.fullbody}
                      </div>
                      <div className="mke-format-tile-sub">
                        {f === "portrait" ? COPY.portraitSub : COPY.fullbodySub}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <hr className="mke-rule" />

              {/* People / animals */}
              <div className="mke-config-row">
                <div className="mke-config-row-head">
                  <div className="mke-config-row-title">{COPY.whoOnPortrait}</div>
                </div>
                <div className="mke-stepper-group">
                  <Stepper
                    label={COPY.peopleLabel}
                    value={people}
                    min={1}
                    max={8}
                    hint={`+${formatEUR(PRICES.extraPerson)} ${COPY.perExtraPerson}`}
                    onChange={setPeople}
                  />
                  <Stepper
                    label={COPY.animalsLabel}
                    value={animals}
                    min={0}
                    max={4}
                    hint={`+${formatEUR(PRICES.extraAnimal)} ${COPY.perAnimal}`}
                    onChange={setAnimals}
                  />
                </div>
              </div>
              <hr className="mke-rule" />

              {/* Background */}
              <div className="mke-config-row">
                <div className="mke-config-row-head">
                  <div className="mke-config-row-title">{COPY.decorStep}</div>
                  <div className="mke-config-row-note">{COPY.hoverToPreview}</div>
                </div>
                <div className="mke-bg-grid">
                  {BACKGROUNDS.map((bg, i) => (
                    <button
                      key={bg.src}
                      type="button"
                      className="mke-bg-tile"
                      data-active={selectedBg === i}
                      onMouseEnter={() => setSelectedBg(i)}
                      onClick={() => setSelectedBg(i)}
                    >
                      <div className="mke-bg-thumb">
                        <Image src={bg.src} alt={bg.label} fill className="object-cover" sizes="140px" />
                      </div>
                      <div className="mke-bg-label">{bg.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <hr className="mke-rule" />

              {/* Upload */}
              <div className="mke-config-row">
                <div className="mke-config-row-head">
                  <div className="mke-config-row-title">{COPY.uploadStep}</div>
                  <div className="mke-config-row-note">{COPY.uploadMax8}</div>
                </div>
                <div
                  className="mke-dropzone"
                  data-drag={dragOver}
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
                >
                  <div className="mke-dropzone-title">{COPY.dragHere}</div>
                  <div className="mke-dropzone-or">{COPY.orWord}</div>
                  <button
                    type="button"
                    className="mke-btn-ghost mke-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {COPY.choosePhoto}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFiles(e.target.files)}
                    style={{ display: "none" }}
                  />
                  <div className="mke-dropzone-hint">{COPY.uploadHint}</div>
                </div>
                {previews.length > 0 && (
                  <div className="mke-preview-grid">
                    {previews.map((url, i) => (
                      <div key={url} className="mke-preview-thumb">
                        <Image src={url} alt="" fill className="object-cover" sizes="100px" unoptimized />
                        <button
                          type="button"
                          className="mke-preview-remove"
                          onClick={() => removePreview(i)}
                          aria-label="Retirer la photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {previews.length < 8 && (
                      <button
                        type="button"
                        className="mke-preview-add"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label={COPY.choosePhoto}
                      >
                        +
                      </button>
                    )}
                  </div>
                )}
              </div>
              <hr className="mke-rule" />

              {/* Note */}
              <div className="mke-config-row">
                <div className="mke-config-row-head">
                  <div className="mke-config-row-title">{COPY.noteForArtist}</div>
                  <div className="mke-config-row-note">{COPY.optional}</div>
                </div>
                <textarea
                  className="mke-textarea"
                  rows={4}
                  value={note}
                  placeholder={COPY.notePlaceholder}
                  onChange={(e) => setNote(e.target.value.slice(0, 400))}
                />
                <div className="mke-char-count">{note.length} / 400</div>
              </div>
              <hr className="mke-rule" />

              {/* Print support */}
              <div className="mke-config-row">
                <div className="mke-config-row-head">
                  <div className="mke-config-row-title">{COPY.printSupportStep}</div>
                </div>
                <div className="mke-print-grid">
                  {PRINT_OPTIONS.map((opt, i) => (
                    <button
                      key={opt.key}
                      type="button"
                      className="mke-print-tile"
                      data-active={selectedPrint === i}
                      onClick={() => setSelectedPrint(i)}
                    >
                      <div className="mke-print-thumb">
                        <Image src={opt.img} alt={opt.label} fill className="object-contain p-4" sizes="240px" />
                        {opt.badge && <div className="mke-print-badge">{opt.badge}</div>}
                      </div>
                      <div className="mke-print-info">
                        <div>
                          <div className="mke-print-name">{opt.label}</div>
                          <div className="mke-print-sub">{opt.sub}</div>
                        </div>
                        <div className="mke-print-price">{formatEUR(PRICES.base + opt.addon)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <hr className="mke-rule" />

              {/* Summary */}
              <div className="mke-config-row">
                <div className="mke-config-row-title" style={{ marginBottom: "1rem" }}>
                  {COPY.summary}
                </div>
                <div>
                  <div className="mke-summary-line">
                    <span>
                      {format === "portrait" ? COPY.portrait : COPY.fullbody} · {selectedPrintOption.label}
                    </span>
                    <span>{formatEUR(PRICES.base + selectedPrintOption.addon)}</span>
                  </div>
                  {format === "fullbody" && (
                    <div className="mke-summary-line">
                      <span>+ {COPY.fullbody}</span>
                      <span>+{formatEUR(PRICES.fullbodyExtra)}</span>
                    </div>
                  )}
                  {people > 1 && (
                    <div className="mke-summary-line">
                      <span>
                        +{people - 1} {COPY.peoplePlural}
                      </span>
                      <span>+{formatEUR((people - 1) * PRICES.extraPerson)}</span>
                    </div>
                  )}
                  {animals > 0 && (
                    <div className="mke-summary-line">
                      <span>
                        +{animals} {animals > 1 ? COPY.animalsPlural : COPY.animalsSingular}
                      </span>
                      <span>+{formatEUR(animals * PRICES.extraAnimal)}</span>
                    </div>
                  )}
                  <div className="mke-summary-line muted">
                    <span>{COPY.revisionsIncluded}</span>
                    <span>{COPY.included}</span>
                  </div>
                  <div className="mke-summary-total">
                    <span className="mke-serif mke-summary-total-label">{COPY.total}</span>
                    <span className="mke-serif mke-summary-total-value">{formatEUR(total)}</span>
                  </div>
                </div>
                <button type="button" className="mke-btn" style={{ width: "100%", justifyContent: "center", marginTop: "1.4rem" }} onClick={onAddToCart}>
                  {COPY.addToCart} — {formatEUR(total)}
                </button>
                <div className="mke-summary-note">{COPY.paymentReassurance}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ GALERIE ═══ */}
      <section className="mke-section">
        <div className="mke-container">
          <div className="mke-section-head">
            <div className="mke-eyebrow">{COPY.galleryLabel}</div>
            <h2 className="mke-serif mke-section-title">{COPY.galleryTitle}</h2>
            <p className="mke-section-sub">{COPY.gallerySub}</p>
          </div>
          <div className="mke-gallery-grid">
            {GALLERY_PHOTOS.map((src, i) => {
              const layout = GALLERY_LAYOUT[i % GALLERY_LAYOUT.length];
              return (
                <div
                  key={src}
                  className="mke-gallery-item"
                  style={{ gridColumn: `span ${layout.col}`, gridRow: `span ${layout.row}` }}
                >
                  <Image
                    src={src}
                    alt="Réalisation Cartoonova, portrait style Simpson"
                    fill
                    className="object-cover mke-gallery-img"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                  <div className="mke-gallery-caption">★ {(4.7 + (i % 4) * 0.07).toFixed(1)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ AVIS ═══ */}
      <section className="mke-section" style={{ background: "var(--mke-paper-alt)" }}>
        <div className="mke-container">
          <div className="mke-eyebrow">{COPY.reviewsLabel}</div>
          <div className="mke-rating-block" style={{ marginTop: "1rem" }}>
            <div>
              <div className="mke-rating-num">{STATS.rating}<span style={{ fontSize: "1.6rem", color: "var(--mke-muted)" }}>/5</span></div>
              <div className="mke-stars" style={{ fontSize: "1.3rem", marginTop: "0.3rem" }}>★★★★★</div>
              <div style={{ fontSize: "0.85rem", color: "var(--mke-ink-soft)", marginTop: "0.5rem" }}>
                {COPY.basedOn} {STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}
              </div>
            </div>
            <div>
              {STATS.distribution.map((d) => (
                <div className="mke-dist-row" key={d.stars}>
                  <span>{d.stars} ★</span>
                  <div className="mke-dist-bar">
                    <div className="mke-dist-fill" style={{ width: `${d.pct}%` }} />
                  </div>
                  <span style={{ textAlign: "right" }}>{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mke-reviews-grid">
            {REVIEWS.map((r) => (
              <div className="mke-review-card" key={r.name}>
                <div className="mke-review-name">{r.name}</div>
                <div className="mke-review-text">&ldquo;{r.text}&rdquo;</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="mke-section">
        <div className="mke-container" style={{ maxWidth: 760 }}>
          <div className="mke-section-head">
            <div className="mke-eyebrow">FAQ</div>
            <h2 className="mke-serif mke-section-title">{COPY.frequentQuestions}</h2>
          </div>
          <div>
            {FAQ_ITEMS.map((item, i) => (
              <div className="mke-faq-item" key={item.q} data-open={openFaq === i}>
                <button
                  type="button"
                  className="mke-faq-trigger"
                  aria-expanded={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{item.q}</span>
                  <span className="mke-faq-icon" aria-hidden="true">+</span>
                </button>
                <div className="mke-faq-panel">
                  <div className="mke-faq-panel-inner">
                    <div className="mke-faq-answer">{item.a}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA FINALE ═══ */}
      <section className="mke-section mke-cta-section">
        <div className="mke-container">
          <div className="mke-eyebrow" style={{ color: "rgba(250,250,249,0.6)" }}>
            {COPY.simpsonStyle}
          </div>
          <h2 className="mke-serif mke-cta-title">{COPY.ctaTitle}</h2>
          <p className="mke-cta-sub">{COPY.ctaSubtitle}</p>
          <div className="mke-pills">
            <span className="mke-pill">{COPY.pillDrawnHand}</span>
            <span className="mke-pill">{COPY.pillDelivered48h}</span>
            <span className="mke-pill">{COPY.pillSatisfied}</span>
            <span className="mke-pill">{COPY.madeInFrance}</span>
          </div>
          <button type="button" className="mke-btn" onClick={scrollToConfig}>
            {COPY.orderCta}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      {toastVisible && <div className="mke-toast">{COPY.previewOnlyToast}</div>}

      <MockupSwitcher />
    </div>
  );
}
