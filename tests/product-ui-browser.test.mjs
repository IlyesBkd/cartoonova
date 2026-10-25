import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const locales = ['fr','en','es','de','it','nl','pl','sv','da','pt'];
const stubs = {
  'next/image': `export default function Image({priority,fill,...p}) {return <img {...p}/>}`,
  'next/link': `export default function Link(p) {return <a {...p}/>}`,
  'next/dynamic': `export default ()=>()=>null`,
  'next/navigation': `export const usePathname=()=>'/'+window.locale;export const useRouter=()=>({replace:()=>{}})`,
  '@/components/ChatWidget': `export const EVENEMENT_AIDE='test-help'`,
  '@/components/CurrencyProvider': `import {useSyncExternalStore} from 'react';let ready=false;const listeners=new Set();window.readyPrices=()=>{ready=true;listeners.forEach(f=>f())};export const useCurrency=()=>({currency:'EUR',pret:useSyncExternalStore(f=>{listeners.add(f);return()=>listeners.delete(f)},()=>ready,()=>false),formatRaw:n=>n+' EUR',setCurrency:()=>{}})`,
  '@/lib/analytics': `export const mesure=()=>{}`,
  '@/hooks/useProductTracking': `export const useProductTracking=()=>new Proxy({},{get:()=>()=>{}})`,
  '@/components/CheckoutModal': `export default ()=>null`,
  '@/lib/uploadClient': `export const uploadImage=()=>{throw Error('uploads forbidden')}`,
  '@/components/GiftDeadlineNote': `export default ()=>null`,
  '@/components/DateApercu': `export default ()=>null`,
};
const bundle = await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',
 stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {renderToString} from 'react-dom/server';import {NextIntlClientProvider} from 'next-intl';import Navbar from './components/Navbar';import Fiche from './app/[locale]/[produit]/FicheProduit';import {CATALOGUE_EN_LIGNE,titreProduit,descriptionProduit,universProduit,NOMS_CATEGORIE} from './lib/catalogue';
 window.catalogue=CATALOGUE_EN_LIGNE.map(p=>({slug:p.slug,idProduit:p.slug,univers:universProduit(p,window.locale),titre:titreProduit(p,window.locale),description:descriptionProduit(p,window.locale),categorieNom:NOMS_CATEGORIE[p.categorie][window.locale],categorieCle:p.categorie,personnages:p.personnages,champsPersonnalises:p.champsPersonnalises,galerie:['/fixture.svg'],legendes:[null],decors:[],supports:{digital:'/fixture.svg',posterSimple:'/fixture.svg',canvas:'/fixture.svg',framed:'/fixture.svg'},similaires:[]}));
 const app=(i)=><NextIntlClientProvider locale={window.locale} messages={window.messages}><Navbar/><Fiche key={i} donnees={window.catalogue[i]} prixInitial={window.grid}/></NextIntlClientProvider>;
 window.ssr=renderToString(app(0));const root=createRoot(document.getElementById('root'));window.showProduct=i=>root.render(app(i));window.showProduct(0);`},
 plugins:[{name:'local-boundaries',setup(b){
 if(process.env.PRODUCT_UI_BASELINE)b.onLoad({filter:/FicheProduit\.tsx$/},()=>({contents:execFileSync('git',['show',process.env.PRODUCT_UI_BASELINE+':app/[locale]/[produit]/FicheProduit.tsx'],{cwd:root,encoding:'utf8'}),loader:'tsx',resolveDir:path.join(root,'app/[locale]/[produit]')}));
 b.onResolve({filter:/./},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'stubs'}:undefined);
 b.onLoad({filter:/./,namespace:'stubs'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));
 b.onLoad({filter:/\.css$/},async a=>({contents:`document.head.appendChild(Object.assign(document.createElement('style'),{textContent:${JSON.stringify(await readFile(a.path,'utf8'))}}))`,loader:'js'}));
 }}]});
const css=(await postcss([tailwind()]).process(await readFile(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')})).css;
const grid={base:4.99,fullbodyExtra:5,extraPerson:5,extraAnimal:5,digital:0,canvas:39,poster:59,posterSimple:19,banner:3,extraDecor:5,express:7,carteVoeux:4,calendrier:9,shipping:4.9};
async function mount(browser,locale='fr',mobile=false){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage();page.setDefaultTimeout(1800);const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='https://product.invalid'){external.push(u.origin);return route.abort();}if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>'});if(u.pathname.endsWith('.svg'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="#ffe89c"/></svg>'});return route.fulfill({status:404,body:''});});
 await page.goto('https://product.invalid/');await page.addStyleTag({content:css});
 const messages=JSON.parse(await readFile(path.join(root,'messages',locale+'.json'),'utf8'));
 await page.evaluate(data=>Object.assign(window,data),{locale,messages,grid});await page.addScriptTag({content:bundle.outputFiles[0].text});await page.locator('.galerie__loupe').waitFor();
 return {context,page,messages,errors,external};
}

const supportActions={fr:'Modifier le support',en:'Change format',es:'Cambiar el soporte',de:'Format ändern',it:'Modifica il supporto',nl:'Formaat wijzigen',pl:'Zmień format',sv:'Ändra format',da:'Skift format',pt:'Alterar o suporte'};
for(const locale of locales)test(`support recap has translated text and explicit accessible name from SSR through selection (${locale})`,async()=>{
 const browser=await chromium.launch({headless:true});try{const {context,page,messages,errors,external}=await mount(browser,locale);try{
 const recap=page.locator('[data-cta="recap_support"]');
 const initial=await page.evaluate(()=>{const doc=new DOMParser().parseFromString(window.ssr,'text/html');const el=doc.querySelector('[data-cta="recap_support"]');return {text:el.textContent,name:el.getAttribute('aria-label')};});
 assert.equal(initial.text,messages.product.digital,'server render never has an empty support');
 assert.equal(initial.name,`${supportActions[locale]} : ${messages.product.digital}`);
 assert.equal(await recap.innerText(),messages.product.digital,'waiting for prices keeps a translated label');
 await page.evaluate(()=>window.readyPrices());await page.waitForFunction(()=>!document.querySelector('button.ajouter').disabled);
 for(const [index,key] of ['digital','posterOption','canvas','poster'].entries()){
  await page.locator('#etape-support button.vignette').nth(index).click();
  assert.equal(await recap.innerText(),messages.product[key]);
  assert.equal(await recap.getAttribute('aria-label'),`${supportActions[locale]} : ${messages.product[key]}`);
  assert.equal(await page.getByRole('button',{name:`${supportActions[locale]} : ${messages.product[key]}`,exact:true}).count(),1,'browser accessible name includes selected support');
 }
 await recap.click();await page.waitForFunction(()=>{const el=document.getElementById('etape-support');return el.getBoundingClientRect().top<innerHeight;});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 }finally{await context.close();}}finally{await browser.close();}
});

for(const locale of locales)for(const mobile of [false,true])test(`zoom keyboard focus, Escape, Back and background lock (${locale}/${mobile?'mobile':'desktop'})`,async()=>{
 const browser=await chromium.launch({headless:true});try{const {context,page,errors}=await mount(browser,locale,mobile);try{
 const opener=page.locator('.galerie__loupe');await opener.focus();await page.keyboard.press('Enter');
 const close=page.locator('.agrandissement__fermer');await close.waitFor();
 assert.equal(await close.evaluate(el=>document.activeElement===el),true,'opening focuses the close control');
 for(const key of ['Tab','Shift+Tab']){await page.keyboard.press(key);assert.equal(await close.evaluate(el=>document.activeElement===el),true,'focus cannot reach page behind zoom');}
 assert.equal(await page.locator('body').evaluate(el=>el.style.overflow),'hidden');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.agrandissement'));
 assert.equal(await opener.evaluate(el=>document.activeElement===el),true,'Escape returns focus');
 assert.equal(await page.locator('body').evaluate(el=>el.style.overflow),'');
 await opener.click();await close.waitFor();await close.click();await page.waitForFunction(()=>!document.querySelector('.agrandissement'));assert.equal(await opener.evaluate(el=>document.activeElement===el),true,'close returns focus');
 await opener.click();await close.waitFor();await page.goBack();await page.waitForFunction(()=>!document.querySelector('.agrandissement'));assert.equal(await opener.evaluate(el=>document.activeElement===el),true,'Back returns focus');
 assert.deepEqual(errors,[]);
 }finally{await context.close();}}finally{await browser.close();}
});

for(const mobile of [false,true])test(`zoom real ${mobile?'mobile tap':'desktop click'} above Navbar: 35 products x ten languages`,async()=>{
 const browser=await chromium.launch({headless:true});const results=[];
 try{
  // Five isolated contexts at once keep the exhaustive matrix bounded.
  for(let offset=0;offset<locales.length;offset+=5)await Promise.all(locales.slice(offset,offset+5).map(async locale=>{
   const {context,page,messages,errors,external}=await mount(browser,locale,mobile);try{
    const catalogue=await page.evaluate(()=>window.catalogue.map(p=>p.slug));assert.equal(catalogue.length,35);let passed=0;
    for(let i=0;i<catalogue.length;i++){
     await page.evaluate(i=>window.showProduct(i),i);await page.waitForFunction(slug=>document.querySelector('.fil b')?.textContent===window.catalogue.find(p=>p.slug===slug).titre,catalogue[i]);

     const opener=page.locator('.galerie__loupe');if(mobile)await opener.tap();else await opener.click();const close=page.locator('.agrandissement__fermer');await close.waitFor();
     assert.equal(await close.getAttribute('aria-label'),messages.tj.fermer);
     assert.equal(await close.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,`${locale}/${catalogue[i]}: close above header and banner`);
     assert.equal(await close.evaluate(el=>document.activeElement===el),true,`${locale}/${catalogue[i]}: close focused`);
     if(mobile)await close.tap();else await close.click();await page.waitForFunction(()=>!document.querySelector('.agrandissement'));passed++;
     assert.equal(await page.locator('[data-cta="recap_support"]').innerText(),messages.product.digital);
     assert.equal(await page.locator('[data-cta="recap_support"]').getAttribute('aria-label'),`${supportActions[locale]} : ${messages.product.digital}`);
    }
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);results.push({locale,mobile,passed,total:catalogue.length});
   }finally{await context.close();}
  }));
  results.sort((a,b)=>a.locale.localeCompare(b.locale));assert.equal(results.reduce((n,r)=>n+r.passed,0),350);console.log(JSON.stringify({case:'catalogue-real-close',results}));
 }finally{await browser.close();}
});
