"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import CheckoutModal from "@/components/CheckoutModal";
import type { Prices } from "@/lib/types";
import { useCurrency } from "@/components/CurrencyProvider";
import { useTranslations } from "next-intl";
import { upload } from "@vercel/blob/client";
import { useProductTracking, PRODUCT_CONFIGS } from "@/hooks/useProductTracking";

/* ═══════════════════════════════════════════════════════════════════════════
   ASSETS
═══════════════════════════════════════════════════════════════════════════ */
const BACKGROUNDS = [
  { src: "/DBZ/Backgrounds_DBZ/1.jpg", key: "bg1" },
  { src: "/DBZ/Backgrounds_DBZ/2.jpg", key: "bg2" },
  { src: "/DBZ/Backgrounds_DBZ/3.jpg", key: "bg3" },
  { src: "/DBZ/Backgrounds_DBZ/4.jpg", key: "bg4" },
  { src: "/DBZ/Backgrounds_DBZ/5.jpg", key: "bg5" },
  { src: "/DBZ/Backgrounds_DBZ/6.jpg", key: "bg6" },
  { src: "/DBZ/Backgrounds_DBZ/7.jpg", key: "bg7" },
  { src: "/DBZ/Backgrounds_DBZ/8.jpg", key: "bg8" },
];

const GALLERY_PHOTOS = [
  "/DBZ/Photo_produits/1.png",
  "/DBZ/Photo_produits/il_1140xN.7733273072_b9q7.png",
  "/DBZ/Photo_produits/il_1140xN.7781222829_j22o.png",
  "/DBZ/Photo_produits/il_1140xN.7781222843_qc6e.png",
  "/DBZ/Photo_produits/il_1140xN.7781222857_h7cu.png",
  "/DBZ/Photo_produits/il_1140xN.4418149486_poi0.jpg",
  "/DBZ/Photo_produits/il_1140xN.4642601061_1pq4.jpg",
  "/DBZ/Photo_produits/ezgif.com-webp-to-png (7).png",
];

const SOCIAL_PROOF_NAMES = [
  "Sophie de Lyon", "Thomas de Paris", "Marie de Bordeaux", "Lucas de Marseille",
  "Emma de Toulouse", "Hugo de Nantes", "Léa de Strasbourg", "Nathan de Lille",
];

/* ═══════════════════════════════════════════════════════════════════════════
   ANIMATED PRICE — count-up/down fluide
═══════════════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════════════
   CONFETTI — upload celebration
═══════════════════════════════════════════════════════════════════════════ */
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      {[...Array(20)].map((_, i) => (
        <div key={i} className="absolute w-2 h-2 rounded-full animate-confetti" style={{ left: `${10 + Math.random() * 80}%`, backgroundColor: ["#FACC15", "#FB923C", "#34D399", "#60A5FA", "#F472B6"][i % 5], animationDelay: `${Math.random() * 0.5}s`, animationDuration: `${1 + Math.random() * 1}s` }} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function ProductPage() {
  const t = useTranslations("dbz");
  const tp = useTranslations("product");
  const { format: formatPrice, currency } = useCurrency();
  const { trackOptionSelected, trackPhotoUploaded, trackCheckoutStarted } = useProductTracking(PRODUCT_CONFIGS.dbz);

  // Core state
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
  const [activePhoto, setActivePhoto] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Accordion
  const [activeStep, setActiveStep] = useState(0);

  // Gift mode
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");

  // Send photo later
  const [sendPhotoLater, setSendPhotoLater] = useState(false);

  // Upload celebration
  const [showConfetti, setShowConfetti] = useState(false);

  // Social proof toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastName, setToastName] = useState("");

  // Refs
  const heroRef = useRef<HTMLElement>(null);
  const configRef = useRef<HTMLElement>(null);

  // Translated backgrounds
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

  useEffect(() => { fetch("/api/prices").then((r) => r.json()).then(setPrices); }, []);

  useEffect(() => {
    const interval = setInterval(() => setActivePhoto((p) => (p + 1) % 6), 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const show = () => { setToastName(SOCIAL_PROOF_NAMES[Math.floor(Math.random() * SOCIAL_PROOF_NAMES.length)]); setToastVisible(true); setTimeout(() => setToastVisible(false), 4000); };
    const interval = setInterval(show, 35000);
    const initial = setTimeout(show, 12000);
    return () => { clearInterval(interval); clearTimeout(initial); };
  }, []);

  const prints = prices ? [
    { img: "/DBZ/Add-Ons/digital.png", label: t("digital"), price: prices.digital },
    { img: "/DBZ/Add-Ons/poster.jpg", label: t("posterOption"), price: prices.posterSimple },
    { img: "/DBZ/Add-Ons/canvas.jpg", label: t("canvas"), price: prices.canvas },
    { img: "/DBZ/Add-Ons/framed.jpg", label: t("poster"), price: prices.poster },
  ] : [];

  const total = prices ? prices.base + (format === "fullbody" ? prices.fullbodyExtra : 0) + (people - 1) * prices.extraPerson + animals * prices.extraAnimal + (prints[selectedPrint]?.price ?? 0) : 0;

  const orderDescription = `${format === "fullbody" ? t("fullbody") : t("portrait")} · ${people} pers.${animals > 0 ? ` + ${animals} animal${animals > 1 ? "s" : ""}` : ""} · ${prints[selectedPrint]?.label || t("digital")}${isGift ? " · 🎁 Cadeau" : ""}`;

  const previewBgIndex = hoveredBg !== null ? hoveredBg : selectedBg;

  const stepSummaries = [
    format === "fullbody" ? tp("fullbodyLabel") : tp("portrait"),
    `${people} pers.${animals > 0 ? ` + ${animals} animal${animals > 1 ? "s" : ""}` : ""}`,
    uploadedPhotos.length > 0 ? `${uploadedPhotos.length} photo${uploadedPhotos.length > 1 ? "s" : ""}` : sendPhotoLater ? "Envoi après commande" : "—",
    backgrounds[selectedBg].label,
    prints[selectedPrint]?.label || "Digital",
  ];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setUploadError("");
    try {
      const urls: string[] = [];
      for (const file of files) {
        const blob = await upload(`orders/${Date.now()}-${file.name}`, file, { access: "public", handleUploadUrl: "/api/upload" });
        urls.push(blob.url);
      }
      setUploadedPhotos((prev) => [...prev, ...urls]);
      trackPhotoUploaded(urls.length);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    } catch {
      setUploadError(t("uploadError"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const scrollToConfig = useCallback(() => { configRef.current?.scrollIntoView({ behavior: "smooth" }); }, []);
  const goNextStep = useCallback((c: number) => { setActiveStep(Math.min(c + 1, 4)); }, []);

  const STEPS = [
    { num: 1, title: tp("formatLabel"), icon: "👤" },
    { num: 2, title: tp("peopleLabel") + " & " + tp("animalsLabel"), icon: "👥" },
    { num: 3, title: tp("guaranteeStep1Title"), icon: "📸" },
    { num: 4, title: tp("chooseDecor"), icon: "🏠" },
    { num: 5, title: tp("deliveryLabel"), icon: "📦" },
  ];

  return (
    <>
      <div className="min-h-screen bg-orange-50 text-gray-900 overflow-x-hidden">

        {/* SOCIAL PROOF LIVE TOAST */}
        <div className={`fixed bottom-24 lg:bottom-6 left-4 z-50 transition-all duration-500 ${toastVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`}>
          <div className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-3 flex items-center gap-3 max-w-xs">
            <div className="w-8 h-8 rounded-full bg-orange-500 border-2 border-black flex items-center justify-center text-sm">🎨</div>
            <div>
              <p className="text-xs font-bold text-gray-900">{toastName}</p>
              <p className="text-[10px] text-gray-500">{tp("socialProof")}</p>
            </div>
            <span className="text-[10px] text-gray-400 ml-auto whitespace-nowrap">{tp("justNow")}</span>
          </div>
        </div>

        {/* ═══ HERO ═══ */}
        <section ref={heroRef} className="relative bg-orange-50 overflow-hidden">
          {/* Decorative cartoon elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-16 -left-6 w-20 h-20 rounded-full bg-orange-300/20 blur-sm" />
            <div className="absolute top-32 right-8 w-12 h-12 rounded-full bg-pink-300/15" />
            <div className="absolute bottom-20 left-[15%] w-16 h-16 rounded-full bg-blue-300/15" />
            <div className="absolute top-40 right-[20%] w-8 h-8 rounded-full bg-orange-500/20" />
          </div>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-6 lg:pt-4 lg:pb-10">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-start">
              {/* Image */}
              <div className="relative order-1">
                <div className="relative aspect-[4/5] max-w-lg mx-auto rounded-2xl overflow-hidden border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                  <Image src={GALLERY_PHOTOS[activePhoto]} alt="Portrait Dragon Ball Z personnalisé" fill className="object-cover transition-all duration-700" priority sizes="(max-width: 768px) 92vw, 44vw" />
                </div>
                <div className="flex gap-2 justify-center mt-4">
                  {GALLERY_PHOTOS.slice(0, 6).map((photo, i) => (
                    <button key={i} onClick={() => setActivePhoto(i)} className={`w-14 h-14 rounded-lg overflow-hidden border-2 border-black transition-all duration-200 ${activePhoto === i ? "bg-orange-500 scale-110 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" : "opacity-60 hover:opacity-90 hover:scale-105"}`}>
                      <Image src={photo} alt="" width={56} height={56} className="object-cover w-full h-full" />
                    </button>
                  ))}
                </div>
              </div>
              {/* Copy */}
              <div className="order-2 text-center lg:text-left lg:pt-6">
                <div className="inline-flex items-center gap-2 mb-5 bg-white border-2 border-black rounded-full px-3 py-1.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex">{[...Array(5)].map((_, i) => <span key={i} className="text-orange-500 text-base">★</span>)}</div>
                  <span className="text-gray-700 text-sm font-semibold">4.9/5</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500 text-sm">{tp("portraitsCount")}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.1] mb-4 uppercase">
                  {t("heroTitle1")} <span className="text-orange-500 inline-block -rotate-1">{t("heroTitle2")}</span>
                </h1>
                <p className="text-gray-500 text-base lg:text-lg max-w-md mx-auto lg:mx-0 mb-6 leading-relaxed">
                  {t("heroSubtitle")}
                </p>
                <div className="flex items-center gap-3 justify-center lg:justify-start mb-7">
                  <span className="text-4xl font-black text-gray-900">{formatPrice(prices?.base || 14)}</span>
                  <span className="text-xl text-gray-400 line-through font-medium">{formatPrice((prices?.base || 14) * 2)}</span>
                  <span className="text-xs font-black text-white bg-red-500 px-2.5 py-1 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-block -rotate-3">-50%</span>
                </div>
                <button onClick={scrollToConfig} className="group w-full sm:w-auto bg-orange-500 text-black font-black text-lg px-12 py-4 rounded-xl border-3 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] active:shadow-none active:translate-x-[5px] active:translate-y-[5px] transition-all">
                  <span className="flex items-center justify-center gap-2">
                    {isGift ? tp("giftThisPortrait") : tp("createMyPortrait")}
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-5 justify-center lg:justify-start mt-6 text-gray-500 text-sm">
                  <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>{tp("satisfiedOrRefundedShort")}</span>
                  <span>{tp("handDrawnIcon")}</span>
                  <span>{tp("delivered48h")}</span>
                </div>
              </div>
            </div>
          </div>
          {/* Social proof bar */}
          <div className="bg-gray-900 py-3.5 border-y-3 border-black">
            <div className="max-w-5xl mx-auto px-4 flex items-center justify-center gap-4 sm:gap-8 lg:gap-14 flex-wrap">
              {[{ v: "2,500+", l: tp("portraitsCreated") }, { v: "4.9★", l: tp("averageRating") }, { v: "48h", l: tp("delivery") }, { v: "100%", l: tp("satisfactionGuarantee") }].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-orange-500 font-black text-lg sm:text-xl">{s.v}</span>
                  <span className="text-gray-300 text-xs sm:text-sm font-medium">{s.l}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ GUARANTEE VISUAL ═══ */}
        <section className="py-10 bg-orange-50">
          <div className="max-w-4xl mx-auto px-4 grid grid-cols-3 gap-5 text-center">
            {[
              { icon: "📸", title: tp("guaranteeStep1Title"), desc: tp("guaranteeStep1Desc"), rotate: "-rotate-1" },
              { icon: "🎨", title: tp("guaranteeStep2Title"), desc: tp("guaranteeStep2Desc"), rotate: "rotate-1" },
              { icon: "✅", title: tp("guaranteeStep3Title"), desc: tp("guaranteeStep3Desc"), rotate: "-rotate-1" },
            ].map((s, i) => (
              <div key={i} className={`flex flex-col items-center bg-orange-100 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${s.rotate} hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all`}>
                <div className="w-14 h-14 rounded-full bg-orange-500 border-2 border-black flex items-center justify-center text-2xl mb-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">{s.icon}</div>
                <p className="font-black text-gray-900 text-sm uppercase">{s.title}</p>
                <p className="text-gray-500 text-xs mt-0.5">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ CONFIGURATOR — Accordion progressif ═══ */}
        <section ref={configRef} className="relative py-10 sm:py-14 bg-orange-50">
          {/* Decorative cartoon elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-10 right-[5%] w-24 h-24 rounded-full bg-orange-300/15" />
            <div className="absolute bottom-20 left-[3%] w-16 h-16 rounded-full bg-pink-300/10" />
          </div>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Progress bar */}
            <div className="flex items-center gap-1 mb-8 max-w-lg mx-auto lg:mx-0">
              {STEPS.map((_, i) => (
                <div key={i} className="flex-1"><div className={`h-1.5 rounded-full transition-all duration-500 ${i <= activeStep ? "bg-orange-500" : "bg-gray-200"}`} /></div>
              ))}
              <span className="text-xs text-gray-400 ml-2 tabular-nums">{activeStep + 1}/5</span>
            </div>

            <div className="grid lg:grid-cols-5 gap-6 lg:gap-10">
              {/* Left: Accordion */}
              <div className="lg:col-span-3 space-y-2.5">
                {STEPS.map((step, idx) => {
                  const isOpen = activeStep === idx;
                  const isDone = activeStep > idx;
                  return (
                    <div key={idx} className={`rounded-2xl border-2 border-black transition-all duration-300 ${isOpen ? "bg-white shadow-[5px_5px_0px_0px_rgba(250,204,21,0.6)]" : isDone ? "bg-green-50/80 shadow-[3px_3px_0px_0px_rgba(34,197,94,0.3)]" : "bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)]"}`}>
                      <button onClick={() => setActiveStep(idx)} className="w-full flex items-center gap-3 px-5 py-4 text-left">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black transition-all ${isDone ? "bg-green-500 text-white shadow-sm" : isOpen ? "bg-orange-500 text-black shadow-sm" : "bg-gray-100 text-gray-400"}`}>{isDone ? "✓" : step.num}</span>
                        <span className={`font-bold text-sm flex-1 ${isOpen ? "text-gray-900" : isDone ? "text-gray-700" : "text-gray-500"}`}>{step.icon} {step.title}</span>
                        {isDone && <span className="text-xs text-green-700 font-semibold bg-green-100 px-2.5 py-1 rounded-full">{stepSummaries[idx]}</span>}
                        <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180 text-orange-500" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-[700px] opacity-100" : "max-h-0 opacity-0"}`}>
                        <div className="px-5 pb-5 pt-1">
                          {/* STEP 0: Format */}
                          {idx === 0 && (<div>
                            <div className="grid grid-cols-2 gap-3">
                              {([{ key: "portrait" as const, label: tp("portraitBust"), extra: tp("included"), icon: "👤" }, { key: "fullbody" as const, label: tp("fullbodyLabel"), extra: prices ? `+${formatPrice(prices.fullbodyExtra)}` : "", icon: "🧍" }]).map((o) => (
                                <button key={o.key} onClick={() => { setFormat(o.key); trackOptionSelected("format", o.key, o.key === "fullbody" ? (prices?.fullbodyExtra || 0) : 0); }} className={`relative text-center rounded-xl p-4 transition-all border-2 border-black ${format === o.key ? "bg-orange-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" : "bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,0.15)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]"}`}>
                                  <span className="text-2xl block mb-2">{o.icon}</span>
                                  <p className="font-bold text-gray-900 text-sm">{o.label}</p>
                                  <p className="text-xs text-orange-600 font-semibold mt-1">{o.extra}</p>
                                </button>
                              ))}
                            </div>
                            <button onClick={() => goNextStep(0)} className="mt-4 w-full bg-orange-500 text-black font-black text-sm py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all uppercase">{tp("continue")}</button>
                          </div>)}
                          {/* STEP 1: People & Animals */}
                          {idx === 1 && (<div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-700 font-medium">{tp("numberOfPeople")}</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => setPeople(Math.max(1, people - 1))} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center transition-colors">−</button>
                                <span className="w-10 h-9 rounded-lg bg-orange-500 text-black font-bold flex items-center justify-center">{people}</span>
                                <button onClick={() => setPeople(Math.min(6, people + 1))} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center transition-colors">+</button>
                              </div>
                            </div>
                            <p className="text-[11px] text-gray-400">{tp("firstPersonIncluded")} · +{prices ? formatPrice(prices.extraPerson) : ""}{tp("extraPersonPrice")}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-700 font-medium">{tp("numberOfPets")}</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => setAnimals(Math.max(0, animals - 1))} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center transition-colors">−</button>
                                <span className="w-10 h-9 rounded-lg bg-orange-500 text-black font-bold flex items-center justify-center">{animals}</span>
                                <button onClick={() => setAnimals(Math.min(4, animals + 1))} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center transition-colors">+</button>
                              </div>
                            </div>
                            <p className="text-[11px] text-gray-400">+{prices ? formatPrice(prices.extraAnimal) : ""}{tp("extraPetPrice")}</p>
                            <button onClick={() => goNextStep(1)} className="w-full bg-orange-500 text-black font-black text-sm py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all uppercase">{tp("continue")}</button>
                          </div>)}
                          {/* STEP 2: Upload photo */}
                          {idx === 2 && (<div className="relative">
                            <Confetti active={showConfetti} />
                            {!sendPhotoLater && (<div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-orange-500 hover:bg-orange-100/30 transition-all">
                              <input type="file" id="photos-upload" multiple accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="hidden" />
                              <label htmlFor="photos-upload" className="flex flex-col items-center gap-3 cursor-pointer">
                                <div className="w-14 h-14 rounded-xl bg-orange-500 flex items-center justify-center"><svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3 3 0 013.438 3.42A3.75 3.75 0 0118 19.5H6.75z" /></svg></div>
                                <div><p className="text-gray-900 font-bold text-sm">{tp("dragPhotosHere")}</p><p className="text-xs text-gray-400">{tp("fileTypes")}</p></div>
                                <span className="bg-gray-900 text-white font-bold text-xs px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors">{tp("chooseFile")}</span>
                              </label>
                              {uploading && (<div className="mt-4 flex flex-col items-center gap-2"><div className="w-10 h-10 border-3 border-gray-200 border-t-yellow-400 rounded-full animate-spin" /><p className="text-sm text-gray-500 font-medium">{tp("uploadInProgress")}</p></div>)}
                              {uploadError && <p className="mt-3 text-xs text-red-500 bg-red-50 p-2 rounded-lg">{uploadError}</p>}
                              {uploadedPhotos.length > 0 && !uploading && (<div className="mt-4 p-3 bg-green-50 rounded-lg">
                                <p className="text-green-700 font-bold text-sm mb-2">{tp("uploadSuccess")}</p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                  {uploadedPhotos.map((url, i) => (<div key={i} className="relative group"><img src={url} alt="" className="w-14 h-14 rounded-lg object-cover border-2 border-green-200" /><button onClick={() => setUploadedPhotos((prev) => prev.filter((_, idx2) => idx2 !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity">✕</button></div>))}
                                </div>
                              </div>)}
                            </div>)}
                            <div className="mt-3 space-y-1.5">
                              <p className="text-[11px] text-gray-400 flex items-center gap-1.5">{tp("photosDeletedAfter30Days")}</p>
                              <p className="text-[11px] text-gray-400 flex items-center gap-1.5">{tp("mostSelfiesWork")}</p>
                            </div>
                            <button onClick={() => setSendPhotoLater(!sendPhotoLater)} className={`mt-3 w-full text-left text-sm p-3 rounded-lg border-2 transition-all ${sendPhotoLater ? "border-orange-500 bg-orange-100" : "border-gray-200 bg-gray-50 hover:border-gray-300"}`}>
                              <span className="font-semibold text-gray-700">{tp("sendLater")}</span>
                              <span className="block text-[11px] text-gray-400 mt-0.5">{tp("sendLaterDesc")}</span>
                            </button>
                            <button onClick={() => goNextStep(2)} className="mt-3 w-full bg-orange-500 text-black font-black text-sm py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all uppercase">{tp("continue")}</button>
                          </div>)}
                          {/* STEP 3: Background */}
                          {idx === 3 && (<div>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                              {backgrounds.map((bg, i) => (
                                <button key={i} onClick={() => setSelectedBg(i)} onMouseEnter={() => setHoveredBg(i)} onMouseLeave={() => setHoveredBg(null)} className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${selectedBg === i ? "border-orange-500 ring-2 ring-orange-500/30 scale-105" : "border-gray-200 hover:border-gray-300"}`}>
                                  <Image src={bg.src} alt={bg.label} fill className="object-cover" sizes="(max-width: 640px) 30vw, 120px" />
                                  {selectedBg === i && <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center"><span className="bg-orange-500 text-black rounded-full w-5 h-5 text-xs font-black flex items-center justify-center">✓</span></div>}
                                </button>
                              ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">{tp("selected")} <span className="font-semibold text-gray-600">{backgrounds[selectedBg].label}</span></p>
                            {/* Speech bubble review */}
                            <div className="mt-4 relative bg-white rounded-2xl border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                              <div className="absolute -bottom-2 left-6 w-4 h-4 bg-white border-r-2 border-b-2 border-black rotate-45" />
                              <div className="flex">{[...Array(5)].map((_, j) => <span key={j} className="text-orange-500 text-xs">★</span>)}</div>
                              <p className="text-gray-700 text-xs mt-1 italic">&ldquo;{reviews[0]?.text}&rdquo;</p>
                              <p className="text-gray-500 text-[10px] mt-1 font-bold">— {reviews[0]?.name} ✅</p>
                            </div>
                            <button onClick={() => goNextStep(3)} className="mt-3 w-full bg-orange-500 text-black font-black text-sm py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all uppercase">{tp("continue")}</button>
                          </div>)}
                          {/* STEP 4: Print Options + Gift */}
                          {idx === 4 && (<div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {prints.map((o, i) => (
                                <button key={i} onClick={() => { setSelectedPrint(i); trackOptionSelected("print", o.label, o.price); }} className={`relative rounded-xl overflow-hidden border-2 transition-all ${selectedPrint === i ? "border-orange-500 bg-orange-100 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                                  <div className="aspect-square relative"><Image src={o.img} alt={o.label} fill className="object-cover" sizes="120px" /></div>
                                  <div className="p-2 text-center"><p className="font-bold text-gray-900 text-xs">{o.label}</p><p className="text-orange-600 font-bold text-xs">{o.price === 0 ? tp("included") : `+${formatPrice(o.price)}`}</p></div>
                                </button>
                              ))}
                            </div>
                            <div className="mt-4">
                              <button onClick={() => setIsGift(!isGift)} className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${isGift ? "border-orange-500 bg-orange-100" : "border-gray-200 bg-gray-50 hover:border-gray-300"}`}>
                                <span className="text-xl">🎁</span>
                                <div className="text-left flex-1"><p className="font-bold text-gray-900 text-sm">{tp("giftOption")}</p><p className="text-[11px] text-gray-400">{tp("giftDesc")}</p></div>
                                <div className={`w-10 h-6 rounded-full transition-colors flex items-center ${isGift ? "bg-orange-500 justify-end" : "bg-gray-200 justify-start"}`}><div className="w-5 h-5 rounded-full bg-white shadow mx-0.5" /></div>
                              </button>
                              {isGift && <textarea value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} placeholder={tp("giftMessagePlaceholder")} className="mt-2 w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-orange-500 resize-none" rows={2} />}
                            </div>
                            {/* Speech bubble review */}
                            <div className="mt-4 relative bg-white rounded-2xl border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                              <div className="absolute -bottom-2 left-6 w-4 h-4 bg-white border-r-2 border-b-2 border-black rotate-45" />
                              <div className="flex">{[...Array(5)].map((_, j) => <span key={j} className="text-orange-500 text-xs">★</span>)}</div>
                              <p className="text-gray-700 text-xs mt-1 italic">&ldquo;{reviews[1]?.text}&rdquo;</p>
                              <p className="text-gray-500 text-[10px] mt-1 font-bold">— {reviews[1]?.name} ✅</p>
                            </div>
                          </div>)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right: Sticky Summary (desktop) */}
              <div className="hidden lg:block lg:col-span-2">
                <div className="sticky top-20">
                  <div className="bg-gray-900 rounded-2xl p-6 text-white shadow-2xl">
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-5">
                      <Image src={backgrounds[previewBgIndex].src} alt={tp("selectedDecor")} fill className="object-cover transition-all duration-300" sizes="300px" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <div className="absolute bottom-3 left-3"><p className="text-white/70 text-[10px] uppercase tracking-wider font-medium">{tp("selectedDecor")}</p><p className="text-white font-bold text-sm">{backgrounds[previewBgIndex].label}</p></div>
                    </div>
                    <div className="space-y-2.5 text-sm mb-5">
                      <div className="flex justify-between"><span className="text-gray-400">{tp("formatLabel")}</span><span className="font-semibold">{format === "fullbody" ? tp("fullbodyLabel") : tp("portrait")}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">{tp("peopleLabel")}</span><span className="font-semibold">{people}</span></div>
                      {animals > 0 && <div className="flex justify-between"><span className="text-gray-400">{tp("animalsLabel")}</span><span className="font-semibold">{animals}</span></div>}
                      <div className="flex justify-between"><span className="text-gray-400">{tp("deliveryLabel")}</span><span className="font-semibold">{prints[selectedPrint]?.label || tp("digital")}</span></div>
                      {isGift && <div className="flex justify-between"><span className="text-gray-400">{tp("giftLabel")}</span><span className="font-semibold text-orange-500">{tp("giftYes")}</span></div>}
                    </div>
                    <div className="border-t border-white/10 pt-4 mb-5">
                      <div className="flex items-end justify-between">
                        <div><span className="text-gray-400 text-xs uppercase tracking-wider">{tp("total")}</span><span className="ml-2 text-sm text-gray-500 line-through">{formatPrice(total + 20)}</span></div>
                        <span className="text-4xl font-black text-orange-500"><AnimatedPrice value={total} formatter={formatPrice} /></span>
                      </div>
                    </div>
                    <button onClick={() => { setShowCheckout(true); trackCheckoutStarted(total, currency, { format, people, animals, background: backgrounds[selectedBg].label, printOption: prints[selectedPrint]?.label || "Digital" }); }} className="w-full bg-orange-500 text-black font-black text-lg py-5 rounded-xl border-2 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] active:shadow-none active:translate-x-[5px] active:translate-y-[5px] transition-all uppercase">
                      {isGift ? tp("giftThisPortrait") : tp("orderNowArrow")}
                    </button>
                    <div className="flex items-center justify-center gap-5 mt-3.5 text-gray-400 text-xs"><span>{tp("securePayment")}</span><span>{tp("satisfiedOrRefundedShort")}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MOBILE STICKY BOTTOM BAR */}
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-gray-200 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs text-gray-500">{tp("total")}</p><p className="text-xl font-black text-gray-900"><AnimatedPrice value={total} formatter={formatPrice} /></p></div>
            <button onClick={() => { setShowCheckout(true); trackCheckoutStarted(total, currency, { format, people, animals, background: backgrounds[selectedBg].label, printOption: prints[selectedPrint]?.label || "Digital" }); }} className="flex-1 max-w-xs bg-orange-500 hover:bg-orange-600 text-black font-black text-sm py-3.5 rounded-xl transition-all animate-subtle-pulse">
              {isGift ? tp("giftThisPortrait") : tp("orderArrow")}
            </button>
          </div>
        </div>

        {/* ═══ GALLERY ═══ */}
        <section className="py-12 sm:py-16 bg-orange-50 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-4 right-[10%] w-20 h-20 rounded-full bg-orange-300/10" />
            <div className="absolute bottom-10 left-[5%] w-14 h-14 rounded-full bg-blue-300/10" />
          </div>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 text-center mb-2 uppercase"><span className="inline-block -rotate-1">{tp("ourWork")}</span></h2>
            <p className="text-gray-500 text-sm text-center mb-8">{tp("ourWorkSubtitle")}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
              {GALLERY_PHOTOS.map((photo, i) => (
                <div key={i} className={`group bg-white p-2 pb-6 border-2 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 hover:shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 cursor-pointer ${i < 2 ? "sm:col-span-2 sm:row-span-2" : ""}`} style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (1 + i % 3)}deg)` }}>
                  <div className={`relative rounded overflow-hidden border border-black ${i < 2 ? "aspect-square" : "aspect-[3/4]"}`}>
                    <Image src={photo} alt={`${tp("realizationAlt")} ${i + 1}`} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes={i < 2 ? "(max-width: 768px) 45vw, 33vw" : "(max-width: 768px) 45vw, 16vw"} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ REVIEWS ═══ */}
        <section className="py-12 sm:py-16 bg-orange-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 uppercase"><span className="inline-block rotate-1">{tp("whatClientsSay")}</span></h2>
              <div className="flex items-center justify-center gap-2 mt-3">
                <div className="flex gap-0.5">{[...Array(5)].map((_, i) => <span key={i} className="text-orange-500 text-lg">★</span>)}</div>
                <span className="text-gray-700 text-base font-bold">4.9/5</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500 text-sm">{tp("verifiedReviewsCount")}</span>
              </div>
            </div>
            {/* Star review */}
            <div className="bg-white border-2 border-black rounded-2xl p-6 mb-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center font-black text-white text-lg">{reviews[0]?.name.charAt(0)}</div>
                <div>
                  <p className="font-black text-gray-900">{reviews[0]?.name}</p>
                  <div className="flex items-center gap-1">{[...Array(5)].map((_, j) => <span key={j} className="text-orange-500 text-sm">★</span>)}<span className="text-green-600 text-xs font-semibold ml-1.5 bg-green-100 px-1.5 py-0.5 rounded">{tp("verified")}</span></div>
                </div>
              </div>
              <p className="text-gray-700 text-base leading-relaxed">&ldquo;{reviews[0]?.text}&rdquo;</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviews.slice(1).map((review, i) => (
                <div key={i} className="bg-white rounded-xl p-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-400 flex items-center justify-center font-bold text-white text-sm">{review.name.charAt(0)}</div>
                    <div><p className="font-bold text-gray-900 text-sm">{review.name}</p><div className="flex items-center gap-0.5">{[...Array(5)].map((_, j) => <span key={j} className="text-orange-500 text-sm">★</span>)}<span className="text-gray-400 text-xs ml-1.5">{tp("verified")}</span></div></div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{review.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="py-12 sm:py-16 bg-orange-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 text-center mb-8 uppercase"><span className="inline-block -rotate-1">{tp("frequentQuestions")}</span></h2>
            <div className="space-y-3">
              {faqData.map((faq, i) => (
                <div key={i} className={`bg-white rounded-xl border-2 border-black overflow-hidden transition-all duration-200 ${openFaq === i ? "shadow-[4px_4px_0px_0px_rgba(250,204,21,0.8)]" : "shadow-[3px_3px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)]"}`}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
                    <span className="font-bold text-gray-900 text-sm sm:text-base">{faq.q}</span>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${openFaq === i ? "bg-orange-500 text-black rotate-180" : "bg-gray-100 text-gray-400"}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </span>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-96" : "max-h-0"}`}><p className="px-5 pb-5 text-gray-500 text-sm sm:text-base leading-relaxed">{faq.a}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Wavy separator */}
        <svg viewBox="0 0 1440 40" className="w-full -mb-1 text-orange-500" preserveAspectRatio="none"><path fill="currentColor" d="M0,20 C360,0 720,40 1080,20 C1260,10 1380,30 1440,20 L1440,40 L0,40 Z" /></svg>

        {/* ═══ FINAL CTA ═══ */}
        <section className="relative py-14 sm:py-20 bg-orange-500 overflow-hidden border-t-3 border-black">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-8 left-[8%] w-16 h-16 rounded-full bg-white/20" />
            <div className="absolute bottom-12 right-[10%] w-24 h-12 rounded-full bg-white/15" />
          </div>
          <div className="max-w-3xl mx-auto px-4 text-center relative">
            <div className="flex items-center justify-center gap-1 mb-4">{[...Array(5)].map((_, i) => <span key={i} className="text-black text-lg">★</span>)}<span className="text-black/70 font-bold text-sm ml-2">4.9/5 — 2,500+ portraits</span></div>
            <h2 className="text-3xl sm:text-4xl font-black text-black mb-3 uppercase"><span className="inline-block -rotate-1">{tp("readyToEnterDBZ")}</span></h2>
            <p className="text-base text-black/60 mb-8 max-w-lg mx-auto">{tp("joinClients")}</p>
            <button onClick={scrollToConfig} className="inline-flex items-center gap-2 bg-black text-orange-500 font-black text-lg px-10 py-5 rounded-xl border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[3px] hover:translate-y-[3px] active:shadow-none active:translate-x-[6px] active:translate-y-[6px] transition-all uppercase">
              {tp("createMyPortrait")}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </button>
            <p className="mt-5 text-sm text-black/40">{tp("handDrawnIcon")} · {tp("delivered48h")} · {tp("satisfiedOrRefunded")}</p>
          </div>
        </section>

        <div className="h-20 lg:hidden" />
      </div>

      <CheckoutModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        orderConfig={{
          format,
          people,
          animals,
          background: backgrounds[selectedBg].label,
          printOption: prints[selectedPrint]?.label || "Digital",
          total,
          description: orderDescription,
          photoUrls: uploadedPhotos,
          style: "dbz",
        }}
      />

      <style jsx global>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(200px) rotate(720deg); opacity: 0; }
        }
        .animate-confetti { animation: confetti-fall 2s ease-out forwards; }
        @keyframes subtle-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .animate-subtle-pulse { animation: subtle-pulse 4s ease-in-out infinite; }
      `}</style>
    </>
  );
}
