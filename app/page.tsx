"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

/* ─── Assets (Figma MCP – valid 7 days) ─────────────────────────────── */
const LOGO       = "https://www.figma.com/api/mcp/asset/21ffab25-828a-49c4-8455-9c2fa4259bcf";
const HERO_BG    = "https://www.figma.com/api/mcp/asset/e5f3ad09-2378-45bf-8fc5-6ac65fdcca15";
const HERO_CHAR  = "https://www.figma.com/api/mcp/asset/676147da-0c5d-4687-b7da-1e40a57dd32e";
const STEP_A     = "https://www.figma.com/api/mcp/asset/02f1d419-bc33-4ac0-adca-770c39b20d1d";
const STEP_B     = "https://www.figma.com/api/mcp/asset/968254f4-b76e-4f11-ad7a-584d7c380f3d";
const GAL1       = "https://www.figma.com/api/mcp/asset/d59d20df-783f-45a2-80bd-bc16cc0386c2";
const GAL2       = "https://www.figma.com/api/mcp/asset/00f55b02-9103-40a7-9832-9aca8bc6a3a7";
const GAL3       = "https://www.figma.com/api/mcp/asset/11a706c0-b2e1-470b-864c-56f2070e5907";
const GAL4       = "https://www.figma.com/api/mcp/asset/97ea3ce3-c85a-40f9-98c8-bb0af4daff4f";
const UNBOX_CHAR = "https://www.figma.com/api/mcp/asset/ee0de2a2-1dd5-450b-af0d-f1897797b777";
const UNBOX_VID  = "https://www.figma.com/api/mcp/asset/3da2dced-257e-4329-941a-0f6f4f365444";
const UNBOX_FRAME= "https://www.figma.com/api/mcp/asset/fa8ebbbe-fb6e-4d88-a9f4-0ef43060ea05";
const WHY1       = "https://www.figma.com/api/mcp/asset/bbd1adef-2dc3-480f-ba77-0f3bd8f5ac42";
const WHY2       = "https://www.figma.com/api/mcp/asset/8de7c67f-318b-4aa5-9a4a-06c26e99f0a7";
const WHY3       = "https://www.figma.com/api/mcp/asset/f9597412-204f-42e9-840e-9a895be4a549";
const AVATAR     = "https://www.figma.com/api/mcp/asset/ed54335b-c676-47b6-94b2-829fcf62593f";
const FAQ_CHARS  = "https://www.figma.com/api/mcp/asset/4ec8abaf-fa53-4184-922e-a2ee00034f09";

/* ─── Shared wrapper ─────────────────────────────────────────────────── */
const Container = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
);

/* ─── FAQ data ───────────────────────────────────────────────────────── */
const faqData = [
  { q: "How long does it take to draw the cartoon?", a: "Our artists typically complete your cartoon within 3–5 business days depending on complexity." },
  { q: "Do the people have to all be in one photo?", a: "Not at all! Send us individual photos — our artists will draw everyone together in one picture." },
  { q: "What if I'm not happy with my caricature?", a: "We offer free unlimited revisions until you are completely satisfied. Your happiness is our priority!" },
  { q: "Can my pet turn yellow too?", a: "Absolutely! Dogs, cats, birds — we can turn any beloved pet into a yellow cartoon character." },
  { q: "Can I also have objects drawn?", a: "Yes! We can include objects, vehicles, backgrounds, or props in your cartoon for a small extra fee." },
];

/* ─── Page ───────────────────────────────────────────────────────────── */
export default function Home() {
  const [openFaq, setOpenFaq] = useState(1);

  return (
    <div className="min-h-screen bg-white">

      {/* ══════════════════════ NAVBAR ══════════════════════ */}
      <nav className="fixed inset-x-0 top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <Container className="flex items-center justify-between h-16 sm:h-20">
          <img src={LOGO} alt="Yellow Simpsons" className="h-10 sm:h-12 w-auto" />
          <ul className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-700">
            {["Home","About Us","Print","Reviews","Contact"].map((t,i)=>(
              <li key={t}>
                <a href="#" className={`transition-colors hover:text-[#FFC82C] ${i===0?"text-[#FFC82C]":""}`}>{t}</a>
              </li>
            ))}
          </ul>
          <a href="#" className="inline-flex items-center gap-2 bg-[#FFC82C] text-white text-xs font-bold uppercase px-5 py-2.5 rounded-full hover:bg-[#e6b526] transition-colors">
            Cart
          </a>
        </Container>
      </nav>

      {/* ══════════════════════ HERO ══════════════════════ */}
      <section className="relative bg-gradient-to-b from-gray-50 to-white pt-28 sm:pt-36 pb-16 sm:pb-24 overflow-hidden">
        {/* Subtle background image */}
        <img src={HERO_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none" />

        {/* Decorative yellow glow — no fixed sizes, just a background effect */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-bl from-[#FFC82C]/25 to-transparent pointer-events-none" />

        <Container className="relative z-10 flex flex-col md:flex-row items-center gap-10 md:gap-16">
          {/* Text */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight">
              <span className="text-[#FFC82C]">Turn Your Photo</span><br />
              <span className="text-gray-900">Into Affordable Art</span>
            </h1>
            <p className="mt-5 text-lg text-gray-600 max-w-md mx-auto md:mx-0">
              Get a hand-drawn Simpson-style caricature of yourself, your family, or your pet. The perfect unique gift!
            </p>
            <div className="mt-8 flex flex-wrap gap-4 justify-center md:justify-start">
              <a href="#" className="bg-[#FFC82C] text-white font-bold text-sm uppercase px-8 py-3.5 rounded-full hover:bg-[#e6b526] transition-colors shadow-lg shadow-[#FFC82C]/30">
                Get Yours Now
              </a>
              <a href="#" className="border-2 border-[#FFC82C] text-[#9c3605] font-bold text-sm uppercase px-8 py-3.5 rounded-full hover:bg-[#FFC82C] hover:text-white transition-colors">
                Learn More
              </a>
            </div>
          </div>
          {/* Character — flex-shrink-0, responsive width via Tailwind */}
          <div className="flex-shrink-0 w-52 sm:w-64 md:w-80 lg:w-96">
            <img src={HERO_CHAR} alt="Simpson character" className="w-full h-auto drop-shadow-xl" />
          </div>
        </Container>
      </section>

      {/* ══════════════════════ HOW IT WORKS ══════════════════════ */}
      <section className="bg-[#FFC82C] py-16 sm:py-24">
        <Container>
          <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-14">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { n:"1", title:"Send Us Your Photo", img:STEP_A, desc:"Upload any photo of yourself, family, friends, or pets." },
              { n:"2", title:"We Draw You Yellow", img:STEP_B, desc:"Our professional artists create your custom cartoon." },
              { n:"3", title:"Receive Your Picture", img:STEP_A, desc:"Get your digital file and optional premium print delivered." },
            ].map(s=>(
              <div key={s.n} className="flex flex-col items-center bg-white rounded-2xl p-6 pt-20 text-center shadow-md relative">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20">
                  <img src={s.img} alt="" className="w-full h-full object-contain" />
                </div>
                <span className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#FFC82C] flex items-center justify-center text-white font-bold text-sm">{s.n}</span>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-10">
            <a href="#" className="bg-white text-[#9c3605] font-bold text-sm uppercase px-8 py-3.5 rounded-full shadow-md hover:shadow-lg transition-shadow">
              Turn Me Yellow &rarr;
            </a>
          </div>
        </Container>
      </section>

      {/* ══════════════════════ GALLERY ══════════════════════ */}
      <section className="bg-white py-16 sm:py-24">
        <Container>
          <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#FFC82C] mb-3">
            Swipe Dich Gelb
          </h2>
          <p className="text-center text-gray-500 text-lg mb-12 max-w-lg mx-auto">
            Browse through some of our favourite transformations — every portrait is hand-drawn with love!
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {[GAL1,GAL2,GAL3,GAL4].map((src,i)=>(
              <div key={i} className="aspect-[3/4] rounded-2xl overflow-hidden border-4 border-gray-900 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all">
                <img src={src} alt={`Gallery ${i+1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-10">
            <a href="#" className="bg-[#FFC82C] text-white font-bold text-sm uppercase px-8 py-3.5 rounded-full hover:bg-[#e6b526] transition-colors shadow-lg shadow-[#FFC82C]/30">
              Get Yours Now
            </a>
          </div>
        </Container>
      </section>

      {/* ══════════════════════ CUSTOMERS UNPACK ══════════════════════ */}
      <section className="bg-[#3B9AE8] py-16 sm:py-24">
        <Container>
          <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3">
            Our Customers Unpack!
          </h2>
          <p className="text-center text-blue-100 text-lg mb-12 max-w-lg mx-auto">
            Each of our pictures gives a smile. Give away a personalised unique item.
          </p>
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="flex-shrink-0 w-48 sm:w-60 md:w-72">
              <img src={UNBOX_CHAR} alt="Happy customer" className="w-full h-auto" />
            </div>
            <div className="flex-1 w-full">
              <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-video bg-gray-900">
                <img src={UNBOX_VID} alt="Customer unboxing" className="absolute inset-0 w-full h-full object-cover" />
                <img src={UNBOX_FRAME} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#3B9AE8] ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ══════════════════════ WHY WE ══════════════════════ */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <Container>
          <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#FFC82C] mb-3">
            Why We?!
          </h2>
          <p className="text-center text-gray-500 text-lg mb-14 max-w-2xl mx-auto">
            The original &amp; biggest in Europe — 85&nbsp;000+ caricatures, 3&nbsp;000+ five-star ratings on independent portals.
          </p>

          <div className="flex flex-col gap-10 max-w-4xl mx-auto">
            {/* Row 1 */}
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="flex-shrink-0 w-36 sm:w-44">
                <img src={WHY1} alt="" className="w-full h-auto" />
              </div>
              <div className="flex-1 bg-white rounded-2xl p-6 sm:p-8 shadow-md">
                <span className="inline-block bg-[#FFC82C] text-white text-xs font-bold uppercase px-4 py-1 rounded-full mb-3">Satisfaction Guarantee</span>
                <p className="text-gray-600 leading-relaxed">
                  We guarantee you will love your caricature. If not, we offer <strong className="text-gray-900">free unlimited revisions</strong> until you do.
                </p>
              </div>
            </div>

            {/* Row 2 — reversed */}
            <div className="flex flex-col sm:flex-row-reverse items-center gap-8">
              <div className="flex-shrink-0 w-40 sm:w-52">
                <img src={WHY2} alt="" className="w-full h-auto" />
              </div>
              <div className="flex-1 bg-white rounded-2xl p-6 sm:p-8 shadow-md">
                <span className="inline-block bg-[#3B9AE8] text-white text-xs font-bold uppercase px-4 py-1 rounded-full mb-3">Professional Artists</span>
                <p className="text-gray-600 leading-relaxed">
                  Our talented draftsmen, with years of experience, are among the <strong className="text-gray-900">best illustrators</strong> in the artistic world.
                </p>
              </div>
            </div>

            {/* Row 3 */}
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="flex-shrink-0 w-36 sm:w-44">
                <img src={WHY3} alt="" className="w-full h-auto" />
              </div>
              <div className="flex-1 bg-white rounded-2xl p-6 sm:p-8 shadow-md">
                <span className="inline-block bg-[#9c3605] text-white text-xs font-bold uppercase px-4 py-1 rounded-full mb-3">Premium Quality</span>
                <p className="text-gray-600 leading-relaxed">
                  We partner with one of the best printers in Germany for <strong className="text-gray-900">high-quality printing</strong> and fast worldwide shipping.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ══════════════════════ TESTIMONIALS ══════════════════════ */}
      <section className="bg-[#FFC82C] py-16 sm:py-24">
        <Container className="flex flex-col items-center">
          <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#9c3605] mb-14">
            Thank You For Your Trust
          </h2>

          <div className="relative w-full max-w-md">
            {/* Card */}
            <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-10 flex flex-col items-center text-center">
              <p className="text-xl font-bold text-gray-900 mb-3">&ldquo;Fast and nice!&rdquo;</p>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Only a few days passed from the order to the delivery. We were immediately delighted with the result. Even our grandson (3 years old) recognized his grandparents immediately from the photo!
              </p>
              <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-[#FFC82C] mb-3">
                <img src={AVATAR} alt="Jessica Harper" className="w-full h-full object-cover" />
              </div>
              <p className="font-semibold text-gray-900">Jessica Harper</p>
              <p className="text-[#FFC82C] text-lg mt-1 tracking-wide">&#9733;&#9733;&#9733;&#9733;&#9733;</p>
            </div>

            {/* Nav arrows */}
            <button className="absolute top-1/2 -translate-y-1/2 -left-4 sm:-left-6 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform cursor-pointer">
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button className="absolute top-1/2 -translate-y-1/2 -right-4 sm:-right-6 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform cursor-pointer">
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </Container>
      </section>

      {/* ══════════════════════ FAQ ══════════════════════ */}
      <section className="bg-white py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1a5fa8] mb-12">
            FAQ
          </h2>
          <div className="flex flex-col gap-3">
            {faqData.map((item,i)=>(
              <div key={i} className="rounded-xl overflow-hidden shadow-sm border border-gray-200">
                <button
                  onClick={()=>setOpenFaq(openFaq===i?-1:i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-[#1a5fa8] text-white text-left cursor-pointer hover:bg-[#164f8f] transition-colors"
                >
                  <span className="font-semibold text-sm sm:text-base">{item.q}</span>
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold leading-none">
                    {openFaq===i?"−":"+"}
                  </span>
                </button>
                {openFaq===i && (
                  <div className="px-5 py-4 bg-blue-50 text-gray-700 text-sm leading-relaxed border-t border-blue-100">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-14">
            <img src={FAQ_CHARS} alt="Simpsons characters" className="w-full max-w-xl h-auto" />
          </div>
        </div>
      </section>

      {/* ══════════════════════ FOOTER ══════════════════════ */}
      <footer className="bg-[#FFC82C]">
        <Container className="pt-14 pb-10">
          {/* Newsletter */}
          <div className="max-w-sm mx-auto text-center mb-12">
            <h3 className="text-xl font-bold text-[#9c3605] mb-4">Stay Up To Date</h3>
            <div className="flex rounded-full overflow-hidden shadow-md bg-white">
              <input type="email" placeholder="Enter your email" className="flex-1 min-w-0 px-5 py-3 text-sm text-gray-700 outline-none" />
              <button className="flex-shrink-0 bg-[#9c3605] text-white text-sm font-bold px-5 py-3 hover:bg-[#7e2c04] transition-colors cursor-pointer">
                Subscribe
              </button>
            </div>
            <div className="flex justify-center gap-3 mt-5">
              {["F","T","I","P"].map(l=>(
                <a key={l} href="#" className="w-9 h-9 rounded-full bg-[#9c3605]/10 text-[#9c3605] flex items-center justify-center text-xs font-bold hover:bg-[#9c3605] hover:text-white transition-colors">{l}</a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-[#e6b526]">
            <div>
              <img src={LOGO} alt="Yellow Simpsons" className="h-12 w-auto mb-3" />
              <p className="text-xs text-[#9c3605]/70 leading-relaxed">The original Simpson-style caricature service.</p>
            </div>
            {[
              { title:"More Info", links:["Contact","FAQ","Our Team","Prices"] },
              { title:"Legal",     links:["Refund Policy","Privacy Policy","Terms of Service"] },
              { title:"About",     links:["About Us","Reviews","Blog"] },
            ].map(col=>(
              <div key={col.title}>
                <h4 className="font-bold text-[#9c3605] text-sm mb-3">{col.title}</h4>
                <ul className="flex flex-col gap-2 text-sm text-[#9c3605]/70">
                  {col.links.map(l=><li key={l}><a href="#" className="hover:text-[#9c3605] transition-colors">{l}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
        </Container>

        {/* Copyright */}
        <div className="bg-[#b8930e] py-3">
          <p className="text-center text-sm text-white/90">&copy; 2023 <strong>Yellow Simpsons.com</strong></p>
        </div>
      </footer>
    </div>
  );
}
