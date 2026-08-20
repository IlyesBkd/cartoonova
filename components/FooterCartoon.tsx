"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import NewsletterForm from "@/components/NewsletterForm";
import Icone from "@/components/tj/Icone";
import { useLien } from "@/components/useLien";
import { CATEGORIES_AFFICHAGE, NOMS_CATEGORIE } from "@/lib/catalogue";

/* Pied de page : reconstruit au pixel pres d'apres la section reelle du site
   de reference (fond indigo #2A2552, colonnes egales, newsletter en pilule
   blanche centree). Le mot-marque du paquet d'origine est remplace par le
   logo Cartoonova ; les liens pointent vers les pages reellement presentes
   sur ce site plutot que de copier des URLs mortes. */

const RESEAUX = [
  { libelle: "Facebook", url: process.env.NEXT_PUBLIC_FACEBOOK_URL, icone: "facebook" as const },
  { libelle: "Instagram", url: process.env.NEXT_PUBLIC_INSTAGRAM_URL, icone: "instagram" as const },
  { libelle: "Pinterest", url: process.env.NEXT_PUBLIC_PINTEREST_URL, icone: "pinterest" as const },
  { libelle: "TikTok", url: process.env.NEXT_PUBLIC_TIKTOK_URL, icone: "tiktok" as const },
].filter((r): r is { libelle: string; url: string; icone: typeof r.icone } => Boolean(r.url));

const ICONES_RESEAUX: Record<string, React.ReactNode> = {
  facebook: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M10.183 21.85v-8.868H7.2V9.526h2.983V6.982a4.17 4.17 0 0 1 4.44-4.572 22.33 22.33 0 0 1 2.667.144v3.084h-1.83a1.44 1.44 0 0 0-1.713 1.68v2.208h3.423l-.447 3.456h-2.97v8.868h-3.57Z" fill="currentColor" />
    </svg>
  ),
  instagram: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2.4c-2.607 0-2.934.011-3.958.058-1.022.046-1.72.209-2.33.446a4.705 4.705 0 0 0-1.7 1.107 4.706 4.706 0 0 0-1.108 1.7c-.237.611-.4 1.31-.446 2.331C2.41 9.066 2.4 9.392 2.4 12c0 2.607.011 2.934.058 3.958.046 1.022.209 1.72.446 2.33a4.706 4.706 0 0 0 1.107 1.7c.534.535 1.07.863 1.7 1.108.611.237 1.309.4 2.33.446 1.025.047 1.352.058 3.959.058s2.934-.011 3.958-.058c1.022-.046 1.72-.209 2.33-.446a4.706 4.706 0 0 0 1.7-1.107 4.706 4.706 0 0 0 1.108-1.7c.237-.611.4-1.31.446-2.33.047-1.025.058-1.352.058-3.959s-.011-2.934-.058-3.958c-.047-1.022-.209-1.72-.446-2.33a4.706 4.706 0 0 0-1.107-1.7 4.705 4.705 0 0 0-1.7-1.108c-.611-.237-1.31-.4-2.331-.446C14.934 2.41 14.608 2.4 12 2.4Zm0 1.73c2.563 0 2.867.01 3.88.056.935.042 1.443.199 1.782.33.448.174.768.382 1.104.718.336.336.544.656.718 1.104.131.338.287.847.33 1.783.046 1.012.056 1.316.056 3.879 0 2.563-.01 2.867-.056 3.88-.043.935-.199 1.444-.33 1.782a2.974 2.974 0 0 1-.719 1.104 2.974 2.974 0 0 1-1.103.718c-.339.131-.847.288-1.783.33-1.012.046-1.316.056-3.88.056-2.563 0-2.866-.01-3.878-.056-.936-.042-1.445-.199-1.783-.33a2.974 2.974 0 0 1-1.104-.718 2.974 2.974 0 0 1-.718-1.104c-.131-.338-.288-.847-.33-1.783-.047-1.012-.056-1.316-.056-3.879 0-2.563.01-2.867.056-3.88.042-.935.199-1.443.33-1.782.174-.448.382-.768.718-1.104a2.974 2.974 0 0 1 1.104-.718c.338-.131.847-.288 1.783-.33C9.133 4.14 9.437 4.13 12 4.13Zm0 11.07a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Zm0-8.13a4.93 4.93 0 1 0 0 9.86 4.93 4.93 0 0 0 0-9.86Zm6.276-.194a1.152 1.152 0 1 1-2.304 0 1.152 1.152 0 0 1 2.304 0Z" fill="currentColor" />
    </svg>
  ),
  pinterest: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M11.765 2.401c3.59-.054 5.837 1.4 6.895 3.95.349.842.722 2.39.442 3.675-.112.512-.144 1.048-.295 1.53-.308.983-.708 1.853-1.238 2.603-.72 1.02-1.81 1.706-3.182 2.052-1.212.305-2.328-.152-2.976-.643-.206-.156-.483-.36-.56-.643h-.029c-.046.515-.244 1.062-.383 1.531-.193.65-.23 1.321-.472 1.929a12.345 12.345 0 0 1-.942 1.868c-.184.302-.692 1.335-1.061 1.347-.04-.078-.057-.108-.06-.245-.118-.19-.035-.508-.087-.766-.082-.4-.145-1.123-.06-1.53v-.643c.096-.442.092-.894.207-1.317.25-.92.39-1.895.648-2.848.249-.915.477-1.916.678-2.847.045-.21-.21-.815-.265-1.041-.174-.713-.042-1.7.176-2.236.275-.674 1.08-1.703 2.122-1.439.838.212 1.371 1.118 1.09 2.266-.295 1.205-.677 2.284-.943 3.49-.068.311.05.641.118.827.248.672 1 1.324 2.004 1.072 1.52-.383 2.193-1.76 2.652-3.246.124-.402.109-.781.206-1.225.204-.935.118-2.331-.177-3.061-.472-1.17-1.353-1.92-2.563-2.328L12.707 4.3c-.56-.128-1.626.064-2.004.183-1.69.535-2.737 1.427-3.388 3.032-.222.546-.344 1.1-.383 1.868l-.03.276c.13.686.144 1.14.413 1.653.132.252.447.451.5.765.032.185-.104.464-.147.613-.065.224-.041.48-.147.673-.192.349-.714.087-.943-.061-1.192-.77-2.175-2.995-1.62-5.144.085-.332.09-.62.206-.919.723-1.844 1.802-2.978 3.359-3.95.583-.364 1.37-.544 2.092-.734l1.149-.154Z" fill="currentColor" />
    </svg>
  ),
  tiktok: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.027 10.168a5.125 5.125 0 0 1-4.76-2.294v7.893a5.833 5.833 0 1 1-5.834-5.834c.122 0 .241.011.361.019v2.874c-.12-.014-.237-.036-.36-.036a2.977 2.977 0 0 0 0 5.954c1.644 0 3.096-1.295 3.096-2.94L12.56 2.4h2.75a5.122 5.122 0 0 0 4.72 4.573v3.195" fill="currentColor" />
    </svg>
  ),
};

export default function FooterCartoon() {
  const t = useTranslations("tj");
  const tf = useTranslations("footer");
  const tn = useTranslations("nav");
  const tGift = useTranslations("giftPage");
  const locale = useLocale() as Locale;
  const lien = useLien();

  return (
    <>
      {/* ═══ RESTONS CONNECTÉS ═══ */}
      <section className="socials-s">
        <Image src="/toonjaune/socials-grid.webp" alt="" aria-hidden="true" width={706} height={360} sizes="30vw" className="social-grid1" />

        <div className="nw-socials">
          <div className="spacer-60px" />
          <div className="cartoon-handle-w">
            <p>@cartoonova</p>
          </div>
          <h2 className="h2 socials">{tf("stayConnected")}</h2>
          <p className="paragraph-6">{tf("followAdventure")}</p>
          <Image src="/toonjaune/socials-photos.webp" alt="" aria-hidden="true" width={900} height={500} sizes="(max-width: 767px) 100vw, 340px" className="image-118" />
          <div className="spacer-30px" />
        </div>

        <Image src="/toonjaune/socials-grid.webp" alt="" aria-hidden="true" width={706} height={360} sizes="30vw" className="social-grid2" />
        <Image src="/toonjaune/socials-bg-shape.svg" alt="" aria-hidden="true" width={1440} height={697} className="socials-bg" />
      </section>

      <footer className="footer">
        <div className="footer__conteneur">
          <div className="footer__wrapper">
            <div className="footer__logo">
              <Image src="/logo-detoure.png" alt="Cartoonova" width={176} height={90} className="footer-logo" />
            </div>

            <div className="footer__block-list">
              <div className="footer__block footer__block--menu">
                <p className="bold">{t("piedStyles")}</p>
                <ul className="v-stack gap-1">
                  {CATEGORIES_AFFICHAGE.map((c) => (
                    <li key={c}>
                      <Link href={lien(`/collections#${c}`)}>{NOMS_CATEGORIE[c][locale]}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="footer__block footer__block--menu">
                <p className="bold">{tf("about")}</p>
                <ul className="v-stack gap-1">
                  <li>
                    <Link href={lien("/contact")}>{tf("becomeAffiliate")}</Link>
                  </li>
                </ul>
              </div>

              <div className="footer__block footer__block--newsletter">
                <ul className="list_horiizontal">
                  <li className="list1_item">
                    <div className="checkmark is-yellow">
                      <Icone nom="coche" taille={14} />
                    </div>
                    <div>{tf("noSpam")}</div>
                  </li>
                  <li className="list1_item">
                    <div className="checkmark is-yellow">
                      <Icone nom="coche" taille={14} />
                    </div>
                    <div>{tf("bestOffersOnly")}</div>
                  </li>
                </ul>
                <NewsletterForm source="footer" variant="pill" />
              </div>

              <div className="footer__block footer__block--menu">
                <p className="bold">{t("piedAide")}</p>
                <ul className="v-stack gap-1">
                  <li>
                    <Link href={lien("/#faq")}>{t("navFaq")}</Link>
                  </li>
                  <li>
                    <Link href={lien("/#etapes")}>{t("navEtapes")}</Link>
                  </li>
                  <li>
                    <Link href={lien("/contact")}>{tn("contact")}</Link>
                  </li>
                  <li>
                    <Link href={lien("/cadeau")}>{tGift("section")}</Link>
                  </li>
                  <li>
                    <Link href={lien("/blog")}>{tn("blog")}</Link>
                  </li>
                </ul>
              </div>

              <div className="footer__block footer__block--menu">
                <p className="bold">{tf("legal")}</p>
                <ul className="v-stack gap-1">
                  <li>
                    <Link href={lien("/mentions-legales")}>{tf("legalNotice")}</Link>
                  </li>
                  <li>
                    <Link href={lien("/cgv")}>{tf("terms")}</Link>
                  </li>
                  <li>
                    <Link href={lien("/politique-de-confidentialite")}>{tf("privacy")}</Link>
                  </li>
                  <li>
                    <a href="mailto:support@cartoonova.com">support@cartoonova.com</a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="footer__aside">
              <div className="footer__aside-top">
                {RESEAUX.length > 0 && (
                  <ul className="social-media">
                    {RESEAUX.map((r) => (
                      <li key={r.libelle}>
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="tap-area" aria-label={r.libelle}>
                          {ICONES_RESEAUX[r.icone]}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="footer__aside-bottom">
                <div className="footer__copyright">
                  <p>© 2026 Cartoonova — {tf("rights")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
