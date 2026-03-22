"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import FooterCartoon from "@/components/FooterCartoon";

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

const faqData = [
  { q: "Combien de temps faut-il pour réaliser la caricature ?", a: "Nos artistes réalisent généralement votre caricature en 3 à 5 jours ouvrés selon la complexité." },
  { q: "Les personnes doivent-elles être sur la même photo ?", a: "Pas du tout ! Envoyez-nous des photos individuelles et nos artistes dessineront tout le monde ensemble." },
  { q: "Que se passe-t-il si je ne suis pas satisfait(e) ?", a: "Nous offrons des révisions illimitées et gratuites jusqu'à votre entière satisfaction !" },
  { q: "Mon animal peut-il aussi devenir un cartoon ?", a: "Absolument ! Chiens, chats, oiseaux — nous transformons n'importe quel animal en personnage cartoon." },
  { q: "Puis-je faire dessiner des objets ou décors ?", a: "Oui ! Nous pouvons inclure des objets, véhicules, décors ou accessoires pour un petit supplément." },
];

const reviews = [
  { name: "Sophie M.", text: "Absolument magnifique ! Le dessin est fidèle et la qualité est au top.", photo: 0 },
  { name: "Thomas K.", text: "Livraison super rapide et qualité géniale. Ma femme était ravie !", photo: 1 },
  { name: "Marie L.", text: "Le cadeau parfait pour l'anniversaire de mes parents. Ils ont adoré !", photo: 2 },
  { name: "Pierre D.", text: "Travail remarquable ! Le dessin nous ressemble vraiment.", photo: 3 },
  { name: "Julie R.", text: "Service client au top et résultat bluffant. Je recommande !", photo: 7 },
  { name: "Nicolas B.", text: "Très agréablement surpris. Super image et support excellent.", photo: 8 },
];

export default function Home() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-white">

        {/* ═══ HERO ═══ */}
        <section className="relative bg-yellow-400 pt-28 sm:pt-36 pb-16 sm:pb-24 border-b-4 border-black overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-15">
            <div className="absolute top-20 left-[8%] w-48 h-24 bg-white rounded-full" />
            <div className="absolute top-16 left-[12%] w-32 h-18 bg-white rounded-full" />
            <div className="absolute bottom-20 right-[10%] w-56 h-28 bg-white rounded-full" />
            <div className="absolute bottom-16 right-[15%] w-36 h-20 bg-white rounded-full" />
          </div>
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-10 md:gap-16">
            <div className="flex-1 text-center md:text-left">
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
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight uppercase">
                <span className="text-black">Transformez</span><br />
                <span className="text-white" style={{ WebkitTextStroke: "2px black" }}>vos photos</span><br />
                <span className="text-black">en cartoon !</span>
              </h1>
              <p className="mt-5 text-lg font-bold text-black/70 max-w-md mx-auto md:mx-0">
                Recevez une caricature unique dessinée à la main. Le cadeau personnalisé parfait !
              </p>
              <div className="mt-8 flex flex-wrap gap-4 justify-center md:justify-start">
                <a href="/simpson" className="bg-black text-yellow-400 font-black text-sm uppercase px-8 py-4 rounded-full border-2 border-black shadow-[6px_6px_0px_0px_rgba(255,255,255,0.5)] hover:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.5)] hover:translate-x-[3px] hover:translate-y-[3px] active:translate-y-1 active:shadow-none transition-all">
                  Commander mon portrait ✏️
                </a>
                <a href="#comment-ca-marche" className="bg-white text-black font-black text-sm uppercase px-8 py-4 rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all">
                  Comment ça marche ?
                </a>
              </div>
            </div>
            <div className="flex-shrink-0 w-64 sm:w-72 md:w-80 lg:w-96">
              <div className="bg-white p-3 border-4 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rotate-2 hover:rotate-0 transition-transform duration-300">
                <div className="aspect-[3/4] rounded-lg overflow-hidden border-2 border-black">
                  <img src={photos[0]} alt="Exemple caricature" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ COMMENT ÇA MARCHE ═══ */}
        <section id="comment-ca-marche" className="bg-white py-16 sm:py-24 border-b-4 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-black text-black uppercase mb-14">
              Comment ça marche ? 🤔
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                { n: "1", title: "Envoyez votre photo", icon: "📸", desc: "Téléversez une photo de vous, votre famille, vos amis ou vos animaux." },
                { n: "2", title: "Nous vous dessinons", icon: "✏️", desc: "Nos artistes professionnels créent votre caricature cartoon unique." },
                { n: "3", title: "Recevez votre œuvre", icon: "🎁", desc: "Recevez votre fichier numérique et/ou votre impression premium." },
              ].map((s) => (
                <div key={s.n} className="bg-yellow-400 border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-8 text-center hover:-translate-y-2 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 relative">
                  <span className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-black text-yellow-400 flex items-center justify-center font-black text-lg border-2 border-black">{s.n}</span>
                  <span className="text-4xl mb-4 block">{s.icon}</span>
                  <h3 className="text-lg font-black text-black uppercase mb-2">{s.title}</h3>
                  <p className="text-sm font-bold text-black/60 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-10">
              <a href="/simpson" className="bg-yellow-400 text-black font-black text-sm uppercase px-8 py-4 rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all">
                Commencer maintenant &rarr;
              </a>
            </div>
          </div>
        </section>

        {/* ═══ GALERIE ═══ */}
        <section className="bg-blue-400 py-16 sm:py-24 border-b-4 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-black text-white uppercase mb-3">
              Nos réalisations 🖼️
            </h2>
            <p className="text-center text-white/80 font-bold text-lg mb-12 max-w-lg mx-auto">
              Chaque portrait est dessiné à la main avec passion !
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {photos.slice(0, 8).map((src, i) => (
                <div key={i} className="bg-white p-2 pb-6 border-4 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 cursor-pointer" style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (i % 3)}deg)` }}>
                  <div className="aspect-[3/4] rounded overflow-hidden border-2 border-black">
                    <img src={src} alt={`Réalisation ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-10">
              <a href="/portfolio" className="bg-white text-black font-black text-sm uppercase px-8 py-4 rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all">
                Voir tout le portfolio &rarr;
              </a>
            </div>
          </div>
        </section>

        {/* ═══ VIDÉO ═══ */}
        <section className="bg-yellow-400 py-16 sm:py-24 border-b-4 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl sm:text-4xl font-black text-black uppercase mb-3">
              Comment nous vous dessinons 🎬
            </h2>
            <p className="text-center text-black/60 font-bold text-lg mb-10 max-w-lg mx-auto">
              Regardez la magie opérer — de la photo au cartoon !
            </p>
            <div className="max-w-3xl mx-auto">
              <div className="border-4 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <iframe
                  src="https://www.youtube.com/embed/qMFbHtBDKmI"
                  title="Comment nous vous dessinons"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full aspect-video border-none"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ═══ POURQUOI NOUS ═══ */}
        <section className="bg-white py-16 sm:py-24 border-b-4 border-black">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-black text-black uppercase mb-14">
              Pourquoi Cartoonova ? 💪
            </h2>
            <div className="flex flex-col gap-8">
              {[
                { color: "bg-yellow-400", icon: "😊", title: "Satisfaction garantie", desc: "Nous garantissons que vous allez adorer votre caricature. Révisions illimitées et gratuites !", photo: 4 },
                { color: "bg-blue-400", icon: "✏️", title: "Artistes professionnels", desc: "Nos talentueux dessinateurs comptent parmi les meilleurs illustrateurs du monde artistique.", photo: 7 },
                { color: "bg-yellow-400", icon: "⚡", title: "Qualité premium", desc: "Nous collaborons avec les meilleurs imprimeurs pour une impression haute qualité et une livraison rapide.", photo: 10 },
              ].map((item, i) => (
                <div key={item.title} className={`flex flex-col ${i % 2 === 1 ? "sm:flex-row-reverse" : "sm:flex-row"} items-center gap-8`}>
                  <div className="flex-shrink-0 w-40 sm:w-52">
                    <div className="bg-white p-2 border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                      <img src={photos[item.photo]} alt="" className="w-full aspect-square object-cover rounded-lg" />
                    </div>
                  </div>
                  <div className={`flex-1 ${item.color} border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 sm:p-8`}>
                    <span className="text-3xl mb-2 block">{item.icon}</span>
                    <h3 className="font-black text-black uppercase text-xl mb-2">{item.title}</h3>
                    <p className="font-bold text-black/70 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ AVIS CLIENTS ═══ */}
        <section id="avis" className="bg-yellow-400 py-16 sm:py-24 border-b-4 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-black text-black uppercase mb-12">
              Merci pour votre confiance ⭐
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.map((r, i) => (
                <div key={i} className="bg-white border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300">
                  <div className="aspect-[4/3] bg-gray-100 border-b-4 border-black">
                    <img src={photos[r.photo]} alt={r.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <p className="text-yellow-400 text-lg mb-2 font-black">★★★★★</p>
                    <p className="text-sm text-black/70 font-bold leading-relaxed flex-1">&laquo; {r.text} &raquo;</p>
                    <p className="text-sm font-black text-black mt-3 uppercase">— {r.name}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-10">
              <a href="/avis" className="bg-white text-black font-black text-sm uppercase px-8 py-4 rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all">
                Voir tous les avis &rarr;
              </a>
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section id="faq" className="bg-white py-16 sm:py-24 border-b-4 border-black">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-black text-black uppercase mb-12">
              FAQ 🤓
            </h2>
            <div className="flex flex-col gap-4">
              {faqData.map((f, i) => (
                <div key={i} className="border-4 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-blue-400 text-white text-left cursor-pointer hover:bg-blue-500 transition-colors"
                  >
                    <span className="font-black text-sm sm:text-base uppercase">{f.q}</span>
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-lg font-black border-2 border-black">{openFaq === i ? "−" : "+"}</span>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 py-4 bg-yellow-50 text-black/70 text-sm font-bold leading-relaxed border-t-4 border-black">{f.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA FINAL ═══ */}
        <section className="bg-black py-16 sm:py-20 border-b-4 border-yellow-400">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-yellow-400 uppercase mb-4">Prêt(e) à devenir un cartoon ?</h2>
            <p className="text-white/70 font-bold text-lg max-w-md mx-auto mb-8">Rejoignez plus de 85 000 clients satisfaits !</p>
            <a href="/simpson" className="inline-block bg-yellow-400 text-black font-black text-base uppercase px-10 py-5 rounded-full border-2 border-yellow-400 shadow-[6px_6px_0px_0px_rgba(250,204,21,0.4)] hover:shadow-[3px_3px_0px_0px_rgba(250,204,21,0.4)] hover:translate-x-[3px] hover:translate-y-[3px] active:translate-y-1 active:shadow-none transition-all">
              Commander mon portrait ✏️
            </a>
          </div>
        </section>
      </div>
      <FooterCartoon />
    </>
  );
}
