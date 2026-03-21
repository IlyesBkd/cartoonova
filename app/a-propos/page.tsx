"use client";

import Navbar from "@/components/Navbar";
import FooterCartoon from "@/components/FooterCartoon";

export default function AProposPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20">

        {/* Hero — Yellow */}
        <section className="bg-yellow-400 py-16 sm:py-24 border-b-4 border-black relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-10">
            <div className="absolute top-10 left-[5%] w-48 h-24 bg-white rounded-full" />
            <div className="absolute top-6 left-[9%] w-32 h-18 bg-white rounded-full" />
            <div className="absolute bottom-12 right-[8%] w-56 h-28 bg-white rounded-full" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-black uppercase leading-tight">
              Bienvenue chez<br />Cartoonova ! 🎨
            </h1>
            <p className="mt-5 text-lg sm:text-xl font-bold text-black/70 max-w-2xl mx-auto">
              Nous transformons vos plus belles photos en caricatures cartoon uniques, dessinées à la main par de vrais artistes.
            </p>
          </div>
        </section>

        {/* Block — White — Notre histoire */}
        <section className="bg-white py-16 sm:py-20 border-b-4 border-black">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1">
              <span className="inline-block bg-yellow-400 text-black font-black text-xs uppercase px-4 py-1.5 rounded-full border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] mb-4">Notre histoire</span>
              <h2 className="text-3xl sm:text-4xl font-black text-black uppercase mb-4">D&apos;une passion à un empire cartoon</h2>
              <p className="text-black/60 font-bold leading-relaxed mb-4">
                Tout a commencé avec une simple idée : et si on pouvait transformer n&apos;importe qui en personnage de dessin animé ? Aujourd&apos;hui, Cartoonova est le plus grand service de caricatures cartoon en Europe.
              </p>
              <p className="text-black/60 font-bold leading-relaxed">
                Avec plus de <strong className="text-black">85 000 portraits créés</strong> et une communauté de clients passionnés, nous avons prouvé que l&apos;art du cartoon peut toucher le cœur de tout le monde.
              </p>
            </div>
            <div className="flex-shrink-0 w-56 sm:w-72">
              <div className="bg-yellow-400 border-4 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <img src="/simpson_photos_produit/0009_1.jpg" alt="Exemple caricature" className="w-full aspect-square object-cover" />
              </div>
            </div>
          </div>
        </section>

        {/* Block — Blue — Nos valeurs */}
        <section className="bg-blue-400 py-16 sm:py-20 border-b-4 border-black">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-black text-white uppercase">Nos valeurs ✊</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { icon: "✏️", title: "100% fait main", desc: "Chaque portrait est dessiné à la main par un artiste professionnel. Zéro IA, zéro modèle." },
                { icon: "😊", title: "Satisfaction garantie", desc: "Révisions illimitées et gratuites. On ne s'arrête pas tant que vous n'êtes pas ravi(e)." },
                { icon: "⚡", title: "Rapide & fiable", desc: "3 à 5 jours ouvrés. Support 24/7. Livraison sécurisée partout dans le monde." },
              ].map((v) => (
                <div key={v.title} className="bg-white border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 text-center hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300">
                  <span className="text-4xl mb-3 block">{v.icon}</span>
                  <h3 className="font-black text-black uppercase text-lg mb-2">{v.title}</h3>
                  <p className="text-sm font-bold text-black/60 leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Block — Yellow — Chiffres */}
        <section className="bg-yellow-400 py-16 sm:py-20 border-b-4 border-black">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl sm:text-4xl font-black text-black uppercase mb-12">Cartoonova en chiffres 📊</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { val: "85 000+", label: "Portraits créés" },
                { val: "3 000+", label: "Avis 5 étoiles" },
                { val: "15+", label: "Artistes pro" },
                { val: "50+", label: "Pays livrés" },
              ].map((s) => (
                <div key={s.label} className="bg-white border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 text-center">
                  <p className="text-3xl sm:text-4xl font-black text-black">{s.val}</p>
                  <p className="text-xs font-black text-black/50 uppercase mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Block — White — Comment ça marche */}
        <section className="bg-white py-16 sm:py-20 border-b-4 border-black">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-black text-black uppercase mb-5">Prêt(e) à devenir un cartoon ?</h2>
            <p className="text-lg font-bold text-black/60 max-w-md mx-auto mb-8">
              En 3 étapes simples, recevez votre caricature unique dessinée à la main.
            </p>
            <a href="/product" className="inline-block bg-yellow-400 text-black font-black text-base uppercase px-10 py-5 rounded-full border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] active:translate-y-1 active:shadow-none transition-all">
              Créer mon portrait ✏️
            </a>
          </div>
        </section>
      </main>
      <FooterCartoon />
    </>
  );
}
