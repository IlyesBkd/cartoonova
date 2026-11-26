import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {execFileSync} from 'node:child_process';
import postgres from 'postgres';
import {loadDeep} from './order-delivery-harness.mjs';
const root=path.resolve(import.meta.dirname,'..'),dir=mkdtempSync(path.join(tmpdir(),'customer-history-'));
const env=Object.fromEntries(['PATH','HOME','TMPDIR'].map(k=>[k,process.env[k]]));
const pg=(cmd,args)=>execFileSync('/usr/lib/postgresql/18/bin/'+cmd,args,{env,timeout:15000,stdio:'pipe'});
let db,started=false,history,journal,route,sendEmail,providerMode='ok',calls=0,deny=false,postFailure=false;
const A='10000000-0000-0000-0000-000000000001',B='10000000-0000-0000-0000-000000000002',C='10000000-0000-0000-0000-000000000003',D='10000000-0000-0000-0000-000000000004';
const migration=readFileSync(path.join(root,'migrations/20261124_customer_history.sql'),'utf8');
const input=(query='orderId='+A)=>history.parseHistoryInput(new URLSearchParams(query));
let firstSnapshot=null;
const all=async query=>{let data=await history.getCustomerHistory(db,input(query)),events=[...data.events];firstSnapshot=data.nextCursor?JSON.parse(Buffer.from(data.nextCursor,'base64url').toString()).snapshot:null;while(data.nextCursor){data=await history.getCustomerHistory(db,input(query+'&cursor='+data.nextCursor));events.push(...data.events);}return events;};
before(async()=>{
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));assert.notEqual(port,5432);
 pg('initdb',['-D',dir+'/pg','-U','history_test','--auth=trust','--no-locale','--encoding=UTF8']);
 pg('pg_ctl',['-D',dir+'/pg','-l',dir+'/pg.log','-o',`-h 127.0.0.1 -p ${port} -k ${dir}`,'-w','start']);started=true;
 db=postgres(`postgresql://history_test@127.0.0.1:${port}/postgres`,{max:1,onnotice(){}});
 await db`CREATE TABLE orders(id uuid PRIMARY KEY,customer_email text,customer_name text,created_at timestamptz DEFAULT now(),paid_at timestamptz,photo_urls jsonb DEFAULT '[]',photos_received_at timestamptz,photos_updated_at timestamptz,final_image_url text,final_image_scheduled_at timestamptz,final_image_sent_at timestamptz,poster_confirmation_status text,poster_confirmation_token text,poster_confirmation_note text,status text,shipping_details jsonb)`;
 await db`CREATE TABLE support_messages(id serial PRIMARY KEY,message_id text,from_email text,subject text,body_text text,received_at timestamptz DEFAULT now(),order_id uuid)`;
 await db`CREATE TABLE support_replies(id serial PRIMARY KEY,support_message_id int,order_id uuid,to_email text,subject text,body_text text,provider_id text,sent_at timestamptz DEFAULT now())`;
 await db.unsafe(readFileSync(path.join(root,'migrations/20261104_support_prepared_replies.sql'),'utf8'));
 await db.unsafe(readFileSync(path.join(root,'migrations/20261026_order_delivery_effects.sql'),'utf8'));
 await db.unsafe(readFileSync(path.join(root,'migrations/20261123_order_shipping_groups.sql'),'utf8'));
 await db.unsafe(readFileSync(path.join(root,'migrations/2026-10-email-outbox.sql'),'utf8'));
 await db`CREATE TABLE retouches(id serial PRIMARY KEY,order_id uuid,note text,photos jsonb DEFAULT '[]',demandee_le timestamptz DEFAULT now())`;
 await db`CREATE TABLE reviews(id serial PRIMARY KEY,order_id text,note int,texte text,statut text,cree_le timestamptz DEFAULT now())`;
 await db.unsafe(migration);await db.unsafe(migration);
 const replacements={'@/lib/db':{withFreshDatabaseClient:fn=>fn(db)},'@/lib/adminAuth':{refuserSiPasAdmin:async()=>deny?new Response('{}',{status:401}):null},resend:{Resend:class{emails={send:async()=>{
 calls++;assert.ok((await db`SELECT id FROM customer_history_events WHERE kind='email' AND status='uncertain'`).length,'attempt committed before provider');
 if(providerMode==='network')throw Error('private network error');if(providerMode==='refused')return {data:null,error:{name:'validation_error',message:'private'}};
 if(postFailure)await db`ALTER TABLE customer_history_events RENAME TO customer_history_events_offline`;
 return {data:{id:'mock-provider-'+calls},error:null};}};}}};
 history=loadDeep('lib/customerHistory.ts',replacements);journal=loadDeep('lib/customerHistoryJournal.ts',replacements);route=loadDeep('app/api/admin/customer-history/route.ts',replacements);sendEmail=loadDeep('lib/envoiEmail.ts',replacements).envoyerEmail;
 await db`INSERT INTO orders(id,customer_email,customer_name,paid_at) VALUES(${A},' Client@Example.invalid ','Same Name',now()),(${B},'client@example.invalid','Same Name',now()),(${C},'other@example.invalid','Same Name',now()),(${D},'other@example.invalid','Same Name',now())`;
});
after(async()=>{if(db)await db.end({timeout:2});if(started)pg('pg_ctl',['-D',dir+'/pg','-m','fast','-w','stop']);});

// Diagnostic only (branch ci-diagnostic-history): explains a missing event on CI.
async function explain(events,id,label){
 const bySource={};for(const e of events)bySource[e.source]=(bySource[e.source]??0)+1;
 const [clock]=await db`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') s,current_setting('TimeZone') tz,current_schema() sch,current_setting('search_path') sp,version() v`;
 const pages=[];let data=await history.getCustomerHistory(db,input('orderId='+A+'&limit=100'));
 for(let i=0;i<14;i++){pages.push({n:data.events.length,firstId:data.events[0]?.id,firstAt:data.events[0]?.at,lastId:data.events.at(-1)?.id,lastAt:data.events.at(-1)?.at,hit:data.events.some(e=>e.id===id),cursor:data.nextCursor&&JSON.parse(Buffer.from(data.nextCursor,'base64url').toString())});
  if(!data.nextCursor)break;data=await history.getCustomerHistory(db,input('orderId='+A+'&limit=100&cursor='+data.nextCursor));}
 return 'DIAG '+JSON.stringify({label,id,node:process.version,total:events.length,unique:new Set(events.map(e=>e.id)).size,bySource,clock,pages});
}
test('validation rejects ambiguity, malformed IDs, out-of-bounds limits and scoped cursors',()=>{
 for(const q of ['', 'orderId=bad','orderId='+A+'&supportMessageId=1','supportMessageId=0','supportMessageId=2147483648','orderId='+A+'&limit=19','orderId='+A+'&cursor=garbage'])assert.throws(()=>input(q));
 assert.equal(input().limit,50);
});
test('exact normalized email, no name heuristic; explicit alternate support does not expand identity',async()=>{
 await db`INSERT INTO support_messages(message_id,from_email,subject,order_id) VALUES('alt','alternate@example.invalid','Explicit',${A}),('unrelated','other@example.invalid','Other',${C})`;
 const h=await history.getCustomerHistory(db,input());assert.deepEqual(h.orders.map(o=>o.id).sort(),[A,B]);assert.ok(h.events.some(e=>e.subject==='Explicit'));assert.ok(!h.events.some(e=>e.subject==='Other'));
 const alt=await history.getCustomerHistory(db,input('supportMessageId=1'));assert.equal(alt.customer.email,'alternate@example.invalid');assert.deepEqual(alt.orders.map(o=>o.id),[A]);
});
test('retouches >500 and support >200 are not truncated, stable pagination and new insert exclusion',async()=>{
 await db`INSERT INTO retouches(order_id,note,demandee_le) SELECT ${A}::uuid,'retouch '||n,'2026-01-01'::timestamptz FROM generate_series(1,510) n`;
 await db`INSERT INTO support_messages(message_id,from_email,body_text,received_at) SELECT 'many-'||n,'client@example.invalid','body '||n,'2026-01-02'::timestamptz FROM generate_series(1,210) n`;
 const first=await history.getCustomerHistory(db,input('orderId='+A+'&limit=20'));
 await db`INSERT INTO retouches(order_id,note) VALUES(${A},'new-after-page')`;
 let page=first,events=[...page.events];while(page.nextCursor){page=await history.getCustomerHistory(db,input('orderId='+A+'&limit=20&cursor='+page.nextCursor));events.push(...page.events);}
 assert.equal(events.filter(e=>e.source==='retouches').length,510);assert.equal(events.filter(e=>e.source==='support_messages').length,211);assert.equal(new Set(events.map(e=>e.id)).size,events.length);assert.ok(!events.some(e=>e.body==='new-after-page'));
});
test('all delivery versions, extras are not called retouch; grouped shipment filters other customer IDs',async()=>{
 for(const [kind,version] of [['final_image','v1'],['final_image','v2'],['extras','v3']])await db`INSERT INTO order_delivery_effects(order_id,kind,version,status,email_id) VALUES(${A},${kind},${version},'sent',${version})`;
 await db`INSERT INTO order_shipping_effects(supplier_ref,fingerprint,details,status,email_id) VALUES('123456','hash',${JSON.stringify({orderIds:[A,B,C],tracking:[{number:'TRACK1'}]})}::text::jsonb,'sent','ship1')`;
 const events=await all('orderId='+A+'&limit=100');assert.equal(events.filter(e=>e.source==='order_delivery_effects').length,3);
 const group=events.find(e=>e.source==='order_shipping_effects');assert.deepEqual(group.orderIds,[A,B]);assert.ok(!JSON.stringify(group).includes(C));assert.ok(!events.find(e=>e.kind==='delivery.extras').title.includes('Retouche'));
});
test('outbox never uses creation as proof of sending; body and reviews available',async()=>{
 for(const [key,sent,failed] of [['queued',false,false],['sent',true,false],['failed',false,true]])await db`INSERT INTO email_outbox(event_key,payload,sent_at,exhausted_at) VALUES(${key},${JSON.stringify({to:['client@example.invalid'],subject:key,text:'readable'})}::text::jsonb,${sent?new Date():null},${failed?new Date():null})`;
 await db`INSERT INTO reviews(order_id,note,texte,statut) VALUES(${A},5,'Very good','publie')`;
 const events=await all('orderId='+A+'&limit=100');for(const [key,state] of [['queued','scheduled'],['sent','sent'],['failed','failed']])assert.equal(events.find(e=>e.id==='outbox:'+key).status,state);assert.ok(events.some(e=>e.body==='Very good'));
});
test('journal retains changes before overwrites, immutable and excludes token',async()=>{
 await db`UPDATE orders SET photo_urls='["photo1"]',poster_confirmation_token='SECRET',final_image_scheduled_at=now()+interval '1 day',poster_confirmation_note='First' WHERE id=${A}`;
 await db`UPDATE orders SET photo_urls='["photo2"]',final_image_scheduled_at=NULL,poster_confirmation_note='Second' WHERE id=${A}`;
 const rows=await db`SELECT * FROM customer_history_events WHERE order_id=${A}`;assert.ok(JSON.stringify(rows).includes('photo1'));assert.ok(JSON.stringify(rows).includes('First'));assert.ok(!JSON.stringify(rows).includes('SECRET'));
 await assert.rejects(db`UPDATE customer_history_events SET subject='x'`);await assert.rejects(db`DELETE FROM customer_history_events`);
});
test('central wrapper journals before provider, text and attachment names; accepted/refused/network outcomes',async()=>{
 const payload={from:'test@example.invalid',to:['client@example.invalid'],subject:'wrapper',html:'<p>Readable</p>',attachments:[{filename:'name.txt',content:'BINARY_NOT_STORED'}]};
 providerMode='ok';await sendEmail(payload,{idempotencyKey:'wrapper-key'});
 let rows=await db`SELECT * FROM customer_history_events WHERE subject='wrapper'`;assert.ok(rows.some(r=>r.status==='sent'&&r.provider_id));assert.ok(rows.some(r=>r.body.includes('Readable')));assert.ok(JSON.stringify(rows).includes('name.txt'));assert.ok(!JSON.stringify(rows).includes('BINARY_NOT_STORED'));
 providerMode='refused';await assert.rejects(sendEmail({...payload,subject:'refused'}),/Resend a refuse/);
 providerMode='network';await assert.rejects(sendEmail({...payload,subject:'network'}));
 rows=await db`SELECT subject,status FROM customer_history_events WHERE subject IN ('refused','network')`;assert.ok(rows.some(r=>r.subject==='refused'&&r.status==='failed'));assert.ok(!rows.some(r=>r.subject==='network'&&r.status==='sent'));
 providerMode='ok';postFailure=true;try{const result=await sendEmail({...payload,subject:'post-failure'});assert.ok(result.data.id);}finally{postFailure=false;await db`ALTER TABLE customer_history_events_offline RENAME TO customer_history_events`;}
});
test('provider dedup retains source order association and reply body; orphan prepared uncertain not sent',async()=>{
 await db`INSERT INTO support_replies(order_id,to_email,subject,body_text,provider_id) VALUES(${A},'client@example.invalid','same','approved reply','same-provider')`;
 const attempt=await journal.beginEmailHistory({to:'client@example.invalid',subject:'same',text:'approved reply'});await journal.finishEmailHistory(attempt,'sent','same-provider');
 await db`INSERT INTO support_prepared_replies(id,target_type,target_id,frozen_order_id,to_email,subject,body_text,transport,approval_hash,status) VALUES(gen_random_uuid(),'order',${A},${A},'client@example.invalid','orphan','not sent','{}',${'a'.repeat(64)},'sending')`;
 const events=await all('orderId='+A+'&limit=100');assert.equal(events.filter(e=>e.subject==='same').length,1);assert.deepEqual(events.find(e=>e.subject==='same').orderIds,[A]);assert.equal(events.find(e=>e.subject==='orphan').status,'uncertain');
});
test('microsecond cursor preserves every event; outbox and provider journals deduplicate',async()=>{
 await db`INSERT INTO support_messages(message_id,from_email,body_text,received_at) SELECT 'micro-'||n,'client@example.invalid','micro '||n,'2026-02-01'::timestamptz+(n*interval '1 microsecond') FROM generate_series(1,55) n`;
 const events=await all('orderId='+A+'&limit=20');assert.equal(events.filter(e=>e.body?.startsWith('micro ')).length,55);
 await db`INSERT INTO email_outbox(event_key,payload,sent_at) VALUES('dedup-outbox',${JSON.stringify({to:['client@example.invalid'],subject:'dedup-outbox',text:'one message'})}::text::jsonb,now())`;
 const attempt=await journal.beginEmailHistory({to:'client@example.invalid',subject:'dedup-outbox',text:'one message'},'dedup-outbox');await journal.finishEmailHistory(attempt,'sent','outbox-provider');
 const dedup=await all('orderId='+A+'&limit=100');assert.equal(dedup.filter(e=>e.subject==='dedup-outbox').length,1);
});
test('migration supports minimal build fixture and GET aggregation is SQL read-only',async()=>{
 await db.begin(async tx=>{await tx`CREATE SCHEMA history_minimal`;await tx`SET LOCAL search_path TO history_minimal`;
   await tx`CREATE TABLE orders(id uuid PRIMARY KEY,customer_email text)`;await tx.unsafe(migration);await tx.unsafe(migration);
   await tx`INSERT INTO orders(id,customer_email) VALUES(${A},'minimal@example.invalid')`;
   assert.equal((await tx`SELECT count(*)::int n FROM customer_history_events`)[0].n,0);
 });
 const readonly=loadDeep('app/api/admin/customer-history/route.ts',{'@/lib/db':{withFreshDatabaseClient:fn=>db.begin('read only',fn)},'@/lib/adminAuth':{refuserSiPasAdmin:async()=>null}});
 const response=await readonly.GET(new Request('http://local/api/admin/customer-history?orderId='+A));assert.equal(response.status,200);
 await assert.rejects(db`TRUNCATE customer_history_events`);
});
test('journal presentation is French, before/after readable and preparation never proves sending',async()=>{
 const changes=[
  ['photo_urls',[],['photo-old'],'Photos reçues'],['photo_urls',['photo-old'],['photo-new'],'Photos modifiées'],['photo_urls',['photo-new'],[],'Photos retirées'],
  ['final_image_url',null,'portrait-old','Portrait enregistré'],['final_image_url','portrait-old','portrait-new','Portrait remplacé'],
  ['final_image_scheduled_at',null,'2026-12-01T10:00:00Z','Envoi programmé'],['final_image_scheduled_at','2026-12-01','2026-12-02','Envoi reprogrammé'],['final_image_scheduled_at','2026-12-02',null,'Envoi annulé'],
  ['poster_confirmation_sent_at',null,'2026-11-24','Aperçu préparé (envoi non prouvé)'],
  ['poster_confirmation_status',null,'confirmed','Portrait validé'],['poster_confirmation_status','confirmed','changes_requested','Retouche demandée'],
  ['status','paid','in_progress','Statut modifié'],['fournisseur_ref',null,'PRINT-42','Impression référencée'],['cout',null,12,'Coût enregistré'],['suivi_url',null,'https://tracking.invalid/42','Suivi enregistré'],
  ['poster_confirmation_note','ancienne note','Merci de garder les lunettes','Note du client modifiée'],
 ];
 for(const [field,before,after,title] of changes){
  const [row]=await db`INSERT INTO customer_history_events(customer_email,order_id,kind,status,details) VALUES('client@example.invalid',${A},${'order.'+field},'recorded',${db.json({field,before,after})}) RETURNING id`;
  const evs=await all('orderId='+A+'&limit=100'),event=evs.find(e=>e.id==='journal:'+row.id);
  if(!event){const [r]=await db`SELECT to_char(at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') at FROM customer_history_events WHERE id=${row.id}`;const skew=await Promise.all(Array.from({length:6},()=>db`SELECT pg_backend_pid() pid,extract(epoch FROM (clock_timestamp()-(SELECT at FROM customer_history_events WHERE id=${row.id})))*1e6 AS micros_after`));assert.fail('ROWAT '+JSON.stringify({rowAt:r.at,firstSnapshot,skew:skew.map(x=>x[0])})+' '+await explain(evs,'journal:'+row.id,field));}
  assert.equal(event.title,title);assert.equal(event.status,'recorded');assert.match(event.details,/Avant :/);assert.match(event.details,/Après :/);assert.ok(!event.details.includes('"field"'));
  if(field==='status')assert.match(event.details,/Payée\nAprès : En cours/);
  if(field==='poster_confirmation_status'&&after==='changes_requested')assert.match(event.details,/Après : Retouche demandée/);
  if(field==='poster_confirmation_note')assert.match(event.details,/Merci de garder les lunettes/);
 }
});
test('only explicit delivery metadata identifies retouch; immutable sent date and neutral legacy',async()=>{
 for(const [version,status,metadata] of [
  ['new-initial','sent',{mode:'initial',recipient:'gift@example.invalid',portraitUrl:'https://portrait.invalid/initial',sentAt:'2026-03-01T10:00:00Z'}],
  ['new-retouch','sent',{mode:'retouch',recipient:'gift@example.invalid',portraitUrl:'https://portrait.invalid/retouch',sentAt:'2026-03-02T10:00:00Z'}],
  ['not-sent-retouch','uncertain',{mode:'retouch'}],['unknown-mode','sent',{mode:'unknown'}],['old-ninth','sent',null],
 ])await db`INSERT INTO order_delivery_effects(order_id,kind,version,status,artifacts) VALUES(${A},'final_image',${version},${status},${db.json(metadata?{deliveryHistory:metadata}:{})})`;
 const events=await all('orderId='+A+'&limit=100'),find=v=>events.find(e=>e.id===`delivery:${A}:final_image:${v}`);
 for(const v of ['new-initial','new-retouch','not-sent-retouch','unknown-mode','old-ninth'])assert.ok(find(v),await explain(events,`delivery:${A}:final_image:${v}`,v));
 assert.equal(find('new-initial').title,'Portrait envoyé');assert.equal(find('new-retouch').title,'Portrait retouché envoyé');assert.equal(find('new-retouch').at,'2026-03-02T10:00:00.000Z');
 assert.match(find('new-retouch').details,/gift@example.invalid/);assert.match(find('new-retouch').details,/https:\/\/portrait.invalid\/retouch/);
 for(const version of ['not-sent-retouch','unknown-mode','old-ninth'])assert.equal(find(version).title,'Livraison de portrait (version enregistrée)');
 assert.equal(find('not-sent-retouch').status,'uncertain');assert.match(find('old-ninth').details,/journal ancien/);
});
test('gift email is recovered by exact ledger provider/key links without merging gift mailbox',async()=>{
 for(const [version,provider,key] of [['gift-provider','gift-provider-id',null],['gift-key',null,`delivery/${B}/final_image/gift-key`]]){
  const attempt=await journal.beginEmailHistory({to:'gift@example.invalid',subject:version,text:'BODY-'+version},key??undefined);
  await journal.finishEmailHistory(attempt,'sent','journal-'+version);
  if(provider)await db`INSERT INTO customer_history_events(customer_email,kind,status,subject,body,provider_id,sent_at) VALUES('gift@example.invalid','email','sent',${version},${'BODY-'+version},${provider},now())`;
  await db`INSERT INTO order_delivery_effects(order_id,kind,version,status,email_id) VALUES(${B},'final_image',${version},'sent',${provider})`;
 }
 const privateAttempt=await journal.beginEmailHistory({to:'gift@example.invalid',subject:'PRIVATE-GIFT',text:'PRIVATE-GIFT'});await journal.finishEmailHistory(privateAttempt,'sent','unrelated-gift');
 await db`INSERT INTO support_messages(message_id,from_email,subject,body_text) VALUES('private-gift','gift@example.invalid','PRIVATE-GIFT-SUPPORT','PRIVATE-GIFT-SUPPORT')`;
 const events=await all('orderId='+B+'&limit=100');
 for(const version of ['gift-provider','gift-key'])assert.ok(events.some(e=>e.body==='BODY-'+version));
 assert.ok(!JSON.stringify(events).includes('PRIVATE-GIFT'));
 const other=await all('orderId='+C+'&limit=100');assert.ok(!JSON.stringify(other).includes('BODY-gift'));
});
test('legacy supplier/cost/tracking are current undated states and review marker is not a second email',async()=>{
 await db`ALTER TABLE orders ADD COLUMN fournisseur_ref text, ADD COLUMN cout numeric, ADD COLUMN cout_note text, ADD COLUMN suivi_url text, ADD COLUMN suivi_transporteur text, ADD COLUMN review_request_sent_at timestamptz`;
 await db`ALTER TABLE orders DISABLE TRIGGER customer_history_order_changes`;
 try{await db`UPDATE orders SET fournisseur_ref='LEGACY-PRINT',cout=12.5,cout_note='Coût réel',suivi_url='https://tracking.invalid/legacy',suivi_transporteur='Transporteur historique',shipping_details=${db.json({tracking:[{number:'TRACK-A',url:'https://tracking.invalid/a',carrier:'Carrier A'},{number:'TRACK-B',url:'https://tracking.invalid/b',carrier:'Carrier B'}],orderIds:[B,C]})},review_request_sent_at=now() WHERE id=${B}`;}
 finally{await db`ALTER TABLE orders ENABLE TRIGGER customer_history_order_changes`;}
 for(const subject of ['review-one','review-two']){const attempt=await journal.beginEmailHistory({to:'client@example.invalid',subject,text:'distinct-'+subject});await journal.finishEmailHistory(attempt,'sent',subject);}
 const events=await all('orderId='+B+'&limit=100'),current=events.filter(e=>e.id.startsWith('current:'+B+':'));
 assert.equal(current.length,6);for(const e of current){assert.equal(e.at,null);assert.equal(e.status,'recorded');assert.match(e.title,/date inconnue/);}
 const text=JSON.stringify(current);for(const value of ['LEGACY-PRINT','12.5 €','Coût réel','https://tracking.invalid/legacy','Transporteur historique','TRACK-A','TRACK-B','Carrier A','Carrier B'])assert.ok(text.includes(value),value);
 assert.ok(!text.includes(C));
 const marker=events.find(e=>e.kind==='order.review_request'&&e.orderIds.includes(B));assert.equal(marker.status,'recorded');assert.match(marker.details,/pas un envoi supplémentaire/);
 for(const subject of ['review-one','review-two'])assert.equal(events.filter(e=>e.subject===subject&&e.status==='sent').length,1);
 // A chronologically proven current value needs no additional undated fallback.
 await db`UPDATE orders SET fournisseur_ref='NEW-PRINT' WHERE id=${B}`;
 const next=await all('orderId='+B+'&limit=100');assert.ok(!next.some(e=>e.id===`current:${B}:fournisseur_ref`));assert.ok(next.some(e=>e.title==='Impression référencée'&&e.details.includes('NEW-PRINT')));
});
test('GET authorization, private no-store, validation before history SQL; unavailable optional source warns',async()=>{
 deny=true;assert.equal((await route.GET(new Request('http://local/api/admin/customer-history?orderId='+A))).status,401);deny=false;
 const bad=await route.GET(new Request('http://local/api/admin/customer-history?orderId=bad'));assert.equal(bad.status,400);
 const response=await route.GET(new Request('http://local/api/admin/customer-history?orderId='+A));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
 await db`ALTER TABLE reviews RENAME TO reviews_offline`;
 const h=await history.getCustomerHistory(db,input());assert.ok(h.warnings.includes('Source indisponible : reviews.'));
});
