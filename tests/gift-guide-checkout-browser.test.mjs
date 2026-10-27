import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const root=new URL('..',import.meta.url).pathname;
test('real CheckoutModal preparation links only accepted current response; withdrawal during fetch prevents attachment',async()=>{
 const stubs={
  'next-intl':`export const useLocale=()=> 'fr';export const useTranslations=()=>Object.assign(k=>k,{rich:k=>k});`,
  '@/components/CurrencyProvider':`export const useCurrency=()=>({currency:'EUR',formatRaw:n=>n+' EUR'});`,
  '@/lib/analytics':`export const mesure=()=>{};export const identifier=()=>{};`,
  '@stripe/stripe-js':`export const loadStripe=()=>Promise.resolve(null);`,
  '@stripe/react-stripe-js':`export const Elements=p=>p.children;export const PaymentElement=()=>null;export const ExpressCheckoutElement=()=>null;export const useStripe=()=>null;export const useElements=()=>null;`,
 };
 const result=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env':'{}','process.env.NEXT_PUBLIC_GIFT_GUIDE_LOCAL_MEASUREMENT':'"1"','process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY':'"pk_test_synthetic"'},stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Checkout from './components/CheckoutModal';import {localGiftGuide} from './lib/giftGuideLocal';import {enregistrerChoixMesure} from './lib/consentementMesure';window.choose=enregistrerChoixMesure;window.guide=localGiftGuide;localGiftGuide.enroll();createRoot(document.getElementById('root')).render(<Checkout open={true} onClose={()=>{}} orderConfig={{format:'portrait',people:1,animals:0,background:'white',printOption:'Digital',printKey:'digital',banner:false,extraDecor:false,extraDecorKey:null,express:false,shipping:0,total:30,description:'',photoUrls:[],style:'simpson'}}/>);`},plugins:[{name:'boundaries',setup(b){b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));b.onResolve({filter:/./},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'stub'}:undefined);b.onLoad({filter:/./,namespace:'stub'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));}}]});
 const browser=await chromium.launch({headless:true});try{
  for(const mode of ['unchanged','withdrawn','regrant','no-journal','blocked-storage']){
   const page=await browser.newPage();page.setDefaultTimeout(4000);const errors=[];page.on('pageerror',e=>errors.push(e.message));let pending;
   await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname==='/api/checkout'){pending=r;return;}if(u.pathname==='/')return r.fulfill({contentType:'text/html',body:'<html lang="fr"><title>Local checkout</title><div id="root"></div></html>'});throw Error('Unexpected transport '+u.pathname);});
   await page.goto('http://localhost:41239/');
   await page.evaluate(mode=>{crypto.getRandomValues=a=>{a[0]=0xffffffff;return a;};if(mode==='no-journal')localStorage.setItem('cartoonova_consent_v1','denied');if(mode==='blocked-storage'){Storage.prototype.setItem=Storage.prototype.removeItem=function(){throw new DOMException('blocked','SecurityError');};}},mode);
   await page.addScriptTag({content:result.outputFiles[0].text});
   await page.waitForFunction(()=>document.querySelector('[role="dialog"]')).catch(e=>{throw Error(e.message+' '+JSON.stringify(errors));});
   for(let i=0;i<100&&!pending;i++)await page.waitForTimeout(10);
   assert.ok(pending,JSON.stringify(errors));
   const initial=await page.evaluate(()=>window.guide.export());
   if(mode==='withdrawn'||mode==='regrant')await page.evaluate(()=>window.choose('denied'));
   if(mode==='regrant'||mode==='no-journal'){
    const next=await page.evaluate(()=>{crypto.getRandomValues=a=>{a[0]=0;return a;};window.choose('granted');return window.guide.enroll();});
    assert.equal(next.cohort,'control');assert.notEqual(next.sessionId,initial?.sessionId);
    if(mode==='regrant')assert.equal(initial.cohort,'guided-v1');else assert.equal(initial,null);
   }
   await pending.fulfill({json:{clientSecret:'pi_modal_secret_SYNTHETICONLY',total:30,currency:'EUR',promoCode:null}});
   if(mode==='unchanged'){await page.waitForFunction(()=>window.guide.export()?.checkouts.length===1);const j=await page.evaluate(()=>window.guide.export());assert.deepEqual(j.checkouts,[{paymentIntentId:'pi_modal'}]);assert.ok(!JSON.stringify(j).includes('SYNTHETICONLY'));}
   else{await page.waitForTimeout(150);const j=await page.evaluate(()=>window.guide.export());if(mode==='withdrawn'||mode==='blocked-storage')assert.equal(j,null);else assert.deepEqual(j.checkouts,[],`${mode}: old response cannot attach to a new journal`);}
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();}
});
