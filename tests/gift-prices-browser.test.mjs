import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const grid = base => ({base,fullbodyExtra:5,extraPerson:5,extraAnimal:5,digital:0,canvas:39,poster:59,posterSimple:19,banner:3,extraDecor:5,express:7,carteVoeux:4,calendrier:9,shipping:4.9});
const stubs = {
  'next/image': `export default function Image({priority,fill,...props}){return <img {...props}/>}`,
  'next/link': `export default function Link(props){return <a {...props}/>}`,
  'next/dynamic': `export default ()=>()=>null`,
  '@/hooks/useProductTracking': `export const useProductTracking=()=>new Proxy({},{get:()=>()=>{}})`,
  '@/components/CheckoutModal': `export default ()=>null`,
  '@/lib/uploadClient': `export const uploadImage=()=>{throw Error('uploads forbidden')}`,
  '@/components/DateApercu': `export default ()=>null`,
  '@/components/useLien': `export const useLien=()=>x=>x`,
  '@/lib/useRetourFerme': `export const useRetourFerme=()=>{}`,
  'next/navigation': `export const notFound=()=>{throw Error('not found')}`,
  'next-intl': `export const useLocale=()=> 'fr'; export const useTranslations=()=> (k,v)=>v?.prix?'à partir de '+v.prix:k`,
  'next-intl/server': `export const setRequestLocale=()=>{};export const getTranslations=async()=> (k,v)=>v?.prix?'à partir de '+v.prix:k`,
  '@/lib/lecturesCache': `export const prixEnCache=async c=>{window.serverReads.push(c);if(window.serverFailure)throw Error('offline');return window.serverGrid}`,
  '@/lib/analytics': `export const contexte=()=>{}; export const mesure=()=>{}`,
  '@/components/GiftDeadlineNote': `export default ()=>null`,
  '@/components/JsonLd': `export default ()=>null`,
  '@/lib/visuels': `export const vignetteProduit=()=>null;export const visuelsProduit=()=>({partage:['/fixture.png']})`,
  '@/lib/donneesStructurees': `export const filAriane=()=>({});export const pageWeb=()=>({})`,
  '@/components/structured-data': `export const BreadcrumbJsonLd=()=>null;export const FAQJsonLd=()=>null`,
};
const bundle = await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',
  stdin:{resolveDir:root,loader:'tsx',contents:`import React,{useState} from 'react';import {renderToString} from 'react-dom/server';import Fiche from './app/[locale]/[produit]/FicheProduit';import {createRoot} from 'react-dom/client';import CurrencyProvider,{useCurrency} from './components/CurrencyProvider';import Index from './app/[locale]/cadeau/page';import Occasion from './app/[locale]/cadeau/[slug]/page';import {allGiftSlugs} from './lib/giftOccasions';
function Controls(){const c=useCurrency();window.changeCurrency=c.setCurrency;return <output id="currency">{c.currency}</output>}
(async()=>{const content=window.occasion?await Occasion({params:Promise.resolve({locale:'fr',slug:allGiftSlugs('fr')[0]})}):await Index({params:Promise.resolve({locale:'fr'})});window.beforeHydration=renderToString(<CurrencyProvider locale="fr">{content}</CurrencyProvider>);function App(){const [product,setProduct]=useState(false);return <CurrencyProvider locale="fr"><Controls/><div onClick={e=>{if(e.target.closest('.cta-cadeau a')){e.preventDefault();setProduct(true)}}}>{product?<Fiche prixInitial={window.serverFailure?null:window.serverGrid} donnees={{slug:'fixture',idProduit:'fixture',univers:'Fixture',titre:'Fixture',description:'Fixture',categorieNom:'Fixture',categorieCle:'fixture',personnages:true,galerie:[],legendes:[],decors:[],supports:{digital:'/d.png',posterSimple:'/p.png',canvas:'/c.png',framed:'/f.png'},similaires:[]}}/>:content}</div></CurrencyProvider>}createRoot(document.getElementById('root')).render(<App/>)})();`},
  plugins:[{name:'boundaries',setup(b){b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));b.onResolve({filter:/^\.\/db$/},()=>({path:'db-boundary',namespace:'stubs'}));b.onLoad({filter:/^db-boundary$/,namespace:'stubs'},()=>({contents:'export const getPricesForCurrency=()=>{throw Error("DB forbidden")}',loader:'js'}));b.onResolve({filter:/\/visuels$/},()=>({path:'@/lib/visuels',namespace:'stubs'}));b.onResolve({filter:/./},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'stubs'}:undefined);b.onLoad({filter:/./,namespace:'stubs'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));}}],
});
async function open({currency='GBP',occasion=false,serverFailure=false}={}) {
  const browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(3000);page.on('pageerror',e=>console.error(e.message));const pending=new Map();const requests=[];
  await page.route('https://gifts.invalid/**',route=>{const u=new URL(route.request().url());if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});if(u.pathname==='/api/prices'){const c=u.searchParams.get('currency');requests.push(c);pending.set(c,route);return;}return route.fulfill({status:404,body:''});});
  await page.goto('https://gifts.invalid/');await page.evaluate(options=>{document.cookie='cartoonova_currency='+options.currency+';path=/';window.occasion=options.occasion;window.serverFailure=options.serverFailure;window.serverGrid=options.grid;window.serverReads=[];},{currency,occasion,serverFailure,grid:grid(4.99)});
  await page.clock.install();await page.addScriptTag({content:bundle.outputFiles[0].text});await page.locator('#currency').waitFor();return {browser,page,pending,requests};
}

test('occasion CTA waits for USD grid before linking to the configurator',async()=>{
 const {browser,page,pending}=await open({currency:'USD',occasion:true});try{
  await page.waitForFunction(()=>document.querySelector('#currency').textContent==='USD');
  assert.equal(await page.locator('.cta-cadeau a').count(),0);
  assert.equal(await page.locator('.cta-cadeau [aria-disabled="true"]').count(),1);
  await page.waitForTimeout(30);
  await pending.get('USD').fulfill({json:grid(8.75)});
  await page.locator('.cta-cadeau a').waitFor();
  assert.match(await page.locator('.cta-cadeau').innerText(),/8,75.*\$/);
  assert.match(await page.locator('.cta-cadeau a').getAttribute('href'),/^\/fr\//);
  assert.match(await page.evaluate(()=>document.cookie),/cartoonova_currency=USD/);
  await page.locator('.cta-cadeau a').click();
  await page.waitForTimeout(30);
  assert.equal(await page.locator('.panneau__prix strong').innerText(),'—');
  assert.equal(await page.locator('button.ajouter').isDisabled(),true);
  await pending.get('USD').fulfill({json:grid(8.75)});
  await page.waitForFunction(()=>!document.querySelector('button.ajouter').disabled);
  assert.match(await page.locator('.panneau__prix strong').innerText(),/8,75.*\$/);
  assert.match(await page.locator('.barre-achat__prix').innerText(),/8,75.*\$/);
  assert.equal(await page.locator('#currency').innerText(),'USD');
 }finally{await browser.close();}
});

test('gift cards use the approved GBP grid, not cached euros or an exchange conversion',async()=>{
 const {browser,page,pending,requests}=await open();try{
  await page.waitForFunction(()=>document.querySelector('#currency').textContent==='GBP');
  await page.waitForTimeout(50);
  assert.equal(await page.locator('.carte__prix').first().innerText(),'—');
  assert.deepEqual(requests,['GBP'],'one grid request shared by all cards');
  await pending.get('GBP').fulfill({json:grid(7.25)});
  await page.waitForFunction(()=>document.querySelector('.carte__prix').textContent.includes('7,25'));
  const prices=await page.locator('.carte__prix').allTextContents();assert.ok(prices.length>1);assert.ok(prices.every(p=>p.includes('7,25')&&p.includes('£')));
 }finally{await browser.close();}
});

for(const currency of ['EUR','GBP','USD'])test(`${currency}: all index cards show the same approved grid`,async()=>{
 const {browser,page,pending}=await open({currency});try{
  assert.doesNotMatch(await page.evaluate(()=>window.beforeHydration),/4,99|£|\$/);
  const base=currency==='EUR'?4.99:currency==='GBP'?7.25:8.75;
  if(currency!=='EUR'){await page.waitForTimeout(30);await pending.get(currency).fulfill({json:grid(base)});}
  await page.waitForFunction(()=>document.querySelector('.carte__prix').getAttribute('aria-busy')==='false');
  const prices=await page.locator('.carte__prix').allTextContents();assert.ok(prices.length>1);assert.equal(new Set(prices).size,1);
  assert.match(prices[0],currency==='EUR'?/4,99.*€/:currency==='GBP'?/7,25.*£/:/8,75.*\$/);
 }finally{await browser.close();}
});

for(const currency of ['EUR','GBP','USD']) test(`${currency}: occasion and real configurator agree on the grid and keep visitor currency`,async()=>{
 const {browser,page,pending,requests}=await open({currency,occasion:true});try{
  assert.doesNotMatch(await page.evaluate(()=>window.beforeHydration),/4,99|£|\$/,'no currency price in pre-hydration HTML');
  const base=currency==='EUR'?4.99:currency==='GBP'?7.25:8.75;
  if(currency!=='EUR'){await page.waitForTimeout(30);await pending.get(currency).fulfill({json:grid(base)});}
  await page.locator('.cta-cadeau a').waitFor();
  const advertised=await page.locator('.cta-cadeau [aria-busy]').innerText();
  await page.locator('.cta-cadeau a').click();
  if(currency!=='EUR'){await page.waitForTimeout(30);await pending.get(currency).fulfill({json:grid(base)});}
  await page.waitForFunction(()=>!document.querySelector('button.ajouter').disabled);
  const total=await page.locator('.panneau__prix strong').innerText();
  assert.ok(advertised.endsWith(total));assert.equal(await page.locator('.barre-achat__prix').innerText(),total);
  assert.equal(await page.locator('#currency').innerText(),currency);
  if(currency==='EUR')assert.deepEqual(requests,[],'reuse approved server grid without an API waterfall');
 }finally{await browser.close();}
});

test('rapid GBP → USD → EUR changes ignore a late response and hide mismatched grids',async()=>{
 const {browser,page,pending}=await open({occasion:true});try{
  await page.waitForTimeout(30);await pending.get('GBP').fulfill({json:grid(7.25)});
  await page.locator('.cta-cadeau a').waitFor();
  const usd=page.waitForRequest('**/api/prices?currency=USD');await page.evaluate(()=>window.changeCurrency('USD'));await usd;
  assert.equal(await page.locator('.cta-cadeau a').count(),0);assert.equal(await page.locator('.cta-cadeau [aria-busy]').innerText(),'—');
  await page.evaluate(()=>window.changeCurrency('EUR'));await page.locator('.cta-cadeau a').waitFor();
  await pending.get('USD').fulfill({json:grid(8.75)}).catch(()=>{});
  await page.waitForTimeout(30);assert.match(await page.locator('.cta-cadeau [aria-busy]').innerText(),/4,99.*€/);
 }finally{await browser.close();}
});

for(const failure of ['http','invalid','timeout'])test(`${failure}: no fallback grid, CTA disabled, visible retry recovers`,async()=>{
 const {browser,page,pending}=await open({currency:'USD',occasion:true,serverFailure:true});try{
  await page.waitForTimeout(30);
  if(failure==='timeout'){await page.clock.fastForward(8000);}
  else await pending.get('USD').fulfill(failure==='http'?{status:503,body:''}:{json:{base:8.75}});
  await page.getByRole('alert').waitFor();assert.equal(await page.locator('.cta-cadeau a').count(),0);assert.equal(await page.locator('.cta-cadeau [aria-busy]').innerText(),'—');
  const retry=page.waitForRequest('**/api/prices?currency=USD');await page.getByRole('button',{name:'Réessayer'}).click();await retry;
  await pending.get('USD').fulfill({json:grid(8.75)});await page.locator('.cta-cadeau a').waitFor();
  assert.match(await page.locator('.cta-cadeau [aria-busy]').innerText(),/8,75.*\$/);assert.equal(await page.getByRole('alert').count(),0);
 }finally{await browser.close();}
});
