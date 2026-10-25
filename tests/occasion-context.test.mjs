import assert from 'node:assert/strict';
import {test, mock, beforeEach, afterEach} from 'node:test';
import {readFileSync, existsSync} from 'node:fs';
import {createRequire, Module} from 'node:module';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextIntlClientProvider, createTranslator} from 'next-intl';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
process.env.TZ='UTC';
function load(file,replacements={},cache=new Map()) {
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;
 const m=new Module(file);m.filename=file;cache.set(file,m);const req=createRequire(file);
 m.require=name=>{
  if(name in replacements)return replacements[name];
  if(name.endsWith('.css'))return {};
  if(name.startsWith('.')||name.startsWith('@/')) {
   const base=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(file),name);
   for(const ext of ['.ts','.tsx'])if(existsSync(base+ext))return load(base+ext,replacements,cache);
  }
  return req(name);
 };
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);return m.exports;
}
const locales=['fr','en','de','es','it','nl','pl','sv','da','pt'];
const messages=Object.fromEntries(locales.map(l=>[l,JSON.parse(readFileSync(path.join(root,'messages',l+'.json'),'utf8'))]));
const clientReact={...React,useSyncExternalStore:(_s,snapshot)=>snapshot()};
const wrap=(locale,element)=>renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:messages[locale],timeZone:'UTC'},element));
beforeEach(()=>mock.timers.enable({apis:['Date'],now:new Date('2026-10-23T12:00:00Z')}));
afterEach(()=>mock.timers.reset());
test('occasion deadline never borrows another seasonal campaign in ten languages',()=>{
 const {default:Note}=load('components/GiftDeadlineNote.tsx',{react:clientReact});
 for(const locale of locales)for(const occasion of ['noel','saint-valentin','fete-des-meres','anniversaire','mariage','depart']) {
  const html=wrap(locale,React.createElement(Note,{occasion}));
  assert.doesNotMatch(html,/Halloween/,`${locale}:${occasion}`);
  assert.match(html,/2/,`${locale}:${occasion} keeps the conditional standard preview`);
 }
});
test('deadline notes distinguish preview from print approval, production and destination in every phase',()=>{
 const {default:Note}=load('components/GiftDeadlineNote.tsx',{react:clientReact});
 for(const date of ['2026-10-23T12:00:00Z','2026-12-01T12:00:00Z','2026-12-21T12:00:00Z','2026-12-24T12:00:00Z']) {
  mock.timers.setTime(Date.parse(date));
  for(const locale of locales) {
   const html=wrap(locale,React.createElement(Note,{occasion:'noel'}));
   const expected=renderToStaticMarkup(React.createElement('span',null,messages[locale].faq.a1)).replace(/^<span>|<\/span>$/g,'');
   assert.ok(html.includes(expected),`${locale}:${date} retains exact conditional preview and destination-qualified print terms`);
  }
 }
});
test('Christmas gift certificate copy describes payment and emailed voucher, not an instant portrait',async()=>{
 for(const locale of locales) {
  const {default:Noel}=load('app/[locale]/noel/page.tsx',{
   'next/link':{__esModule:true,default:Link},'next/image':{__esModule:true,default:Image},
   'next-intl/server':{setRequestLocale:()=>{},getTranslations:async({locale,namespace})=>serverTranslations(locale,namespace)},
  });
  const html=wrap(locale,await Noel({params:Promise.resolve({locale})}));
  const expected=renderToStaticMarkup(React.createElement('span',null,messages[locale].bonCadeau.etape1+' '+messages[locale].bonCadeau.etape2)).replace(/^<span>|<\/span>$/g,'');
  assert.ok(html.includes(expected),locale+' gift payment then email');
  assert.ok(html.includes(`href="/${locale}/bon-cadeau"`));
 }
});
const Link=({href,children,...props})=>React.createElement('a',{href,...props},children);
const Image=({src,alt})=>React.createElement('img',{src,alt});
function serverTranslations(locale,namespace) {return createTranslator({locale,messages:messages[locale],namespace});}
function giftPage() {
 return load('app/[locale]/cadeau/[slug]/page.tsx',{
  react:clientReact,'next/link':{__esModule:true,default:Link},'next/image':{__esModule:true,default:Image},
  'next/navigation':{notFound:()=>{throw new Error('404');}},
  'next-intl/server':{setRequestLocale:()=>{},getTranslations:async({locale,namespace})=>serverTranslations(locale,namespace)},
  '@/lib/lecturesCache':{prixEnCache:async()=>null},
  '../GiftPricing':{GiftPricingProvider:({children})=>children,GiftStartingPrice:()=>null,GiftConfiguratorLink:Link},
 });
}
test('rendered occasion pages wire their occasion and expose contextual trust links in ten languages',async()=>{
 for(const locale of locales) {
  const {buildGiftSlug}=load('lib/giftOccasions.ts');
  const {GIFT_PRODUCTS}=load('lib/productFeed.ts');
  const slug=buildGiftSlug(locale,GIFT_PRODUCTS[0].slug,'noel');
  const html=wrap(locale,await giftPage(locale).default({params:Promise.resolve({locale,slug})}));
  assert.doesNotMatch(html,/Halloween/);
  for(const target of ['a-propos','portfolio','bon-cadeau'])assert.ok(html.includes(`href="/${locale}/${target}"`),`${locale} links ${target}`);
 }
});
test('last-minute Christmas FAQ never implies an uncompleted digital portrait can be gifted immediately',()=>{
 const {OCCASIONS}=load('lib/giftOccasions.ts');
 for(const locale of locales) {
  const answer=OCCASIONS[locale].noel.faq[1].answer;
  assert.match(answer,/2/,locale+' keeps standard preview delay');
 }
});
test('all 360 rendered gift pages form valid locale-preserving links to occasions, styles and trust pages',async()=>{
 const {buildGiftSlug,parseGiftSlug,OCCASION_KEYS}=load('lib/giftOccasions.ts');
 const {GIFT_PRODUCTS}=load('lib/productFeed.ts');
 const rendered=new Map();
 for(const locale of locales) {
  const page=giftPage(locale);
  for(const product of GIFT_PRODUCTS)for(const occasion of OCCASION_KEYS) {
   const slug=buildGiftSlug(locale,product.slug,occasion);
   const html=wrap(locale,await page.default({params:Promise.resolve({locale,slug})}));
   assert.doesNotMatch(html,/Halloween|MISSING_MESSAGE|INVALID_MESSAGE|undefined/);
   const links=[...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m=>m[1]);
   for(const target of ['a-propos','portfolio'])assert.ok(links.includes(`/${locale}/${target}`));
   for(const href of links) {
    assert.ok(href.startsWith(`/${locale}`),href);
    if(href.includes('/cadeau/'))assert.ok(parseGiftSlug(locale,href.split('/').at(-1)),href);
    else assert.ok(href===`/${locale}` || GIFT_PRODUCTS.some(p=>href===`/${locale}/${p.slugs[locale]}`) || ['a-propos','portfolio','bon-cadeau','portrait-personnalise-cartoon'].some(p=>href===`/${locale}/${p}`),href);
   }
   rendered.set(`/${locale}/cadeau/${slug}`,links);
  }
 }
 assert.equal(rendered.size,360);
 for(const links of rendered.values())for(const href of links.filter(h=>h.includes('/cadeau/')))assert.ok(rendered.has(href),href+' rendered target exists');
});
test('seasonal cutoffs keep the existing conservative business-day calendar and expire without stale cache',()=>{
 const {dateEvenement,getOrderByDate,getDigitalOrderByDate}=load('lib/evenements.ts');
 assert.equal(getOrderByDate(dateEvenement('noel','fr',2026)).toISOString(),'2026-12-11T23:59:59.999Z');
 assert.equal(getDigitalOrderByDate(dateEvenement('noel','fr',2026)).toISOString(),'2026-12-22T23:59:59.999Z');
 const {default:Note}=load('components/GiftDeadlineNote.tsx',{react:clientReact});
 for(const [date,seasonal] of [['2026-12-11T12:00:00Z',true],['2026-12-12T12:00:00Z',true],['2026-12-22T23:59:59Z',true],['2026-12-23T00:00:00Z',false],['2027-01-01T12:00:00Z',false]]) {
  mock.timers.setTime(Date.parse(date));
  const html=wrap('en',React.createElement(Note,{occasion:'noel'}));
  assert.equal(html.includes('Christmas'),seasonal,date);
  if(date.startsWith('2026-12-11'))assert.match(html,/December 11/);
  if(date.startsWith('2026-12-12')) {assert.match(html,/December 22/);assert.doesNotMatch(html,/December 11/);}
 }
 for(const locale of locales) {
  const target=dateEvenement('feteDesMeres',locale,2026);
  mock.timers.setTime(new Date(target.getTime()-20*86400000).getTime());
  const html=wrap(locale,React.createElement(Note,{occasion:'fete-des-meres'}));
  const event=messages[locale].gift.event_feteDesMeres;
  assert.ok(html.includes(renderToStaticMarkup(React.createElement('span',null,event)).replace(/^<span>|<\/span>$/g,'')),locale);
 }
});
test('new trust destinations render real localized page bodies and self-canonical metadata',async()=>{
 for(const locale of locales)for(const route of ['a-propos','portfolio']) {
  const page=load(`app/[locale]/${route}/page.tsx`,{
   'next/link':{__esModule:true,default:Link},'next/image':{__esModule:true,default:Image},
   'next-intl/server':{getTranslations:async({locale,namespace})=>serverTranslations(locale,namespace)},
  });
  const html=wrap(locale,await page.default({params:Promise.resolve({locale})}));
  assert.match(html,/<h1>/);assert.doesNotMatch(html,/MISSING_MESSAGE|INVALID_MESSAGE/);
  const metadata=await page.generateMetadata({params:Promise.resolve({locale})});
  assert.ok(metadata.alternates.canonical.endsWith(`/${locale}/${route}`));
 }
});
test('occasion routes suppress unrelated global seasonal promo while ordinary product routes retain it',()=>{
 const render=(pathname)=>{
  const {default:Shell}=load('components/LayoutShell.tsx',{
   react:{...React,useEffect:()=>{}},'next/navigation':{usePathname:()=>pathname},
   'next/dynamic':{__esModule:true,default:()=>()=>null},
   '@/lib/origineVisite':{capturerOrigine:()=>{}},
   '@/components/Navbar':{__esModule:true,default:({evenement})=>React.createElement('div',{'data-campaign':evenement?.cle??'neutral'})},
   '@/components/FooterCartoon':{__esModule:true,default:()=>null},
  });
  return renderToStaticMarkup(React.createElement(Shell,{evenement:{cle:'halloween',dateLimite:'28 October',phase:'numerique'}},'body'));
 };
 for(const locale of locales)for(const route of ['noel','cadeau/style-occasion','bon-cadeau'])assert.match(render(`/${locale}/${route}`),/data-campaign="neutral"/);
 assert.match(render('/fr/simpson'),/data-campaign="halloween"/);
});
test('rendered footer reaches real about and portfolio routes in all locales and the French SEO landing',()=>{
 const {default:Footer}=load('components/FooterCartoon.tsx',{
  'next/link':{__esModule:true,default:Link},'next/image':{__esModule:true,default:Image},
  '@/components/NewsletterForm':{__esModule:true,default:()=>null},
 });
 for(const locale of locales) {
  const html=wrap(locale,React.createElement(Footer));
  for(const route of ['a-propos','portfolio']) {
   assert.ok(html.includes(`href="/${locale}/${route}"`),`${locale}/${route} reachable`);
   assert.ok(existsSync(path.join(root,'app/[locale]',route,'page.tsx')));
  }
  assert.equal(html.includes('href="/fr/portrait-personnalise-cartoon"'),locale==='fr');
 }
 assert.ok(existsSync(path.join(root,'app/[locale]/portrait-personnalise-cartoon/page.tsx')));
});
