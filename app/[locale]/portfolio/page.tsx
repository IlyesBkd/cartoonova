"use client";

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

export default function PortfolioPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-blue-100 pt-24 sm:pt-28 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-black uppercase mb-3">
              Notre Portfolio 🖼️
            </h1>
            <p className="text-lg font-bold text-black/60 max-w-lg mx-auto">
              Chaque portrait est une œuvre unique, dessinée à la main par nos artistes. Inspirez-vous !
            </p>
          </div>

          {/* Gallery grid — polaroid style */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {photos.map((src, i) => (
              <div
                key={i}
                className="bg-white p-3 pb-8 border-4 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 cursor-pointer"
                style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (1 + (i % 3))}deg)` }}
              >
                <div className="aspect-[3/4] rounded overflow-hidden border-2 border-black">
                  <img src={src} alt={`Portrait ${i + 1}`} className="w-full h-full object-cover" />
                </div>
                <p className="text-center mt-3 text-xs font-black text-black/50 uppercase">Portrait #{i + 1}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-14">
            <p className="text-lg font-black text-black/70 mb-4">Envie du même résultat ? 👀</p>
            <a href="/simpson" className="inline-block bg-yellow-400 text-black font-black text-base uppercase px-10 py-4 rounded-full border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] active:translate-y-1 active:shadow-none transition-all">
              Créer mon portrait ✏️
            </a>
          </div>
        </div>
      </main>
      <FooterCartoon />
    </>
  );
}
