import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, before, after } from 'node:test';
import { database, loadDeep, deliverFixture } from './order-delivery-harness.mjs';
let pg;
before(async()=>{pg=await database();await pg.migrate();});
after(async()=>{await pg?.close();});
test('locked SQL guard uses current paid_at, not a stale caller payment snapshot',async()=>{
 const id=randomUUID();
 await pg.db`INSERT INTO orders(id,status,paid_at,customer_email,options,final_image_url,final_image_sent_at) VALUES(${id}::uuid,'PAID',now(),'buyer@example.invalid','{"printOption":"digital","carteVoeux":true}','https://synthetic.invalid/final/race.png',null)`;
 const [snapshot]=await pg.db`SELECT * FROM orders WHERE id=${id}::uuid`;
 let sends=0;
 const guard=pg.load('lib/orderDelivery.ts');
 const run=()=>guard.executeDelivery(snapshot,'extras','synthetic-race',snapshot.customer_email,async ctx=>ctx.send(async()=>{sends++;return {data:{id:'captured-race'}};}));
 await pg.db`UPDATE orders SET paid_at=null,status='paid' WHERE id=${id}::uuid`;
 await assert.rejects(run(),e=>e.status===409);
 assert.equal(sends,0);
 assert.equal((await pg.db`SELECT count(*)::int n FROM order_delivery_effects WHERE order_id=${id}::uuid`)[0].n,0);
 await pg.db`UPDATE orders SET paid_at=now(),status='in_progress' WHERE id=${id}::uuid`;
 await deliverFixture(pg,id,'synthetic-race');
 assert.equal((await run()).emailId,'captured-race');assert.equal(sends,1);
});
const cases=[['PAID',true],['in_progress',true],['PENDING',true],['paid',false]];
for (const [status,paid] of cases) {
 for (const path of ['extras','final','express','shipping','future-gift']) {
  test(`payment milestone: ${path} status=${status} paid_at=${paid?'present':'null'}`,async()=>{
   const id=randomUUID(),url='https://synthetic.invalid/final/payment.png';
   const opts={printOption:path==='shipping'?'canvas':'digital',carteVoeux:true,express:path==='express',...(path==='future-gift'?{gift:{deliverAfter:'2099-01-01'}}:{})};
   await pg.db`INSERT INTO orders(id,status,paid_at,customer_email,langue,options,final_image_url,final_image_sent_at) VALUES(${id}::uuid,${status},${paid?new Date('2026-01-01'):null},'buyer@example.invalid','en',${pg.db.json(opts)},${url},${null})`;
   if(paid&&path==='extras')await deliverFixture(pg,id,pg.load('lib/orderDelivery.ts').deliveryContentHash(Buffer.from('synthetic portrait')));
   let sends=0,uploads=0,scheduled=0;
   const db={
    getOrderById:async orderId=>(await pg.db`SELECT * FROM orders WHERE id=${orderId}::uuid`)[0],
    setOrderLastOutboundMessageId:async()=>{},
    updateOrderFinalImage:async(orderId,image)=>pg.db`UPDATE orders SET final_image_url=${image} WHERE id=${orderId}::uuid`,
    programmerEnvoiImageFinale:async(orderId,date)=>{scheduled++;await pg.db`UPDATE orders SET final_image_scheduled_at=${date} WHERE id=${orderId}::uuid`;},
   };
   class FinalImageError extends Error {constructor(message,status){super(message);this.status=status;}}
   const replacements={
    '@/lib/db':db,'@/lib/adminAuth':{refuserSiPasAdmin:async()=>null},
    '@/lib/orderDelivery':pg.load('lib/orderDelivery.ts'),
    '@/lib/orderDeliveryShipping':pg.load('lib/orderDeliveryShipping.ts'),
    '@/lib/finalImage':{FinalImageError,validateFinalImageUrl:()=>{},downloadFinalImage:async()=>({bytes:Buffer.from('synthetic portrait')})},
    '@/lib/emailToken':{orderTrackingToken:()=> 'synthetic'},
    '@/lib/analyticsServeur':{mesureServeur:async()=>{}},'@/lib/parrainage':{infosParrainage:async()=>null},
    '@/lib/envoiEmail':{envoyerEmail:async()=>{sends++;return {data:{id:'captured'}};}},
    '@/lib/extras/carteVoeux':{genererCarteVoeux:async()=>Buffer.from('PDF')},
    '@/lib/extras/calendrier':{genererCalendrier:async()=>Buffer.from('PDF')},
    '@vercel/blob':{put:async()=>{uploads++;return {url:'https://synthetic.invalid/file.pdf'};}},
   };
   if(path==='future-gift') {
    const run=async()=>loadDeep('lib/emailImageFinale.ts',replacements).envoyerImageFinale({...await db.getOrderById(id),final_image_url:url});
    if(paid)assert.equal((await run()).deferredUntil,'2099-01-01T09:00:00.000Z');
    else await assert.rejects(run(),e=>e.status===409);
   } else {
    const shipping=path==='shipping',extras=path==='extras';
    const file=shipping?'expedition':extras?'extras':'send-final-image';
    const route=loadDeep(`app/api/orders/${file}/route.ts`,replacements);
    const body=shipping?{orderId:id,transporteur:'DHL'}:extras?{orderId:id}:{orderId:id,finalImageUrl:url,saveOnly:path==='express'};
    const response=await route[shipping?'PATCH':'POST'](new Request(`http://local/api/orders/${file}`,{method:shipping?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
    assert.equal(response.status,paid?200:409,await response.text());
   }
   const [saved]=await pg.db`SELECT * FROM orders WHERE id=${id}::uuid`;
   const [ledger]=await pg.db`SELECT count(*)::int n FROM order_delivery_effects WHERE order_id=${id}::uuid`;
   assert.equal(sends,paid&&['extras','final','express'].includes(path)?1:0);
   assert.equal(uploads,paid&&path==='extras'?1:0);
   assert.equal(scheduled,paid&&path==='future-gift'?1:0);
   assert.equal(ledger.n,paid&&path==='extras'?2:paid&&['final','express'].includes(path)?1:0);
   assert.equal(saved.suivi_transporteur,paid&&path==='shipping'?'DHL':null);
   assert.equal(saved.final_image_scheduled_at!==null,paid&&path==='future-gift');
   if(['final','express'].includes(path))assert.equal(saved.final_image_sent_at!==null,paid);
  });
 }
}
