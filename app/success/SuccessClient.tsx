"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function SuccessClient({ order }: { order: any }) {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    // Arrêter les confettis après 5 secondes
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-yellow-300 relative overflow-hidden">
      {/* Confettis CSS */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: ["#000", "#ef4444", "#3b82f6", "#10b981", "#f59e0b"][Math.floor(Math.random() * 5)],
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-12 sm:py-20">
        <div className="max-w-4xl mx-auto">
          
          {/* Carte principale */}
          <div className="bg-white border-[4px] border-black rounded-[24px] shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-8 sm:p-12 mb-8">
            
            {/* Header avec animation */}
            <div className="text-center mb-8">
              <div className="inline-block animate-bounce mb-4">
                <span className="text-6xl sm:text-8xl">🎉</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-black uppercase mb-4 leading-tight">
                BOOM !<br />
                <span className="text-yellow-400 bg-black px-2">C'est dans la boîte !</span>
              </h1>
              <p className="text-lg sm:text-xl font-bold text-black/80">
                Votre commande est confirmée et nos artistes sont déjà au travail ! 🎨
              </p>
            </div>

            {/* Carte récapitulative */}
            <div className="bg-yellow-50 border-[3px] border-black rounded-[16px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-8">
              <h2 className="text-xl sm:text-2xl font-black text-black uppercase mb-4 flex items-center gap-2">
                <span>📋</span> Récapitulatif de votre commande
              </h2>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white border-2 border-black rounded-lg p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <p className="text-xs font-black text-black/60 uppercase mb-1">Numéro de commande</p>
                  <p className="text-lg font-black text-black">#{order.id}</p>
                </div>
                
                <div className="bg-white border-2 border-black rounded-lg p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <p className="text-xs font-black text-black/60 uppercase mb-1">Email de contact</p>
                  <p className="text-sm font-bold text-black">{order.customer_email}</p>
                </div>
                
                <div className="bg-white border-2 border-black rounded-lg p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <p className="text-xs font-black text-black/60 uppercase mb-1">Format</p>
                  <p className="text-lg font-black text-black">
                    {order.format === 'portrait' ? 'Portrait' : 'Full Body'}
                  </p>
                </div>
                
                <div className="bg-white border-2 border-black rounded-lg p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <p className="text-xs font-black text-black/60 uppercase mb-1">Personnes</p>
                  <p className="text-lg font-black text-black">
                    {order.people} {order.animals > 0 && `+ ${order.animals} animaux`}
                  </p>
                </div>
                
                <div className="bg-white border-2 border-black rounded-lg p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:col-span-2">
                  <p className="text-xs font-black text-black/60 uppercase mb-1">Option d'impression</p>
                  <p className="text-lg font-black text-black">{order.print_option}</p>
                </div>
                
                <div className="bg-yellow-400 border-2 border-black rounded-lg p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:col-span-2">
                  <p className="text-xs font-black text-black/60 uppercase mb-1">Total payé</p>
                  <p className="text-2xl font-black text-black">
                    {order.total_price} {order.currency}
                  </p>
                </div>
              </div>
            </div>

            {/* Message rassurant */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-[3px] border-black rounded-[16px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <span className="text-3xl">🎨</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-black uppercase mb-2">
                    Nos artistes se mettent au travail !
                  </h3>
                  <p className="text-sm font-bold text-black/80 leading-relaxed">
                    Vous recevrez un premier aperçu de votre caricature par email dans 3-5 jours ouvrables. 
                    Notre équipe vous contactera pour valider chaque détail avant la livraison finale.
                  </p>
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/"
                className="bg-black text-white font-black text-lg uppercase px-8 py-4 rounded-full border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[4px] hover:translate-y-[4px] active:translate-y-1 active:shadow-none transition-all text-center"
              >
                🏠 Retour à l'accueil
              </Link>
              
              <Link
                href="/portfolio"
                className="bg-yellow-400 text-black font-black text-lg uppercase px-8 py-4 rounded-full border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[4px] hover:translate-y-[4px] active:translate-y-1 active:shadow-none transition-all text-center"
              >
                🖼️ Voir nos créations
              </Link>
            </div>
          </div>

          {/* Carte bonus */}
          <div className="bg-white border-[4px] border-black rounded-[24px] shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-8">
            <div className="text-center">
              <span className="text-4xl mb-4 block">🎁</span>
              <h3 className="text-xl font-black text-black uppercase mb-2">
                Petit bonus pour vous !
              </h3>
              <p className="text-sm font-bold text-black/80 mb-4">
                Partagez votre expérience sur les réseaux sociaux avec 
                <span className="text-yellow-400 bg-black px-2 mx-1">#Cartoonova</span>
                et recevez -10% sur votre prochaine commande !
              </p>
              <div className="flex justify-center gap-4">
                <button className="bg-black text-white font-bold text-sm px-4 py-2 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all">
                  📱 Instagram
                </button>
                <button className="bg-black text-white font-bold text-sm px-4 py-2 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all">
                  📘 Facebook
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
