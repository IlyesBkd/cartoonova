import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test,before,after} from 'node:test';
import {database,loadDeep} from './order-delivery-harness.mjs';
import postgres from 'postgres';
const {COUT_ESTIME_EUR}=loadDeep('lib/supportCommande.ts');
let pg;
before(async()=>{pg=await database();await pg.migrate();});
after(async()=>{await pg?.close();});
const request=(id,body={})=>new Request('http://local/api/orders/test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:id,...body})});
async function fixture(options={printOption:'digital',carteVoeux:true}) {
 const id=randomUUID(),url='https://synthetic.invalid/final/A.png';
 await pg.db`INSERT INTO orders(id,status,paid_at,customer_email,customer_name,langue,options,final_image_url,poster_confirmation_status,poster_confirmation_image_url,poster_confirmation_email) VALUES(${id}::uuid,'in_progress',now(),'buyer@example.invalid','Buyer','en',${pg.db.json(options)},${url},'confirmed',${url},'buyer@example.invalid')`;
 let bytes=Buffer.from('portrait A'),sends=[],uploads=0;
 const db={getOrderById:async orderId=>(await pg.db`SELECT * FROM orders WHERE id=${orderId}::uuid`)[0],setOrderLastOutboundMessageId:async()=>{},updateOrderFinalImage:async(orderId,image)=>pg.db`UPDATE orders SET final_image_url=${image} WHERE id=${orderId}::uuid`};
 const replacements={
  '@/lib/db':db,'@/lib/adminAuth':{refuserSiPasAdmin:async()=>null},'@/lib/orderDelivery':pg.load('lib/orderDelivery.ts'),
  '@/lib/finalImage':{validateFinalImageUrl:()=>{},downloadFinalImage:async()=>({bytes}),FinalImageError:class extends Error{constructor(message,status){super(message);this.status=status;}}},
  '@/lib/emailToken':{orderTrackingToken:()=> 'synthetic'},'@/lib/analyticsServeur':{mesureServeur:async()=>{}},'@/lib/parrainage':{infosParrainage:async()=>null},
  '@/lib/envoiEmail':{envoyerEmail:async message=>{sends.push(message);return {data:{id:'capture-'+sends.length}};}},
  '@/lib/extras/carteVoeux':{genererCarteVoeux:async()=>Buffer.from('PDF')},'@/lib/extras/calendrier':{genererCalendrier:async()=>Buffer.from('PDF')},
  '@vercel/blob':{put:async()=>{uploads++;return {url:'https://synthetic.invalid/file.pdf'};}},
 };
 return {id,db,replacements,sends,get uploads(){return uploads;},setBytes:b=>{bytes=Buffer.from(b);},final:async()=>loadDeep('app/api/orders/send-final-image/route.ts',replacements).POST(request(id,{finalImageUrl:(await db.getOrderById(id)).final_image_url})),extras:()=>loadDeep('app/api/orders/extras/route.ts',replacements).POST(request(id))};
}
test('physical final route refuses confirmation from previous email under canonical lock',async()=>{
 const f=await fixture({printOption:'canvas'});
 await pg.db`UPDATE orders SET poster_confirmation_email='previous@example.invalid' WHERE id=${f.id}::uuid`;
 const r=await f.final();assert.equal(r.status,409,await r.text());assert.equal(f.sends.length,0);
 await pg.db`UPDATE orders SET poster_confirmation_email=customer_email WHERE id=${f.id}::uuid`;
 assert.equal((await f.final()).status,200);assert.equal(f.sends.length,1);
});
test('extras require current delivered bytes and compatible options/recipient, not an old milestone',async()=>{
 const f=await fixture();
 assert.equal((await f.final()).status,200);
 assert.equal((await f.extras()).status,200);assert.equal((await f.extras()).status,200);assert.equal(f.uploads,1);
 const first=(await f.db.getOrderById(f.id)).final_image_sent_at.toISOString();
 await pg.db`UPDATE orders SET final_image_url='https://synthetic.invalid/final/B.png' WHERE id=${f.id}::uuid`;f.setBytes('retouched B');
 assert.equal((await f.extras()).status,409,'B has not been delivered');assert.equal(f.uploads,1);
 assert.equal((await f.final()).status,200);assert.equal((await f.extras()).status,200);assert.equal(f.uploads,2);
 f.setBytes('changed in place C');
 assert.equal((await f.extras()).status,409,'same URL is not proof of same bytes');assert.equal(f.uploads,2);
 assert.equal((await f.final()).status,200);assert.equal((await f.extras()).status,200);assert.equal((await f.extras()).status,200);assert.equal(f.uploads,3);
 await pg.db`UPDATE orders SET customer_email='new@example.invalid' WHERE id=${f.id}::uuid`;
 assert.equal((await f.extras()).status,409,'old recipient delivery cannot authorize new recipient');
 assert.equal((await f.final()).status,200);assert.equal((await f.extras()).status,200);
 await pg.db`UPDATE orders SET options=options || '{"calendrier":true}'::jsonb WHERE id=${f.id}::uuid`;
 assert.equal((await f.extras()).status,409,'changed options require compatible final delivery');
 assert.equal((await f.final()).status,200);assert.equal((await f.extras()).status,200);
 assert.equal((await f.db.getOrderById(f.id)).final_image_sent_at.toISOString(),first);
});
test('historical final marker alone refuses extras without erasing first delivery date',async()=>{
 const f=await fixture();await pg.db`UPDATE orders SET final_image_sent_at='2026-01-01' WHERE id=${f.id}::uuid`;
 assert.equal((await f.extras()).status,409);assert.equal(f.uploads,0);assert.equal(f.sends.length,0);
 assert.equal((await f.db.getOrderById(f.id)).final_image_sent_at.toISOString(),'2026-01-01T00:00:00.000Z');
});
test('gift final recipient fingerprint authorizes buyer extras; reuploaded identical bytes replay',async()=>{
 const f=await fixture({printOption:'digital',carteVoeux:true,gift:{recipientEmail:'gift@example.invalid'}});
 assert.equal((await f.final()).status,200);assert.deepEqual(f.sends[0].to,['gift@example.invalid']);
 assert.equal((await f.extras()).status,200);assert.deepEqual(f.sends[1].to,['buyer@example.invalid']);
 await pg.db`UPDATE orders SET final_image_url='https://synthetic.invalid/final/same-bytes.png' WHERE id=${f.id}::uuid`;
 assert.equal((await f.extras()).status,200);assert.equal(f.uploads,1);assert.equal(f.sends.length,2);
});
test('canonical physical confirmation is reread after download barrier before provider',async()=>{
 const f=await fixture({printKey:'canvas'});let enter,release;const entered=new Promise(r=>enter=r),barrier=new Promise(r=>release=r);
 f.replacements['@/lib/finalImage'].downloadFinalImage=async()=>{enter();await barrier;return {bytes:Buffer.from('portrait A')};};
 const task=f.final();await entered;
 await pg.db`UPDATE orders SET poster_confirmation_email='previous@example.invalid' WHERE id=${f.id}::uuid`;
 release();assert.equal((await task).status,409);assert.equal(f.sends.length,0);
});
test('shipping repeated POST keeps first departure, and failure does not mark an unsent notification',async()=>{
 const f=await fixture({printKey:'canvas'}),helper=pg.load('lib/orderDeliveryShipping.ts');
 const route=()=>loadDeep('app/api/orders/expedition/route.ts',{...f.replacements,'@/lib/orderDeliveryShipping':helper});
 await pg.db`UPDATE orders SET expedie_le='2026-01-01',expedition_email_envoye_le='2026-01-02',cout=11,cout_note='actual',fournisseur_ref='PRINT',suivi_transporteur='Stored' WHERE id=${f.id}::uuid`;
 for(let i=0;i<2;i++)assert.equal((await route().POST(request(f.id,{suiviUrl:'https://tracking.invalid/replay'}))).status,200);
 let saved=await f.db.getOrderById(f.id);assert.equal(saved.expedie_le.toISOString(),'2026-01-01T00:00:00.000Z');assert.notEqual(saved.expedition_email_envoye_le.toISOString(),'2026-01-02T00:00:00.000Z');assert.equal(saved.fournisseur_ref,'PRINT');assert.equal(Number(saved.cout),11);assert.equal(saved.cout_note,'actual');assert.equal(f.sends.length,2,'explicit shipping POST remains a resend, not exactly once');
 const fresh=await fixture({printKey:'canvas'});
 const failed=loadDeep('app/api/orders/expedition/route.ts',{...fresh.replacements,'@/lib/orderDeliveryShipping':helper,'@/lib/envoiEmail':{envoyerEmail:async()=>{throw Error('synthetic refusal or lost response');}}});
 assert.equal((await failed.POST(request(fresh.id,{suiviUrl:'https://tracking.invalid/failure'}))).status,500);
 saved=await fresh.db.getOrderById(fresh.id);assert.equal(saved.expedie_le,null);assert.equal(saved.expedition_email_envoye_le,null);
});
for(const verb of ['PATCH','POST'])test(`shipping ${verb} uses canonical support estimate${verb==='POST'?' and notification snapshot':''}`,async()=>{
 const f=await fixture({printKey:'canvas'}),helper=pg.load('lib/orderDeliveryShipping.ts');
 let switched=false;
 const switchBeforeLock=async()=>{if(!switched){switched=true;await pg.db`UPDATE orders SET customer_email='canonical@example.invalid',langue='fr',options='{"printKey":"framed"}',suivi_transporteur='Canonical carrier' WHERE id=${f.id}::uuid`;}};
 const wrapped={...helper};for(const name of ['patchShipping','notifyShipping'])if(helper[name])wrapped[name]=async(...args)=>{await switchBeforeLock();return helper[name](...args);};
 const route=loadDeep('app/api/orders/expedition/route.ts',{...f.replacements,'@/lib/orderDeliveryShipping':wrapped,'@/lib/db':{...f.db,marquerExpediee:async()=>{},setOrderLastOutboundMessageId:async()=>{}}});
 const response=await route[verb](request(f.id,{fournisseurRef:'PRINT',suiviUrl:'https://tracking.invalid/current'}));
 assert.equal(response.status,200,await response.clone().text());
 const saved=await f.db.getOrderById(f.id);assert.equal(Number(saved.cout),COUT_ESTIME_EUR.framed,'estimate must use support under lock');
 assert.equal(f.sends.length,verb==='POST'?1:0,'PATCH never notifies');
 if(verb==='POST'){
  assert.deepEqual(f.sends[0].to,['canonical@example.invalid']);assert.match(f.sends[0].html,/Canonical carrier/);assert.match(f.sends[0].html,/https:\/\/tracking.invalid\/current/);
  assert.equal((await response.json()).lang,'fr');assert.ok(saved.expedie_le);assert.ok(saved.expedition_email_envoye_le);
 }
});
test('shipping POST holds canonical SQL lock through provider without nested update deadlock',async()=>{
 const f=await fixture({printKey:'canvas'}),helper=pg.load('lib/orderDeliveryShipping.ts');
 let enter,release;const entered=new Promise(r=>enter=r),barrier=new Promise(r=>release=r);
 const other=postgres(pg.connectionUrl,{max:1,connection:{application_name:'shipping-writer'}});
 const route=loadDeep('app/api/orders/expedition/route.ts',{...f.replacements,'@/lib/orderDeliveryShipping':helper,'@/lib/db':{...f.db,marquerExpediee:async()=>{},setOrderLastOutboundMessageId:async()=>{}},'@/lib/envoiEmail':{envoyerEmail:async msg=>{f.sends.push(msg);enter();await barrier;return {data:{id:'locked-shipping'}};}}});
 const task=route.POST(request(f.id,{suiviUrl:'https://tracking.invalid/locked'}));
 await entered;
 let finished=false;const writer=other`UPDATE orders SET customer_email='after@example.invalid',langue='de',options='{"printKey":"digital"}',suivi_url='https://tracking.invalid/after' WHERE id=${f.id}::uuid`.then(()=>{finished=true;});
 try{
  let waiting=false;for(let n=0;n<100&&!finished;n++){const [row]=await pg.db`SELECT count(*)::int n FROM pg_stat_activity WHERE application_name='shipping-writer' AND wait_event_type='Lock'`;if(row.n){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}
  assert.equal(waiting,true,'competing SQL writer must be blocked at provider boundary');assert.equal(finished,false);
 }finally{release();await task;await writer;await other.end();}
 assert.equal((await task).status,200);assert.deepEqual(f.sends[0].to,['buyer@example.invalid']);
 const saved=await f.db.getOrderById(f.id);assert.equal(saved.last_outbound_message_id,'locked-shipping');assert.ok(saved.expedie_le);assert.ok(saved.expedition_email_envoye_le);
});
