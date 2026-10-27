import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const root=new URL('..',import.meta.url).pathname;
const KEY='cartoonova_guide_local_v1';
const NAME='existing target / accents é & #configurateur';
async function bundle(flag='1') {
 return (await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NEXT_PUBLIC_GIFT_GUIDE_LOCAL_MEASUREMENT':JSON.stringify(flag)},stdin:{resolveDir:root,contents:`import {localGiftGuide} from './lib/giftGuideLocal';import {enregistrerChoixMesure} from './lib/consentementMesure';window.guide=localGiftGuide;window.choose=enregistrerChoixMesure;`}})).outputFiles[0].text;
}
function blockStorage(){
 const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
 window.restoreStorage=()=>{Storage.prototype.setItem=set;Storage.prototype.removeItem=remove;};
 Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError');};
 Storage.prototype.removeItem=function(){throw new DOMException('blocked','SecurityError');};
}
async function fixture(browser,code,host='localhost'){
 const context=await browser.newContext(),traffic=[];
 await context.route('**/*',r=>{const u=new URL(r.request().url());traffic.push(u.href);if(u.origin!==`http://${host}:41239`)throw Error('Unexpected transport '+u.origin);return r.fulfill({contentType:u.pathname==='/fixture.js'?'text/javascript':'text/html',body:u.pathname==='/fixture.js'?code:`<title>navigation</title><a id="internal" href="/fr/simpson#configurateur">internal</a><a id="anchor" href="#configurateur">old anchor</a>${u.pathname==='/seed'?'':'<script src="/fixture.js"></script>'}`});});
 return {context,traffic};
}
for(const navigation of ['internal','old-anchor'])test(`blocked writes: withdrawal then ${navigation} and reload cannot resurrect before/after grant`,async()=>{
 const browser=await chromium.launch({headless:true});try{
  const {context,traffic}=await fixture(browser,await bundle());
  const a=await context.newPage();await a.goto('http://localhost:41239/seed');await a.evaluate(n=>{window.name=n;},NAME);await a.goto('http://localhost:41239/fr/cadeau#ancienne-ancre');
  const old=await a.evaluate(()=>{const j=window.guide.enroll();window.guide.attachCheckout('pi_old_secret_SYNTHETIC',window.guide.captureCheckout());return j;});assert.ok(old);
  const stale=await a.evaluate(k=>sessionStorage.getItem(k),KEY);assert.equal(JSON.parse(stale).checkouts[0].paymentIntentId,'pi_old');
  await a.addInitScript(blockStorage);await a.evaluate(blockStorage);
  await a.evaluate(()=>window.choose('denied'));assert.equal(await a.evaluate(()=>window.guide.export()),null);
  assert.equal(await a.evaluate(k=>sessionStorage.getItem(k),KEY),stale,'physical old copy remains readable');
  await a.reload();await a.waitForFunction(()=>!!window.guide);
  assert.equal(await a.evaluate(()=>window.guide.export()),null,'controlled reload with original markers stays safe');
  if(navigation==='internal'){
   await a.locator('#internal').click();await a.waitForFunction(()=>!!window.guide);
   assert.equal(await a.evaluate(()=>window.guide.export()),null,'new internal-navigation document is safe before any extra reload');
  }else await a.locator('#anchor').click();
  await a.reload();await a.waitForFunction(()=>!!window.guide);
  assert.equal(await a.evaluate(()=>window.guide.export()),null,'no old journal even before renewed agreement');
  assert.equal(await a.evaluate(()=>window.guide.captureCheckout()),null);
  await a.evaluate(()=>window.choose('granted'));
  assert.equal(await a.evaluate(()=>window.guide.export()),null,'grant cannot resurrect stale session');
  assert.equal(await a.evaluate(()=>window.guide.enroll()),null,'blocked durable write cannot allocate');
  assert.equal(await a.evaluate(()=>window.guide.export()),null);
  const revokedName=await a.evaluate(()=>window.name);assert.ok(revokedName.startsWith(NAME));assert.notEqual(revokedName,NAME);assert.ok(!revokedName.includes(old.sessionId));assert.ok(!revokedName.includes('pi_old'));
  await a.reload();await a.waitForFunction(()=>!!window.guide);assert.equal(await a.evaluate(()=>window.guide.export()),null);
  const fresh=await a.evaluate(()=>{window.restoreStorage();window.choose('granted');return window.guide.enroll();});
  assert.ok(fresh);assert.notEqual(fresh.sessionId,old.sessionId);assert.deepEqual(fresh.events,[]);assert.deepEqual(fresh.checkouts,[]);
  assert.equal(await a.evaluate(()=>window.name),NAME,'successful durable fresh write restores exact original name');
  await a.reload();await a.waitForFunction(()=>!!window.guide);assert.deepEqual(await a.evaluate(()=>window.guide.export()),fresh);
  assert.ok(traffic.every(u=>new URL(u).origin==='http://localhost:41239'),'zero external transport');await context.close();
 }finally{await browser.close();}
});
test('real storage refusal across two tabs persists independently through navigation and one-tab recovery',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const {context}=await fixture(browser,await bundle());const a=await context.newPage(),b=await context.newPage();
  for(const [page,name] of [[a,NAME],[b,'other existing target']]){await page.goto('http://localhost:41239/seed');await page.evaluate(n=>{window.name=n;},name);await page.goto('http://localhost:41239/fr/cadeau');}
  const old=await a.evaluate(()=>{const j=window.guide.enroll();window.guide.attachCheckout('pi_old_secret_SYNTHETIC',window.guide.captureCheckout());return j;});
  await b.evaluate(()=>window.guide.enroll());
  await a.addInitScript(blockStorage);await a.evaluate(blockStorage);
  await b.evaluate(()=>window.choose('denied'));
  await a.waitForFunction(()=>window.name.includes('[cartoonova-guide-revoked:v1]'));
  assert.equal(await a.evaluate(()=>window.guide.export()),null);
  assert.ok(await a.evaluate(k=>sessionStorage.getItem(k),KEY));
  const freshB=await b.evaluate(()=>{window.choose('granted');return window.guide.enroll();});assert.ok(freshB);
  assert.equal(await b.evaluate(()=>window.name),'other existing target');
  assert.notEqual(await a.evaluate(()=>window.name),NAME,'clearing B never clears A tombstone');
  await a.locator('#internal').click();await a.reload();await a.waitForFunction(()=>!!window.guide);
  assert.equal(await a.evaluate(()=>window.guide.export()),null);
  await a.evaluate(()=>window.choose('granted'));assert.equal(await a.evaluate(()=>window.guide.enroll()),null);
  const freshA=await a.evaluate(()=>{window.restoreStorage();return window.guide.enroll();});assert.ok(freshA);assert.notEqual(freshA.sessionId,old.sessionId);assert.deepEqual(freshA.checkouts,[]);
  assert.equal(await a.evaluate(()=>window.name),NAME);assert.equal(await b.evaluate(()=>window.name),'other existing target');
  await context.close();
 }finally{await browser.close();}
});
for(const mode of ['throw-get','throw-set','ignore-set'])test(`window.name ${mode} fails closed even with a readable valid journal`,async()=>{
 const browser=await chromium.launch({headless:true});try{
  const {context}=await fixture(browser,await bundle());const page=await context.newPage();
  await page.goto('http://localhost:41239/seed');
  await page.evaluate(k=>{sessionStorage.setItem(k,JSON.stringify({version:1,sessionId:'00000000-0000-4000-8000-000000000003',consent:true,cohort:'guided-v1',events:[],checkouts:[{paymentIntentId:'pi_old'}]}));},KEY);
  await page.addInitScript(mode=>Object.defineProperty(window,'name',{configurable:true,get(){if(mode==='throw-get')throw new DOMException('blocked','SecurityError');return 'readonly-target';},set(){if(mode==='throw-set')throw new DOMException('blocked','SecurityError');}}),mode);
  await page.goto('http://localhost:41239/fr/cadeau');
  assert.equal(await page.evaluate(()=>window.guide.export()),null);assert.equal(await page.evaluate(()=>window.guide.enroll()),null);
  await page.evaluate(()=>window.choose('denied'));await page.locator('#internal').click();await page.reload();await page.waitForFunction(()=>!!window.guide);
  await page.evaluate(()=>window.choose('granted'));assert.equal(await page.evaluate(()=>window.guide.enroll()),null);assert.equal(await page.evaluate(()=>window.guide.captureCheckout()),null);
  assert.equal((await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),KEY)).sessionId,'00000000-0000-4000-8000-000000000003','no fresh journal written when tombstones unavailable');await context.close();
 }finally{await browser.close();}
});
test('historical fragment migrates before navigation; ignored Storage writes cannot clear withdrawal',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const {context}=await fixture(browser,await bundle());const page=await context.newPage();
  await page.goto('http://localhost:41239/seed');await page.evaluate(({key,name})=>{window.name=name;sessionStorage.setItem(key,JSON.stringify({version:1,sessionId:'00000000-0000-4000-8000-000000000003',consent:true,cohort:'guided-v1',events:[],checkouts:[{paymentIntentId:'pi_old'}]}));},{key:KEY,name:NAME});
  await page.goto('http://localhost:41239/fr/cadeau#cn-guide-revoked=1');assert.equal(await page.evaluate(()=>window.guide.export()),null);
  await page.locator('#internal').click();await page.waitForFunction(()=>!!window.guide);assert.equal(await page.evaluate(()=>window.guide.export()),null,'historical marker survives ordinary link loss');
  const before=await page.evaluate(()=>window.name);
  await page.evaluate(()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){};window.choose('granted');});
  assert.equal(await page.evaluate(()=>window.guide.enroll()),null,'ignored write is not durable');assert.equal(await page.evaluate(()=>window.name),before);
  assert.equal((await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),KEY)).sessionId,'00000000-0000-4000-8000-000000000003');
  const fresh=await page.evaluate(()=>{Storage.prototype.setItem=window.realSet;return window.guide.enroll();});assert.ok(fresh);assert.deepEqual(fresh.checkouts,[]);assert.equal(await page.evaluate(()=>window.name),NAME);await context.close();
 }finally{await browser.close();}
});
for(const scenario of [{flag:'0',host:'localhost'},{flag:'1',host:'public.invalid'},{flag:'0',host:'public.invalid'}])test(`disabled boundary flag=${scenario.flag} host=${scenario.host}: no window.name/URL mutations`,async()=>{
 const browser=await chromium.launch({headless:true});try{
  const {context}=await fixture(browser,await bundle(scenario.flag),scenario.host);const page=await context.newPage();
  await page.addInitScript(name=>{let value=name;window.nameWrites=[];Object.defineProperty(window,'name',{configurable:true,get:()=>value,set:v=>{window.nameWrites.push(v);value=v;}});},NAME);
  const url=`http://${scenario.host}:41239/fr/cadeau#configurateur`;
  await page.goto(url);assert.equal(await page.evaluate(()=>window.guide.enroll()),null);
  await page.evaluate(()=>{window.guide.revoke();window.guide.export();window.guide.captureCheckout();});
  assert.equal(page.url(),url);assert.equal(await page.evaluate(()=>window.name),NAME);assert.deepEqual(await page.evaluate(()=>window.nameWrites),[]);
  assert.equal(await page.evaluate(()=>sessionStorage.length),0);await context.close();
 }finally{await browser.close();}
});
