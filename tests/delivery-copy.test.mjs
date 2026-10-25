import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, existsSync} from 'node:fs';
import {createRequire, Module} from 'node:module';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
function load(file, replacements={}, cache=new Map()) {
 file=path.resolve(root,file); if(cache.has(file))return cache.get(file).exports;
 const m=new Module(file);m.filename=file;cache.set(file,m);const req=createRequire(file);
 m.require=name=>{
  if(name in replacements)return replacements[name];
  if(name.startsWith('.')||name.startsWith('@/')) {
   const base=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(file),name);
   for(const ext of ['.ts','.tsx'])if(existsSync(base+ext))return load(base+ext,replacements,cache);
  }
  return req(name);
 };
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
 return m.exports;
}
const terms={fr:[/ouvrés/i,/paiement/i,/photos/i,/aperçu/i],en:[/business days/i,/payment/i,/photos/i,/preview/i],es:[/hábiles/i,/pago/i,/fotos/i,/vista previa/i],de:[/Werktag/i,/Zahlung/i,/Fotos/i,/Vorschau/i],it:[/lavorativi/i,/pagamento/i,/foto/i,/anteprima/i],nl:[/werkdagen/i,/betaling/i,/foto/i,/voorbeeld/i],pl:[/robocz/i,/płatno/i,/zdję/i,/podgląd/i],sv:[/arbetsdag/i,/betalning/i,/foton/i,/förhandsvisning/i],da:[/hverdage/i,/betaling/i,/fotos/i,/forhåndsvisning/i],pt:[/úteis/i,/pagamento/i,/fotos/i,/pré-visualização/i]};
function check(text,locale,context){for(const term of terms[locale])assert.match(text,term,context);}
test('catalogue fallback descriptions render a conditional first preview in all ten locales',()=>{
 const {descriptionProduit}=load('lib/catalogue.ts');
 const product={univers:'Test',slug:'test'};
 for(const locale of Object.keys(terms))check(renderToStaticMarkup(React.createElement('p',null,descriptionProduit(product,locale))),locale,locale);
});
test('real confirmation, welcome and after-upload copy share the conditional standard promise',async()=>{
 const copy=load('lib/email-i18n.ts');
 for(const locale of Object.keys(terms)) {
  for(const text of [copy.confirmationEmail[locale].deliveryTime,copy.successPage[locale].workBody,copy.depotPhotosPage[locale].doneBody,copy.orderTrackingPage[locale].steps.dessin.body])check(text,locale,locale);
 }
});
test('landing hero and metadata no longer promise a free or calendar-day preview',async()=>{
 const landing=load('app/[locale]/portrait-personnalise-cartoon/page.tsx',{'@/components/pages/PageAccueil':{__esModule:true,default:({textesHero})=>React.createElement('div',null,Object.values(textesHero).join(' '))},'next-intl/server':{setRequestLocale:()=>{}}});
 const html=renderToStaticMarkup(await landing.default({params:Promise.resolve({locale:'fr'})}));
 check(html,'fr','landing hero');assert.doesNotMatch(html,/sans engagement|Aperçu sous 2 jours,/);
 const meta=await landing.generateMetadata({params:Promise.resolve({locale:'fr'})});
 check(meta.description,'fr','metadata');check(meta.openGraph.description,'fr','openGraph');
});
test('rendered product JSON-LD describes preview start and print approval separately',()=>{
 const {PRODUCT_STYLE_META,ProductJsonLd}=load('components/structured-data.tsx');
 for(const [sku,meta] of Object.entries(PRODUCT_STYLE_META)) {
  const html=renderToStaticMarkup(React.createElement(ProductJsonLd,{product:{...meta,brand:'Cartoonova',offers:{priceCurrency:'EUR',price:'1',availability:'https://schema.org/InStock',priceValidUntil:'2027-01-01'}}}));
  const data=JSON.parse(html.replace(/^<script[^>]*>/,'').replace(/<\/script>$/,''));
  check(data.description,'fr',sku);assert.match(data.description,/validation/);assert.match(data.description,/3 à 7/);
 }
});
test('express email promise retains 24 hours including weekends, after payment and photos',()=>{
 const {optionsCommande}=load('lib/email-i18n.ts');
 for(const locale of Object.keys(terms)) {
  const text=optionsCommande[locale].deliveryExpress;
  assert.match(text,/24/);for(const term of terms[locale].slice(1))assert.match(text,term,locale);
  assert.doesNotMatch(text,/\b1 (?:jour|day|día|Tag|giorno|dag|dzień)/);
 }
});
test('confirmation payloads with missing photos and welcome payloads are rendered locally in all locales',async()=>{
 const noEffects=async()=>{};
 for(const locale of Object.keys(terms)) {
  let confirmation;let welcome;
  const {finaliserCommande}=load('lib/finaliserCommande.ts',{
   './emailOutbox':{payerAvecConfirmation:async(_id,payload)=>{confirmation=payload;return false;},drainerEmails:noEffects},
   '@/lib/confidentialiteMesure':{diagnosticJournal:()=>''},
   '@/lib/emailToken':{orderTrackingToken:()=> 'synthetic-token'},
   '@/lib/analyticsServeur':{mesureServeur:noEffects,personneServeur:noEffects},
   '@/lib/discord':{alerteDiscord:noEffects},
   './parrainage':{recompenserParrain:noEffects},
   '@/lib/conversionsChatgpt':{envoyerConversionChatgpt:noEffects},
  });
  for(const photos of [[],['https://fixtures.invalid/synthetic-photo.jpg']])for(const express of [false,true]) {
   const order={id:'00000000-0000-4000-8000-000000000001',langue:locale,customer_email:'fixture@example.invalid',currency:'EUR',total_price:1,photo_urls:photos,options:{locale,format:'portrait',people:1,animals:0,printOption:'poster',express}};
   await finaliserCommande(order,'webhook');
   const text=confirmation.html;
   assert.doesNotMatch(text,/On se met au travail|We're getting to work|Nos ponemos manos|machen uns an die Arbeit|Ci mettiamo al lavoro|meteen aan de slag|Bierzemy się do pracy|sätter i gång|går i gang|Vamos já começar/,'confirmation must not imply work already started without photos');
   for(const term of terms[locale].slice(1))assert.match(text,term,`${locale}:photos=${photos.length},express=${express}`);
   assert.match(text,express?/24/:/2/);
   if(!photos.length)assert.match(text,/depot\/synthetic-token/);
   else assert.doesNotMatch(text,/depot\/synthetic-token/);
  }
  const {sendWelcomeStep}=load('lib/welcomeSequence.ts',{
   './db':{markWelcomeStepSent:noEffects},'./emailToken':{signEmail:()=> 'synthetic-token'},
   './analyticsServeur':{mesureServeur:noEffects},'@/lib/envoiEmail':{envoyerEmail:async payload=>{welcome=payload;}},
  });
  await sendWelcomeStep({email:'fixture@example.invalid',locale},1);
  check(welcome.html,locale,`${locale}: welcome before any payment`);
 }
});
test('occasion deadline bullets and FAQ render preview and approval-dependent print promises in all locales',()=>{
 const {OCCASIONS}=load('lib/giftOccasions.ts');
 for(const [locale,occasions] of Object.entries(OCCASIONS)) {
  for(const [key,occasion] of Object.entries(occasions)) {
   const values=[...occasion.bullets,...occasion.faq.map(f=>f.answer)];
   for(const value of values.filter(v=>/\b2\b|\b10\b/.test(v))) {
    check(renderToStaticMarkup(React.createElement('p',null,value)),locale,`${locale}:${key}`);
    assert.doesNotMatch(value,/\b10\b/,`${locale}:${key}: no guaranteed total or fixed customer approval time`);
   }
  }
  check(occasions.noel.bullets[2],locale,`${locale}: Christmas is not instant`);
 }
});
