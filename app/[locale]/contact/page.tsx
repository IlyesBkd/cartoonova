"use client";

import { useState } from "react";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <main className="min-h-screen bg-blue-100 pt-24 sm:pt-28 pb-16">
        {/* Clouds pattern */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
          <div className="absolute top-32 left-[10%] w-40 h-20 bg-white rounded-full" />
          <div className="absolute top-28 left-[14%] w-28 h-16 bg-white rounded-full" />
          <div className="absolute top-60 right-[15%] w-48 h-24 bg-white rounded-full" />
          <div className="absolute top-56 right-[20%] w-32 h-18 bg-white rounded-full" />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6">
          {/* Title */}
          <div className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-black text-black uppercase mb-3">
              Contactez-nous ! <span className="inline-block animate-bounce">💬</span>
            </h1>
            <p className="text-lg font-bold text-black/60">
              Une question ? Une idée folle ? Écrivez-nous, on adore discuter !
            </p>
          </div>

          {/* Form card — speech bubble style */}
          <div className="relative bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 sm:p-10">
            {/* Bubble tail */}
            <div className="absolute -bottom-6 left-10 w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[24px] border-t-black" />
            <div className="absolute -bottom-[18px] left-[42px] w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[20px] border-t-white" />

            {sent ? (
              <div className="text-center py-10">
                <span className="text-6xl mb-4 block">🎉</span>
                <h2 className="text-2xl font-black text-black uppercase mb-2">Message envoyé !</h2>
                <p className="text-black/60 font-bold">Nous vous répondrons dans les plus brefs délais.</p>
                <button onClick={() => setSent(false)} className="mt-6 bg-yellow-400 text-black font-black text-sm uppercase px-8 py-3 rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer">
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-black uppercase text-black mb-1.5">Votre nom</label>
                  <input type="text" required placeholder="Homer Simpson" className="w-full px-4 py-3 text-sm font-bold bg-yellow-50 border-2 border-black rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-black/30" />
                </div>
                <div>
                  <label className="block text-sm font-black uppercase text-black mb-1.5">Votre email</label>
                  <input type="email" required placeholder="homer@springfield.com" className="w-full px-4 py-3 text-sm font-bold bg-yellow-50 border-2 border-black rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-black/30" />
                </div>
                <div>
                  <label className="block text-sm font-black uppercase text-black mb-1.5">Sujet</label>
                  <input type="text" required placeholder="J'ai une question sur..." className="w-full px-4 py-3 text-sm font-bold bg-yellow-50 border-2 border-black rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-black/30" />
                </div>
                <div>
                  <label className="block text-sm font-black uppercase text-black mb-1.5">Message</label>
                  <textarea required rows={5} placeholder="Dites-nous tout !" className="w-full px-4 py-3 text-sm font-bold bg-yellow-50 border-2 border-black rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 resize-none placeholder:text-black/30" />
                </div>
                <button type="submit" className="self-center bg-yellow-400 text-black font-black text-base uppercase px-10 py-4 rounded-full border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] active:translate-y-1 active:shadow-none transition-all cursor-pointer">
                  Envoyer le message 🚀
                </button>
              </form>
            )}
          </div>

          {/* Email direct */}
          <div className="mt-14 text-center">
            <p className="text-black/60 font-bold mb-2">Ou écrivez-nous directement :</p>
            <a href="mailto:support@cartoonova.com" className="inline-block bg-white text-black font-black text-sm px-6 py-3 rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all">
              📧 support@cartoonova.com
            </a>
          </div>
        </div>
      </main>
  );
}
