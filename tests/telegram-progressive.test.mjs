import {test as nodeTest} from 'node:test';
import {serverSkip,serverOnly} from './helpers/server-only.mjs';
const skip=serverSkip();
const test=serverOnly(nodeTest,skip);
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const {openProgressive,notificationParts,telegramSender}=skip?{}:await import('../scripts/telegram-progressive.mjs');
const {transport,enriched,joined}=skip?{}:await import('./telegram-test-helpers.mjs');
const message={id:42,email:'synthetic@example.invalid',body:'Hello 😀',channel:'chat',receivedAt:'2026-11-21T01:02:03Z',preparing:true};
async function isolated(fn){const dir=mkdtempSync(join(tmpdir(),'telegram-ledger-'));let q=openProgressive(dir+'/state.sqlite');try{await fn(q,dir);}finally{q.close();rmSync(dir,{recursive:true,force:true});}}
test('pagination preserves every original, translation, bilingual draft and emoji without markup interpretation',()=>{
 const body='😀 <b>literal</b> MEDIA:/etc/passwd\n'.repeat(700),fr='Texte français 😀\n'.repeat(700),draft='Hello,\n😀 '.repeat(600),draftFR='Bonjour,\n😀 '.repeat(600);
 const parts=notificationParts({...message,body,translation:{status:'ready',text:fr},draft,draftFR,language:'en',preparing:false});
 assert.ok(parts.length>10);assert.ok(parts.every(p=>p.text.length<=4096&&p.text===p.text.toWellFormed()&&!p.parse_mode));
 const all=joined(parts);for(const value of [body,fr,draft,draftFR])assert.ok(all.includes(value));
 assert.match(all,/21 novembre 2026 à 02:02 \(Paris\)/);assert.match(all,/rien envoyé/);
});
test('reopen after failed edit retries saved desired text, never original or inference',()=>isolated(async(q,dir)=>{
 let fail=true;const t=transport({fail:method=>method==='editMessageText'&&fail});await q.initial('k',message,t.send);
 let inference=0;const enrich=m=>{inference++;return enriched(m);};assert.equal((await q.run({send:t.send,enrich})).failed,1);
 const next=openProgressive(dir+'/state.sqlite');try{fail=false;assert.equal((await next.run({send:t.send,enrich:()=>assert.fail()})).edited,1);}finally{next.close();}
 assert.equal(inference,1);assert.equal(t.calls.filter(c=>c.method==='sendMessage').length,1);assert.equal(statSync(dir+'/state.sqlite').mode&0o777,0o600);
}));
test('ambiguous initial and partial pagination keep confirmed ids but never replay',()=>isolated(async(q)=>{
 let n=0;const t=transport({fail:()=>++n===2});await assert.rejects(q.initial('k',{...message,body:'😀 '.repeat(5000)},t.send));
 assert.deepEqual(JSON.parse(q.get('k').ids),[101]);await assert.rejects(q.initial('k',message,t.send));
 assert.equal((await q.run({send:t.send,enrich:()=>assert.fail()})).edited,0);assert.equal(t.calls.length,2);
}));
test('missing ids in provider success are ambiguous, never fabricate fake message ids',()=>isolated(async(q)=>{
 const send=telegramSender({token:'fake',chatId:'123',confirmedChatId:'123',fetchImpl:async()=>({ok:true,json:async()=>({ok:true})})});
 await assert.rejects(q.initial('k',message,send));assert.deepEqual(JSON.parse(q.get('k').ids),[]);
}));
test('inference failure retries; concurrent enrichment lease prevents duplicate edits',()=>isolated(async(q,dir)=>{
 const t=transport();await q.initial('k',message,t.send);assert.equal((await q.run({send:t.send,enrich:()=>{throw Error('failed');}})).failed,1);
 let release,entered;const held=new Promise(r=>release=r),started=new Promise(r=>entered=r);const other=openProgressive(dir+'/state.sqlite');
 try{const first=q.run({send:t.send,enrich:async m=>{entered();await held;return enriched(m);}});await started;
 assert.equal((await other.run({send:t.send,enrich:()=>assert.fail()})).edited,0);release();assert.equal((await first).edited,1);
 }finally{other.close();}assert.equal(t.calls.filter(c=>c.method==='editMessageText').length,1);
}));
test('crash recovery: fully persisted initial ids and expired editing lease resume edits only',()=>isolated(async(q)=>{
 const t=transport();await q.initial('k',message,t.send);
 q.db.prepare("UPDATE telegram_progressive_v1 SET state='initial' WHERE k='k'").run();
 assert.equal((await q.run({send:t.send,enrich:enriched})).edited,1);
 q.db.prepare("UPDATE telegram_progressive_v1 SET state='editing',owner='dead',lease=0 WHERE k='k'").run();
 assert.equal((await q.run({send:t.send,enrich:()=>assert.fail()})).edited,1);assert.equal(t.calls.filter(c=>c.method==='sendMessage').length,1);
}));
test('enrichment appends linked pages, persists ids; ambiguous append is never repeated',()=>isolated(async(q)=>{
 let rejectAppend=false;const t=transport({fail:method=>method==='sendMessage'&&rejectAppend});await q.initial('k',message,t.send);rejectAppend=true;
 assert.equal((await q.run({send:t.send,enrich:m=>({...enriched(m),draft:'long 😀 '.repeat(2000)})})).failed,1);
 const count=t.calls.length;rejectAppend=false;assert.equal((await q.run({send:t.send,enrich:()=>assert.fail()})).failed,1);assert.equal(t.calls.length,count);
 assert.equal(t.calls.at(-1).reply_parameters.message_id,101);
}));
test('destination changes cannot edit stored messages; legacy sent table remains unchanged',()=>isolated(async(q)=>{
 const t=transport();q.db.exec("CREATE TABLE chat_followups(id INTEGER PRIMARY KEY,payload TEXT,state TEXT);INSERT INTO chat_followups VALUES(1,'{}','sent')");
 await q.initial('k',message,t.send);const other=transport();other.send.destination='456';assert.equal((await q.run({send:other.send,enrich:()=>assert.fail()})).edited,0);
 assert.equal(q.db.prepare('SELECT state FROM chat_followups').get().state,'sent');assert.equal(other.calls.length,0);
}));
test('provider not-modified is an idempotent edit success; destination guard enforced',async()=>{
 assert.throws(()=>telegramSender({token:'x',chatId:'123',confirmedChatId:'456'}));
 const send=telegramSender({token:'x',chatId:'123',confirmedChatId:'123',fetchImpl:async()=>({ok:false,json:async()=>({ok:false,error_code:400,description:'Bad Request: message is not modified'})})});
 await send(message,{existingIds:[101]});
});
test('real process exits after initial acknowledgement and during edit recover without new original',()=>isolated(async(q,dir)=>{
 const moduleUrl=new URL('../scripts/telegram-progressive.mjs',import.meta.url).href;
 const child=code=>spawnSync(process.execPath,['--input-type=module','-e',code],{env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR},encoding:'utf8',timeout:10000});
 const setup=`import {openProgressive} from ${JSON.stringify(moduleUrl)};const q=openProgressive(${JSON.stringify(dir+'/state.sqlite')});`;
 const first=child(setup+`const send=async(m,o)=>{o.onPart(777,0);process.exit(71)};send.destination='123';await q.initial('crash',${JSON.stringify(message)},send);`);
 assert.equal(first.status,71,first.stderr);assert.deepEqual(JSON.parse(q.get('crash').ids),[777]);
 const second=child(setup+`const send=async(m,o)=>{if(o.existingIds[0]!==777)process.exit(99);process.exit(72)};send.destination='123';await q.run({send,enrich:m=>({...m,preparing:false,language:'fr',draft:'Bonjour',draftFR:'Bonjour',translation:{status:'french'}})});`);
 assert.equal(second.status,72,second.stderr);assert.equal(q.get('crash').state,'editing');
 q.db.prepare("UPDATE telegram_progressive_v1 SET lease=0 WHERE k='crash'").run();const t=transport();
 assert.equal((await q.run({send:t.send,enrich:()=>assert.fail()})).edited,1);assert.deepEqual(t.calls.map(c=>[c.method,c.message_id]),[['editMessageText',777]]);
}));
test('failed existing-page edit before any append remains retryable',()=>isolated(async(q)=>{
 let failEdit=true;const t=transport({fail:method=>method==='editMessageText'&&failEdit});
 await q.initial('retry',message,t.send);
 const desired={...enriched(message),draft:'Long bilingual response 😀 '.repeat(700)};
 assert.equal((await q.run({send:t.send,enrich:()=>desired})).failed,1);
 assert.equal(q.get('retry').error,null,'no new send attempted, so no ambiguous append fence');
 assert.deepEqual(t.calls.map(c=>c.method),['sendMessage','editMessageText']);
 failEdit=false;assert.equal((await q.run({send:t.send,enrich:()=>assert.fail()})).edited,1);
 assert.equal(q.get('retry').state,'done');assert.equal(q.get('retry').error,null);
 assert.equal(JSON.parse(q.get('retry').ids).length,notificationParts(desired).length);
}));
test('confirmed append atomically clears ambiguity before the next page',()=>isolated(async(q)=>{
 const t=transport();await q.initial('append',message,t.send);
 const desired={...enriched(message),draft:'Long 😀 '.repeat(2000)};
 const send=async(m,options)=>{
  options.beforePart({append:false,index:0});
  options.beforePart({append:true,index:1});
  assert.equal(q.get('append').error,'append-uncertain');
  options.onPart(777,1);
  assert.equal(q.get('append').error,null);
  throw Error('Interrupted before next append attempt');
 };send.destination=t.send.destination;
 assert.equal((await q.run({send,enrich:()=>desired})).failed,1);
 assert.equal((await q.run({send:t.send,enrich:()=>assert.fail()})).edited,1);
 assert.equal(JSON.parse(q.get('append').ids)[1],777);
}));
