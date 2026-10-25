import assert from 'node:assert/strict';
import { test, beforeEach, afterEach, mock } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
let sends=[], marked=[], scheduled=[], referrals=[];
const order={id:'11111111-1111-4111-8111-111111111111',customer_email:'buyer@example.invalid',customer_name:'Private Buyer',detected_country:'FR',langue:'en',final_image_url:'https://images.example.invalid/portrait.png',options:{printKey:'digital',gift:{recipientEmail:'recipient@example.invalid',message:'Happy <script>alert("gift")</script> & birthday!\nEnjoy',deliverAfter:null}}};
function load(file,replacements={},cache=new Map()) {
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;
 const m=new Module(file);m.filename=file;cache.set(file,m);const original=createRequire(file);
 const defaults={
  '@/lib/db':{markFinalImageSent:async id=>marked.push(id),setOrderLastOutboundMessageId:async()=>{},programmerEnvoiImageFinale:async(id,date)=>scheduled.push({id,date}),getOrderById:async()=>structuredClone(order)},
  '@/lib/envoiEmail':{envoyerEmail:async payload=>{sends.push(payload);return {data:{id:'captured'},error:null};}},
  '@/lib/analyticsServeur':{mesureServeur:async()=>{}},
  '@/lib/parrainage':{infosParrainage:async(...args)=>{referrals.push(args);return null;}},
  '@/lib/emailToken':{orderTrackingToken:()=> 'PRIVATE_BUYER_TOKEN'},
 };
 m.require=name=>{const normalized=name.startsWith('.')?'@/'+path.relative(root,path.resolve(path.dirname(file),name)):name;if(normalized in replacements)return replacements[normalized];if(normalized in defaults)return defaults[normalized];if(normalized.startsWith('@/'))return load(normalized.slice(2)+'.ts',replacements,cache);return original(name);};
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);return m.exports;
}
beforeEach(()=>{sends=[];marked=[];scheduled=[];referrals=[];mock.timers.enable({apis:['Date'],now:new Date('2026-10-25T12:00:00Z')});});
afterEach(()=>mock.timers.reset());

test('delivery provider refusal never marks the portrait delivered',async()=>{
 const input=structuredClone(order);
 await assert.rejects(load('lib/emailImageFinale.ts',{'@/lib/envoiEmail':{envoyerEmail:async()=>({data:null,error:{message:'captured refusal'}})}}).envoyerImageFinale(input),/captured refusal/);
 assert.equal(marked.length,0);
});

test('server route rejects impossible gift date before saving or sending',async()=>{
 const input=structuredClone(order);input.options.gift.deliverAfter='2026-02-30';let writes=0;
 const {POST}=load('app/api/orders/send-final-image/route.ts',{'@/lib/db':{getOrderById:async()=>input,updateOrderFinalImage:async()=>writes++},'@/lib/adminAuth':{refuserSiPasAdmin:()=>null}});
 const response=await POST(new Request('http://local/api/orders/send-final-image',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:input.id,finalImageUrl:input.final_image_url,saveOnly:true})}));
 assert.equal(response.status,400);assert.equal(writes,0);assert.equal(sends.length,0);
});

test('past and today gifts deliver; blank recipient falls back to buyer with buyer-only links',async()=>{
 for(const date of ['2026-10-24','2026-10-25']) for(const recipient of ['recipient@example.invalid','  ',null]){
  const input=structuredClone(order);input.options.gift.deliverAfter=date;input.options.gift.recipientEmail=recipient;
  input.options=JSON.stringify(input.options);
  await load('lib/emailImageFinale.ts').envoyerImageFinale(input);
  const mail=sends.at(-1);assert.deepEqual(mail.to,[recipient?.trim()||order.customer_email]);
  if(!recipient?.trim())assert.match(mail.html,/PRIVATE_BUYER_TOKEN/);
 }
 assert.equal(sends.length,6);assert.equal(scheduled.length,0);
});

test('UTC midnight boundary controls gift eligibility independently of host timezone',async()=>{
 const input=structuredClone(order);input.options.gift.deliverAfter='2026-10-26';
 mock.timers.setTime(Date.parse('2026-10-25T23:59:59.999Z'));
 await load('lib/emailImageFinale.ts').envoyerImageFinale(input);assert.equal(sends.length,0);
 mock.timers.setTime(Date.parse('2026-10-26T00:00:00.000Z'));
 await load('lib/emailImageFinale.ts').envoyerImageFinale(input);assert.equal(sends.length,1);
});

test('purchase confirmation still targets buyer immediately even for a future recipient gift',async()=>{
 let queued;
 const finaliser=load('lib/finaliserCommande.ts',{
  '@/lib/emailOutbox':{payerAvecConfirmation:async(id,payload)=>{queued=payload;return true;},drainerEmails:async()=>{sends.push(queued);return 1;}},
  '@/lib/analyticsServeur':{mesureServeur:async()=>{},personneServeur:async()=>{}},
  '@/lib/discord':{alerteDiscord:async()=>{}},'@/lib/conversionsChatgpt':{envoyerConversionChatgpt:async()=>{}},'@/lib/promoCodes':{},
 }).finaliserCommande;
 const input=structuredClone(order);Object.assign(input,{total_price:39,currency:'EUR',photo_urls:[]});Object.assign(input.options,{format:'portrait',people:1,animals:0,printOption:'digital'});input.options.gift.deliverAfter='2026-10-26';
 assert.equal(await finaliser(input,'webhook'),true);
 assert.deepEqual(sends[0].to,['buyer@example.invalid']);assert.match(sends[0].html,/\/suivi\/PRIVATE_BUYER_TOKEN/);
 assert.doesNotMatch(sends[0].html,/recipient@example.invalid/);assert.equal(scheduled.length,0);
});

test('cron reschedules a stale future gift without counting a delivery',async()=>{
 const stored=structuredClone(order);stored.options.gift.deliverAfter='2026-10-26';
 const empty=async()=>[];
 const db=Object.fromEntries(['getOrdersDueForReviewRequest','getOrdersDueForReviewReminder','getOrdersDueForReorderEmail','getOrdersDueForAbandonedEmail','getSubscribersDueForWelcome','getOrdersAwaitingPhotos'].map(k=>[k,empty]));
 Object.assign(db,{runtimeSchemaBootstrapEnabled:false,sql:empty,getOrdersDueForFinalImage:async()=>[stored],programmerEnvoiImageFinale:async(id,date)=>scheduled.push({id,date})});
 const {GET}=load('app/api/cron/lifecycle-emails/route.ts',{'@/lib/db':db,stripe:class {},'@/lib/leadsCaisse':{getLeadsARelancer:empty},'@/lib/welcomeSequence':{WELCOME_DELAYS_DAYS:{2:1,3:2}},'@/lib/emailOutbox':{drainerEmails:async()=>0},'@/lib/finaliserCommande':{},'@/lib/alerteServeur':{signalerPanne:async()=>{}},'@/lib/discord':{}});
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='local-only';
 try {const response=await GET(new Request('http://local/api/cron/lifecycle-emails',{headers:{authorization:'Bearer local-only'}}));assert.equal(response.status,200);const body=await response.json();assert.equal(body.imagesFinales.sent,0);assert.equal(body.imagesFinales.deferred,1);assert.equal(sends.length,0);assert.equal(marked.length,0);assert.equal(scheduled[0].date.toISOString(),'2026-10-26T09:00:00.000Z');}
 finally {if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});

test('manual and express routes use persisted recipient and language, and cannot bypass gift date',async()=>{
 for(const saveOnly of [false,true]) for(const future of [false,true]){
  sends=[];marked=[];scheduled=[];
  const stored=structuredClone(order);stored.options.express=saveOnly;stored.options.gift.deliverAfter=future?'2026-10-26':null;
  const db={getOrderById:async()=>stored,updateOrderFinalImage:async()=>{},markFinalImageSent:async id=>marked.push(id),setOrderLastOutboundMessageId:async()=>{},programmerEnvoiImageFinale:async(id,date)=>scheduled.push({id,date}),programmerEnvoiImageFinaleSiLibre:async(id,date)=>{scheduled.push({id,date});return date;}};
  const {POST}=load('app/api/orders/send-final-image/route.ts',{'@/lib/db':db,'@/lib/adminAuth':{refuserSiPasAdmin:()=>null}});
  const response=await POST(new Request('http://local/api/orders/send-final-image',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:order.id,finalImageUrl:order.final_image_url,customerEmail:'forged@example.invalid',detectedCountry:'FR',saveOnly})}));
  assert.equal(response.status,200);const body=await response.json();
  if(future){assert.equal(sends.length,0);assert.equal(marked.length,0);assert.equal(body.scheduledAt,'2026-10-26T09:00:00.000Z');assert.notEqual(body.envoyeImmediatement,true);}
  else {assert.deepEqual(sends[0].to,['recipient@example.invalid']);assert.equal(sends[0].subject,load('lib/email-i18n.ts').finalImageEmail.en.subject);}
 }
});

test('invalid persisted gift email or impossible calendar date fails closed before side effects',async()=>{
 for(const gift of [{recipientEmail:'bad\r\nBcc: victim@example.invalid'},{recipientEmail:'two@example.invalid,other@example.invalid'},{deliverAfter:'2026-02-30'},{deliverAfter:'2026-13-01'},{deliverAfter:'tomorrow'}]){
  const input=structuredClone(order);Object.assign(input.options.gift,gift);
  await assert.rejects(load('lib/emailImageFinale.ts').envoyerImageFinale(input),/invalide/);
 }
 assert.equal(sends.length,0);assert.equal(marked.length,0);assert.equal(scheduled.length,0);
});

test('future gift is deferred without delivery or delivered marker, using UTC calendar days',async()=>{
 const {envoyerImageFinale}=load('lib/emailImageFinale.ts');
 const input=structuredClone(order);input.options.gift.deliverAfter='2026-10-26';
 const result=await envoyerImageFinale(input);
 assert.equal(result.deferredUntil,'2026-10-26T09:00:00.000Z');
 assert.equal(sends.length,0);assert.equal(marked.length,0);
 assert.equal(scheduled[0].date.toISOString(),result.deferredUntil);
});

test('gift portrait goes to selected recipient, escaped message, order language and no buyer access',async()=>{
 const {envoyerImageFinale}=load('lib/emailImageFinale.ts');
 await envoyerImageFinale(structuredClone(order));
 assert.deepEqual(sends[0].to,['recipient@example.invalid']);
 assert.match(sends[0].html,/Happy &lt;script&gt;alert\(&quot;gift&quot;\)&lt;\/script&gt; &amp; birthday!/);
 assert.doesNotMatch(sends[0].html,/<script>|PRIVATE_BUYER_TOKEN|Private Buyer|buyer@example.invalid|\/admin|\/bonus\/|\/suivi\//);
 assert.equal(sends[0].subject,load('lib/email-i18n.ts').finalImageEmail.en.subject);
 assert.deepEqual(referrals,[]);assert.deepEqual(marked,[order.id]);
});
