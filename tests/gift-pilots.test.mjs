import assert from 'node:assert/strict';
import {test, mock, beforeEach, afterEach} from 'node:test';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {chromium} from 'playwright';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
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
const Link=({href,children,...props})=>React.createElement('a',{href,...props},children);
const Image=({src,alt})=>React.createElement('img',{src,alt});
function serverTranslations(locale,namespace) {return createTranslator({locale,messages:messages[locale],namespace});}
function giftPage(realImage=false) {
 return load('app/[locale]/cadeau/[slug]/page.tsx',{
  react:clientReact,'next/link':{__esModule:true,default:Link},'next/image':{__esModule:true,default:realImage?createRequire(import.meta.url)('next/image').default:Image},
  'next/navigation':{notFound:()=>{throw new Error('404');}},
  'next-intl/server':{setRequestLocale:()=>{},getTranslations:async({locale,namespace})=>serverTranslations(locale,namespace)},
  '@/lib/lecturesCache':{prixEnCache:async()=>null},
  '../GiftPricing':{GiftPricingProvider:({children})=>children,GiftStartingPrice:()=>null,GiftConfiguratorLink:Link},
 });
}

beforeEach(()=>mock.timers.enable({apis:['Date'],now:new Date('2026-10-23T12:00:00Z')}));
afterEach(()=>mock.timers.reset());
const styles=['simpson','onepiece','dbz','ghibli','disney','rickandmorty'];
test('six French birthday pilots render differentiated practical composition guidance',async()=>{
 const page=giftPage(); const sections=[];
 for(const style of styles) {
  const html=wrap('fr',await page.default({params:Promise.resolve({locale:'fr',slug:style+'-anniversaire'})}));
  assert.match(html,/data-gift-pilot=/,style+' needs practical pilot guidance');
  assert.match(html,/Conseils photo/); assert.match(html,/Choisir le décor/);
  assert.match(html,/Suggestion de composition/); assert.match(html,/pas un témoignage/);
  sections.push(html.match(/<section[^>]*data-gift-pilot=[\s\S]*?<\/section>/)[0]);
 }
 assert.equal(new Set(sections).size,6);
});

test('six real page bodies and Next images display in isolated Chromium at mobile and desktop sizes',async()=>{
 mock.timers.reset();
 const css=await postcss([tailwind()]).process(readFileSync(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')});
 const browser=await chromium.launch({headless:true});
 try {
  const component=giftPage(true);
  for(const width of [390,1280])for(const style of styles) {
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    const asset=url.pathname==='/_next/image'?url.searchParams.get('url'):url.pathname;
    if(asset) {
     const file=path.resolve(root,'public','.'+decodeURIComponent(asset.split('?')[0]));
     if(file.startsWith(path.join(root,'public')+path.sep)&&existsSync(file))return route.fulfill({path:file});
    }
    await route.abort();
   });
   const html=wrap('fr',await component.default({params:Promise.resolve({locale:'fr',slug:style+'-anniversaire'})}));
   await page.setContent('<!doctype html><html lang="fr"><head><base href="https://gift-pilots.invalid/"><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css.css+'</style></head><body>'+html+'</body></html>');
   const guide=page.locator('[data-gift-pilot]');
   assert.equal(await guide.getAttribute('data-gift-pilot'),style);
   assert.equal(await guide.locator('h3').count(),3);
   assert.ok(await guide.isVisible());
   await page.locator('figure img').evaluate(async img=>{await img.decode();});
   assert.ok(await page.locator('figure img').evaluate(img=>img.naturalWidth>0));
   assert.equal(await page.locator('figcaption').isVisible(),true);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),style+' no horizontal overflow at '+width);
   for(const detail of await page.locator('details').all()) {
    await detail.locator('summary').click();
    assert.equal(await detail.locator('p').isVisible(),true);
   }
   await page.close();
  }
 } finally {await browser.close();}
});


test('360 metadata and static params stay identical; all 354 non-pilot rendered bodies stay identical',async()=>{
 const baseline=JSON.parse(readFileSync(path.join(root,'tests/gift-pilots-baseline.json'),'utf8'));
 const page=giftPage(); const {allGiftSlugs}=load('lib/giftOccasions.ts');
 assert.deepEqual(page.generateStaticParams(),baseline.params);
 const digest=v=>createHash('sha256').update(v).digest('hex');
 let metadataCount=0,bodyCount=0;
 for(const locale of locales)for(const slug of allGiftSlugs(locale)) {
  const key=locale+'/'+slug,params=Promise.resolve({locale,slug});
  assert.equal(digest(JSON.stringify(await page.generateMetadata({params}))),baseline.metadata[key],key+' exact metadata incl canonical/hreflang'); metadataCount++;
  if(key in baseline.nonPilots) {
   const html=wrap(locale,await page.default({params}));
   assert.equal(digest(html),baseline.nonPilots[key],key+' exact unchanged body'); bodyCount++;
   assert.doesNotMatch(html,/data-gift-pilot|Préparer ton cadeau d’anniversaire/);
  }
 }
 assert.equal(metadataCount,360); assert.equal(bodyCount,354);
});
test('six pilots have unique guidance and FAQ text, existing decoded images and honest captions',async()=>{
 const {giftPilot}=load('lib/giftPilots.ts'); const {GIFT_PRODUCTS}=load('lib/productFeed.ts');
 const {visuelsProduit}=load('lib/visuels.ts');
 assert.equal(visuelsProduit('dbz').decors.length,8);
 for(const style of styles) {
  const decors=visuelsProduit(style).decors;
  if(!['simpson','dbz'].includes(style))assert.equal(decors.length,0,style+' does not sell a predefined scenery selector');
  for(const decor of decors)assert.ok(existsSync(path.join(root,'public',decodeURIComponent(decor.src.split('?')[0]))),decor.src);
 }
 const page=giftPage(),fields=['intro','photo','decor','composition','imageAlt','imageCaption'];
 const pilots=styles.map(s=>giftPilot('fr',s,'anniversaire'));
 for(const field of fields)assert.equal(new Set(pilots.map(p=>p[field])).size,6,field);
 assert.equal(new Set(pilots.flatMap(p=>p.faq.map(f=>f.question))).size,12);
 assert.equal(new Set(pilots.flatMap(p=>p.faq.map(f=>f.answer))).size,12);
 assert.equal(giftPilot('fr','unknown','anniversaire'),null);
 for(const style of styles) {
  const product=GIFT_PRODUCTS.find(p=>p.slug===style),pilot=giftPilot('fr',style,'anniversaire');
  const file=path.join(root,'public',decodeURIComponent(product.image.split('?')[0]));
  assert.ok(existsSync(file));await sharp(file).raw().toBuffer();
  const html=wrap('fr',await page.default({params:Promise.resolve({locale:'fr',slug:style+'-anniversaire'})}));
  assert.ok(html.includes('src="'+product.image+'"'));
  assert.match(html,/<figcaption[^>]*>Illustration existante du catalogue\./);
  assert.match(html,/ne documente pas un anniversaire réel/);
  for(const field of fields) {
   const text=renderToStaticMarkup(React.createElement('span',null,pilot[field])).slice(6,-7);
   assert.ok(html.includes(text),style+': '+field+' actually rendered');
  }
 }
});
test('pilot visible FAQ equals JSON-LD exactly and preserves birthday delay and group answers',async()=>{
 const {OCCASIONS}=load('lib/giftOccasions.ts');const {giftPilot}=load('lib/giftPilots.ts');const page=giftPage();
 for(const style of styles) {
  const html=wrap('fr',await page.default({params:Promise.resolve({locale:'fr',slug:style+'-anniversaire'})}));
  const schemas=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  const faq=schemas.find(s=>s['@type']==='FAQPage');
  const expected=[...OCCASIONS.fr.anniversaire.faq,...giftPilot('fr',style,'anniversaire').faq];
  assert.equal(faq.mainEntity.length,4);
  assert.deepEqual(faq.mainEntity.map(f=>({question:f.name,answer:f.acceptedAnswer.text})),expected);
  for(const item of expected)for(const value of [item.question,item.answer]) {
   const text=renderToStaticMarkup(React.createElement('span',null,value)).slice(6,-7);
   assert.ok(html.includes(text),style+' FAQ visible matches JSON-LD');
  }
  assert.equal((html.match(/<h1 /g)||[]).length,1);
  assert.match(html,/2 jours ouvrés après réception du paiement et des photos/);
  assert.ok(html.includes('href="/fr/'+style+'"'));
  for(const target of ['bon-cadeau','portfolio','a-propos'])assert.ok(html.includes('href="/fr/'+target+'"'));
  assert.doesNotMatch(html,/Halloween|undefined|MISSING_MESSAGE|INVALID_MESSAGE/);
 }
});

