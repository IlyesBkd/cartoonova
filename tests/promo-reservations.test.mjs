import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { execFileSync } from 'node:child_process';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
import postgres from 'postgres';
const require = createRequire(import.meta.url); require('tsx/cjs');
const root = path.resolve(import.meta.dirname, '..');
const runtime = mkdtempSync(path.join(tmpdir(), 'cartoonova-promo-'));
const pgBin = process.env.TEST_PG_BIN || '/usr/lib/postgresql/18/bin';
const env = Object.fromEntries(['PATH','HOME','LANG','LC_ALL','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const pg = (cmd,args)=>execFileSync(path.join(pgBin,cmd),args,{env,encoding:'utf8',timeout:15000,stdio:'pipe'});
let db, started=false, checkout, createOrder, finaliser, outbox, promoModule, sequence=0;
let failEmail=false;
const intents = new Map();
const proofCookies = new Map();
const effects={created:0,canceled:0,alerts:0,emails:0,analytics:0};
const config={format:'portrait',people:1,animals:0,printKey:'digital',banner:false,extraDecor:false,express:false,carteVoeux:false,calendrier:false};
function load(relative,replacements={}) {
 const filename=path.join(root,relative); const m=new Module(filename);m.filename=filename;
 const original=createRequire(filename);
 m.require=name=>Object.hasOwn(replacements,name)?replacements[name]:original(name.startsWith('@/')?path.join(root,name.slice(2)):name);
 m._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return m.exports;
}
const stripe={paymentIntents:{
 create:async params=>{effects.created++;const id=`pi_promo_${++sequence}`;const pi={object:'payment_intent',id,...params,status:'requires_payment_method',client_secret:`${id}_secret_fixture`};intents.set(id,pi);return pi;},
 cancel:async id=>{const pi=intents.get(id);if(pi.cancelError)throw new Error('provider unavailable');if(['succeeded','processing'].includes(pi.status))throw new Error('not cancelable');pi.status='canceled';effects.canceled++;return pi;},
 retrieve:async id=>intents.get(id),
}};
const request=code=>({json:async()=>({orderConfig:config,currency:'EUR',promoCode:code,photoUrls:[]})});
before(async()=>{
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));assert.notEqual(port,5432);
 pg('initdb',['-D',path.join(runtime,'pg'),'-U','promo_test','--auth=trust','--no-locale','--encoding=UTF8']);
 pg('pg_ctl',['-D',path.join(runtime,'pg'),'-l',path.join(runtime,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${runtime}`,'-w','start']);started=true;
 db=postgres(`postgresql://promo_test@127.0.0.1:${port}/postgres`,{max:16,onnotice(){}});
 await db`CREATE TABLE promo_codes(code text PRIMARY KEY, kind text NOT NULL, value numeric NOT NULL, currency text, min_subtotal numeric DEFAULT 0, max_uses integer, used_count integer DEFAULT 0, starts_at timestamptz, ends_at timestamptz, active boolean DEFAULT true, created_at timestamptz DEFAULT now(), solde numeric)`;
 await db`CREATE TABLE orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payment_intent_id text UNIQUE,
  customer_email text,customer_name text,customer_address text,total_price numeric,currency text,options jsonb,photo_urls jsonb,
  detected_country text,origine jsonb,langue text,promo_code text,discount_amount numeric,paid_at timestamptz,status text DEFAULT 'PENDING')`;
 await db.unsafe(readFileSync(path.join(root,'migrations/2026-10-email-outbox.sql'),'utf8'));
 await db.unsafe(readFileSync(path.join(root,'migrations/20261025_promo_reservations.sql'),'utf8'));
 const promo=load('lib/promoCodes.ts',{'./db':{sql:db,runtimeSchemaBootstrapEnabled:false}});
 promoModule=promo;
 outbox=load('lib/emailOutbox.ts',{'./db':{sql:db},'./envoiEmail':{envoyerEmail:async()=>{if(failEmail)throw new Error('simulated email outage');effects.emails++;}},'./analyticsServeur':{mesureServeur:async()=>{}}});
 createOrder=load('app/api/order/create/route.ts',{
  stripe:class{paymentIntents=stripe.paymentIntents},'@/lib/db':{sql:db,runtimeSchemaBootstrapEnabled:false},'@/lib/promoCodes':promo,
  '@/lib/analyticsServeur':{mesureServeur:async()=>{effects.analytics++;}},'@/lib/alerteServeur':{signalerPanne:async()=>{effects.alerts++;}},
 }).POST;
 finaliser=load('lib/finaliserCommande.ts',{
  './emailOutbox':outbox,'@/lib/emailToken':{orderTrackingToken:id=>id},
  '@/lib/analyticsServeur':{mesureServeur:async()=>{},personneServeur:async()=>{}},
  '@/lib/discord':{alerteDiscord:async()=>{},COULEUR_SOLEIL:1,COULEUR_ATTENTION:2},
  './parrainage':{recompenserParrain:async()=>{}},'@/lib/conversionsChatgpt':{envoyerConversionChatgpt:async()=>{}},
 }).finaliserCommande;
 const reservations=load('lib/promoReservations.ts',{'./db':{sql:db}});
 const {DEFAULT_PRICE_SET}=require(path.join(root,'lib/types.ts'));
 const quote=load('lib/orderQuote.ts',{'./db':{getPricesForCurrency:async()=>({...DEFAULT_PRICE_SET})},'./promoCodes':promo});
 checkout=load('app/api/checkout/route.ts',{'stripe':class{paymentIntents=stripe.paymentIntents},'@/lib/orderQuote':quote,'@/lib/promoReservations':reservations,'@/lib/alerteServeur':{signalerPanne:async()=>{effects.alerts++;}}}).POST;
});
after(async()=>{if(db)await db.end({timeout:2});if(started)pg('pg_ctl',['-D',path.join(runtime,'pg'),'-m','fast','-w','stop']);});
async function gift(code,solde=3,max=null){await db`INSERT INTO promo_codes(code,kind,value,currency,solde,max_uses) VALUES(${code},'amount',${solde},'EUR',${solde},${max})`;}
async function accepted(code){const response=await checkout(request(code));assert.equal(response.status,200);const body=await response.json();const id=body.clientSecret.split('_secret_')[0];proofCookies.set(id,response.headers.get('set-cookie').split(';')[0]);return intents.get(id);}

test('CODE-03: simultaneous gift checkouts cannot promise the same balance twice',async()=>{
 await gift('CONCURRENT');
 const responses=await Promise.all(Array.from({length:12},()=>checkout(request('CONCURRENT'))));
 const discounted=[];
 for(const response of responses){if(response.status===200){const body=await response.json();if(body.discount>0)discounted.push(body);}}
 assert.equal(discounted.length,1,'only one server quote may expose a secret with the reserved gift balance');
 const [promo]=await db`SELECT * FROM promo_codes WHERE code='CONCURRENT'`;
 assert.equal(Number(promo.solde),3,'pending payments do not consume the gift');
 assert.equal(promo.used_count,0);
});

test('quota is reserved at checkout, not consumed by a PENDING order',async()=>{
 await db`INSERT INTO promo_codes(code,kind,value,max_uses) VALUES('QUOTA','percent',20,1)`;
 const responses=await Promise.all(Array.from({length:10},()=>checkout(request('QUOTA'))));
 assert.equal(responses.filter(r=>r.status===200).length,1);
 await promoModule.consumePromoCode('QUOTA'); // legacy order/create callback
 const [p]=await db`SELECT used_count FROM promo_codes WHERE code='QUOTA'`;
 assert.equal(p.used_count,0,'abandoned PENDING orders must not consume the quota');
});

const payload={from:'local@example.invalid',to:['local@example.invalid'],subject:'Local',html:'<p>Local</p>'};
async function pending(pi,overrides={}) {
 const [order]=await db`INSERT INTO orders(payment_intent_id,promo_code,discount_amount)
 VALUES(${pi.id},${overrides.code??pi.metadata.promo_code},${overrides.discount??Number(pi.metadata.discount)}) RETURNING *`;
 return order;
}
test('payment confirmation consumes gift once together with PAID and durable outbox',async()=>{
 await gift('CONFIRM');const pi=await accepted('CONFIRM');const order=await pending(pi);
 const winners=await Promise.all(Array.from({length:12},()=>outbox.payerAvecConfirmation(order.id,payload)));
 assert.equal(winners.filter(Boolean).length,1);
 const [p]=await db`SELECT * FROM promo_codes WHERE code='CONFIRM'`;
 assert.equal(Number(p.solde),0);assert.equal(p.used_count,1);
 const [r]=await db`SELECT * FROM promo_reservations WHERE payment_intent_id=${pi.id}`;
 assert.equal(r.state,'consumed');
 assert.equal((await db`SELECT * FROM email_outbox WHERE event_key=${'order:'+order.id}`).length,1);
});

test('real order retry and finalizer email retry never consume credit or quota twice',async()=>{
 await gift('REALFLOW');const pi=await accepted('REALFLOW');
 const input={paymentIntentId:pi.id,email:'local@example.invalid',firstName:'Local',...config,photoUrls:[]};
 const before=effects.analytics;
 const responses=await Promise.all(Array.from({length:12},()=>createOrder({headers:new Headers({cookie:proofCookies.get(pi.id)}),json:async()=>input})));
 assert.ok(responses.every(r=>r.status===200));const bodies=await Promise.all(responses.map(r=>r.json()));
 assert.equal(new Set(bodies.map(b=>b.orderId)).size,1);assert.equal(effects.analytics-before,1);
 const [p0]=await db`SELECT * FROM promo_codes WHERE code='REALFLOW'`;assert.equal(Number(p0.solde),3);assert.equal(p0.used_count,0);
 const [order]=await db`SELECT * FROM orders WHERE payment_intent_id=${pi.id}`;
 pi.status='succeeded';failEmail=true;
 try {await assert.rejects(finaliser(order,'webhook'),/simulated email outage/);} finally {failEmail=false;}
 const [paid]=await db`SELECT * FROM orders WHERE id=${order.id}`;assert.ok(paid.paid_at);
 const [p1]=await db`SELECT * FROM promo_codes WHERE code='REALFLOW'`;assert.equal(Number(p1.solde),0);assert.equal(p1.used_count,1);
 await db`UPDATE email_outbox SET available_at=now() WHERE event_key=${'order:'+order.id}`;
 const emails=effects.emails;
 const retried=await Promise.all(Array.from({length:12},()=>finaliser(paid,'page_succes')));
 assert.ok(retried.every(v=>v===false));assert.equal(effects.emails-emails,1);
 const [p2]=await db`SELECT * FROM promo_codes WHERE code='REALFLOW'`;assert.deepEqual(p2,p1);
});

test('outbox insertion failure rolls back PAID, gift debit, quota and reservation consumption',async()=>{
 await gift('ROLLBACK');const pi=await accepted('ROLLBACK');const order=await pending(pi);
 await db`CREATE FUNCTION fail_confirmation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'enqueue failure'; END $$`;
 await db`CREATE TRIGGER fail_confirmation BEFORE INSERT ON email_outbox FOR EACH ROW EXECUTE FUNCTION fail_confirmation()`;
 try {await assert.rejects(outbox.payerAvecConfirmation(order.id,payload),/enqueue failure/);} finally {await db`DROP TRIGGER fail_confirmation ON email_outbox`;}
 const [o]=await db`SELECT * FROM orders WHERE id=${order.id}`;assert.equal(o.paid_at,null);assert.equal(o.status,'PENDING');
 const [p]=await db`SELECT * FROM promo_codes WHERE code='ROLLBACK'`;assert.equal(Number(p.solde),3);assert.equal(p.used_count,0);
 const [r]=await db`SELECT * FROM promo_reservations WHERE payment_intent_id=${pi.id}`;assert.equal(r.state,'reserved');
 assert.equal((await db`SELECT * FROM email_outbox WHERE event_key=${'order:'+order.id}`).length,0);
 assert.equal(await outbox.payerAvecConfirmation(order.id,payload),true);
 assert.equal(await outbox.payerAvecConfirmation(order.id,payload),false);
});
test('mismatched discounts and legacy unreserved pending payments fail closed without PAID or email',async()=>{
 await gift('MISMATCH');const pi=await accepted('MISMATCH');
 for(const [id,discount] of [[pi.id,2],['pi_legacy_unreserved',3]]) {
  const order=await pending({...pi,id},{discount});
  await assert.rejects(outbox.payerAvecConfirmation(order.id,payload),/reservation missing or mismatched/);
  assert.equal((await db`SELECT paid_at FROM orders WHERE id=${order.id}`)[0].paid_at,null);
  assert.equal((await db`SELECT * FROM email_outbox WHERE event_key=${'order:'+order.id}`).length,0);
 }
});
test('reservation SQL failure cannot expose a client secret or leave an untracked payable quote',async()=>{
 await gift('SQLFAIL');
 await db`CREATE FUNCTION fail_reservation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'reservation failure'; END $$`;
 await db`CREATE TRIGGER fail_reservation BEFORE INSERT ON promo_reservations FOR EACH ROW EXECUTE FUNCTION fail_reservation()`;
 const before=effects.alerts;
 try {
  const response=await checkout(request('SQLFAIL'));assert.equal(response.status,500);assert.equal(Object.hasOwn(await response.json(),'clientSecret'),false);
  assert.equal(intents.get(`pi_promo_${sequence}`).status,'canceled');
 } finally {await db`DROP TRIGGER fail_reservation ON promo_reservations`;}
 assert.equal(effects.alerts-before,1);
 assert.equal((await db`SELECT * FROM promo_reservations WHERE code='SQLFAIL'`).length,0);
});
test('reservations retry idempotently by PaymentIntent and retain an exact partial gift remainder',async()=>{
 await gift('PARTIAL',10.01);const pi=await accepted('PARTIAL');
 const [same]=await db`SELECT reserve_checkout_promo(${pi.id},'PARTIAL',${Number(pi.metadata.discount)}::numeric,5,'EUR') AS ok`;assert.equal(same.ok,true);
 assert.equal((await db`SELECT * FROM promo_reservations WHERE payment_intent_id=${pi.id}`).length,1);
 const order=await pending(pi);await outbox.payerAvecConfirmation(order.id,payload);
 const [p]=await db`SELECT * FROM promo_codes WHERE code='PARTIAL'`;assert.equal(Number(p.solde),6.01);assert.equal(p.used_count,1);
});

async function expire(pi){await db`UPDATE promo_reservations SET expires_at=now()-interval '1 minute' WHERE payment_intent_id=${pi.id}`;}
test('abandoned expired intent is canceled before credit is made available again',async()=>{
 await gift('ABANDON');const old=await accepted('ABANDON');await expire(old);
 const replacement=await accepted('ABANDON');assert.notEqual(old.id,replacement.id);
 assert.equal(old.status,'canceled','provider must fence the old client secret');
 const [r]=await db`SELECT state FROM promo_reservations WHERE payment_intent_id=${old.id}`;
 assert.equal(r.state,'released');
 const order=await pending(old);
 await assert.rejects(outbox.payerAvecConfirmation(order.id,payload),/reservation missing or mismatched/);
});
test('paid-after-expiry, processing and uncertain cancellation retain their guaranteed credit',async()=>{
 for(const state of ['succeeded','processing','uncertain']) {
  const code='PIN_'+state.toUpperCase();await gift(code);const pi=await accepted(code);await expire(pi);
  if(state==='uncertain')pi.cancelError=true;else pi.status=state;
  const response=await checkout(request(code));assert.equal(response.status,409);
  const [r]=await db`SELECT state FROM promo_reservations WHERE payment_intent_id=${pi.id}`;assert.equal(r.state,'reserved');
  if(state==='succeeded') {const order=await pending(pi);assert.equal(await outbox.payerAvecConfirmation(order.id,payload),true);}
 }
});
