"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

/* ─── Assets ─────────────────────────────────────────────────────────── */
const LOGO = "https://www.figma.com/api/mcp/asset/eae05cbd-b1cd-49d2-9e52-06fd1e03fe97";
const HERO_IMG = "https://www.figma.com/api/mcp/asset/2bc75121-1bd9-4786-b4df-86b02243d2f7";
const GAL_1 = "https://www.figma.com/api/mcp/asset/57b54e24-5547-4ca7-8ce5-1052b58176ab";
const GAL_2 = "https://www.figma.com/api/mcp/asset/19a87510-c179-4d97-971b-9b702be7c0f6";
const GAL_3 = "https://www.figma.com/api/mcp/asset/a1ef0743-9857-460e-bf42-c5c8f0745fa6";
const GAL_4 = "https://www.figma.com/api/mcp/asset/e7fe6fe9-d8cd-443c-8f55-672de63a2e83";
const BG_1 = "https://www.figma.com/api/mcp/asset/23c06d11-4397-4330-84f0-9c2b145f3758";
const BG_2 = "https://www.figma.com/api/mcp/asset/fb3d6c87-5bf0-4c46-8efc-8bda0459c097";
const BG_3 = "https://www.figma.com/api/mcp/asset/5cb62562-6777-402f-bb69-918ceefa82ca";
const BG_4 = "https://www.figma.com/api/mcp/asset/3903b959-865a-46e9-99ea-870c03e73c68";
const BG_5 = "https://www.figma.com/api/mcp/asset/20141a71-cfab-46d1-9d4c-d77e97f1c1af";
const BG_6 = "https://www.figma.com/api/mcp/asset/9325b927-f4e7-4c41-840d-c3ce35e9fc64";
const BG_7 = "https://www.figma.com/api/mcp/asset/10d51b95-4b50-43b5-b45a-9cf6d8aabb4a";
const BG_8 = "https://www.figma.com/api/mcp/asset/b4600a8f-5ab2-45b5-b25d-1ba6677190a3";
const BG_9 = "https://www.figma.com/api/mcp/asset/6ec9fadc-f03a-43df-982b-93a89ddddb4d";
const BG_10 = "https://www.figma.com/api/mcp/asset/4aeee087-92a0-4466-b49f-7e56fc311100";
const BG_11 = "https://www.figma.com/api/mcp/asset/8948249f-fe1c-43a3-b7c6-a8d1761ebe0b";
const BG_12 = "https://www.figma.com/api/mcp/asset/c87326aa-c71c-4e3a-be4a-9f91e19262d5";
const PRINT_1 = "https://www.figma.com/api/mcp/asset/0670e324-90a4-44df-91e6-5743464d014d";
const PRINT_2 = "https://www.figma.com/api/mcp/asset/78cd59d2-d474-4251-8051-ad19c6fa0cb1";
const PRINT_3 = "https://cdn.shopify.com/s/files/1/0203/3280/6208/products/16x20HorizontalCanvas_180x.png?v=1762091673";
const PRINT_4 = "https://cdn.shopify.com/s/files/1/0203/3280/6208/products/12x16_0e3fc171-ea9b-4381-936d-874ae960385b_180x.png?v=1762961480";
const PRINT_5 = "https://cdn.shopify.com/s/files/1/0203/3280/6208/products/Mug_180x.png?v=1624591093";
const PRINT_6 = "https://www.figma.com/api/mcp/asset/ed9cf85f-7db8-41ff-993e-b20e113ba0d2";
const VID_IMG = "https://www.figma.com/api/mcp/asset/2b0bbeb4-77d6-4736-b7e9-77906efd303d";
const VID_FRAME = "https://www.figma.com/api/mcp/asset/81823bf3-6bf5-430a-887d-936d7b00f21c";
const PAY = "https://www.figma.com/api/mcp/asset/90423acb-bc33-4818-83c9-a8da91fb59b7";
const SAMPLE_MAIN = "https://www.figma.com/api/mcp/asset/741ecdeb-f790-45ce-acc4-b6523576bc83";
const SAMPLE_FRAME = "https://www.figma.com/api/mcp/asset/eedf14eb-85bb-4753-8ccb-515654fbba38";
const CHAR1 = "https://www.figma.com/api/mcp/asset/12e71a51-4e1d-420d-9ed9-8c9f33873dd3";
const CHAR2 = "https://www.figma.com/api/mcp/asset/104b1457-f8e4-403a-8a84-9b6817c5d0fc";
const FAQ_CHARS = "https://www.figma.com/api/mcp/asset/bca8891c-8e81-4b63-8929-3ffe5496fd82";
const REV_1 = "https://www.figma.com/api/mcp/asset/15d7ff69-7d97-4935-8f77-d01c27f77e08";
const REV_2 = "https://www.figma.com/api/mcp/asset/fc82cab6-e10c-4d34-bf9f-2a2dcecebd48";
const REV_3 = "https://www.figma.com/api/mcp/asset/1d011cba-40d8-406f-b9db-2859a6d68df7";
const REV_4 = "https://www.figma.com/api/mcp/asset/16013c7e-77b7-44b9-923e-73c52a5f246f";
const REV_5 = "https://www.figma.com/api/mcp/asset/487077d4-f27e-4bdb-8040-b9513d719f2e";
const REV_6 = "https://www.figma.com/api/mcp/asset/7a62f6f3-e2e1-4a20-8337-9b97226027aa";

/* ─── Shared ─────────────────────────────────────────────────────────── */
const W = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
);

const Step = ({ n, title }: { n: number; title: string }) => (
  <div className="flex items-center gap-3 mb-6">
    <span className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#FFC82C] to-[#ff9b2b] flex items-center justify-center text-white font-extrabold shadow-md shadow-[#FFC82C]/25">{n}</span>
    <h3 className="text-xl font-bold text-gray-900">{title}</h3>
  </div>
);

const Check = () => (
  <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#FFC82C] text-white flex items-center justify-center text-xs shadow-md z-10 font-bold">&#10003;</span>
);

const faqData = [
  { q: "How long does it take to draw the cartoon?", a: "Our artists typically complete your cartoon within 3-5 business days depending on complexity." },
  { q: "Do the people have to all be in one photo?", a: "Not at all! Send us individual photos - our artists will draw everyone together in one picture." },
  { q: "What if I'm not happy with my caricature?", a: "We offer free unlimited revisions until you are completely satisfied. Your happiness is our priority!" },
  { q: "Can my pet turn yellow too?", a: "Absolutely! Dogs, cats, birds - we can turn any beloved pet into a yellow cartoon character." },
  { q: "Can I also have objects drawn?", a: "Yes! We can include objects, vehicles, backgrounds, or props in your cartoon for a small extra fee." },
];

const reviews = [
  { img: REV_1, name: "Jessica Harper", text: "Really well implemented, my drawing. I'm very excited! This won't be the last time I use this service!" },
  { img: REV_2, name: "Nina W.", text: "Fuer meinen Freund als Geschenk der absolute Hammer! Er als Grillmeister :D Was besseres waere uns nicht eingefallen" },
  { img: REV_3, name: "Romana", text: "Waren sehr positiv ueberrascht. Tolles Bild und ein super Support. Gerne jederzeit wieder." },
  { img: REV_4, name: "Thomas K.", text: "Super schnell geliefert und die Qualitaet ist einfach klasse. Meine Frau war begeistert!" },
  { img: REV_5, name: "Sarah M.", text: "Perfect gift for my parents' anniversary. The likeness is incredible and they loved it!" },
  { img: REV_6, name: "Marco P.", text: "Hervorragende Arbeit! Die Zeichnung sieht genau so aus wie wir. Absolut empfehlenswert." },
];

/* ═══════════════════════════════════════════════════════════════════════ */
export default function ProductPage() {
  const [format, setFormat] = useState<"portrait" | "fullbody">("portrait");
  const [people, setPeople] = useState(1);
  const [animals, setAnimals] = useState(0);
  const [selectedBg, setSelectedBg] = useState(0);
  const [selectedPrint, setSelectedPrint] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);

  const backgrounds = [BG_1, BG_2, BG_3, BG_4, BG_5, BG_6, BG_7, BG_8, BG_9, BG_10, BG_11, BG_12];
  const prints = [
    { img: PRINT_1, label: "Digital Only", price: 49 },
    { img: PRINT_2, label: "Poster", price: 69 },
    { img: PRINT_3, label: "Canvas", price: 89 },
    { img: PRINT_4, label: "Framed Poster", price: 79 },
    { img: PRINT_5, label: "Mug", price: 99 },
    { img: PRINT_6, label: "Alu-Dibond", price: 109 },
  ];
  const minis = [GAL_1, GAL_2, GAL_3, GAL_4];

  const total = 49 + (format === "fullbody" ? 20 : 0) + (people - 1) * 15 + animals * 15 + (prints[selectedPrint].price - 49);

  return (
    <div className="min-h-screen bg-white">

      {/* ═══ NAV ═══ */}
      <nav className="fixed inset-x-0 top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <W className="flex items-center justify-between h-16 sm:h-20">
          <a href="/"><img src={LOGO} alt="Yellow Simpsons" className="h-10 sm:h-12 w-auto" /></a>
          <ul className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-700">
            {["Home", "About Us", "Print", "Reviews", "Contact"].map((t) => (
              <li key={t}><a href="#" className="hover:text-[#FFC82C] transition-colors">{t}</a></li>
            ))}
          </ul>
          <a href="#" className="bg-gradient-to-r from-[#FFC82C] to-[#ff9b2b] text-white text-xs font-bold uppercase px-6 py-2.5 rounded-full hover:shadow-lg hover:shadow-[#FFC82C]/30 transition-all">Cart</a>
        </W>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative pt-28 sm:pt-36 pb-14 sm:pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#FFC82C]/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-32 w-80 h-80 bg-[#3B9AE8]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[#FFC82C]/10 rounded-full blur-2xl" />
          <svg className="absolute top-20 left-10 w-20 h-20 text-[#FFC82C]/10" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="currentColor" /></svg>
          <svg className="absolute bottom-10 right-10 w-32 h-32 text-[#3B9AE8]/8" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="currentColor" /></svg>
        </div>
        <W className="relative z-10">
          <nav className="text-sm text-gray-400 mb-8">
            <a href="/" className="hover:text-[#FFC82C] transition-colors">Home</a>
            <span className="mx-2">/</span>
            <span className="text-gray-700 font-medium">Product Details</span>
          </nav>
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 w-full max-w-xl">
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-[#FFC82C]/20 to-[#3B9AE8]/10">
                <img src={HERO_IMG} alt="Product preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-3xl" />
              </div>
            </div>
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 mb-4" aria-label="Trustpilot rating 4.8 out of 5">
                <span className="text-sm font-black text-gray-900">4.8</span>
                <span className="h-4 w-px bg-gray-300" />
                <span className="inline-flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="inline-flex items-center justify-center w-5 h-5 rounded-[3px]" style={{ backgroundColor: "rgb(0, 182, 122)" }}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white" aria-hidden="true"><path d="M12 17.27l-5.18 3.05 1.4-5.95L3.5 9.24l6.06-.52L12 3l2.44 5.72 6.06.52-4.72 5.13 1.4 5.95z" /></svg>
                    </span>
                  ))}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-gray-900 mb-5">
                Create Your{" "}<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFC82C] to-[#ff8b2b]">Custom Cartoon</span>
              </h1>
              <p className="text-lg text-gray-500 mb-8 max-w-md mx-auto lg:mx-0">Transform yourself into a hand-drawn Simpson-style caricature. The perfect unique gift for any occasion!</p>
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                {[{ i: "pencil", l: "Hand drawn" }, { i: "refresh", l: "Free revision" }, { i: "box", l: "Fast shipping" }].map((b) => (
                  <div key={b.l} className="flex items-center gap-2 bg-white shadow-sm border border-gray-100 rounded-full px-4 py-2 text-sm">
                    <span className="w-8 h-8 rounded-full bg-[#FFC82C]/10 flex items-center justify-center text-sm">
                      {b.i === "pencil" ? "✏️" : b.i === "refresh" ? "🔄" : "📦"}
                    </span>
                    <strong className="text-gray-700">{b.l}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </W>
      </section>

      {/* ═══ FORM ═══ */}
      <section className="py-14 sm:py-20">
        <W>
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">Customize Your <span className="text-[#FFC82C]">Caricature</span></h2>
            <p className="text-gray-500 max-w-lg mx-auto">Pick your options step by step. The total updates live.</p>
          </div>

          <div className="max-w-5xl mx-auto bg-[#fffdf5] border border-[#FFC82C]/15 rounded-3xl shadow-xl p-6 sm:p-10 flex flex-col gap-14">

            {/* S1 Format */}
            <div>
              <Step n={1} title="Choose Your Format" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {([
                  { key: "portrait" as const, label: "Portrait", desc: "Head & shoulders - classic style", extra: "Included", icon: "👤" },
                  { key: "fullbody" as const, label: "Full Body", desc: "Head to toe - show your whole style", extra: "+€20", icon: "🧍" },
                ]).map((o) => (
                  <button key={o.key} onClick={() => setFormat(o.key)} className={`relative cursor-pointer text-left rounded-2xl p-6 transition-all duration-200 border-2 ${format === o.key ? "border-[#FFC82C] bg-[#FFC82C]/8 shadow-lg shadow-[#FFC82C]/15" : "border-gray-200 bg-white hover:border-[#FFC82C]/40 hover:shadow-sm"}`}>
                    {format === o.key && <Check />}
                    <div className="text-3xl mb-3">{o.icon}</div>
                    <p className="font-bold text-lg text-gray-900">{o.label}</p>
                    <p className="text-sm text-gray-500 mt-1">{o.desc}</p>
                    <p className="text-sm font-extrabold text-[#FFC82C] mt-3">{o.extra}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* S2 People & Animals */}
            <div>
              <Step n={2} title="How Many People & Animals?" />
              <div className="flex flex-col sm:flex-row gap-10">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-700 mb-3">👥 People</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setPeople(Math.max(1, people - 1))} className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xl flex items-center justify-center transition-colors cursor-pointer">−</button>
                    <div className="w-16 h-12 rounded-xl bg-[#FFC82C] text-white font-extrabold text-xl flex items-center justify-center shadow-md shadow-[#FFC82C]/25">{people}</div>
                    <button onClick={() => setPeople(Math.min(6, people + 1))} className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xl flex items-center justify-center transition-colors cursor-pointer">+</button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">1st included · +€15 each extra</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-700 mb-3">🐾 Animals</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setAnimals(Math.max(0, animals - 1))} className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xl flex items-center justify-center transition-colors cursor-pointer">−</button>
                    <div className="w-16 h-12 rounded-xl bg-[#FFC82C] text-white font-extrabold text-xl flex items-center justify-center shadow-md shadow-[#FFC82C]/25">{animals}</div>
                    <button onClick={() => setAnimals(Math.min(4, animals + 1))} className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xl flex items-center justify-center transition-colors cursor-pointer">+</button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">+€15 per animal</p>
                </div>
              </div>
            </div>

            {/* S3 Backgrounds */}
            <div>
              <Step n={3} title="Pick a Background" />
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {backgrounds.map((src, i) => (
                  <button key={i} onClick={() => setSelectedBg(i)} className={`relative cursor-pointer aspect-square rounded-xl overflow-hidden transition-all duration-200 border-2 ${selectedBg === i ? "border-[#FFC82C] shadow-lg shadow-[#FFC82C]/20 scale-105 z-10" : "border-gray-200 hover:border-[#FFC82C]/40 hover:shadow-sm"}`}>
                    {selectedBg === i && <Check />}
                    <img src={src} alt={`BG ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* S4 Upload */}
            <div>
              <Step n={4} title="Upload Your Photos" />
              <div className="border-2 border-dashed border-[#FFC82C]/40 rounded-2xl p-8 sm:p-12 text-center bg-white hover:border-[#FFC82C] hover:bg-[#FFC82C]/[0.02] transition-all duration-200 group">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FFC82C]/15 to-[#ff9b2b]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-10 h-10 text-[#FFC82C]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3 3 0 013.438 3.42A3.75 3.75 0 0118 19.5H6.75z" /></svg>
                  </div>
                  <p className="text-gray-800 font-bold text-lg">Drag & drop your photos here</p>
                  <p className="text-sm text-gray-400">or click to browse — JPG, PNG up to 10 MB</p>
                  <button className="mt-2 bg-gradient-to-r from-[#FFC82C] to-[#ff9b2b] text-white font-bold text-sm uppercase px-8 py-3.5 rounded-full hover:shadow-lg hover:shadow-[#FFC82C]/30 transition-all cursor-pointer">Choose Files</button>
                </div>
              </div>
            </div>

            {/* S5 Print */}
            <div>
              <Step n={5} title="Print & Delivery" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {prints.map((o, i) => (
                  <button key={i} onClick={() => setSelectedPrint(i)} className={`relative cursor-pointer rounded-2xl overflow-hidden transition-all duration-200 border-2 group ${selectedPrint === i ? "border-[#FFC82C] shadow-lg shadow-[#FFC82C]/15 bg-[#FFC82C]/5" : "border-gray-200 bg-white hover:border-[#FFC82C]/40 hover:shadow-sm"}`}>
                    {selectedPrint === i && <Check />}
                    <div className="aspect-[4/3] bg-gray-50 overflow-hidden">
                      <img src={o.img} alt={o.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                    <div className="p-4 text-center">
                      <p className="font-bold text-sm text-gray-900">{o.label}</p>
                      <p className="text-[#FFC82C] font-extrabold text-lg mt-1">€{o.price}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sticky total */}
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 sticky bottom-4 z-30">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Your Total</p>
                <p className="text-4xl sm:text-5xl font-extrabold text-gray-900">€{total}</p>
                <p className="text-sm text-gray-400 mt-1">{format === "fullbody" ? "Full Body" : "Portrait"} · {people} person{people > 1 ? "s" : ""}{animals > 0 ? ` + ${animals} pet${animals > 1 ? "s" : ""}` : ""} · {prints[selectedPrint].label}</p>
              </div>
              <button className="w-full sm:w-auto bg-gradient-to-r from-[#FFC82C] to-[#ff8b2b] text-white font-extrabold text-lg uppercase px-12 py-5 rounded-full hover:shadow-xl hover:shadow-[#FFC82C]/40 hover:scale-105 transition-all cursor-pointer">Add to Cart</button>
            </div>

          </div>
        </W>
      </section>

      {/* ═══ SAMPLE ═══ */}
      <section className="bg-gray-50 py-14 sm:py-20">
        <W>
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">Sample <span className="text-[#FFC82C]">Result</span></h2>
            <p className="text-gray-500">See what your finished caricature could look like!</p>
          </div>
          <div className="max-w-2xl mx-auto mb-6">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl bg-gray-100">
              <img src={SAMPLE_MAIN} alt="Sample" className="w-full h-full object-cover" />
              <img src={SAMPLE_FRAME} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
            {minis.map((s, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden border-2 border-gray-200 hover:border-[#FFC82C] hover:scale-105 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md">
                <img src={s} alt={`Ex ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </W>
      </section>

      {/* ═══ VIDEO ═══ */}
      <section className="bg-gradient-to-br from-[#FFC82C] to-[#ff9b2b] py-14 sm:py-20 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-32 -right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        </div>
        <W className="relative z-10">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">This Is How We Draw You</h2>
            <p className="text-white/80">Watch the magic happen!</p>
          </div>
          <div className="max-w-3xl mx-auto">
            <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl bg-gray-900 ring-4 ring-white/20">
              <img src={VID_IMG} alt="Video" className="absolute inset-0 w-full h-full object-cover" />
              <img src={VID_FRAME} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
              <div className="absolute inset-0 bg-black/10" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl cursor-pointer hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-[#FFC82C] ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center mt-10">
            <div className="bg-white/15 backdrop-blur-sm rounded-full px-8 py-3">
              <img src={PAY} alt="Payment methods" className="h-6 sm:h-8 w-auto" />
            </div>
          </div>
        </W>
      </section>

      {/* ═══ RASSURANCE BAR ═══ */}
      <section className="bg-[#1a5fa8] py-12 sm:py-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"><div className="absolute top-0 left-1/3 w-96 h-96 bg-[#3B9AE8]/30 rounded-full blur-3xl" /></div>
        <W className="relative z-10">
          <p className="text-center text-xl sm:text-2xl font-extrabold text-white uppercase tracking-wider mb-10">Only 4 Artists Left — Order Now!</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { icon: "✏️", title: "Hand Drawn", desc: "Every piece is 100% hand-drawn by a professional artist." },
              { icon: "🔄", title: "Free Revision", desc: "Not satisfied? We revise your cartoon for free — unlimited!" },
              { icon: "💬", title: "24/7 Support", desc: "Our team is here to help you any time of the day." },
            ].map((x) => (
              <div key={x.title} className="flex flex-col items-center text-center p-6 sm:p-8">
                <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center mb-4 shadow-lg shadow-black/10">
                  <span className="text-4xl">{x.icon}</span>
                </div>
                <p className="font-extrabold text-white text-lg mb-2">{x.title}</p>
                <p className="text-sm text-blue-200 leading-relaxed">{x.desc}</p>
              </div>
            ))}
          </div>
        </W>
      </section>

      {/* ═══ RASSURANCE CARDS ═══ */}
      <section className="bg-white py-14 sm:py-20">
        <W>
          <div className="flex flex-col gap-10 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="flex-shrink-0 w-40 sm:w-52"><img src={CHAR1} alt="" className="w-full h-auto drop-shadow-lg" /></div>
              <div className="flex-1 bg-gradient-to-br from-[#fffdf5] to-white rounded-2xl p-6 sm:p-8 shadow-lg border border-[#FFC82C]/10">
                <span className="inline-block bg-gradient-to-r from-[#FFC82C] to-[#ff9b2b] text-white text-xs font-bold uppercase px-4 py-1.5 rounded-full mb-3 shadow-sm">Our Promise</span>
                <p className="text-gray-600 leading-relaxed">We are the original and the biggest in Europe! With over <strong className="text-gray-900">85,000 caricatures</strong> created and more than 3,000 five-star ratings, your satisfaction is guaranteed.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row-reverse items-center gap-8">
              <div className="flex-shrink-0 w-40 sm:w-52"><img src={CHAR2} alt="" className="w-full h-auto drop-shadow-lg" /></div>
              <div className="flex-1 bg-gradient-to-br from-[#f0f7ff] to-white rounded-2xl p-6 sm:p-8 shadow-lg border border-[#3B9AE8]/10">
                <span className="inline-block bg-gradient-to-r from-[#3B9AE8] to-[#1a5fa8] text-white text-xs font-bold uppercase px-4 py-1.5 rounded-full mb-3 shadow-sm">Quality Guaranteed</span>
                <p className="text-gray-600 leading-relaxed">We partner with top German printers for <strong className="text-gray-900">premium quality</strong> prints. Every cartoon is printed on archival-quality paper and carefully packaged.</p>
              </div>
            </div>
          </div>
        </W>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="bg-gray-50 py-14 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1a5fa8] mb-10">Frequently Asked Questions</h2>
          <div className="flex flex-col gap-3">
            {faqData.map((f, i) => (
              <div key={i} className="rounded-xl overflow-hidden shadow-sm border border-gray-200">
                <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-[#1a5fa8] text-white text-left cursor-pointer hover:bg-[#164f8f] transition-colors">
                  <span className="font-semibold text-sm sm:text-base">{f.q}</span>
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && <div className="px-5 py-4 bg-blue-50 text-gray-700 text-sm leading-relaxed border-t border-blue-100">{f.a}</div>}
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-12"><img src={FAQ_CHARS} alt="Characters" className="w-full max-w-md h-auto" /></div>
        </div>
      </section>

      {/* ═══ REVIEWS ═══ */}
      <section className="relative py-14 sm:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[#fffbeb]" />
        <svg className="absolute top-0 left-0 w-full" viewBox="0 0 1440 60" preserveAspectRatio="none"><path d="M0,60 C360,0 720,0 1080,30 C1260,45 1440,60 1440,60 L0,60Z" fill="#f9fafb" /></svg>
        <W className="relative z-10">
          <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#9c3605] mb-12">Thank You For Your Trust</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((r, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow overflow-hidden flex flex-col border border-gray-100">
                <div className="aspect-[4/3] bg-gray-100"><img src={r.img} alt={r.name} className="w-full h-full object-cover" /></div>
                <div className="p-5 flex-1 flex flex-col">
                  <p className="text-[#FFC82C] text-sm mb-2 tracking-wide">★★★★★</p>
                  <p className="text-sm text-gray-600 leading-relaxed flex-1">&ldquo;{r.text}&rdquo;</p>
                  <p className="text-sm font-bold text-gray-900 mt-3">— {r.name}</p>
                </div>
              </div>
            ))}
          </div>
        </W>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-gray-900 text-white">
        <W className="pt-14 pb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-gray-800">
            <div>
              <img src={LOGO} alt="Yellow Simpsons" className="h-12 w-auto mb-3 brightness-0 invert" />
              <p className="text-xs text-gray-400 leading-relaxed">The original Simpson-style caricature service.</p>
            </div>
            {[
              { t: "More Info", l: ["Contact", "FAQ", "Our Team", "Prices"] },
              { t: "Legal", l: ["Refund Policy", "Privacy Policy", "Terms of Service"] },
              { t: "About", l: ["About Us", "Reviews", "Blog"] },
            ].map((c) => (
              <div key={c.t}>
                <h4 className="font-bold text-sm mb-3">{c.t}</h4>
                <ul className="flex flex-col gap-2 text-sm text-gray-400">{c.l.map((k) => <li key={k}><a href="#" className="hover:text-white transition-colors">{k}</a></li>)}</ul>
              </div>
            ))}
          </div>
        </W>
        <div className="bg-gray-950 py-3"><p className="text-center text-sm text-gray-500">&copy; 2023 <strong className="text-gray-400">Yellow Simpsons.com</strong></p></div>
      </footer>
    </div>
  );
}
