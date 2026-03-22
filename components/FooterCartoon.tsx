"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function FooterCartoon() {
  const t = useTranslations("footer");
  const tn = useTranslations("nav");

  return (
    <footer className="bg-yellow-400 border-t-4 border-black">
      {/* Newsletter */}
      <div className="border-b-4 border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="text-center lg:text-left">
            <h3 className="text-2xl font-black text-black uppercase">{t("newsletter")}</h3>
            <p className="text-sm text-black/70 font-bold mt-1">{t("newsletterSub")}</p>
          </div>
          <div className="flex w-full max-w-md">
            <input type="email" placeholder={t("emailPlaceholder")} className="flex-1 min-w-0 px-5 py-3 text-sm font-bold text-black bg-white border-2 border-black rounded-l-full outline-none placeholder:text-black/40" />
            <button className="bg-black text-yellow-400 font-black text-sm uppercase px-6 py-3 rounded-r-full border-2 border-black hover:bg-gray-900 active:translate-y-[1px] transition-all cursor-pointer">
              {t("subscribe")}
            </button>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2">
            <Image src="/logo.webp" alt="Logo Cartoonova" width={160} height={48} className="h-12 mb-4" style={{ width: "auto" }} />
            <p className="text-sm text-black/70 font-bold leading-relaxed mb-5 max-w-xs">
              {t("madeWith")}
            </p>
            <div className="flex items-center gap-3">
              {["Facebook", "Instagram", "TikTok"].map((s) => (
                <a key={s} href="#" aria-label={s} className="w-10 h-10 rounded-full bg-black text-yellow-400 flex items-center justify-center font-black text-xs border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all">
                  {s[0]}
                </a>
              ))}
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-black text-sm text-black mb-4 uppercase tracking-wider border-b-2 border-black pb-2">{t("shop")}</h4>
            <ul className="flex flex-col gap-2 text-sm font-bold text-black/70">
              <li><Link href="/simpson" className="hover:text-black transition-colors">{t("createPortrait")}</Link></li>
              <li><Link href="/portfolio" className="hover:text-black transition-colors">{tn("portfolio")}</Link></li>
              <li><Link href="/avis" className="hover:text-black transition-colors">{t("clientReviews")}</Link></li>
              <li><Link href="/contact" className="hover:text-black transition-colors">{tn("contact")}</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-black text-sm text-black mb-4 uppercase tracking-wider border-b-2 border-black pb-2">{t("legal")}</h4>
            <ul className="flex flex-col gap-2 text-sm font-bold text-black/70">
              <li><Link href="/cgv" className="hover:text-black transition-colors">{t("terms")}</Link></li>
              <li><Link href="/politique-de-confidentialite" className="hover:text-black transition-colors">{t("privacy")}</Link></li>
              <li><Link href="/mentions-legales" className="hover:text-black transition-colors">{t("legalNotice")}</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-black text-sm text-black mb-4 uppercase tracking-wider border-b-2 border-black pb-2">{tn("contact")}</h4>
            <ul className="flex flex-col gap-2 text-sm font-bold text-black/70">
              <li>
                <a href="mailto:support@cartoonova.com" className="hover:text-black transition-colors">
                  📧 support@cartoonova.com
                </a>
              </li>
              <li>📍 Paris, France</li>
            </ul>
            <div className="mt-4 flex items-center gap-1.5">
              {["Visa", "MC", "PayPal"].map((p) => (
                <span key={p} className="text-[10px] font-black text-black bg-white rounded px-2 py-1 border border-black">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-black py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-sm text-yellow-400 font-bold">&copy; 2024 Cartoonova — {t("rights")}</p>
          <div className="flex items-center gap-4 text-xs text-yellow-400/70 font-bold">
            <Link href="/cgv" className="hover:text-yellow-400 transition-colors">{t("terms")}</Link>
            <span className="text-yellow-400/30">|</span>
            <Link href="/politique-de-confidentialite" className="hover:text-yellow-400 transition-colors">{t("privacy")}</Link>
            <span className="text-yellow-400/30">|</span>
            <Link href="/mentions-legales" className="hover:text-yellow-400 transition-colors">{t("legalNotice")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
