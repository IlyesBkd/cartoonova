"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode, type CSSProperties } from "react";
import Image from "next/image";
import CheckoutModal from "@/components/CheckoutModal";
import type { PrintKey } from "@/lib/pricing";
import GiftDeadlineNote from "@/components/GiftDeadlineNote";
import type { Prices } from "@/lib/types";
import { useCurrency } from "@/components/CurrencyProvider";
import { useTranslations } from "next-intl";
import { upload } from "@vercel/blob/client";
import { useProductTracking, PRODUCT_CONFIGS } from "@/hooks/useProductTracking";

const BACKGROUNDS: { src: string; key: string }[] = [];

const GALLERY_PHOTOS = [
  "/onepiece/wanted_produit/il_1140xN.7027231626_qn94.png",
  "/onepiece/wanted_produit/il_1140xN.7075208403_h6ii.png",
  "/onepiece/wanted_produit/il_1140xN.7075208427_9pky.png",
  "/onepiece/wanted_produit/il_1140xN.7075210791_t70l.png",
  "/onepiece/wanted_produit/il_1140xN.7263590518_s1vk.png",
  "/onepiece/wanted_produit/il_1140xN.7263593458_c94y.png",
  "/onepiece/wanted_produit/il_1140xN.7311536425_c0lx.png",
  "/onepiece/wanted_produit/8.png",
];

const HERO_SLIDES = GALLERY_PHOTOS.slice(0, 5);

function AnimatedPrice({ value, formatter }: { value: number; formatter: (n: number) => string }) {
  const [displayed, setDisplayed] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    const from = ref.current;
    const to = value;
    if (from === to) return;
    const dur = 400;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
      else ref.current = to;
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{formatter(Math.round(displayed * 100) / 100)}</>;
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="bg-white border-[2.5px] border-black rounded-full px-3 py-1.5 inline-block" style={{ boxShadow: "0 2px 0 #000" }}>{children}</span>;
}
function Chip({ children, highlight }: { children: ReactNode; highlight?: boolean }) {
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full border-2 border-black ${highlight ? "bg-[var(--cn-yellow)]" : "bg-white"}`}>{children}</span>;
}
function Step({ n, title, extra, children }: { n: string; title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="cn-card flat bg-white p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--cn-yellow)] border-[2.5px] border-black flex items-center justify-center font-display text-sm" style={{ boxShadow: "0 2px 0 #000" }}>{n}</div>
          <h3 className="font-display text-xl">{title}</h3>
        </div>
        {extra}
      </div>
      {children}
    </div>
  );
}
function Counter({ label, icon, value, min, max, hint, onChange }: { label: string; icon: string; value: number; min: number; max: number; hint?: string; onChange: (v: number) => void }) {
  return (
    <div className="cn-card flat bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="font-display text-base">{label}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="w-11 h-11 rounded-full bg-[var(--cn-yellow)] border-[2.5px] border-black font-display text-2xl press disabled:opacity-40 disabled:cursor-not-allowed" style={{ boxShadow: "0 3px 0 #000" }}>−</button>
        <div className="font-display text-4xl tabular-nums">{value}</div>
        <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="w-11 h-11 rounded-full bg-[var(--cn-yellow)] border-[2.5px] border-black font-display text-2xl press disabled:opacity-40 disabled:cursor-not-allowed" style={{ boxShadow: "0 3px 0 #000" }}>+</button>
      </div>
      {hint && <div className="text-[11px] font-bold text-[var(--cn-ink-soft)] mt-2 text-center">{hint}</div>}
    </div>
  );
}
function FloatingReview({ style, text, name, stars }: { style: CSSProperties; text: string; name: string; stars: number }) {
  return (
    <div className="absolute floaty cn-card flat px-4 py-3 max-w-[220px] bg-white z-10" style={style}>
      <div className="flex text-[var(--cn-yellow-deep)] leading-none text-sm mb-1">{"★".repeat(stars)}</div>
      <div className="text-sm font-bold leading-tight">&ldquo;{text}&rdquo;</div>
      <div className="text-xs text-[var(--cn-ink-soft)] mt-1">— {name} <span className="text-[var(--cn-mint)]">✓</span></div>
    </div>
  );
}
function Confetti() {
  const dots = Array.from({ length: 22 }).map((_, i) => ({
    top: `${(i * 47) % 90 + 5}%`,
    left: `${(i * 113) % 95 + 2}%`,
    color: ["#fff", "#1E4FB5", "#FF6B5B", "#1A1A1A", "#6FD8B5"][i % 5],
    r: (i * 33) % 360,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none">
      {dots.map((d, i) => (
        <div key={i} className="confetti-dot" style={{ top: d.top, left: d.left, background: d.color, transform: `rotate(${d.r}deg)` }} />
      ))}
    </div>
  );
}

export default function ProductPage() {
  const t = useTranslations("product");
  const tp = useTranslations("product");
  const socialProofNames = useTranslations("socialProof").raw("names") as string[];
  const { formatRaw: formatPrice, currency } = useCurrency();
  const { trackOptionSelected, trackPhotoUploaded, trackCheckoutStarted } = useProductTracking(PRODUCT_CONFIGS.onepiece);

  const [format, setFormat] = useState<"portrait" | "fullbody">("portrait");
  const [people, setPeople] = useState(1);
  const [animals, setAnimals] = useState(0);
  const [selectedBg, setSelectedBg] = useState(0);
  const [hoveredBg, setHoveredBg] = useState<number | null>(null);
  const [selectedPrint, setSelectedPrint] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [activeHero, setActiveHero] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [description, setDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastName, setToastName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const configRef = useRef<HTMLElement>(null);

  const backgrounds = BACKGROUNDS.map((bg) => ({ ...bg, label: t(bg.key as "bgBar") }));
  const faqData = [
    { q: t("faqQ1"), a: t("faqA1") },
    { q: t("faqQ2"), a: t("faqA2") },
    { q: t("faqQ3"), a: t("faqA3") },
    { q: t("faqQ4"), a: t("faqA4") },
    { q: t("faqQ5"), a: t("faqA5") },
  ];
  const reviews = [
    { name: t("review1Name"), text: t("review1Text") },
    { name: t("review2Name"), text: t("review2Text") },
    { name: t("review3Name"), text: t("review3Text") },
    { name: t("review4Name"), text: t("review4Text") },
    { name: t("review5Name"), text: t("review5Text") },
    { name: t("review6Name"), text: t("review6Text") },
  ];

  useEffect(() => { fetch(`/api/prices?currency=${currency}`).then((r) => r.json()).then(setPrices); }, [currency]);
  useEffect(() => {
    const i = setInterval(() => setActiveHero((p) => (p + 1) % HERO_SLIDES.length), 3400);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    if (!socialProofNames?.length) return;
    const show = () => {
      setToastName(socialProofNames[Math.floor(Math.random() * socialProofNames.length)]);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 8000);
    };
    const initial = setTimeout(show, 4000);
    const interval = setInterval(show, 35000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [socialProofNames]);

  const prints = prices ? [
    { img: "/onepiece/digital.png", key: "digital", label: t("digital"), sub: tp("digitalSub"), addon: prices.digital, displayPrice: prices.digital + prices.base, badge: tp("fastestBadge") },
    { img: "/onepiece/poster.png", key: "posterSimple", label: t("posterOption"), sub: tp("posterSimpleSub"), addon: prices.posterSimple, displayPrice: prices.posterSimple + prices.base, badge: "" },
    { img: "/onepiece/portrait_sur_toile.png", key: "canvas", label: t("canvas"), sub: tp("canvasSub"), addon: prices.canvas, displayPrice: prices.canvas + prices.base, badge: tp("bestsellerBadge") },
    { img: "/onepiece/portrait_encadré.png", key: "framed", label: t("poster"), sub: tp("framedSub"), addon: prices.poster, displayPrice: prices.poster + prices.base, badge: "" },
  ] : [];

  const total = prices ? prices.base + (format === "fullbody" ? prices.fullbodyExtra : 0) + (people - 1) * prices.extraPerson + animals * prices.extraAnimal + (prints[selectedPrint]?.addon ?? 0) : 0;

  const hasDecor = backgrounds.length > 0;
  const previewBgIndex = hoveredBg !== null ? hoveredBg : selectedBg;
  const previewSrc = hasDecor ? backgrounds[previewBgIndex].src : GALLERY_PHOTOS[activeHero % GALLERY_PHOTOS.length];
  const previewLabel = hasDecor ? backgrounds[previewBgIndex].label : "";
  const currentBgKey = hasDecor ? backgrounds[selectedBg].key : "default";
  const currentBgLabel = hasDecor ? backgrounds[selectedBg].label : "";
  const orderDescription = `${format === "fullbody" ? t("fullbody") : t("portrait")} · ${people} ${t("people")} ${animals > 0 ? ` + ${animals} ${t("animals")}${animals > 1 ? "s" : ""}` : ""} · ${prints[selectedPrint]?.label || t("digital")}`;

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setUploadError("");
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 8)) {
        const blob = await upload(`orders/${Date.now()}-${file.name}`, file, { access: "public", handleUploadUrl: "/api/upload" });
        urls.push(blob.url);
      }
      setUploadedPhotos((prev) => [...prev, ...urls].slice(0, 8));
      trackPhotoUploaded(urls.length);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    } catch {
      setUploadError(t("uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const scrollToConfig = useCallback(() => {
    configRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const onAddToCart = () => {
    trackCheckoutStarted(total, currency, { format, people, animals, background: currentBgKey, printOption: prints[selectedPrint]?.label || "digital" });
    setShowCheckout(true);
  };

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Caveat+Brush&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet" />

      <style>{`
        :root {
          --cn-yellow: #FFD426;
          --cn-yellow-deep: #F5B800;
          --cn-ink: #1A1A1A;
          --cn-ink-soft: #2D2D2D;
          --cn-paper: #FFF9E8;
          --cn-paper-warm: #FFF1C7;
          --cn-sky-1: #FFEFA3;
          --cn-sky-2: #B8E0FF;
          --cn-sky-3: #DDF4FF;
          --cn-blue-deep: #1E4FB5;
          --cn-coral: #FF6B5B;
          --cn-mint: #6FD8B5;
        }
        .cn-root { background: var(--cn-paper); color: var(--cn-ink); font-family: 'Nunito', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .cn-root * { -webkit-tap-highlight-color: transparent; }
        .font-display { font-family: 'Bagel Fat One', 'Lilita One', system-ui, sans-serif; letter-spacing: 0.005em; font-weight: 400; }
        .font-hand { font-family: 'Caveat Brush', system-ui, sans-serif; font-weight: 400; }
        .cn-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; border: 3px solid #111; background: var(--cn-yellow); color: var(--cn-ink); font-family: 'Bagel Fat One', system-ui, sans-serif; font-size: 1.05rem; padding: 0.85rem 1.5rem; border-radius: 999px; box-shadow: 0 5px 0 0 #111; transition: transform 120ms ease, box-shadow 120ms ease; cursor: pointer; user-select: none; }
        .cn-btn:hover { transform: translateY(-2px); box-shadow: 0 7px 0 0 #111; }
        .cn-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 0 #111; }
        .cn-btn.lg { padding: 1.1rem 2rem; font-size: 1.25rem; }
        .cn-btn.xl { padding: 1.35rem 2.6rem; font-size: 1.5rem; }
        .cn-btn.ghost { background: #fff; }
        .cn-btn.dark { background: var(--cn-ink); color: var(--cn-yellow); }
        .cn-card { border: 3px solid #111; border-radius: 24px; background: #fff; box-shadow: 0 6px 0 0 #111; }
        .cn-card.flat { box-shadow: 0 3px 0 0 #111; }
        .sky-bg { background: radial-gradient(ellipse at 18% 12%, rgba(255,255,255,0.62), transparent 45%), radial-gradient(ellipse at 82% 80%, rgba(255,255,255,0.58), transparent 50%), linear-gradient(160deg, var(--cn-sky-3) 0%, var(--cn-sky-2) 45%, var(--cn-sky-1) 100%); }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .marquee-track { animation: marquee 28s linear infinite; }
        @keyframes float-y { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)); } 50% { transform: translateY(-8px) rotate(var(--r,0deg)); } }
        .floaty { animation: float-y 4.2s ease-in-out infinite; }
        @keyframes toast-in { 0% { transform: translate(-8px,14px) scale(.92); opacity: 0; } 60% { transform: translate(0,-2px) scale(1.02); opacity: 1; } 100% { transform: translate(0,0) scale(1); opacity: 1; } }
        .toast-in { animation: toast-in 420ms cubic-bezier(.2,.9,.3,1.2) both; }
        @keyframes price-flash { 0% { transform: scale(1); color: var(--cn-ink); } 35% { transform: scale(1.12); color: var(--cn-blue-deep); } 100% { transform: scale(1); color: var(--cn-ink); } }
        .price-flash { animation: price-flash 480ms ease; }
        .faq-chev { transition: transform 240ms cubic-bezier(.4,0,.2,1); }
        .faq-open .faq-chev { transform: rotate(45deg); }
        .faq-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 320ms ease; }
        .faq-open .faq-panel { grid-template-rows: 1fr; }
        .faq-panel > div { overflow: hidden; }
        @keyframes hero-pop { 0% { transform: scale(.96) rotate(-1deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        .hero-pop { animation: hero-pop 600ms cubic-bezier(.2,.9,.3,1.2); }
        .doodle-underline { position: relative; display: inline-block; }
        .doodle-underline svg { position: absolute; left: -4%; right: -4%; bottom: -14px; width: 108%; height: 18px; }
        .drop-active { background: var(--cn-paper-warm) !important; border-color: var(--cn-blue-deep) !important; }
        .tile-selected { outline: 4px solid var(--cn-yellow); outline-offset: 3px; position: relative; }
        .tile-selected::after { content: '✓'; position: absolute; top: -10px; right: -10px; width: 28px; height: 28px; background: var(--cn-yellow); border: 3px solid #111; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-family: 'Bagel Fat One', sans-serif; font-size: 14px; color: var(--cn-ink); box-shadow: 0 2px 0 #111; }
        .section-label { display: inline-flex; align-items: center; gap: 0.5rem; background: var(--cn-ink); color: var(--cn-yellow); font-family: 'Bagel Fat One', sans-serif; padding: 0.35rem 0.9rem; border-radius: 999px; font-size: 0.95rem; letter-spacing: 0.04em; text-transform: uppercase; }
        .press { transition: transform 100ms ease; }
        .press:active { transform: scale(.97); }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .spin-slow { animation: spin-slow 18s linear infinite; }
        .confetti-dot { position: absolute; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #111; }
        @keyframes confetti-fall { 0% { transform: translateY(-20px) rotate(0); opacity: 1; } 100% { transform: translateY(400px) rotate(720deg); opacity: 0; } }
        .animate-confetti { animation: confetti-fall 2s ease-out forwards; }
      `}</style>

      <div className="cn-root sky-bg min-h-screen">
        {/* ═══ HERO ═══ */}
        <section className="relative pt-8 pb-20 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            {[{ top: "12%", left: "6%", s: 1.0 }, { top: "22%", left: "78%", s: 0.7 }, { top: "60%", left: "2%", s: 0.8 }, { top: "72%", left: "88%", s: 1.1 }, { top: "40%", left: "46%", s: 0.5 }].map((c, i) => (
              <svg key={i} className="absolute" viewBox="0 0 80 36" style={{ top: c.top, left: c.left, width: 140 * c.s, opacity: 0.85 }}>
                <g fill="#fff"><ellipse cx="20" cy="22" rx="20" ry="12" /><ellipse cx="42" cy="18" rx="22" ry="14" /><ellipse cx="64" cy="24" rx="16" ry="10" /></g>
              </svg>
            ))}
          </div>

          <div className="max-w-7xl mx-auto px-6 relative">
            <div className="text-sm font-bold text-[var(--cn-ink-soft)] mb-6 flex items-center gap-2">
              <span className="opacity-60">{tp("universe")}</span>
              <span className="opacity-60">›</span>
              <span>{tp("simpsonStyle")}</span>
            </div>

            <div className="grid md:grid-cols-[1.1fr_1fr] gap-10 items-center">
              <div className="relative">
                <h1 className="font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] mb-3">
                  {t("heroTitle1")}{" "}
                  <span className="doodle-underline text-[var(--cn-yellow-deep)]">
                    {t("heroTitle2")}
                    <svg viewBox="0 0 220 18" preserveAspectRatio="none"><path d="M2 12 Q 60 2 110 10 T 218 8" stroke="#1A1A1A" strokeWidth="6" strokeLinecap="round" fill="none" /></svg>
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-[var(--cn-ink-soft)] font-semibold mb-8 max-w-xl">
                  {t("heroSubtitle")}
                  <span className="bg-[var(--cn-yellow)] px-1.5 rounded-md mx-1 whitespace-nowrap">{tp("delivered48h")}</span>
                  {tp("satisfiedOrRefunded")}.
                </p>

                <div className="flex flex-wrap gap-4 items-center mb-6">
                  <button className="cn-btn xl" onClick={scrollToConfig}>
                    {tp("orderCta")}
                    <span className="text-2xl ml-1">→</span>
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-3">
                      {GALLERY_PHOTOS.slice(0, 4).map((src, i) => (
                        <div key={i} className="w-9 h-9 rounded-full border-[2.5px] border-black overflow-hidden relative">
                          <Image src={src} alt="" fill className="object-cover" sizes="36px" />
                        </div>
                      ))}
                    </div>
                    <div className="leading-tight">
                      <div className="flex text-[var(--cn-yellow-deep)] text-lg leading-none">★★★★★</div>
                      <div className="text-sm font-bold">4,9/5 · 2 540 {tp("verifiedReviews")}</div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="relative h-[480px] md:h-[560px]">
                <svg className="absolute inset-0 m-auto spin-slow" viewBox="0 0 600 600" style={{ width: "110%", height: "110%" }}>
                  <g fill="none" stroke="#1A1A1A" strokeWidth="3" strokeDasharray="2 18" strokeLinecap="round" opacity="0.18">
                    <circle cx="300" cy="300" r="260" />
                  </g>
                </svg>

                <div className="absolute inset-x-4 inset-y-0 cn-card overflow-hidden bg-white">
                  <div className="relative w-full h-full">
                    {HERO_SLIDES.map((src, i) => (
                      <div key={i} className={`absolute inset-0 transition-opacity duration-700 ${i === activeHero ? "hero-pop opacity-100" : "opacity-0 pointer-events-none"}`}>
                        <Image src={src} alt="Portrait onepiece personnalisé" fill className="object-cover" priority={i === 0} sizes="(max-width: 768px) 92vw, 44vw" />
                      </div>
                    ))}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
                      {HERO_SLIDES.map((_, i) => (
                        <button key={i} onClick={() => setActiveHero(i)} aria-label={`Slide ${i + 1}`} className="h-2.5 rounded-full border-2 border-black transition-all" style={{ background: i === activeHero ? "#FFD426" : "#fff", width: i === activeHero ? 22 : 10 }} />
                      ))}
                    </div>
                  </div>
                </div>

                <FloatingReview style={{ bottom: "6%", right: "-4%", "--r": "4deg" } as CSSProperties} text={reviews[1]?.text || ""} name={reviews[1]?.name || ""} stars={5} />

              </div>
            </div>
          </div>

          <div className="mt-16 border-y-[3px] border-black bg-[var(--cn-ink)] text-[var(--cn-yellow)] overflow-hidden">
            <div className="flex marquee-track whitespace-nowrap py-3 font-display text-xl">
              {Array.from({ length: 2 }).map((_, k) => (
                <div key={k} className="flex items-center gap-10 px-5">
                  <span>+2 540 {tp("portraitsDelivered")}</span><span className="opacity-50">●</span>
                  <span>{tp("delivery48h")}</span><span className="opacity-50">●</span>
                  <span>{tp("handDrawn")}</span><span className="opacity-50">●</span>
                  <span>{tp("satisfiedOrRefunded")}</span><span className="opacity-50">●</span>
                  <span>{tp("freeRevisions")}</span><span className="opacity-50">●</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section className="py-12 relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-8">
              <div className="section-label mb-3">{tp("howItWorks")}</div>
              <h2 className="font-display text-[clamp(1.8rem,3vw,2.6rem)] leading-tight">{tp("howItWorksTitle")}</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4 relative">
              <svg className="hidden md:block absolute top-[54px] left-[14%] right-[14%] h-7 pointer-events-none" viewBox="0 0 800 30" preserveAspectRatio="none">
                <path d="M 10 18 Q 200 -6 400 18 T 790 16" stroke="#1A1A1A" strokeWidth="3" strokeDasharray="2 9" fill="none" strokeLinecap="round" />
              </svg>
              {[
                { icon: "📸", title: tp("guaranteeStep1Title"), desc: tp("guaranteeStep1Desc"), tint: "#A8D8FF" },
                { icon: "🎨", title: tp("guaranteeStep2Title"), desc: tp("guaranteeStep2Desc"), tint: "#FFE08A" },
                { icon: "✅", title: tp("guaranteeStep3Title"), desc: tp("guaranteeStep3Desc"), tint: "#FFC5DE" },
              ].map((s, i) => (
                <div key={i} className="cn-card p-5 md:p-6 text-center bg-white relative">
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-[var(--cn-ink)] text-[var(--cn-yellow)] flex items-center justify-center font-display text-base border-[2.5px] border-black" style={{ boxShadow: "0 2px 0 #000" }}>{i + 1}</div>
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full border-[2.5px] border-black flex items-center justify-center text-3xl" style={{ background: s.tint, boxShadow: "0 3px 0 #000" }}>{s.icon}</div>
                  <h3 className="font-display text-xl mb-1.5">{s.title}</h3>
                  <p className="text-sm text-[var(--cn-ink-soft)] font-semibold">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CONFIGURATOR ═══ */}
        <section ref={configRef} id="configurator" className="py-20 border-t-[3px] border-black">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-10">
              <div className="section-label mb-4">{tp("configurator")}</div>
              <h2 className="font-display text-[clamp(2rem,4vw,3.4rem)] leading-tight">{tp("composeYourPortrait")}</h2>
              <p className="text-[var(--cn-ink-soft)] font-semibold mt-3">{tp("guidedSteps")}</p>
            </div>

            <div className="grid lg:grid-cols-[1.05fr_1fr] gap-8">
              {/* LIVE PREVIEW */}
              <div className="hidden md:block lg:sticky lg:top-6 lg:self-start">
                <div className="cn-card overflow-hidden bg-white relative">
                  <div className="relative aspect-[4/5]">
                    <Image src={previewSrc} alt={previewLabel || "Aperçu"} fill className="object-cover transition-all duration-300" sizes="(max-width: 1024px) 92vw, 540px" />
                    {hasDecor && (
                      <div className="absolute top-3 left-3 bg-white border-[2.5px] border-black rounded-full px-3 py-1 text-xs font-bold" style={{ boxShadow: "0 2px 0 #000" }}>
                        {tp("decorChip")} · {previewLabel}
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                      <div className="bg-black/70 text-white text-[10px] font-mono px-2 py-1 rounded">{tp("illustrativePreview")}</div>
                    </div>
                    {showConfetti && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {[...Array(20)].map((_, i) => (
                          <div key={i} className="absolute w-2 h-2 rounded-full animate-confetti" style={{ left: `${10 + Math.random() * 80}%`, top: "10%", backgroundColor: ["#FACC15", "#FB923C", "#34D399", "#60A5FA", "#F472B6"][i % 5], animationDelay: `${Math.random() * 0.5}s` }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="border-t-[3px] border-black p-4 flex flex-wrap gap-2 bg-[var(--cn-paper-warm)]">
                    <Chip>{format === "portrait" ? tp("portrait") : tp("fullbody")}</Chip>
                    <Chip>{people} {people > 1 ? tp("peoplePlural") : tp("peopleSingular")}</Chip>
                    {animals > 0 && <Chip>{animals} {animals > 1 ? tp("animalsPlural") : tp("animalsSingular")}</Chip>}
                    {hasDecor && <Chip>{currentBgLabel}</Chip>}
                    <Chip highlight>{prints[selectedPrint]?.label || t("digital")}</Chip>
                  </div>
                </div>
                <div className="mt-4 text-sm font-bold text-[var(--cn-ink-soft)] text-center">
                  ⏱ {tp("estimatedDelay")} : <span className="text-black">{tp("digital48h")}</span> · {tp("print57Days")}
                </div>
              </div>

              {/* STEPS */}
              <div className="space-y-6">
                <Step n="01" title={tp("framingStep")}>
                  <div className="grid grid-cols-2 gap-3">
                    {(["portrait", "fullbody"] as const).map((f) => (
                      <button key={f} onClick={() => { setFormat(f); trackOptionSelected("format", f); }} className={`cn-card flat bg-white text-left overflow-hidden press ${format === f ? "tile-selected" : ""}`}>
                        <div className="aspect-[5/3] bg-[var(--cn-paper-warm)] flex items-center justify-center text-5xl">{f === "portrait" ? "👤" : "🧍"}</div>
                        <div className="px-3 py-2.5 border-t-[2.5px] border-black">
                          <div className="font-display">{f === "portrait" ? tp("portrait") : tp("fullbody")}</div>
                          <div className="text-xs font-bold text-[var(--cn-ink-soft)]">{f === "portrait" ? tp("portraitSub") : tp("fullbodySub")}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Step>

                <Step n="02" title={tp("whoOnPortrait")}>
                  <div className="grid grid-cols-2 gap-3">
                    <Counter
                      label={tp("peopleLabel")} icon="🧍"
                      value={people} min={1} max={8}
                      hint={prices ? `+${formatPrice(prices.extraPerson)}${tp("perExtraPerson")}` : ""}
                      onChange={(v) => { setPeople(v); trackOptionSelected("people", v, prices ? prices.extraPerson : 0); }}
                    />
                    <Counter
                      label={tp("animalsLabel")} icon="🐾"
                      value={animals} min={0} max={4}
                      hint={prices ? `+${formatPrice(prices.extraAnimal)}${tp("perAnimal")}` : ""}
                      onChange={(v) => { setAnimals(v); trackOptionSelected("animals", v, prices ? prices.extraAnimal : 0); }}
                    />
                  </div>
                </Step>

                {hasDecor && (
                  <Step n="03" title={tp("decorStep")} extra={<span className="text-xs font-bold text-[var(--cn-ink-soft)]">{tp("hoverToPreview")}</span>}>
                    <div className="grid grid-cols-3 gap-3">
                      {backgrounds.map((d, i) => (
                        <button
                          key={d.key}
                          onMouseEnter={() => setHoveredBg(i)}
                          onMouseLeave={() => setHoveredBg(null)}
                          onClick={() => { setSelectedBg(i); trackOptionSelected("background", d.key); }}
                          className={`relative cn-card flat overflow-hidden press text-left ${selectedBg === i ? "tile-selected" : ""}`}
                        >
                          <div className="aspect-square relative">
                            <Image src={d.src} alt="" fill className="object-cover" sizes="160px" />
                          </div>
                          <div className="px-2 py-1.5 border-t-[2.5px] border-black bg-white">
                            <div className="font-display text-[13px] leading-tight">{d.label}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </Step>
                )}

                <Step n="04" title={tp("uploadStep")} extra={<span className="text-xs font-bold text-[var(--cn-ink-soft)]">{tp("uploadMax8")}</span>}>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
                    className={`cn-card flat px-5 py-7 text-center bg-[var(--cn-paper-warm)] transition ${dragOver ? "drop-active" : ""}`}
                    style={{ borderStyle: "dashed" }}
                  >
                    <div className="text-5xl mb-2">📸</div>
                    <div className="font-display text-xl">{tp("dragHere")}</div>
                    <div className="text-sm font-bold text-[var(--cn-ink-soft)] mb-4">{tp("orWord")}</div>
                    <button onClick={() => fileInputRef.current?.click()} className="cn-btn" disabled={uploading}>
                      {uploading ? tp("uploading") : tp("choosePhoto")}
                    </button>
                    <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={(e) => handleUpload(e.target.files)} className="hidden" />
                    <div className="text-xs text-[var(--cn-ink-soft)] font-bold mt-3">{tp("uploadHint")}</div>
                    {uploadError && <div className="text-xs font-bold text-red-600 mt-2">{uploadError}</div>}
                  </div>
                  {uploadedPhotos.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {uploadedPhotos.map((url, i) => (
                        <div key={i} className="relative aspect-square cn-card flat overflow-hidden">
                          <Image src={url} alt="" fill className="object-cover" sizes="100px" unoptimized />
                          <button onClick={() => setUploadedPhotos((prev) => prev.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-6 h-6 bg-white border-2 border-black rounded-full font-bold text-xs leading-none">×</button>
                        </div>
                      ))}
                      {uploadedPhotos.length < 8 && (
                        <button onClick={() => fileInputRef.current?.click()} className="aspect-square cn-card flat bg-white flex items-center justify-center font-display text-3xl text-[var(--cn-ink-soft)]">+</button>
                      )}
                    </div>
                  )}
                </Step>

                <Step n="05" title={tp("noteForArtist")} extra={<span className="text-xs font-bold text-[var(--cn-ink-soft)]">{tp("optional")}</span>}>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 400))}
                    rows={4}
                    className="w-full cn-card flat px-4 py-3 font-body text-base placeholder:text-[var(--cn-ink-soft)] outline-none resize-none"
                    placeholder={tp("notePlaceholder")}
                  />
                  <div className="text-xs text-[var(--cn-ink-soft)] font-bold mt-1 text-right">{description.length} / 400</div>
                </Step>

                <Step n="06" title={tp("printSupportStep")}>
                  <div className="grid grid-cols-2 gap-3">
                    {prints.map((sp, i) => (
                      <button key={sp.key} onClick={() => { setSelectedPrint(i); trackOptionSelected("print", sp.label, sp.addon); }} className={`cn-card flat overflow-hidden text-left press relative ${selectedPrint === i ? "tile-selected" : ""}`}>
                        {sp.badge && (<div className="absolute top-2 left-2 bg-[var(--cn-coral)] text-white border-2 border-black rounded-full px-2 py-0.5 text-[10px] font-display z-10">{sp.badge}</div>)}
                        <div className="aspect-[5/3] bg-[var(--cn-paper-warm)] relative">
                          <Image src={sp.img} alt="" fill className="object-contain p-3" sizes="240px" />
                        </div>
                        <div className="px-3 py-2.5 border-t-[2.5px] border-black bg-white flex items-center justify-between">
                          <div>
                            <div className="font-display text-base leading-tight">{sp.label}</div>
                            <div className="text-[11px] text-[var(--cn-ink-soft)] font-bold">{sp.sub}</div>
                          </div>
                          <div className="font-display text-lg">{formatPrice(sp.displayPrice)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Step>

                <div className="cn-card flat bg-white p-5">
                  <div className="font-display text-lg mb-3">{tp("summary")}</div>
                  <div className="space-y-1.5 text-sm font-semibold">
                    <div className="flex justify-between"><span>{tp("portrait")} · {prints[selectedPrint]?.label || t("digital")}</span><span>{prices ? formatPrice(prints[selectedPrint]?.displayPrice ?? prices.base) : "—"}</span></div>
                    {format === "fullbody" && prices && <div className="flex justify-between"><span>+ {tp("fullbody")}</span><span>+{formatPrice(prices.fullbodyExtra)}</span></div>}
                    {people > 1 && prices && <div className="flex justify-between"><span>+{people - 1} {tp("peoplePlural")}</span><span>+{formatPrice((people - 1) * prices.extraPerson)}</span></div>}
                    {animals > 0 && prices && <div className="flex justify-between"><span>+{animals} {animals > 1 ? tp("animalsPlural") : tp("animalsSingular")}</span><span>+{formatPrice(animals * prices.extraAnimal)}</span></div>}
                    <div className="flex justify-between text-[var(--cn-ink-soft)]"><span>{tp("revisionsIncluded")}</span><span>{tp("included")}</span></div>
                    <div className="border-t-[2px] border-black my-2" />
                    <div className="flex justify-between pt-1"><span className="font-display text-lg">{tp("total")}</span><span className="font-display text-2xl"><AnimatedPrice value={total} formatter={formatPrice} /></span></div>
                  </div>
                  <button onClick={onAddToCart} disabled={!prices} className="cn-btn lg w-full mt-4">
                    {tp("addToCart")} · <AnimatedPrice value={total} formatter={formatPrice} />
                    <span className="text-2xl ml-1">→</span>
                  </button>
                  <div className="text-xs font-bold text-[var(--cn-ink-soft)] text-center mt-2">{tp("paymentReassurance")}</div>
                  <div className="mt-3 flex justify-center">
                    <GiftDeadlineNote />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ GALLERY ═══ */}
        <section className="py-20 border-y-[3px] border-black">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <div className="section-label mb-4">{tp("galleryLabel")}</div>
              <h2 className="font-display text-[clamp(2rem,4vw,3.4rem)] leading-tight">{tp("galleryTitle")}</h2>
              <p className="text-[var(--cn-ink-soft)] font-semibold mt-3">{tp("gallerySub")}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {GALLERY_PHOTOS.map((src, i) => (
                <div key={i} className="group cn-card overflow-hidden bg-white press cursor-pointer relative" style={{ transform: `rotate(${(i % 4 - 1.5) * 0.6}deg)` }}>
                  <div className="relative aspect-square">
                    <Image src={src} alt="" fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="(max-width: 768px) 50vw, 25vw" />
                    <div className="absolute top-2 right-2 bg-[var(--cn-yellow)] border-2 border-black rounded-full px-2 py-0.5 text-[10px] font-display">★ {(4.7 + (i % 4) * 0.07).toFixed(1)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ REVIEWS ═══ */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-[auto_1fr] gap-12 items-center mb-12">
              <div className="text-center md:text-left">
                <div className="section-label mb-4">{tp("reviewsLabel")}</div>
                <div className="flex items-end gap-4 justify-center md:justify-start">
                  <div className="font-display text-[7rem] leading-[0.85] text-[var(--cn-ink)]">4,9</div>
                  <div className="text-3xl font-display text-[var(--cn-ink-soft)] mb-3">/5</div>
                </div>
                <div className="flex text-[var(--cn-yellow-deep)] text-3xl leading-none mt-1 justify-center md:justify-start">★★★★★</div>
                <div className="font-bold mt-2">{tp("basedOn")} <span className="bg-[var(--cn-yellow)] px-1.5 rounded">2 540 {tp("verifiedReviews")}</span></div>
              </div>
              <div className="grid grid-cols-5 gap-2 max-w-md mx-auto md:mx-0">
                {[{ n: 5, pct: 92 }, { n: 4, pct: 6 }, { n: 3, pct: 1.5 }, { n: 2, pct: 0.3 }, { n: 1, pct: 0.2 }].map((r) => (
                  <div key={r.n} className="contents">
                    <div className="text-sm font-bold col-span-1">{r.n} ★</div>
                    <div className="col-span-3 h-3 bg-white border-[2px] border-black rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--cn-yellow)]" style={{ width: `${r.pct}%` }} />
                    </div>
                    <div className="text-sm font-bold col-span-1 text-right">{r.pct}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {reviews.map((r, i) => (
                <div key={i} className="cn-card flat p-5 bg-white">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full border-[2.5px] border-black flex items-center justify-center font-display text-lg" style={{ background: ["#A8D8FF", "#FFE08A", "#FFC5DE", "#B6F0C7", "#D8C2FF", "#FFB8A8"][i % 6] }}>
                      {r.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-display text-base leading-tight">{r.name}</div>
                      <div className="text-xs text-[var(--cn-ink-soft)] font-bold">{tp("verified")}</div>
                    </div>
                    <div className="text-[10px] font-bold bg-[var(--cn-mint)] border-2 border-black rounded-full px-2 py-0.5">✓ {tp("verified")}</div>
                  </div>
                  <div className="flex text-[var(--cn-yellow-deep)] text-lg leading-none mb-2">★★★★★</div>
                  <p className="text-[var(--cn-ink-soft)] font-semibold text-[15px] leading-snug">&ldquo;{r.text}&rdquo;</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="py-20 border-y-[3px] border-black">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-10">
              <div className="section-label mb-4">FAQ</div>
              <h2 className="font-display text-[clamp(2rem,4vw,3.4rem)] leading-tight">{tp("frequentQuestions")}</h2>
            </div>
            <div className="space-y-4">
              {faqData.map((f, i) => (
                <div key={i} className={`cn-card flat bg-white overflow-hidden ${openFaq === i ? "faq-open" : ""}`}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-4 text-left px-5 py-5 font-display text-lg md:text-xl">
                    <span>{f.q}</span>
                    <span className="faq-chev w-9 h-9 shrink-0 rounded-full bg-[var(--cn-yellow)] border-[2.5px] border-black flex items-center justify-center text-2xl leading-none" style={{ boxShadow: "0 2px 0 #000" }}>+</span>
                  </button>
                  <div className="faq-panel">
                    <div>
                      <div className="px-5 pb-5 text-[var(--cn-ink-soft)] font-semibold leading-relaxed">{f.a}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FINAL CTA ═══ */}
        <section className="relative border-y-[4px] border-black overflow-hidden">
          <Confetti />
          <div className="relative max-w-6xl mx-auto px-6 py-20 text-center">
            <div className="inline-block bg-black text-[var(--cn-yellow)] font-display rounded-full px-4 py-1.5 text-sm mb-6">+2 540 {tp("satisfiedClients")}</div>
            <h2 className="font-display text-[clamp(2.4rem,6vw,5.4rem)] leading-[0.95] mb-4">{tp("ctaTitle")}</h2>
            <p className="text-xl font-bold mb-8 text-[var(--cn-ink-soft)]">{tp("ctaSubtitle")}</p>
            <div className="flex flex-wrap justify-center gap-3 mb-8 font-bold text-base">
              <Pill>✏️ {tp("pillDrawnHand")}</Pill>
              <Pill>⚡ {tp("pillDelivered48h")}</Pill>
              <Pill>🔒 {tp("pillSatisfied")}</Pill>
              <Pill>🇫🇷 {tp("madeInFrance")}</Pill>
            </div>
            <button className="cn-btn xl dark" onClick={scrollToConfig}>
              {tp("orderCta")}
              <span className="text-2xl ml-1">→</span>
            </button>
            <div className="text-sm font-bold text-[var(--cn-ink-soft)] mt-4">{tp("paymentReassurance")}</div>
          </div>
        </section>

        {/* ═══ SOCIAL PROOF TOAST ═══ */}
        {toastVisible && toastName && (
          <div className="hidden md:block fixed bottom-24 left-4 z-40">
            <div className="cn-card flat bg-white px-4 py-3 flex items-center gap-3 max-w-[330px] toast-in">
              <div className="w-11 h-11 rounded-full border-[2.5px] border-black overflow-hidden shrink-0 bg-[var(--cn-yellow)] flex items-center justify-center font-display">
                {toastName.charAt(0)}
              </div>
              <div className="text-sm leading-tight flex-1">
                <div className="font-bold"><span className="font-display text-base">{toastName}</span></div>
                <div className="text-[var(--cn-ink-soft)]">{tp("socialProof")}</div>
                <div className="text-xs text-[var(--cn-ink-soft)] opacity-70 mt-0.5">{tp("justNow")} · <span className="text-[var(--cn-mint)] font-bold">✓ {tp("verified")}</span></div>
              </div>
              <button onClick={() => setToastVisible(false)} className="text-[var(--cn-ink-soft)] hover:text-black text-lg w-6 h-6 flex items-center justify-center shrink-0">×</button>
            </div>
          </div>
        )}
      </div>

      {prices && (
        <CheckoutModal
          open={showCheckout}
          orderConfig={{
            format,
            people,
            animals,
            background: currentBgKey,
            printOption: prints[selectedPrint]?.label || t("digital"),
            printKey: (prints[selectedPrint]?.key ?? "digital") as PrintKey,
            total,
            description: orderDescription + (description ? ` | ${description}` : ""),
            photoUrls: uploadedPhotos,
            style: "onepiece",
          }}
          onClose={() => setShowCheckout(false)}
        />
      )}
    </>
  );
}
