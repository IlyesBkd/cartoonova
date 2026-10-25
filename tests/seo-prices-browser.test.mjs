import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const stubs = {
  'next/image': `export default function Image({priority,fill,...p}){return <img {...p}/>}`,
  'next/link': `export default function Link(p){return <a {...p}/>}`,
  'next/dynamic': `export default ()=>()=>null`,
  'next/navigation': `export const notFound=()=>{throw Error('not found')};export const permanentRedirect=()=>{throw Error('redirect')}`,
  'next-intl': `export const useLocale=()=>window.locale;export const useTranslations=()=> (k,v)=>v?.prix?k+' '+v.prix:v?.montant?k+' '+v.montant:k`,
  'next-intl/server': `export const setRequestLocale=()=>{};export const getTranslations=async()=> (k)=>k`,
  '@/lib/lecturesCache': `export const prixEnCache=async()=>{if(window.serverFailure)throw Error('offline');return window.serverGrid};export const contenuFicheEnCache=async()=>null;export const statistiquesAvisEnCache=async()=>({nombre:0,moyenne:0})`,
  '@/lib/visuels': `export const visuelsProduit=()=>({partage:[],galerie:[],legendes:[],decors:[],supports:{digital:'/d.png',posterSimple:'/p.png',canvas:'/c.png',framed:'/f.png'}})`,
  '@/lib/reviewsDb': `export const MINIMUM_BALISAGE_AVIS=3`,
  '@/lib/analytics': `export const contexte=()=>{};export const mesure=()=>{}`,
  '@/hooks/useProductTracking': `export const useProductTracking=()=>new Proxy({},{get:()=>()=>{}})`,
  '@/components/CheckoutModal': `export default ()=>null`,
  '@/lib/uploadClient': `export const uploadImage=()=>{throw Error('uploads forbidden')}`,
  '@/components/DateApercu': `export default ()=>null`,
  '@/components/GiftDeadlineNote': `export default ()=>null`,
  '@/components/useLien': `export const useLien=()=>x=>x`,
  '@/lib/useRetourFerme': `export const useRetourFerme=()=>{}`,
  '@stripe/stripe-js': `export const loadStripe=()=>null`,
  '@stripe/react-stripe-js': `export const Elements=()=>null;export const PaymentElement=()=>null;export const useElements=()=>null;export const useStripe=()=>null`,
};
const bundle = await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY':'""'},
 stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {renderToString} from 'react-dom/server';import {hydrateRoot} from 'react-dom/client';import CurrencyProvider,{useCurrency} from './components/CurrencyProvider';import Gift from './app/[locale]/bon-cadeau/page';import Portrait from './app/[locale]/[produit]/page';
 function Controls(){const c=useCurrency();window.changeCurrency=c.setCurrency;return <output id="currency">{c.currency}</output>}
 (async()=>{const content=window.kind==='gift'?await Gift({params:Promise.resolve({locale:window.locale})}):await Portrait({params:Promise.resolve({locale:window.locale,produit:'simpson'})});const app=<CurrencyProvider locale={window.locale}><Controls/>{content}</CurrencyProvider>;window.ssr=renderToString(app);document.getElementById('root').innerHTML=window.ssr;hydrateRoot(document.getElementById('root'),app)})();`},
 plugins:[{name:'local-boundaries',setup(b){b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));b.onResolve({filter:/./},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'stubs'}:undefined);b.onLoad({filter:/./,namespace:'stubs'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));}}],
});
const grid = (base, shipping=4.9) => ({base,fullbodyExtra:5,extraPerson:5,extraAnimal:5,digital:0,canvas:39,poster:59,posterSimple:19,banner:3,extraDecor:5,express:7,carteVoeux:4,calendrier:9,shipping});
async function open({kind='gift',currency,locale='fr',serverFailure=false}={}){
 const browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(4000);const pending=new Map(), errors=[],requests=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
 page.on('console',message=>{if(message.type()==='error'&&/hydrat/i.test(message.text()))errors.push(message.text())});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='https://seo.invalid')return route.abort();if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});if(u.pathname==='/api/prices'){const c=u.searchParams.get('currency');requests.push(c);pending.set(c,route);return;}return route.fulfill({status:404,body:''});});
 await page.goto('https://seo.invalid/');await page.evaluate(o=>{Object.assign(window,o);if(o.currency)document.cookie='cartoonova_currency='+o.currency+';path=/';},{kind,currency,locale,serverFailure,serverGrid:grid(4.99)});
 await page.addScriptTag({content:bundle.outputFiles[0].text});await page.locator('#currency').waitFor();return {browser,page,pending,errors,requests};
}
async function fulfill(pending,currency,response){for(let n=0;!pending.has(currency)&&n<100;n++)await new Promise(r=>setTimeout(r,10));assert.ok(pending.has(currency),'expected local grid request '+currency);const route=pending.get(currency);pending.delete(currency);return route.fulfill(response);}
async function products(page){return page.evaluate(()=>[...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(s=>{const j=JSON.parse(s.textContent);return j['@graph']??[j]}).filter(n=>n['@type']==='Product'));}


const scenarios = [
 {locale:'fr',currency:'EUR',base:4.99,shipping:4.9,denominations:[20,40,60]},
 {locale:'en',currency:'GBP',base:7.25,shipping:6.35,denominations:[20,35,50]},
 {locale:'en',currency:'USD',base:8.75,shipping:8.15,denominations:[20,45,65]},
];
for (const scenario of scenarios) for(const kind of ['gift','portrait']) test(`${kind} ${scenario.currency}: SSR hydration and each real rendered option agree with JSON-LD`,async()=>{
 const {browser,page,pending,errors,requests}=await open({...scenario,kind});try{
  const ssr=await page.evaluate(()=>window.ssr);
  assert.doesNotMatch(ssr,/"@type":"Product"/,'SSR has no currency-specific offers while visible prices are masked');
  assert.match(ssr,/BreadcrumbList/,'keep server breadcrumb markup');
  if(kind==='portrait'&&scenario.currency!=='EUR'){
   await page.waitForFunction(()=>document.querySelector('#currency').textContent===window.currency);
   await fulfill(pending,scenario.currency,{json:grid(scenario.base,scenario.shipping)});
  }
  if(kind==='portrait')await page.waitForFunction(()=>!document.querySelector('button.ajouter').disabled);
  else await page.waitForFunction(()=>document.querySelector('.bon-achat__montants').textContent.trim().length>0);
  const nodes=await products(page);assert.equal(nodes.length,1,'one authoritative Product only');
  const offers=nodes[0].offers;
  assert.ok(offers.every(o=>o.priceCurrency===scenario.currency&&o.shippingDetails.shippingRate.currency===scenario.currency));
  if(kind==='gift'){
   assert.deepEqual(offers.map(o=>o.price),scenario.denominations);
   for(let i=0;i<offers.length;i++){
    const text=await page.locator('.bon-achat__montants button').nth(i).innerText();
    assert.equal(text, new Intl.NumberFormat(scenario.locale,{style:'currency',currency:scenario.currency,maximumFractionDigits:0}).format(offers[i].price) + ` (${scenario.currency})`);
    assert.equal(offers[i].shippingDetails.shippingRate.value,0);
   }
  }else{
   for(let i=0;i<offers.length;i++){
    await page.locator('#etape-support button').nth(i).click();
    const shipping=offers[i].shippingDetails.shippingRate.value;
    assert.equal(shipping,i===0?0:scenario.shipping);
    const expected=new Intl.NumberFormat(scenario.locale,{style:'currency',currency:scenario.currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.round((offers[i].price+shipping)*100)/100);
    assert.equal(await page.locator('.panneau__prix strong').innerText(),expected);
    if(shipping)assert.match(await page.locator('.panneau__port').innerText(),new RegExp(String(shipping).replace('.',scenario.locale==='fr'?',':'.')));
   }
   assert.deepEqual(requests,scenario.currency==='EUR'?[]:[scenario.currency]);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('no-cookie fallback is EUR in fr, GBP in en, never an EUR offer labelled GBP',async()=>{
 for(const locale of ['fr','en']){
  const {browser,page,pending}=await open({locale,kind:'portrait'});try{
   if(locale==='en'){await page.waitForFunction(()=>document.querySelector('#currency').textContent==='GBP');assert.equal((await products(page)).length,0);await fulfill(pending,'GBP',{json:grid(7.25,6.35)});}
   await page.waitForFunction(()=>!document.querySelector('button.ajouter').disabled);
   const [product]=await products(page);assert.equal(product.offers[0].priceCurrency,locale==='fr'?'EUR':'GBP');assert.equal(product.offers[0].price,locale==='fr'?4.99:7.25);
  }finally{await browser.close();}
 }
});

test('portrait currency race removes stale offers, ignores late USD, and publishes no fallback on failure',async()=>{
 const {browser,page,pending}=await open({kind:'portrait'});try{
  await page.waitForFunction(()=>!document.querySelector('button.ajouter').disabled);
  const usd=page.waitForRequest('**/api/prices?currency=USD');await page.evaluate(()=>window.changeCurrency('USD'));await usd;
  assert.equal((await products(page)).length,0);
  const gbp=page.waitForRequest('**/api/prices?currency=GBP');await page.evaluate(()=>window.changeCurrency('GBP'));await gbp;
  await fulfill(pending,'GBP',{json:grid(7.25,6.35)});await page.waitForFunction(()=>!document.querySelector('button.ajouter').disabled);
  await fulfill(pending,'USD',{json:grid(8.75,8.15)}).catch(()=>{});
  assert.equal((await products(page))[0].offers[0].priceCurrency,'GBP');
  const failing=page.waitForRequest('**/api/prices?currency=USD');await page.evaluate(()=>window.changeCurrency('USD'));await failing;
  await fulfill(pending,'USD',{status:503,body:''});await page.getByRole('alert').waitFor();assert.equal((await products(page)).length,0);assert.equal(await page.locator('.panneau__prix strong').innerText(),'—');
  const retry=page.waitForRequest('**/api/prices?currency=USD');await page.getByRole('button',{name:'Réessayer'}).click();await retry;await fulfill(pending,'USD',{json:grid(8.75,8.15)});await page.waitForFunction(()=>!document.querySelector('button.ajouter').disabled);assert.equal((await products(page))[0].offers[0].price,8.75);
 }finally{await browser.close();}
});

test('failed server grid never emits fictitious default offers before a successful local API response',async()=>{
 const {browser,page,pending}=await open({kind:'portrait',serverFailure:true});try{
  assert.equal((await products(page)).length,0);assert.doesNotMatch(await page.evaluate(()=>window.ssr),/"@type":"Product"/);
  await fulfill(pending,'EUR',{json:grid(12.34,9.87)});await page.waitForFunction(()=>!document.querySelector('button.ajouter').disabled);
  assert.equal((await products(page))[0].offers[0].price,12.34);assert.match(await page.locator('.panneau__prix strong').innerText(),/12,34/);
 }finally{await browser.close();}
});

test('gift manual EUR → GBP → USD updates actual denominations and all offer/shipping currencies',async()=>{
 const {browser,page}=await open();try{
  for(const [currency,prices] of [['EUR',[20,40,60]],['GBP',[20,35,50]],['USD',[20,45,65]]]){
   await page.evaluate(c=>window.changeCurrency(c),currency);await page.waitForFunction(c=>document.querySelector('#currency').textContent===c,currency);
   const [product]=await products(page);assert.deepEqual(product.offers.map(o=>o.price),prices);assert.ok(product.offers.every(o=>o.priceCurrency===currency&&o.shippingDetails.shippingRate.currency===currency));
   const texts=await page.locator('.bon-achat__montants button').allTextContents();assert.deepEqual(texts.map(s=>Number(s.match(/\d+/)[0])),prices);
  }
 }finally{await browser.close();}
});

test('GBP portrait: only publish offers from the exact approved grid visible in the real configurator',async()=>{
 const {browser,page,pending,requests}=await open({kind:'portrait',currency:'GBP'});try{
  await page.waitForFunction(()=>document.querySelector('#currency').textContent==='GBP');
  assert.equal(await page.locator('.panneau__prix strong').innerText(),'—');
  assert.equal((await products(page)).length,0,'no misleading EUR offer while GBP grid loads');
  assert.ok(pending.has('GBP'));
  await fulfill(pending,'GBP',{json:grid(7.25,6.35)});
  await page.waitForFunction(()=>!document.querySelector('button.ajouter').disabled);
  assert.match(await page.locator('.panneau__prix strong').innerText(),/7,25.*£/);
  const [product]=await products(page);assert.ok(product);assert.deepEqual(product.offers.map(o=>o.price),[7.25,26.25,46.25,66.25]);
  assert.ok(product.offers.every(o=>o.priceCurrency==='GBP'&&o.shippingDetails.shippingRate.currency==='GBP'));
  assert.deepEqual(product.offers.map(o=>o.shippingDetails.shippingRate.value),[0,6.35,6.35,6.35]);
  assert.deepEqual(requests,['GBP'],'JSON-LD reuses the UI grid, no separate request');
 }finally{await browser.close();}
});

test('GBP gift: real hydrated page JSON-LD prices equal visible denomination buttons',async()=>{
 const {browser,page,errors}=await open({currency:'GBP'});try{
  await page.waitForFunction(()=>document.querySelector('#currency').textContent==='GBP');
  assert.deepEqual((await page.locator('.bon-achat__montants button').allTextContents()).map(s=>s.replace(/\s/g,' ')),['20 £GB (GBP)','35 £GB (GBP)','50 £GB (GBP)']);
  const [product]=await products(page);assert.ok(product);assert.deepEqual(product.offers.map(o=>o.price),[20,35,50]);assert.ok(product.offers.every(o=>o.priceCurrency==='GBP'&&o.shippingDetails.shippingRate.currency==='GBP'&&o.shippingDetails.shippingRate.value===0));assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
