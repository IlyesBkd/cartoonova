"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { GiftConfiguratorLink, GiftExampleTotal } from "./GiftPricing";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";
import "./GiftGuide.css";

const COPY = {
  fr: {
    eyebrow: "Le guide cadeau", title: "Quel cadeau choisir ?", intro: "Pensez à eux. Trouvez leur univers.",
    note: "Trois choix pour trouver votre point de départ.", who: "Pour qui ?", solo: "Une personne", couple: "Un couple", family: "Une famille",
    soloNote: "Son portrait", coupleNote: "Leur duo", familyNote: "Toute la tribu",
    when: "Pour quelle date ?", flexible: "Date flexible", soon: "Très bientôt", flexibleNote: "Je prépare mon cadeau", soonNote: "Envisager le bon cadeau",
    style: "Quel univers ?", classic: "Dessin jaune", manga: "Manga", hero: "Conte de fées",
    classicNote: "Drôle & décalé", mangaNote: "L’esprit d’aventure", heroNote: "Un peu de magie",
    hint: "Le prix final dépend du nombre de personnes et des options. Vérifiez le délai avant de commander ; ce guide ne promet pas une livraison à une date précise.",
    cta: "Personnaliser ce portrait", result: "Votre point de départ", example: "Exemple numérique", details: "Buste · sans options", people: "personne(s)",
    imageNote: "Illustration du style · cadre non inclus", imageAlt: "Exemple de portrait du catalogue :",
    urgent: "Une date proche ne garantit pas la livraison du portrait à temps.", voucher: "Offrir un bon cadeau : le bénéficiaire choisit", browse: "Voir tous les univers", selection: "Votre sélection",
  },
  en: {
    eyebrow: "The gift guide", title: "Which gift should I choose?", intro: "Think of them. Find their world.",
    note: "Three choices to find your starting point.", who: "Who is it for?", solo: "One person", couple: "A couple", family: "A family",
    soloNote: "Their portrait", coupleNote: "Their duo", familyNote: "The whole family",
    when: "When is it needed?", flexible: "Flexible date", soon: "Very soon", flexibleNote: "Planning ahead", soonNote: "Consider a gift voucher",
    style: "Which world?", classic: "Yellow cartoon", manga: "Manga", hero: "Fairytale",
    classicNote: "Fun & offbeat", mangaNote: "A sense of adventure", heroNote: "A little magic",
    hint: "The final price depends on people and options. Check the delivery estimate before ordering; this guide does not promise delivery on a specific date.",
    cta: "Personalise this portrait", result: "Your starting point", example: "Digital example", details: "Bust · no options", people: "people",
    imageNote: "Style example · frame not included", imageAlt: "Catalogue portrait example:",
    urgent: "A near deadline does not guarantee the portrait will arrive on time.", voucher: "Give a voucher: let the recipient choose", browse: "Browse all styles", selection: "Your selection",
  },
};

// Existing catalogue photography; a style reference, not a generated preview of the chosen people.
const STYLES = [
  { value: "classic", slug: "simpson", image: "/framed.jpg" },
  { value: "manga", slug: "dbz", image: "/DBZ/Photo_produits/il_1140xN.7733273072_b9q7.png" },
  { value: "hero", slug: "disney", image: "/Disney/Photo_produits/il_1140xN.6576111634_dwx3.png" },
] as const;
type Style = typeof STYLES[number]["value"];
type People = "solo" | "couple" | "family";

/** Optional exploration, never an extra checkout step. No free text or PII. */
export default function GiftGuide() {
  const locale = useLocale();
  const t = COPY[locale as keyof typeof COPY] ?? COPY.en;
  const [people, setPeople] = useState<People>("solo");
  const [style, setStyle] = useState<Style>("classic");
  const [deadline, setDeadline] = useState("flexible");
  useEffect(() => { mesure(MESURES.guideCadeauVu, { variant: "guided-v1" }); }, []);
  const selected = STYLES.find(item => item.value === style)!;
  const count = people === "solo" ? 1 : people === "couple" ? 2 : 4;

  return (
    <section className="gift-guide enveloppe" aria-labelledby="gift-guide-title">
      <header className="gift-guide__heading">
        <div>
          <span className="gift-guide__eyebrow">{t.eyebrow}</span>
          <h2 id="gift-guide-title">{t.title}</h2>
          <p className="gift-guide__intro">{t.intro}</p>
        </div>
        <p className="gift-guide__note">{t.note}</p>
      </header>
      <div className="gift-guide__layout">
        <div className="gift-guide__choices">
          <fieldset className="gift-guide__group">
            <legend><span aria-hidden="true">01</span>{t.who}</legend>
            <div className="gift-guide__people">
              {(["solo", "couple", "family"] as const).map(value => (
                <label className="gift-guide__option" key={value}>
                  <input type="radio" name="gift-people" value={value} checked={people === value} onChange={() => { setPeople(value); mesure(MESURES.guideCadeauChoix, { question: "people", choice: value }); }} />
                  <span className="gift-guide__option-copy"><strong>{t[value]}</strong><small>{t[`${value}Note`]}</small></span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="gift-guide__group">
            <legend><span aria-hidden="true">02</span>{t.when}</legend>
            <div className="gift-guide__deadlines">
              {(["flexible", "soon"] as const).map(value => (
                <label className="gift-guide__option" key={value}>
                  <input type="radio" name="gift-deadline" value={value} checked={deadline === value} onChange={() => { setDeadline(value); mesure(MESURES.guideCadeauChoix, { question: "deadline", choice: value }); }} />
                  <span className="gift-guide__option-copy"><strong>{t[value]}</strong><small>{t[`${value}Note`]}</small></span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="gift-guide__group gift-guide__group--styles">
            <legend><span aria-hidden="true">03</span>{t.style}</legend>
            <div className="gift-guide__styles">
              {STYLES.map(item => (
                <label className="gift-guide__style" key={item.value}>
                  <input type="radio" name="gift-style" value={item.value} checked={style === item.value} onChange={() => { setStyle(item.value); mesure(MESURES.guideCadeauChoix, { question: "style", choice: item.value }); }} />
                  <Image src={item.image} alt="" width={300} height={300} sizes="(max-width: 600px) 30vw, 180px" />
                  <span className="gift-guide__style-copy"><strong>{t[item.value]}</strong><small>{t[`${item.value}Note`]}</small></span>
                </label>
              ))}
            </div>
          </fieldset>
          <Link className="gift-guide__browse" href={`/${locale}/collections`}>{t.browse}<span aria-hidden="true"> ↗</span></Link>
        </div>
        <article className="gift-guide__result" aria-labelledby="gift-guide-result-title">
          <div className="gift-guide__result-top"><span>{t.result}</span><span aria-hidden="true">✦</span></div>
          <figure className="gift-guide__artwork">
            <Image key={selected.image} src={selected.image} alt={`${t.imageAlt} ${t[style]}`} width={600} height={600} sizes="(max-width: 600px) 88vw, (max-width: 960px) 70vw, 380px" />
            <figcaption>{t.imageNote}</figcaption>
          </figure>
          <div className="gift-guide__result-body">
            <div aria-live="polite" aria-atomic="true">
              <span className="gift-guide__eyebrow">{t.selection} · {t[people]}</span>
              <h3 id="gift-guide-result-title">{t[style]}</h3>
              <div className="gift-guide__price"><span>{t.example}</span><strong><GiftExampleTotal people={count} /></strong></div>
              <p className="gift-guide__details">{t.details} · {count} {t.people}</p>
            </div>
            <GiftConfiguratorLink href={`/${locale}/${selected.slug}#configurateur`} className="bouton bouton--primaire gift-guide__cta" onClick={() => mesure(MESURES.guideCadeauRecommandation, { people, style, slug: selected.slug })}>{t.cta}<span aria-hidden="true"> →</span></GiftConfiguratorLink>
            <div className={`gift-guide__voucher${deadline === "soon" ? " gift-guide__voucher--urgent" : ""}`}>
              {deadline === "soon" && <p>{t.urgent}</p>}
              <Link href={`/${locale}/bon-cadeau`}>{t.voucher}<span aria-hidden="true"> ↗</span></Link>
            </div>
          </div>
        </article>
      </div>
      <p className="gift-guide__disclaimer">{t.hint}</p>
    </section>
  );
}
