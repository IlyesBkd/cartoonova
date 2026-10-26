import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { existsSync } from 'node:fs';
import { database, loadDeep, deliverFixture } from './order-delivery-harness.mjs';
let pg;
before(async()=>{pg=await database();});
after(async()=>{await pg?.close();});

test('FLOW06 SQL partial update preserves reference, URL, cost and first shipment date',async()=>{
 assert.ok(existsSync(new URL('../lib/orderDeliveryShipping.ts',import.meta.url)),'partial SQL helper missing');
 const helper=pg.load('lib/orderDeliveryShipping.ts');
 await pg.db`INSERT INTO orders(id,status,paid_at,options,fournisseur_ref,suivi_url,suivi_transporteur,cout,expedie_le) VALUES(${id},'PAID',now(),${pg.db.json(order.options)},'REF','https://tracking.invalid/1','old',12,'2026-01-01')`;
 await helper.patchShipping(id,{transporteur:'DHL'},99);
 let [row]=await pg.db`SELECT * FROM orders WHERE id=${id}`;
 assert.equal(row.fournisseur_ref,'REF');assert.equal(row.suivi_url,'https://tracking.invalid/1');assert.equal(row.suivi_transporteur,'DHL');assert.equal(Number(row.cout),12);assert.equal(row.expedie_le.toISOString(),'2026-01-01T00:00:00.000Z');
 await helper.patchShipping(id,{fournisseurRef:null,suiviUrl:null},99);
 [row]=await pg.db`SELECT * FROM orders WHERE id=${id}`;assert.equal(row.fournisseur_ref,null);assert.equal(row.suivi_url,null);
 await assert.rejects(helper.patchShipping('22222222-2222-4222-8222-222222222222',{},null),e=>e.status===404);
});
import { load } from './upload-harness.mjs';
let uploads=0,sends=0;
async function extrasRoute(extra={}){
 const guard=existsSync(new URL('../lib/orderDelivery.ts',import.meta.url))?pg.load('lib/orderDelivery.ts'):{};
 return load('app/api/orders/extras/route.ts',{
  '@/lib/orderDelivery':guard,
  '@/lib/db':{getOrderById:async orderId=>(await pg.db`SELECT * FROM orders WHERE id=${orderId}`)[0]},
  '@/lib/adminAuth':{refuserSiPasAdmin:async()=>null},
  '@/lib/finalImage':{downloadFinalImage:async()=>({bytes:Buffer.from('synthetic portrait')}),FinalImageError:class extends Error{}},
  '@/lib/extras/carteVoeux':{genererCarteVoeux:async()=>Buffer.from('synthetic PDF')},
  '@/lib/extras/calendrier':{genererCalendrier:async()=>Buffer.from('synthetic PDF')},
  '@vercel/blob':{put:async()=>{uploads++;await new Promise(r=>setTimeout(r,15));return {url:'https://synthetic.invalid/file.pdf'};}},
  '@/lib/envoiEmail':{envoyerEmail:async()=>{sends++;return {data:{id:'captured'},error:null};}},
  ...extra,
 });
}
const extrasRequest=()=>new Request('http://local/api/orders/extras',{method:'POST',body:JSON.stringify({orderId:id})});
test('FLOW08 two independent route instances prevent concurrent duplicate PDF uploads and email',async()=>{
 if(existsSync(new URL('../migrations/20261026_order_delivery_effects.sql',import.meta.url)))await pg.migrate();
 await pg.db`UPDATE orders SET options=${pg.db.json({printOption:'digital',carteVoeux:true})},final_image_sent_at=null,customer_email='buyer@example.invalid',final_image_url='https://synthetic.invalid/final/a.png' WHERE id=${id}`;
 await deliverFixture(pg,id,pg.load('lib/orderDelivery.ts').deliveryContentHash(Buffer.from('synthetic portrait')));
 uploads=0;sends=0;
 const a=await extrasRoute(),b=await extrasRoute();
 const responses=await Promise.all(Array.from({length:12},(_,i)=>(i%2?a:b).POST(extrasRequest())));
 assert.ok(responses.every(r=>[200,409].includes(r.status)));
 assert.equal(uploads,1,'only one paid Blob upload');assert.equal(sends,1,'only one provider send');
 const replay=await (await extrasRoute()).POST(extrasRequest());assert.equal(replay.status,200);assert.equal(uploads,1);assert.equal(sends,1);
});
test('FLOW08 manual/express/cron shared final delivery prevents concurrent sends',async()=>{
 await pg.db`DELETE FROM order_delivery_effects`;
 await pg.db`UPDATE orders SET options='{"printOption":"digital","express":true}',status='PAID',paid_at=now(),final_image_sent_at=null WHERE id=${id}`;
 let count=0,measured=0;
 const replacements={
  '@/lib/db':{getOrderById:async()=> (await pg.db`SELECT * FROM orders WHERE id=${id}`)[0],markFinalImageSent:async()=>pg.db`UPDATE orders SET final_image_sent_at=COALESCE(final_image_sent_at,now()) WHERE id=${id}`,setOrderLastOutboundMessageId:async()=>{},programmerEnvoiImageFinale:async()=>{}},
  '@/lib/orderDelivery':pg.load('lib/orderDelivery.ts'),
  '@/lib/finalImage':{validateFinalImageUrl:()=>{},downloadFinalImage:async()=>({bytes:Buffer.from('portrait')}),FinalImageError:class extends Error{}},
  '@/lib/emailToken':{orderTrackingToken:()=> 'synthetic'},
  '@/lib/analyticsServeur':{mesureServeur:async()=>{measured++;}},
  '@/lib/parrainage':{infosParrainage:async()=>null},
  '@/lib/envoiEmail':{envoyerEmail:async()=>{count++;await new Promise(r=>setTimeout(r,20));return {data:{id:'final-captured'},error:null};}},
 };
 const a=loadDeep('lib/emailImageFinale.ts',replacements),b=loadDeep('lib/emailImageFinale.ts',replacements);
 const saved=await replacements['@/lib/db'].getOrderById();
 const outcomes=await Promise.allSettled(Array.from({length:8},(_,i)=>(i%2?a:b).envoyerImageFinale(saved)));
 assert.ok(outcomes.some(x=>x.status==='fulfilled'));assert.equal(count,1);
 await loadDeep('lib/emailImageFinale.ts',replacements).envoyerImageFinale(saved);assert.equal(count,1);assert.equal(measured,1);
});
test('FLOW08 provider uncertainty is durable and reconciled explicitly without regenerating files',async()=>{
 const guard=pg.load('lib/orderDelivery.ts');
 assert.equal(typeof guard.reconcileDelivery,'function','explicit provider reconciliation missing');
 await pg.db`DELETE FROM order_delivery_effects`;
 await pg.db`UPDATE orders SET options='{"printOption":"digital","carteVoeux":true}',final_image_sent_at=null,status='PAID',paid_at=now() WHERE id=${id}`;
 await deliverFixture(pg,id,'content');
 const [saved]=await pg.db`SELECT * FROM orders WHERE id=${id}`;
 let prepared=0,attempts=0;
 const run=()=>guard.executeDelivery(saved,'extras','content','buyer@example.invalid',async ctx=>{
  if(!ctx.artifacts.files){prepared++;await ctx.checkpoint({files:['captured.pdf']});}
  await ctx.send(async()=>{attempts++;if(attempts===1)throw Error('simulated timeout');return {data:{id:'recovered'}};});
 });
 await assert.rejects(run(),/simulated timeout/);
 await assert.rejects(run(),e=>e.status===409);assert.equal(attempts,1);
 const [effect]=await pg.db`SELECT * FROM order_delivery_effects WHERE kind='extras'`;
 assert.equal(effect.status,'uncertain');assert.deepEqual(effect.artifacts.files,['captured.pdf']);
 await assert.rejects(guard.reconcileDelivery(id,'extras',effect.version,{outcome:'not_sent',reason:''}));
 await guard.reconcileDelivery(id,'extras',effect.version,{outcome:'not_sent',reason:'Synthetic provider confirms rejection'});
 const result=await run();assert.equal(result.emailId,'recovered');assert.equal(attempts,2);assert.equal(prepared,1);
});
test('FLOW06 route rejects malformed field types without writing',async()=>{
 let writes=0;
 const {PATCH}=load('app/api/orders/expedition/route.ts',{'@/lib/envoiEmail':{},'@/lib/adminAuth':{refuserSiPasAdmin:async()=>null},'@/lib/db':{getOrderById:async()=>order},'@/lib/orderDeliveryShipping':{patchShipping:async()=>writes++,ShippingError:pg.load('lib/orderDeliveryShipping.ts').ShippingError}});
 for(const body of [{transporteur:42},{fournisseurRef:{}},{suiviUrl:false}])assert.equal((await PATCH(request(body))).status,400);
 assert.equal(writes,0);
});
test('FLOW08 an unpaid future gift cannot create a delivery schedule',async()=>{
 let scheduled=0;
 const saved={...order,status:'paid',paid_at:null,options:{printOption:'digital',gift:{deliverAfter:'2099-01-01'}}};
 const helper=loadDeep('lib/emailImageFinale.ts',{'@/lib/db':{getOrderById:async()=>saved,programmerEnvoiImageFinale:async()=>scheduled++},'@/lib/envoiEmail':{},'@/lib/analyticsServeur':{},'@/lib/parrainage':{},'@/lib/emailToken':{},'@/lib/finalImage':{FinalImageError:class extends Error{constructor(message,status){super(message);this.status=status;}},validateFinalImageUrl:()=>{}}});
 await assert.rejects(helper.envoyerImageFinale(saved),e=>e.status===409);assert.equal(scheduled,0);
});
test('FLOW08 version is content/options/recipient based, not upload URL or JSON key order',async()=>{
 await pg.db`DELETE FROM order_delivery_effects`;
 await pg.db`UPDATE orders SET options='{"printOption":"digital","carteVoeux":true}',status='PAID',paid_at=now(),final_image_sent_at=null WHERE id=${id}`;
 await deliverFixture(pg,id,'bytes-A');
 let count=0;
 const run=async(content='bytes-A')=>{const [saved]=await pg.db`SELECT * FROM orders WHERE id=${id}`;return pg.load('lib/orderDelivery.ts').executeDelivery(saved,'extras',content,saved.customer_email,async ctx=>ctx.send(async()=>{count++;return {data:{id:'version-'+count}};}));};
 await run();await run();assert.equal(count,1);
 await pg.db`UPDATE orders SET final_image_url='https://synthetic.invalid/final/reuploaded.png',options='{"carteVoeux":true,"printOption":"digital"}' WHERE id=${id}`;
 await run();assert.equal(count,1,'same bytes at a new URL is not a retouch');
 await deliverFixture(pg,id,'bytes-B');await run('bytes-B');await run('bytes-B');assert.equal(count,2,'actual changed content intentionally sends once');
 await pg.db`UPDATE orders SET customer_email='new@example.invalid' WHERE id=${id}`;await deliverFixture(pg,id,'bytes-B');await run('bytes-B');assert.equal(count,3);
 await pg.db`UPDATE orders SET options='{"printOption":"digital","carteVoeux":true,"calendrier":true}' WHERE id=${id}`;await deliverFixture(pg,id,'bytes-B');await run('bytes-B');assert.equal(count,4);
 assert.equal((await pg.db`SELECT count(*)::int n FROM order_delivery_effects WHERE kind='extras'`)[0].n,4);
});
test('FLOW08 SQL guard rejects unpaid, undelivered extras, stale snapshot and unapproved physical image',async()=>{
 await pg.db`DELETE FROM order_delivery_effects`;
 const guard=pg.load('lib/orderDelivery.ts');let calls=0;
 const run=async(kind='extras',saved)=>guard.executeDelivery(saved??(await pg.db`SELECT * FROM orders WHERE id=${id}`)[0],kind,'content','buyer@example.invalid',async()=>{calls++;});
 await pg.db`UPDATE orders SET status='paid',paid_at=null WHERE id=${id}`;await assert.rejects(run(),e=>e.status===409);
 await pg.db`UPDATE orders SET status='PAID',paid_at=now(),final_image_sent_at=null WHERE id=${id}`;await assert.rejects(run(),e=>e.status===409);
 await pg.db`UPDATE orders SET final_image_sent_at=now(),options='{"printOption":"canvas"}',poster_confirmation_status='confirmed',poster_confirmation_image_url='old.png' WHERE id=${id}`;
 await assert.rejects(run('final_image'),e=>e.status===409);
 const [stale]=await pg.db`SELECT * FROM orders WHERE id=${id}`;await pg.db`UPDATE orders SET customer_email='changed@example.invalid' WHERE id=${id}`;
 await assert.rejects(run('final_image',stale),e=>e.status===409);assert.equal(calls,0);
});
test('FLOW08 canonical row remains locked during provider invocation (real competing SQL writer)',async()=>{
 await pg.db`DELETE FROM order_delivery_effects`;
 await pg.db`UPDATE orders SET status='PAID',paid_at=now(),options='{"printOption":"digital","carteVoeux":true}',final_image_sent_at=null WHERE id=${id}`;
 await deliverFixture(pg,id,'locked-content');
 const [saved]=await pg.db`SELECT * FROM orders WHERE id=${id}`;
 let release,entered;const barrier=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const task=pg.load('lib/orderDelivery.ts').executeDelivery(saved,'extras','locked-content',saved.customer_email,async ctx=>ctx.send(async()=>{entered();await barrier;return {data:{id:'locked'}};}));
 await started;
 let finished=false;const writer=pg.db`UPDATE orders SET customer_email='after@example.invalid' WHERE id=${id}`.then(()=>{finished=true;});
 await new Promise(r=>setTimeout(r,30));assert.equal(finished,false,'writer waits for actual provider boundary');
 release();await task;await writer;assert.equal(finished,true);
});
test('FLOW06 real route + PostgreSQL preserves partial fields and refuses missing/digital/unpaid orders',async()=>{
 const helper=pg.load('lib/orderDeliveryShipping.ts');
 const db={getOrderById:async orderId=>(await pg.db`SELECT * FROM orders WHERE id=${orderId}`)[0]};
 const {PATCH}=load('app/api/orders/expedition/route.ts',{'@/lib/db':db,'@/lib/orderDeliveryShipping':helper,'@/lib/envoiEmail':{},'@/lib/adminAuth':{refuserSiPasAdmin:async()=>null}});
 await pg.db`UPDATE orders SET status='PAID',paid_at=now(),options='{"printOption":"canvas"}',fournisseur_ref='original',suivi_url='https://tracking.invalid/existing',suivi_transporteur='old' WHERE id=${id}`;
 assert.equal((await PATCH(request({transporteur:'DHL'}))).status,200);
 let [saved]=await pg.db`SELECT * FROM orders WHERE id=${id}`;assert.equal(saved.fournisseur_ref,'original');assert.equal(saved.suivi_url,'https://tracking.invalid/existing');
 const both=await Promise.all([PATCH(request({fournisseurRef:'updated'})),PATCH(request({transporteur:'UPS'}))]);assert.ok(both.every(r=>r.status===200));
 [saved]=await pg.db`SELECT * FROM orders WHERE id=${id}`;assert.equal(saved.fournisseur_ref,'updated');assert.equal(saved.suivi_transporteur,'UPS');assert.equal(saved.suivi_url,'https://tracking.invalid/existing');
 assert.equal((await PATCH(request({suiviUrl:''}))).status,200);assert.equal((await pg.db`SELECT suivi_url FROM orders WHERE id=${id}`)[0].suivi_url,null);
 assert.equal((await PATCH(request({orderId:'22222222-2222-4222-8222-222222222222'}))).status,404);
 await pg.db`UPDATE orders SET options='{"printOption":"digital"}' WHERE id=${id}`;assert.equal((await PATCH(request({transporteur:'forbidden'}))).status,409);
 await pg.db`UPDATE orders SET options='{"printOption":"canvas"}',status='paid',paid_at=null WHERE id=${id}`;assert.equal((await PATCH(request({transporteur:'forbidden'}))).status,409);
});
test('FLOW08 real express save route sends once under concurrency and once for a real retouch',async()=>{
 await pg.db`DELETE FROM order_delivery_effects`;
 await pg.db`UPDATE orders SET options='{"printOption":"digital","express":true}',status='PAID',paid_at=now(),final_image_sent_at=null,final_image_url='https://synthetic.invalid/final/express-A.png' WHERE id=${id}`;
 let count=0;
 const replacements={
  '@/lib/adminAuth':{refuserSiPasAdmin:async()=>null},
  '@/lib/db':{getOrderById:async()=> (await pg.db`SELECT * FROM orders WHERE id=${id}`)[0],updateOrderFinalImage:async(orderId,url)=>pg.db`UPDATE orders SET final_image_url=${url} WHERE id=${orderId}`,setOrderLastOutboundMessageId:async()=>{}},
  '@/lib/orderDelivery':pg.load('lib/orderDelivery.ts'),
  '@/lib/finalImage':{validateFinalImageUrl:()=>{},downloadFinalImage:async url=>({bytes:Buffer.from(url.endsWith('B.png')?'retouched pixels':'original pixels')}),FinalImageError:class extends Error{constructor(message,status){super(message);this.status=status;}}},
  '@/lib/emailToken':{orderTrackingToken:()=> 'synthetic'},'@/lib/analyticsServeur':{mesureServeur:async()=>{}},'@/lib/parrainage':{infosParrainage:async()=>null},
  '@/lib/envoiEmail':{envoyerEmail:async()=>{count++;await new Promise(r=>setTimeout(r,15));return {data:{id:'express-'+count}};}},
 };
 const a=loadDeep('app/api/orders/send-final-image/route.ts',replacements),b=loadDeep('app/api/orders/send-final-image/route.ts',replacements);
 const req=url=>new Request('http://local/api/orders/send-final-image',{method:'POST',body:JSON.stringify({orderId:id,finalImageUrl:url,saveOnly:true})});
 const responses=await Promise.all(Array.from({length:8},(_,i)=>(i%2?a:b).POST(req('https://synthetic.invalid/final/express-A.png'))));
 assert.ok(responses.every(r=>[200,409].includes(r.status)));assert.equal(count,1);
 const [first]=await pg.db`SELECT final_image_sent_at FROM orders WHERE id=${id}`;
 assert.equal((await a.POST(req('https://synthetic.invalid/final/express-B.png'))).status,200);assert.equal(count,2);
 assert.equal((await b.POST(req('https://synthetic.invalid/final/express-B.png'))).status,200);assert.equal(count,2);
 assert.equal((await pg.db`SELECT final_image_sent_at FROM orders WHERE id=${id}`)[0].final_image_sent_at.toISOString(),first.final_image_sent_at.toISOString());
});
test('FLOW08 ambiguous Blob upload blocks free reuploads until explicit reconciliation',async()=>{
 await pg.db`DELETE FROM order_delivery_effects`;
 await pg.db`UPDATE orders SET status='PAID',paid_at=now(),options='{"printOption":"digital","carteVoeux":true}',final_image_sent_at=null WHERE id=${id}`;
 await deliverFixture(pg,id,pg.load('lib/orderDelivery.ts').deliveryContentHash(Buffer.from('synthetic portrait')));
 let attempted=0;
 const route=await extrasRoute({'@vercel/blob':{put:async()=>{attempted++;throw Error('simulated lost Blob response');}}});
 assert.equal((await route.POST(extrasRequest())).status,500);
 assert.equal((await (await extrasRoute()).POST(extrasRequest())).status,409);
 assert.equal(attempted,1);
 const [effect]=await pg.db`SELECT version FROM order_delivery_effects WHERE kind='extras'`;
 await pg.load('lib/orderDelivery.ts').reconcileDelivery(id,'extras',effect.version,{outcome:'not_sent',reason:'Synthetic Blob capture proves no object was accepted'});
 assert.equal((await (await extrasRoute()).POST(extrasRequest())).status,200);
});
test('FLOW08 historical delivered marker without ledger fails closed instead of resending blindly',async()=>{
 await pg.db`DELETE FROM order_delivery_effects`;
 await pg.db`UPDATE orders SET status='PAID',paid_at=now(),options='{"printOption":"digital"}',final_image_sent_at=now() WHERE id=${id}`;
 const [saved]=await pg.db`SELECT * FROM orders WHERE id=${id}`;let sends=0;
 await assert.rejects(pg.load('lib/orderDelivery.ts').executeDelivery(saved,'final_image','historical',saved.customer_email,async ctx=>ctx.send(async()=>{sends++;return {data:{id:'should-not-send'}};})),e=>e.status===409);
 assert.equal(sends,0);
});
test('FLOW08 six independent OS processes share the PostgreSQL delivery gate',async()=>{
 await pg.db`DELETE FROM order_delivery_effects`;
 await pg.db`UPDATE orders SET status='PAID',paid_at=now(),options='{"printOption":"digital","carteVoeux":true}',final_image_sent_at=null WHERE id=${id}`;
 await deliverFixture(pg,id,'multiprocess-content');
 const {execFile}=await import('node:child_process'),{promisify}=await import('node:util');
 const invoke=promisify(execFile);
 const outputs=await Promise.all(Array.from({length:6},()=>invoke(process.execPath,[new URL('./order-delivery-worker.mjs',import.meta.url).pathname,pg.connectionUrl,id],{env:Object.fromEntries(['PATH','HOME','TMPDIR'].map(k=>[k,process.env[k]])),timeout:20000})));
 const results=outputs.map(x=>JSON.parse(x.stdout));assert.equal(results.reduce((n,x)=>n+x.sent,0),1);assert.ok(results.every(x=>[200,409].includes(x.status)));
 const [effect]=await pg.db`SELECT status,artifacts FROM order_delivery_effects WHERE kind='extras'`;assert.equal(effect.status,'sent');assert.equal(effect.artifacts.probe,'cross-process');
});
const id='11111111-1111-4111-8111-111111111111';
const order={id,status:'PAID',paid_at:'2026-01-01',customer_email:'buyer@example.invalid',options:{printOption:'canvas'},final_image_url:'https://synthetic.invalid/final/a.png',final_image_sent_at:'2026-01-01',poster_confirmation_status:'confirmed'};
const request=body=>new Request('http://local/api/orders/expedition',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:id,...body})});
test('FLOW06 partial route preserves absent fields, explicit null clears',async()=>{
 let args;
 const capture=async(...a)=>{args=a;return order;};
 const {PATCH}=load('app/api/orders/expedition/route.ts',{'@/lib/envoiEmail':{envoyerEmail:async()=>{throw Error('no provider permitted');}},'@/lib/adminAuth':{refuserSiPasAdmin:async()=>null},'@/lib/db':{getOrderById:async()=>order,enregistrerExpedition:capture},'@/lib/orderDeliveryShipping':{patchShipping:capture}});
 assert.equal((await PATCH(request({transporteur:'DHL'}))).status,200);
 // New API accepts a partial object, the legacy API accepts positional fields.
 const patch=typeof args[1]==='object' && args[1]!==null?args[1]:{fournisseurRef:args[1],suiviUrl:args[2],transporteur:args[3]};
 assert.equal(patch.fournisseurRef,undefined);assert.equal(patch.suiviUrl,undefined);assert.equal(patch.transporteur,'DHL');
 assert.equal((await PATCH(request({fournisseurRef:null}))).status,200);
 assert.equal(args[1].fournisseurRef,null);
});
