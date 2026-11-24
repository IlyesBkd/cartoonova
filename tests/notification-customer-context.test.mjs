import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fixture,transport,joined} from './telegram-test-helpers.mjs';
import {loadCustomerContext,customerContextSummary,redact} from '../scripts/customer-notification-context.mjs';
import {loadContext,inferenceContext,formatOrderBrief} from '../ops/support-context-v1/context.mjs';
import {generateDraft,state,runOnce as emailOnce} from '../ops/support-context-v1/worker.mjs';
import {runOnce as chatOnce,draftInput} from '../scripts/chat-telegram-worker.mjs';
import {notificationParts} from '../scripts/telegram-progressive.mjs';
const root=new URL('../',import.meta.url),A='10000000-0000-0000-0000-000000000001',B='10000000-0000-0000-0000-000000000002',C='10000000-0000-0000-0000-000000000003';
let f;
const noSupplier=async()=>({status:'not_applicable',evidence:[],limitations:[]});
const load=(row,options={})=>loadContext(f.db,row,{supplierEvidence:noSupplier,...options});
const reply=JSON.stringify({language:'it',messageFR:'Où est le portrait ?',draftClient:'Buongiorno,\nIl team Cartoonova',draftFR:'Bonjour,\nL’équipe Cartoonova'});
const validate=c=>execFileSync('python3',['-B','-c',`import runpy,json,sys;m=runpy.run_path('ops/support-context-v1/hermes_inference.py');m['validate_payload'](json.load(sys.stdin))`],{cwd:new URL('..',import.meta.url),input:JSON.stringify({subject:'test',bodyText:'Dove è il ritratto?',context:inferenceContext(c)}),stdio:['pipe','pipe','pipe'],env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,PYTHONDONTWRITEBYTECODE:'1'}});
before(async()=>{
 f=await fixture();
 await f.db`ALTER TABLE orders ADD PRIMARY KEY(id),ADD customer_name text,ADD final_image_url text,ADD final_image_sent_at timestamptz,ADD final_image_scheduled_at timestamptz,ADD poster_confirmation_status text,ADD poster_confirmation_image_url text,ADD poster_confirmation_sent_at timestamptz,ADD poster_confirmation_note text,ADD shipping_details jsonb,ADD fournisseur_ref text,ADD suivi_url text,ADD suivi_transporteur text,ADD expedie_le timestamptz`;
 await f.db`ALTER TABLE support_replies ADD support_message_id int,ADD order_id uuid,ADD subject text,ADD provider_id text`;
 await f.db`CREATE TABLE retouches(id serial PRIMARY KEY,order_id uuid,note text,photos jsonb,demandee_le timestamptz DEFAULT now())`;
 for(const name of ['20261104_support_prepared_replies.sql','20261026_order_delivery_effects.sql','20261123_order_shipping_groups.sql','2026-10-email-outbox.sql','20261124_customer_history.sql'])await f.db.unsafe(readFileSync(new URL('migrations/'+name,root),'utf8'));
 await f.db`INSERT INTO orders(id,customer_email,customer_name,created_at,paid_at,status,options) VALUES(${A},' Client@Example.invalid ','PERSONNE PRIVEE','2026-01-01','2026-01-02','paid','{}'),(${B},'client@example.invalid','PERSONNE PRIVEE','2026-02-01',NULL,'awaiting_payment','{}'),(${C},'gift@example.invalid','TIERS SECRET','2026-02-01',NULL,'paid','{}')`;
});
after(async()=>{if(f)await f.close();});
test('same exact address, multiple including unpaid orders; old exchanges retained, strict cutoff and no foreign explicit linkage',async()=>{
 await f.add('ancienne demande pertinente','client@example.invalid',864000,'email');
 await f.db`INSERT INTO support_replies(to_email,body_text,sent_at) VALUES(' CLIENT@EXAMPLE.INVALID ','Ancienne réponse utile',now()-interval '9 days')`;
 await f.add('ETRANGER À NE PAS LIRE','gift@example.invalid',1000,'email');
 const id=await f.add('Dove è il ritratto?','client@example.invalid',100,'email');
 await f.db`INSERT INTO support_messages(message_id,from_email,body_text,received_at,order_id) SELECT 'foreign-linked','foreign@example.invalid','FUITE ETRANGERE',received_at-interval '1 second',${A} FROM support_messages WHERE id=${id}`;
 await f.db`INSERT INTO support_replies(to_email,body_text,sent_at) SELECT 'client@example.invalid','ÉGAL OU FUTUR',received_at FROM support_messages WHERE id=${id}`;
 await f.add('FUTUR','client@example.invalid',0,'email');
 const c=await load({id});assert.equal(c.linkage,'ambiguous');assert.equal(c.selectedOrder,null);assert.equal(c.orders.length,2);assert.ok(c.orders.some(o=>!o.paidAt));
 const text=JSON.stringify(c);assert.match(text,/ancienne demande pertinente/);assert.match(text,/Ancienne réponse utile/);assert.doesNotMatch(text,/ETRANGER|FUITE|ÉGAL OU FUTUR|FUTUR|PERSONNE|TIERS/);assert.ok(c.history.every(h=>h.at<c.messageAt));validate(c);
 assert.match(customerContextSummary(c),/aucune sélectionnée/);
});
test('without an order retains exact-email history; contradiction excludes all customer context',async()=>{
 await f.add('Sans achat mais déjà échangé','new@example.invalid',864000,'contact');const id=await f.add('Hello','new@example.invalid',100,'contact');
 let c=await load({id});assert.equal(c.linkage,'none');assert.match(JSON.stringify(c.history),/déjà échangé/);validate(c);
 await f.db`UPDATE support_messages SET order_id=${C} WHERE id=${id}`;c=await load({id});assert.equal(c.linkage,'contradiction');assert.equal(c.identity,'unknown');assert.deepEqual(c.history,[]);assert.deepEqual(c.orders,[]);assert.deepEqual(c.events,[]);validate(c);
});
test('real admin aggregator: delivery modes, retouches, current undated traces, distinct email outcomes and safe projection',async()=>{
 await f.db`UPDATE orders SET final_image_url='https://storage.invalid/private?token=SECRET',poster_confirmation_image_url='https://storage.invalid/preview?token=SECRET',poster_confirmation_status='confirmed',fournisseur_ref='SUPPLIER_SECRET',suivi_url='https://track.invalid/?token=SECRET',final_image_scheduled_at=now()+interval '1 day' WHERE id=${A}`;
 await f.db`INSERT INTO retouches(order_id,note,demandee_le) VALUES(${A},'La couleur du pull est à corriger ; email tiers gift@example.invalid ; 12 rue Secrète ; +33 6 12 34 56 78 ; token=RAW_SECRET',now()-interval '3 days')`;
 for(const [v,mode] of [['initial-1','initial'],['retouch-1','retouch'],['legacy-version-99',null]])await f.db`INSERT INTO order_delivery_effects(order_id,kind,version,status,email_id,artifacts) VALUES(${A},'final_image',${v},'sent',${v},${JSON.stringify(mode?{deliveryHistory:{mode,recipient:'TIERS SECRET <gift@example.invalid>',portraitUrl:'https://private.invalid/?token=SECRET',sentAt:'2026-02-01T00:00:00Z'}}:{})}::text::jsonb)`;
 for(const [key,sent,failed,lease] of [['queued',false,false,false],['sent',true,false,false],['failed',false,true,false],['uncertain',false,false,true]])await f.db`INSERT INTO email_outbox(event_key,payload,sent_at,exhausted_at,lease_until) VALUES(${key},${JSON.stringify({to:['client@example.invalid'],subject:'private subject',text:'TIERS SECRET 12 rue Secrète +33612345678'})}::text::jsonb,${sent?new Date():null},${failed?new Date():null},${lease?new Date(Date.now()+100000):null})`;
 const id=await f.add('Dove è il ritratto?','client@example.invalid',100,'email');await f.db`UPDATE support_messages SET order_id=${A} WHERE id=${id}`;
 await f.db`INSERT INTO support_prepared_replies(id,target_type,target_id,frozen_order_id,to_email,subject,body_text,transport,approval_hash,status) VALUES(gen_random_uuid(),'order',${A},${A},'client@example.invalid','prepared','PRIVATE PREPARED BODY','{}',${'a'.repeat(64)},'uncertain')`;
 const c=await load({id});assert.equal(c.linkage,'verified');validate(c);
 assert.ok(c.events.some(e=>e.title==='Réponse : résultat incertain'&&e.status==='uncertain'));assert.doesNotMatch(JSON.stringify(c),/PRIVATE PREPARED BODY/);
 assert.ok(c.events.some(e=>e.title==='Portrait envoyé'));assert.ok(c.events.some(e=>e.title==='Portrait retouché envoyé'));assert.ok(c.events.some(e=>e.title==='Livraison de portrait (version enregistrée)'));
 assert.ok(c.events.some(e=>e.kind==='retouch.request'&&e.text.includes('couleur')));assert.ok(c.events.some(e=>e.at===null));
 for(const status of ['recorded','scheduled','sent','failed','uncertain'])assert.ok(c.events.some(e=>e.status===status),status);
 assert.doesNotMatch(JSON.stringify(c),/TIERS SECRET|SUPPLIER_SECRET|RAW_SECRET|gift@example|12 rue|33612345678|storage.invalid|token=|portraitUrl/);
 const output=joined(notificationParts({id,email:'client@example.invalid',body:'Dove è il ritratto?',receivedAt:c.messageAt,channel:'email',orderSummary:formatOrderBrief(c),customerContext:inferenceContext(c),preparing:false,language:'it',draft:'Buongiorno,\nIl team Cartoonova',draftFR:'Bonjour,\nL’équipe Cartoonova',translation:{status:'ready',text:'Où est le portrait ?'}}));
 assert.match(output,/Contexte client interne/);assert.match(output,/Portrait retouché envoyé/);assert.match(output,/Rien d’envoyé au client/);
 writeFileSync('/home/hermes/.hermes/profiles/cartoonova/cache/notification-context-preview.txt','EXEMPLE FICTIF — aucun envoi réel\n\n'+output);
});
test('adversarial third-party address and credential are excluded from history, retouch, inference and summary',async()=>{
 const address='Livrer chez ma sœur au 8 impasse des lilas, 75012 Paris.';
 const credential='sk-proj-'+'NOTAREALKEY'.repeat(4);
 await f.add('Ancien échange : '+address+' ; '+credential,'privacy@example.invalid',1000,'email');
 const id=await f.add('Où en est le portrait ?','privacy@example.invalid',100,'email');
 await f.db`INSERT INTO orders(id,customer_email,created_at,status,options) VALUES('20000000-0000-0000-0000-000000000001','privacy@example.invalid',now(),'paid','{}')`;
 await f.db`INSERT INTO retouches(order_id,note,demandee_le) VALUES('20000000-0000-0000-0000-000000000001',${address+' ; '+credential},now()-interval '1 day')`;
 const c=await load({id});validate(c);
 assert.ok(c.history.length);assert.ok(c.events.some(e=>e.kind==='retouch.request'));
 for(const value of [JSON.stringify(inferenceContext(c)),customerContextSummary(c)]){
  assert.doesNotMatch(value,/impasse|lilas|75012|sk-proj-|NOTAREALKEY/);
  assert.match(value,/adresse masquée/);assert.match(value,/secret masqué/);
 }
 for(const value of ['8 impasse des lilas, 75012 Paris','12 bis allée des fleurs','quai des roses 18','indirizzo: via delle rose 12','42 Oak Lane','75012 Paris'])assert.doesNotMatch(redact(value),/lilas|fleurs|roses|delle|Oak|75012/);
});

test('microseconds: history strictly earlier; current source excluded even with later id/time',async()=>{
 const id=await f.add('now','micro@example.invalid',0,'email');await f.db`UPDATE support_messages SET received_at='2026-04-01T12:00:00.000050Z' WHERE id=${id}`;
 await f.db`INSERT INTO support_messages(message_id,from_email,body_text,received_at) VALUES('micro-prior','micro@example.invalid','prior micro','2026-04-01T12:00:00.000049Z'),('micro-equal','micro@example.invalid','EQUAL MICRO','2026-04-01T12:00:00.000050Z'),('micro-next','micro@example.invalid','LATER MICRO','2026-04-01T12:00:00.000051Z')`;
 const c=await load({id});assert.match(JSON.stringify(c.history),/prior micro/);assert.doesNotMatch(JSON.stringify(c.history),/EQUAL|LATER/);validate(c);
});
test('supplier evidence is a non-carrier declaration, strictly prior; bounded same context to inference',async()=>{
 const id=await f.add('Dove è il ritratto?','client@example.invalid',50,'email');await f.db`UPDATE support_messages SET order_id=${A} WHERE id=${id}`;
 const c=await load({id},{supplierEvidence:async o=>({status:'available',evidence:[{date:'2026-02-01',text:'Imprimeur déclare expédié : gift@example.invalid https://private.invalid?token=SECRET'},{date:o.asOf,text:'NOT PRIOR'}],limitations:[]})});
 assert.equal(c.supplier.evidence.length,1);assert.match(c.supplier.evidence[0].source,/non vérifié/);assert.doesNotMatch(JSON.stringify(c),/NOT PRIOR|gift@example|token=SECRET/);validate(c);
 await generateDraft(null,{body_text:'Dove è il ritratto?',subject:'Synthetic'},{context:c,infer:async p=>{assert.equal(p.bodyText,'Dove è il ritratto?');assert.deepEqual(p.context,inferenceContext(c));return reply;}});
 const input=draftInput({body:'Dove è il ritratto?',customerContext:inferenceContext(c)});assert.equal(input.bodyText,'Dove è il ritratto?');assert.deepEqual(input.context,inferenceContext(c));
});
test('bounds, pagination and missing source handling are visible; schema rejects unsafe envelopes',async()=>{
 for(let n=0;n<14;n++)await f.add('Message ancien '+n+' '+('x'.repeat(900)),'bounds@example.invalid',1000+n,'email');
 const id=await f.add('now','bounds@example.invalid',100,'email');const c=await load({id});assert.equal(c.history.length,12);assert.ok(c.history.every(h=>h.text.length<=700));assert.match(customerContextSummary(c),/Contexte borné/);validate(c);
 const bad=structuredClone(c);bad.history[0].at=bad.messageAt;assert.throws(()=>validate(bad));const foreign=structuredClone(c);foreign.linkage='contradiction';assert.throws(()=>validate(foreign));const extra=structuredClone(c);extra.secret='x';assert.equal(inferenceContext(extra).secret,undefined);
 assert.equal((await loadCustomerContext(f.db,{id:2147483647})).linkage,'unavailable');
 assert.equal(redact('token=secret https://x.invalid/?token=SECRET a@b.invalid 12 rue Cachée ; +33 6 12 34 56 78').includes('SECRET'),false);
});
test('chat and contact: first notification before context, same bounded context in draft and enriched pages, no duplicate original',async()=>{
 await f.db`UPDATE chat_telegram_notifications SET status='sent'`;
 for(const channel of ['chat','contact']){
  await f.add('Dove è il ritratto?','client@example.invalid',0,channel);const t=transport();let supplied;
  const result=await chatOnce(f.db,{progressive:f.ledger,send:t.send,loadCustomer:async(db,row)=>{assert.ok(t.calls.length);const c=await load(row);supplied=inferenceContext(c);return c;},translate:()=>({status:'pending'}),draft:async m=>{assert.deepEqual(draftInput(m).context,supplied);return {language:'it',draft:'Buongiorno,\nIl team Cartoonova',draftFR:'Bonjour,\nL’équipe Cartoonova',translation:{status:'ready',text:'Où est le portrait ?'}};}});
  assert.equal(result.sent,1);assert.equal(result.enrichment.edited,1);const edits=t.calls.filter(x=>x.method==='editMessageText');assert.ok(edits.some(x=>x.message_id===101));assert.match(t.calls[0].text,new RegExp('Canal : '+channel));assert.match(t.calls.map(x=>x.text).join('\n'),/Contexte client interne/);
  assert.equal((await chatOnce(f.db,{progressive:f.ledger,send:t.send})).sent,0);
 }
});
test('email enrichment renders exactly the context supplied to inference, using existing ids and ledger',async()=>{
 const db=state(f.dir+'/context-email.sqlite'),t=transport();
 try{
  await emailOnce(f.db,db,{send:t.send});
  const id=await f.add('Dove è il ritratto?','client@example.invalid',0,'email');let supplied;
  const result=await emailOnce(f.db,db,{send:t.send,supplierEvidence:noSupplier,infer:async p=>{
   assert.equal(t.calls[0].method,'sendMessage');assert.equal(p.bodyText,'Dove è il ritratto?');supplied=p.context;validate(supplied);return reply;
  }});
  assert.equal(result.sent,1);assert.equal(result.enrichment.edited,1);
  const desired=JSON.parse(db.progressive.get((await f.db`SELECT message_id FROM support_messages WHERE id=${id}`)[0].message_id.replace(/^/,'email:')).desired);
  assert.deepEqual(desired.customerContext,supplied);assert.match(t.calls.map(c=>c.text).join('\n'),/Contexte client interne/);
  assert.equal(t.calls.filter(c=>c.method==='editMessageText')[0].message_id,101);
  assert.equal((await emailOnce(f.db,db,{send:t.send,infer:()=>assert.fail('must not infer twice')})).attempted,0);
 }finally{db.progressive.close();db.close();}
});
test('pagination stops at three real aggregator pages and flags omitted history; explicit old order remains selectable',async()=>{
 await f.db`INSERT INTO support_messages(message_id,from_email,body_text,received_at) SELECT 'page-'||n,'pages@example.invalid','Older event '||n,now()-interval '1 day'-(n*interval '1 microsecond') FROM generate_series(1,310) n`;
 const id=await f.add('now','pages@example.invalid',100,'email');const c=await load({id});assert.match(customerContextSummary(c),/3 page\(s\) de 100/);assert.match(customerContextSummary(c),/historique supplémentaire non consulté/);assert.equal(c.history.length,12);validate(c);
 await f.db`INSERT INTO orders(id,customer_email,created_at,status) SELECT gen_random_uuid(),'client@example.invalid',now()-n*interval '1 day','paid' FROM generate_series(1,10) n`;
 const old=await f.add('about old explicit purchase','client@example.invalid',0,'email');await f.db`UPDATE support_messages SET order_id=${A} WHERE id=${old}`;
 const selected=await load({id:old});assert.equal(selected.linkage,'verified');assert.ok(selected.selectedOrder);assert.equal(selected.orders.length,8);assert.match(customerContextSummary(selected),/d’autres commandes existent/);validate(selected);
});
test('aggregator SQL failure rolls back its savepoint only; exact-email exchanges survive without sensitive error text',async()=>{
 await f.add('Prior conversation','degraded@example.invalid',1000,'email');const id=await f.add('Now','degraded@example.invalid',100,'email');
 const c=await loadCustomerContext(f.db,{id},{getHistory:async tx=>{await tx`SELECT * FROM intentionally_absent_sensitive_source`;}});
 assert.equal(c.linkage,'none');assert.equal(c.history.length,1);assert.match(customerContextSummary(c),/Traces agrégées indisponibles/);assert.doesNotMatch(JSON.stringify(c),/intentionally_absent_sensitive_source/);validate(c);
});
