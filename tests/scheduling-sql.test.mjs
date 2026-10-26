import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {database,loadDeep} from './order-delivery-harness.mjs';

for(const scenario of ['delivered','disappeared'])test(`schedule route maps locked ${scenario} row to business status, no effects`,async()=>{
 const pg=await database();const before=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.connectionUrl;const cache=new Map();
 try{
  const actual=loadDeep('lib/db.ts',{postgres:()=>pg.db},cache);
  loadDeep('lib/deliveryPolicy.ts',{},cache);
  {
   const id=randomUUID();const [snapshot]=await pg.db`INSERT INTO orders(id,paid_at,customer_email,final_image_url,options) VALUES(${id},NOW(),'fixture@example.invalid','https://fixture.invalid/final.png','{"printKey":"digital"}') RETURNING *`;
   if(scenario==='delivered')await pg.db`UPDATE orders SET final_image_sent_at=NOW() WHERE id=${id}`;
   else await pg.db`DELETE FROM orders WHERE id=${id}`;
   const {POST}=loadDeep('app/api/orders/send-final-image/route.ts',{'@/lib/db':{...actual,getOrderById:async()=>snapshot},'@/lib/adminAuth':{refuserSiPasAdmin:async()=>null},'@/lib/emailImageFinale':{envoyerImageFinale:()=>assert.fail('no email')},'@/lib/finalImage':{validateFinalImageUrl:()=>{},FinalImageError:class extends Error {}}},cacheForRoute());
   const response=await POST(new Request('http://localhost/api/orders/send-final-image',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:id,action:'schedule',scheduledAt:'2099-12-31T09:00:00Z'})}));
   assert.equal(response.status,scenario==='delivered'?409:404);
   assert.deepEqual(await response.json(),{error:scenario==='delivered'?'Portrait déjà livré.':'Commande introuvable.'});
   const rows=await pg.db`SELECT final_image_scheduled_at FROM orders WHERE id=${id}`;assert.ok(rows.every(r=>r.final_image_scheduled_at===null));
  }
 }finally{if(before===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=before;await pg.close();}
 // Share actual policy constructors between DB helper and route.
 function cacheForRoute(){const c=new Map();for(const [k,v] of cache)if(k.endsWith('/lib/deliveryPolicy.ts'))c.set(k,v);return c;}
});

test('explicit SQL scheduling rechecks eligibility after waiting on row lock and persists approved gift date',async()=>{
 const pg=await database();const before=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.connectionUrl;
 try{
  const actual=loadDeep('lib/db.ts',{postgres:()=>pg.db});
  const id=randomUUID();await pg.db`INSERT INTO orders(id,paid_at,customer_email,final_image_url,options) VALUES(${id},NOW(),'fixture@example.invalid','https://fixture.invalid/final.png','{"printKey":"digital","gift":{"deliverAfter":"2099-12-31"}}')`;
  await assert.rejects(actual.programmerEnvoiImageFinale(id,new Date('2099-12-30T09:00:00Z')),/date de remise/);
  await actual.programmerEnvoiImageFinale(id,new Date('2099-12-31T09:00:00Z'));
  const [saved]=await pg.db`SELECT final_image_scheduled_at FROM orders WHERE id=${id}`;assert.equal(saved.final_image_scheduled_at.toISOString(),'2099-12-31T09:00:00.000Z');
  let unlock,locked;const ready=new Promise(r=>locked=r);const hold=new Promise(r=>unlock=r);
  const transaction=pg.db.begin(async tx=>{await tx`SELECT id FROM orders WHERE id=${id} FOR UPDATE`;await tx`UPDATE orders SET paid_at=NULL WHERE id=${id}`;locked();await hold;});
  await ready;const scheduling=actual.programmerEnvoiImageFinale(id,new Date('2100-01-01T09:00:00Z'));const refusal=assert.rejects(scheduling,/commande payée/);
  try{
   let waiting=false;
   for(let i=0;i<100;i++){const rows=await pg.db`SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT * FROM orders%FOR UPDATE%'`;if(rows.length){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}
   assert.equal(waiting,true,'production SELECT must wait on the SQL row lock');
  }finally{unlock();await transaction;}
  await refusal;const [unchanged]=await pg.db`SELECT final_image_scheduled_at FROM orders WHERE id=${id}`;assert.equal(unchanged.final_image_scheduled_at.toISOString(),'2099-12-31T09:00:00.000Z');
 }finally{if(before===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=before;await pg.close();}
});
