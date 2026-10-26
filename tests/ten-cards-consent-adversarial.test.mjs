import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const root=new URL('..',import.meta.url).pathname;
async function fixture(run,{quota=false,delayed=false,retry=false}={}) {
 const sdk=readFileSync(new URL('../node_modules/posthog-js/dist/array.full.no-external.js',import.meta.url),'utf8');
 const bundle=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env':'{}','process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_POSTHOG_KEY':'"phc_synthetic"'},stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Preferences from './components/CookiePreferences';import * as a from './lib/analytics';import * as c from './lib/consentementMesure';import * as p from './lib/pixelChatgpt';window.api={...a,...c,...p};createRoot(document.getElementById('root')!).render(<Preferences locale="fr"/>);`},plugins:[{name:'real-sdk',setup(b){b.onResolve({filter:/^posthog-js$/},()=>({path:'sdk',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default window.posthog;'}));}}]});
 const browser=await chromium.launch({headless:true});const context=await browser.newContext({userAgent:'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36'});
 const traffic=[];let release;const gate=new Promise(r=>release=r);
 await context.addInitScript(({quota})=>{Object.defineProperty(navigator,'webdriver',{get:()=>false});if(quota){const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){return k==='cartoonova_consent_v1'?'granted':get.call(this,k);};Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError');};}},{quota});
 await context.route('**/*',async r=>{const req=r.request();const u=req.url();if(req.isNavigationRequest()&&u.startsWith('https://consent.invalid/'))return r.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/sdk.js"></script><script src="/app.js"></script>'});if(u==='https://consent.invalid/sdk.js')return r.fulfill({contentType:'text/javascript',body:sdk});if(u==='https://consent.invalid/app.js')return r.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text});if(u.includes('oaiq.min.js')){traffic.push({url:u,body:req.postData()});if(delayed)await gate;return r.fulfill({contentType:'text/javascript',body:`{const q=window.oaiq?.q||[];window.oaiq=(...a)=>fetch('https://pixel.synthetic.invalid/event',{method:'POST',body:JSON.stringify(a)});for(const a of q)window.oaiq(...a);setInterval(()=>fetch('https://pixel.synthetic.invalid/event',{method:'POST',body:'autonomous'}),25);}`}).catch(()=>{});}traffic.push({url:u,body:req.postData()});return r.fulfill({status:retry&&u.includes('/ingest/e/')?503:200,contentType:'application/json',body:'{}'});});
 const page=await context.newPage();await page.goto('https://consent.invalid/fr');await page.waitForFunction(()=>window.api);
 try{await run({page,context,traffic,release});}finally{release();await context.close();await browser.close();}
}
test('CONSENT01 quota refusal overrides readable stale granted and preferences reload',async()=>fixture(async({page})=>{
 await page.evaluate(()=>api.refuserMesure());
 assert.equal(await page.evaluate(()=>api.lireChoixMesure()),'denied');
 await page.getByText('Modifier mes préférences cookies',{exact:true}).click();
 await page.getByRole('button',{name:'Refuser',exact:true}).click();
 await page.reload();await page.waitForFunction(()=>window.api);
 assert.equal(await page.evaluate(()=>api.lireChoixMesure()),'denied');
},{quota:true}));
for (const quota of [false,true]) test(`CONSENT03 disabled pixel never requests a delayed response on accept/withdraw (quota=${quota})`,async()=>fixture(async({page,release,traffic})=>{
 await page.evaluate(()=>{api.accepterMesure();api.mesurerPixelChatgpt('order_created',{amount:4200});});await page.waitForTimeout(100);assert.equal(await page.locator('script[src*="oaiq"]').count(),0);
 const reload=page.waitForEvent('load',{timeout:3000});reload.catch(()=>{});
 const queued=await page.evaluate(()=>{api.refuserMesure();return window.oaiq?.q?.some(a=>a[0]==='init')||false;});
 assert.equal(queued,false,'disabled pixel must never have an init queue');
 await reload;await page.waitForFunction(()=>window.api);release();await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>api.lireChoixMesure()),'denied');
 assert.equal(traffic.filter(x=>x.url.startsWith('https://pixel.synthetic.invalid')).length,0);
},{delayed:true,quota}));
test('CONSENT02 intertab preferences preserve disabled pixel before and after withdrawal',async()=>fixture(async({page,context,traffic})=>{
 await page.evaluate(()=>api.accepterMesure());await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>Object.hasOwn(window,'oaiq')),false,'explicit consent must not create a pixel global');
 assert.equal(await page.locator('script[src*="oaiq"]').count(),0);
 const b=await context.newPage();await b.goto('https://consent.invalid/fr');await b.waitForFunction(()=>window.api);
 await b.getByText('Modifier mes préférences cookies',{exact:true}).click();
 const unloaded=page.waitForEvent('load');await b.getByRole('button',{name:'Refuser',exact:true}).click();await unloaded;await page.waitForFunction(()=>window.api);
 assert.equal(await page.evaluate(()=>api.lireChoixMesure()),'denied');assert.equal(await page.evaluate(()=>window.oaiq),undefined);
 await page.waitForTimeout(150);assert.equal(traffic.filter(x=>x.url.includes('pixel.synthetic.invalid')||x.url.includes('oaiq.min.js')).length,0,'disabled advertising must never transmit');
}));
test('CONSENT03 intertab pending cannot initialize the disabled pixel',async()=>fixture(async({page,context,traffic,release})=>{
 await page.evaluate(()=>api.accepterMesure());await page.waitForTimeout(100);assert.equal(await page.locator('script[src*="oaiq"]').count(),0);
 const b=await context.newPage();await b.goto('https://consent.invalid/fr');await b.waitForFunction(()=>window.api);
 await b.getByText('Modifier mes préférences cookies',{exact:true}).click();
 const unloaded=page.waitForEvent('load');await b.getByRole('button',{name:'Refuser',exact:true}).click();await unloaded;await page.waitForFunction(()=>window.api);release();await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>api.lireChoixMesure()),'denied');assert.equal(traffic.filter(x=>x.url.startsWith('https://pixel.synthetic.invalid')).length,0);
},{delayed:true}));
test('CONSENT02 withdrawal drops already batched real SDK events before delayed transport',async()=>fixture(async({page,traffic})=>{
 await page.evaluate(async()=>{api.enregistrerChoixMesure('granted');api.mesure('page_viewed');await new Promise(r=>setTimeout(r,100));posthog.set_config({disable_compression:true,api_transport:'fetch',opt_out_useragent_filter:true});api.mesure('queued_before_withdrawal',{amount:42});await new Promise(r=>setTimeout(r,20));api.refuserMesure();});
 const count=traffic.length;await page.waitForTimeout(3300);assert.equal(traffic.length,count,'opt-out must also stop already batched SDK transport');
}));
test('CONSENT02 withdrawal discards a nonempty real SDK retry queue without shutdown flushing it',async()=>fixture(async({page,traffic})=>{
 await page.evaluate(async()=>{api.enregistrerChoixMesure('granted');api.mesure('page_viewed');await new Promise(r=>setTimeout(r,100));posthog.set_config({request_batching:false,disable_compression:true,api_transport:'fetch',opt_out_useragent_filter:true});api.mesure('retry_before_withdrawal',{amount:42});});
 await page.waitForFunction(()=>posthog._retryQueue?._queue?.length>0);
 const count=traffic.length;const unloaded=page.waitForEvent('load');await page.evaluate(()=>api.refuserMesure());await unloaded;await page.waitForFunction(()=>window.api);await page.waitForTimeout(3300);
 assert.equal(await page.evaluate(()=>api.lireChoixMesure()),'denied');assert.equal(traffic.length,count,'shutdown and later retry timers must not transmit after withdrawal');
},{retry:true}));
test('CONSENT02 another tab removing the saved choice remains a withdrawal before SDK initialization',async()=>fixture(async({page,context})=>{
 const b=await context.newPage();await b.goto('https://consent.invalid/fr');await b.waitForFunction(()=>window.api);
 await b.evaluate(()=>localStorage.setItem('cartoonova_consent_v1','denied'));
 await page.waitForFunction(()=>api.lireChoixMesure()==='denied');
 await b.evaluate(()=>localStorage.removeItem('cartoonova_consent_v1'));
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>api.lireChoixMesure()),'pending');
}));
test('CONSENT02 default analytics sends real SDK events and another tab pending stops it',async()=>fixture(async({page,context,traffic})=>{
 await page.evaluate(async()=>{api.mesure('page_viewed');await new Promise(r=>setTimeout(r,100));posthog.set_config({request_batching:false,disable_compression:true,api_transport:'fetch',opt_out_useragent_filter:true});api.mesure('consent_before',{amount:42});await new Promise(r=>setTimeout(r,100));});
 assert.ok(traffic.some(x=>{const data=new URLSearchParams(x.body||new URL(x.url).search).get('data');return (data?Buffer.from(data,'base64').toString():x.body||'').includes('consent_before');}),'real SDK commercial transport works under consent: '+JSON.stringify(traffic));
 const b=await context.newPage();await b.goto('https://consent.invalid/fr');await b.waitForFunction(()=>window.api);
 await page.evaluate(()=>window.addEventListener('pagehide',()=>sessionStorage.setItem('observed_optout',String(posthog.has_opted_out_capturing()))));
 const unloaded=page.waitForEvent('load');await b.evaluate(()=>api.enregistrerChoixMesure('pending'));await unloaded;await page.waitForFunction(()=>window.api);
 assert.equal(await page.evaluate(()=>api.lireChoixMesure()),'pending');
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('observed_optout')),'true','active SDK must opt out before it is unloaded');
 assert.equal(await page.evaluate(()=>Boolean(posthog.__loaded)),false,'withdrawal must unload the real SDK, not merely filter events');
 const count=traffic.length;await page.evaluate(()=>api.mesure('after_withdrawal'));await page.waitForTimeout(100);assert.equal(traffic.length,count);
}));
