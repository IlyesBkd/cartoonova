import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
const root=new URL('..',import.meta.url).pathname;
test('real guide renders local control without guide and guided arm with separate visibility/click events',async()=>{
 const stubs={'next-intl':`export const useLocale=()=> 'fr';`,'next/image':`export default function Image({fill,preload,...p}){return <img {...p}/>}`,'next/link':`export default function Link(p){return <a {...p}/>}`,'@/lib/analytics':`export const mesure=()=>{};`,'./GiftPricing':`export const GiftExampleTotal=()=> '10 EUR';export const GiftConfiguratorLink=p=><a {...p}/>;`};
 const result=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NEXT_PUBLIC_GIFT_GUIDE_LOCAL_MEASUREMENT':'"1"'},stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Guide from './app/[locale]/cadeau/GiftGuide';import {localGiftGuide} from './lib/giftGuideLocal';window.guide=localGiftGuide;createRoot(document.getElementById('root')).render(<Guide/>);`},plugins:[{name:'boundaries',setup(b){b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));b.onResolve({filter:/./},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'stub'}:undefined);b.onLoad({filter:/./,namespace:'stub'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));}}]});
 const browser=await chromium.launch({headless:true});try{
 for(const cohort of ['control','guided-v1']){
 const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<title>local guide</title><div style="height:2000px">Before guide</div><div id="root"></div>'}));await page.goto('http://localhost:41239/');
 await page.evaluate(cohort=>sessionStorage.setItem('cartoonova_guide_local_v1',JSON.stringify({version:1,sessionId:'00000000-0000-4000-8000-000000000003',consent:true,cohort,events:[],checkouts:[]})),cohort);
 await page.addScriptTag({content:result.outputFiles[0].text});
 if(cohort==='control'){await page.waitForTimeout(100);assert.equal(await page.locator('section').count(),0);assert.deepEqual((await page.evaluate(()=>window.guide.export())).events,[]);}
 else{await page.locator('section').waitFor();await page.waitForFunction(()=>window.guide.export().events.includes('viewed'));assert.deepEqual((await page.evaluate(()=>window.guide.export())).events,['viewed']);await page.locator('section').scrollIntoViewIfNeeded();await page.waitForFunction(()=>window.guide.export().events.includes('exposed'));await page.evaluate(()=>document.addEventListener('click',e=>e.preventDefault()));await page.locator('a[href$="#configurateur"]').click();assert.deepEqual((await page.evaluate(()=>window.guide.export())).events,['viewed','exposed','clicked']);}
 await page.close();
 }
 }finally{await browser.close();}
 const checkout=await readFile(new URL('../components/CheckoutModal.tsx',import.meta.url),'utf8');assert.match(checkout,/localGiftGuide\.attachCheckout\(data\.clientSecret, guideSession\)/);
});
test('browser fixture without a process global or compiled flag stays outside the local protocol',async()=>{
 const bundle=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',stdin:{resolveDir:root,contents:`import {localGiftGuide,localGiftGuideEnabled} from './lib/giftGuideLocal';window.guide=localGiftGuide;window.enabled=localGiftGuideEnabled;`}});
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<title>uncompiled</title>'}));await page.goto('http://localhost:41239/');assert.equal(await page.evaluate(()=>typeof process),'undefined');await page.addScriptTag({content:bundle.outputFiles[0].text});assert.deepEqual(errors,[]);
  assert.deepEqual(await page.evaluate(()=>({enabled:window.enabled(),journal:window.guide.enroll(),stored:sessionStorage.length,hook:typeof window.cartoonovaGiftGuideExport})),{enabled:false,journal:null,stored:0,hook:'undefined'});
 }finally{await browser.close();}
});
test('disabled local flag creates no session and exposes no export hook even on localhost',async()=>{
 const bundle=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NEXT_PUBLIC_GIFT_GUIDE_LOCAL_MEASUREMENT':'"0"'},stdin:{resolveDir:root,contents:`import {localGiftGuide} from './lib/giftGuideLocal';window.guide=localGiftGuide;`}});
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<title>disabled</title>'}));await page.goto('http://localhost:41239/');await page.addScriptTag({content:bundle.outputFiles[0].text});
  assert.deepEqual(await page.evaluate(()=>({journal:window.guide.enroll(),stored:sessionStorage.length,hook:typeof window.cartoonovaGiftGuideExport})),{journal:null,stored:0,hook:'undefined'});
 }finally{await browser.close();}
});
test('real browser storage: localhost-only flag, stable cohort, cross-tab refusal and zero outbound transport',async()=>{
 const bundle=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NEXT_PUBLIC_GIFT_GUIDE_LOCAL_MEASUREMENT':'"1"'},stdin:{resolveDir:root,contents:`import {localGiftGuide} from './lib/giftGuideLocal';window.guide=localGiftGuide;`}});
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext();const traffic=[];
  await context.route('**/*',r=>{traffic.push(r.request().url());return r.fulfill({contentType:'text/html',body:'<title>local fixture</title>'});});
  const a=await context.newPage();await a.goto('http://localhost:41239/');await a.addScriptTag({content:bundle.outputFiles[0].text});
  await a.evaluate(()=>{window.location.hash='configurateur';});
  const first=await a.evaluate(()=>window.guide.enroll());assert.ok(['control','guided-v1'].includes(first.cohort));
  assert.equal(await a.evaluate(()=>window.location.hash),'#configurateur','ordinary journal writes must preserve navigation anchors');
  await a.reload();await a.addScriptTag({content:bundle.outputFiles[0].text});assert.deepEqual(await a.evaluate(()=>window.guide.enroll()),first);
  await a.evaluate(()=>window.guide.attachCheckout('pi_browser_secret_SYNTHETICONLY',window.guide.captureCheckout()));
  assert.equal((await a.evaluate(()=>window.guide.export())).checkouts[0].paymentIntentId,'pi_browser');
  const b=await context.newPage();await b.goto('http://localhost:41239/');
  await b.evaluate(()=>localStorage.setItem('cartoonova_consent_v1','denied'));
  await a.waitForFunction(()=>sessionStorage.getItem('cartoonova_guide_local_v1')===null);
  assert.equal(await a.evaluate(()=>window.guide.export()),null);
  await a.evaluate(()=>window.guide.attachCheckout('pi_late_secret_SYNTHETICONLY',window.guide.captureCheckout()));assert.equal(await a.evaluate(()=>window.guide.export()),null);
  const remote=await context.newPage();await remote.goto('https://public.invalid/');await remote.addScriptTag({content:bundle.outputFiles[0].text});
  assert.equal(await remote.evaluate(()=>window.guide.enroll()),null);
  assert.ok(traffic.every(u=>u==='http://localhost:41239/'||u==='https://public.invalid/'),'journal emitted no request');
 }finally{await browser.close();}
});
