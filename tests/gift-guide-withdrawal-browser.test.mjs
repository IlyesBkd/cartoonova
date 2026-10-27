import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const root=new URL('..',import.meta.url).pathname;
test('failed Storage deletion stays revoked across tabs and reload; recovery starts a fresh journal',async()=>{
 const bundle=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NEXT_PUBLIC_GIFT_GUIDE_LOCAL_MEASUREMENT':'"1"'},stdin:{resolveDir:root,contents:`import {localGiftGuide} from './lib/giftGuideLocal';import {enregistrerChoixMesure} from './lib/consentementMesure';window.guide=localGiftGuide;window.choose=enregistrerChoixMesure;`}});
 const browser=await chromium.launch({headless:true});try{
  for(const crossTab of [false,true]){
   const context=await browser.newContext();const traffic=[];
   await context.route('**/*',r=>{traffic.push(r.request().url());return r.fulfill({contentType:'text/html',body:'<title>withdrawal</title>'});});
   const a=await context.newPage();await a.goto('http://localhost:41239/');await a.addScriptTag({content:bundle.outputFiles[0].text});
   const old=await a.evaluate(()=>{const j=window.guide.enroll();window.guide.record('viewed');window.guide.attachCheckout('pi_old_secret_SYNTHETIC',window.guide.captureCheckout());return j;});
   await a.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError');};Storage.prototype.removeItem=function(){throw new DOMException('blocked','SecurityError');};});
   await a.evaluate(()=>{window.setOriginal=Storage.prototype.setItem;window.removeOriginal=Storage.prototype.removeItem;Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError');};Storage.prototype.removeItem=function(){throw new DOMException('blocked','SecurityError');};});
   const b=await context.newPage();await b.goto('http://localhost:41239/');await b.addScriptTag({content:bundle.outputFiles[0].text});
   if(crossTab)await b.evaluate(()=>window.choose('denied'));else await a.evaluate(()=>window.choose('denied'));
   await a.waitForFunction(()=>window.guide.export()===null);
   assert.ok(await a.evaluate(()=>sessionStorage.getItem('cartoonova_guide_local_v1')),'failed purge leaves a physical stale copy');
   await a.reload();await a.addScriptTag({content:bundle.outputFiles[0].text});
   await b.evaluate(()=>window.choose('granted'));
   // Explicitly grant locally too, as preferences do after a fail-closed reload.
   await a.evaluate(()=>window.choose('granted'));
   assert.equal(await a.evaluate(()=>window.guide.export()),null,'reload must not resurrect withdrawn data');
   assert.equal(await a.evaluate(()=>window.guide.enroll()),null,'permanent blocked storage cannot collect');
   assert.equal(await a.evaluate(()=>window.guide.export()),null);
   // New document without injected Storage faults, preserving the withdrawal URL marker.
   const url=a.url();const replacement=await context.newPage();await replacement.goto(url);
   const stale=await a.evaluate(()=>sessionStorage.getItem('cartoonova_guide_local_v1'));
   await replacement.evaluate(s=>sessionStorage.setItem('cartoonova_guide_local_v1',s),stale);
   await replacement.addScriptTag({content:bundle.outputFiles[0].text});
   assert.equal(await replacement.evaluate(()=>window.guide.export()),null);
   const fresh=await replacement.evaluate(()=>{window.choose('granted');return window.guide.enroll();});
   assert.notEqual(fresh.sessionId,old.sessionId);assert.deepEqual(fresh.events,[]);assert.deepEqual(fresh.checkouts,[]);
   assert.ok(traffic.every(u=>new URL(u).origin==='http://localhost:41239'),'no journal transport');await context.close();
  }
 }finally{await browser.close();}
});
