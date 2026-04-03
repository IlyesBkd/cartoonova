"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { PRODUCT_COLOR_SCHEMES, type ProductColorScheme } from "@/components/ProductColorProvider";

const DEFAULT_COLORS: ProductColorScheme = {
  gradient: "from-amber-400 to-yellow-400",
  hoverBg: "hover:bg-amber-100",
  accentHex: "#fbbf24",
};

const PRODUCT_SLUGS = Object.keys(PRODUCT_COLOR_SCHEMES);

export default function FooterCartoon() {
  const t = useTranslations("footer");
  const tn = useTranslations("nav");
  const pathname = usePathname();

  const segments = pathname.split("/").filter(Boolean);
  const productSlug = segments.find((s) => PRODUCT_SLUGS.includes(s));
  const colors = productSlug ? PRODUCT_COLOR_SCHEMES[productSlug] : DEFAULT_COLORS;

  return (
    <footer className={`bg-gradient-to-r ${colors.gradient} border-t-4 border-black`}>
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
                <a key={s} href="#" aria-label={s} className="w-10 h-10 rounded-full bg-black flex items-center justify-center font-black text-xs border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all" style={{ color: colors.accentHex }}>
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
            <div className="mt-4">
              <Image 
                src="/visa_mastercard_paypal-3.png" 
                alt="Moyens de paiement : Visa, MasterCard, PayPal" 
                width={200} 
                height={60} 
                className="h-auto max-w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-black py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-sm font-bold" style={{ color: colors.accentHex }}>&copy; 2026 Cartoonova — {t("rights")}</p>
          <div className="flex items-center gap-4 text-xs font-bold" style={{ color: `${colors.accentHex}99` }}>
            <Link href="/cgv" className="hover:opacity-100 opacity-70 transition-opacity">{t("terms")}</Link>
            <span style={{ color: `${colors.accentHex}50` }}>|</span>
            <Link href="/politique-de-confidentialite" className="hover:opacity-100 opacity-70 transition-opacity">{t("privacy")}</Link>
            <span style={{ color: `${colors.accentHex}50` }}>|</span>
            <Link href="/mentions-legales" className="hover:opacity-100 opacity-70 transition-opacity">{t("legalNotice")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
