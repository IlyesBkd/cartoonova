"use client";

import Navbar from "@/components/Navbar";
import FooterCartoon from "@/components/FooterCartoon";

const reviews = [
  { name: "Sophie M.", text: "Absolument magnifique ! Le dessin est fidèle et la qualité d'impression est au top. Un cadeau parfait !", photo: "/simpson_photos_produit/0009_1.jpg" },
  { name: "Thomas K.", text: "Livraison super rapide et la qualité est tout simplement géniale. Ma femme était ravie !", photo: "/simpson_photos_produit/0015_1.jpg" },
  { name: "Marie L.", text: "Le cadeau parfait pour l'anniversaire de mes parents. La ressemblance est incroyable, ils ont adoré !", photo: "/simpson_photos_produit/0017_1.jpg" },
  { name: "Pierre D.", text: "Travail remarquable ! Le dessin nous ressemble vraiment. Absolument recommandé.", photo: "/simpson_photos_produit/0021_1.jpg" },
  { name: "Julie R.", text: "Service client au top et résultat bluffant. Ce ne sera pas la dernière fois que je commande ici !", photo: "/simpson_photos_produit/0048.jpg" },
  { name: "Nicolas B.", text: "Très agréablement surpris. Super image et un support excellent. On recommande sans hésiter.", photo: "/simpson_photos_produit/0049.jpg" },
  { name: "Laura G.", text: "J'ai offert un portrait à mon copain pour Noël. Il était tellement ému ! Merci Cartoonova !", photo: "/simpson_photos_produit/0029_1.jpg" },
  { name: "Maxime P.", text: "La qualité du Canvas est folle. On dirait un vrai tableau d'artiste accroché dans notre salon.", photo: "/simpson_photos_produit/0032-revise3.jpg" },
  { name: "Camille F.", text: "Mes enfants ont adoré se voir en cartoon ! Un souvenir de famille unique qu'on gardera pour toujours.", photo: "/simpson_photos_produit/IB2-18-1.jpg" },
];

export default function AvisPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-yellow-400 pt-24 sm:pt-28 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-black uppercase mb-3">
              Ils ont été dessinés<br />(et ils adorent !) ⭐
            </h1>
            <p className="text-lg font-bold text-black/60 max-w-md mx-auto">
              Découvrez ce que nos clients pensent de leur caricature Cartoonova.
            </p>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {[
              { val: "85 000+", label: "Portraits créés" },
              { val: "4.8/5", label: "Note moyenne" },
              { val: "3 000+", label: "Avis 5 étoiles" },
            ].map((s) => (
              <div key={s.label} className="bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-6 py-3 text-center">
                <p className="text-2xl font-black text-black">{s.val}</p>
                <p className="text-xs font-bold text-black/60 uppercase">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Reviews grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((r, i) => (
              <div key={i} className="bg-white border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300">
                <div className="aspect-[4/3] bg-gray-100 border-b-4 border-black">
                  <img src={r.photo} alt={r.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <p className="text-yellow-400 text-lg mb-2 tracking-wide font-black">★★★★★</p>
                  <p className="text-sm text-black/70 font-bold leading-relaxed flex-1">&laquo; {r.text} &raquo;</p>
                  <p className="text-sm font-black text-black mt-3 uppercase">— {r.name}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-14">
            <a href="/product" className="inline-block bg-black text-yellow-400 font-black text-base uppercase px-10 py-4 rounded-full border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[3px] hover:translate-y-[3px] active:translate-y-1 active:shadow-none transition-all">
              Créer ma caricature &rarr;
            </a>
          </div>
        </div>
      </main>
      <FooterCartoon />
    </>
  );
}
