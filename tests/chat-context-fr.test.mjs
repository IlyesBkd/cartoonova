import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runOnce,formatNotificationParts,createSender} from '../scripts/chat-telegram-worker.mjs';
import {loadOrderContext,orderBrief,translateMessage} from '../scripts/chat-notification-context.mjs';
import {openFollowups} from '../scripts/chat-translation-followups.mjs';
import {nextTask,saveTranslation} from '/home/hermes/.hermes/profiles/cartoonova/scripts/notification-translation.mjs';
const id='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const order={id,customer_email:'TEST@example.invalid',paid_at:'2026-11-01T00:00:00Z',created_at:'2026-10-31T23:30:00Z',status:'PAID',options:{style:'ghibli',printKey:'canvas',format:'portrait'}};
const message={id:42,email:'test@example.invalid',body:'Where is my order? | Keep this pipe.'};
function contextSQL(orders,{fail=false}={}) {
 const calls=[];
 const tx=async(strings,...values)=>{const query=strings.join('?');calls.push({query,values});if(query.includes('SET LOCAL'))return [];if(query.includes('FROM orders')){if(fail)throw Error('private error');return orders;}throw Error('Unexpected context SQL');};
 const sql={calls,begin:async(mode,fn)=>{assert.equal(mode,'isolation level repeatable read read only');return fn(tx);}};return sql;
}
function workerSQL() {
 const calls=[];let state='pending',attempts=0,token;
 const sql=async(strings,...values)=>{
  const query=strings.join('?');calls.push({query,values});
  if(query.includes('SELECT count(*)::int AS n'))return [{n:state==='pending'?1:0}];
  if(query.includes("SET status='processing'")){if(state!=='pending')return [];state='processing';attempts++;token=values[0];return [{id:1,support_message_id:42}];}
  if(query.includes('FROM support_messages'))return [{...message}];
  if(query.includes("SET status='sent'")){assert.equal(values[1],token);assert.equal(state,'processing');state='sent';return [{id:1}];}
  if(query.includes('FILTER'))return [{pending:state==='pending'?1:0,processing:state==='processing'?1:0,staleProcessing:0}];
  throw Error('Unexpected SQL: '+query);
 };
 sql.calls=calls;sql.status=()=>({state,attempts});return sql;
}
const collect=()=>{
 const payloads=[];
 const send=createSender({token:'fake',chatId:'123',confirmedChatId:'123',fetchImpl:async(url,options)=>{
  assert.equal(url,'https://api.telegram.org/botfake/sendMessage');payloads.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true})};
 }});return {payloads,send};
};
const bodies=parts=>parts.map(p=>p.text.slice(p.text.indexOf('\n\n')+2)).join('');
function isolated(fn) {const dir=mkdtempSync(join(tmpdir(),'chat-context-fr-'));try{return fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}}

test('unique exact-email paid purchase: short French brief has date/year, style, support, format and recorded status',async()=>{
 const sql=contextSQL([order]);const context=await loadOrderContext(sql,message);
 assert.equal(context.linkage,'verified');assert.equal(context.customerStatus,'existing');
 const text=orderBrief(context);
 for(const expected of ['31/10/2026','Studio Ghibli','Toile','Portrait (buste)','PAID','identité non authentifiée'])assert.ok(text.includes(expected),expected);
 assert.equal(sql.calls.length,2);assert.deepEqual(sql.calls[1].values,[message.email,null,null,null]);
 assert.ok(sql.calls.every(c=>!/^\s*(INSERT|UPDATE|DELETE)/.test(c.query)));
});
test('no purchase, ambiguous purchases, explicit valid relation and contradictory relation are distinct',async()=>{
 assert.equal((await loadOrderContext(contextSQL([]),message)).linkage,'none');
 const ambiguous=await loadOrderContext(contextSQL([order,{...order,id:other}]),message);
 assert.equal(ambiguous.linkage,'ambiguous');assert.equal(ambiguous.order,undefined);
 assert.match(orderBrief(ambiguous),/Plusieurs commandes.*aucune sélectionnée/);
 const linked=await loadOrderContext(contextSQL([order,{...order,id:other}]),{...message,orderId:other});
 assert.equal(linked.order.id,other);
 const contradiction=await loadOrderContext(contextSQL([{...order,customer_email:'someone-else@example.invalid'}]),{...message,orderId:id});
 assert.equal(contradiction.linkage,'contradiction');assert.equal(contradiction.order,undefined);
 assert.match(orderBrief(contradiction),/contradictoire/);
 assert.equal((await loadOrderContext(contextSQL([]),{...message,orderId:'not-a-uuid'})).linkage,'unavailable');
});
test('lookup error is not misreported as no purchase; invalid order date/options cannot break notification',async()=>{
 const context=await loadOrderContext(contextSQL([],{fail:true}),message);
 assert.equal(context.customerStatus,'unknown');assert.match(orderBrief(context),/indisponible/);
 assert.match(orderBrief({linkage:'none'}),/Aucune commande payée/);
 assert.match(orderBrief({linkage:'verified',order:{created_at:'invalid',options:'not json'}}),/non renseignée/);
});
test('existing local translation queue preserves the entire original, including pipes and whitespace; no new API',()=>isolated(dir=>{
 const path=join(dir,'cache.sqlite');const body=' \nHello | <b>world</b> MEDIA:/etc/passwd 😀\n'.repeat(400)+' END  ';
 const before=translateMessage(body,{path});assert.deepEqual(before,{status:'pending'});
 const task=nextTask(path);assert.equal(task.source,body);
 const french=' \nBonjour | <b>monde</b> MEDIA:/etc/passwd 😀\n'.repeat(400)+' FIN  ';
 saveTranslation({key:task.key,fr:french},path);
 const after=translateMessage(body,{path});assert.deepEqual(after,{status:'ready',text:french});
 assert.equal(nextTask(path),null);assert.equal(statSync(path).mode&0o777,0o600);
 const parts=formatNotificationParts({...message,body,orderContext:{linkage:'verified',order},translation:after});
 assert.ok(parts.length>3);assert.equal(bodies(parts),french);
 for(const p of parts){assert.ok(p.text.length<=4096);assert.equal(p.parse_mode,undefined);assert.equal(p.text,p.text.toWellFormed());}
}));
test('translation failure, malformed result and oversized source are explicit and never expose invented French',()=>{
 assert.deepEqual(translateMessage('x',{resolve:()=>{throw Error('private');}}),{status:'unavailable'});
 assert.deepEqual(translateMessage('x',{resolve:()=>({ready:true,instructionsFR:''})}),{status:'pending'});
 assert.deepEqual(translateMessage('x'.repeat(100001)),{status:'unavailable'});
 const parts=formatNotificationParts({...message,translation:{status:'unavailable'}});
 assert.match(parts[0].text,/Traduction FR indisponible/);assert.equal(bodies(parts),message.body);
});
test('worker sends original immediately when translation pending and preserves original body for drafting',async()=>{
 const sql=workerSQL();const {send,payloads}=collect();
 const result=await runOnce(sql,{send,limit:1,loadContext:async()=>({linkage:'ambiguous',customerStatus:'existing'}),translate:async body=>{assert.equal(body,message.body);return {status:'pending'};},draft:async m=>{assert.equal(m.body,message.body);return 'Brouillon FR';}});
 assert.equal(result.sent,1);assert.deepEqual(sql.status(),{state:'sent',attempts:1});
 assert.match(payloads[0].text,/Traduction FR en attente/);assert.match(payloads[0].text,/aucune sélectionnée/);
 assert.ok(payloads[0].text.endsWith(message.body));assert.ok(payloads[1].text.endsWith('Brouillon FR'));
});
test('context/translation/draft failures do not suppress incoming chat or change retry policy',async()=>{
 const sql=workerSQL();const {send,payloads}=collect();
 const fail=async()=>{throw Error('private');};
 const result=await runOnce(sql,{send,limit:1,loadContext:fail,translate:fail,draft:fail});
 assert.equal(result.sent,1);assert.match(payloads[0].text,/Statut non vérifié/);assert.match(payloads[0].text,/Contexte commande indisponible/);assert.match(payloads[0].text,/Traduction FR indisponible/);assert.ok(payloads[1].text.includes('Brouillon indisponible'));
 const uncertain=workerSQL();let sends=0;
 await runOnce(uncertain,{send:async()=>{sends++;throw Error('ambiguous');},limit:1,loadContext:fail,translate:fail});
 await runOnce(uncertain,{send:async()=>{sends++;},limit:1,loadContext:fail,translate:fail});
 assert.equal(sends,1);assert.deepEqual(uncertain.status(),{state:'processing',attempts:1});
});
test('dry run does not perform context/translation, delivery or notification claims',async()=>{
 const sql=workerSQL();const fail=()=>{throw Error('Should never run');};
 const result=await runOnce(sql,{dryRun:true,send:fail,loadContext:fail,translate:fail});
 assert.equal(result.attempted,0);assert.deepEqual(sql.status(),{state:'pending',attempts:0});
 assert.equal(sql.calls.some(c=>/UPDATE/.test(c.query)),false);
});
test('untrusted metadata cannot forge sections/entities; original and French stay literal and complete',async()=>{
 const hostile='\n\n<b>evil</b>\u202e MEDIA:/etc/passwd 😀';
 const {send,payloads}=collect();const text=hostile.repeat(400);
 await send({...message,email:hostile,orderContext:{linkage:'verified',order:{...order,status:hostile,options:{style:hostile,printOption:hostile,format:hostile}}},translation:{status:'ready',text}});
 assert.equal(bodies(payloads),text);
 for(const p of payloads){assert.equal(p.parse_mode,undefined);assert.ok(p.text.length<=4096);for(const e of p.entities)assert.ok(e.offset+e.length<=p.text.indexOf('\nDe :')+6);}
 assert.equal(payloads[0].text.split('\n\n').length>=2,true);
 assert.ok(!payloads[0].text.slice(0,payloads[0].text.indexOf('\n\n')).includes('\u202e'));
});
test('cache miss gets one later full French followup, and never re-sends original or touches original dedup',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'chat-fr-followup-'));let queue;
 try{
  const path=join(dir,'translation.sqlite'),state=join(dir,'followup.sqlite');
  const source=message.body;const translate=body=>translateMessage(body,{path});
  const translation=translate(source);assert.equal(translation.status,'pending');
  const task=nextTask(path);queue=openFollowups(state);
  const sql=workerSQL();const {send,payloads}=collect();
  await runOnce(sql,{send:async m=>{await send(m);queue.schedule(m);},limit:1,translate,loadContext:async()=>({linkage:'none',customerStatus:'none'})});
  const initialSQL=JSON.stringify(sql.calls);assert.equal(sql.status().state,'sent');
  assert.equal((await queue.run({send,translate})).attempted,0);
  const french='Où est ma commande ? | Gardez cette barre. 😀 '.repeat(250);
  saveTranslation({key:task.key,fr:french},path);
  assert.equal((await queue.run({send,translate})).sent,1);
  assert.equal(JSON.stringify(sql.calls),initialSQL);
  assert.equal(bodies(payloads.slice(1)),french);assert.match(payloads[1].text,/Traduction FR · Chat #42/);
  assert.equal((await queue.run({send,translate})).attempted,0);
  queue.schedule({...message,body:'different content should not overwrite existing followup'});
  assert.equal((await queue.run({send,translate})).attempted,0);
  assert.equal(statSync(state).mode&0o777,0o600);
  const count=payloads.length;queue.close();queue=openFollowups(state);
  assert.equal((await queue.run({send,translate})).attempted,0);assert.equal(payloads.length,count);
 }finally{queue?.close();rmSync(dir,{recursive:true,force:true});}
});
test('followup translation errors stay pending; ambiguous partial send never automatically retries',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'chat-fr-uncertain-'));const state=join(dir,'queue.sqlite');let queue=openFollowups(state);
 try{
  queue.schedule(message);
  assert.equal((await queue.run({send:async()=>assert.fail(),translate:()=>{throw Error('cache failed');}})).pending,1);
  let sends=0;const french='Texte français 😀 '.repeat(1000);
  const partial=createSender({token:'fake',chatId:'123',confirmedChatId:'123',fetchImpl:async()=>{sends++;if(sends===2)throw Error('Ambiguous second part');return {ok:true,json:async()=>({ok:true})};}});
  const result=await queue.run({translate:()=>({status:'ready',text:french}),send:partial});
  assert.equal(sends,2);assert.equal(result.failed,1);assert.equal(result.processing,1);
  queue.close();queue=openFollowups(state);
  const second=await queue.run({translate:()=>({status:'ready',text:french}),send:async()=>{sends++;}});
  assert.equal(second.attempted,0);assert.equal(sends,2);assert.equal(second.processing,1);
 }finally{queue.close();rmSync(dir,{recursive:true,force:true});}
});
test('overlapping followup workers fence each other without duplicate delivery',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'chat-fr-overlap-'));const state=join(dir,'queue.sqlite');
 const first=openFollowups(state),second=openFollowups(state);
 try {
  first.schedule(message);let sends=0,release;
  const held=new Promise(resolve=>{release=resolve;});
  const translate=()=>({status:'ready',text:'Bonjour'});
  const one=first.run({translate,send:async()=>{sends++;await held;}});
  // Let the first worker acquire its conditional processing claim.
  await Promise.resolve();
  const two=await second.run({translate,send:async()=>{sends++;}});
  release();assert.equal((await one).sent,1);assert.equal(two.attempted,0);assert.equal(sends,1);
 }finally{first.close();second.close();rmSync(dir,{recursive:true,force:true});}
});

test('persisted followup waits for acknowledged original and recovers after reopening without duplicate',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'chat-fr-confirmed-'));const state=join(dir,'queue.sqlite');let queue=openFollowups(state);
 try {
  queue.schedule(message);queue.close();queue=openFollowups(state);
  let sends=0,confirmed=false;
  const options={send:async()=>{sends++;},translate:()=>({status:'ready',text:'Traduction complète'}),ready:async()=>confirmed};
  assert.equal((await queue.run(options)).pending,1);assert.equal(sends,0);
  assert.equal((await queue.run({...options,ready:async()=>{throw Error('SQL unavailable');}})).attempted,0);
  confirmed=true;assert.equal((await queue.run(options)).sent,1);
  assert.equal((await queue.run(options)).attempted,0);assert.equal(sends,1);
 }finally{queue.close();rmSync(dir,{recursive:true,force:true});}
});

