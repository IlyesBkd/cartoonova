import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const root=new URL('..',import.meta.url).pathname;
const autonomous=`{const send=()=>fetch('https://pixel.synthetic.invalid/event',{method:'POST',body:localStorage.getItem('cartoonova_consent_v1')});window.oaiq=()=>send();send();setInterval(send,25);}`;
async function fixture(run) {
 const bundle=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env':'{}'},stdin:{resolveDir:root,contents:`import * as a from './lib/analytics';import * as c from './lib/consentementMesure';import * as p from './lib/pixelChatgpt';window.api={...a,...c,...p};`}});
 const browser=await chromium.launch({headless:true});const context=await browser.newContext();const traffic=[];let navigations=0;
 await context.route('**/*',async route=>{const req=route.request();const url=req.url();if(req.isNavigationRequest()&&url.startsWith('https://consent.invalid/')){navigations++;if(navigations>1)await new Promise(r=>setTimeout(r,500));return route.fulfill({contentType:'text/html',body:'<button id="refuse" onclick="api.refuserMesure()">Refuse</button><button id="reload" onclick="api.rechargerSansMesure()">Reload</button><script src="/app.js"></script>'});}if(url==='https://consent.invalid/app.js')return route.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text});traffic.push({url,body:req.postData()});return route.fulfill({contentType:'text/javascript',body:url.includes('oaiq.min.js')?autonomous:'{}'});});
 const page=await context.newPage();await page.goto('https://consent.invalid/fr');await page.waitForFunction(()=>window.api);
 try{await run({page,traffic,navigations:()=>navigations});}finally{await context.close();await browser.close();}
}
test('PIXEL-OFF explicit accept never loads or initializes an autonomous advertising SDK',async()=>fixture(async({page,traffic,navigations})=>{
 for(const choice of ['pending','granted','denied','granted']) {
  await page.evaluate(choice=>{if(choice==='granted')api.accepterMesure();else api.enregistrerChoixMesure(choice);api.chargerPixelChatgpt();for(const event of ['page_viewed','contents_viewed','checkout_started','order_created'])api.mesurerPixelChatgpt(event,{email:'private@synthetic.invalid',amount:4200},'event-id');},choice);
  await page.waitForTimeout(150);
  assert.equal(traffic.length,0,choice+': no SDK download or autonomous transport');
  assert.equal(await page.evaluate(()=>Object.hasOwn(window,'oaiq')),false,choice+': no pixel global');
  assert.equal(await page.locator('script[src*="oaiq"]').count(),0);
 }
 assert.equal(navigations(),1,'absent pixel needs no withdrawal reload');
 assert.equal(await page.evaluate(()=>{let calls=0;const vendor=()=>{calls++;};window.oaiq=vendor;api.accepterMesure();api.chargerPixelChatgpt();api.mesurerPixelChatgpt('order_created',{amount:4200});const untouched=window.oaiq===vendor;delete window.oaiq;return untouched&&calls===0;}),true,'compatibility exports must not invoke or replace an existing vendor global');
 // Positive control: the adversarial fixture owns fetch directly, not oaiq.
 await page.addScriptTag({content:autonomous});await page.waitForTimeout(80);const before=traffic.length;
 await page.evaluate(()=>{window.oaiq=()=>{};});await page.waitForTimeout(80);
 assert.ok(traffic.length>before,'detector sees autonomous sends even if oaiq is replaced');
}));
test('PIXEL-OFF refusal remains silent through a slow manual reload and canceled beforeunload',async()=>fixture(async({page,traffic,navigations})=>{
 await page.evaluate(()=>{api.accepterMesure();api.chargerPixelChatgpt();window.addEventListener('beforeunload',event=>{event.preventDefault();event.returnValue='';});});
 await page.click('#refuse');await page.waitForTimeout(150);assert.equal(navigations(),1,'pixel refusal must not request navigation');assert.equal(traffic.length,0);
 let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
 await page.click('#reload');await page.waitForTimeout(100);assert.equal(dialogs,1);assert.equal(traffic.length,0);
 await page.click('#reload');await page.waitForTimeout(100);assert.equal(dialogs,2,'canceled navigation must not permanently latch future reloads');
 page.removeAllListeners('dialog');page.on('dialog',dialog=>dialog.accept());await Promise.all([page.waitForEvent('load'),page.click('#reload')]);await page.waitForFunction(()=>window.api);
 assert.equal(await page.evaluate(()=>api.lireChoixMesure()),'denied');assert.equal(traffic.length,0,'no pixel transport even during 500ms reload');
}));
