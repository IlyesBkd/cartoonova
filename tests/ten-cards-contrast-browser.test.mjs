import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const cache=process.env.CONTRAST_ARTIFACTS || '/home/hermes/.hermes/profiles/cartoonova/cache/ten-cards-local';
const baseline=process.env.CONTRAST_BASELINE;
const stubs={
 'next/image':`export default function Image({priority,fill,...p}){return <img {...p}/>}`,
 'next/link':`export default function Link(p){return <a {...p}/>}`,
 'next/dynamic':`export default ()=>()=>null`,
 'next/navigation':`export const usePathname=()=>'/fr';export const useRouter=()=>({replace:()=>{}})`,
 '@/components/ChatWidget':`export const EVENEMENT_AIDE='test-help'`,
 '@/components/CurrencyProvider':`export const useCurrency=()=>({currency:'EUR',pret:true,format:n=>n+' EUR',formatRaw:n=>n+' EUR',convert:n=>n,setCurrency:()=>{}})`,
 '@/lib/analytics':`export const mesure=()=>{};export const accepterMesure=()=>{};export const refuserMesure=()=>{}`,
 '@/hooks/useProductTracking':`export const useProductTracking=()=>new Proxy({},{get:()=>()=>{}})`,
 '@/components/CheckoutModal':`export default ()=>null`,
 '@/lib/uploadClient':`export const uploadImage=()=>{throw Error('uploads forbidden')}`,
 '@/components/GiftDeadlineNote':`export default ()=>null`,
 '@/components/DateApercu':`export default ()=>null`,
 'stripe':`export default class Stripe {paymentIntents={retrieve:()=>{throw Error('Stripe forbidden')}}}`,
 '@/lib/db':`export const sql=async()=>[]`,
 '@/lib/emailToken':`export const parseBonToken=()=>'SYNTHETIC-GIFT'`,
 '@/lib/bonCadeau':`export const lireBon=async()=>({code:'SYNTHETIC-GIFT',montant:50,solde:50,devise:'EUR',expireLe:'2027-01-01'});export const formatMontant=n=>n+' EUR';export const formatDate=()=> '01/01/2027'`,

};
const bundle=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.STRIPE_SECRET_KEY':JSON.stringify('sk_test_synthetic_never_sent')},
 stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {NextIntlClientProvider} from 'next-intl';
 import Navbar from './components/Navbar';import Accueil from './components/pages/Accueil';import Catalogue from './components/pages/Catalogue';import About from './app/[locale]/a-propos/AProposClient';import Fiche from './app/[locale]/[produit]/FicheProduit';import PageLegale from './components/PageLegale';import BonPage from './app/(hors-langue)/bon/[token]/page';
 import {CATALOGUE_EN_LIGNE,titreProduit,descriptionProduit,universProduit,NOMS_CATEGORIE} from './lib/catalogue';
 const products=CATALOGUE_EN_LIGNE.map(p=>({slug:p.slug,idProduit:p.slug,univers:universProduit(p,'fr'),titre:titreProduit(p,'fr'),description:descriptionProduit(p,'fr'),categorieNom:NOMS_CATEGORIE[p.categorie].fr,categorieCle:p.categorie,personnages:p.personnages,champsPersonnalises:p.champsPersonnalises,galerie:['/fixture.svg'],legendes:['transformation'],decors:[],supports:{digital:'/fixture.svg',posterSimple:'/fixture.svg',canvas:'/fixture.svg',framed:'/fixture.svg'},similaires:[]}));
 const legal={titre:'Document synthétique',intro:'Fixture',sections:[{titre:'Informations',blocs:['[Un lien de support](/contact) et support@cartoonova.com']}]};
 const components={home:<Accueil photoHero='/fixture.svg' prixDepart={4.99}/>,catalogue:<Catalogue produits={CATALOGUE_EN_LIGNE.map(p=>({slug:p.slug,univers:universProduit(p,'fr'),categorie:p.categorie,visuels:['/fixture.svg'],accroche:'Fixture synthétique',nbDecors:0,vedette:false}))} nomsCategorie={Object.fromEntries(Object.entries(NOMS_CATEGORIE).map(([k,v])=>[k,v.fr]))} prixDepart={4.99}/>,about:<About/>,product:<Fiche donnees={products[0]} prixInitial={window.grid}/>,legal:<PageLegale document={legal} avertissement='' locale='fr'/>};
 components.surfaces=<>{['papier','creme','fond','cendre','soleil-pale'].map(token=><div key={token} style={{background:'var(--'+token+')'}}><PageLegale document={legal} avertissement='' locale='fr'/></div>)}</>;
 const root=createRoot(document.getElementById('root'));window.show=async name=>{const child=name==='gift'?await BonPage({params:Promise.resolve({token:'SYNTHETIC'})}):components[name];root.render(<NextIntlClientProvider locale='fr' messages={window.messages}><Navbar/><main data-template={name}>{child}</main></NextIntlClientProvider>)};window.show('home');`},
 plugins:[{name:'isolated-boundaries',setup(b){b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));b.onResolve({filter:/./},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'stubs'}:undefined);b.onLoad({filter:/./,namespace:'stubs'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));}}]});
// Compile the complete real global entry, including preflight and all business sheets.
const css=(await postcss([tailwind({base:root})]).process(await readFile(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')})).css;
const baselineCss=baseline ? ['app/toonjaune.css','app/toonjaune-app.css'].map(f=>execFileSync('git',['show',baseline+':'+f],{cwd:root,encoding:'utf8'})).join('\n') : '';
const axe=await readFile(path.join(root,'node_modules/axe-core/axe.min.js'),'utf8');
const grid={base:4.99,fullbodyExtra:5,extraPerson:5,extraAnimal:5,digital:0,canvas:39,poster:59,posterSimple:19,banner:3,extraDecor:5,express:7,carteVoeux:4,calendrier:9,shipping:4.9};

// Run in Chromium: inherited backgrounds are alpha-composited rather than guessed.
function inventory(){
 const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
 const over=(a,b)=>{const alpha=a[3]??1;return [0,1,2].map(i=>a[i]*alpha+b[i]*(1-alpha)).concat(1)};
 const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 const bg=el=>{const chain=[];for(let n=el;n;n=n.parentElement)chain.unshift(n);return chain.reduce((c,n)=>over(rgb(getComputedStyle(n).backgroundColor),c),[255,255,255,1])};
 return [...document.querySelectorAll('main *, .nav__tout, .nav__vedette__cta, .nav__style__vignette i')].filter(el=>{
  const s=getComputedStyle(el),c=rgb(s.color),r=el.getBoundingClientRect();
  return [...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()) && r.width>0&&r.height>0 && s.visibility!=='hidden' && !el.closest('[aria-hidden="true"]') && c[0]>c[1]*1.15&&c[1]>c[2]*1.3 && (c[3]??1)>0;
 }).map(el=>{const s=getComputedStyle(el),background=bg(el),foreground=over(rgb(s.color),background),size=parseFloat(s.fontSize),weight=parseInt(s.fontWeight),minimum=size>=24||(size>=18.6666667&&weight>=700)?3:4.5;return {selector:el.tagName.toLowerCase()+'.'+String(el.className).trim().replaceAll(' ','.'),text:el.textContent.trim().slice(0,85),color:s.color,background:background.slice(0,3).map(Math.round),size,weight,minimum,ratio:ratio(foreground,background)};});
}
for(const mobile of [false,true])test(`gold text meets WCAG AA on real cream/beige surfaces (${mobile?'mobile':'desktop'})`,async()=>{
 await mkdir(cache,{recursive:true});
 const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
 const page=await context.newPage();const errors=[],external=[],results=[],axeResults=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!=='https://contrast.invalid'){external.push(u.origin);return route.abort();}if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div></html>'});if(/^\/polices\/[\w-]+\.woff2?$/.test(u.pathname))return route.fulfill({body:await readFile(path.join(root,'public',u.pathname)),contentType:'font/woff2'});return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="#f6f0e4"/><circle cx="500" cy="500" r="300" fill="#e9ba3b"/></svg>'});});
 try{
  await page.goto('https://contrast.invalid/');await page.addStyleTag({content:css});if(baseline)await page.addStyleTag({content:baselineCss});
  await page.evaluate(data=>Object.assign(window,data),{messages:JSON.parse(await readFile(path.join(root,'messages/fr.json'),'utf8')),grid});await page.addScriptTag({content:bundle.outputFiles[0].text});await page.addScriptTag({content:axe});
  for(const name of ['home','catalogue','about','product','legal','gift','surfaces']){
   await page.evaluate(name=>window.show(name),name);await page.locator(`[data-template="${name}"]`).waitFor();await page.evaluate(()=>document.fonts.ready);
   await page.evaluate(async()=>{window.scrollTo({top:0,behavior:'instant'});await new Promise(requestAnimationFrame);await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
   const rows=await page.evaluate(inventory);assert.ok(rows.length>0,`${name}: actual gold text found`);
   const decorations=await page.locator('.hiw-background-number,.atout-carte__num').evaluateAll(els=>els.map(el=>({className:el.className,text:el.textContent,hidden:el.getAttribute('aria-hidden')==='true'})));
   results.push({template:name,rows,decorations});
   const audit=await page.evaluate(()=>window.axe.run(document.querySelector('main'),{runOnly:{type:'rule',values:['color-contrast']}}));
   axeResults.push({template:name,violations:audit.violations,incomplete:audit.incomplete.map(i=>({id:i.id,nodes:i.nodes.map(n=>n.target)}))});
   if(['home','product'].includes(name)){
    const target=page.locator(name==='home'?'#styles .chapeau':'.galerie__legende').first();
    if(await target.count())await target.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(cache,`contrast-${baseline?'before':'after'}-${mobile?'mobile':'desktop'}-${name}.png`)});
   }
  }
  // Open actual desktop menu: its small 13.5/14.5px gold links need 4.5, not 3.
  if(!mobile){await page.locator('.nav__declencheur').first().click();await page.locator('.nav__tout').first().waitFor();results.push({template:'navigation-open',rows:(await page.evaluate(inventory)).filter(r=>r.selector.includes('nav__'))});}
  const identity=await page.locator('.entete__grille > .bouton--primaire').evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,color:s.color,shadow:s.boxShadow}});
  assert.equal(identity.background,'rgb(233, 186, 59)');assert.equal(identity.color,'rgb(42, 37, 82)');assert.match(identity.shadow,/212, 163, 42/);
  assert.deepEqual(errors,[],'no browser runtime errors');assert.deepEqual(external,[],'no external transport');
  await writeFile(path.join(cache,`contrast-${baseline?'before':'after'}-${mobile?'mobile':'desktop'}.json`),JSON.stringify({mobile,baseline:baseline||null,results,axeResults,identity,errors,external},null,2));
  const failures=results.flatMap(r=>r.rows.filter(x=>x.ratio<x.minimum).map(x=>({...x,template:r.template})));
  assert.deepEqual(failures,[],`gold text failures: ${JSON.stringify(failures)}`);
  // Other non-gold contrast issues stay visible in the report, never silently called AA.
  const relevant=axeResults.flatMap(r=>r.violations.flatMap(v=>v.nodes.filter(n=>/accent|prose|nav__tout|nav__vedette__cta/.test(JSON.stringify(n.target))).map(n=>({template:r.template,target:n.target,summary:n.failureSummary}))));
  assert.deepEqual(relevant,[],'axe has no pertinent gold text violation');
  assert.deepEqual(results.flatMap(r=>(r.decorations||[]).filter(d=>!d.hidden).map(d=>({template:r.template,...d}))),[],'decorative numbers must be hidden by their component owner');
 }finally{await context.close();await browser.close();}
});
