// Real PostgreSQL on a disposable cluster; no production environment, inference or transport.
import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import net from 'node:net';
import postgres from 'postgres';
import {runOnce,draftInput,loadHistory,formatNotificationParts} from '../scripts/chat-telegram-worker.mjs';
import {loadOrderContext,translateMessage} from '../scripts/chat-notification-context.mjs';
import {openFollowups} from '../scripts/chat-translation-followups.mjs';
import {nextTask,saveTranslation} from '/home/hermes/.hermes/profiles/cartoonova/scripts/notification-translation.mjs';
const dir=mkdtempSync(join(tmpdir(),'chat-grouping-')),bin='/usr/lib/postgresql/18/bin';
const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const pg=(cmd,args)=>execFileSync(join(bin,cmd),args,{env,stdio:'pipe',timeout:15000});
let db,other,started=false;
before(async()=>{
 const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));assert.notEqual(port,5432);
 pg('initdb',['-D',dir+'/pg','-U','test','--auth=trust','--no-locale','--encoding=UTF8']);
 pg('pg_ctl',['-D',dir+'/pg','-l',dir+'/log','-o',`-h 127.0.0.1 -p ${port} -k ${dir}`,'-w','start']);started=true;
 const url=`postgresql://test@127.0.0.1:${port}/postgres`;
 db=postgres(url,{onnotice(){},max:1});other=postgres(url,{onnotice(){},max:1});
 await db`CREATE TABLE support_messages(id serial PRIMARY KEY,from_email text NOT NULL,body_text text,received_at timestamptz DEFAULT now(),order_id uuid)`;
 await db`CREATE TABLE support_replies(id serial PRIMARY KEY,to_email text,body_text text,sent_at timestamptz)`;
 await db`CREATE TABLE orders(id uuid,customer_email text,paid_at timestamptz,status text,created_at timestamptz,options jsonb)`;
 await db.unsafe(readFileSync(new URL('../migrations/20261026_chat_telegram_notifications.sql',import.meta.url),'utf8'));
});
beforeEach(async()=>{await db`TRUNCATE chat_telegram_notifications,support_messages,support_replies,orders RESTART IDENTITY`;});
after(async()=>{await db?.end({timeout:2});await other?.end({timeout:2});if(started)pg('pg_ctl',['-D',dir+'/pg','-m','fast','-w','stop']);rmSync(dir,{recursive:true,force:true});});
async function add(email,body,age=100,sql=db,orderId=null){
 const [m]=await sql`INSERT INTO support_messages(from_email,body_text,received_at,order_id) VALUES(${email},${body},now()-make_interval(secs=>${age}),${orderId}) RETURNING id`;
 await sql`INSERT INTO chat_telegram_notifications(support_message_id,available_at) VALUES(${m.id},now()-make_interval(secs=>${age}))`;
 return m.id;
}
const tick=(sql,options={})=>runOnce(sql,{settleSeconds:90,limit:1,translate:()=>({status:'french'}),...options});
const states=()=>db`SELECT support_message_id,status,attempts,lock_token FROM chat_telegram_notifications ORDER BY support_message_id`;
test('successive messages reset the 90-second quiet period; exact boundary is eligible',async()=>{
 await db.begin(async tx=>{
  await add('a@example.invalid','first',200,tx);await add('A@example.invalid','second',89,tx);
  assert.equal((await tick(tx,{send:()=>assert.fail('too soon')})).attempted,0);
  await tx`UPDATE chat_telegram_notifications SET available_at=now()-interval '90 seconds' WHERE support_message_id=2`;
  const seen=[];assert.equal((await tick(tx,{send:m=>seen.push(m)})).sent,1);
  assert.equal(seen.length,1);assert.deepEqual(seen[0].groupedIds,[1,2]);
  assert.equal(seen[0].body,'Message 1 (chat #1) :\nfirst\n\nMessage 2 (chat #2) :\nsecond');
 });
 assert.deepEqual((await states()).map(r=>[r.status,r.attempts]),[['sent',1],['sent',1]]);
});
test('busy sender does not delay another sender, and future availability is never swallowed',async()=>{
 await add('busy@example.invalid','old',200);await add('busy@example.invalid','new',20);
 await add('ready@example.invalid','ready',100);await add('future@example.invalid','future',-100);
 const seen=[];assert.equal((await tick(db,{send:m=>seen.push(m)})).sent,1);
 assert.equal(seen[0].email,'ready@example.invalid');assert.equal(seen[0].body,'ready');
 assert.deepEqual((await states()).map(r=>r.status),['pending','pending','sent','pending']);
});
test('future message of the same sender postpones the entire burst, not early delivery',async()=>{
 await add('a@example.invalid','old',200);await add('a@example.invalid','future',-10);
 assert.equal((await tick(db,{send:()=>assert.fail()})).attempted,0);
 assert.deepEqual((await states()).map(r=>r.status),['pending','pending']);
});
test('two real concurrent workers claim one complete burst once, in message order',async()=>{
 for(let round=0;round<12;round++){
  await db`TRUNCATE chat_telegram_notifications,support_messages RESTART IDENTITY`;
  await add(' A@example.invalid ','one');await add('a@example.invalid','two');await add('A@example.invalid','three');
  const seen=[];const results=await Promise.all([tick(db,{send:m=>seen.push(m)}),tick(other,{send:m=>seen.push(m)})]);
  assert.equal(results.reduce((n,r)=>n+r.sent,0),1);assert.equal(seen.length,1);assert.deepEqual(seen[0].groupedIds,[1,2,3]);
  assert.deepEqual((await states()).map(r=>[r.status,r.attempts]),[['sent',1],['sent',1],['sent',1]]);
 }
});
test('message arriving while draft is running remains pending and is delivered in a later burst',async()=>{
 await add('a@example.invalid','first');await add('a@example.invalid','second');
 let entered,release;const drafting=new Promise(r=>{entered=r;}),held=new Promise(r=>{release=r;});const seen=[];
 const running=tick(db,{draft:async m=>{entered(m);await held;return 'draft';},send:m=>seen.push(m)});
 const first=await drafting;assert.deepEqual(first.groupedIds,[1,2]);await add('a@example.invalid','third',0,other);release();
 assert.equal((await running).sent,1);assert.deepEqual((await states()).map(r=>r.status),['sent','sent','pending']);
 assert.equal((await tick(db,{send:()=>assert.fail('third is not settled')})).attempted,0);
 await db`UPDATE chat_telegram_notifications SET available_at=now()-interval '91 seconds' WHERE support_message_id=3`;
 assert.equal((await tick(db,{send:m=>seen.push(m)})).sent,1);assert.equal(seen.length,2);assert.equal(seen[1].body,'third');
});
test('ambiguous grouped send fences every member; no automatic replay even after lock expiry',async()=>{
 await add('a@example.invalid','one');await add('a@example.invalid','two');let sends=0;
 assert.equal((await tick(db,{send:()=>{sends++;throw Error('ambiguous');}})).failed,1);
 const rows=await states();assert.ok(rows.every(r=>r.status==='processing'&&r.attempts===1));assert.equal(rows[0].lock_token,rows[1].lock_token);
 await db`UPDATE chat_telegram_notifications SET locked_until=now()-interval '1 day'`;
 const again=await tick(other,{send:()=>{sends++;}});assert.equal(again.attempted,0);assert.equal(again.staleProcessing,2);assert.equal(sends,1);
});
test('settle=0 retains immediate individual-message delivery; dry-run never claims a burst',async()=>{
 await add('a@example.invalid','one',0);await add('a@example.invalid','two',0);
 const dry=await tick(db,{dryRun:true});assert.equal(dry.pending,2);assert.equal(dry.attempted,0);
 const seen=[];const result=await runOnce(db,{settleSeconds:0,limit:2,send:m=>seen.push(m),translate:()=>({status:'french'})});
 assert.equal(result.sent,2);assert.deepEqual(seen.map(m=>m.body),['one','two']);
});
test('recent sent replies and earlier messages reach the draft, not another sender or current burst',async()=>{
 await add('a@example.invalid','earlier',500);await db`UPDATE chat_telegram_notifications SET status='sent'`;
 await add('b@example.invalid','private-other',400);await db`UPDATE chat_telegram_notifications SET status='sent'`;
 await db`INSERT INTO support_replies(to_email,body_text,sent_at) VALUES('A@example.invalid','already answered',now()-interval '4 minutes'),('a@example.invalid','UNSENT',NULL)`;
 await add('a@example.invalid','new one');await add('a@example.invalid','new two');
 const seen=[];await tick(db,{history:loadHistory,draft:async m=>{seen.push(draftInput(m));return 'brouillon';},send:()=>{}});
 assert.equal(seen.length,1);assert.match(seen[0].bodyText,/Client : earlier/);assert.match(seen[0].bodyText,/Cartoonova : already answered/);
 assert.doesNotMatch(seen[0].bodyText,/private-other|UNSENT/);assert.ok(seen[0].bodyText.endsWith('new two'));
 assert.equal(seen[0].bodyText.split('new one').length,2);
});
test('multiple explicit orders in one burst never pick the first order',async()=>{
 await add('a@example.invalid','one',100,db,'11111111-1111-4111-8111-111111111111');
 await add('a@example.invalid','two',100,db,'22222222-2222-4222-8222-222222222222');
 await tick(db,{send:m=>{assert.equal(m.conflictingOrders,true);assert.equal(m.orderContext.linkage,'contradiction');assert.equal(m.orderContext.order,undefined);}});
});
test('full oversized burst remains visible but gets an explicit unavailable draft, never a truncated answer',async()=>{
 const first='a'.repeat(1800),second='b'.repeat(1800),seen=[];
 await add('a@example.invalid',first);await add('a@example.invalid',second);
 assert.equal((await tick(db,{draft:async m=>draftInput(m).bodyText,send:m=>seen.push(m)})).sent,1);
 assert.equal(seen[0].draft,null);assert.ok(seen[0].body.includes(first));assert.ok(seen[0].body.endsWith(second));
 const parts=formatNotificationParts(seen[0]);assert.ok(parts.at(-1).text.includes('Brouillon indisponible'));
});
test('grouped originals produce one durable complete translation followup, never replay a member',async()=>{
 const path=join(dir,'group-cache.sqlite'),queue=openFollowups(join(dir,'group-ledger.sqlite'));
 try {
  await add('a@example.invalid','Hello | first 😀');await add('A@example.invalid','Please keep the second message too');
  const seen=[],translate=body=>translateMessage(body,{path});
  const result=await tick(db,{translate,send:m=>{queue.schedule(m);seen.push(m);}});
  assert.equal(result.sent,1);assert.equal(seen.length,1);
  const task=nextTask(path);assert.equal(task.source,seen[0].body);assert.ok(task.source.endsWith('Please keep the second message too'));
  const options={translate,ready:async m=>(await db`SELECT status FROM chat_telegram_notifications WHERE support_message_id=${m.id}`)[0]?.status==='sent',send:m=>seen.push(m)};
  assert.equal((await queue.run(options)).attempted,0);
  const text='Message 1 (chat #1) :\nBonjour | premier 😀\n\nMessage 2 (chat #2) :\nVeuillez garder aussi le deuxième message';
  saveTranslation({key:task.key,fr:text},path);
  assert.equal((await queue.run(options)).sent,1);assert.equal(seen.length,2);assert.equal(seen[1].translationOnly,true);assert.equal(seen[1].translation.text,text);
  assert.equal((await queue.run(options)).attempted,0);assert.equal((await tick(db,{send:()=>assert.fail()})).attempted,0);
  assert.deepEqual((await states()).map(r=>[r.status,r.attempts]),[['sent',1],['sent',1]]);
 }finally{queue.close();}
});

test('French bypass is conservative for Italian/shared words and mixed-language bursts',()=>{
 const resolve=()=>({ready:false});
 assert.deepEqual(translateMessage('Bonjour, je voudrais modifier ma commande.',{resolve}),{status:'french'});
 assert.deepEqual(translateMessage('Il non è per me, la foto',{resolve}),{status:'pending'});
 assert.deepEqual(translateMessage('Message 1 (chat #1) :\nBonjour je voudrais modifier ma commande\n\nMessage 2 (chat #2) :\nHello please change my order',{resolve}),{status:'pending'});
 assert.deepEqual(translateMessage('Message 1 (chat #1) :\nBonjour je voudrais modifier ma commande\n\nMessage 2 (chat #2) :\nMerci pour les photos',{resolve}),{status:'french'});
});
test('draft capacity never cuts the new text or a surrogate pair; context failures fail open',async()=>{
 const body='new 😀 '.repeat(240);const input=draftInput({body,history:'old 😀 '.repeat(500)});
 assert.ok(input.bodyText.length<=2000);assert.ok(input.bodyText.endsWith(body));assert.equal(input.bodyText.toWellFormed(),input.bodyText);
 assert.equal(draftInput({body:'x'.repeat(2000)}).bodyText.length,2000);assert.throws(()=>draftInput({body:'x'.repeat(2001)}),/capacity/);
 assert.equal((await loadOrderContext({}, {conflictingOrders:true})).linkage,'contradiction');
 await add('a@example.invalid','bonjour je voudrais les photos');
 assert.equal((await tick(db,{history:()=>{throw Error('unavailable');},send:m=>assert.equal(m.history,undefined)})).sent,1);
});
