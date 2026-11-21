import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runOnce,draftInput,loadHistory} from '../scripts/chat-telegram-worker.mjs';
import {fixture,transport,enriched} from './telegram-test-helpers.mjs';
test('settle=0 notifies close arrivals immediately and keeps exact sender history for drafting',async()=>{
 const f=await fixture();try{
  await f.add('earlier','a@example.invalid',500);await f.db`UPDATE chat_telegram_notifications SET status='sent'`;
  await f.add('private other','other@example.invalid',400);await f.db`UPDATE chat_telegram_notifications SET status='sent'`;
  await f.db`INSERT INTO support_replies(to_email,body_text,sent_at) VALUES('A@example.invalid','already answered',now()-interval '3 minutes'),('a@example.invalid','UNSENT',NULL)`;
  await f.add('one','a@example.invalid');await f.add('two','A@example.invalid');const t=transport();let seen;
  const r=await runOnce(f.db,{progressive:f.ledger,send:t.send,settleSeconds:0,history:loadHistory,translate:()=>({status:'french'}),draft:async m=>{seen=m;return enriched(m);}});
  assert.equal(r.sent,2);assert.deepEqual(t.calls.slice(0,2).map(c=>c.method),['sendMessage','sendMessage']);
  assert.match(seen.history,/earlier/);assert.match(seen.history,/already answered/);assert.doesNotMatch(seen.history,/private other|UNSENT/);
 }finally{await f.close();}
});
test('legacy opt-in settled grouping claims complete burst once; future sender stays pending',async()=>{
 const f=await fixture();try{
  await f.add('one','a@example.invalid',100);await f.add('two','A@example.invalid',100);await f.add('busy','b@example.invalid',0);
  const t=transport();const r=await runOnce(f.db,{progressive:f.ledger,send:t.send,settleSeconds:90,enrich:false});
  assert.equal(r.sent,1);assert.equal(t.calls.length,1);assert.match(t.calls[0].text,/Message 1.*\none[\s\S]*Message 2.*\ntwo/);
  assert.equal(r.pending,1);
 }finally{await f.close();}
});
test('receive lane continues while enrichment lane is blocked; edit leases fence overlapping workers',async()=>{
 const f=await fixture();try{
  await f.add('first');const t=transport();let entered,release;const started=new Promise(r=>entered=r),held=new Promise(r=>release=r);
  const work=runOnce(f.db,{progressive:f.ledger,send:t.send,translate:()=>({status:'french'}),draft:async m=>{entered();await held;return enriched(m);}});
  await started;await f.add('arrived during inference');
  const fast=await runOnce(f.other,{progressive:f.ledger,send:t.send,enrich:false});assert.equal(fast.sent,1);
  assert.equal(t.calls.filter(c=>c.method==='sendMessage').length,2);release();await work;
  assert.equal(t.calls.filter(c=>c.method==='sendMessage').length,2);
 }finally{await f.close();}
});
test('full new message is never clipped to the old 2000 character adapter limit',()=>{
 const body='😀 hello '.repeat(3000);const input=draftInput({body,history:'old '.repeat(2000)});
 assert.ok(input.bodyText.endsWith(body));assert.equal(input.bodyText,input.bodyText.toWellFormed());
 assert.throws(()=>draftInput({body:'a'.repeat(100001)}),/capacity/);
});
