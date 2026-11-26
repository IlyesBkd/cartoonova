import {test as nodeTest} from 'node:test';
import {serverSkip,serverOnly} from './helpers/server-only.mjs';
const skip=serverSkip();
const test=serverOnly(nodeTest,skip);
import assert from 'node:assert/strict';
const {state,runOnce,generateDraft}=skip?{}:await import('../ops/support-context-v1/worker.mjs');
const {fixture,transport}=skip?{}:await import('./telegram-test-helpers.mjs');
const reply=JSON.stringify({language:'it',messageFR:'Où est ma commande ?',draftClient:'Buongiorno,\nIl team Cartoonova',draftFR:'Bonjour,\nL’équipe Cartoonova'});
test('email: baseline/history preserved, complete original before inference; durable edit same id',async()=>{
 const f=await fixture();const db=state(f.dir+'/email.sqlite');try{
  const t=transport();await f.add('old email','a@example.invalid',0,'email');
  assert.equal((await runOnce(f.db,db,{send:t.send})).baseline,true);assert.equal(t.calls.length,0);
  await f.add('Dove è il mio ordine?','a@example.invalid',0,'email');let inputs=0;
  const r=await runOnce(f.db,db,{send:t.send,infer:async input=>{
   inputs++;assert.equal(t.calls[0].method,'sendMessage');assert.equal(t.calls.length,1);
   const row=db.progressive.db.prepare('SELECT ids FROM telegram_progressive_v1').get();assert.deepEqual(JSON.parse(row.ids),[101]);
   assert.equal(db.prepare("SELECT status FROM items WHERE source_id=2").get().status,'sent');assert.equal(input.bodyText,'Dove è il mio ordine?');return reply;
  }});
  assert.equal(r.sent,1);assert.equal(inputs,1);assert.equal(r.enrichment.edited,1);assert.equal(t.calls[1].message_id,101);assert.equal(t.calls[1].method,'editMessageText');
  assert.match(t.calls[0].text,/Canal : email/);assert.match(t.calls[0].text,/Objet : Subject/);assert.match(t.calls[1].text,/Buongiorno/);assert.match(t.calls[1].text,/Où est ma commande/);
  assert.equal((await runOnce(f.db,db,{send:t.send,infer:()=>assert.fail()})).attempted,0);
  assert.equal(db.prepare("SELECT status FROM items WHERE source_id=1").get().status,'baseline');
 }finally{db.progressive.close();db.close();await f.close();}
});
test('email: receive-only bypasses inference, reopen resumes failed edit with saved desired payload',async()=>{
 const f=await fixture();let db=state(f.dir+'/email.sqlite');const t=transport();try{
  await runOnce(f.db,db,{send:t.send});await f.add('Hello','a@example.invalid',0,'email');
  process.env.TELEGRAM_RECEIVE_ONLY='1';try{assert.equal((await runOnce(f.db,db,{send:t.send,infer:()=>assert.fail()})).sent,1);}finally{delete process.env.TELEGRAM_RECEIVE_ONLY;}
  assert.equal(t.calls.length,1);db.progressive.close();db.close();db=state(f.dir+'/email.sqlite');
  assert.equal((await runOnce(f.db,db,{send:t.send,infer:async()=>reply})).enrichment.edited,1);assert.equal(t.calls.filter(c=>c.method==='sendMessage').length,1);
 }finally{db.progressive.close();db.close();await f.close();}
});
test('email ambiguous initial never retries; inference failure leaves original visible and retryable',async()=>{
 const f=await fixture();const db=state(f.dir+'/email.sqlite');try{
  const t=transport({fail:()=>true});await runOnce(f.db,db,{send:t.send});await f.add('Hello','a@example.invalid',0,'email');
  assert.equal((await runOnce(f.db,db,{send:t.send})).uncertain,1);assert.equal((await runOnce(f.db,db,{send:t.send})).attempted,0);assert.equal(t.calls.length,1);
  await f.add('Another message','b@example.invalid',0,'email');const good=transport();
  const failed=await runOnce(f.db,db,{send:good.send,infer:async()=>{throw Error('synthetic');}});assert.equal(failed.sent,1);assert.equal(failed.enrichment.failed,1);
  assert.equal((await runOnce(f.db,db,{send:good.send,infer:async()=>reply})).enrichment.edited,1);assert.equal(good.calls.filter(c=>c.method==='sendMessage').length,1);
 }finally{db.progressive.close();db.close();await f.close();}
});
test('email inference no longer truncates after character 2000',async()=>{
 const body='hello 😀 '.repeat(3000);const r=await generateDraft(null,{subject:'Synthetic',body_text:body},{context:{current:null,observedAt:new Date().toISOString(),linkage:'unavailable',language:null,order:null,history:[],supplier:{status:'unavailable',evidence:[],limitations:[]},limitations:[]},infer:async x=>{assert.equal(x.bodyText,body);return reply;}});assert.equal(r.language,'it');
});
