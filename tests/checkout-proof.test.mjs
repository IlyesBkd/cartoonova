import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { execFileSync } from 'node:child_process';
import { createRequire, Module } from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';
import ts from 'typescript';
import postgres from 'postgres';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright';
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
const require = createRequire(import.meta.url); require('tsx/cjs');
const root = path.resolve(import.meta.dirname, '..');
const runtime = mkdtempSync(path.join(tmpdir(), 'cartoonova-checkout-proof-'));
const cleanEnv = Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const previousDispatcher = getGlobalDispatcher(), offline = new MockAgent();
offline.disableNetConnect(); setGlobalDispatcher(offline);
const previousFetch = globalThis.fetch;
globalThis.fetch = async()=>{ throw new Error('External transport forbidden'); };
process.env.NEWSLETTER_SECRET = 'synthetic-checkout-hmac-not-a-production-secret';
const context = new AsyncLocalStorage();
const intents = new Map();
const effects = { created:0, finalized:0, gifts:0, alerts:0, reads:0 };
const config = { format:'portrait',people:1,animals:0,printKey:'digital',banner:false,extraDecor:false,express:false,carteVoeux:false,calendrier:false };
let db, started=false, POST, CHECKOUT, GIFT, PAGE, sequence=0;
function load(relative,replacements={}) {
 const filename=path.join(root,relative),mod=new Module(filename),real=createRequire(filename); mod.filename=filename;
 mod.require=name=>Object.hasOwn(replacements,name)?replacements[name]:real(name.startsWith('@/')?path.join(root,name.slice(2)):name);
 mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
 return mod.exports;
}
function pg(cmd,args){return execFileSync('/usr/lib/postgresql/18/bin/'+cmd,args,{env:cleanEnv,encoding:'utf8',timeout:15000,stdio:'pipe'});}
function request(body,cookie='',url='https://checkout.invalid/api/order/create') {
 return new Request(url,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
}
function orderBody(id,extra={}) { return {paymentIntentId:id,email:'owner@example.invalid',firstName:'Synthetic',...config,photoUrls:[],...extra}; }
function cookieOf(response){return response.headers.get('set-cookie')?.split(';')[0]??'';}
async function checkout(cookie='') {
 const response=await CHECKOUT(request({orderConfig:config,currency:'EUR',photoUrls:[],lang:'fr'},cookie));
 assert.equal(response.status,200); const body=await response.json();
 return {response,body,id:body.clientSecret.split('_secret_')[0],cookie:cookieOf(response)};
}
async function page(id,cookie='') {
 return context.run(cookie,async()=>renderToStaticMarkup(await PAGE({searchParams:Promise.resolve({payment_intent:id,lang:'fr'})})));
}
before(async()=>{
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));assert.notEqual(port,5432);
 const data=path.join(runtime,'pg');pg('initdb',['-D',data,'-U','checkout_test','--auth=trust','--no-locale','--encoding=UTF8']);
 pg('pg_ctl',['-D',data,'-l',path.join(runtime,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${runtime}`,'-w','start']);started=true;
 db=postgres(`postgresql://checkout_test@127.0.0.1:${port}/postgres`,{max:8,onnotice(){}});
 assert.equal((await db`SELECT inet_server_port() port`)[0].port,port);
 await db`CREATE TABLE orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payment_intent_id text UNIQUE NOT NULL,customer_email text,customer_name text,customer_address text,total_price numeric,currency text,options jsonb,photo_urls jsonb,status text,detected_country text,promo_code text,discount_amount numeric,origine jsonb,langue text,paid_at timestamptz)`;
 const replacements={
  stripe:class{paymentIntents={
   create:async params=>{const id=`pi_proof${++sequence}`,pi={object:'payment_intent',id,status:'requires_payment_method',...params,client_secret:`${id}_secret_synthetic`};intents.set(id,pi);return pi;},
   retrieve:async id=>{assert.ok(intents.has(id));return intents.get(id);},cancel:async()=>{},
  };},
  '@/lib/db':{sql:db,runtimeSchemaBootstrapEnabled:false,getOrderByPaymentId:async id=>{effects.reads++;return (await db`SELECT * FROM orders WHERE payment_intent_id=${id}`)[0]??null;}},
  '@/lib/photoOwnership':{validateCheckoutPhotoOwnership:async()=>null},
  '@/lib/promoCodes':{consumePromoCode:async()=>{}},
  '@/lib/analyticsServeur':{mesureServeur:async()=>{effects.created++;}},
  '@/lib/alerteServeur':{signalerPanne:async()=>{effects.alerts++;}},
  '@/lib/promoReservations':{releaseExpiredPromoReservations:async()=>{},reservePromoForCheckout:async()=>true},
  '@/lib/finaliserCommande':{finaliserCommande:async()=>{effects.finalized++;}},
  '@/lib/bonCadeau':{finaliserBonCadeau:async()=>{effects.gifts++;return {code:'SYNTHETIC-GIFT',montant:50,devise:'EUR',lang:'fr'};},formatMontant:()=> '50 EUR',lienImpression:code=>'/bon/'+require(path.join(root,'lib/emailToken.ts')).bonToken(code)},
  'next/headers':{cookies:async()=>new (require('next/dist/compiled/@edge-runtime/cookies').RequestCookies)(new Headers({cookie:context.getStore()??''})),headers:async()=>new Headers({cookie:context.getStore()??''})},
  '@/app/(hors-langue)/success/SuccessClient':{__esModule:true,default:props=>React.createElement('div',{'data-order':props.order.id},props.order.customer_email,React.createElement('a',{href:props.trackingUrl},'tracking'),React.createElement('a',{href:props.depotUrl},'upload'))},
  '@/app/(hors-langue)/success/AttentePaiement':{__esModule:true,default:()=>React.createElement('div',null,'waiting')},
 };
 const {DEFAULT_PRICE_SET}=require(path.join(root,'lib/types.ts'));
 const quote=load('lib/orderQuote.ts',{'./db':{getPricesForCurrency:async()=>({...DEFAULT_PRICE_SET})},'./promoCodes':{validatePromoCode:async()=>null}});
 POST=load('app/api/order/create/route.ts',replacements).POST;
 CHECKOUT=load('app/api/checkout/route.ts',{...replacements,'@/lib/orderQuote':quote}).POST;
 GIFT=load('app/api/bon-cadeau/checkout/route.ts',replacements).POST;
 PAGE=load('app/(hors-langue)/success/page.tsx',replacements).default;
});
after(async()=>{try{if(db)await db.end({timeout:2});}finally{if(started)pg('pg_ctl',['-D',path.join(runtime,'pg'),'-m','fast','-w','stop']);globalThis.fetch=previousFetch;setGlobalDispatcher(previousDispatcher);await offline.close();}});

test('PI alone cannot create or recover an order, even with the correct email',async()=>{
 const owner=await checkout(); const before={...effects};
 const response=await POST(request(orderBody(owner.id)));
 assert.equal(response.status,403);
 assert.equal(Object.hasOwn(await response.json(),'orderId'),false);
 assert.equal((await db`SELECT id FROM orders WHERE payment_intent_id=${owner.id}`).length,0);
 await db`INSERT INTO orders(payment_intent_id,customer_email,status) VALUES(${owner.id},'owner@example.invalid','PAID')`;
 const retry=await POST(request(orderBody(owner.id)));
 assert.equal(retry.status,403);assert.equal(Object.hasOwn(await retry.json(),'orderId'),false);
 assert.deepEqual(effects,before);
});

test('checkout issues an opaque per-payment HttpOnly capability; legitimate retries remain immutable',async()=>{
 const owner=await checkout();
 assert.match(owner.cookie,/^__Host-cartoonova-checkout-pi_proof\d+=[a-f0-9]{64}$/);
 assert.match(owner.response.headers.get('set-cookie'),/HttpOnly/i);
 assert.match(owner.response.headers.get('set-cookie'),/Secure/i);
 assert.match(owner.response.headers.get('set-cookie'),/SameSite=Lax/i);
 assert.match(owner.response.headers.get('set-cookie'),/Path=\//);
 assert.equal(intents.get(owner.id).metadata.type,'portrait_order');
 assert.equal(JSON.stringify(owner.body).includes(owner.cookie.split('=')[1]),false);
 assert.notEqual(intents.get(owner.id).metadata.checkout_proof_hash,owner.cookie.split('=')[1]);
 const first=await POST(request(orderBody(owner.id),owner.cookie));assert.equal(first.status,200);
 const result=await first.json(), before={...effects};
 const requests=await Promise.all(Array.from({length:8},()=>POST(request(orderBody(owner.id,{people:10,printKey:'canvas'}),owner.cookie))));
 for(const r of requests){assert.equal(r.status,200);assert.deepEqual(await r.json(),result);}
 const [row]=await db`SELECT * FROM orders WHERE payment_intent_id=${owner.id}`;
 assert.equal(row.options.people,1);assert.equal(row.options.printKey,'digital');assert.equal(row.status,'PENDING');
 assert.deepEqual(effects,before);
});


test('confirmation refuses PI-only, foreign and tampered cookies before order reads, HMAC links or finalization',async()=>{
 const owner=await checkout(),foreign=await checkout();
 assert.equal((await POST(request(orderBody(owner.id),owner.cookie))).status,200);
 intents.get(owner.id).status='succeeded';
 const before={...effects};
 const name=owner.cookie.split('=')[0];
 for(const cookie of ['',foreign.cookie,`${name}=${foreign.cookie.split('=')[1]}`,`${name}=${'f'.repeat(64)}`,`${owner.cookie}; ${owner.cookie}`]) {
  const html=await page(owner.id,cookie);
  assert.doesNotMatch(html,/owner@example|data-order|\/suivi\/|\/depot\//);
 }
 assert.deepEqual(effects,before);
 const html=await page(owner.id,owner.cookie);
 assert.match(html,/owner@example.invalid/);assert.match(html,/\/suivi\//);assert.match(html,/\/depot\//);
 assert.equal(effects.finalized,before.finalized+1);
});


test('gift checkout binds a distinct capability; only its owner obtains the gift code and print HMAC',async()=>{
 const response=await GIFT(request({montant:40,currency:'EUR',email:'gift@example.invalid',lang:'fr'}));
 assert.equal(response.status,200);const body=await response.json(),cookie=cookieOf(response),id=body.clientSecret.split('_secret_')[0];
 assert.ok(cookie,'gift checkout must issue ownership capability');
 intents.get(id).status='succeeded';
 const before={...effects};
 const refused=await page(id);assert.doesNotMatch(refused,/SYNTHETIC-GIFT|\/bon\//);assert.deepEqual(effects,before);
 const html=await page(id,cookie);assert.match(html,/SYNTHETIC-GIFT/);assert.match(html,/\/bon\/SYNTHETIC-GIFT\.[a-f0-9]{32}/);
 assert.equal(effects.gifts,before.gifts+1);assert.equal(effects.reads,before.reads);
 const order=await POST(request(orderBody(id),cookie));assert.equal(order.status,403);
 assert.equal((await db`SELECT id FROM orders WHERE payment_intent_id=${id}`).length,0);
});

test('expired proof and legacy payments without ownership metadata fail closed, even for a paid order',async()=>{
 const owner=await checkout();
 assert.equal((await POST(request(orderBody(owner.id),owner.cookie))).status,200);
 const pi=intents.get(owner.id);pi.status='succeeded';
 pi.metadata.checkout_proof_expires_at=String(Math.floor(Date.now()/1000)-1);
 const before={...effects};
 assert.equal((await POST(request(orderBody(owner.id),owner.cookie))).status,403);
 assert.doesNotMatch(await page(owner.id,owner.cookie),/owner@example|\/suivi\/|\/depot\//);
 pi.metadata={};
 assert.equal((await POST(request(orderBody(owner.id),owner.cookie))).status,403);
 assert.doesNotMatch(await page(owner.id,owner.cookie),/owner@example|\/suivi\//);
 assert.deepEqual(effects,before);
});

test('order authorization rejects foreign, forged, photo-only and duplicate capabilities, including existing orders',async()=>{
 const owner=await checkout(),other=await checkout(),name=owner.cookie.split('=')[0];
 assert.equal((await POST(request(orderBody(owner.id),owner.cookie))).status,200);
 const before={...effects},[original]=await db`SELECT * FROM orders WHERE payment_intent_id=${owner.id}`;
 for(const cookie of [other.cookie,`${name}=${other.cookie.split('=')[1]}`,`${name}=${'f'.repeat(64)}`,`${name}=short`,`${owner.cookie}; ${owner.cookie}`,'__Host-cartoonova-photo='+'a'.repeat(64)]) {
  const response=await POST(request(orderBody(owner.id),cookie));
  assert.equal(response.status,403);assert.equal(Object.hasOwn(await response.json(),'orderId'),false);
 }
 const pi=intents.get(owner.id);pi.metadata.type='unknown';pi.status='succeeded';
 assert.equal((await POST(request(orderBody(owner.id),owner.cookie))).status,403);
 assert.doesNotMatch(await page(owner.id,owner.cookie),/owner@example|\/suivi\/|\/depot\//);
 assert.deepEqual((await db`SELECT * FROM orders WHERE payment_intent_id=${owner.id}`)[0],original);
 assert.deepEqual(effects,before);
});

test('Chromium isolates payments and preserves reload, back and cross-site top-level GET returns',async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
  for(const c of contexts)await c.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.origin==='https://bank.invalid')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Captured bank return</title>'});
   if(u.origin!=='https://checkout.invalid')return route.abort();
   if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Ownership harness</title>'});
   if(u.pathname==='/success')return route.fulfill({contentType:'text/html',headers:{'cache-control':'no-store'},body:await page(u.searchParams.get('payment_intent'),(await r.allHeaders()).cookie??'')});
   const handler={'/api/checkout':CHECKOUT,'/api/order/create':POST,'/api/bon-cadeau/checkout':GIFT}[u.pathname];
   if(!handler)return route.abort();
   const response=await handler(new Request(r.url(),{method:r.method(),headers:await r.allHeaders(),body:r.postData()}));
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  });
  const [a,b]=await Promise.all(contexts.map(async c=>{const p=await c.newPage();await p.goto('https://checkout.invalid/');return p;}));
  const call=(p,path,body)=>p.evaluate(async({path,body})=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};},{path,body});
  const checked=await call(a,'/api/checkout',{orderConfig:config,currency:'EUR',photoUrls:[]});assert.equal(checked.status,200);
  const id=checked.body.clientSecret.split('_secret_')[0],input=orderBody(id);
  const cookie=(await contexts[0].cookies()).find(c=>c.name.includes(id));
  assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);assert.equal(cookie.sameSite,'Lax');assert.equal(await a.evaluate(()=>document.cookie),'');
  assert.equal((await call(b,'/api/order/create',input)).status,403);
  const created=await call(a,'/api/order/create',input);assert.equal(created.status,200);
  assert.deepEqual(await call(a,'/api/order/create',input),created,'decline/retry reuses order');
  intents.get(id).status='processing';await a.goto('https://checkout.invalid/success?payment_intent='+id);assert.match(await a.content(),/waiting/);
  intents.get(id).status='succeeded';await a.reload();assert.match(await a.content(),/owner@example.invalid/);
  await b.goto('https://checkout.invalid/success?payment_intent='+id);assert.doesNotMatch(await b.content(),/owner@example|\/suivi\/|\/depot\//);
  await a.goto('https://bank.invalid/');await a.goto('https://checkout.invalid/success?payment_intent='+id);assert.match(await a.content(),/owner@example.invalid/);
  await a.goto('https://checkout.invalid/');await a.goBack();assert.match(await a.content(),/owner@example.invalid/);
  const second=await call(a,'/api/checkout',{orderConfig:config,currency:'EUR',photoUrls:[]});assert.equal(second.status,200);
  assert.equal((await contexts[0].cookies()).filter(c=>c.name.startsWith('__Host-cartoonova-checkout-')).length,2);
  await a.goto('https://checkout.invalid/success?payment_intent='+id);assert.match(await a.content(),/owner@example.invalid/,'opening a second checkout must not revoke first tab');
 } finally {await browser.close();}
});
