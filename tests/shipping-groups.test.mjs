import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {before,after,test} from 'node:test';
import {database,loadDeep} from './order-delivery-harness.mjs';
import {serverSkip} from './helpers/server-only.mjs';
let pg,helper,shipping,seq=40000000;
before(async()=>{pg=await database();await pg.db`ALTER TABLE orders ADD COLUMN customer_address text, ADD COLUMN statut_force text, ADD COLUMN poster_confirmation_responded_at timestamptz, ADD COLUMN poster_confirmation_sent_at timestamptz, ADD COLUMN photo_urls jsonb`;await pg.db.unsafe(readFileSync('migrations/20261123_order_shipping_groups.sql','utf8'));await pg.db.unsafe(readFileSync('migrations/20261123_order_shipping_groups.sql','utf8'));shipping=pg.load('lib/orderDeliveryShipping.ts');helper=pg.load('lib/orderShippingGroup.ts',{'@/lib/orderDeliveryShipping':shipping});});
after(async()=>pg?.close());
async function fixture(count=2,lang='fr') {
 const ref=String(seq++),ids=Array.from({length:count},()=>randomUUID()).sort(),sends=[];
 for(const id of ids)await pg.db`INSERT INTO orders(id,status,paid_at,customer_name,customer_email,customer_address,langue,options,fournisseur_ref,poster_confirmation_status,cout,cout_note) VALUES(${id},'in_progress',now(),'Client Fictif','fixture@example.invalid','12 rue Fictive',${lang},'{"printKey":"canvas","city":"Ville Fictive","postalCode":"00000","country":"FR"}',${ref},'confirmed',12,'coût individuel fictif')`;
 const group={supplierRef:ref,orderIds:ids,tracking:[{number:'TEST'+ref+'A',carrier:'Fictif'},{number:'TEST'+ref+'B',carrier:'Fictif'}]};
 const route=(send=async message=>{sends.push(message);return {data:{id:'synthetic-'+sends.length}};},auth=async()=>null)=>loadDeep('app/api/orders/expedition/route.ts',{'@/lib/orderShippingGroup':helper,'@/lib/orderDeliveryShipping':shipping,'@/lib/adminAuth':{refuserSiPasAdmin:auth},'@/lib/envoiEmail':{envoyerEmail:send}});
 const call=(verb='POST',body={shippingGroup:group},send,auth)=>route(send,auth)[verb](new Request('http://local/api/orders/expedition',{method:verb,headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 return {ref,ids,group,sends,call,route,rows:()=>pg.db`SELECT * FROM orders WHERE fournisseur_ref=${ref} ORDER BY id`};
}
test('real PATCH saves every link without send; POST sends once, all milestones and costs preserved; duplicate silent',async()=>{
 const f=await fixture();let r=await f.call('PATCH');assert.equal(r.status,200,await r.clone().text());assert.equal(f.sends.length,0);
 for(const o of await f.rows()){assert.equal(o.shipping_details.tracking.length,2);assert.equal(o.expedie_le,null);}
 r=await f.call();assert.equal(r.status,200,await r.clone().text());assert.equal(f.sends.length,1);
 for(const o of await f.rows()){assert.ok(o.expedie_le);assert.ok(o.expedition_email_envoye_le);assert.equal(Number(o.cout),12);assert.equal(o.cout_note,'coût individuel fictif');assert.deepEqual(o.shipping_details.orderIds,f.ids);}
 for(const t of f.group.tracking)assert.ok(f.sends[0].html.includes(t.number));for(const id of f.ids)assert.ok(f.sends[0].html.includes(id.slice(0,8)));
 r=await f.call();assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).duplicate,true);assert.equal(f.sends.length,1);
 assert.equal((await f.call('PATCH',{orderId:f.ids[0],suiviUrl:'https://example.invalid/overwrite'})).status,409);
});
test('concurrent duplicate refuses in-flight; retry after confirmed result does not resend',async()=>{
 const f=await fixture();let enter,release;const entered=new Promise(r=>enter=r),barrier=new Promise(r=>release=r);
 const task=f.call('POST',undefined,async message=>{f.sends.push(message);enter();await barrier;return {data:{id:'concurrent'}};});await entered;
 try{assert.equal((await f.call()).status,409);}finally{release();}assert.equal((await task).status,200);assert.equal((await f.call()).status,200);assert.equal(f.sends.length,1);
});
test('provider uncertainty survives transaction rollback and blocks retry',async()=>{
 const f=await fixture();assert.equal((await f.call('POST',undefined,async()=>{throw Error('synthetic timeout');})).status,500);
 const [effect]=await pg.db`SELECT * FROM order_shipping_effects WHERE supplier_ref=${f.ref}`;assert.equal(effect.status,'uncertain');assert.equal((await f.call()).status,409);assert.equal(f.sends.length,0);for(const o of await f.rows())assert.equal(o.expedition_email_envoye_le,null);
 const other=await fixture();other.group.tracking=[f.group.tracking[1]];assert.equal((await other.call()).status,409);assert.equal(other.sends.length,0);
});
for(const field of ['customer_email','langue','customer_address','poster_confirmation_status','statut_force','status'])test('contradiction '+field+' refuses without provider',async()=>{
 const f=await fixture();await pg.db`UPDATE orders SET ${pg.db({[field]:field==='status'?'REFUNDED':'different'})} WHERE id=${f.ids[0]}`;
 assert.equal((await f.call()).status,409);assert.equal(f.sends.length,0);
});
for(const scenario of ['unpaid','digital','name','city','postal','country','historical_url','historical_shipped'])test('ineligible or contradictory '+scenario+' blocks group notification',async()=>{
 const f=await fixture();
 if(scenario==='unpaid')await pg.db`UPDATE orders SET paid_at=null WHERE id=${f.ids[0]}`;
 else if(scenario==='digital')await pg.db`UPDATE orders SET options=jsonb_set(options,'{printKey}','"digital"') WHERE id=${f.ids[0]}`;
 else if(scenario==='name')await pg.db`UPDATE orders SET customer_name='Other Fictif' WHERE id=${f.ids[0]}`;
 else if(['city','postal','country'].includes(scenario))await pg.db`UPDATE orders SET options=jsonb_set(options,${[scenario==='postal'?'postalCode':scenario]}::text[],'"Other"') WHERE id=${f.ids[0]}`;
 else if(scenario==='historical_url')await pg.db`UPDATE orders SET suivi_url='https://example.invalid/existing' WHERE id=${f.ids[0]}`;
 else await pg.db`UPDATE orders SET expedie_le=now() WHERE id=${f.ids[0]}`;
 assert.equal((await f.call()).status,409);assert.equal(f.sends.length,0);
});
test('group with one parcel stores its scope without inventing a parcel/product mapping',async()=>{
 const f=await fixture();f.group.tracking.pop();assert.equal((await f.call()).status,200);assert.equal(f.sends.length,1);
 for(const row of await f.rows()){assert.equal(row.shipping_details.tracking.length,1);assert.deepEqual(row.shipping_details.orderIds,f.ids);assert.equal(row.shipping_details.scope,'supplier_group_no_parcel_product_mapping');}
});
test('changed group membership or parcel set cannot replay a success',async()=>{
 const f=await fixture();assert.equal((await f.call()).status,200);
 f.group.tracking.push({number:'ADDEDPARCEL123',carrier:null});assert.equal((await f.call()).status,409);f.group.tracking.pop();
 await pg.db`UPDATE orders SET fournisseur_ref=null WHERE id=${f.ids[0]}`;assert.equal((await f.call()).status,409);assert.equal(f.sends.length,1);
});
for(const field of ['suivi_url','suivi_transporteur'])test('changed legacy projection '+field+' invalidates duplicate without resend',async()=>{
 const f=await fixture();assert.equal((await f.call()).status,200);
 await pg.db`UPDATE orders SET ${pg.db({[field]:'changed'})} WHERE id=${f.ids[0]}`;
 assert.equal((await f.call()).status,409);assert.equal(f.sends.length,1);
});
test('tracking already in another group rejected; historical exclusion enforced',async()=>{
 const f=await fixture(),other=await fixture();await other.call();f.group.tracking=[other.group.tracking[1]];assert.equal((await f.call()).status,409);
 const h=await fixture(1);await pg.db`UPDATE orders SET id='b04b885f-0000-4000-8000-000000000000' WHERE id=${h.ids[0]}`;h.group.orderIds=['b04b885f-0000-4000-8000-000000000000'];assert.equal((await h.call()).status,409);
});
for(const lang of ['fr','en','de','es','it','nl','pl','sv','da','pt'])test('group email language '+lang,async()=>{
 const f=await fixture(1,lang);assert.equal((await f.call()).status,200);assert.ok(f.sends[0].html.includes(`lang="${lang}"`));assert.ok(!f.sends[0].html.includes('Optimalprint'));
});
test('group freezes reference attachment and uncertain post-send DB failure blocks automatic recovery',async()=>{
 const f=await fixture(),other=await fixture(1);assert.equal((await f.call('PATCH')).status,200);
 assert.equal((await other.call('PATCH',{orderId:other.ids[0],fournisseurRef:f.ref})).status,409);
 await pg.db`CREATE FUNCTION synthetic_shipping_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.expedition_email_envoye_le IS NOT NULL THEN RAISE EXCEPTION 'synthetic commit failure'; END IF; RETURN NEW; END $$`;
 await pg.db`CREATE TRIGGER synthetic_failure BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION synthetic_shipping_failure()`;
 try {assert.equal((await f.call()).status,500);}finally{await pg.db`DROP TRIGGER synthetic_failure ON orders`;await pg.db`DROP FUNCTION synthetic_shipping_failure()`;}
 assert.equal(f.sends.length,1);assert.equal((await f.call()).status,409);assert.equal(f.sends.length,1);
});
test('different references cannot claim one parcel concurrently',async()=>{
 const f=await fixture(),other=await fixture();other.group.tracking=[f.group.tracking[1]];
 let enter,release;const entered=new Promise(r=>enter=r),barrier=new Promise(r=>release=r);
 const task=f.call('POST',undefined,async message=>{f.sends.push(message);enter();await barrier;return {data:{id:'shared-parcel'}};});await entered;
 try{assert.equal((await other.call()).status,409);}finally{release();}assert.equal((await task).status,200);assert.equal((await other.call()).status,409);assert.equal(other.sends.length,0);
});
test('real shared PAGE_FETCH JSON transport reaches actual route and persists one group email',{skip:serverSkip(['/home/hermes/hermes-ops/ops/clients/support.py'])},async()=>{
 const f=await fixture(),source=readFileSync('/home/hermes/hermes-ops/ops/clients/support.py','utf8');
 const body=source.match(/PAGE_FETCH = """([\s\S]*?)""" % ORIGIN/)[1].replace('%r',JSON.stringify('https://www.cartoonova.com'));
 let calls=0;const transport=runInNewContext(`(${body})`,{location:{origin:'https://www.cartoonova.com'},fetch:async(path,init)=>{
   calls++;assert.equal(path,'/api/orders/expedition');assert.equal(init.credentials,'same-origin');assert.equal(init.cache,'no-store');assert.equal(init.headers['Content-Type'],'application/json');
   return f.route().POST(new Request('https://www.cartoonova.com'+path,init));
 }});
 const first=await transport('/api/orders/expedition',{shippingGroup:f.group},null);assert.equal(first.status,200);assert.equal(first.data.ok,true);assert.equal(first.data.details.tracking.length,2);
 const second=await transport('/api/orders/expedition',{shippingGroup:f.group},null);assert.equal(second.status,200);assert.equal(second.data.duplicate,true);assert.equal(calls,2);assert.equal(f.sends.length,1);
 for(const row of await f.rows()){assert.ok(row.expedie_le);assert.ok(row.expedition_email_envoye_le);assert.equal(row.shipping_details.tracking.length,2);}
});
test('real reminder SQL and evaluator stop print_check for all shipped group members',{skip:serverSkip(['/home/hermes/.hermes/profiles/cartoonova/artifacts/order-delay-watch/worker.mjs'])},async()=>{
 const {collect,evaluate}=await import('/home/hermes/.hermes/profiles/cartoonova/artifacts/order-delay-watch/worker.mjs');
 await pg.db`CREATE TABLE IF NOT EXISTS retouches(order_id uuid,demandee_le timestamptz)`;
 await pg.db`CREATE TABLE IF NOT EXISTS support_messages(id integer,order_id uuid)`;
 await pg.db`CREATE TABLE IF NOT EXISTS support_replies(order_id uuid,to_email text,support_message_id integer,sent_at timestamptz)`;
 const f=await fixture();await pg.db`UPDATE orders SET paid_at=now()-interval '20 days',poster_confirmation_responded_at=now()-interval '15 days' WHERE fournisseur_ref=${f.ref}`;
 const before=(await collect(pg.db)).filter(o=>f.ids.includes(o.id));assert.equal(before.length,2);
 for(const row of before)assert.equal(evaluate(row,new Date())?.type,'print_check');
 assert.equal((await f.call()).status,200);
 const after=(await collect(pg.db)).filter(o=>f.ids.includes(o.id));assert.deepEqual(after,[]);
 for(const row of await f.rows())assert.equal(evaluate(row,new Date()),null);
});
const simpleBody = f => ({orderId:f.ids[0],suiviUrl:'https://example.invalid/legacy-tracking',transporteur:'Fictif'});
for (const status of ['uncertain','sent','sending']) test('legacy POST and PATCH fence durable '+status+' ledger with empty projection',async()=>{
 const f=await fixture();let calls=0;
 if(status==='uncertain') {
  assert.equal((await f.call('POST',undefined,async()=>{calls++;throw Error('synthetic timeout');})).status,500);
 } else if(status==='sent') {
  await pg.db`CREATE FUNCTION synthetic_legacy_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.expedition_email_envoye_le IS NOT NULL THEN RAISE EXCEPTION 'synthetic commit failure'; END IF; RETURN NEW; END $$`;
  await pg.db`CREATE TRIGGER synthetic_legacy_failure BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION synthetic_legacy_failure()`;
  try {assert.equal((await f.call('POST',undefined,async()=>{calls++;return {data:{id:'sent-before-rollback'}};})).status,500);}
  finally {await pg.db`DROP TRIGGER synthetic_legacy_failure ON orders`;await pg.db`DROP FUNCTION synthetic_legacy_failure()`;}
 } else {
  // Durable sending state left by a crash, without a live transaction lock.
  await pg.db`INSERT INTO order_shipping_effects(supplier_ref,fingerprint,details,status) VALUES(${f.ref},'synthetic',${pg.db.json(f.group)},'sending')`;
 }
 const [effect]=await pg.db`SELECT * FROM order_shipping_effects WHERE supplier_ref=${f.ref}`;assert.equal(effect.status,status);
 const before=await f.rows();for(const row of before){assert.equal(row.shipping_details,null);assert.equal(row.expedition_email_envoye_le,null);}
 for(const method of ['POST','PATCH'])assert.equal((await f.call(method,simpleBody(f))).status,409);
 const other=await fixture(1);
 assert.equal((await other.call('PATCH',{orderId:other.ids[0],fournisseurRef:f.ref})).status,409);
 assert.deepEqual(await f.rows(),before);assert.equal(f.sends.length,0);assert.equal(other.sends.length,0);assert.equal(calls,status==='sending'?0:1);
 // Membership in the durable journal must survive a changed/missing reference.
 await pg.db`UPDATE orders SET fournisseur_ref=null WHERE id=${f.ids[0]}`;
 assert.equal((await f.call('POST',simpleBody(f))).status,409);assert.equal(f.sends.length,0);
});
// Membership is stored as canonical lowercase UUID text in JSONB. PostgreSQL's
// uuid lookup accepts uppercase input, but JSONB's ? operator is case-sensitive.
// With no reference or projection left, only the canonical row ID can fence it.
for(const status of ['sending','uncertain','sent'])
 for(const casing of ['lowercase','uppercase'])
  for(const method of ['PATCH','POST'])test(`canonical UUID ledger fence ${status} ${casing} ${method} with NULL reference and empty projection`,async()=>{
   const f=await fixture(1);
   const canonical='abcdefab'+f.ids[0].slice(8);
   await pg.db`UPDATE orders SET id=${canonical}::uuid,fournisseur_ref=null WHERE id=${f.ids[0]}::uuid`;
   f.ids=[canonical];f.group.orderIds=[canonical];
   await pg.db`INSERT INTO order_shipping_effects(supplier_ref,fingerprint,details,status) VALUES(${f.ref},'canonical-uuid-fixture',${pg.db.json(f.group)},${status})`;
   const [before]=await pg.db`SELECT * FROM orders WHERE id=${canonical}::uuid`;
   assert.equal(before.id,canonical);assert.equal(before.fournisseur_ref,null);
   for(const field of ['shipping_details','suivi_url','suivi_transporteur','expedie_le','expedition_email_envoye_le','last_outbound_message_id'])assert.equal(before[field],null,field);
   const effectsBefore=await pg.db`SELECT * FROM order_shipping_effects WHERE supplier_ref=${f.ref}`;
   assert.equal(effectsBefore[0].status,status);assert.deepEqual(effectsBefore[0].details.orderIds,[canonical]);
   const supplied=casing==='uppercase'?canonical.toUpperCase():canonical;
   if(casing==='uppercase')assert.notEqual(supplied,canonical);
   let providerCalls=0;
   const response=await f.call(method,{...simpleBody(f),orderId:supplied},async()=>{providerCalls++;return {data:{id:'must-never-send'}};});
   assert.equal(response.status,409,await response.clone().text());
   assert.match((await response.json()).error,/journalisée/);
   assert.equal(providerCalls,0);assert.equal(f.sends.length,0);
   const [after]=await pg.db`SELECT * FROM orders WHERE id=${canonical}::uuid`;
   assert.deepEqual(after,before);
   assert.deepEqual(await pg.db`SELECT * FROM order_shipping_effects WHERE supplier_ref=${f.ref}`,effectsBefore);
  });
for(const winner of ['simple','group','group-uncertain'])test('real route race '+winner+' first excludes the other route before provider',async()=>{
 const f=await fixture();let enter,release;
 const entered=new Promise(r=>enter=r),barrier=new Promise(r=>release=r);
 const task=f.call('POST',winner==='simple'?simpleBody(f):undefined,async message=>{f.sends.push(message);enter();await barrier;if(winner==='group-uncertain')throw Error('synthetic timeout during race');return {data:{id:'race-'+winner}};});
 await entered;
 let losing;
 try {
  losing=f.call('POST',winner==='simple'?undefined:simpleBody(f));
  if(winner==='simple')assert.equal((await losing).status,409);
  else {
   // Prove overlap: the real legacy query is blocked on the group row lock
   // before releasing the provider (not merely two sequential requests).
   const deadline=Date.now()+5000;let blocked=false;
   while(Date.now()<deadline){
    const waits=await pg.db`SELECT pid FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%FOR NO KEY UPDATE%'`;
    if(waits.length){blocked=true;break;}
    await new Promise(r=>setTimeout(r,10));
   }
   assert.equal(blocked,true,'legacy route must reach the held row lock');
  }
 } finally {release();}
 assert.equal((await task).status,winner==='group-uncertain'?500:200);assert.equal((await losing).status,409);
 assert.equal((await f.call('POST',winner==='simple'?undefined:simpleBody(f))).status,409);assert.equal(f.sends.length,1);
});
for(const method of ['POST','PATCH'])test('historical carrier alone cannot be overwritten by group '+method,async()=>{
 const f=await fixture();await pg.db`UPDATE orders SET suivi_transporteur='UPS' WHERE id=${f.ids[0]}`;
 for(const track of f.group.tracking)track.carrier='DPD';const before=await f.rows();
 assert.equal((await f.call(method)).status,409);assert.equal(f.sends.length,0);assert.deepEqual(await f.rows(),before);
 const effects=await pg.db`SELECT * FROM order_shipping_effects WHERE supplier_ref=${f.ref}`;assert.equal(effects.length,0);
});
test('compatible historical carrier alone permits group notification',async()=>{
 const f=await fixture();await pg.db`UPDATE orders SET suivi_transporteur='  fICTIF  ' WHERE id=${f.ids[0]}`;
 assert.equal((await f.call()).status,200);assert.equal(f.sends.length,1);
});
test('auth, malformed IDs, duplicate numbers fail before email',async()=>{
 const f=await fixture();assert.equal((await f.call('POST',undefined,undefined,async()=>new Response('',{status:401}))).status,401);
 f.group.orderIds=['bad'];assert.equal((await f.call()).status,400);f.group.orderIds=f.ids;f.group.tracking.push(f.group.tracking[0]);assert.equal((await f.call()).status,400);assert.equal(f.sends.length,0);
});
