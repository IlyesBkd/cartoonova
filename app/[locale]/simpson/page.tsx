"use client";

import { useState, useEffect, Suspense } from "react";
import Navbar from "@/components/Navbar";
import FooterCartoon from "@/components/FooterCartoon";
import CheckoutModal from "@/components/CheckoutModal";
import type { Prices } from "@/lib/types";
import { useCurrency } from "@/components/CurrencyProvider";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { upload } from "@vercel/blob/client";

/* ─── Assets locaux ──────────────────────────────────────────────────── */
const backgroundData = [
  { src: "/simpson_background/bar.jpg", key: "bgBar" },
  { src: "/simpson_background/beach.jpg", key: "bgBeach" },
  { src: "/simpson_background/church.jpg", key: "bgChurch" },
  { src: "/simpson_background/couch8x10.jpg", key: "bgCouch" },
  { src: "/simpson_background/forest.jpg", key: "bgForest" },
  { src: "/simpson_background/house.jpg", key: "bgHouse" },
  { src: "/simpson_background/montain.jpg", key: "bgMountain" },
  { src: "/simpson_background/snow.jpg", key: "bgSnow" },
  { src: "/simpson_background/valentines.jpg", key: "bgValentines" },
];

const photos = [
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

/* ─── Safe YouTube embed ─────────────────────────────────────────────── */
function SafeYouTube({ src, title }: { src: string; title: string }) {
  const [hasError, setHasError] = useState(false);
  if (hasError) {
    return (
      <div className="w-full aspect-video flex items-center justify-center bg-gray-100 rounded-xl">
        <p className="text-black/50 font-bold text-sm">Video unavailable</p>
      </div>
    );
  }
  return (
    <iframe
      src={src}
      title={title}
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      className="w-full aspect-video border-none"
      onError={() => setHasError(true)}
    />
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
const W = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
);

const Step = ({ n, title }: { n: number; title: string }) => (
  <div className="flex items-center gap-3 mb-6">
    <span className="flex-shrink-0 w-10 h-10 rounded-full bg-black text-yellow-400 flex items-center justify-center font-black text-lg border-2 border-black">{n}</span>
    <h3 className="text-xl font-black text-black uppercase">{title}</h3>
  </div>
);

const Check = () => (
  <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-yellow-400 text-black flex items-center justify-center text-xs font-black z-10 border-2 border-black">✓</span>
);

/* ═══════════════════════════════════════════════════════════════════════ */
export default function ProductPage() {
  const t = useTranslations("product");
  const tn = useTranslations("nav");
  const { format: formatPrice } = useCurrency();
  const [format, setFormat] = useState<"portrait" | "fullbody">("portrait");
  const [people, setPeople] = useState(1);
  const [animals, setAnimals] = useState(0);
  const [selectedBg, setSelectedBg] = useState(0);
  const [selectedPrint, setSelectedPrint] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);
  const [heroPhoto, setHeroPhoto] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Translated data arrays
  const backgrounds = backgroundData.map((bg) => ({ ...bg, label: t(bg.key as "bgBar") }));

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

  // Load prices
  useEffect(() => {
    fetch("/api/prices")
      .then((r) => r.json())
      .then(setPrices);
  }, []);

  // Dynamic prints based on prices (Mission 3: added Poster option)
  const prints = prices
    ? [
        { img: "/digital.jpeg", label: t("digital"), price: prices.digital },
        { img: "/canvas.jpeg", label: t("canvas"), price: prices.canvas },
        { img: "/framed.jpg", label: t("poster"), price: prices.poster },
        { img: "/poster.png", label: t("posterOption"), price: prices.posterSimple },
      ]
    : [];

  // Dynamic total calculation (fixed operator precedence bug)
  const total = prices
    ? prices.base +
      (format === "fullbody" ? prices.fullbodyExtra : 0) +
      (people - 1) * prices.extraPerson +
      animals * prices.extraAnimal +
      (prints[selectedPrint]?.price ?? 0)
    : 0;

  const orderDescription = `${format === "fullbody" ? t("fullbody") : t("portrait")} · ${people} pers.${animals > 0 ? ` + ${animals} animal${animals > 1 ? "s" : ""}` : ""} · ${prints[selectedPrint]?.label || t("digital")}`;

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-white">

        {/* ═══ HERO ═══ */}
        <section className="relative pt-28 sm:pt-36 pb-14 sm:pb-20 bg-yellow-400 border-b-4 border-black overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-10">
            <div className="absolute top-20 left-[5%] w-48 h-24 bg-white rounded-full" />
            <div className="absolute bottom-12 right-[8%] w-56 h-28 bg-white rounded-full" />
          </div>
          <W className="relative z-10">
            <nav className="text-sm font-bold text-black/60 mb-8">
              <a href="/" className="hover:text-black transition-colors">{tn("home")}</a>
              <span className="mx-2">/</span>
              <span className="text-black font-black">{t("breadcrumb")}</span>
            </nav>
            <div className="flex flex-col lg:flex-row items-center gap-12">
              {/* Main image + minis */}
              <div className="flex-1 w-full max-w-xl flex flex-col gap-4">
                <div className="bg-white p-3 border-4 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                  <div className="aspect-[4/3] rounded-lg overflow-hidden border-2 border-black">
                    <img src={photos[heroPhoto]} alt="Aperçu produit" className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {photos.slice(0, 6).map((src, i) => (
                    <button key={i} onClick={() => setHeroPhoto(i)} className={`aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${heroPhoto === i ? "border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] scale-105" : "border-black/30 hover:border-black"}`}>
                      <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
              {/* Text — Mission 2: hidden on mobile */}
              <div className="flex-1 text-center lg:text-left hidden md:block">
                <div className="inline-flex items-center gap-2 bg-white border-2 border-black rounded-full px-4 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] mb-5">
                  <span className="text-sm font-black text-black">4.8</span>
                  <span className="h-4 w-px bg-black/20" />
                  <span className="inline-flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="inline-flex items-center justify-center w-5 h-5 rounded-[3px]" style={{ backgroundColor: "rgb(0, 182, 122)" }}>
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white"><path d="M12 17.27l-5.18 3.05 1.4-5.95L3.5 9.24l6.06-.52L12 3l2.44 5.72 6.06.52-4.72 5.13 1.4 5.95z" /></svg>
                      </span>
                    ))}
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight text-black uppercase mb-5">
                  {t("heroTitle1")} <span className="text-white" style={{ WebkitTextStroke: "2px black" }}>{t("heroTitle2")}</span>
                </h1>
                <p className="text-lg text-black/60 font-bold mb-8 max-w-md mx-auto lg:mx-0">{t("heroSubtitle")}</p>
                <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                  {[
                    { emoji: "✏️", label: t("handDrawn") },
                    { emoji: "🔄", label: t("freeRevision") },
                    { emoji: "📦", label: t("fastDelivery") },
                  ].map((b) => (
                    <div key={b.label} className="flex items-center gap-2 bg-white border-2 border-black rounded-full px-4 py-2 text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                      <span>{b.emoji}</span>
                      <strong className="font-black text-black">{b.label}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </W>
        </section>

        {/* ═══ FORMULAIRE ═══ */}
        <section className="py-14 sm:py-20 border-b-4 border-black">
          <W>
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-black text-black uppercase mb-2">{t("customizeTitle")} <span className="text-yellow-500">{t("customizeHighlight")}</span></h2>
              <p className="text-black/50 font-bold max-w-lg mx-auto">{t("customizeSubtitle")}</p>
            </div>

            <div className="relative z-10 max-w-5xl mx-auto bg-yellow-50 border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 sm:p-10 flex flex-col gap-14">

              {/* Étape 1 : Format */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Step n={1} title={t("step1")} />
                  <span className="text-2xl animate-bounce">⬇️</span>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  {([
                    { key: "portrait" as const, label: t("portrait"), desc: t("portraitDesc"), extra: t("included"), icon: "👤" },
                    { key: "fullbody" as const, label: t("fullbody"), desc: t("fullbodyDesc"), extra: prices ? `+${formatPrice(prices.fullbodyExtra)}` : "+20 €", icon: "🧍" },
                  ]).map((o) => (
                    <button key={o.key} onClick={() => { setFormat(o.key); posthog.capture("Option sélectionnée", { type: "format", value: o.key }); }} className={`relative cursor-pointer text-left rounded-2xl p-6 transition-all duration-200 border-4 ${format === o.key ? "border-black bg-yellow-400 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]" : "border-black/30 bg-white hover:border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"}`}>
                      {format === o.key && <Check />}
                      <div className="text-3xl mb-3">{o.icon}</div>
                      <p className="font-black text-lg text-black uppercase">{o.label}</p>
                      <p className="text-sm text-black/50 font-bold mt-1">{o.desc}</p>
                      <p className="text-sm font-black text-yellow-600 mt-3">{o.extra}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Étape 2 : Personnes & Animaux */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Step n={2} title={t("step2")} />
                  <span className="text-2xl animate-bounce">⬇️</span>
                </div>
                <div className="grid grid-cols-2 gap-10">
                  <div className="flex-1">
                    <p className="text-sm font-black uppercase text-black mb-3">👥 {t("people")}</p>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setPeople(Math.max(1, people - 1))} className="w-12 h-12 rounded-xl bg-white border-2 border-black text-black font-black text-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer">−</button>
                      <div className="w-16 h-12 rounded-xl bg-yellow-400 text-black font-black text-xl flex items-center justify-center border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">{people}</div>
                      <button onClick={() => setPeople(Math.min(6, people + 1))} className="w-12 h-12 rounded-xl bg-white border-2 border-black text-black font-black text-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer">+</button>
                    </div>
                    <p className="text-xs text-black/40 font-bold mt-2">{t("firstPersonIncluded")} · +{prices ? formatPrice(prices.extraPerson) : "15 €"} {t("perExtraPerson")}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black uppercase text-black mb-3">🐾 {t("animals")}</p>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setAnimals(Math.max(0, animals - 1))} className="w-12 h-12 rounded-xl bg-white border-2 border-black text-black font-black text-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer">−</button>
                      <div className="w-16 h-12 rounded-xl bg-yellow-400 text-black font-black text-xl flex items-center justify-center border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">{animals}</div>
                      <button onClick={() => setAnimals(Math.min(4, animals + 1))} className="w-12 h-12 rounded-xl bg-white border-2 border-black text-black font-black text-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer">+</button>
                    </div>
                    <p className="text-xs text-black/40 font-bold mt-2">+{prices ? formatPrice(prices.extraAnimal) : "15 €"} {t("perAnimal")}</p>
                  </div>
                </div>
              </div>

              {/* Étape 3 : Arrière-plans */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Step n={3} title={t("step3")} />
                  <span className="text-2xl animate-bounce">⬇️</span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {backgrounds.map((bg, i) => (
                    <button key={i} onClick={() => setSelectedBg(i)} className={`relative cursor-pointer aspect-square rounded-xl overflow-hidden transition-all duration-200 border-2 ${selectedBg === i ? "border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] scale-105 z-10" : "border-black/30 hover:border-black"}`}>
                      {selectedBg === i && <Check />}
                      <img src={bg.src} alt={bg.label} className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                        <p className="text-[10px] sm:text-xs font-black text-white text-center truncate">{bg.label}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Étape 4 : Upload */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Step n={4} title={t("step4")} />
                  <span className="text-2xl animate-bounce">⬇️</span>
                </div>
                <div className="border-4 border-dashed border-black rounded-2xl p-8 sm:p-12 text-center bg-white hover:bg-yellow-50 transition-all duration-200">
                  <input
                    type="file"
                    id="photos-upload"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={async (e) => {
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
                        setUploadedPhotos(prev => [...prev, ...urls]);
                      } catch (error) {
                        setUploadError(t("uploadError"));
                        console.error("Upload error:", error);
                      } finally {
                        setUploading(false);
                        e.target.value = '';
                      }
                    }}
                    className="hidden"
                  />
                  <label htmlFor="photos-upload" className="flex flex-col items-center gap-4 cursor-pointer">
                    <div className="w-20 h-20 rounded-2xl bg-yellow-400 border-2 border-black flex items-center justify-center group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3 3 0 013.438 3.42A3.75 3.75 0 0118 19.5H6.75z" /></svg>
                    </div>
                    <p className="text-black font-black text-lg uppercase">{t("uploadTitle")}</p>
                    <p className="text-sm text-black/40 font-bold">{t("uploadSubtitle")}</p>
                    <button 
                      onClick={() => document.getElementById('photos-upload')?.click()}
                      className="mt-2 bg-yellow-400 text-black font-black text-sm uppercase px-8 py-3.5 rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                    >
                      {t("uploadBtn")}
                    </button>
                  </label>
                  {uploading && (
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <div className="w-12 h-12 border-4 border-black border-t-yellow-400 rounded-full animate-spin" />
                      <p className="text-black font-black text-sm uppercase">{t("uploading")}</p>
                    </div>
                  )}
                  
                  {uploadError && (
                    <div className="mt-4 bg-red-100 border-2 border-red-500 rounded-xl p-3 text-sm font-bold text-red-700 text-center">
                      {uploadError}
                    </div>
                  )}
                  
                  {uploadedPhotos.length > 0 && !uploading && (
                    <div className="mt-4">
                      <p className="text-black font-black text-sm mb-2 text-center">
                        {uploadedPhotos.length} photo{uploadedPhotos.length > 1 ? "s" : ""} uploadée{uploadedPhotos.length > 1 ? "s" : ""} ✅
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {uploadedPhotos.map((url, i) => (
                          <div key={i} className="relative group">
                            <img 
                              src={url} 
                              alt={`Upload ${i + 1}`} 
                              className="w-16 h-16 rounded-lg border-2 border-black object-cover transition-transform group-hover:scale-110" 
                            />
                            <div className="absolute inset-0 bg-green-400 border-2 border-black rounded-lg opacity-0 group-hover:opacity-30 transition-opacity" />
                            <button
                              onClick={() => setUploadedPhotos(prev => prev.filter((_, index) => index !== i))}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 border-2 border-black rounded-full flex items-center justify-center text-white font-black text-xs hover:bg-red-600 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Étape 5 : Options d'impression */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Step n={5} title={t("step5")} />
                  <span className="text-2xl animate-bounce">⬇️</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {prints.map((o, i) => (
                    <button key={i} onClick={() => { setSelectedPrint(i); posthog.capture("Option sélectionnée", { type: "print", value: o.label }); }} className={`relative cursor-pointer rounded-xl overflow-hidden transition-all duration-200 border-2 group ${selectedPrint === i ? "border-black bg-yellow-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" : "border-black/30 bg-white hover:border-black"}`}>
                      {selectedPrint === i && <Check />}
                      <div className="aspect-square bg-gray-50 overflow-hidden border-b-2 border-black/20">
                        <img src={o.img} alt={o.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      <div className="p-2 text-center">
                        <p className="font-black text-xs text-black uppercase">{o.label}</p>
                        <p className="text-yellow-600 font-black text-sm">{o.price === 0 ? t("includedLabel") : formatPrice(o.price)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bouton Acheter */}
              <div className="bg-white border-4 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <p className="text-xs text-black/40 uppercase tracking-wider font-black">{t("totalLabel")}</p>
                  <p className="text-4xl sm:text-5xl font-black text-black">{formatPrice(total)}</p>
                  <p className="text-sm text-black/50 font-bold mt-1">{orderDescription}</p>
                </div>
                <button
                  onClick={() => { setShowCheckout(true); posthog.capture("Début du paiement", { total, format, people, animals, print: prints[selectedPrint]?.label }); }}
                  className="w-full sm:w-auto bg-yellow-400 text-black font-black text-lg uppercase px-12 py-5 rounded-full border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                >
                  {t("buyNow")}
                </button>
              </div>

            </div>
          </W>
        </section>

        {/* ═══ GALERIE ═══ */}
        <section className="bg-blue-400 py-14 sm:py-20 border-b-4 border-black">
          <W>
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-black text-white uppercase mb-2">{t("galleryTitle")}</h2>
              <p className="text-white/80 font-bold">{t("gallerySubtitle")}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((src, i) => (
                <div key={i} className="bg-white p-2 pb-5 border-4 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 cursor-pointer" style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (i % 3)}deg)` }}>
                  <div className="aspect-[3/4] rounded overflow-hidden border-2 border-black">
                    <img src={src} alt={`Réalisation ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                </div>
              ))}
            </div>
          </W>
        </section>

        {/* ═══ VIDÉO ═══ */}
        <section className="bg-yellow-400 py-14 sm:py-20 border-b-4 border-black">
          <W>
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-black text-black uppercase mb-2">{t("videoTitle")}</h2>
              <p className="text-black/60 font-bold">{t("videoSubtitle")}</p>
            </div>
            <div className="max-w-3xl mx-auto border-4 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
              <Suspense fallback={<div className="w-full aspect-video bg-gray-100 animate-pulse" />}>
                <SafeYouTube src="https://www.youtube.com/embed/qMFbHtBDKmI" title={t("videoTitle")} />
              </Suspense>
            </div>
          </W>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="bg-white py-14 sm:py-20 border-b-4 border-black">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-black text-black uppercase mb-10">{t("faqTitle")}</h2>
            <div className="flex flex-col gap-4">
              {faqData.map((f, i) => (
                <div key={i} className="border-4 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-blue-400 text-white text-left cursor-pointer hover:bg-blue-500 transition-colors">
                    <span className="font-black text-sm sm:text-base uppercase">{f.q}</span>
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-lg font-black border-2 border-black">{openFaq === i ? "−" : "+"}</span>
                  </button>
                  {openFaq === i && <div className="px-5 py-4 bg-yellow-50 text-black/70 text-sm font-bold leading-relaxed border-t-4 border-black">{f.a}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ AVIS ═══ */}
        <section className="bg-yellow-400 py-14 sm:py-20 border-b-4 border-black">
          <W>
            <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-black text-black uppercase mb-12">{t("reviewsTitle")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.map((r, i) => (
                <div key={i} className="bg-white border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300">
                  <div className="aspect-[4/3] bg-gray-100 border-b-4 border-black">
                    <img src={photos[i % photos.length]} alt={r.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <p className="text-yellow-400 text-lg mb-2 font-black">★★★★★</p>
                    <p className="text-sm text-black/70 font-bold leading-relaxed flex-1">&laquo; {r.text} &raquo;</p>
                    <p className="text-sm font-black text-black mt-3 uppercase">— {r.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </W>
        </section>
      </div>
      <FooterCartoon />
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
        }}
      />
    </>
  );
}
