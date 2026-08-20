"use client";

import { useState } from "react";
import Image from "next/image";
import MockupSwitcher from "../_shared/MockupSwitcher";
import {
  type ConfiguratorState,
  type PrintKey,
  BACKGROUNDS,
  GALLERY_PHOTOS,
  FAQ_ITEMS,
} from "../_shared/content";

/**
 * Prix reels de la boutique, tels qu'ils sont en base — et non les valeurs par
 * defaut de _shared/content.ts (base 49), qui donnaient un total de 138 € face
 * a un ancrage « −50 % ». Sur cette maquette le prix est l'element central :
 * un chiffre faux fausse le jugement.
 */
const PRICES = {
  base: 15,
  fullbodyExtra: 5,
  extraPerson: 4,
  extraAnimal: 4,
  digital: 0,
  posterSimple: 19,
  canvas: 39,
  poster: 59,
} as const;

const PRINT_OPTIONS = [
  { key: "digital", label: "Numérique", sub: "HD · PNG + JPG", addon: PRICES.digital },
  { key: "posterSimple", label: "Poster", sub: "30×40 cm · papier mat", addon: PRICES.posterSimple },
  { key: "canvas", label: "Toile", sub: "40×60 cm · prête à accrocher", addon: PRICES.canvas },
  { key: "poster", label: "Encadré", sub: "30×40 cm · cadre chêne", addon: PRICES.poster },
] as const;

/**
 * Formatage volontairement manuel : Intl.NumberFormat rend une espace fine
 * insecable differente cote serveur (Node) et cote navigateur, ce qui declenche
 * une erreur d'hydratation React sur cette page.
 */
const formatEUR = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

const computeTotal = (s: ConfiguratorState) =>
  PRICES.base +
  (s.format === "fullbody" ? PRICES.fullbodyExtra : 0) +
  (s.people - 1) * PRICES.extraPerson +
  s.animals * PRICES.extraAnimal +
  PRICES[s.printKey];

/**
 * Variante « marchand » — relevee sur la page produit de turnedyellow.com avec
 * Playwright (captures 1440px + styles calcules), pas devinee.
 *
 * Ce qui fait leur page, et qu'on ne voit pas dans le HTML brut :
 *  - zone produit en TROIS colonnes : galerie | bande d'icones | colonne d'achat
 *  - le prix barre et le paiement fractionne sur la meme ligne
 *  - un CTA « Continuer » (parcours par etapes), pas un « ajouter au panier »
 *  - un encart vert « commander maintenant, photo plus tard » sous le CTA
 *  - un encart d'upsell borde avec vignette et coches vertes
 *  - le decor choisi affiche comme une carte image + libelle
 *  - plus bas : titres bicolores (noir + accent dore en script) et surtout des
 *    PHOTOS DE VRAIS CLIENTS tenant leur portrait imprime — c'est leur premier
 *    levier de confiance, pas les illustrations elles-memes
 *
 * Jetons releves : #ECBF45 / #DCA616 (jaune), #F8F6F3 (fond), #121212 (encre),
 * #00C760 (validation), fond des pastilles d'icones #FBF3DE.
 */

const INK = "#121212";
const ACCENT = "#ECBF45";
const ACCENT_DEEP = "#DCA616";
const BG_ALT = "#F8F6F3";
const BADGE_BG = "#FBF3DE";
const GREEN = "#00A24C";
const GREEN_BG = "#EAF7EE";
const MUTED = "#6b6863";
const LINE = "#e5e3df";

const FONT = 'Assistant, "Segoe UI", system-ui, -apple-system, sans-serif';
const SCRIPT = '"Bradley Hand", "Segoe Script", "Comic Sans MS", cursive';

const SIDE_BADGES = [
  { icon: "🧑‍🎨", label: "Vrais illustrateurs" },
  { icon: "♾️", label: "Retouches illimitées" },
  { icon: "🖼️", label: "N'importe quelle photo" },
  { icon: "⚡", label: "Prêt en 2 jours" },
];

const BENEFITS = [
  {
    icon: "♾️",
    title: "Retouches illimitées — satisfaction garantie",
    desc: "On retravaille le portrait jusqu'à ce qu'il vous plaise. Chaque détail est ajusté à vos photos.",
  },
  {
    icon: "✍️",
    title: "100 % dessiné à la main par des illustrateurs",
    desc: "Aucun filtre IA — votre portrait est créé par de vraies personnes, ce qui en fait une pièce unique.",
  },
  {
    icon: "⚡",
    title: "Dessin rapide, délais annoncés clairement",
    desc: "Premier jet en 2 jours. L'impression part ensuite sous 3 jours ouvrés après votre validation.",
  },
  {
    icon: "🔒",
    title: "Aperçu avant impression",
    desc: "Rien ne part à la fabrication tant que vous n'avez pas validé le résultat.",
  },
];

export default function TurnedYellowMockup() {
  const [state, setState] = useState<ConfiguratorState>({
    format: "portrait",
    people: 1,
    animals: 0,
    printKey: "canvas",
  });
  const [activePhoto, setActivePhoto] = useState(0);
  const [bg, setBg] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openPanel, setOpenPanel] = useState<string | null>("qui");

  const total = computeTotal(state);
  const anchor = total * 2;
  const set = <K extends keyof ConfiguratorState>(key: K, value: ConfiguratorState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const panel = (id: string, title: string, body: React.ReactNode) => (
    <div className="border-b" style={{ borderColor: LINE }}>
      <button
        onClick={() => setOpenPanel(openPanel === id ? null : id)}
        className="w-full flex items-center justify-between py-4 text-left font-bold"
        aria-expanded={openPanel === id}
      >
        {title}
        <span aria-hidden="true" style={{ color: MUTED }}>
          {openPanel === id ? "⌃" : "⌄"}
        </span>
      </button>
      {openPanel === id && <div className="pb-5">{body}</div>}
    </div>
  );

  return (
    <div style={{ fontFamily: FONT, color: INK, background: "#fff" }}>
      <MockupSwitcher />

      {/* ─── Bandeau promo ─────────────────────────────────── */}
      <div
        style={{ background: ACCENT, color: INK, fontFamily: SCRIPT }}
        className="text-center text-[15px] font-bold py-2.5 px-4"
      >
        🎁 Offre de rentrée : −50 % sur tout le site + 20 % en plus sur le portrait numérique avec le code CADEAU20
      </div>

      {/* ─── En-tête ───────────────────────────────────────── */}
      <header className="border-b sticky top-0 z-40 bg-white" style={{ borderColor: LINE }}>
        <div className="max-w-[1400px] mx-auto px-6 h-[72px] flex items-center justify-between gap-8">
          <span className="font-extrabold text-lg tracking-tight" style={{ fontFamily: SCRIPT }}>
            ● Cartoonova
          </span>
          <nav className="hidden lg:flex items-center gap-7 text-[15px]">
            <a className="font-semibold underline underline-offset-4" style={{ color: ACCENT_DEEP }} href="#config">
              Créer mon portrait
            </a>
            {["Styles", "Impressions", "Idées cadeaux", "Notre méthode"].map((l) => (
              <span key={l} className="cursor-default">
                {l} <span style={{ color: MUTED }}>⌄</span>
              </span>
            ))}
          </nav>
          <span
            className="rounded-full px-5 py-2.5 font-bold text-sm text-white"
            style={{ background: "#22c55e" }}
          >
            💬 Chat en direct
          </span>
        </div>
      </header>

      {/* ─── Produit : galerie | icônes | achat ────────────── */}
      <section id="config" className="max-w-[1400px] mx-auto px-6 py-10 grid lg:grid-cols-[minmax(0,1fr)_120px_minmax(0,1.1fr)] gap-8">
        {/* Galerie */}
        <div>
          <div className="relative aspect-[4/3] rounded-lg overflow-hidden" style={{ background: BG_ALT }}>
            <Image
              src={GALLERY_PHOTOS[activePhoto]}
              alt="Portrait caricature personnalisé"
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover"
              priority
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {GALLERY_PHOTOS.slice(0, 6).map((src, i) => (
              <button
                key={src}
                onClick={() => setActivePhoto(i)}
                className="relative w-[92px] h-[70px] shrink-0 rounded-md overflow-hidden"
                style={{
                  border: i === activePhoto ? `3px solid ${ACCENT}` : `1px solid ${LINE}`,
                }}
                aria-label={`Voir le portrait ${i + 1}`}
              >
                <Image src={src} alt="" fill sizes="92px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Bande d'icônes */}
        <div className="hidden lg:flex flex-col gap-3">
          {SIDE_BADGES.map((b) => (
            <div
              key={b.label}
              className="rounded-lg py-4 px-2 text-center text-[12px] font-semibold leading-tight"
              style={{ background: BG_ALT }}
            >
              <div className="text-xl mb-1.5" aria-hidden="true">
                {b.icon}
              </div>
              {b.label}
            </div>
          ))}
        </div>

        {/* Colonne d'achat */}
        <div>
          <p className="text-sm font-bold flex items-center gap-2">
            <span style={{ color: ACCENT_DEEP }} aria-hidden="true">
              ★★★★★
            </span>
            Dessiné à la main, jamais généré
          </p>

          <h1 className="text-[42px] leading-[1.08] font-extrabold mt-2 tracking-tight">
            Portrait cartoon dessiné à la main
          </h1>

          <p className="mt-3 font-bold" style={{ color: ACCENT_DEEP }}>
            🎁 Offre de rentrée : −50 % sur tout le site
          </p>

          <p className="mt-4 text-[15px]" style={{ color: MUTED }}>
            Envoyez n&apos;importe quelle photo — vous, votre couple, votre famille, votre animal — et un
            illustrateur vous redessine en personnage cartoon jaune. <span className="underline font-semibold" style={{ color: INK }}>Lire la suite</span>
          </p>

          {/* Upsell */}
          <div className="mt-5 rounded-lg border p-3 flex gap-3" style={{ borderColor: LINE }}>
            <div className="relative w-[92px] h-[70px] shrink-0 rounded overflow-hidden" style={{ background: BG_ALT }}>
              <Image src={GALLERY_PHOTOS[3]} alt="" fill sizes="92px" className="object-cover" />
              <span className="absolute top-1 left-1 text-[9px] font-bold px-1 rounded" style={{ background: ACCENT }}>
                NOUVEAU
              </span>
            </div>
            <div className="text-[13px]">
              <p className="font-bold">📹 Carte cadeau à imprimer offerte</p>
              <p style={{ color: MUTED }}>
                Pour offrir le jour J même si l&apos;impression arrive après.
              </p>
              <p className="mt-1 flex gap-3 font-semibold" style={{ color: GREEN }}>
                <span>✓ PDF</span>
                <span>✓ A5</span>
                <span>✓ Immédiat</span>
              </p>
            </div>
          </div>

          {/* Décor sélectionné */}
          <div className="mt-5 rounded-lg flex items-center gap-4 p-3" style={{ background: BG_ALT }}>
            <div className="relative w-[150px] h-[110px] rounded overflow-hidden shrink-0">
              <Image src={BACKGROUNDS[bg].src} alt={BACKGROUNDS[bg].label} fill sizes="150px" className="object-cover" />
            </div>
            <span className="font-bold uppercase tracking-wide text-[15px]">{BACKGROUNDS[bg].label}</span>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {BACKGROUNDS.map((b, i) => (
              <button
                key={b.src}
                onClick={() => setBg(i)}
                className="relative w-[86px] h-[64px] shrink-0 rounded overflow-hidden"
                style={{ border: i === bg ? `3px solid ${ACCENT}` : `1px solid ${LINE}` }}
                aria-label={b.label}
              >
                <Image src={b.src} alt="" fill sizes="86px" className="object-cover" />
              </button>
            ))}
          </div>

          {/* Prix */}
          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
            <p className="flex items-baseline gap-3">
              <span className="text-[34px] font-extrabold leading-none">{formatEUR(total)}</span>
              <span className="text-lg line-through" style={{ color: MUTED }}>
                {formatEUR(anchor)}
              </span>
            </p>
            <p className="text-[13px]" style={{ color: MUTED }}>
              ou 4 fois {formatEUR(total / 4)} sans frais
            </p>
          </div>

          <button
            className="w-full mt-4 py-4 rounded-lg font-extrabold text-[19px] transition-transform active:scale-[0.995]"
            style={{ background: ACCENT, color: INK }}
          >
            Continuer &nbsp;››
          </button>

          <div
            className="mt-3 rounded-lg py-3.5 px-4 flex items-center justify-between font-bold"
            style={{ background: GREEN_BG, color: GREEN }}
          >
            <span>🧑‍🎨 Commander maintenant, envoyer la photo plus tard</span>
            <span aria-hidden="true">ⓘ</span>
          </div>

          {/* Panneaux dépliants */}
          <div className="mt-6">
            {panel(
              "qui",
              "Qui est sur le portrait ?",
              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    ["people", "Personnes", PRICES.extraPerson, 1, 14],
                    ["animals", "Animaux", PRICES.extraAnimal, 0, 10],
                  ] as const
                ).map(([key, label, unit, min, max]) => (
                  <div key={key}>
                    <span className="block text-[13px] font-semibold mb-1.5">{label}</span>
                    <div className="flex items-center rounded border" style={{ borderColor: LINE }}>
                      <button
                        onClick={() => set(key, Math.max(min, state[key] - 1))}
                        disabled={state[key] <= min}
                        className="px-4 py-2 text-lg font-bold disabled:opacity-30"
                        aria-label={`Retirer ${label}`}
                      >
                        −
                      </button>
                      <span className="flex-1 text-center font-extrabold tabular-nums">{state[key]}</span>
                      <button
                        onClick={() => set(key, Math.min(max, state[key] + 1))}
                        disabled={state[key] >= max}
                        className="px-4 py-2 text-lg font-bold disabled:opacity-30"
                        aria-label={`Ajouter ${label}`}
                      >
                        +
                      </button>
                    </div>
                    {/* Une seule expression : une entite &apos; au milieu d'un
                        noeud de texte cree un ecart d'espace entre le rendu
                        serveur et le rendu client, et donc une erreur
                        d'hydratation. */}
                    <p className="text-[12px] mt-1" style={{ color: MUTED }}>
                      {`+${formatEUR(unit)} l’unité`}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {panel(
              "cadrage",
              "Cadrage",
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["portrait", "Portrait", "Visage + buste", 0],
                    ["fullbody", "Corps entier", "De la tête aux pieds", PRICES.fullbodyExtra],
                  ] as const
                ).map(([value, label, sub, extra]) => (
                  <button
                    key={value}
                    onClick={() => set("format", value)}
                    className="text-left p-3 rounded-lg"
                    style={{
                      border: state.format === value ? `2px solid ${INK}` : `1px solid ${LINE}`,
                      background: state.format === value ? BG_ALT : "#fff",
                    }}
                  >
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="block text-[12px]" style={{ color: MUTED }}>
                      {sub}
                    </span>
                    <span className="block text-[12px] font-bold mt-1">
                      {extra ? `+${formatEUR(extra)}` : "Inclus"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {panel(
              "support",
              "Support d'impression",
              <div className="grid grid-cols-2 gap-3">
                {PRINT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => set("printKey", opt.key as PrintKey)}
                    className="text-left p-3 rounded-lg"
                    style={{
                      border: state.printKey === opt.key ? `2px solid ${INK}` : `1px solid ${LINE}`,
                      background: state.printKey === opt.key ? BG_ALT : "#fff",
                    }}
                  >
                    <span className="block text-sm font-bold">{opt.label}</span>
                    <span className="block text-[12px]" style={{ color: MUTED }}>
                      {opt.sub}
                    </span>
                    <span className="block text-[12px] font-bold mt-1">
                      {opt.addon ? `+${formatEUR(opt.addon)}` : "Inclus"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Bénéfices + photo client ──────────────────────── */}
      <section
        className="py-20 px-6"
        style={{ background: `radial-gradient(120% 90% at 50% 0%, ${BADGE_BG} 0%, #ffffff 60%)` }}
      >
        <h2 className="text-center text-[44px] leading-[1.1] font-extrabold max-w-3xl mx-auto">
          Faites plaisir à ceux que vous aimez avec un{" "}
          <span style={{ fontFamily: SCRIPT, color: ACCENT_DEEP }}>portrait cartoon sur mesure</span>
        </h2>

        <div className="max-w-[1200px] mx-auto mt-14 grid md:grid-cols-2 gap-12 items-center">
          <div className="flex flex-col gap-8">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-5">
                <div
                  className="w-[70px] h-[70px] rounded-full shrink-0 flex items-center justify-center text-2xl"
                  style={{ background: BADGE_BG }}
                  aria-hidden="true"
                >
                  {b.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold leading-snug">{b.title}</h3>
                  <p className="mt-1 text-[15px]" style={{ color: MUTED }}>
                    {b.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Chez eux : une photo d'un vrai client tenant son portrait imprime.
              A remplacer par la votre — c'est leur levier de confiance n°1. */}
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden" style={{ background: BG_ALT }}>
            <Image
              src={GALLERY_PHOTOS[2]}
              alt="Portrait remis à un client"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
            <p
              className="absolute bottom-3 left-3 right-3 text-[13px] font-semibold rounded px-3 py-2"
              style={{ background: "rgba(255,255,255,0.92)" }}
            >
              À remplacer par une photo d&apos;un client tenant son portrait imprimé — c&apos;est ce
              qu&apos;ils mettent ici, et c&apos;est leur argument le plus fort.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Comment ça marche ─────────────────────────────── */}
      <section className="py-20 px-6" style={{ background: BG_ALT }}>
        <h2 className="text-center text-[38px] font-extrabold">
          Comment <span style={{ fontFamily: SCRIPT, color: ACCENT_DEEP }}>ça marche</span>
        </h2>
        <div className="max-w-5xl mx-auto mt-12 grid sm:grid-cols-3 gap-10">
          {[
            ["Envoyez votre photo", "Un selfie suffit. Vous pouvez aussi l'envoyer après la commande."],
            ["On dessine à la main", "Un illustrateur reprend votre photo trait par trait, en 2 jours."],
            ["Vous validez", "Aperçu envoyé avant impression, retouches gratuites jusqu'à validation."],
          ].map(([title, desc], i) => (
            <div key={title} className="text-center">
              <div
                className="w-14 h-14 rounded-full mx-auto flex items-center justify-center font-extrabold text-xl"
                style={{ background: ACCENT, color: INK }}
              >
                {i + 1}
              </div>
              <h3 className="mt-4 font-bold text-lg">{title}</h3>
              <p className="mt-1.5 text-[15px]" style={{ color: MUTED }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────── */}
      <section className="py-20 px-6 max-w-3xl mx-auto">
        <h2 className="text-center text-[38px] font-extrabold">
          Questions <span style={{ fontFamily: SCRIPT, color: ACCENT_DEEP }}>fréquentes</span>
        </h2>
        <div className="mt-10 flex flex-col">
          {FAQ_ITEMS.map((item, i) => (
            <div key={item.q} className="border-b" style={{ borderColor: LINE }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left py-5 font-bold flex justify-between gap-4"
                aria-expanded={openFaq === i}
              >
                {item.q}
                <span aria-hidden="true" style={{ color: ACCENT_DEEP }}>
                  {openFaq === i ? "−" : "+"}
                </span>
              </button>
              {openFaq === i && (
                <p className="pb-5 text-[15px]" style={{ color: MUTED }}>
                  {item.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── Rappel d'achat ────────────────────────────────── */}
      <section className="py-16 px-6 text-center" style={{ background: BG_ALT }}>
        <h2 className="text-[34px] font-extrabold">
          Prêt à passer en <span style={{ fontFamily: SCRIPT, color: ACCENT_DEEP }}>mode cartoon</span> ?
        </h2>
        <button
          className="mt-6 px-12 py-4 rounded-lg font-extrabold text-lg"
          style={{ background: ACCENT, color: INK }}
        >
          Continuer &nbsp;›› &nbsp;{formatEUR(total)}
        </button>
        <p className="mt-4 text-sm" style={{ color: MUTED }}>
          Aperçu avant impression · Retouches gratuites · Paiement sécurisé
        </p>
      </section>
    </div>
  );
}
