import {test as nodeTest} from 'node:test';
import {serverSkip,serverOnly} from './helpers/server-only.mjs';
const skip=serverSkip();
const test=serverOnly(nodeTest,skip);
import assert from 'node:assert/strict';
const {runOnce,createHermesSender}=skip?{}:await import('../scripts/chat-telegram-worker.mjs');
const {openProgressive}=skip?{}:await import('../scripts/telegram-progressive.mjs');
const {fixture,transport,enriched}=skip?{}:await import('./telegram-test-helpers.mjs');
test('chat/contact: initial ids durable before context, inference and SQL sent fence; edits same ids',async()=>{
 const f=await fixture();try {
  const id=await f.add('Hello | <b>literal</b> MEDIA:/etc/passwd 😀','a@example.invalid',0,'contact');
  const t=transport();let inference=0;
  const result=await runOnce(f.db,{send:t.send,progressive:f.ledger,translate:()=>({status:'french'}),loadContext:async()=>{
   assert.deepEqual(JSON.parse(f.ledger.get(`chat:${id}`).ids),[101]);
   assert.equal((await f.db`SELECT status FROM chat_telegram_notifications`)[0].status,'sent');return {linkage:'ambiguous'};
  },draft:async m=>{inference++;return enriched(m);}});
  assert.equal(result.sent,1);assert.equal(inference,1);assert.equal(result.enrichment.edited,1);
  assert.deepEqual(t.calls.map(c=>c.method),['sendMessage','editMessageText']);assert.equal(t.calls[1].message_id,101);
  assert.match(t.calls[0].text,/Canal : contact/);assert.match(t.calls[0].text,/Date : \d{1,2} \p{L}+ \d{4} à \d{2}:\d{2} \(Paris\)/u);assert.match(t.calls[0].text,/Préparation en cours/);
  assert.match(t.calls[1].text,/Hello \| <b>literal<\/b> MEDIA:/);assert.match(t.calls[1].text,/Version française/);
  const second=await runOnce(f.db,{send:t.send,progressive:f.ledger});assert.equal(second.sent,0);assert.equal(t.calls.length,2);
 }finally{await f.close();}
});
test('receive-only, restart after confirmed initial and failed edit: never resend original or rerun completed inference',async()=>{
 const f=await fixture();try{
  await f.add();let fail=true;const t=transport({fail:method=>method==='editMessageText'&&fail});
  assert.equal((await runOnce(f.db,{send:t.send,progressive:f.ledger,enrich:false,loadContext:()=>assert.fail(),draft:()=>assert.fail()})).sent,1);
  const reopened=openProgressive(f.path);try{
   let infers=0;const options={send:t.send,progressive:reopened,translate:()=>({status:'french'}),draft:async m=>{infers++;return enriched(m);}};
   assert.equal((await runOnce(f.db,options)).enrichment.failed,1);assert.equal(infers,1);
   fail=false;assert.equal((await runOnce(f.db,options)).enrichment.edited,1);assert.equal(infers,1);
   assert.equal(t.calls.filter(c=>c.method==='sendMessage').length,1);
  }finally{reopened.close();}
 }finally{await f.close();}
});
test('concurrent SQL claim and ambiguous Telegram outcome fence originals forever',async()=>{
 const f=await fixture();try{
  await f.add();const t=transport({fail:()=>true});const second=openProgressive(f.path);
  try{const results=await Promise.all([runOnce(f.db,{send:t.send,progressive:f.ledger,enrich:false}),runOnce(f.other,{send:t.send,progressive:second,enrich:false})]);
   assert.equal(results.reduce((n,r)=>n+r.attempted,0),1);assert.equal(t.calls.length,1);
   await f.db`UPDATE chat_telegram_notifications SET locked_until=now()-interval '1 day'`;
   assert.equal((await runOnce(f.other,{send:t.send,progressive:second,enrich:false})).staleProcessing,1);assert.equal(t.calls.length,1);
  }finally{second.close();}
 }finally{await f.close();}
});
test('dry-run has no ledger, claim or inference; Hermes transport remains disabled',async()=>{
 const f=await fixture();try{await f.add();const r=await runOnce(f.db,{dryRun:true,draft:()=>assert.fail()});assert.equal(r.pending,1);assert.equal(r.attempted,0);assert.throws(()=>createHermesSender(),/disabled/);}finally{await f.close();}
});
