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
  { src: "/simpson_background/couch8x10.jpg", key: "bgCouch" },
  { src: "/simpson_background/house.jpg", key: "bgHouse" },
  { src: "/simpson_background/beach.jpg", key: "bgBeach" },
  { src: "/simpson_background/bar.jpg", key: "bgBar" },
  { src: "/simpson_background/church.jpg", key: "bgChurch" },
  { src: "/simpson_background/forest.jpg", key: "bgForest" },
  { src: "/simpson_background/snow.jpg", key: "bgSnow" },
  { src: "/simpson_background/montain.jpg", key: "bgMountain" },
  { src: "/simpson_background/valentines.jpg", key: "bgValentines" },
];

const GALLERY_PHOTOS = [
  "/simpson_photos_produit/0009_1.jpg",
  "/simpson_photos_produit/0015_1.jpg",
  "/simpson_photos_produit/0017_1.jpg",
  "/simpson_photos_produit/0021_1.jpg",
  "/simpson_photos_produit/0029_1.jpg",
  "/simpson_photos_produit/0032-revise3.jpg",
  "/simpson_photos_produit/0044_revise.jpg",
  "/simpson_photos_produit/0048.jpg",
  "/simpson_photos_produit/0049.jpg",
  "/simpson_photos_produit/43-2.png",
  "/simpson_photos_produit/IB2-18-1.jpg",
  "/simpson_photos_produit/IB4-20.jpg",
];

const SOCIAL_PROOF_NAMES = [
  "Sophie de Lyon", "Thomas de Paris", "Marie de Bordeaux", "Lucas de Marseille",
  "Emma de Toulouse", "Hugo de Nantes", "Léa de Strasbourg", "Nathan de Lille",
];

/* ═══════════════════════════════════════════════════════════════════════════
   ANIMATED PRICE COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
function AnimatedPrice({ value, formatter }: { value: number; formatter: (n: number) => string }) {
  const [displayed, setDisplayed] = useState(value);
  const ref = useRef(value);

  useEffect(() => {
    const from = ref.current;
    const to = value;
    if (from === to) return;
    const duration = 400;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
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
   CONFETTI COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full animate-confetti"
          style={{
            left: `${10 + Math.random() * 80}%`,
            backgroundColor: ["#FACC15", "#FB923C", "#34D399", "#60A5FA", "#F472B6"][i % 5],
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${1 + Math.random() * 1}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function SimpsonsV2Page() {
  const t = useTranslations("product");
  const { format: formatPrice, currency } = useCurrency();
  const { trackOptionSelected, trackPhotoUploaded, trackCheckoutStarted } = useProductTracking(PRODUCT_CONFIGS.simpsons2);

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

  // Accordion configurator state
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

  // FAQ Data
  const faqData = [
    { q: t("faqQ1"), a: t("faqA1") },
    { q: t("faqQ2"), a: t("faqA2") },
    { q: t("faqQ3"), a: t("faqA3") },
    { q: t("faqQ4"), a: t("faqA4") },
    { q: t("faqQ5"), a: t("faqA5") },
  ];

  // Reviews
  const reviews = [
    { name: t("review1Name"), text: t("review1Text"), rating: 5 },
    { name: t("review2Name"), text: t("review2Text"), rating: 5 },
    { name: t("review3Name"), text: t("review3Text"), rating: 5 },
    { name: t("review4Name"), text: t("review4Text"), rating: 5 },
    { name: t("review5Name"), text: t("review5Text"), rating: 5 },
    { name: t("review6Name"), text: t("review6Text"), rating: 5 },
  ];

  // Load prices
  useEffect(() => {
    fetch("/api/prices")
      .then((r) => r.json())
      .then(setPrices);
  }, []);

  // Auto-rotate hero photo
  useEffect(() => {
    const interval = setInterval(() => {
      setActivePhoto((prev) => (prev + 1) % 6);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Social proof toast timer
  useEffect(() => {
    const show = () => {
      setToastName(SOCIAL_PROOF_NAMES[Math.floor(Math.random() * SOCIAL_PROOF_NAMES.length)]);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 4000);
    };
    const interval = setInterval(show, 35000);
    const initial = setTimeout(show, 12000);
    return () => { clearInterval(interval); clearTimeout(initial); };
  }, []);

  // Print options
  const prints = prices
    ? [
        { img: "/digital.jpeg", label: t("digital"), price: prices.digital, icon: "📱" },
        { img: "/poster.png", label: t("posterOption"), price: prices.posterSimple, icon: "🖼️" },
        { img: "/canvas.jpeg", label: t("canvas"), price: prices.canvas, icon: "🎨" },
        { img: "/framed.jpg", label: t("poster"), price: prices.poster, icon: "✨" },
      ]
    : [];

  // Total calculation
  const total = prices
    ? prices.base +
      (format === "fullbody" ? prices.fullbodyExtra : 0) +
      (people - 1) * prices.extraPerson +
      animals * prices.extraAnimal +
      (prints[selectedPrint]?.price ?? 0)
    : 0;

  const orderDescription = `${format === "fullbody" ? t("fullbody") : t("portrait")} · ${people} pers.${animals > 0 ? ` + ${animals} animal${animals > 1 ? "s" : ""}` : ""} · ${prints[selectedPrint]?.label || t("digital")}${isGift ? " · 🎁 Cadeau" : ""}`;

  // Preview image: show hovered background or selected gallery photo
  const previewBgIndex = hoveredBg !== null ? hoveredBg : selectedBg;

  // Step summaries for collapsed accordion
  const stepSummaries = [
    format === "fullbody" ? "Corps entier" : "Portrait",
    `${people} pers.${animals > 0 ? ` + ${animals} animal${animals > 1 ? "s" : ""}` : ""}`,
    uploadedPhotos.length > 0 ? `${uploadedPhotos.length} photo${uploadedPhotos.length > 1 ? "s" : ""}` : sendPhotoLater ? "Envoi après commande" : "Non uploadée",
    backgrounds[selectedBg].label,
    prints[selectedPrint]?.label || "Digital",
  ];

  // Upload handler
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    setUploadError("");

    try {
      const urls: string[] = [];
      for (const file of files) {
        const blob = await upload(
          `orders/${Date.now()}-${file.name}`,
          file,
          { access: "public", handleUploadUrl: "/api/upload" }
        );
        urls.push(blob.url);
      }
      setUploadedPhotos((prev) => [...prev, ...urls]);
      trackPhotoUploaded(urls.length);
      // Celebration!
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    } catch {
      setUploadError(t("uploadError"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const scrollToConfig = useCallback(() => {
    configRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const goNextStep = useCallback((current: number) => {
    setActiveStep(Math.min(current + 1, 4));
  }, []);

  // Accordion step config
  const STEPS = [
    { num: 1, title: "Format", icon: "👤" },
    { num: 2, title: "Personnes & animaux", icon: "👥" },
    { num: 3, title: "Envoyez votre plus belle photo", icon: "📸" },
    { num: 4, title: "Choisissez le décor", icon: "🏠" },
    { num: 5, title: "Format de livraison", icon: "📦" },
  ];

  return (
    <>
      <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

        {/* ═══════════════════════════════════════════════════════════════════
            SOCIAL PROOF LIVE TOAST
        ═══════════════════════════════════════════════════════════════════ */}
        <div className={`fixed bottom-24 lg:bottom-6 left-4 z-50 transition-all duration-500 ${toastVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 px-4 py-3 flex items-center gap-3 max-w-xs">
            <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-sm">🎨</div>
            <div>
              <p className="text-xs font-bold text-gray-900">{toastName}</p>
              <p className="text-[10px] text-gray-500">vient de commander son portrait</p>
            </div>
            <span className="text-[10px] text-gray-400 ml-auto whitespace-nowrap">à l&apos;instant</span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            HERO — Above the fold
        ═══════════════════════════════════════════════════════════════════ */}
        <section ref={heroRef} className="relative bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 lg:pt-10 lg:pb-16">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">

              {/* Left — Image (mobile first) */}
              <div className="relative order-1">
                <div className="relative aspect-[4/5] max-w-md mx-auto rounded-2xl overflow-hidden shadow-xl">
                  <Image
                    src={GALLERY_PHOTOS[activePhoto]}
                    alt="Portrait Simpson personnalisé"
                    fill
                    className="object-cover transition-opacity duration-700"
                    priority
                    sizes="(max-width: 768px) 90vw, 40vw"
                  />
                </div>
                {/* Thumbnails */}
                <div className="flex gap-1.5 justify-center mt-3">
                  {GALLERY_PHOTOS.slice(0, 5).map((photo, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePhoto(i)}
                      className={`w-11 h-11 rounded-lg overflow-hidden border-2 transition-all ${activePhoto === i ? "border-yellow-400 scale-105" : "border-transparent opacity-50 hover:opacity-80"}`}
                    >
                      <Image src={photo} alt="" width={44} height={44} className="object-cover w-full h-full" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Right — Copy */}
              <div className="order-2 text-center lg:text-left">
                {/* Stars */}
                <div className="inline-flex items-center gap-1.5 mb-4">
                  <div className="flex">{[...Array(5)].map((_, i) => <span key={i} className="text-yellow-400 text-sm">★</span>)}</div>
                  <span className="text-gray-600 text-sm font-medium">4.9/5 — 2,500+ portraits créés</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-black leading-tight mb-3">
                  Devenez un{" "}
                  <span className="text-yellow-500">personnage Simpson</span>
                </h1>

                <p className="text-gray-500 text-base max-w-md mx-auto lg:mx-0 mb-5 leading-relaxed">
                  Portrait personnalisé dessiné à la main par nos artistes. Livraison digitale en 48h.
                </p>

                {/* Price anchor */}
                <div className="flex items-baseline gap-3 justify-center lg:justify-start mb-6">
                  <span className="text-3xl font-black text-gray-900">{formatPrice(prices?.base || 14)}</span>
                  <span className="text-lg text-gray-400 line-through">{formatPrice((prices?.base || 14) * 2)}</span>
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Offre de lancement</span>
                </div>

                {/* Single CTA */}
                <button
                  onClick={scrollToConfig}
                  className="group w-full sm:w-auto bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-base px-10 py-4 rounded-xl transition-all shadow-lg shadow-yellow-400/20 hover:shadow-xl"
                >
                  <span className="flex items-center justify-center gap-2">
                    {isGift ? "Offrir ce portrait" : "Créer mon portrait"}
                    <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </button>

                {/* Trust row */}
                <div className="flex flex-wrap items-center gap-4 justify-center lg:justify-start mt-5 text-gray-500 text-xs">
                  <span className="flex items-center gap-1"><svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>Satisfait ou remboursé</span>
                  <span>✏️ Dessiné à la main</span>
                  <span>⚡ Livré en 48h</span>
                </div>
              </div>
            </div>
          </div>

          {/* Social proof bar */}
          <div className="bg-gray-900 py-3">
            <div className="max-w-5xl mx-auto px-4 flex items-center justify-center gap-6 sm:gap-12">
              {[
                { v: "2,500+", l: "Portraits" },
                { v: "4.9★", l: "Avis" },
                { v: "48h", l: "Livraison" },
                { v: "100%", l: "Garantie" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-yellow-400 font-black text-base sm:text-lg">{s.v}</span>
                  <span className="text-gray-400 text-xs">{s.l}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            GUARANTEE VISUAL — 3 steps
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-10 bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { step: "1", icon: "📸", title: "Envoyez votre photo", desc: "Un selfie suffit" },
                { step: "2", icon: "🎨", title: "On dessine votre portrait", desc: "Par un artiste dédié" },
                { step: "3", icon: "✅", title: "Pas satisfait ?", desc: "On recommence gratuitement" },
              ].map((s, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center text-xl mb-2">{s.icon}</div>
                  <p className="font-bold text-gray-900 text-sm">{s.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            CONFIGURATOR — Accordion progressif + Résumé sticky
        ═══════════════════════════════════════════════════════════════════ */}
        <section ref={configRef} className="py-10 sm:py-14 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Progress bar */}
            <div className="flex items-center gap-1 mb-8 max-w-lg mx-auto lg:mx-0">
              {STEPS.map((s, i) => (
                <div key={i} className="flex-1 flex items-center gap-1">
                  <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= activeStep ? "bg-yellow-400" : "bg-gray-200"}`} />
                </div>
              ))}
              <span className="text-xs text-gray-400 ml-2 tabular-nums">{activeStep + 1}/5</span>
            </div>

            <div className="grid lg:grid-cols-5 gap-6 lg:gap-10">

              {/* ── Left: Accordion steps ── */}
              <div className="lg:col-span-3 space-y-3">

                {STEPS.map((step, idx) => {
                  const isOpen = activeStep === idx;
                  const isDone = activeStep > idx;

                  return (
                    <div key={idx} className={`rounded-xl border transition-all duration-300 ${isOpen ? "border-yellow-400 bg-white shadow-md" : isDone ? "border-green-200 bg-green-50/50" : "border-gray-200 bg-white"}`}>
                      {/* Step header — always visible */}
                      <button
                        onClick={() => setActiveStep(idx)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      >
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-colors ${isDone ? "bg-green-500 text-white" : isOpen ? "bg-yellow-400 text-black" : "bg-gray-100 text-gray-400"}`}>
                          {isDone ? "✓" : step.num}
                        </span>
                        <span className={`font-semibold text-sm flex-1 ${isOpen ? "text-gray-900" : "text-gray-500"}`}>
                          {step.icon} {step.title}
                        </span>
                        {isDone && <span className="text-xs text-green-600 font-medium">{stepSummaries[idx]}</span>}
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Step body — expandable */}
                      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
                        <div className="px-4 pb-4">

                          {/* STEP 0: Format */}
                          {idx === 0 && (
                            <div>
                              <div className="grid grid-cols-2 gap-3">
                                {([
                                  { key: "portrait" as const, label: "Portrait (buste)", extra: "Inclus", icon: "👤" },
                                  { key: "fullbody" as const, label: "Corps entier", extra: prices ? `+${formatPrice(prices.fullbodyExtra)}` : "", icon: "🧍" },
                                ]).map((o) => (
                                  <button
                                    key={o.key}
                                    onClick={() => { setFormat(o.key); trackOptionSelected("format", o.key, o.key === "fullbody" ? (prices?.fullbodyExtra || 0) : 0); }}
                                    className={`relative text-center rounded-lg p-4 transition-all border-2 ${format === o.key ? "border-yellow-400 bg-yellow-50 shadow-sm" : "border-gray-200 bg-gray-50 hover:border-gray-300"}`}
                                  >
                                    <span className="text-2xl block mb-2">{o.icon}</span>
                                    <p className="font-bold text-gray-900 text-sm">{o.label}</p>
                                    <p className="text-xs text-yellow-600 font-semibold mt-1">{o.extra}</p>
                                  </button>
                                ))}
                              </div>
                              <button onClick={() => goNextStep(0)} className="mt-3 w-full bg-gray-900 text-white font-bold text-sm py-3 rounded-lg hover:bg-gray-800 transition-colors">
                                Continuer →
                              </button>
                            </div>
                          )}

                          {/* STEP 1: People & Animals */}
                          {idx === 1 && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700 font-medium">👥 Nombre de personnes</span>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setPeople(Math.max(1, people - 1))} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center transition-colors">−</button>
                                  <span className="w-10 h-9 rounded-lg bg-yellow-400 text-black font-bold flex items-center justify-center">{people}</span>
                                  <button onClick={() => setPeople(Math.min(6, people + 1))} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center transition-colors">+</button>
                                </div>
                              </div>
                              <p className="text-[11px] text-gray-400">1ère personne incluse · +{prices ? formatPrice(prices.extraPerson) : ""}/personne supplémentaire</p>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700 font-medium">🐾 Animaux de compagnie</span>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setAnimals(Math.max(0, animals - 1))} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center transition-colors">−</button>
                                  <span className="w-10 h-9 rounded-lg bg-yellow-400 text-black font-bold flex items-center justify-center">{animals}</span>
                                  <button onClick={() => setAnimals(Math.min(4, animals + 1))} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center transition-colors">+</button>
                                </div>
                              </div>
                              <p className="text-[11px] text-gray-400">+{prices ? formatPrice(prices.extraAnimal) : ""}/animal</p>
                              <button onClick={() => goNextStep(1)} className="w-full bg-gray-900 text-white font-bold text-sm py-3 rounded-lg hover:bg-gray-800 transition-colors">
                                Continuer →
                              </button>
                            </div>
                          )}

                          {/* STEP 2: Upload photo */}
                          {idx === 2 && (
                            <div className="relative">
                              <Confetti active={showConfetti} />

                              {!sendPhotoLater && (
                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-yellow-400 hover:bg-yellow-50/30 transition-all">
                                  <input type="file" id="photos-upload-v2" multiple accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="hidden" />
                                  <label htmlFor="photos-upload-v2" className="flex flex-col items-center gap-3 cursor-pointer">
                                    <div className="w-14 h-14 rounded-xl bg-yellow-400 flex items-center justify-center">
                                      <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3 3 0 013.438 3.42A3.75 3.75 0 0118 19.5H6.75z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-gray-900 font-bold text-sm">Glissez vos photos ici</p>
                                      <p className="text-xs text-gray-400">JPG, PNG, WEBP — jusqu&apos;à 10 Mo</p>
                                    </div>
                                    <span className="bg-gray-900 text-white font-bold text-xs px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors">
                                      Choisir un fichier
                                    </span>
                                  </label>

                                  {uploading && (
                                    <div className="mt-4 flex flex-col items-center gap-2">
                                      <div className="w-10 h-10 border-3 border-gray-200 border-t-yellow-400 rounded-full animate-spin" />
                                      <p className="text-sm text-gray-500 font-medium">Upload en cours...</p>
                                    </div>
                                  )}
                                  {uploadError && <p className="mt-3 text-xs text-red-500 bg-red-50 p-2 rounded-lg">{uploadError}</p>}

                                  {uploadedPhotos.length > 0 && !uploading && (
                                    <div className="mt-4 p-3 bg-green-50 rounded-lg">
                                      <p className="text-green-700 font-bold text-sm mb-2">
                                        Parfait ! Votre portrait va être incroyable 🎨
                                      </p>
                                      <div className="flex flex-wrap gap-2 justify-center">
                                        {uploadedPhotos.map((url, i) => (
                                          <div key={i} className="relative group">
                                            <img src={url} alt="" className="w-14 h-14 rounded-lg object-cover border-2 border-green-200" />
                                            <button
                                              onClick={() => setUploadedPhotos((prev) => prev.filter((_, idx2) => idx2 !== i))}
                                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity"
                                            >✕</button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Reassurance messages */}
                              <div className="mt-3 space-y-1.5">
                                <p className="text-[11px] text-gray-400 flex items-center gap-1.5">📸 Vos photos sont supprimées après 30 jours</p>
                                <p className="text-[11px] text-gray-400 flex items-center gap-1.5">✓ La plupart des selfies fonctionnent parfaitement</p>
                              </div>

                              {/* Send later option */}
                              <button
                                onClick={() => { setSendPhotoLater(!sendPhotoLater); }}
                                className={`mt-3 w-full text-left text-sm p-3 rounded-lg border-2 transition-all ${sendPhotoLater ? "border-yellow-400 bg-yellow-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"}`}
                              >
                                <span className="font-semibold text-gray-700">📧 Je l&apos;enverrai après la commande</span>
                                <span className="block text-[11px] text-gray-400 mt-0.5">Pas de photo sous la main ? Envoyez-la nous par email après votre achat</span>
                              </button>

                              <button onClick={() => goNextStep(2)} className="mt-3 w-full bg-gray-900 text-white font-bold text-sm py-3 rounded-lg hover:bg-gray-800 transition-colors">
                                Continuer →
                              </button>
                            </div>
                          )}

                          {/* STEP 3: Background */}
                          {idx === 3 && (
                            <div>
                              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {backgrounds.map((bg, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setSelectedBg(i)}
                                    onMouseEnter={() => setHoveredBg(i)}
                                    onMouseLeave={() => setHoveredBg(null)}
                                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${selectedBg === i ? "border-yellow-400 ring-2 ring-yellow-400/30 scale-105" : "border-gray-200 hover:border-gray-300"}`}
                                  >
                                    <Image src={bg.src} alt={bg.label} fill className="object-cover" sizes="80px" />
                                    {selectedBg === i && <div className="absolute inset-0 bg-yellow-400/20 flex items-center justify-center"><span className="bg-yellow-400 text-black rounded-full w-5 h-5 text-xs font-black flex items-center justify-center">✓</span></div>}
                                  </button>
                                ))}
                              </div>
                              <p className="text-xs text-gray-400 mt-2">Sélectionné : <span className="font-semibold text-gray-600">{backgrounds[selectedBg].label}</span></p>

                              {/* Inline review between step 3 and 4 */}
                              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                                <div className="flex items-center gap-2">
                                  <div className="flex">{[...Array(5)].map((_, j) => <span key={j} className="text-yellow-400 text-xs">★</span>)}</div>
                                </div>
                                <p className="text-gray-600 text-xs mt-1 italic">&ldquo;{reviews[0]?.text}&rdquo;</p>
                                <p className="text-gray-400 text-[10px] mt-1 font-semibold">— {reviews[0]?.name}, client vérifié</p>
                              </div>

                              <button onClick={() => goNextStep(3)} className="mt-3 w-full bg-gray-900 text-white font-bold text-sm py-3 rounded-lg hover:bg-gray-800 transition-colors">
                                Continuer →
                              </button>
                            </div>
                          )}

                          {/* STEP 4: Print Options */}
                          {idx === 4 && (
                            <div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {prints.map((o, i) => (
                                  <button
                                    key={i}
                                    onClick={() => { setSelectedPrint(i); trackOptionSelected("print", o.label, o.price); }}
                                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${selectedPrint === i ? "border-yellow-400 bg-yellow-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"}`}
                                  >
                                    <div className="aspect-square relative">
                                      <Image src={o.img} alt={o.label} fill className="object-cover" sizes="120px" />
                                    </div>
                                    <div className="p-2 text-center">
                                      <p className="font-bold text-gray-900 text-xs">{o.label}</p>
                                      <p className="text-yellow-600 font-bold text-xs">{o.price === 0 ? "Inclus" : `+${formatPrice(o.price)}`}</p>
                                    </div>
                                  </button>
                                ))}
                              </div>

                              {/* Gift mode toggle */}
                              <div className="mt-4">
                                <button
                                  onClick={() => setIsGift(!isGift)}
                                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${isGift ? "border-yellow-400 bg-yellow-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"}`}
                                >
                                  <span className="text-xl">🎁</span>
                                  <div className="text-left flex-1">
                                    <p className="font-bold text-gray-900 text-sm">C&apos;est un cadeau</p>
                                    <p className="text-[11px] text-gray-400">Ajoutez un message personnalisé</p>
                                  </div>
                                  <div className={`w-10 h-6 rounded-full transition-colors flex items-center ${isGift ? "bg-yellow-400 justify-end" : "bg-gray-200 justify-start"}`}>
                                    <div className="w-5 h-5 rounded-full bg-white shadow mx-0.5" />
                                  </div>
                                </button>
                                {isGift && (
                                  <textarea
                                    value={giftMessage}
                                    onChange={(e) => setGiftMessage(e.target.value)}
                                    placeholder="Votre message personnalisé..."
                                    className="mt-2 w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-yellow-400 resize-none"
                                    rows={2}
                                  />
                                )}
                              </div>

                              {/* Inline review */}
                              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                                <div className="flex items-center gap-2">
                                  <div className="flex">{[...Array(5)].map((_, j) => <span key={j} className="text-yellow-400 text-xs">★</span>)}</div>
                                </div>
                                <p className="text-gray-600 text-xs mt-1 italic">&ldquo;{reviews[1]?.text}&rdquo;</p>
                                <p className="text-gray-400 text-[10px] mt-1 font-semibold">— {reviews[1]?.name}, client vérifié</p>
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Right: Sticky Summary (desktop) ── */}
              <div className="hidden lg:block lg:col-span-2">
                <div className="sticky top-20">
                  <div className="bg-gray-900 rounded-2xl p-5 text-white shadow-2xl">
                    {/* Live preview image */}
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-4">
                      <Image
                        src={backgrounds[previewBgIndex].src}
                        alt="Aperçu du décor"
                        fill
                        className="object-cover transition-opacity duration-200"
                        sizes="300px"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3">
                        <p className="text-white/60 text-[10px] uppercase tracking-wider">Décor</p>
                        <p className="text-white font-bold text-sm">{backgrounds[previewBgIndex].label}</p>
                      </div>
                    </div>

                    {/* Order details */}
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between"><span className="text-gray-400">Format</span><span className="font-semibold">{format === "fullbody" ? "Corps entier" : "Portrait"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Personnes</span><span className="font-semibold">{people}</span></div>
                      {animals > 0 && <div className="flex justify-between"><span className="text-gray-400">Animaux</span><span className="font-semibold">{animals}</span></div>}
                      <div className="flex justify-between"><span className="text-gray-400">Livraison</span><span className="font-semibold">{prints[selectedPrint]?.label || "Digital"}</span></div>
                      {isGift && <div className="flex justify-between"><span className="text-gray-400">Cadeau</span><span className="font-semibold text-yellow-400">🎁 Oui</span></div>}
                    </div>

                    {/* Total with animated price */}
                    <div className="border-t border-white/10 pt-4 mb-4">
                      <div className="flex items-end justify-between">
                        <span className="text-gray-400 text-sm">Total</span>
                        <span className="text-3xl font-black text-yellow-400">
                          <AnimatedPrice value={total} formatter={formatPrice} />
                        </span>
                      </div>
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => { setShowCheckout(true); trackCheckoutStarted(total, currency, { format, people, animals, background: backgrounds[selectedBg].label, printOption: prints[selectedPrint]?.label || "Digital" }); }}
                      className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-black text-base py-4 rounded-xl transition-all hover:shadow-lg hover:shadow-yellow-400/30"
                    >
                      {isGift ? "Offrir ce portrait →" : "Commander maintenant →"}
                    </button>

                    <div className="flex items-center justify-center gap-4 mt-3 text-gray-500 text-[10px]">
                      <span className="flex items-center gap-1">🔒 Paiement sécurisé</span>
                      <span className="flex items-center gap-1">✓ Satisfait ou remboursé</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            MOBILE STICKY BOTTOM BAR
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-gray-200 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-black text-gray-900">
                <AnimatedPrice value={total} formatter={formatPrice} />
              </p>
            </div>
            <button
              onClick={() => { setShowCheckout(true); trackCheckoutStarted(total, currency, { format, people, animals, background: backgrounds[selectedBg].label, printOption: prints[selectedPrint]?.label || "Digital" }); }}
              className="flex-1 max-w-xs bg-yellow-400 hover:bg-yellow-500 text-black font-black text-sm py-3.5 rounded-xl transition-all animate-subtle-pulse"
            >
              {isGift ? "Offrir ce portrait →" : "Commander →"}
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            STYLE COMPARATOR
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-10 sm:py-14 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-6">Quel style vous correspond ?</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
              {[
                { name: "Simpson", img: GALLERY_PHOTOS[0], href: "#" },
                { name: "One Piece", img: "/onepiece_photos_produit/01.jpg", href: "/fr/onepiece" },
                { name: "Dragon Ball Z", img: "/dbz_photos_produit/01.jpg", href: "/fr/dbz" },
                { name: "Disney", img: "/disney_photos_produit/01.jpg", href: "/fr/disney" },
                { name: "Ghibli", img: "/ghibli_photos_produit/01.jpg", href: "/fr/ghibli" },
              ].map((style, i) => (
                <a key={i} href={style.href} className="snap-start flex-shrink-0 w-40 group">
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-gray-100 group-hover:border-yellow-400 transition-all shadow-sm group-hover:shadow-lg">
                    <Image src={style.img} alt={style.name} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="160px" />
                  </div>
                  <p className="text-sm font-bold text-gray-900 text-center mt-2">{style.name}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            GALLERY
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-10 sm:py-14 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-6">Nos réalisations</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {GALLERY_PHOTOS.map((photo, i) => (
                <div key={i} className="group relative aspect-[3/4] rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
                  <Image src={photo} alt={`Réalisation ${i + 1}`} fill className="object-cover transition-transform duration-500 group-hover:scale-110" sizes="(max-width: 768px) 45vw, 16vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            REVIEWS
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-10 sm:py-14 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Ce que disent nos clients</h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="flex">{[...Array(5)].map((_, i) => <span key={i} className="text-yellow-400">★</span>)}</div>
                <span className="text-gray-600 text-sm font-semibold">4.9/5 — 2,500+ avis vérifiés</span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviews.map((review, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center font-bold text-white text-sm">{review.name.charAt(0)}</div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{review.name}</p>
                      <div className="flex items-center gap-0.5">{[...Array(5)].map((_, j) => <span key={j} className="text-yellow-400 text-xs">★</span>)}<span className="text-gray-400 text-[10px] ml-1">Vérifié</span></div>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{review.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            FAQ
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-10 sm:py-14 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-6">Questions fréquentes</h2>
            <div className="space-y-2">
              {faqData.map((faq, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
                    <span className="font-semibold text-gray-900 text-sm">{faq.q}</span>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${openFaq === i ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-96" : "max-h-0"}`}>
                    <p className="px-4 pb-4 text-gray-500 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            FINAL CTA
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-12 sm:py-16 bg-yellow-400">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-2xl sm:text-3xl font-black text-black mb-3">Prêt à devenir un Simpson ?</h2>
            <p className="text-sm text-black/60 mb-6">Rejoignez +2,500 clients satisfaits et recevez votre portrait en 48h</p>
            <button onClick={scrollToConfig} className="inline-flex items-center gap-2 bg-black text-yellow-400 font-black text-base px-8 py-4 rounded-xl hover:bg-gray-900 transition-all hover:scale-105 shadow-lg">
              Créer mon portrait
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </button>
          </div>
        </section>

        {/* Bottom spacer for mobile sticky bar */}
        <div className="h-20 lg:hidden" />
      </div>

      {/* Checkout Modal */}
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
          style: "simpsons2",
        }}
      />

      {/* Global Animations */}
      <style jsx global>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(200px) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti-fall 2s ease-out forwards;
        }
        @keyframes subtle-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .animate-subtle-pulse {
          animation: subtle-pulse 4s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
