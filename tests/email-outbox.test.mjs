import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { execFileSync } from 'node:child_process';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
import postgres from 'postgres';
const root = path.resolve(import.meta.dirname, '..');
const runtime = mkdtempSync(path.join(tmpdir(), 'cartoonova-outbox-'));
const pgBin = process.env.TEST_PG_BIN || '/usr/lib/postgresql/18/bin';
const env = Object.fromEntries(['PATH','HOME','LANG','LC_ALL','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const pg = (cmd,args)=>execFileSync(path.join(pgBin,cmd),args,{env,timeout:15000,stdio:'pipe'});
let db, started=false, finaliser, gifts, outbox;
let fail=true, sends=[], providerHook=null;
const accepted=new Map(), measurements=[];
const cache=new Map();
const lifecycleReads=[];
const lifecycleDb=Object.fromEntries(['getOrdersDueForReviewRequest','getOrdersDueForReviewReminder','getOrdersDueForReorderEmail','getOrdersDueForAbandonedEmail','getSubscribersDueForWelcome','getOrdersAwaitingPhotos','getOrdersDueForFinalImage'].map(name=>[name,async()=>{lifecycleReads.push(name);return [];} ]));
const lifecycleReplacements={
 '@/lib/db':{...lifecycleDb,runtimeSchemaBootstrapEnabled:false,sql:async()=>[]},
 stripe:class {},
 '@/lib/leadsCaisse':{getLeadsARelancer:async()=>[],marquerLeadRelance:async()=>{}},
 '@/lib/welcomeSequence':{WELCOME_DELAYS_DAYS:{2:1,3:2}},
 '@/lib/emailImageFinale':{},
 '@/lib/recompenseAvis':{},
 '@/lib/finaliserCommande':{finaliserCommande:()=>{assert.fail('lifecycle retry must not need an order callback');}},
};
function load(file) {
  file=path.resolve(root,file);
  if(cache.has(file)) return cache.get(file).exports;
  const m=new Module(file); m.filename=file; cache.set(file,m);
  const original=createRequire(file);
  const replacements={
    '@/lib/db': {sql:(...args)=>db(...args), marquerPayee:async(id)=> (await db`UPDATE orders SET paid_at=NOW(), status='PAID' WHERE id=${id}::uuid AND paid_at IS NULL RETURNING id`).length>0},
    '@/lib/envoiEmail': {envoyerEmail:async(payload,options)=>{assertProviderPayload(payload);sends.push({payload,options});if(providerHook)return providerHook(payload,options);if(fail)throw new Error('simulated Resend outage');return {data:{id:'local'},error:null};}},
    '@/lib/analyticsServeur':{mesureServeur:async(...args)=>{measurements.push(args);},personneServeur:async()=>{}},
    '@/lib/discord':{alerteDiscord:async()=>{},COULEUR_SOLEIL:1,COULEUR_ATTENTION:2},
    '@/lib/alerteServeur':{signalerPanne:async()=>{}},
    '@/lib/promoCodes':{debiterBonCadeau:async()=>{}},
    '@/lib/parrainage':{recompenserParrain:async()=>{}},
    '@/lib/conversionsChatgpt':{envoyerConversionChatgpt:async()=>{}},
    '@/lib/emailToken':{orderTrackingToken:id=>id,bonToken:id=>id},
  };
  m.require=name=>{
    const normalized=name.startsWith('.')?'@/'+path.relative(root,path.resolve(path.dirname(file),name)):name;
    if(file===path.join(root,'app/api/cron/lifecycle-emails/route.ts') && lifecycleReplacements[normalized])return lifecycleReplacements[normalized];
    if(replacements[normalized])return replacements[normalized];
    if(normalized.startsWith('@/'))return load(normalized.slice(2)+'.ts');
    return original(name);
  };
  m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
  return m.exports;
}
before(async()=>{
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));assert.notEqual(port,5432);
 pg('initdb',['-D',path.join(runtime,'pg'),'-U','outbox_test','--auth=trust','--no-locale','--encoding=UTF8']);
 pg('pg_ctl',['-D',path.join(runtime,'pg'),'-l',path.join(runtime,'pg.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${runtime}`,'-w','start']);started=true;
 db=postgres(`postgresql://outbox_test@127.0.0.1:${port}/postgres`,{max:8,onnotice(){}});
 await db`CREATE TABLE orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),paid_at timestamptz,status text, customer_email text, options jsonb)`;
 await db`CREATE TABLE promo_codes(code text PRIMARY KEY,kind text,value numeric,currency text,min_subtotal numeric,max_uses integer,ends_at timestamptz,solde numeric,achat_payment_intent text UNIQUE,acheteur_email text)`;
 if(existsSync(path.join(root,'migrations/2026-10-email-outbox.sql')))await db.unsafe(readFileSync(path.join(root,'migrations/2026-10-email-outbox.sql'),'utf8'));
 finaliser=load('lib/finaliserCommande.ts').finaliserCommande;gifts=load('lib/bonCadeau.ts');
 if(existsSync(path.join(root,'lib/emailOutbox.ts')))outbox=load('lib/emailOutbox.ts');
});
after(async()=>{if(db)await db.end({timeout:2});if(started)pg('pg_ctl',['-D',path.join(runtime,'pg'),'-m','fast','-w','stop']);});
const payload={from:'local@example.invalid',to:['local@example.invalid'],subject:'Local',html:'<p>immutable</p>'};
function assertProviderPayload(body){
 assert.equal(typeof body,'object');assert.ok(body);assert.ok(!Array.isArray(body));
 for(const field of ['from','subject','html']){assert.equal(typeof body[field],'string');assert.ok(body[field].length>0,`${field} must not be empty`);}
 assert.ok(Array.isArray(body.to));assert.ok(body.to.length>0);
 for(const recipient of body.to){assert.equal(typeof recipient,'string');assert.match(recipient,/@/);}
}
async function persistedPayload(key){
 const [stored]=await db`SELECT jsonb_typeof(payload) AS kind, payload FROM email_outbox WHERE event_key=${key}`;
 assert.equal(stored.kind,'object');assertProviderPayload(stored.payload);return stored.payload;
}
async function enqueue(key){await db`INSERT INTO email_outbox(event_key,payload) VALUES(${key},${JSON.stringify(payload)}::text::jsonb)`;}

test('outbox rejects a JSON string instead of an object at the database boundary',async()=>{
 await assert.rejects(db`INSERT INTO email_outbox(event_key,payload) VALUES('invalid:string',${JSON.stringify(JSON.stringify(payload))}::text::jsonb)`,{code:'23514'});
});

test('outbox persists a JSON object, not a double-encoded string, and delivers provider fields',async()=>{
 const [order]=await db`INSERT INTO orders(status) VALUES('PENDING') RETURNING *`;
 await outbox.payerAvecConfirmation(order.id,payload);
 const key=`order:${order.id}`;
 const [stored]=await db`SELECT jsonb_typeof(payload) AS kind, payload FROM email_outbox WHERE event_key=${key}`;
 assert.equal(stored.kind,'object');
 assert.deepEqual(stored.payload,payload);
 fail=false;sends=[];
 await outbox.drainerEmails(key,1);
 assert.deepEqual(sends[0].payload,payload);
});

test('timeout AFTER provider acceptance retries with one provider effect and immutable payload',async()=>{
 const key='timeout:accepted';await enqueue(key);sends=[];
 providerHook=async(body,options)=>{
  const previous=accepted.get(options.idempotencyKey);
  if(previous){assert.deepEqual(body,previous);return {data:{id:'deduped'},error:null};}
  accepted.set(options.idempotencyKey,body);throw new Error('timeout after acceptance');
 };
 try {
  await assert.rejects(outbox.drainerEmails(key,1),/timeout/);
  const [pending]=await db`SELECT * FROM email_outbox WHERE event_key=${key}`;assert.equal(pending.sent_at,null);assert.equal(pending.attempts,1);
  assert.equal(await outbox.drainerEmails(key,1),0,'backoff blocks immediate retry');
  await db`UPDATE email_outbox SET available_at=NOW() WHERE event_key=${key}`;
  assert.equal(await outbox.drainerEmails(key,1),1);
  assert.equal(accepted.size,1);assert.deepEqual(sends[0],sends[1]);
 }finally{providerHook=null;}
});

test('concurrent workers cannot deliver a currently leased job twice',async()=>{
 const key='workers:concurrent';await enqueue(key);fail=false;sends=[];
 let release, entered;
 const started=new Promise(r=>{entered=r;});const gate=new Promise(r=>{release=r;});
 providerHook=async()=>{entered();await gate;return {data:{id:'local'},error:null};};
 try {
  const first=outbox.drainerEmails(key,1);await started;
  assert.equal(await outbox.drainerEmails(key,1),0);
  assert.equal(sends.length,1);release();assert.equal(await first,1);
 }finally{release();providerHook=null;}
});

test('worker crash lease expires and stale owner cannot acknowledge a reclaimed job',async()=>{
 const key='workers:crash';await enqueue(key);fail=false;sends=[];
 let release, entered;const started=new Promise(r=>{entered=r;});const gate=new Promise(r=>{release=r;});
 let calls=0;
 providerHook=async()=>{if(++calls===1){entered();await gate;}return {data:{id:'same-provider-id'},error:null};};
 try {
  const stale=outbox.drainerEmails(key,1);await started;
  await db`UPDATE email_outbox SET lease_until=NOW()-INTERVAL '1 second' WHERE event_key=${key}`;
  assert.equal(await outbox.drainerEmails(key,1),1);
  release();assert.equal(await stale,0,'lease token fences stale acknowledgment');
  assert.deepEqual(sends[0],sends[1]);
 }finally{release();providerHook=null;}
});

test('retry budget is bounded and exhausted is never marked sent',async()=>{
 const key='retry:bounded';await enqueue(key);fail=true;sends=[];
 for(let i=0;i<8;i++){
  await db`UPDATE email_outbox SET available_at=NOW() WHERE event_key=${key}`;
  await assert.rejects(outbox.drainerEmails(key,1),/outage/);
 }
 fail=false;assert.equal(await outbox.drainerEmails(key,1),0);assert.equal(sends.length,8);
 const [job]=await db`SELECT * FROM email_outbox WHERE event_key=${key}`;assert.ok(job.exhausted_at);assert.equal(job.sent_at,null);
});

test('no automatic resend after the provider deduplication safety window',async()=>{
 const key='retry:expired';await enqueue(key);fail=false;sends=[];
 await db`UPDATE email_outbox SET first_attempt_at=NOW()-INTERVAL '23 hours',attempts=1 WHERE event_key=${key}`;
 assert.equal(await outbox.drainerEmails(key,1),0);assert.equal(sends.length,0);
 const [job]=await db`SELECT * FROM email_outbox WHERE event_key=${key}`;assert.ok(job.exhausted_at);assert.equal(job.sent_at,null);
});

test('enqueue failure rolls back BOTH payment and gift creation',async()=>{
 await db`CREATE FUNCTION reject_email() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'enqueue failure'; END $$`;
 await db`CREATE TRIGGER reject_email BEFORE INSERT ON email_outbox FOR EACH ROW EXECUTE FUNCTION reject_email()`;
 try {
  const [order]=await db`INSERT INTO orders(status) VALUES('PENDING') RETURNING *`;
  await assert.rejects(outbox.payerAvecConfirmation(order.id,payload),/enqueue failure/);
  const [unchanged]=await db`SELECT * FROM orders WHERE id=${order.id}`;assert.equal(unchanged.paid_at,null);assert.equal(unchanged.status,'PENDING');
  await assert.rejects(gifts.finaliserBonCadeau({id:'pi_atomic_rollback',amount:1000,currency:'eur',metadata:{email:'local@example.invalid'}}),/enqueue failure/);
  assert.equal((await db`SELECT * FROM promo_codes WHERE achat_payment_intent='pi_atomic_rollback'`).length,0);
 }finally{await db`DROP TRIGGER reject_email ON email_outbox`;await db`DROP FUNCTION reject_email()`;}
});

test('concurrent finalizers create one payment confirmation and one gift',async()=>{
 fail=false;sends=[];
 const [order]=await db`INSERT INTO orders(status) VALUES('PENDING') RETURNING *`;
 const winners=await Promise.all(Array.from({length:12},()=>outbox.payerAvecConfirmation(order.id,payload)));
 assert.equal(winners.filter(Boolean).length,1);
 const pi={id:'pi_concurrent_gift',amount:2000,currency:'eur',metadata:{email:'local@example.invalid'}};
 const bons=await Promise.all(Array.from({length:12},()=>gifts.finaliserBonCadeau(pi)));
 assert.equal(new Set(bons.map(b=>b.code)).size,1);
 assert.equal(sends.length,1);
});

test('retry endpoint fails closed and drains only with the configured bearer',async()=>{
 const {GET}=load('app/api/cron/email-outbox/route.ts');
 const old=process.env.CRON_SECRET;
 try {
  delete process.env.CRON_SECRET;
  assert.equal((await GET(new Request('http://local/api/cron/email-outbox',{headers:{authorization:'Bearer undefined'}}))).status,503);
  process.env.CRON_SECRET='local-only-secret';
  assert.equal((await GET(new Request('http://local/api/cron/email-outbox'))).status,401);
  fail=false;
  await enqueue('endpoint:pending');await enqueue('endpoint:exhausted');
  await db`UPDATE email_outbox SET available_at=NOW()+INTERVAL '1 day' WHERE event_key='endpoint:pending'`;
  await db`UPDATE email_outbox SET exhausted_at=NOW() WHERE event_key='endpoint:exhausted'`;
  const response=await GET(new Request('http://local/api/cron/email-outbox',{headers:{authorization:'Bearer local-only-secret'}}));
  assert.equal(response.status,200);const body=await response.json();assert.equal(typeof body.sent,'number');
  const [counts]=await db`SELECT count(*) FILTER (WHERE sent_at IS NULL AND exhausted_at IS NULL)::int AS pending, count(*) FILTER (WHERE sent_at IS NULL AND exhausted_at IS NOT NULL)::int AS exhausted FROM email_outbox`;
  assert.equal(body.pending,counts.pending);assert.equal(body.exhausted,counts.exhausted);
 } finally {if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});

test('lifecycle cron fails closed and resumes an old queued email without a payment callback',async()=>{
 const {GET}=load('app/api/cron/lifecycle-emails/route.ts');
 const old=process.env.CRON_SECRET;const key='gift:crash-before-drain';
 await enqueue(key);
 await db`UPDATE email_outbox SET created_at=NOW()-INTERVAL '2 days',available_at=NOW()-INTERVAL '1 day' WHERE event_key=${key}`;
 fail=false;sends=[];lifecycleReads.length=0;
 try {
  delete process.env.CRON_SECRET;
  assert.equal((await GET(new Request('http://local/api/cron/lifecycle-emails',{headers:{authorization:'Bearer undefined'}}))).status,503);
  process.env.CRON_SECRET='local-only-secret';
  for(const authorization of [undefined,'Bearer wrong']){
   const headers=authorization?{authorization}:{};
   assert.equal((await GET(new Request('http://local/api/cron/lifecycle-emails',{headers}))).status,401);
  }
  assert.equal(sends.length,0);assert.equal(lifecycleReads.length,0);
  const response=await GET(new Request('http://local/api/cron/lifecycle-emails',{headers:{authorization:'Bearer local-only-secret'}}));
  assert.equal(response.status,200);
  const body=await response.json();assert.ok(body.outbox?.sent>=1);assert.equal(body.outbox.failed,0);
  const [job]=await db`SELECT * FROM email_outbox WHERE event_key=${key}`;
  assert.ok(job.sent_at);assert.equal(job.attempts,1);
  assert.deepEqual(sends.find(s=>s.options.idempotencyKey===key)?.payload,payload);
 }finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});

test('lifecycle cron reports a failed drain but still runs the other tasks',async()=>{
 const {GET}=load('app/api/cron/lifecycle-emails/route.ts');
 const old=process.env.CRON_SECRET;const key='gift:lifecycle-outage';await enqueue(key);
 fail=true;sends=[];lifecycleReads.length=0;
 try {
  process.env.CRON_SECRET='local-only-secret';
  const response=await GET(new Request('http://local/api/cron/lifecycle-emails',{headers:{authorization:'Bearer local-only-secret'}}));
  assert.equal(response.status,200);const body=await response.json();
  assert.equal(body.outbox.failed,1);assert.equal(body.photos.sent,0);assert.equal(body.reviewRequests.sent,0);
  assert.ok(lifecycleReads.includes('getOrdersDueForFinalImage'));assert.ok(lifecycleReads.includes('getOrdersAwaitingPhotos'));
  const [job]=await db`SELECT * FROM email_outbox WHERE event_key=${key}`;
  assert.equal(job.sent_at,null);assert.equal(job.attempts,1);
 }finally{fail=false;if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});

test('offered gift also resumes its persisted custom email without creating another voucher',async()=>{
 const input={cle:'parrainage:local',email:'offert@example.invalid',montant:10,devise:'EUR',lang:'fr',raison:'test',textes:()=>({sujet:'Original',titre:'Merci',intro:'Bonus'})};
 fail=true;sends=[];
 await assert.rejects(gifts.creerBonOffert(input),/outage/);
 const stored=await persistedPayload(`gift:${input.cle}`);
 assert.equal(stored.from,'Cartoonova <support@cartoonova.com>');
 assert.deepEqual(stored.to,[input.email]);assert.equal(stored.subject,'Original');
 assert.match(stored.html,/Merci/);assert.match(stored.html,/Bonus/);
 assert.deepEqual(sends[0].payload,stored);
 fail=false;
 if(outbox)await db`UPDATE email_outbox SET available_at=NOW()`;
 assert.equal(await gifts.creerBonOffert({...input,textes:()=>({sujet:'Changed',titre:'Changed',intro:'Changed'})}),null);
 assert.equal(sends.length,2);
 assert.deepEqual(sends[0],sends[1]);
 const [count]=await db`SELECT count(*)::int AS n FROM promo_codes WHERE achat_payment_intent=${input.cle}`;assert.equal(count.n,1);
});

test('purchased gift resumes delivery of the SAME voucher after an outage',async()=>{
 const pi={id:'pi_gift_retry',amount:5000,currency:'eur',metadata:{email:'gift@example.invalid',prenom:'Test',message:'Original',lang:'fr'}};
 fail=true;sends=[];
 await assert.rejects(gifts.finaliserBonCadeau(pi),/outage/);
 const stored=await persistedPayload(`gift:${pi.id}`);
 assert.equal(stored.from,'Cartoonova <support@cartoonova.com>');
 assert.deepEqual(stored.to,[pi.metadata.email]);
 assert.equal(stored.subject,load('lib/email-i18n.ts').bonCadeauTextes.fr.emailSujet);
 assert.deepEqual(sends[0].payload,stored);
 const [original]=await db`SELECT * FROM promo_codes WHERE achat_payment_intent=${pi.id}`;
 assert.ok(original);assert.ok(stored.html.includes(original.code));
 fail=false;
 if(outbox)await db`UPDATE email_outbox SET available_at=NOW()`;
 const bon=await gifts.finaliserBonCadeau({...pi,metadata:{...pi.metadata,message:'Changed'}});
 assert.equal(bon.code,original.code);
 assert.equal(sends.length,2,'existing voucher must resume pending email');
 assert.deepEqual(sends[0],sends[1],'payload and provider key stay immutable');
});

test('paid order retries its confirmation after provider outage instead of losing it',async()=>{
 const [row]=await db`INSERT INTO orders(status,customer_email,options) VALUES('PENDING','local@example.invalid','{}') RETURNING *`;
 const order={...row,total_price:39,currency:'EUR',photo_urls:[],options:{format:'portrait',people:1,animals:0,printOption:'digital'}};
 fail=true;sends=[];
 await assert.rejects(finaliser(order,'webhook'),/outage/);
 const stored=await persistedPayload(`order:${row.id}`);
 assert.equal(stored.from,'Cartoonova <support@cartoonova.com>');
 assert.deepEqual(stored.to,[order.customer_email]);
 assert.deepEqual(sends[0].payload,stored);
 fail=false;
 if(outbox)await db`UPDATE email_outbox SET available_at=NOW()`;
 assert.equal(await finaliser(order,'page_succes'),false);
 assert.equal(sends.length,2,'a paid_at guard must not discard an unsent confirmation');
 assert.equal(sends[0].options.idempotencyKey,sends[1].options.idempotencyKey);
 const [job]=await db`SELECT * FROM email_outbox WHERE event_key=${'order:'+row.id}`;
 assert.ok(job.sent_at);assert.equal(job.attempts,2);
 assert.ok(measurements.some(([,data])=>data?.proprietes?.campagne==='confirmation'),'successful confirmation retains email analytics');
});
