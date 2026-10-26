"use client";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { GiftConfiguratorLink, GiftExampleTotal } from "./GiftPricing";
import Link from "next/link";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";

const COPY = {
 fr: {title:"Quel cadeau choisir ?",who:"Pour qui ?",solo:"Une personne",couple:"Un couple",family:"Une famille",style:"Quel univers ?",classic:"Dessin jaune",manga:"Manga",hero:"Conte de fées",hint:"Le prix final dépend du nombre de personnes et des options. Vérifiez le délai avant de commander ; ce guide ne promet pas une livraison à une date précise.",cta:"Personnaliser ce portrait",result:"Votre point de départ"},
 en: {title:"Which gift should I choose?",who:"Who is it for?",solo:"One person",couple:"A couple",family:"A family",style:"Which world?",classic:"Yellow cartoon",manga:"Manga",hero:"Fairytale",hint:"The final price depends on people and options. Check the delivery estimate before ordering; this guide does not promise delivery on a specific date.",cta:"Personalise this portrait",result:"Your starting point"},
};
/** A lightweight optional chooser, not an extra checkout step. No free text or PII. */
export default function GiftGuide(){
 const locale=useLocale();const t=COPY[locale as keyof typeof COPY]??COPY.en;
 const [people,setPeople]=useState('solo');const [style,setStyle]=useState('classic');
 const [deadline,setDeadline]=useState('flexible');
 useEffect(()=>{mesure(MESURES.guideCadeauVu,{variant:'guided-v1'});},[]);
 const slug=style==='manga'?'dbz':style==='hero'?'disney':'simpson';
 function select(kind:'people'|'style',value:string){if(kind==='people')setPeople(value);else setStyle(value);mesure(MESURES.guideCadeauChoix,{question:kind,choice:value});}
 return <section className="enveloppe section" aria-labelledby="gift-guide-title">
  <h2 id="gift-guide-title">{t.title}</h2>
  <div className="flex flex-wrap gap-6 my-6">
   <label>{locale==='fr'?'Pour quelle date ?':'When is it needed?'}<select value={deadline} onChange={e=>{setDeadline(e.target.value);mesure(MESURES.guideCadeauChoix,{question:'deadline',choice:e.target.value});}} className="block border rounded p-3"><option value="flexible">{locale==='fr'?'Date flexible':'Flexible date'}</option><option value="soon">{locale==='fr'?'Très bientôt : envisager le bon cadeau':'Very soon: consider a gift voucher'}</option></select></label>
   <label>{t.who}<select value={people} onChange={e=>select('people',e.target.value)} className="block border rounded p-3"><option value="solo">{t.solo}</option><option value="couple">{t.couple}</option><option value="family">{t.family}</option></select></label>
   <label>{t.style}<select value={style} onChange={e=>select('style',e.target.value)} className="block border rounded p-3"><option value="classic">{t.classic}</option><option value="manga">{t.manga}</option><option value="hero">{t.hero}</option></select></label>
  </div>
  <p aria-live="polite">{t.result}: {t[style as 'classic'|'manga'|'hero']} — <GiftExampleTotal people={people==='solo'?1:people==='couple'?2:4} /> ({locale==='fr'?'exemple numérique, buste, sans options':'digital bust example, no options'}; {people==='family'?4:people==='couple'?2:1} {locale==='fr'?'personne(s)':'people'})</p>
  {deadline==='soon' && <p>{locale==='fr'?'Une date proche ne garantit pas la livraison du portrait à temps.':'A near deadline does not guarantee the portrait will arrive on time.'}</p>}
  <p><Link href={`/${locale}/bon-cadeau`}>{locale==='fr'?'Offrir un bon cadeau : le bénéficiaire choisit':'Give a voucher: let the recipient choose'}</Link> · <Link href={`/${locale}/collections`}>{locale==='fr'?'Voir tous les univers':'Browse all styles'}</Link></p>
  <p className="my-4 text-sm">{t.hint}</p>
  <GiftConfiguratorLink href={`/${locale}/${slug}#configurateur`} className="bouton bouton--primaire" onClick={()=>mesure(MESURES.guideCadeauRecommandation,{people,style,slug})}>{t.cta}</GiftConfiguratorLink>
 </section>;
}
