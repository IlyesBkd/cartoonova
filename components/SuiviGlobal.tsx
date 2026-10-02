"use client";

import { useEffect } from "react";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";
import { locales } from "@/i18n/config";

/**
 * Mesures posees par delegation, une seule fois pour tout le site.
 *
 * Une bonne partie des pages est rendue cote serveur (accueil, Noel, cadeau,
 * garantie, quelle photo…) : on ne peut pas y accrocher un `onClick`. Un seul
 * ecouteur sur le document voit tous les clics et toutes les FAQ, y compris
 * sur les pages qu'on ajoutera plus tard, sans qu'il faille y penser.
 *
 * Trois choses :
 *  - le clic vers une fiche produit (`product_clicked`), d'ou qu'il parte —
 *    le catalogue et le blog l'emettent deja eux-memes, leurs liens portent
 *    `data-suivi="manuel"` et sont ignores ici ;
 *  - le clic sur un appel a l'action (`cta_clicked`) : tout `.bouton`, ou
 *    tout element marque `data-cta="nom"` ;
 *  - l'ouverture d'une question de FAQ (`faq_opened`).
 *
 * Et une a l'arrivee : la visite venue d'une publicite (`ad_landing`).
 */

/* Pages qui ne sont pas des fiches : un lien /<langue>/<segment> vers l'une
   d'elles n'est pas un clic produit. */
const PAGES_NON_PRODUIT = new Set([
  "collections", "cadeau", "noel", "blog", "avis", "portfolio", "contact",
  "a-propos", "garantie", "quelle-photo", "bon-cadeau", "cgv",
  "mentions-legales", "politique-de-confidentialite", "admin",
  "simpson-mockups", "portrait-personnalise-cartoon",
]);

/** Type de page, pour savoir d'ou part un clic. */
function typeDePage(chemin: string): string {
  const [, l, seg] = chemin.split("/");
  if (!(locales as readonly string[]).includes(l)) return seg ? l : "racine";
  if (!seg) return "accueil";
  return PAGES_NON_PRODUIT.has(seg) ? seg : "fiche";
}

/** Zone de la page : menu, pied de page, ou la section marquee la plus proche. */
function zone(el: Element): string | null {
  const marque = el.closest("[data-zone]");
  if (marque) return marque.getAttribute("data-zone");
  if (el.closest("nav, header")) return "menu";
  if (el.closest("footer")) return "pied";
  const section = el.closest("section[id], section[class]");
  return section ? (section.id || section.className.split(" ")[0] || null) : null;
}

function texte(el: Element): string {
  return (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

export default function SuiviGlobal() {
  useEffect(() => {
    /* ── arrivee depuis une publicite, une fois par session ── */
    try {
      const p = new URLSearchParams(window.location.search);
      const plateforme = p.get("oppref")
        ? "chatgpt"
        : p.get("gclid") || p.get("gbraid") || p.get("wbraid")
          ? "google"
          : p.get("fbclid")
            ? "meta"
            : /^(cpc|ppc|paid|paidsocial|display)$/i.test(p.get("utm_medium") || "")
              ? p.get("utm_source") || "inconnue"
              : null;
      if (plateforme && !sessionStorage.getItem("cn_pub_vue")) {
        sessionStorage.setItem("cn_pub_vue", "1");
        mesure(MESURES.arriveePub, {
          platform: plateforme,
          has_click_id: Boolean(p.get("oppref") || p.get("gclid") || p.get("fbclid")),
          utm_source: p.get("utm_source"),
          utm_medium: p.get("utm_medium"),
          utm_campaign: p.get("utm_campaign"),
          utm_content: p.get("utm_content"),
          utm_term: p.get("utm_term"),
          landing_page: typeDePage(window.location.pathname),
        });
      }
    } catch {
      /* stockage indisponible : on mesure quand meme au prochain passage */
    }

    /* ── clics ── */
    const auClic = (e: MouseEvent) => {
      const cible = e.target instanceof Element ? e.target : null;
      if (!cible) return;
      const page = typeDePage(window.location.pathname);

      const lien = cible.closest("a[href]") as HTMLAnchorElement | null;
      if (lien && lien.getAttribute("data-suivi") !== "manuel") {
        let url: URL | null = null;
        try {
          url = new URL(lien.href, window.location.href);
        } catch {
          url = null;
        }
        if (url && url.origin === window.location.origin) {
          const [, l, seg, reste] = url.pathname.split("/");
          if ((locales as readonly string[]).includes(l) && seg && !reste && !PAGES_NON_PRODUIT.has(seg)) {
            mesure(MESURES.produitClique, { slug: seg, source: page, zone: zone(lien) });
          }
        }
      }

      const cta = cible.closest("[data-cta], .bouton, .cta-fin__bouton, .hiw-step-button") as HTMLElement | null;
      if (cta) {
        const href = cta.getAttribute("href");
        mesure(MESURES.ctaClique, {
          cta: cta.getAttribute("data-cta") || texte(cta),
          target: href && href.startsWith("/") ? href.split("?")[0] : href ? "externe" : null,
          page,
          zone: zone(cta),
        });
      }
    };

    /* ── FAQ : `toggle` ne remonte pas, d'ou l'ecoute en phase de capture ── */
    const auBasculement = (e: Event) => {
      const d = e.target;
      if (!(d instanceof HTMLDetailsElement) || !d.open) return;
      const question = d.querySelector("summary");
      mesure(MESURES.faqOuverte, {
        question: question ? texte(question) : null,
        page: typeDePage(window.location.pathname),
        zone: zone(d),
      });
    };

    document.addEventListener("click", auClic, { capture: true });
    document.addEventListener("toggle", auBasculement, { capture: true });
    return () => {
      document.removeEventListener("click", auClic, { capture: true });
      document.removeEventListener("toggle", auBasculement, { capture: true });
    };
  }, []);

  return null;
}
