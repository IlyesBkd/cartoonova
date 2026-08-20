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

type UploadedPhoto = { url: string; name: string };

export default function Page() {
  // ─── Configurator state ───
  const [format, setFormat] = useState<Format>("portrait");
  const [people, setPeople] = useState(1);
  const [animals, setAnimals] = useState(0);
  const [selectedBg, setSelectedBg] = useState(0);
  const [hoveredBg, setHoveredBg] = useState<number | null>(null);
  const [selectedPrint, setSelectedPrint] = useState(0);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // ─── Page chrome state ───
  const [activeHero, setActiveHero] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [galleryLightbox, setGalleryLightbox] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hero autoplay
  useEffect(() => {
    const id = setInterval(() => setActiveHero((p) => (p + 1) % HERO_SLIDES.length), 4200);
    return () => clearInterval(id);
  }, []);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const state: ConfiguratorState = {
    format,
    people,
    animals,
    printKey: PRINT_OPTIONS[selectedPrint].key,
  };
  const total = computeTotal(state);

  const scrollToConfig = useCallback(() => {
    configRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    setPhotos((prev) => {
      const room = Math.max(0, 8 - prev.length);
      const incoming = Array.from(files)
        .slice(0, room)
        .map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
      return [...prev, ...incoming];
    });
  }, []);

  const removePhoto = useCallback((idx: number) => {
    setPhotos((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const onAddToCart = () => {
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2000);
  };

  const previewBgIndex = hoveredBg !== null ? hoveredBg : selectedBg;
  const previewBg = BACKGROUNDS[previewBgIndex];

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .mk-cinema {
          --mkc-bg: #0b0b0c;
          --mkc-bg-raise: #111112;
          --mkc-surface: #171614;
          --mkc-surface-2: #1c1a17;
          --mkc-border: #2a2622;
          --mkc-border-soft: rgba(201, 162, 75, 0.16);
          --mkc-text: #f2ede2;
          --mkc-muted: #a79f8f;
          --mkc-muted-2: #756e61;
          --mkc-accent: #c9a24b;
          --mkc-accent-hover: #e0bd6c;
          --mkc-accent-dim: rgba(201, 162, 75, 0.14);
          --mkc-font-display: 'Playfair Display', 'Georgia', serif;
          --mkc-font-body: 'Inter', system-ui, sans-serif;
          background: var(--mkc-bg);
          color: var(--mkc-text);
          font-family: var(--mkc-font-body);
          font-weight: 300;
          -webkit-font-smoothing: antialiased;
        }
        .mk-cinema * { box-sizing: border-box; }
        .mk-cinema ::selection { background: var(--mkc-accent); color: #0b0b0c; }

        .mkc-display { font-family: var(--mkc-font-display); font-weight: 500; letter-spacing: 0.01em; }
        .mkc-kicker {
          font-family: var(--mkc-font-body);
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--mkc-accent);
        }
        .mkc-rule { width: 56px; height: 1px; background: linear-gradient(90deg, var(--mkc-accent), transparent); }
        .mkc-rule.center { margin-left: auto; margin-right: auto; background: var(--mkc-accent); }

        @keyframes mkc-fade { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .mkc-fade-in { animation: mkc-fade 700ms cubic-bezier(.2,.7,.2,1) both; }
        @keyframes mkc-cross { from { opacity: 0; } to { opacity: 1; } }
        .mkc-cross { animation: mkc-cross 900ms ease both; }
        @keyframes mkc-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }

        .mkc-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.6rem;
          background: var(--mkc-accent); color: #0b0b0c; border: 1px solid var(--mkc-accent);
          font-family: var(--mkc-font-body); font-weight: 600; font-size: 0.82rem;
          letter-spacing: 0.14em; text-transform: uppercase;
          padding: 1rem 2rem; cursor: pointer; transition: background 400ms ease, color 400ms ease, border-color 400ms ease, transform 200ms ease;
          user-select: none;
        }
        .mkc-btn:hover { background: var(--mkc-accent-hover); border-color: var(--mkc-accent-hover); transform: translateY(-1px); }
        .mkc-btn:active { transform: translateY(0); }
        .mkc-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .mkc-btn.mkc-ghost { background: transparent; color: var(--mkc-text); border-color: var(--mkc-border); }
        .mkc-btn.mkc-ghost:hover { border-color: var(--mkc-accent); color: var(--mkc-accent); background: transparent; }

        .mkc-card {
          background: var(--mkc-surface); border: 1px solid var(--mkc-border);
          transition: border-color 400ms ease, background 400ms ease;
        }
        .mkc-tile { cursor: pointer; text-align: left; }
        .mkc-tile.mkc-selected { border-color: var(--mkc-accent); background: var(--mkc-surface-2); position: relative; }
        .mkc-tile.mkc-selected::after {
          content: ''; position: absolute; top: 10px; right: 10px; width: 8px; height: 8px;
          border-radius: 999px; background: var(--mkc-accent); box-shadow: 0 0 0 3px var(--mkc-accent-dim);
        }

        .mkc-input, .mkc-textarea {
          background: var(--mkc-bg-raise); border: 1px solid var(--mkc-border); color: var(--mkc-text);
          font-family: var(--mkc-font-body); font-weight: 300; outline: none; transition: border-color 300ms ease;
        }
        .mkc-input:focus, .mkc-textarea:focus { border-color: var(--mkc-accent); }
        .mkc-textarea::placeholder { color: var(--mkc-muted-2); }

        .mkc-stepper-btn {
          width: 40px; height: 40px; border: 1px solid var(--mkc-border); background: transparent; color: var(--mkc-text);
          font-family: var(--mkc-font-display); font-size: 1.2rem; cursor: pointer; transition: border-color 250ms ease, color 250ms ease;
        }
        .mkc-stepper-btn:hover:not(:disabled) { border-color: var(--mkc-accent); color: var(--mkc-accent); }
        .mkc-stepper-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .mkc-scrollbar::-webkit-scrollbar { height: 6px; }
        .mkc-scrollbar::-webkit-scrollbar-track { background: var(--mkc-bg-raise); }
        .mkc-scrollbar::-webkit-scrollbar-thumb { background: var(--mkc-border); }

        .mkc-faq-chev { transition: transform 500ms cubic-bezier(.4,0,.2,1); }
        .mkc-faq-open .mkc-faq-chev { transform: rotate(45deg); }
        .mkc-faq-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 500ms cubic-bezier(.4,0,.2,1); }
        .mkc-faq-open .mkc-faq-panel { grid-template-rows: 1fr; }
        .mkc-faq-panel > div { overflow: hidden; }

        .mkc-star { color: var(--mkc-accent); }
        .mkc-star.mkc-empty { color: var(--mkc-border); }

        @keyframes mkc-toast-in { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .mkc-toast { animation: mkc-toast-in 400ms cubic-bezier(.2,.8,.3,1.1) both; }

        .mkc-marquee-track { animation: mkc-marquee 34s linear infinite; }
        @keyframes mkc-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

        .mkc-hero-slide { transition: opacity 900ms ease; }

        .mkc-gallery-frame { position: relative; scroll-snap-align: start; flex: 0 0 auto; }
        .mkc-gallery-frame .mkc-gallery-caption {
          position: absolute; inset: auto 0 0 0; padding: 1rem 1.1rem;
          background: linear-gradient(0deg, rgba(0,0,0,0.85), transparent);
          opacity: 0; transition: opacity 400ms ease; pointer-events: none;
        }
        .mkc-gallery-frame:hover .mkc-gallery-caption { opacity: 1; }
        .mkc-gallery-frame img { transition: filter 500ms ease, transform 700ms ease; }

        .mkc-dropzone { border: 1px dashed var(--mkc-border); transition: border-color 300ms ease, background 300ms ease; }
        .mkc-dropzone.mkc-drag { border-color: var(--mkc-accent); background: var(--mkc-accent-dim); }
      `}</style>

      <div className="mk-cinema min-h-screen">
        {/* ══════════════════ HERO ══════════════════ */}
        <section className="relative min-h-[92vh] flex items-end overflow-hidden border-b border-[var(--mkc-border)]">
          <div className="absolute inset-0">
            {HERO_SLIDES.map((src, i) => (
              <div
                key={src}
                className={`mkc-hero-slide absolute inset-0 ${i === activeHero ? "opacity-100" : "opacity-0"}`}
              >
                <Image
                  src={src}
                  alt="Portrait cartoon personnalisé Cartoonova"
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="object-cover"
                  style={{ filter: "grayscale(0.15) brightness(0.62) contrast(1.05)" }}
                />
              </div>
            ))}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(0deg, rgba(11,11,12,0.98) 0%, rgba(11,11,12,0.55) 42%, rgba(11,11,12,0.25) 65%, rgba(11,11,12,0.55) 100%), linear-gradient(90deg, rgba(11,11,12,0.55) 0%, transparent 45%)",
              }}
            />
          </div>

          <div className="relative w-full max-w-7xl mx-auto px-6 md:px-10 pb-16 pt-40 mkc-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <span className="mkc-kicker">{COPY.universe}</span>
              <span className="mkc-rule" />
              <span className="mkc-kicker">{COPY.simpsonStyle}</span>
            </div>

            <h1 className="mkc-display text-[clamp(2.6rem,7vw,6rem)] leading-[1.02] mb-6 max-w-4xl">
              {COPY.heroTitle1}
              <br />
              <span style={{ color: "var(--mkc-accent)" }}>{COPY.heroTitle2}</span>
            </h1>

            <p className="text-base md:text-lg font-light max-w-xl mb-10 leading-relaxed" style={{ color: "var(--mkc-muted)" }}>
              {COPY.heroSubtitle}
            </p>

            <div className="flex flex-wrap items-center gap-8">
              <button className="mkc-btn" onClick={scrollToConfig}>
                {COPY.orderCta}
                <span aria-hidden>→</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex text-lg leading-none" aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={i < Math.round(STATS.rating) ? "mkc-star" : "mkc-star mkc-empty"}>★</span>
                  ))}
                </div>
                <div className="text-sm font-light" style={{ color: "var(--mkc-muted)" }}>
                  <span className="text-[var(--mkc-text)] font-medium">{STATS.rating.toString().replace(".", ",")}/5</span>
                  {" · "}
                  {STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 border-t border-[var(--mkc-border)] bg-[rgba(11,11,12,0.75)] backdrop-blur-sm overflow-hidden">
            <div className="flex mkc-marquee-track whitespace-nowrap py-3 text-xs tracking-[0.22em] uppercase font-light" style={{ color: "var(--mkc-muted)" }}>
              {Array.from({ length: 2 }).map((_, k) => (
                <div key={k} className="flex items-center gap-8 px-6">
                  <span>{STATS.reviewCount.toLocaleString("fr-FR")}+ {COPY.portraitsDelivered}</span>
                  <span style={{ color: "var(--mkc-accent)" }}>—</span>
                  <span>{COPY.delivered48h}</span>
                  <span style={{ color: "var(--mkc-accent)" }}>—</span>
                  <span>{COPY.handDrawn}</span>
                  <span style={{ color: "var(--mkc-accent)" }}>—</span>
                  <span>{COPY.satisfiedOrRefunded}</span>
                  <span style={{ color: "var(--mkc-accent)" }}>—</span>
                  <span>{COPY.freeRevisions}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════ HOW IT WORKS ══════════════════ */}
        <section className="py-24 border-b border-[var(--mkc-border)]">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <div className="text-center mb-16">
              <div className="mkc-kicker mb-4">{COPY.howItWorks}</div>
              <h2 className="mkc-display text-[clamp(1.8rem,3.4vw,2.8rem)]">{COPY.howItWorksTitle}</h2>
              <div className="mkc-rule center mt-6" />
            </div>
            <div className="grid md:grid-cols-3 gap-10 md:gap-6">
              {[
                { n: "01", title: COPY.step1Title, desc: COPY.step1Desc },
                { n: "02", title: COPY.step2Title, desc: COPY.step2Desc },
                { n: "03", title: COPY.step3Title, desc: COPY.step3Desc },
              ].map((s) => (
                <div key={s.n} className="text-center md:text-left px-2">
                  <div className="mkc-display text-5xl mb-4" style={{ color: "var(--mkc-accent)", opacity: 0.85 }}>{s.n}</div>
                  <h3 className="mkc-display text-xl mb-2">{s.title}</h3>
                  <p className="text-sm font-light leading-relaxed" style={{ color: "var(--mkc-muted)" }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════ CONFIGURATOR ══════════════════ */}
        <section ref={configRef} className="py-24 border-b border-[var(--mkc-border)]">
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="text-center mb-16">
              <div className="mkc-kicker mb-4">{COPY.configurator}</div>
              <h2 className="mkc-display text-[clamp(2rem,4.2vw,3.4rem)]">{COPY.composeYourPortrait}</h2>
              <p className="text-sm font-light mt-4" style={{ color: "var(--mkc-muted)" }}>{COPY.guidedSteps}</p>
              <div className="mkc-rule center mt-6" />
            </div>

            <div className="grid lg:grid-cols-[1fr_1.05fr] gap-10">
              {/* Live preview */}
              <div className="hidden lg:block lg:sticky lg:top-8 lg:self-start">
                <div className="mkc-card relative overflow-hidden">
                  <div className="relative aspect-[4/5]">
                    <Image
                      src={previewBg?.src ?? GALLERY_PHOTOS[0]}
                      alt={previewBg?.label ?? "Aperçu du décor"}
                      fill
                      sizes="(max-width: 1024px) 90vw, 46vw"
                      className="object-cover"
                      style={{ filter: "brightness(0.75) saturate(0.9)" }}
                    />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(11,11,12,0.9), transparent 55%)" }} />
                    <div className="absolute top-4 left-4 text-[11px] tracking-[0.2em] uppercase px-3 py-1.5 border border-[var(--mkc-border-soft)]" style={{ background: "rgba(11,11,12,0.7)", color: "var(--mkc-accent)" }}>
                      {COPY.decorStep} · {previewBg?.label}
                    </div>
                    <div className="absolute bottom-5 left-5 right-5 flex flex-wrap gap-2">
                      {[
                        format === "portrait" ? COPY.portrait : COPY.fullbody,
                        `${people} ${people > 1 ? COPY.peoplePlural : COPY.peopleSingular}`,
                        animals > 0 ? `${animals} ${animals > 1 ? COPY.animalsPlural : COPY.animalsSingular}` : null,
                        PRINT_OPTIONS[selectedPrint].label,
                      ]
                        .filter(Boolean)
                        .map((chip, i) => (
                          <span key={i} className="text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 border border-[var(--mkc-border)]" style={{ background: "rgba(11,11,12,0.7)", color: "var(--mkc-text)" }}>
                            {chip}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
                <div className="mt-5 text-center text-xs font-light tracking-[0.1em] uppercase" style={{ color: "var(--mkc-muted)" }}>
                  {COPY.estimatedDelay} — <span style={{ color: "var(--mkc-text)" }}>{COPY.digital48h}</span> · {COPY.print57Days}
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-10">
                {/* 01 Framing */}
                <ConfigStep n="01" title={COPY.framingStep}>
                  <div className="grid grid-cols-2 gap-4">
                    {(["portrait", "fullbody"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={`mkc-card mkc-tile p-5 ${format === f ? "mkc-selected" : ""}`}
                      >
                        <div className="mkc-display text-lg mb-1">{f === "portrait" ? COPY.portrait : COPY.fullbody}</div>
                        <div className="text-xs font-light" style={{ color: "var(--mkc-muted)" }}>
                          {f === "portrait" ? COPY.portraitSub : COPY.fullbodySub}
                        </div>
                      </button>
                    ))}
                  </div>
                </ConfigStep>

                {/* 02 People / animals */}
                <ConfigStep n="02" title={COPY.whoOnPortrait}>
                  <div className="grid grid-cols-2 gap-4">
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
                </ConfigStep>

                {/* 03 Background */}
                <ConfigStep n="03" title={COPY.decorStep} extra={<span className="text-[11px] font-light tracking-[0.08em] uppercase" style={{ color: "var(--mkc-muted)" }}>{COPY.hoverToPreview}</span>}>
                  <div className="grid grid-cols-3 gap-3">
                    {BACKGROUNDS.map((bg, i) => (
                      <button
                        key={bg.src}
                        onMouseEnter={() => setHoveredBg(i)}
                        onMouseLeave={() => setHoveredBg(null)}
                        onClick={() => setSelectedBg(i)}
                        className={`mkc-card mkc-tile overflow-hidden ${selectedBg === i ? "mkc-selected" : ""}`}
                      >
                        <div className="relative aspect-square">
                          <Image src={bg.src} alt={bg.label} fill sizes="160px" className="object-cover" style={{ filter: "brightness(0.72)" }} />
                        </div>
                        <div className="px-2.5 py-2 border-t border-[var(--mkc-border)]">
                          <div className="text-[11px] font-light tracking-[0.05em]">{bg.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ConfigStep>

                {/* 04 Upload */}
                <ConfigStep n="04" title={COPY.uploadStep} extra={<span className="text-[11px] font-light tracking-[0.08em] uppercase" style={{ color: "var(--mkc-muted)" }}>{COPY.uploadMax8}</span>}>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                    className={`mkc-dropzone px-6 py-10 text-center ${dragOver ? "mkc-drag" : ""}`}
                  >
                    <div className="mkc-display text-lg mb-1">{COPY.dragHere}</div>
                    <div className="text-xs font-light mb-5" style={{ color: "var(--mkc-muted)" }}>{COPY.orWord}</div>
                    <button onClick={() => fileInputRef.current?.click()} className="mkc-btn mkc-ghost" type="button">
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
                    <div className="text-[11px] font-light mt-4" style={{ color: "var(--mkc-muted-2)" }}>{COPY.uploadHint}</div>
                  </div>

                  {photos.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {photos.map((p, i) => (
                        <div key={p.url} className="relative aspect-square border border-[var(--mkc-border)] overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={p.name} className="w-full h-full object-cover" style={{ filter: "brightness(0.85)" }} />
                          <button
                            onClick={() => removePhoto(i)}
                            aria-label="Retirer la photo"
                            className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center text-xs"
                            style={{ background: "rgba(11,11,12,0.85)", color: "var(--mkc-text)", border: "1px solid var(--mkc-border)" }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {photos.length < 8 && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square border border-dashed border-[var(--mkc-border)] flex items-center justify-center text-2xl font-light"
                          style={{ color: "var(--mkc-muted)" }}
                          type="button"
                        >
                          +
                        </button>
                      )}
                    </div>
                  )}
                </ConfigStep>

                {/* 05 Note */}
                <ConfigStep n="05" title={COPY.noteForArtist} extra={<span className="text-[11px] font-light tracking-[0.08em] uppercase" style={{ color: "var(--mkc-muted)" }}>{COPY.optional}</span>}>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 400))}
                    rows={4}
                    className="mkc-textarea w-full px-4 py-3 text-sm resize-none"
                    placeholder={COPY.notePlaceholder}
                  />
                  <div className="text-[11px] font-light mt-1 text-right" style={{ color: "var(--mkc-muted-2)" }}>{note.length} / 400</div>
                </ConfigStep>

                {/* 06 Print */}
                <ConfigStep n="06" title={COPY.printSupportStep}>
                  <div className="grid grid-cols-2 gap-4">
                    {PRINT_OPTIONS.map((opt, i) => (
                      <button
                        key={opt.key}
                        onClick={() => setSelectedPrint(i)}
                        className={`mkc-card mkc-tile overflow-hidden relative ${selectedPrint === i ? "mkc-selected" : ""}`}
                      >
                        {opt.badge && (
                          <div className="absolute top-2 left-2 z-10 text-[10px] tracking-[0.1em] uppercase px-2 py-1" style={{ background: "var(--mkc-accent)", color: "#0b0b0c" }}>
                            {opt.badge}
                          </div>
                        )}
                        <div className="relative aspect-[5/3]" style={{ background: "var(--mkc-bg-raise)" }}>
                          <Image src={opt.img} alt={opt.label} fill className="object-contain p-4" sizes="240px" style={{ filter: "brightness(0.88)" }} />
                        </div>
                        <div className="px-3.5 py-3 border-t border-[var(--mkc-border)] flex items-center justify-between gap-2">
                          <div>
                            <div className="mkc-display text-base leading-tight">{opt.label}</div>
                            <div className="text-[11px] font-light" style={{ color: "var(--mkc-muted)" }}>{opt.sub}</div>
                          </div>
                          <div className="mkc-display text-base" style={{ color: "var(--mkc-accent)" }}>
                            {formatEUR(PRICES.base + opt.addon)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ConfigStep>

                {/* Summary */}
                <div className="mkc-card p-6 md:p-7">
                  <div className="mkc-display text-lg mb-4">{COPY.summary}</div>
                  <div className="space-y-2 text-sm font-light">
                    <SummaryRow
                      label={`${format === "portrait" ? COPY.portrait : COPY.fullbody} · ${PRINT_OPTIONS[selectedPrint].label}`}
                      value={formatEUR(PRICES.base + PRINT_OPTIONS[selectedPrint].addon)}
                    />
                    {format === "fullbody" && (
                      <SummaryRow label={`+ ${COPY.fullbody}`} value={`+${formatEUR(PRICES.fullbodyExtra)}`} />
                    )}
                    {people > 1 && (
                      <SummaryRow label={`+${people - 1} ${COPY.peoplePlural}`} value={`+${formatEUR((people - 1) * PRICES.extraPerson)}`} />
                    )}
                    {animals > 0 && (
                      <SummaryRow label={`+${animals} ${animals > 1 ? COPY.animalsPlural : COPY.animalsSingular}`} value={`+${formatEUR(animals * PRICES.extraAnimal)}`} />
                    )}
                    <SummaryRow label={COPY.revisionsIncluded} value={COPY.included} muted />
                    <div className="h-px my-3" style={{ background: "var(--mkc-border)" }} />
                    <div className="flex items-end justify-between pt-1">
                      <span className="mkc-display text-lg">{COPY.total}</span>
                      <span className="mkc-display text-4xl" style={{ color: "var(--mkc-accent)" }}>{formatEUR(total)}</span>
                    </div>
                  </div>

                  <div className="relative mt-6">
                    <button onClick={onAddToCart} className="mkc-btn w-full">
                      {COPY.addToCart} · {formatEUR(total)}
                      <span aria-hidden>→</span>
                    </button>
                    {toastVisible && (
                      <div
                        className="mkc-toast absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+12px)] whitespace-nowrap text-[11px] tracking-[0.08em] uppercase px-4 py-2.5"
                        style={{ background: "var(--mkc-surface-2)", border: "1px solid var(--mkc-accent)", color: "var(--mkc-accent)" }}
                        role="status"
                      >
                        {COPY.previewOnlyToast}
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] font-light text-center mt-3" style={{ color: "var(--mkc-muted-2)" }}>{COPY.paymentReassurance}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════ GALLERY ══════════════════ */}
        <section className="py-24 border-b border-[var(--mkc-border)]">
          <div className="max-w-7xl mx-auto px-6 md:px-10 mb-12 text-center">
            <div className="mkc-kicker mb-4">{COPY.galleryLabel}</div>
            <h2 className="mkc-display text-[clamp(2rem,4.2vw,3.4rem)]">{COPY.galleryTitle}</h2>
            <p className="text-sm font-light mt-4" style={{ color: "var(--mkc-muted)" }}>{COPY.gallerySub}</p>
            <div className="mkc-rule center mt-6" />
          </div>
          <div className="mkc-scrollbar flex gap-4 overflow-x-auto px-6 md:px-10 pb-4 snap-x" style={{ scrollSnapType: "x mandatory" }}>
            {GALLERY_PHOTOS.map((src, i) => (
              <button
                key={src}
                onClick={() => setGalleryLightbox(i)}
                className="mkc-gallery-frame relative w-[70vw] sm:w-[320px] aspect-[4/5] overflow-hidden border border-[var(--mkc-border)]"
              >
                <Image src={src} alt={`Réalisation Cartoonova ${i + 1}`} fill sizes="(max-width: 640px) 70vw, 320px" className="object-cover" style={{ filter: "brightness(0.8)" }} />
                <div className="mkc-gallery-caption">
                  <div className="text-[11px] tracking-[0.15em] uppercase" style={{ color: "var(--mkc-accent)" }}>Réalisation {String(i + 1).padStart(2, "0")}</div>
                </div>
              </button>
            ))}
          </div>

          {galleryLightbox !== null && (
            <div
              className="fixed inset-0 z-[9998] flex items-center justify-center p-6"
              style={{ background: "rgba(11,11,12,0.94)" }}
              onClick={() => setGalleryLightbox(null)}
            >
              <div className="relative w-full max-w-2xl aspect-[4/5]" onClick={(e) => e.stopPropagation()}>
                <Image src={GALLERY_PHOTOS[galleryLightbox]} alt="Réalisation Cartoonova en grand" fill sizes="90vw" className="object-contain" />
              </div>
              <button
                onClick={() => setGalleryLightbox(null)}
                aria-label="Fermer"
                className="absolute top-6 right-6 w-11 h-11 flex items-center justify-center text-xl"
                style={{ border: "1px solid var(--mkc-border)", color: "var(--mkc-text)" }}
              >
                ×
              </button>
            </div>
          )}
        </section>

        {/* ══════════════════ REVIEWS ══════════════════ */}
        <section className="py-24 border-b border-[var(--mkc-border)]">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <div className="grid md:grid-cols-[auto_1fr] gap-12 items-center mb-14">
              <div className="text-center md:text-left">
                <div className="mkc-kicker mb-4">{COPY.reviewsLabel}</div>
                <div className="flex items-end gap-3 justify-center md:justify-start">
                  <div className="mkc-display text-7xl leading-none" style={{ color: "var(--mkc-accent)" }}>
                    {STATS.rating.toString().replace(".", ",")}
                  </div>
                  <div className="mkc-display text-2xl mb-2" style={{ color: "var(--mkc-muted)" }}>/5</div>
                </div>
                <div className="flex text-xl leading-none mt-2 justify-center md:justify-start" aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={i < Math.round(STATS.rating) ? "mkc-star" : "mkc-star mkc-empty"}>★</span>
                  ))}
                </div>
                <div className="text-sm font-light mt-3" style={{ color: "var(--mkc-muted)" }}>
                  {COPY.basedOn} <span style={{ color: "var(--mkc-text)" }}>{STATS.reviewCount.toLocaleString("fr-FR")} {COPY.verifiedReviews}</span>
                </div>
              </div>
              <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 gap-y-2 max-w-md mx-auto md:mx-0 w-full items-center">
                {STATS.distribution.map((d) => (
                  <div key={d.stars} className="contents">
                    <div className="text-xs font-light" style={{ color: "var(--mkc-muted)" }}>{d.stars} ★</div>
                    <div className="h-[2px]" style={{ background: "var(--mkc-border)" }}>
                      <div className="h-full" style={{ width: `${d.pct}%`, background: "var(--mkc-accent)" }} />
                    </div>
                    <div className="text-xs font-light text-right" style={{ color: "var(--mkc-muted)" }}>{d.pct}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {REVIEWS.map((r, i) => (
                <div key={i} className="mkc-card p-6">
                  <div className="flex text-base leading-none mb-3" aria-hidden>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <span key={j} className="mkc-star">★</span>
                    ))}
                  </div>
                  <p className="text-sm font-light leading-relaxed mb-4" style={{ color: "var(--mkc-text)" }}>&ldquo;{r.text}&rdquo;</p>
                  <div className="text-xs tracking-[0.08em] uppercase" style={{ color: "var(--mkc-muted)" }}>— {r.name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════ FAQ ══════════════════ */}
        <section className="py-24 border-b border-[var(--mkc-border)]">
          <div className="max-w-3xl mx-auto px-6 md:px-10">
            <div className="text-center mb-14">
              <div className="mkc-kicker mb-4">FAQ</div>
              <h2 className="mkc-display text-[clamp(2rem,4.2vw,3.4rem)]">{COPY.frequentQuestions}</h2>
              <div className="mkc-rule center mt-6" />
            </div>
            <div className="space-y-3">
              {FAQ_ITEMS.map((f, i) => (
                <div key={i} className={`mkc-card ${openFaq === i ? "mkc-faq-open" : ""}`}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-6 py-5"
                  >
                    <span className="mkc-display text-base md:text-lg">{f.q}</span>
                    <span className="mkc-faq-chev shrink-0 text-xl font-light" style={{ color: "var(--mkc-accent)" }}>+</span>
                  </button>
                  <div className="mkc-faq-panel">
                    <div>
                      <div className="px-6 pb-6 text-sm font-light leading-relaxed" style={{ color: "var(--mkc-muted)" }}>{f.a}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════ FINAL CTA ══════════════════ */}
        <section className="relative py-28 overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src={GALLERY_PHOTOS[GALLERY_PHOTOS.length - 1]}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
              style={{ filter: "brightness(0.32) saturate(0.7)" }}
            />
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(11,11,12,0.55), rgba(11,11,12,0.95))" }} />
          </div>
          <div className="relative max-w-4xl mx-auto px-6 text-center">
            <div className="mkc-kicker mb-6">{STATS.reviewCount.toLocaleString("fr-FR")}+ {COPY.satisfiedClients}</div>
            <h2 className="mkc-display text-[clamp(2.2rem,5.5vw,4.6rem)] leading-[1.05] mb-5">{COPY.ctaTitle}</h2>
            <p className="text-base font-light mb-10" style={{ color: "var(--mkc-muted)" }}>{COPY.ctaSubtitle}</p>
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              {[COPY.pillDrawnHand, COPY.pillDelivered48h, COPY.pillSatisfied, COPY.madeInFrance].map((pill) => (
                <span key={pill} className="text-[11px] tracking-[0.1em] uppercase px-4 py-2 border border-[var(--mkc-border)]" style={{ color: "var(--mkc-muted)" }}>
                  {pill}
                </span>
              ))}
            </div>
            <button className="mkc-btn" onClick={scrollToConfig}>
              {COPY.orderCta}
              <span aria-hidden>→</span>
            </button>
          </div>
        </section>
      </div>

      <MockupSwitcher />
    </>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function ConfigStep({
  n,
  title,
  extra,
  children,
}: {
  n: string;
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <div className="flex items-baseline gap-3">
          <span className="mkc-display text-sm" style={{ color: "var(--mkc-accent)" }}>{n}</span>
          <h3 className="mkc-display text-xl">{title}</h3>
        </div>
        {extra}
      </div>
      {children}
    </div>
  );
}

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
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mkc-card p-5">
      <div className="text-xs tracking-[0.1em] uppercase mb-4" style={{ color: "var(--mkc-muted)" }}>{label}</div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="mkc-stepper-btn"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <div className="mkc-display text-3xl tabular-nums">{value}</div>
        <button
          type="button"
          className="mkc-stepper-btn"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
      {hint && <div className="text-[11px] font-light mt-3 text-center" style={{ color: "var(--mkc-muted-2)" }}>{hint}</div>}
    </div>
  );
}

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-3" style={{ color: muted ? "var(--mkc-muted-2)" : "var(--mkc-text)" }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
