import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator,NextIntlClientProvider} from 'next-intl';
import ts from 'typescript';
import {chromium} from 'playwright';
import {createMetadataElements} from 'next/dist/lib/metadata/metadata-elements.js';
import {resolveTitle} from 'next/dist/lib/metadata/resolvers/resolve-title.js';
const root=path.resolve(import.meta.dirname,'..');
export function load(file,replacements={},cache=new Map()) {file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;const m=new Module(file);m.filename=file;cache.set(file,m);const req=createRequire(file);m.require=n=>{if(n in replacements)return replacements[n];if(n.endsWith('.css'))return {};if(n.startsWith('@/')||n.startsWith('.')){const b=n.startsWith('@/')?path.resolve(root,n.slice(2)):path.resolve(path.dirname(file),n);for(const e of ['.ts','.tsx'])if(existsSync(b+e))return load(b+e,replacements,cache);}return req(n);};m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);return m.exports;}
export const locales=['fr','en','de','es','it','nl','pl','sv','da','pt'];
export const messages=Object.fromEntries(locales.map(l=>[l,JSON.parse(readFileSync(path.join(root,'messages',l+'.json'),'utf8'))]));
export const tr=(locale,namespace)=>createTranslator({locale,messages:messages[locale],namespace,onError:e=>{throw e;}});
export const wrap=(l,e)=>renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:l,messages:messages[l],timeZone:'UTC'},e));
test('legal notices and privacy render actual explicit consent policy in ten languages',()=>{
 const {PAGES_LEGALES}=load('lib/legal/index.ts');
 const {COOKIE_CONSENT}=load('lib/i18n/cookieConsent.ts');
 const disabled={fr:/désactivé et n’est pas chargé, même après accord/,en:/disabled and is not loaded, even with consent/,de:/deaktiviert und wird auch mit Einwilligung nicht geladen/,es:/desactivado y no se carga, incluso con consentimiento/,it:/disattivato e non viene caricato, nemmeno con il consenso/,nl:/uitgeschakeld en wordt ook met toestemming niet geladen/,pl:/wyłączony i nie jest ładowany, nawet po wyrażeniu zgody/,sv:/inaktiverad och laddas inte, även med samtycke/,da:/deaktiveret og indlæses ikke, heller ikke med samtykke/,pt:/desativado e não é carregado, mesmo com consentimento/};
 assert.deepEqual(Object.keys(COOKIE_CONSENT).sort(),[...locales].sort());
 for(const locale of locales) {assert.match(COOKIE_CONSENT[locale].notice,disabled[locale],locale+' disabled pixel policy');assert.match(COOKIE_CONSENT[locale].notice,/PostHog/);}

 const {default:Legal}=load('components/PageLegale.tsx',{'next/link':({children,...p})=>React.createElement('a',p,children)});
 for(const locale of locales)for(const doc of ['mentions','confidentialite']) {
 const html=renderToStaticMarkup(React.createElement(Legal,{document:PAGES_LEGALES[locale][doc],locale,avertissement:''}));
 assert.ok(html.includes(COOKIE_CONSENT[locale].notice),locale+':'+doc+' explicit policy');assert.doesNotMatch(html,/Google Analytics/);
 }
});
test('style promises use actual published catalogue count through next-intl in ten locales',()=>{
 const count=load('lib/catalogue.ts').CATALOGUE_EN_LIGNE.length;
 for(const locale of locales)for(const key of ['tj.catalogueTitre','tj.stylesTous','tj.navTousStyles','metaPages.bonCadeau.description']) {
 const value=tr(locale)(key,{count});assert.ok(value.includes(String(count)),locale+':'+key+' '+value);
 assert.ok(tr(locale)(key,{count:count+2}).includes(String(count+2)),key+' is driven by catalogue, not hardcoded');
 }
});
test('collections metadata describes personalized cartoon portraits in every locale',async()=>{
 const words={fr:/portrait cartoon personnalisé/i,en:/custom cartoon portrait/i,de:/personalisierte Cartoon-Porträts/i,es:/retratos cartoon personalizados/i,it:/ritratti cartoon personalizzati/i,nl:/persoonlijke cartoonportretten/i,pl:/personalizowane portrety cartoon/i,sv:/personliga cartoonporträtt/i,da:/personlige cartoonportrætter/i,pt:/retratos cartoon personalizados/i};
 const browser=await chromium.launch({headless:true});
 try {const tab=await browser.newPage();await tab.route('**/*',r=>r.abort());
 for(const locale of locales) {
 const page=load('app/[locale]/collections/page.tsx',{'next-intl/server':{getTranslations:async({locale,namespace})=>tr(locale,namespace)},'@/components/pages/Catalogue':{default:()=>null},'@/lib/lecturesCache':{prixEnCache:async()=>({base:5})}});
 const meta=await page.generateMetadata({params:Promise.resolve({locale})});assert.match(typeof meta.title==='string'?meta.title:meta.title.absolute,words[locale]);
 const title=resolveTitle(meta.title,null).absolute;
 const head=renderToStaticMarkup(React.createElement(React.Fragment,null,...createMetadataElements({title,description:meta.description})));
 await tab.setContent('<html lang="'+locale+'"><head>'+head+'</head><body></body></html>');
 assert.match(await tab.title(),words[locale]);assert.equal(await tab.locator('head title').count(),1);
 }
 }finally {await browser.close();}
});
test('published catalogue heading and gift metadata/JSON-LD render the same catalogue count',async()=>{
 const catalogue=load('lib/catalogue.ts');const count=catalogue.CATALOGUE_EN_LIGNE.length;
 const {default:Catalogue}=load('components/pages/Catalogue.tsx',{'next/image':({alt})=>React.createElement('img',{alt}), 'next/link':({children,...p})=>React.createElement('a',p,children),'@/components/useLien':{useLien:()=>p=>p},'@/components/CurrencyProvider':{useCurrency:()=>({format:n=>String(n)})},'@/lib/analytics':{mesure:()=>{}}});
 for(const locale of locales) {
 const nomsCategorie=Object.fromEntries(catalogue.CATEGORIES.map(c=>[c,catalogue.NOMS_CATEGORIE[c][locale]]));
 const produits=catalogue.CATALOGUE_EN_LIGNE.map(p=>({slug:p.slug,univers:catalogue.universProduit(p,locale),categorie:p.categorie,visuels:[],accroche:'synthetic',nbDecors:0,vedette:false}));
 const html=wrap(locale,React.createElement(Catalogue,{produits,nomsCategorie,prixDepart:5}));assert.ok(html.includes(tr(locale,'tj')('catalogueTitre',{count})),locale+' heading');
 const gift=load('app/[locale]/bon-cadeau/page.tsx',{'next-intl/server':{getTranslations:async({locale,namespace})=>tr(locale,namespace)},'./BonCadeauClient':()=>null,'@/components/BonCadeauJsonLd':({produit})=>React.createElement('script',{type:'application/ld+json',dangerouslySetInnerHTML:{__html:JSON.stringify(produit)}})});
 const props={params:Promise.resolve({locale})};const meta=await gift.generateMetadata(props);assert.ok(meta.description.includes(String(count)));
 const body=renderToStaticMarkup(await gift.default(props));assert.ok(body.includes(tr(locale,'metaPages.bonCadeau')('description',{count})),locale+' gift JSON-LD');
 }
});
test('tracking trusts payment milestones and only offers eligible client actions',async()=>{
 const base={id:'synthetic123',status:'PAID',paid_at:'2026-10-01',langue:'fr',created_at:'2026-10-01',customer_email:'fixture@example.org',currency:'EUR',total_price:'42.50',options:{format:'fullbody',people:1,animals:0,printOption:'digital'},photo_urls:[],poster_confirmation_sent_at:null,poster_confirmation_status:null,poster_confirmation_token:null,final_image_sent_at:null,expedie_le:null};
 const render=async order=>{
  const {default:Page}=load('app/(hors-langue)/suivi/[token]/page.tsx',{'next-intl/server':{getTranslations:async({locale,namespace})=>tr(locale,namespace)},'@/lib/db':{getOrderById:async()=>order},'@/lib/emailToken':{parseOrderTrackingToken:()=>order.id},'@/lib/analyticsServeur':{mesureServeur:async()=>{}}});
  return renderToStaticMarkup(await Page({params:Promise.resolve({token:'synthetic'})}));
 };
 assert.doesNotMatch(await render({...base,paid_at:null}),/fixture@example.org|href="\/depot\//,'editable PAID status cannot expose an unpaid order');
 assert.match(await render({...base,status:'PENDING'}),/href="\/depot\//,'paid order retains access despite admin label');
 assert.doesNotMatch(await render({...base,final_image_sent_at:'2026-10-02'}),/href="\/depot\//,'delivered order cannot offer initial photo deposit');
 assert.doesNotMatch(await render({...base,poster_confirmation_sent_at:'2026-10-02',poster_confirmation_token:'old'}),/href="\/(?:depot|confirm-poster)\//,'stale preview cannot offer an action');
});
test('tracking renders translated framing, supports and locale currency in ten languages',async()=>{
 const {formatPrice}=load('lib/currency.ts');
 for(const locale of locales)for(const support of ['digital','canvas','posterSimple','framed'])for(const amount of ['19.98','5.00']) {
 const order={id:'synthetic123',status:'PAID',paid_at:'2026-10-01',langue:locale,created_at:'2026-10-01',customer_email:'fixture@example.org',currency:locale==='en'?'GBP':'EUR',total_price:amount,options:{format:'fullbody',people:1,animals:0,printOption:support},photo_urls:[]};
 const {default:Page}=load('app/(hors-langue)/suivi/[token]/page.tsx',{'next-intl/server':{getTranslations:async({locale,namespace})=>tr(locale,namespace)},'@/lib/db':{getOrderById:async()=>order},'@/lib/emailToken':{parseOrderTrackingToken:()=>order.id},'@/lib/analyticsServeur':{mesureServeur:async()=>{}}});
 const html=renderToStaticMarkup(await Page({params:Promise.resolve({token:'synthetic'})}));
 assert.ok(html.includes(tr(locale,'product')('fullbodyLabel')),locale+' fullbody label');
 assert.ok(html.includes(tr(locale,'product')(support==='framed'?'poster':support==='posterSimple'?'posterOption':support)),locale+' support');
 assert.ok(html.includes(formatPrice(Number(amount),order.currency,locale)),locale+' currency');
 assert.doesNotMatch(html,/>fullbody<|>digital<|>framed<|>posterSimple</);
 }
});
