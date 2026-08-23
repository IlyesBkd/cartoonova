"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { identifier } from "@/lib/analytics";
import Icone from "@/components/tj/Icone";
import { GOOGLE_ADS_PURCHASE_SEND_TO } from "@/lib/googleAds";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
  }
}

interface SuccessOrder {
  id: string;
  payment_intent_id: string;
  customer_email: string;
  total_price: number;
  currency: string;
  options: string | { format: string; people: number; animals: number; printOption: string };
}

export default function SuccessClient({
  order,
  trackingUrl,
}: {
  order: SuccessOrder;
  /** Lien signe vers la page de suivi, calcule cote serveur. */
  trackingUrl?: string;
}) {
  const conversionSent = useRef(false);

  useEffect(() => {
    /* Protection contre le double comptage — deux verrous, et plus trois.
       Le troisieme etait `isNewConversion`, calcule cote serveur : « cette
       commande vient-elle de passer en PAID ? ». Il a disparu avec l'arrivee
       du webhook Stripe, qui gagne desormais cette bascule la plupart du
       temps. La page aurait donc recu `false` a presque chaque commande et
       n'aurait plus jamais declenche la conversion Google Ads — une panne
       silencieuse, sans erreur nulle part, visible seulement des semaines
       plus tard dans la console publicitaire.
       Ce verrou n'avait de toute facon pas sa place ici : la conversion
       publicitaire ne depend pas de qui a gagne une course en base de
       donnees, mais du fait que ce navigateur affiche une commande payee —
       ce que le serveur a deja verifie aupres de Stripe avant de rendre cette
       page.
         1. `conversionSent` empeche le double envoi en mode strict de React ;
         2. `sessionStorage`, indexe par PaymentIntent, empeche le renvoi si
            le client recharge la page.
       Et par-dessus, Google deduplique sur `transaction_id`. */
    if (conversionSent.current) return;

    const storageKey = `gtag_conversion_${order.payment_intent_id}`;
    if (sessionStorage.getItem(storageKey)) return;

    /* L'achat lui-meme n'est plus mesure ici : il part du serveur, au moment
       ou la commande bascule en PAID (voir `mesurerAchat` dans page.tsx). Le
       capturer aussi depuis le navigateur le compterait deux fois — et la
       moitie navigateur est justement celle qui manque quand l'onglet est
       ferme trop tot, ce qui en faisait une source peu fiable.
       Ce qui reste ici est ce que le serveur ne peut pas faire : rattacher la
       session en cours a la personne. C'est indispensable pour le paiement
       express, qui court-circuite le formulaire ou l'identification a lieu
       d'ordinaire — sans cela, tout le parcours de navigation qui a precede
       l'achat resterait detache de la commande. */
    identifier(order.customer_email);

    const gtag = window.gtag ?? ((...args: unknown[]) => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(args);
    });

    gtag("event", "conversion", {
      send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
      value: order.total_price,
      currency: order.currency,
      transaction_id: order.payment_intent_id,
    });
    console.log("[GTAG] ✅ Conversion Google Ads envoyée:", {
      send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
      value: order.total_price,
      currency: order.currency,
      transaction_id: order.payment_intent_id,
    });

    // Meta Pixel purchase event — no-op until NEXT_PUBLIC_META_PIXEL_ID is set (see notesmanuel.md)
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "Purchase", {
        value: order.total_price,
        currency: order.currency,
      });
    }

    sessionStorage.setItem(storageKey, "1");
    conversionSent.current = true;
  }, [order.customer_email, order.total_price, order.currency, order.payment_intent_id]);

  // Décoder options JSONB (le driver Neon le parse automatiquement en objet)
  const opts = typeof order.options === "string" ? JSON.parse(order.options) : order.options;

  return (
    <div className="h-screen bg-gradient-to-br from-yellow-400 to-yellow-300 flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-2xl max-h-full overflow-y-auto">
        {/* Carte principale */}
        <div className="bg-white rounded-[16px] sm:rounded-[24px] p-3 sm:p-6">
          
          {/* Header avec animation */}
          <div className="text-center mb-2 sm:mb-4">
            <div className="inline-block animate-bounce mb-1 sm:mb-2">
              <Icone nom="fete" taille={48} style={{ color: "var(--soleil-fonce)" }} />
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-4xl font-black text-black uppercase mb-1 sm:mb-2 leading-tight">
              BOOM !<br />
              <span className="text-yellow-400 bg-black px-1 sm:px-2">C&apos;est dans la boîte !</span>
            </h1>
            <p className="text-xs sm:text-sm lg:text-lg font-bold text-black/80">
              Votre commande est confirmée et nos artistes sont déjà au travail.
            </p>
          </div>

          {/* Carte récapitulative */}
          <div className="bg-creme rounded-[8px] sm:rounded-[12px] p-2 sm:p-4 mb-2 sm:mb-4">
            <h2 className="text-sm sm:text-lg lg:text-xl font-black text-black uppercase mb-1 sm:mb-2 flex items-center gap-1 sm:gap-2">
              <Icone nom="presse-papiers" taille={18} /> Récapitulatif
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-1 sm:gap-2">
              <div className="bg-white rounded p-1 sm:p-2 sm:rounded-lg">
                <p className="text-[10px] sm:text-xs font-black text-black/60 uppercase mb-1">Numéro</p>
                <p className="text-xs sm:text-sm font-black text-black">#{String(order.id).slice(0, 8)}</p>
              </div>
              
              <div className="bg-white rounded p-1 sm:p-2 sm:rounded-lg">
                <p className="text-[10px] sm:text-xs font-black text-black/60 uppercase mb-1">Email</p>
                <p className="text-[10px] sm:text-xs font-bold text-black break-all">{order.customer_email}</p>
              </div>
              
              <div className="bg-white rounded p-1 sm:p-2 sm:rounded-lg">
                <p className="text-[10px] sm:text-xs font-black text-black/60 uppercase mb-1">Format</p>
                <p className="text-xs sm:text-sm font-black text-black">
                  {opts?.format === "portrait" ? "Portrait" : "Full Body"}
                </p>
              </div>
              
              <div className="bg-white rounded p-1 sm:p-2 sm:rounded-lg">
                <p className="text-[10px] sm:text-xs font-black text-black/60 uppercase mb-1">Personnes</p>
                <p className="text-xs sm:text-sm font-black text-black">
                  {opts?.people} {opts?.animals > 0 && `+ ${opts.animals} animaux`}
                </p>
              </div>
              
              <div className="bg-white rounded p-1 sm:p-2 sm:rounded-lg col-span-2 sm:col-span-2">
                <p className="text-[10px] sm:text-xs font-black text-black/60 uppercase mb-1">Option</p>
                <p className="text-xs sm:text-sm font-black text-black">{opts?.printOption}</p>
              </div>
              
              <div className="bg-soleil rounded p-1 sm:p-2 sm:rounded-lg col-span-2 sm:col-span-2">
                <p className="text-[10px] sm:text-xs font-black text-black/60 uppercase mb-1">Total</p>
                <p className="text-sm sm:text-lg lg:text-xl font-black text-black">
                  {order.total_price} {order.currency}
                </p>
              </div>
            </div>
          </div>

          {/* Message rassurant */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-[8px] sm:rounded-[12px] p-2 sm:p-4 mb-2 sm:mb-4">
            <div className="flex items-start gap-1 sm:gap-2">
              <div className="flex-shrink-0">
                <Icone nom="palette" taille={20} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm lg:text-base font-black text-black uppercase mb-1">
                  Nos artistes se mettent au travail !
                </h3>
                <p className="text-[10px] sm:text-xs font-bold text-black/80 leading-tight">
                  Le dessin est réalisé en 2 jours. Si vous avez commandé une impression (poster, toile),
                  comptez 3 jours ouvrés supplémentaires pour la fabrication et l&apos;envoi.
                </p>
              </div>
            </div>
          </div>

          {/* Boutons d'action. Le suivi vient en premier : c'est la seule
              chose que le client voudra retrouver dans les jours qui suivent,
              et la page est faite pour être mise en favori. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 justify-center">
            {trackingUrl && (
              <a href={trackingUrl} className="bouton bouton--primaire">
                <Icone nom="presse-papiers" taille={17} /> Suivre ma commande
              </a>
            )}

            <Link
              href="/collections"
              className="bouton bouton--fantome"
            >
              <Icone nom="image" taille={17} /> Portfolio
            </Link>

            <Link
              href="/"
              className="bouton bouton--fantome"
            >
              <Icone nom="maison" taille={17} /> Accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
