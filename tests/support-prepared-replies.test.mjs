import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { execFileSync, fork } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import { tmpdir } from 'node:os';
import net from 'node:net';
import postgres from 'postgres';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..'), runtime=mkdtempSync(path.join(tmpdir(),'support-draft-')), bin='/usr/lib/postgresql/18/bin';
const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
test('losing the lock connection during a delayed claim cannot permit two provider calls',{timeout:15000},async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const input={targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Crash',body:'Unique',attachments:[]};
 const first=await drafts.prepareSupportReply(input),second=await drafts.prepareSupportReply(input);
 const a=await drafts.readPreparedSupportReply(first),b=await drafts.readPreparedSupportReply(second);
 await delivery.approvePreparedSupportReply(first,a.approvalFingerprint);await delivery.approvePreparedSupportReply(second,b.approvalFingerprint);
 await db.unsafe(`CREATE FUNCTION delay_claim() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${first}'::uuid AND NEW.status='sending' THEN PERFORM pg_sleep(2); END IF; RETURN NEW; END $$`);
 await db`CREATE TRIGGER delay_claim BEFORE UPDATE ON support_prepared_replies FOR EACH ROW EXECUTE FUNCTION delay_claim()`;
 let calls=0;
 const worker=fork(path.join(root,'tests/support-prepared-crash-worker.cjs'),[],{env,stdio:['ignore','ignore','ignore','ipc']});
 worker.on('message',message=>{if(message.provider)calls++;});
 const send1=new Promise(resolve=>worker.once('exit',resolve));
 worker.send({url:dbUrl,id:first,fingerprint:a.approvalFingerprint});
 try {
  let claimant;
  for(let i=0;i<100;i++){[claimant]=await db`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event='PgSleep' AND query LIKE '%UPDATE support_prepared_replies SET status=%'`;if(claimant)break;await new Promise(r=>setTimeout(r,20));}
  assert.ok(claimant,'claim reached database sleep');
  const [holder]=await db`SELECT pid FROM pg_locks WHERE locktype='advisory' AND granted AND pid <> ${claimant.pid} LIMIT 1`;
  await db`SELECT pg_terminate_backend(${holder?.pid ?? claimant.pid})`;
  if (!holder) await send1;
  await delivery.sendPreparedSupportReply(second,b.approvalFingerprint,async()=>({id:`second-${++calls}`})).catch(()=>{});
  await send1;assert.equal(calls,1,`provider called ${calls} times`);
 } finally {await send1;await db`DROP TRIGGER delay_claim ON support_prepared_replies`;await db`DROP FUNCTION delay_claim()`;}
});
test('process crash at provider boundary leaves a durable claim blocking a second process',{timeout:15000},async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const input={targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Crash after claim',body:'Unique',attachments:[]};
 const first=await drafts.prepareSupportReply(input),second=await drafts.prepareSupportReply(input);
 const a=await drafts.readPreparedSupportReply(first),b=await drafts.readPreparedSupportReply(second);
 await delivery.approvePreparedSupportReply(first,a.approvalFingerprint);await delivery.approvePreparedSupportReply(second,b.approvalFingerprint);
 const worker=fork(path.join(root,'tests/support-prepared-crash-worker.cjs'),[],{env,stdio:['ignore','ignore','ignore','ipc']});
 const exited=new Promise(resolve=>worker.once('exit',resolve));
 try {
  const entered=new Promise((resolve,reject)=>{worker.on('message',m=>{if(m.provider)resolve();});worker.once('exit',()=>reject(Error('worker exited before provider')));});
  worker.send({url:dbUrl,id:first,fingerprint:a.approvalFingerprint,stall:true});
  await entered;
  const [row]=await db`SELECT status FROM support_prepared_replies WHERE id=${first}::uuid`;
  assert.equal(row.status,'sending');worker.kill('SIGKILL');await exited;
  let calls=0;await assert.rejects(delivery.sendPreparedSupportReply(second,b.approvalFingerprint,async()=>{calls++;return{id:'duplicate'};}),/bloque/i);
  assert.equal(calls,0);
 } finally {if(worker.exitCode===null && worker.signalCode===null)worker.kill('SIGKILL');await exited;await discardFixtures([first,second]);}
});
test('SQL cannot delete approved snapshots or roll back delivery evidence',async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const id=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Guard',body:'Evidence',attachments:[{name:'proof.txt',contentType:'text/plain',bytes:Buffer.from('proof')}]});
 const draft=await drafts.readPreparedSupportReply(id);await delivery.approvePreparedSupportReply(id,draft.approvalFingerprint);
 await assert.rejects(db`DELETE FROM support_prepared_replies WHERE id=${id}::uuid`,/immutable|evidence/i);
 await assert.rejects(db`UPDATE support_prepared_replies SET created_at=created_at-interval '1 day' WHERE id=${id}::uuid`,/immutable|evidence/i);
 await assert.rejects(db`UPDATE support_prepared_replies SET status='sent' WHERE id=${id}::uuid`,/transition|evidence/i);
 await delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>({id:'guard-provider'}));
 await assert.rejects(db`UPDATE support_prepared_replies SET status='prepared',provider_id=NULL,provider_sent_at=NULL,resolved_at=NULL,reply_id=NULL WHERE id=${id}::uuid`,/transition|evidence/i);
 await assert.rejects(db`UPDATE support_prepared_replies SET provider_id='changed' WHERE id=${id}::uuid`,/immutable|evidence/i);
 await assert.rejects(db`DELETE FROM support_prepared_replies WHERE id=${id}::uuid`,/immutable|evidence/i);
 assert.equal((await drafts.readPreparedSupportReply(id)).status,'sent');
});
test('approved snapshot and attachments cannot be changed by another SQL writer',async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const id=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Snapshot',body:'Original',attachments:[{name:'proof.txt',contentType:'text/plain',bytes:Buffer.from('original')}]});
 const d=await drafts.readPreparedSupportReply(id);await delivery.approvePreparedSupportReply(id,d.approvalFingerprint);
 await assert.rejects(db`UPDATE support_prepared_replies SET body_text='changed' WHERE id=${id}::uuid`);
 await assert.rejects(db`UPDATE support_prepared_attachments SET content=${Buffer.from('changed')} WHERE draft_id=${id}::uuid`);
});
test('pre-provider preparation failures do not quarantine or weaken duplicate protection',async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const input={targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Question',body:'Bonjour',attachments:[]};
 const first=await drafts.prepareSupportReply(input), second=await drafts.prepareSupportReply(input);
 const a=await drafts.readPreparedSupportReply(first),b=await drafts.readPreparedSupportReply(second);
 await delivery.approvePreparedSupportReply(first,a.approvalFingerprint);await delivery.approvePreparedSupportReply(second,b.approvalFingerprint);
 let calls=0;
 await assert.rejects(delivery.sendPreparedSupportReply(first,a.approvalFingerprint,async()=>{calls++;return {id:'unexpected'};},()=>{throw Error('local preparation failed');}),/local preparation failed/);
 assert.equal(calls,0);assert.equal((await drafts.readPreparedSupportReply(first)).status,'prepared');
 await delivery.sendPreparedSupportReply(second,b.approvalFingerprint,async()=>({id:`safe-${++calls}`}));
 await assert.rejects(delivery.sendPreparedSupportReply(first,a.approvalFingerprint,async()=>({id:`duplicate-${++calls}`})),/bloque/i);
 assert.equal(calls,1);
});
test('route rejects an incomplete approved transport without calling the provider or quarantining',async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts'),route=load('app/api/support/prepared-send/route.ts');
 const id=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Question',body:'Bonjour',attachments:[]});
 const fp=createHash('sha256').update(JSON.stringify(['message','42',null,'client@example.invalid','Question','Bonjour',false,[null,null,null,null,null],[]])).digest('hex');
 await db`UPDATE support_prepared_replies SET transport='null'::jsonb,approval_hash=${fp} WHERE id=${id}::uuid`;
 await delivery.approvePreparedSupportReply(id,fp);
 const before=providerCalls.length;
 const response=await route.POST(new Request('https://local.invalid',{method:'POST',body:JSON.stringify({id,approvalFingerprint:fp})}));
 assert.equal(response.status,409);assert.equal((await response.json()).state,'prepared');
 assert.equal(providerCalls.length,before);assert.equal((await drafts.readPreparedSupportReply(id)).status,'prepared');
});
test('route quarantines even a synchronous transport exception and prevents another attempt',async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts'),route=load('app/api/support/prepared-send/route.ts');
 const id=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Question',body:'Bonjour',attachments:[]});
 const draft=await drafts.readPreparedSupportReply(id);await delivery.approvePreparedSupportReply(id,draft.approvalFingerprint);
 const request=()=>new Request('https://local.invalid',{method:'POST',body:JSON.stringify({id,approvalFingerprint:draft.approvalFingerprint})});
 const before=providerCalls.length;providerFailure=true;
 try {
  let response=await route.POST(request());assert.equal(response.status,409);assert.equal((await response.json()).state,'sending');
  response=await route.POST(request());assert.equal(response.status,409);assert.equal((await response.json()).state,'sending');
  assert.equal(providerCalls.length,before+1);
 } finally {providerFailure=false;providerCalls.splice(before);await discardFixtures([id]);}
});
const pg=(cmd,args)=>execFileSync(path.join(bin,cmd),args,{env,timeout:15000,stdio:'pipe'});
let db,dbUrl,started=false,authorized=true,realAuth=false,providerFailure=false;const providerCalls=[];
// Fixture teardown only: the disposable cluster owner temporarily disables the delete guard.
async function discardFixtures(ids){await db.begin(async tx=>{await tx`ALTER TABLE support_prepared_replies DISABLE TRIGGER support_preserve_delivery_evidence`;await tx`DELETE FROM support_prepared_replies WHERE id IN ${tx(ids)}`;await tx`ALTER TABLE support_prepared_replies ENABLE TRIGGER support_preserve_delivery_evidence`;});}
function load(file,cache=new Map()) {
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;
 const m=new Module(file);m.filename=file;cache.set(file,m);const orig=createRequire(file);
 m.require=name=>{if(name==='@/lib/envoiEmail')return {envoyerEmail:(payload,options)=>{providerCalls.push({payload,options});if(providerFailure)throw Error('transport threw');return Promise.resolve({data:{id:'route-provider-id'},error:null});}};if(name==='@/lib/db')return {sql:db,withFreshDatabaseClient:async run=>{const client=postgres(dbUrl,{max:1,onnotice(){}});try{return await run(client)}finally{await client.end({timeout:2})}},getSupportMessageById:async id=>id===42?{id:42,from_email:'client@example.invalid',subject:'question',message_id:'source@example.invalid',order_id:null,replies:[]}:null,getOrderById:async()=>null};if(name==='@/lib/adminAuth'&&!realAuth)return {refuserSiPasAdmin:async()=>authorized?null:Response.json({error:'Non autorisé'},{status:401})};if(name.startsWith('@/')||name.startsWith('.')){const base=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(file),name);if(existsSync(base+'.ts'))return load(base+'.ts',cache);}return orig(name);};
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);return m.exports;
}
before(async()=>{
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));assert.notEqual(port,5432);
 pg('initdb',['-D',path.join(runtime,'pg'),'-U','support_test','--auth=trust','--no-locale','--encoding=UTF8']);
 pg('pg_ctl',['-D',path.join(runtime,'pg'),'-l',path.join(runtime,'pg.log'),'-o',`-h 127.0.0.1 -p ${port} -c unix_socket_directories=''`,'-w','start']);started=true;
 dbUrl=`postgresql://support_test@127.0.0.1:${port}/postgres`;db=postgres(dbUrl,{max:1,onnotice(){}});
 await db`CREATE TABLE admin_sessions (token_hash text, credential_hash text, expires_at timestamptz)`;
 await db`CREATE TABLE support_messages (id integer PRIMARY KEY, from_email text NOT NULL, order_id uuid, read_at timestamptz)`;
 await db`INSERT INTO support_messages(id,from_email) VALUES(42,'client@example.invalid')`;
 await db`CREATE TABLE support_replies (id serial PRIMARY KEY, support_message_id integer REFERENCES support_messages(id), order_id uuid, to_email text, subject text, body_text text, assistee_ia boolean, provider_id text, sent_at timestamptz DEFAULT now())`;
 await db.unsafe(readFileSync(path.join(root,'migrations/20261104_support_private_attachments.sql'),'utf8'));
 await db.unsafe(readFileSync(path.join(root,'migrations/20261104_support_prepared_replies.sql'),'utf8'));
});
after(async()=>{if(db)await db.end({timeout:2});if(started)pg('pg_ctl',['-D',path.join(runtime,'pg'),'-m','fast','-w','stop']);rmSync(runtime,{recursive:true,force:true});});
test('support message lookup requires admin and returns an old message by id',async()=>{
 const route=load('app/api/support/messages/route.ts');
 const req=id=>new Request(`https://local.invalid/api/support/messages?id=${id}`);
 authorized=false;assert.equal((await route.GET(req('42'))).status,401);authorized=true;
 const response=await route.GET(req('42'));assert.equal(response.status,200);assert.equal((await response.json()).id,42);
 assert.equal((await route.GET(req('999'))).status,404);
 assert.equal((await route.GET(req('42x'))).status,400);
});
test('a prepared reply persists the exact recipient, message and private attachment before any send',async()=>{
 await db.unsafe(readFileSync(path.join(root,'migrations/20261104_support_prepared_replies.sql'),'utf8'));
 const drafts=load('lib/supportPreparedReplies.ts');
 const input={targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Bonjour, voici votre portrait.',attachments:[{name:'portrait.jpg',contentType:'image/jpeg',bytes:Buffer.from('synthetic portrait')}]};
 const id=await drafts.prepareSupportReply(input);
 const draft=await drafts.readPreparedSupportReply(id);
 assert.equal(draft.toEmail,input.toEmail);assert.equal(draft.subject,input.subject);assert.equal(draft.body,input.body);
 assert.equal(draft.status,'prepared');assert.equal(draft.attachments[0].name,'portrait.jpg');assert.deepEqual(draft.attachments[0].bytes,input.attachments[0].bytes);
 assert.match(draft.approvalFingerprint,/^[0-9a-f]{64}$/);
 await db`UPDATE support_prepared_replies SET body_text='modified' WHERE id=${id}::uuid`;
 await assert.rejects(drafts.readPreparedSupportReply(id), /modifié|corrompu/i);
});
test('preparation route requires an admin and resolves the recipient from the existing message',async()=>{
 const route=load('app/api/support/prepare/route.ts');
 function request(){const form=new FormData();form.set('messageId','42');form.set('body','Voici votre portrait.');form.append('attachments',new File(['sample'],'portrait.jpg',{type:'image/jpeg'}));return new Request('https://local.invalid',{method:'POST',body:form});}
 authorized=false;assert.equal((await route.POST(request())).status,401);authorized=true;
 const response=await route.POST(request());assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.draft.toEmail,'client@example.invalid');assert.equal(data.draft.subject,'Re: question');
 assert.equal(data.draft.attachments[0].name,'portrait.jpg');assert.match(data.draft.approvalFingerprint,/^[0-9a-f]{64}$/);
 assert.equal(data.draft.status,'prepared');assert.equal(data.draft.attachments[0].bytes,undefined);
});
test('provider acceptance survives a failed history write and repair never resends',async()=>{
 const drafts=load('lib/supportPreparedReplies.ts');const delivery=load('lib/supportPreparedDelivery.ts');
 const id=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Bonjour',attachments:[{name:'portrait.jpg',contentType:'image/jpeg',bytes:Buffer.from('proof')}]});
 const prepared=await drafts.readPreparedSupportReply(id);let sends=0;
 await delivery.approvePreparedSupportReply(id,prepared.approvalFingerprint);
 const provider=async(snapshot,key)=>{sends++;assert.equal(snapshot.body,'Bonjour');assert.equal(key,`support/${id}`);return {id:'synthetic-provider-id'};};
 await db`CREATE FUNCTION fail_reply() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''injected history failure''; END'`;
 await db`CREATE TRIGGER fail_reply BEFORE INSERT ON support_replies FOR EACH ROW EXECUTE FUNCTION fail_reply()`;
 await assert.rejects(delivery.sendPreparedSupportReply(id,prepared.approvalFingerprint,provider),/historique/i);
 assert.equal(sends,1);let [row]=await db`SELECT status,provider_id FROM support_prepared_replies WHERE id=${id}::uuid`;
 assert.equal(row.status,'sent');assert.equal(row.provider_id,'synthetic-provider-id');
 const pending=load('app/api/support/prepared-pending/route.ts'),repair=load('app/api/support/prepared-repair/route.ts');
 authorized=false;assert.equal((await pending.GET(new Request('https://local.invalid'))).status,401);authorized=true;
 const pendingResponse=await pending.GET(new Request('https://local.invalid'));assert.equal(pendingResponse.status,200);
 const items=await pendingResponse.json();assert.ok(items.some(item=>item.id===id&&item.status==='sent'&&item.attachments[0].name==='portrait.jpg'&&item.attachments[0].bytes===undefined));
 const laterId=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Bonjour',attachments:[]});
 const later=await drafts.readPreparedSupportReply(laterId);await delivery.approvePreparedSupportReply(laterId,later.approvalFingerprint);
 await db`DROP TRIGGER fail_reply ON support_replies`;
 const req=()=>new Request('https://local.invalid',{method:'POST',body:JSON.stringify({id,approvalFingerprint:prepared.approvalFingerprint})});
 assert.equal((await repair.POST(req())).status,200);assert.equal((await repair.POST(req())).status,200);
 await assert.rejects(delivery.sendPreparedSupportReply(laterId,later.approvalFingerprint,provider));assert.equal(sends,1);
 await assert.rejects(delivery.sendPreparedSupportReply(id,prepared.approvalFingerprint,provider));assert.equal(sends,1);
 const history=await db`SELECT r.body_text,a.filename,a.content FROM support_replies r JOIN support_private_attachments a ON a.reply_id=r.id WHERE r.provider_id='synthetic-provider-id'`;
 assert.equal(history.length,1);assert.equal(history[0].body_text,'Bonjour');assert.equal(history[0].filename,'portrait.jpg');assert.equal(history[0].content.toString(),'proof');
});
test('approval is bound to the snapshot and concurrent or uncertain sends never retry',{timeout:15000},async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'), delivery=load('lib/supportPreparedDelivery.ts');
 const make=async()=>{const id=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Bonjour',attachments:[]});const draft=await drafts.readPreparedSupportReply(id);await delivery.approvePreparedSupportReply(id,draft.approvalFingerprint);return [id,draft];};
 let [id,draft]=await make(),sends=0,release;const barrier=new Promise(r=>release=r);
 const provider=async()=>{sends++;await barrier;return {id:'concurrent-provider-id'};};
 await assert.rejects(delivery.sendPreparedSupportReply(id,'0'.repeat(64),provider));assert.equal(sends,0);
 await db`UPDATE support_messages SET from_email='other@example.invalid' WHERE id=42`;
 await assert.rejects(delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,provider),/destinataire/i);assert.equal(sends,0);
 await db`UPDATE support_messages SET from_email='client@example.invalid' WHERE id=42`;
 const first=delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,provider);
 while(!sends) await new Promise(r=>setTimeout(r,5));
 await assert.rejects(delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,provider));release();await first;assert.equal(sends,1);
 [id,draft]=await make();let attempts=0;
 await assert.rejects(delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>{attempts++;throw new Error('timeout');}));
 await assert.rejects(delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>{attempts++;return {id:'must-not-send'};}));
 assert.equal(attempts,1);const [state]=await db`SELECT status FROM support_prepared_replies WHERE id=${id}::uuid`;assert.equal(state.status,'sending');
 const [retryId,retryDraft]=await make();
 await assert.rejects(delivery.sendPreparedSupportReply(retryId,retryDraft.approvalFingerprint,async()=>{attempts++;return {id:'unsafe-retry'};}),/bloque|vérif/i);
 assert.equal(attempts,1);
 await db`UPDATE support_prepared_replies SET status='uncertain' WHERE id=${id}::uuid`;
 await discardFixtures([id]);
});
test('known limitation: an uncertain send also blocks a different client',async()=>{
 await db`INSERT INTO support_messages(id,from_email) VALUES(43,'other-client@example.invalid')`;
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const make=async(targetId,toEmail)=>{const id=await drafts.prepareSupportReply({targetType:'message',targetId,toEmail,subject:'Question',body:'Réponse',attachments:[]});const draft=await drafts.readPreparedSupportReply(id);await delivery.approvePreparedSupportReply(id,draft.approvalFingerprint);return [id,draft];};
 const [first,a]=await make('42','client@example.invalid'),[second,b]=await make('43','other-client@example.invalid');
 let calls=0;
 try {
  await assert.rejects(delivery.sendPreparedSupportReply(first,a.approvalFingerprint,async()=>{calls++;throw Error('lost response');}));
  await assert.rejects(delivery.sendPreparedSupportReply(second,b.approvalFingerprint,async()=>({id:`independent-${++calls}`})),/bloque/i);
  assert.equal(calls,1);
 } finally {await discardFixtures([first,second]);await db`DELETE FROM support_messages WHERE id=43`;}
});
test('recipient cannot change while the approved message is crossing the provider boundary',{timeout:15000},async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'), delivery=load('lib/supportPreparedDelivery.ts');
 const id=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Bonjour',attachments:[]});
 const draft=await drafts.readPreparedSupportReply(id);let entered,release;const atProvider=new Promise(r=>entered=r),barrier=new Promise(r=>release=r);
 await delivery.approvePreparedSupportReply(id,draft.approvalFingerprint);
 const sending=delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>{entered();await barrier;return {id:'locked-provider'};});
 await atProvider;let changed=false;const write=db`UPDATE support_messages SET from_email='new@example.invalid' WHERE id=42`.then(()=>{changed=true;});
 await new Promise(r=>setTimeout(r,100));const changedBeforeSend=changed;release();await sending;await write;
 assert.equal(changedBeforeSend,false,'recipient update must wait until provider has been called');
 await db`UPDATE support_messages SET from_email='client@example.invalid' WHERE id=42`;
});
test('approved route delivers the exact prepared text and bytes once through the site',async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'), route=load('app/api/support/prepared-send/route.ts');
 const id=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Bonjour',reference:'<source@example.invalid>',attachments:[{name:'portrait.jpg',contentType:'image/jpeg',bytes:Buffer.from('proof')}]});
 const draft=await drafts.readPreparedSupportReply(id),request=()=>new Request('https://local.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,approvalFingerprint:draft.approvalFingerprint})});
 authorized=false;assert.equal((await route.POST(request())).status,401);authorized=true;
 assert.notEqual((await route.POST(request())).status,200);assert.equal(providerCalls.length,0);
 const approve=load('app/api/support/prepared-approve/route.ts');
 const approveRequest=confirmed=>new Request('https://local.invalid',{method:'POST',body:JSON.stringify({id,approvalFingerprint:draft.approvalFingerprint,confirmed})});
 assert.equal((await approve.POST(approveRequest(false))).status,400);
 assert.equal((await approve.POST(approveRequest(true))).status,200);
 const response=await route.POST(request());assert.equal(response.status,200);
 assert.equal(providerCalls.length,1);const {payload,options}=providerCalls[0];assert.equal(payload.text,'Bonjour');assert.deepEqual(payload.to,['client@example.invalid']);assert.equal(payload.subject,'Re: question');assert.equal(payload.attachments[0].filename,'portrait.jpg');assert.equal(Buffer.from(payload.attachments[0].content).toString(),'proof');assert.equal(payload.headers['In-Reply-To'],'<source@example.invalid>');assert.equal(options.idempotencyKey,`support/${id}`);
 assert.notEqual((await route.POST(request())).status,200);assert.equal(providerCalls.length,1);
});
test('history exposes private attachment metadata for the sent reply, not raw bytes',async()=>{
 const {enrichSupportReplies}=load('lib/supportReplyHistory.ts');
 const [reply]=await db`SELECT id FROM support_replies WHERE provider_id='route-provider-id'`;
 const [result]=await enrichSupportReplies(db,[{id:reply.id}]);
 assert.equal(result.attachments.length,1);assert.equal(result.attachments[0].name,'portrait.jpg');assert.match(result.attachments[0].id,/^[0-9a-f-]{36}$/);assert.equal(result.attachments[0].bytes,undefined);
});
test('preview downloads only authenticated, verified prepared bytes and rejects corruption',async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'),route=load('app/api/support/prepared-attachments/[id]/[position]/route.ts');
 const id=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Bonjour',attachments:[{name:'portrait.jpg',contentType:'image/jpeg',bytes:Buffer.from('proof')}]});
 const params={params:Promise.resolve({id,position:'0'})};authorized=false;assert.equal((await route.GET(new Request('https://local.invalid'),params)).status,401);authorized=true;
 const response=await route.GET(new Request('https://local.invalid'),params);assert.equal(response.status,200);assert.equal(Buffer.from(await response.arrayBuffer()).toString(),'proof');assert.match(response.headers.get('content-disposition'),/^attachment/);
 await db`UPDATE support_prepared_attachments SET content=${Buffer.from('evil!')} WHERE draft_id=${id}::uuid`;
 assert.equal((await route.GET(new Request('https://local.invalid'),params)).status,503);
});
test('different drafts of the same order cannot duplicate an earlier approved send',async()=>{
 const orderId='22222222-2222-4222-8222-222222222222';
 await db`CREATE TABLE orders(id uuid PRIMARY KEY,customer_email text,last_outbound_message_id text)`;
 await db`INSERT INTO orders(id,customer_email) VALUES(${orderId}::uuid,'client@example.invalid')`;
 await db`UPDATE support_messages SET order_id=${orderId}::uuid WHERE id=42`;
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const input={targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Un seul message',attachments:[]};
 const first=await drafts.prepareSupportReply(input), second=await drafts.prepareSupportReply({...input,targetType:'order',targetId:orderId});
 for(const id of [first,second])await delivery.approvePreparedSupportReply(id,(await drafts.readPreparedSupportReply(id)).approvalFingerprint);
 let calls=0;const provider=async()=>{calls++;return {id:`duplicate-test-${calls}`};};
 await delivery.sendPreparedSupportReply(first,(await drafts.readPreparedSupportReply(first)).approvalFingerprint,provider);
 await assert.rejects(delivery.sendPreparedSupportReply(second,(await drafts.readPreparedSupportReply(second)).approvalFingerprint,provider),/bloque/);
 assert.equal(calls,1);
 const third=await drafts.prepareSupportReply(input), fourth=await drafts.prepareSupportReply({...input,targetType:'order',targetId:orderId});
 for(const id of [third,fourth])await delivery.approvePreparedSupportReply(id,(await drafts.readPreparedSupportReply(id)).approvalFingerprint);
 let release;const gate=new Promise(resolve=>{release=resolve;});let started;const began=new Promise(resolve=>{started=resolve;});
 const send1=delivery.sendPreparedSupportReply(third,(await drafts.readPreparedSupportReply(third)).approvalFingerprint,async()=>{calls++;started();await gate;return {id:'concurrent-provider'};});
 await began;await assert.rejects(delivery.sendPreparedSupportReply(fourth,(await drafts.readPreparedSupportReply(fourth)).approvalFingerprint,provider));
 release();await send1;assert.equal(calls,2);
});
test('case variants of an order UUID cannot evade conversation deduplication',async()=>{
 const orderId='abcdefab-cdef-4abc-8def-abcdefabcdef';
 await db`INSERT INTO orders(id,customer_email) VALUES(${orderId}::uuid,'client@example.invalid')`;
 await db`UPDATE support_messages SET order_id=${orderId}::uuid WHERE id=42`;
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const base={toEmail:'client@example.invalid',subject:'Re: question',body:'Unique',attachments:[]};
 const first=await drafts.prepareSupportReply({...base,targetType:'message',targetId:'42'}),second=await drafts.prepareSupportReply({...base,targetType:'order',targetId:orderId.toUpperCase()});
 const a=await drafts.readPreparedSupportReply(first),b=await drafts.readPreparedSupportReply(second);
 await delivery.approvePreparedSupportReply(first,a.approvalFingerprint);await delivery.approvePreparedSupportReply(second,b.approvalFingerprint);
 let calls=0;const provider=async()=>({id:`case-${++calls}`});
 await delivery.sendPreparedSupportReply(first,a.approvalFingerprint,provider);
 await assert.rejects(delivery.sendPreparedSupportReply(second,b.approvalFingerprint,provider),/bloque/i);assert.equal(calls,1);
});
test('relinking a message after preparation blocks sending and cannot redirect later history',async()=>{
 const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 await db`INSERT INTO orders(id,customer_email) VALUES(${a}::uuid,'client@example.invalid'),(${b}::uuid,'client@example.invalid')`;
 await db`UPDATE support_messages SET order_id=${a}::uuid WHERE id=42`;
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const input={targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Unique',attachments:[]};
 const id=await drafts.prepareSupportReply(input),draft=await drafts.readPreparedSupportReply(id);await delivery.approvePreparedSupportReply(id,draft.approvalFingerprint);
 await db`UPDATE support_messages SET order_id=${b}::uuid WHERE id=42`;
 let calls=0;await assert.rejects(delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>({id:`relink-${++calls}`})),/conversation|modifi/i);assert.equal(calls,0);
 await db`UPDATE support_messages SET order_id=${a}::uuid WHERE id=42`;
 await db`CREATE FUNCTION fail_relink_reply() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''injected history failure''; END'`;
 await db`CREATE TRIGGER fail_relink_reply BEFORE INSERT ON support_replies FOR EACH ROW EXECUTE FUNCTION fail_relink_reply()`;
 await assert.rejects(delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>({id:`relink-${++calls}`})),/historique/i);
 await db`DROP TRIGGER fail_relink_reply ON support_replies`;
 await db`UPDATE support_messages SET order_id=${b}::uuid WHERE id=42`;
 const later=await drafts.prepareSupportReply(input),laterDraft=await drafts.readPreparedSupportReply(later);
 await delivery.approvePreparedSupportReply(later,laterDraft.approvalFingerprint);
 await assert.rejects(delivery.sendPreparedSupportReply(later,laterDraft.approvalFingerprint,async()=>({id:`unsafe-${++calls}`})),/bloque/i);
 assert.equal(calls,1);
 await delivery.reconcilePreparedSupportReply(id);
 const [row]=await db`SELECT order_id::text AS order_id FROM support_replies WHERE provider_id='relink-1'`;assert.equal(row.order_id,a);
});
test('relinking a sent message to a different order cannot bypass an older order draft',async()=>{
 const a='cccccccc-cccc-4ccc-8ccc-cccccccccccc',b='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 await db`INSERT INTO orders(id,customer_email) VALUES(${a}::uuid,'client@example.invalid'),(${b}::uuid,'client@example.invalid')`;
 await db`UPDATE support_messages SET order_id=${a}::uuid WHERE id=42`;
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const input={toEmail:'client@example.invalid',subject:'Re: question',body:'Unique',attachments:[]};
 const first=await drafts.prepareSupportReply({...input,targetType:'message',targetId:'42'}),second=await drafts.prepareSupportReply({...input,targetType:'order',targetId:b});
 const x=await drafts.readPreparedSupportReply(first),y=await drafts.readPreparedSupportReply(second);
 await delivery.approvePreparedSupportReply(first,x.approvalFingerprint);await delivery.approvePreparedSupportReply(second,y.approvalFingerprint);
 let calls=0;const provider=async()=>({id:`cross-order-${++calls}`});
 await delivery.sendPreparedSupportReply(first,x.approvalFingerprint,provider);
 await db`UPDATE support_messages SET order_id=${b}::uuid WHERE id=42`;
 await assert.rejects(delivery.sendPreparedSupportReply(second,y.approvalFingerprint,provider),/bloque/i);assert.equal(calls,1);
});
test('an intermediate relink remains protected when recipient and current order differ',async()=>{
 const a='10101010-1010-4010-8010-101010101010',b='20202020-2020-4020-8020-202020202020',c='30303030-3030-4030-8030-303030303030';
 await db`INSERT INTO orders(id,customer_email) VALUES(${a}::uuid,'client@example.invalid'),(${b}::uuid,'other-client@example.invalid'),(${c}::uuid,'third-client@example.invalid')`;
 await db`UPDATE support_messages SET order_id=${a}::uuid WHERE id=42`;
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const first=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Question',body:'Unique',attachments:[]});
 const second=await drafts.prepareSupportReply({targetType:'order',targetId:b,toEmail:'other-client@example.invalid',subject:'Question',body:'Unique',attachments:[]});
 const x=await drafts.readPreparedSupportReply(first),y=await drafts.readPreparedSupportReply(second);
 await delivery.approvePreparedSupportReply(first,x.approvalFingerprint);await delivery.approvePreparedSupportReply(second,y.approvalFingerprint);
 let calls=0;
 try {
  await assert.rejects(delivery.sendPreparedSupportReply(first,x.approvalFingerprint,async()=>{calls++;throw Error('lost response');}));
  await db`UPDATE support_messages SET order_id=${b}::uuid WHERE id=42`;
  await db`UPDATE support_messages SET order_id=${c}::uuid WHERE id=42`;
  const [snapshot]=await db`SELECT p.frozen_order_id::text AS frozen_order_id,p.to_email,m.order_id::text AS current_order_id FROM support_prepared_replies p JOIN support_messages m ON m.id=42 WHERE p.id=${first}::uuid`;
  assert.deepEqual([snapshot.frozen_order_id,snapshot.current_order_id,snapshot.to_email],[a,c,'client@example.invalid']);
  assert.equal(y.frozenOrderId,b);assert.equal(y.toEmail,'other-client@example.invalid');
  await assert.rejects(delivery.sendPreparedSupportReply(second,y.approvalFingerprint,async()=>({id:`unsafe-${++calls}`})),/bloque/i);
  assert.equal(calls,1);
 } finally {await discardFixtures([first,second]);}
});
test('global guard protects indirectly linked orders when past links are unavailable',async()=>{
 const a='91919191-9191-4191-8191-919191919191',b='92929292-9292-4292-8292-929292929292',c='93939393-9393-4393-8393-939393939393';
 await db`INSERT INTO orders(id,customer_email) VALUES(${a}::uuid,'a@indirect.invalid'),(${b}::uuid,'b@indirect.invalid'),(${c}::uuid,'c@indirect.invalid')`;
 await db`INSERT INTO support_messages(id,from_email,order_id) VALUES(91,'x@indirect.invalid',${a}::uuid),(92,'y@indirect.invalid',${b}::uuid)`;
 await db`UPDATE support_messages SET order_id=${b}::uuid WHERE id=91`;
 await db`UPDATE support_messages SET order_id=NULL WHERE id=91`;
 await db`UPDATE support_messages SET order_id=${c}::uuid WHERE id=92`;
 await db`UPDATE support_messages SET order_id=NULL WHERE id=92`;
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const make=async(order,email)=>{const id=await drafts.prepareSupportReply({targetType:'order',targetId:order,toEmail:email,subject:'Question',body:'Réponse',attachments:[]});const d=await drafts.readPreparedSupportReply(id);await delivery.approvePreparedSupportReply(id,d.approvalFingerprint);return [id,d]};
 const [first,x]=await make(a,'a@indirect.invalid'),[second,y]=await make(c,'c@indirect.invalid');let calls=0;
 try {
  await assert.rejects(delivery.sendPreparedSupportReply(first,x.approvalFingerprint,async()=>{calls++;throw Error('lost');}));
  await assert.rejects(delivery.sendPreparedSupportReply(second,y.approvalFingerprint,async()=>({id:`unsafe-${++calls}`})),/bloque/i);
  assert.equal(calls,1);
 } finally {await discardFixtures([first,second]);}
});
test('late history repair does not overwrite a more recent outbound marker',async()=>{
 const order='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 await db`INSERT INTO orders(id,customer_email,last_outbound_message_id) VALUES(${order}::uuid,'client@example.invalid','older')`;
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const id=await drafts.prepareSupportReply({targetType:'order',targetId:order,toEmail:'client@example.invalid',subject:'Re: question',body:'Unique',attachments:[]});
 const draft=await drafts.readPreparedSupportReply(id);await delivery.approvePreparedSupportReply(id,draft.approvalFingerprint);
 await db`CREATE FUNCTION fail_late_reply() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''injected history failure''; END'`;
 await db`CREATE TRIGGER fail_late_reply BEFORE INSERT ON support_replies FOR EACH ROW EXECUTE FUNCTION fail_late_reply()`;
 await assert.rejects(delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>({id:'old-accepted'})),/historique/i);
 await db`DROP TRIGGER fail_late_reply ON support_replies`;
 await db`UPDATE orders SET last_outbound_message_id='newer' WHERE id=${order}::uuid`;
 await delivery.reconcilePreparedSupportReply(id);
 const [row]=await db`SELECT last_outbound_message_id FROM orders WHERE id=${order}::uuid`;assert.equal(row.last_outbound_message_id,'newer');
});
test('a shared connection waiting on the message lock does not deadlock accepted delivery',async()=>{
 await db`UPDATE support_messages SET order_id=NULL WHERE id=42`;
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const id=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Unique',attachments:[]});
 const draft=await drafts.readPreparedSupportReply(id);await delivery.approvePreparedSupportReply(id,draft.approvalFingerprint);
 let blocked;const send=delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>{
   blocked=db`UPDATE support_messages SET read_at=now() WHERE id=42`.execute();
   await new Promise(r=>setTimeout(r,100));return {id:'pool-deadlock-test'};
 });
 const deadline=new Promise((_,reject)=>setTimeout(()=>reject(Error('delivery deadlocked')),3000));
 await Promise.race([send,deadline]);await blocked;
});
test('a stalled provider releases locks and leaves the send uncertain', { timeout: 12000 }, async()=>{
 await db`UPDATE support_messages SET order_id=NULL WHERE id=42`;
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const id=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Unique',attachments:[]});
 const draft=await drafts.readPreparedSupportReply(id);await delivery.approvePreparedSupportReply(id,draft.approvalFingerprint);
 let calls=0;let release;const delayed=new Promise(resolve=>{release=resolve});
 await assert.rejects(delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>{calls++;return delayed;}),/incertain/i);
 assert.equal((await drafts.readPreparedSupportReply(id)).status,'sending');assert.equal(calls,1);
 await db`UPDATE support_messages SET read_at=now() WHERE id=42`;
 release({id:'late-provider-id'});
 for(let i=0;i<40&&(await drafts.readPreparedSupportReply(id)).status!=='sent';i++)await new Promise(r=>setTimeout(r,50));
 const late=await drafts.readPreparedSupportReply(id);assert.equal(late.status,'sent');
 const [stored]=await db`SELECT provider_id FROM support_prepared_replies WHERE id=${id}::uuid`;assert.equal(stored.provider_id,'late-provider-id');
 await delivery.reconcilePreparedSupportReply(id);
});
test('uncertain send is repaired only with matching provider evidence, never resent',async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts'),recovery=load('lib/supportProviderRecovery.ts');
 const id=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Bonjour',reference:'<source@example.invalid>',attachments:[{name:'proof.jpg',contentType:'image/jpeg',bytes:Buffer.from('proof')}]});
 const draft=await drafts.readPreparedSupportReply(id);await delivery.approvePreparedSupportReply(id,draft.approvalFingerprint);
 let attempts=0;await assert.rejects(delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>{attempts++;throw Error('connection lost after accept');}));
 const providerId='33333333-3333-4333-8333-333333333333';process.env.RESEND_API_KEY='synthetic-test-key';
 const sent={id:providerId,created_at:'2026-01-02T03:04:05.000Z',from:draft.transport.from,to:[draft.toEmail],reply_to:[draft.transport.replyTo],subject:draft.subject,html:draft.transport.html,text:draft.body,tags:[{name:'support_draft',value:id}],cc:[],bcc:[]};
 let good=true,hasMore=false;const fake=async url=>url.includes('/attachments?')?Response.json({...(hasMore===undefined?{}:{has_more:hasMore}),data:[{filename:'proof.jpg',content_type:'image/jpeg',size:5,download_url:'https://outbound-cdn.resend.com/proof'}]}):url.startsWith('https://outbound-cdn.resend.com/')?new Response(good?'proof':'wrong'):Response.json(sent);
 const rejectUnchanged=async()=>{await assert.rejects(recovery.recoverUncertainSupportReply(id,draft.approvalFingerprint,providerId,fake));assert.equal((await drafts.readPreparedSupportReply(id)).status,'sending');assert.equal(attempts,1);const rows=await db`SELECT id FROM support_replies WHERE provider_id=${providerId}`;assert.equal(rows.length,0);};
 await rejectUnchanged(); // Provider did not supply headers, not proof of their absence.
 sent.headers={'In-Reply-To':'<wrong@example.invalid>',References:'<source@example.invalid>'};await rejectUnchanged();
 sent.headers={'In-Reply-To':'<source@example.invalid>',References:'<wrong@example.invalid>'};await rejectUnchanged();
 sent.headers={'In-Reply-To':'<source@example.invalid>',References:'<source@example.invalid>'};
 hasMore=undefined;good=true;await rejectUnchanged();
 hasMore=null;await rejectUnchanged();hasMore=true;await rejectUnchanged();
 hasMore=false;good=false;await rejectUnchanged();good=true;
 const laterId=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Bonjour',attachments:[]});
 const later=await drafts.readPreparedSupportReply(laterId);await delivery.approvePreparedSupportReply(laterId,later.approvalFingerprint);
 await recovery.recoverUncertainSupportReply(id,draft.approvalFingerprint,providerId,fake);
 let duplicateCalls=0;await assert.rejects(delivery.sendPreparedSupportReply(laterId,later.approvalFingerprint,async()=>{duplicateCalls++;return{id:'duplicate'};}));assert.equal(duplicateCalls,0);
 const [reply]=await db`SELECT sent_at FROM support_replies WHERE provider_id=${providerId}`;assert.equal(reply.sent_at.toISOString(),sent.created_at);
 assert.equal((await drafts.readPreparedSupportReply(id)).status,'sent');assert.equal(attempts,1);delete process.env.RESEND_API_KEY;
});
test('provider omission cannot prove approved headers were absent',async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'),delivery=load('lib/supportPreparedDelivery.ts'),recovery=load('lib/supportProviderRecovery.ts');
 const id=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Question',body:'Bonjour',attachments:[]});
 const draft=await drafts.readPreparedSupportReply(id);await delivery.approvePreparedSupportReply(id,draft.approvalFingerprint);
 let attempts=0;await assert.rejects(delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>{attempts++;throw Error('lost');}));
 const providerId='44444444-4444-4444-8444-444444444444';process.env.RESEND_API_KEY='synthetic-test-key';
 const sent={id:providerId,created_at:'2026-01-02T03:04:05.000Z',from:draft.transport.from,to:[draft.toEmail],reply_to:[draft.transport.replyTo],subject:draft.subject,html:draft.transport.html,text:draft.body,tags:[{name:'support_draft',value:id}],cc:[],bcc:[],headers:{}};
 try {await assert.rejects(recovery.recoverUncertainSupportReply(id,draft.approvalFingerprint,providerId,async url=>url.includes('/attachments?')?Response.json({has_more:false,data:[]}):Response.json(sent)),/en-têtes/);
  assert.equal((await drafts.readPreparedSupportReply(id)).status,'sending');assert.equal(attempts,1);
 } finally {delete process.env.RESEND_API_KEY;await discardFixtures([id]);}
});
test('a draft created after waiting for the global lock records its actual creation time',async()=>{
 const drafts=load('lib/supportPreparedReplies.ts');let unlock,locked;
 const acquired=new Promise(r=>locked=r),gate=new Promise(r=>unlock=r);
 const holder=db.begin(async tx=>{await tx`SELECT pg_advisory_xact_lock(hashtextextended('support-send:global',0))`;locked();await gate;});
 await acquired;
 const creating=drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Bonjour',attachments:[]});
 await new Promise(r=>setTimeout(r,100));const beforeRelease=new Date();unlock();await holder;
 const id=await creating;const [row]=await db`SELECT created_at FROM support_prepared_replies WHERE id=${id}::uuid`;
 assert.ok(row.created_at >= beforeRelease);
});
test('retention deletes only old never-approved drafts and keeps ambiguous sends and sent history',async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'),retention=load('lib/supportPreparedRetention.ts');
 const input={targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Question',body:'Bonjour',attachments:[{name:'proof.jpg',contentType:'image/jpeg',bytes:Buffer.from('synthetic')}]};
 const ids=[];for(let i=0;i<6;i++)ids.push(await drafts.prepareSupportReply(input));
 await db`UPDATE support_prepared_replies SET created_at=clock_timestamp()-interval '91 days' WHERE id IN ${db(ids.slice(0,5))}`;
 await db`UPDATE support_prepared_replies SET created_at=clock_timestamp()-interval '89 days' WHERE id=${ids[5]}::uuid`;
 await db`UPDATE support_prepared_replies SET approved_at=clock_timestamp() WHERE id=${ids[1]}::uuid`;
 await db`UPDATE support_prepared_replies SET status='sending' WHERE id=${ids[2]}::uuid`;
 await db`UPDATE support_prepared_replies SET status='uncertain' WHERE id=${ids[3]}::uuid`;
 await db`UPDATE support_prepared_replies SET status='sent',provider_id='synthetic' WHERE id=${ids[4]}::uuid`;
 for(const id of ids.slice(1,5)) await assert.rejects(db`DELETE FROM support_prepared_replies WHERE id=${id}::uuid`,/evidence/i);
 await assert.rejects(db`UPDATE support_prepared_replies SET status='prepared' WHERE id=${ids[2]}::uuid`,/transition/i);
 await assert.rejects(db`UPDATE support_prepared_attachments SET filename='changed' WHERE draft_id=${ids[3]}::uuid`,/immutable/i);
 const count=await retention.purgeExpiredUnapprovedSupportDrafts();assert.equal(count,1);
 for(const id of ids.slice(1)){const draft=await drafts.readPreparedSupportReply(id);assert.equal(draft.attachments[0].bytes.toString(),'synthetic');}
 assert.equal(await drafts.readPreparedSupportReply(ids[0]),null);
 assert.equal((await db`SELECT id FROM support_prepared_attachments WHERE draft_id=${ids[0]}::uuid`).length,0);
 assert.equal(await retention.purgeExpiredUnapprovedSupportDrafts(),0);
});
test('retention waits for the global lock and rechecks concurrent approval',async()=>{
 const drafts=load('lib/supportPreparedReplies.ts'),retention=load('lib/supportPreparedRetention.ts'),delivery=load('lib/supportPreparedDelivery.ts');
 const id=await drafts.prepareSupportReply({targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Question',body:'Bonjour',attachments:[{name:'proof.jpg',contentType:'image/jpeg',bytes:Buffer.from('synthetic')}]});
 const draft=await drafts.readPreparedSupportReply(id);await db`UPDATE support_prepared_replies SET created_at=clock_timestamp()-interval '91 days' WHERE id=${id}::uuid`;
 const lock=postgres(dbUrl,{max:1,onnotice(){}});let release,signal;const held=new Promise(r=>signal=r),gate=new Promise(r=>release=r);
 const holder=lock.begin(async tx=>{await tx`SELECT pg_advisory_xact_lock(hashtextextended('support-send:global',0))`;signal();await gate;});
 await held;let finished=false;const cleanup=retention.purgeExpiredUnapprovedSupportDrafts().finally(()=>{finished=true});
 try {
  await new Promise(r=>setTimeout(r,100));assert.equal(finished,false);
  await delivery.approvePreparedSupportReply(id,draft.approvalFingerprint);
 } finally {release();await holder;await lock.end({timeout:2});}
 await cleanup;assert.equal((await drafts.readPreparedSupportReply(id)).attachments[0].bytes.toString(),'synthetic');
});
test('real admin session and same-origin guard protect preparation and sending',async()=>{
 const old=process.env.ADMIN_PASSWORD;process.env.ADMIN_PASSWORD='synthetic-password';realAuth=true;
 try {
  const token='a'.repeat(64),hash=createHash('sha256').update(token).digest('hex'),credential=createHmac('sha256','synthetic-password').update(token).digest('hex');
  await db`INSERT INTO admin_sessions(token_hash,credential_hash,expires_at) VALUES(${hash},${credential},now()+interval '10 minutes')`;
  const route=load('app/api/support/prepare/route.ts');
  const request=(origin,cookie)=>{const form=new FormData();form.set('messageId','42');form.set('body','Bonjour');return new Request('https://local.invalid',{method:'POST',headers:{origin,...(cookie?{cookie:`cartoonova-admin=${cookie}`}:{})},body:form});};
  assert.equal((await route.POST(request('https://evil.invalid',token))).status,403);
  assert.equal((await route.POST(request('https://local.invalid','b'.repeat(64)))).status,401);
  const prepared=await route.POST(request('https://local.invalid',token));assert.equal(prepared.status,200);
  const draft=(await prepared.json()).draft,send=load('app/api/support/prepared-send/route.ts');
  const sendRequest=(origin,cookie)=>new Request('https://local.invalid',{method:'POST',headers:{origin,...(cookie?{cookie:`cartoonova-admin=${cookie}`}:{})},body:JSON.stringify({id:draft.id,approvalFingerprint:draft.approvalFingerprint})});
  const sentBefore=providerCalls.length;assert.equal((await send.POST(sendRequest('https://evil.invalid',token))).status,403);
  assert.equal((await send.POST(sendRequest('https://local.invalid','b'.repeat(64)))).status,401);assert.equal(providerCalls.length,sentBefore);
 } finally {realAuth=false;if(old===undefined)delete process.env.ADMIN_PASSWORD;else process.env.ADMIN_PASSWORD=old;}
});
