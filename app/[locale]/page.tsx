"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";

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

const collections = [
  { name: "Simpson", href: "/simpson", color: "from-amber-400 to-yellow-400", img: "/simpson_photos_produit/0009_1.jpg" },
  { name: "Dragon Ball Z", href: "/dbz", color: "from-orange-400 to-orange-500", img: "/DBZ/Photo_produits/1.png" },
  { name: "Disney", href: "/disney", color: "from-pink-400 to-pink-500", img: "/Disney/Photo_produits/1.png" },
  { name: "Ghibli", href: "/ghibli", color: "from-emerald-400 to-green-500", img: "/Ghibli/Photo_produits/il_794xN.7001686030_jbst.png" },
  { name: "One Piece", href: "/onepiece", color: "from-amber-500 to-orange-500", img: "/onepiece/wanted_produit/il_1140xN.7027231626_qn94.png" },
  { name: "Rick & Morty", href: "/rickandmorty", color: "from-lime-400 to-green-500", img: "/rickandmorty/Photo_produits/1.png" },
];



export default function Home() {
  const t = useTranslations("home");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activePhoto, setActivePhoto] = useState(0);

  const faqData = [
    { q: t("faqQ1"), a: t("faqA1") },
    { q: t("faqQ2"), a: t("faqA2") },
    { q: t("faqQ3"), a: t("faqA3") },
    { q: t("faqQ4"), a: t("faqA4") },
    { q: t("faqQ5"), a: t("faqA5") },
  ];

  const reviews = [
    { name: t("review1Name"), text: t("review1Text"), photo: 0 },
    { name: t("review2Name"), text: t("review2Text"), photo: 1 },
    { name: t("review3Name"), text: t("review3Text"), photo: 2 },
    { name: t("review4Name"), text: t("review4Text"), photo: 3 },
    { name: t("review5Name"), text: t("review5Text"), photo: 7 },
    { name: t("review6Name"), text: t("review6Text"), photo: 8 },
  ];

  return (
    <div className="min-h-screen bg-amber-50">

        {/* ═══ HERO ═══ */}
        <section className="relative bg-gradient-to-br from-amber-100 via-amber-50 to-yellow-50 pt-28 sm:pt-32 pb-16 sm:pb-20 overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-20 -left-10 w-40 h-40 rounded-full bg-amber-200/30 blur-2xl" />
            <div className="absolute top-40 right-10 w-32 h-32 rounded-full bg-pink-200/20 blur-xl" />
            <div className="absolute bottom-20 left-[20%] w-48 h-48 rounded-full bg-blue-200/20 blur-2xl" />
            <div className="absolute -bottom-10 right-[15%] w-56 h-56 rounded-full bg-amber-300/20 blur-2xl" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              {/* Left: Text */}
              <div className="text-center lg:text-left order-2 lg:order-1">
                <div className="inline-flex items-center gap-2 bg-white border-2 border-black rounded-full px-4 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] mb-6">
                  <div className="flex">{[...Array(5)].map((_, i) => <span key={i} className="text-amber-500 text-sm">★</span>)}</div>
                  <span className="text-gray-700 text-sm font-bold">4.9/5</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500 text-sm">{t("heroRating")}</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] mb-5">
                  <span className="text-gray-900">{t("heroTitle1")}</span>
                  <span className="text-amber-500 inline-block -rotate-1">{t("heroTitle2")}</span>
                </h1>

                <p className="text-gray-600 text-lg lg:text-xl max-w-lg mx-auto lg:mx-0 mb-8 leading-relaxed">
                  {t("heroSubtitle")}
                </p>

                <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                  <Link href="/collections" onClick={() => posthog.capture("cta_clicked", { cta: "hero_create_portrait", source: "homepage" })} className="group bg-amber-400 text-black font-black text-base px-8 py-4 rounded-xl border-3 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] active:shadow-none active:translate-x-[5px] active:translate-y-[5px] transition-all">
                    <span className="flex items-center gap-2">
                      {t("createMyPortrait")}
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </span>
                  </Link>
                  <a href="#comment-ca-marche" className="bg-white text-gray-900 font-bold text-base px-8 py-4 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                    {t("howItWorksLink")}
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-6 justify-center lg:justify-start mt-8 text-gray-500 text-sm">
                  <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>{t("satisfiedOrRefunded")}</span>
                  <span>{t("handDrawn")}</span>
                  <span>{t("delivered48h")}</span>
                </div>
              </div>

              {/* Right: Image showcase */}
              <div className="order-1 lg:order-2">
                <div className="relative max-w-md mx-auto">
                  {/* Main image */}
                  <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border-3 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    <Image src={photos[activePhoto]} alt={t("portraitAlt")} fill className="object-cover transition-all duration-500" sizes="(max-width: 768px) 90vw, 400px" priority />
                  </div>
                  {/* Thumbnails */}
                  <div className="flex gap-2 justify-center mt-4">
                    {photos.slice(0, 5).map((photo, i) => (
                      <button key={i} onClick={() => setActivePhoto(i)} className={`w-14 h-14 rounded-lg overflow-hidden border-2 border-black transition-all duration-200 ${activePhoto === i ? "ring-2 ring-amber-400 scale-110 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" : "opacity-70 hover:opacity-100 hover:scale-105"}`}>
                        <Image src={photo} alt="" width={56} height={56} className="object-cover w-full h-full" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Social proof bar */}
          <div className="mt-16 bg-gray-900 py-4 border-y-3 border-black">
            <div className="max-w-5xl mx-auto px-4 flex items-center justify-center gap-8 sm:gap-14 flex-wrap">
              {[{ v: "2,500+", l: t("portraitsCreated") }, { v: "4.9★", l: t("averageRating") }, { v: "48h", l: t("delivery") }, { v: "100%", l: t("satisfactionGuarantee") }].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-amber-400 font-black text-lg sm:text-xl">{s.v}</span>
                  <span className="text-gray-300 text-xs sm:text-sm font-medium">{s.l}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ COLLECTIONS ═══ */}
        <section className="py-16 sm:py-20 bg-amber-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl sm:text-4xl font-black text-gray-900 mb-3 uppercase">
              <span className="inline-block -rotate-1">{t("collectionsTitle")}</span> 🎨
            </h2>
            <p className="text-center text-gray-500 text-lg mb-12 max-w-lg mx-auto">
              {t("collectionsSubtitle")}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {collections.map((c, i) => (
                <Link key={c.name} href={c.href} onClick={() => posthog.capture("collection_clicked", { collection: c.name, position: i, source: "homepage" })} className={`group relative bg-white rounded-2xl border-3 border-black overflow-hidden shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-300`} style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * 1}deg)` }}>
                  <div className="aspect-[4/5] relative">
                    <Image src={c.img} alt={c.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 45vw, 30vw" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  </div>
                  <div className={`absolute bottom-0 left-0 right-0 p-4`}>
                    <span className={`inline-block bg-gradient-to-r ${c.color} text-black font-black text-sm uppercase px-4 py-2 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
                      {c.name}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ COMMENT ÇA MARCHE ═══ */}
        <section id="comment-ca-marche" className="py-16 sm:py-20 bg-amber-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl sm:text-4xl font-black text-gray-900 mb-3 uppercase">
              <span className="inline-block rotate-1">{t("howItWorksTitle")}</span> 🤔
            </h2>
            <p className="text-center text-gray-500 text-lg mb-12 max-w-lg mx-auto">
              {t("howItWorksSubtitle")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { n: "1", title: t("step1Title"), icon: "📸", desc: t("step1Desc"), color: "bg-amber-100" },
                { n: "2", title: t("step2Title"), icon: "✏️", desc: t("step2Desc"), color: "bg-pink-100" },
                { n: "3", title: t("step3Title"), icon: "🎁", desc: t("step3Desc"), color: "bg-emerald-100" },
              ].map((s) => (
                <div key={s.n} className={`${s.color} border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 text-center hover:-translate-y-2 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 relative`}>
                  <span className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-black text-sm border-2 border-black">{s.n}</span>
                  <div className="w-16 h-16 rounded-full bg-white border-2 border-black flex items-center justify-center text-3xl mx-auto mb-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">{s.icon}</div>
                  <h3 className="text-base font-black text-gray-900 uppercase mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-10">
              <Link href="/collections" onClick={() => posthog.capture("cta_clicked", { cta: "how_it_works_start_now", source: "homepage" })} className="bg-amber-400 text-black font-black text-sm uppercase px-8 py-4 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                {t("startNow")}
              </Link>
            </div>
          </div>
        </section>

        {/* ═══ GALERIE ═══ */}
        <section className="py-16 sm:py-20 bg-amber-50 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-10 right-[10%] w-32 h-32 rounded-full bg-amber-200/30" />
            <div className="absolute bottom-20 left-[5%] w-24 h-24 rounded-full bg-pink-200/20" />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <h2 className="text-center text-3xl sm:text-4xl font-black text-gray-900 mb-3 uppercase">
              <span className="inline-block -rotate-1">{t("galleryTitle")}</span> 🖼️
            </h2>
            <p className="text-center text-gray-500 text-lg mb-12">
              {t("gallerySubtitle")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
              {photos.slice(0, 8).map((src, i) => (
                <div key={i} className={`group bg-white p-2 pb-6 border-2 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 hover:shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 cursor-pointer ${i < 2 ? "sm:col-span-2 sm:row-span-2" : ""}`} style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (1 + i % 3)}deg)` }}>
                  <div className={`relative rounded overflow-hidden border border-black ${i < 2 ? "aspect-square" : "aspect-[3/4]"}`}>
                    <Image src={src} alt={`${t("realizationAlt")} ${i + 1}`} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes={i < 2 ? "(max-width: 768px) 45vw, 33vw" : "(max-width: 768px) 45vw, 16vw"} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-10">
              <Link href="/portfolio" className="bg-white text-gray-900 font-black text-sm uppercase px-8 py-4 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                {t("viewPortfolio")}
              </Link>
            </div>
          </div>
        </section>

        {/* ═══ POURQUOI NOUS ═══ */}
        <section className="py-16 sm:py-20 bg-amber-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl sm:text-4xl font-black text-gray-900 mb-12 uppercase">
              <span className="inline-block rotate-1">{t("whyUsTitle")}</span> 💪
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { color: "bg-amber-100", icon: "😊", title: t("whyUs1Title"), desc: t("whyUs1Desc") },
                { color: "bg-pink-100", icon: "✏️", title: t("whyUs2Title"), desc: t("whyUs2Desc") },
                { color: "bg-emerald-100", icon: "⚡", title: t("whyUs3Title"), desc: t("whyUs3Desc") },
              ].map((item) => (
                <div key={item.title} className={`${item.color} border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 text-center hover:-translate-y-1 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all`}>
                  <span className="text-4xl mb-3 block">{item.icon}</span>
                  <h3 className="font-black text-gray-900 uppercase text-base mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ AVIS CLIENTS ═══ */}
        <section id="avis" className="py-16 sm:py-20 bg-amber-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 uppercase mb-3">
                <span className="inline-block rotate-1">{t("reviewsTitle")}</span> ⭐
              </h2>
              <div className="flex items-center justify-center gap-2 mt-3">
                <div className="flex gap-0.5">{[...Array(5)].map((_, i) => <span key={i} className="text-amber-500 text-lg">★</span>)}</div>
                <span className="text-gray-700 text-base font-bold">4.9/5</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500 text-sm">{t("verifiedReviewsCount")}</span>
              </div>
            </div>
            {/* Featured review */}
            <div className="bg-white border-2 border-black rounded-2xl p-6 mb-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] max-w-2xl mx-auto">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-black text-white text-lg">{reviews[0]?.name.charAt(0)}</div>
                <div>
                  <p className="font-black text-gray-900">{reviews[0]?.name}</p>
                  <div className="flex items-center gap-1">{[...Array(5)].map((_, j) => <span key={j} className="text-amber-500 text-sm">★</span>)}<span className="text-green-600 text-xs font-semibold ml-1.5 bg-green-100 px-1.5 py-0.5 rounded">{t("verified")}</span></div>
                </div>
              </div>
              <p className="text-gray-700 text-base leading-relaxed">&ldquo;{reviews[0]?.text}&rdquo;</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviews.slice(1).map((review, i) => (
                <div key={i} className="bg-white rounded-xl p-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center font-bold text-white text-sm">{review.name.charAt(0)}</div>
                    <div><p className="font-bold text-gray-900 text-sm">{review.name}</p><div className="flex items-center gap-0.5">{[...Array(5)].map((_, j) => <span key={j} className="text-amber-500 text-sm">★</span>)}<span className="text-gray-400 text-xs ml-1.5">{t("verified")}</span></div></div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{review.text}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-10">
              <Link href="/avis" className="bg-white text-gray-900 font-black text-sm uppercase px-8 py-4 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                {t("viewAllReviews")}
              </Link>
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section id="faq" className="py-16 sm:py-20 bg-amber-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl sm:text-4xl font-black text-gray-900 uppercase mb-10">
              <span className="inline-block -rotate-1">{t("faqTitle")}</span> 🤓
            </h2>
            <div className="space-y-3">
              {faqData.map((faq, i) => (
                <div key={i} className={`bg-white rounded-xl border-2 border-black overflow-hidden transition-all duration-200 ${openFaq === i ? "shadow-[4px_4px_0px_0px_rgba(251,191,36,0.8)]" : "shadow-[3px_3px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)]"}`}>
                  <button onClick={() => { const newState = openFaq === i ? null : i; setOpenFaq(newState); if (newState !== null) posthog.capture("faq_toggled", { question_index: i, question: faq.q, source: "homepage" }); }} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
                    <span className="font-bold text-gray-900 text-sm sm:text-base">{faq.q}</span>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${openFaq === i ? "bg-amber-400 text-black rotate-180" : "bg-gray-100 text-gray-400"}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </span>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-96" : "max-h-0"}`}><p className="px-5 pb-5 text-gray-500 text-sm sm:text-base leading-relaxed">{faq.a}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Wave separator */}
        <svg viewBox="0 0 1440 40" className="w-full -mb-1 text-amber-400" preserveAspectRatio="none"><path fill="currentColor" d="M0,20 C360,0 720,40 1080,20 C1260,10 1380,30 1440,20 L1440,40 L0,40 Z" /></svg>

        {/* ═══ CTA FINAL ═══ */}
        <section className="relative py-14 sm:py-20 bg-amber-400 overflow-hidden border-t-3 border-black">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-8 left-[8%] w-16 h-16 rounded-full bg-white/20" />
            <div className="absolute bottom-12 right-[10%] w-24 h-12 rounded-full bg-white/15" />
          </div>
          <div className="max-w-3xl mx-auto px-4 text-center relative">
            <div className="flex items-center justify-center gap-1 mb-4">{[...Array(5)].map((_, i) => <span key={i} className="text-black text-lg">★</span>)}<span className="text-black/70 font-bold text-sm ml-2">4.9/5 — 2,500+ portraits</span></div>
            <h2 className="text-3xl sm:text-4xl font-black text-black mb-3 uppercase"><span className="inline-block -rotate-1">{t("ctaTitle")}</span></h2>
            <p className="text-base text-black/60 mb-8 max-w-lg mx-auto">{t("ctaSubtitle")}</p>
            <Link href="/collections" onClick={() => posthog.capture("cta_clicked", { cta: "final_cta_create_portrait", source: "homepage" })} className="inline-flex items-center gap-2 bg-black text-amber-400 font-black text-lg px-10 py-5 rounded-xl border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[3px] hover:translate-y-[3px] active:shadow-none active:translate-x-[6px] active:translate-y-[6px] transition-all uppercase">
              {t("createMyPortrait")}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
            <p className="mt-5 text-sm text-black/40">{t("ctaReassurance")}</p>
          </div>
        </section>
      </div>
  );
}
