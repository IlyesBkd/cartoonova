// Synthetic process boundary probe: accepts only this harness's loopback DB.
import postgres from 'postgres';
import {load} from './upload-harness.mjs';
const url=process.argv[2],id=process.argv[3];
if(!/^postgresql:\/\/delivery_test@127\.0\.0\.1:\d+\/postgres$/.test(url))throw Error('Disposable loopback DB only');
const db=postgres(url,{max:4,onnotice(){}});
let sent=0;
try{
 const [saved]=await db`SELECT * FROM orders WHERE id=${id}`;
 const guard=load('lib/orderDelivery.ts',{'@/lib/db':{withFreshDatabaseClient:fn=>fn(db)}});
 try{
  const result=await guard.executeDelivery(saved,'extras','multiprocess-content',saved.customer_email,async ctx=>{
   await ctx.checkpoint({probe:'cross-process'});
   await ctx.send(async()=>{sent++;await new Promise(r=>setTimeout(r,200));return {data:{id:'synthetic-process-'+process.pid}};});
  });
  console.log(JSON.stringify({status:200,sent,duplicate:result.duplicate}));
 }catch(error){if(error.status!==409)throw error;console.log(JSON.stringify({status:409,sent}));}
}finally{await db.end({timeout:2});}
