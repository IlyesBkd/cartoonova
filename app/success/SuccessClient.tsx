"use client";

import Link from "next/link";

export default function SuccessClient({ order }: { order: any }) {
  // Décoder options JSONB (le driver Neon le parse automatiquement en objet)
  const opts = typeof order.options === "string" ? JSON.parse(order.options) : order.options;

  return (
    <div className="h-screen bg-gradient-to-br from-yellow-400 to-yellow-300 flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-2xl max-h-full overflow-y-auto">
        {/* Carte principale */}
        <div className="bg-white border-[4px] border-black rounded-[16px] sm:rounded-[24px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-3 sm:p-6">
          
          {/* Header avec animation */}
          <div className="text-center mb-2 sm:mb-4">
            <div className="inline-block animate-bounce mb-1 sm:mb-2">
              <span className="text-3xl sm:text-4xl lg:text-6xl">🎉</span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-4xl font-black text-black uppercase mb-1 sm:mb-2 leading-tight">
              BOOM !<br />
              <span className="text-yellow-400 bg-black px-1 sm:px-2">C&apos;est dans la boîte !</span>
            </h1>
            <p className="text-xs sm:text-sm lg:text-lg font-bold text-black/80">
              Votre commande est confirmée et nos artistes sont déjà au travail ! 🎨
            </p>
          </div>

          {/* Carte récapitulative */}
          <div className="bg-yellow-50 border-[2px] sm:border-[3px] border-black rounded-[8px] sm:rounded-[12px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-2 sm:p-4 mb-2 sm:mb-4">
            <h2 className="text-sm sm:text-lg lg:text-xl font-black text-black uppercase mb-1 sm:mb-2 flex items-center gap-1 sm:gap-2">
              <span>📋</span> Récapitulatif
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-1 sm:gap-2">
              <div className="bg-white border-2 border-black rounded p-1 sm:p-2 sm:rounded-lg shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] sm:text-xs font-black text-black/60 uppercase mb-1">Numéro</p>
                <p className="text-xs sm:text-sm font-black text-black">#{String(order.id).slice(0, 8)}</p>
              </div>
              
              <div className="bg-white border-2 border-black rounded p-1 sm:p-2 sm:rounded-lg shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] sm:text-xs font-black text-black/60 uppercase mb-1">Email</p>
                <p className="text-[10px] sm:text-xs font-bold text-black break-all">{order.customer_email}</p>
              </div>
              
              <div className="bg-white border-2 border-black rounded p-1 sm:p-2 sm:rounded-lg shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] sm:text-xs font-black text-black/60 uppercase mb-1">Format</p>
                <p className="text-xs sm:text-sm font-black text-black">
                  {opts?.format === "portrait" ? "Portrait" : "Full Body"}
                </p>
              </div>
              
              <div className="bg-white border-2 border-black rounded p-1 sm:p-2 sm:rounded-lg shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] sm:text-xs font-black text-black/60 uppercase mb-1">Personnes</p>
                <p className="text-xs sm:text-sm font-black text-black">
                  {opts?.people} {opts?.animals > 0 && `+ ${opts.animals} animaux`}
                </p>
              </div>
              
              <div className="bg-white border-2 border-black rounded p-1 sm:p-2 sm:rounded-lg shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] col-span-2 sm:col-span-2">
                <p className="text-[10px] sm:text-xs font-black text-black/60 uppercase mb-1">Option</p>
                <p className="text-xs sm:text-sm font-black text-black">{opts?.printOption}</p>
              </div>
              
              <div className="bg-yellow-400 border-2 border-black rounded p-1 sm:p-2 sm:rounded-lg shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] sm:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] col-span-2 sm:col-span-2">
                <p className="text-[10px] sm:text-xs font-black text-black/60 uppercase mb-1">Total</p>
                <p className="text-sm sm:text-lg lg:text-xl font-black text-black">
                  {order.total_price} {order.currency}
                </p>
              </div>
            </div>
          </div>

          {/* Message rassurant */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-[2px] sm:border-[3px] border-black rounded-[8px] sm:rounded-[12px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-2 sm:p-4 mb-2 sm:mb-4">
            <div className="flex items-start gap-1 sm:gap-2">
              <div className="flex-shrink-0">
                <span className="text-lg sm:text-2xl">🎨</span>
              </div>
              <div>
                <h3 className="text-xs sm:text-sm lg:text-base font-black text-black uppercase mb-1">
                  Nos artistes se mettent au travail !
                </h3>
                <p className="text-[10px] sm:text-xs font-bold text-black/80 leading-tight">
                  Vous recevrez un premier aperçu par email dans 3-5 jours ouvrables. 
                  Notre équipe vous contactera pour valider chaque détail.
                </p>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 justify-center">
            <Link
              href="/"
              className="bg-black text-white font-black text-xs sm:text-sm lg:text-lg uppercase px-4 sm:px-6 py-2 sm:py-3 rounded-full border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] sm:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] sm:hover:translate-x-[2px] hover:translate-y-[1px] sm:hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all text-center"
            >
              🏠 Accueil
            </Link>
            
            <Link
              href="/portfolio"
              className="bg-yellow-400 text-black font-black text-xs sm:text-sm lg:text-lg uppercase px-4 sm:px-6 py-2 sm:py-3 rounded-full border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] sm:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] sm:hover:translate-x-[2px] hover:translate-y-[1px] sm:hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all text-center"
            >
              🖼️ Portfolio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
