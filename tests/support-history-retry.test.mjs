import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import { tmpdir } from 'node:os';
import net from 'node:net';
import postgres from 'postgres';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..'), runtime=mkdtempSync(path.join(tmpdir(),'support-history-retry-'));
const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const pg=(cmd,args)=>execFileSync('/usr/lib/postgresql/18/bin/'+cmd,args,{env,timeout:15000,stdio:'pipe'});
let db,url,started=false,delivery,drafts,sharedSql,loseAck='',ackLosses=0,checkpointTimes=[],replyInsertAttempts=0;
let route, routeProvider, sharedReads=0;
const order='10000000-0000-4000-8000-000000000001';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function load(file,cache=new Map()) {
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;
 const m=new Module(file);m.filename=file;cache.set(file,m);const original=createRequire(file);
 m.require=name=>{
  if(name==='@/lib/adminAuth')return {refuserSiPasAdmin:async()=>null};
  if(name==='@/lib/envoiEmail')return {envoyerEmail:(...args)=>routeProvider(...args)};
  if(name==='@/lib/db')return {sql:(strings,...values)=>{sharedReads++;return (sharedSql??db)(strings,...values);},withFreshDatabaseClient:async run=>{
   let phase='';const client=postgres(url,{max:1,onnotice(){},debug(_connection,query){
    if(query.includes("UPDATE support_prepared_replies SET status='sent'"))phase='checkpoint';
    if(query.includes('INSERT INTO support_replies(')){phase='reconcile';replyInsertAttempts++;}
   }});
   try {
    const value=await run(client);
    if(phase==='checkpoint')checkpointTimes.push((await client`SELECT provider_sent_at::text t FROM support_prepared_replies WHERE provider_id IS NOT NULL ORDER BY provider_sent_at DESC LIMIT 1`)[0]?.t);
    if(phase==='checkpoint'&&loseAck==='lease'){
     const holders=await db`SELECT pid FROM pg_locks WHERE locktype='advisory' AND granted`;
     assert.equal(holders.length,1,'one live provider lease');await db`SELECT pg_terminate_backend(${holders[0].pid})`;
    }
    if(loseAck&&loseAck===phase&&ackLosses++===0)throw Object.assign(Error('simulated lost acknowledgement AFTER real commit'),{code:'08006'});
    return value;
   } finally {await client.end({timeout:1});}
  }};
  if(name.startsWith('@/')||name.startsWith('.')){
   const base=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(file),name);
   if(existsSync(base+'.ts'))return load(base+'.ts',cache);
  }
  return original(name);
 };
 let source=readFileSync(file,'utf8');
 // Read-only baseline comparison: same disposable fixture and new acceptance tests.
 if(process.env.SUPPORT_HISTORY_BASELINE==='1'&&file===path.join(root,'lib/supportPreparedDelivery.ts'))source=execFileSync('git',['show','HEAD:lib/supportPreparedDelivery.ts'],{cwd:root,env,encoding:'utf8'});
 if(process.env.SUPPORT_SEND_ROUTE_BASELINE==='1'&&file===path.join(root,'app/api/support/prepared-send/route.ts'))source=execFileSync('git',['show','HEAD:app/api/support/prepared-send/route.ts'],{cwd:root,env,encoding:'utf8'});
 m._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
 return m.exports;
}
before(async()=>{
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));assert.notEqual(port,5432);
 pg('initdb',['-D',runtime+'/pg','-U','support_history_test','--auth=trust','--no-locale','--encoding=UTF8']);
 pg('pg_ctl',['-D',runtime+'/pg','-l',runtime+'/pg.log','-o',`-h 127.0.0.1 -p ${port} -c unix_socket_directories=''`,'-w','start']);started=true;
 url=`postgresql://support_history_test@127.0.0.1:${port}/postgres`;db=postgres(url,{max:4,onnotice(){}});
 await db`CREATE TABLE orders(id uuid PRIMARY KEY,customer_email text,last_outbound_message_id text)`;
 await db`CREATE TABLE support_messages(id integer PRIMARY KEY,from_email text,order_id uuid REFERENCES orders(id),read_at timestamptz,received_at timestamptz DEFAULT now())`;
 await db`CREATE TABLE support_replies(id serial PRIMARY KEY,support_message_id integer REFERENCES support_messages(id),order_id uuid REFERENCES orders(id),to_email text,subject text,body_text text,assistee_ia boolean,provider_id text,sent_at timestamptz)`;
 for(const migration of ['20261104_support_private_attachments.sql','20261104_support_prepared_replies.sql','20261124_customer_history.sql'])await db.unsafe(readFileSync(path.join(root,'migrations',migration),'utf8'));
 await db`INSERT INTO orders(id,customer_email,last_outbound_message_id) VALUES(${order}::uuid,'synthetic@example.invalid','prior')`;
 await db`INSERT INTO support_messages(id,from_email,order_id) VALUES(1,'synthetic@example.invalid',${order}::uuid)`;
 drafts=load('lib/supportPreparedReplies.ts');delivery=load('lib/supportPreparedDelivery.ts');
 route=load('app/api/support/prepared-send/route.ts');
});
after(async()=>{if(db)await db.end({timeout:2});if(started)pg('pg_ctl',['-D',runtime+'/pg','-m','fast','-w','stop']);rmSync(runtime,{recursive:true,force:true});});
async function prepare(){
 const id=await drafts.prepareSupportReply({targetType:'message',targetId:'1',toEmail:'synthetic@example.invalid',subject:'Frozen subject',body:'Exact approved text',attachments:[{name:'proof.txt',contentType:'text/plain',bytes:Buffer.from('exact bytes')}]});
 const draft=await drafts.readPreparedSupportReply(id);await delivery.approvePreparedSupportReply(id,draft.approvalFingerprint);return {id,draft};
}
async function assertHistory(id,providerId,replyId){
 const [row]=await db`SELECT p.reply_id,p.status,p.provider_id,p.provider_sent_at,r.sent_at,r.body_text,r.to_email FROM support_prepared_replies p JOIN support_replies r ON r.id=p.reply_id WHERE p.id=${id}::uuid`;
 assert.equal(row.status,'sent');assert.equal(row.reply_id,replyId);assert.equal(row.provider_id,providerId);assert.equal(row.body_text,'Exact approved text');assert.equal(row.to_email,'synthetic@example.invalid');assert.equal(row.provider_sent_at.toISOString(),row.sent_at.toISOString());
 const replies=await db`SELECT id FROM support_replies WHERE provider_id=${providerId}`;assert.equal(replies.length,1);
 const files=await db`SELECT filename,content FROM support_private_attachments WHERE reply_id=${replyId}`;assert.equal(files.length,1);assert.equal(files[0].filename,'proof.txt');assert.equal(files[0].content.toString(),'exact bytes');
}
async function fault(code,failures){
 await db`CREATE SEQUENCE history_failure_attempt`;
 await db.unsafe(`CREATE FUNCTION history_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF nextval('history_failure_attempt') <= ${failures} THEN RAISE EXCEPTION 'synthetic history failure' USING ERRCODE='${code}'; END IF; RETURN NEW; END $$`);
 await db`CREATE TRIGGER history_failure BEFORE INSERT ON support_replies FOR EACH ROW EXECUTE FUNCTION history_failure()`;
}
async function clearFault(){await db`DROP TRIGGER history_failure ON support_replies`;await db`DROP FUNCTION history_failure()`;await db`DROP SEQUENCE history_failure_attempt`;}

test('real PostgreSQL aborted history transactions retry twice after provider acceptance, never transport',async()=>{
 const {id,draft}=await prepare();let calls=0;await fault('40001',2);
 try {
  const reply=await delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>({id:`transient-${++calls}`}));
  assert.equal(calls,1);assert.equal((await db`SELECT last_value FROM history_failure_attempt`)[0].last_value,'3');await assertHistory(id,'transient-1',reply);
 } finally {await clearFault();}
});
test('bounded exhaustion leaves confirmed evidence and supports concurrent repair without resend',async()=>{
 const {id,draft}=await prepare();let calls=0;await fault('55P03',99);
 try {
  await assert.rejects(delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>({id:`exhausted-${++calls}`})),/historique.*sans renvoi/i);
  assert.equal((await db`SELECT last_value FROM history_failure_attempt`)[0].last_value,'3');
  const [row]=await db`SELECT status,provider_id,reply_id FROM support_prepared_replies WHERE id=${id}::uuid`;assert.deepEqual({...row},{status:'sent',provider_id:'exhausted-1',reply_id:null});
  await assert.rejects(delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>({id:`unsafe-${++calls}`})));assert.equal(calls,1);
 } finally {await clearFault();}
 const repaired=await Promise.all(Array.from({length:4},()=>delivery.reconcilePreparedSupportReply(id)));assert.ok(repaired.every(r=>r===repaired[0]));await assertHistory(id,'exhausted-1',repaired[0]);
});
test('permanent trigger violation is not blindly retried and repair cannot invoke a provider',async()=>{
 const {id,draft}=await prepare();let calls=0;await fault('23514',99);
 try {await assert.rejects(delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>({id:`permanent-${++calls}`})),/historique/i);assert.equal((await db`SELECT last_value FROM history_failure_attempt`)[0].last_value,'1');}
 finally {await clearFault();}
 const reply=await delivery.reconcilePreparedSupportReply(id);assert.equal(calls,1);await assertHistory(id,'permanent-1',reply);
});
test('lost checkpoint commit acknowledgement is retried with same provider ID and immutable timestamp',async()=>{
 const {id,draft}=await prepare();let calls=0;loseAck='checkpoint';ackLosses=0;checkpointTimes=[];
 try {
  const reply=await delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>({id:`checkpoint-${++calls}`}));
  assert.equal(calls,1);assert.equal(ackLosses,2);assert.equal(checkpointTimes.length,2);assert.equal(checkpointTimes[0],checkpointTimes[1]);await assertHistory(id,'checkpoint-1',reply);
 } finally {loseAck='';}
});
test('real lease connection termination after checkpoint cannot skip history or resend',async()=>{
 const {id,draft}=await prepare();let calls=0;loseAck='lease';
 try {const reply=await delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>({id:`lease-loss-${++calls}`}));assert.equal(calls,1);await assertHistory(id,'lease-loss-1',reply);}
 finally {loseAck='';}
});

test('lost reconcile commit acknowledgement returns existing reply instead of duplicating attachments',async()=>{
 const {id,draft}=await prepare();let calls=0;loseAck='reconcile';ackLosses=0;replyInsertAttempts=0;
 try {
  const reply=await delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>({id:`reconcile-${++calls}`}));assert.equal(calls,1);assert.equal(replyInsertAttempts,1);await assertHistory(id,'reconcile-1',reply);
 } finally {loseAck='';}
});
test('actual table lock exceeds first lock_timeout; second transaction completes after lock release',{timeout:15000},async()=>{
 const {id,draft}=await prepare();let calls=0,release,holding;
 const gate=new Promise(r=>release=r),held=new Promise(r=>holding=r);
 const blocker=postgres(url,{max:1,onnotice(){}});
 let locked;
 const send=delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>{
  calls++;locked=blocker.begin(async tx=>{await tx`LOCK TABLE support_replies IN ACCESS EXCLUSIVE MODE`;holding();await gate;});await held;return {id:'actual-lock'};
 });
 try {
  await held;
  // Observe the real wait before timing the release, rather than relying on startup speed.
  let waiting=false;
  for(let i=0;i<150;i++){const rows=await db`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'INSERT INTO support_replies(%'`;if(rows.length){waiting=true;break;}await pause(20);}
  assert.ok(waiting,'history INSERT is blocked in PostgreSQL');await pause(3100);release();await locked;
  const reply=await send;assert.equal(calls,1);await assertHistory(id,'actual-lock',reply);
 } finally {release();await locked;await blocker.end({timeout:1});await send.catch(()=>{});}
});
test('unrelated shared single-connection pool saturation cannot stall confirmed history',{timeout:5000},async()=>{
 const {id,draft}=await prepare();let release,holding,occupied,calls=0;
 const gate=new Promise(r=>release=r),held=new Promise(r=>holding=r);
 sharedSql=postgres(url,{max:1,onnotice(){}});const pool=sharedSql;
 const sending=delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,async()=>{
  calls++;occupied=pool.begin(async tx=>{await tx`SELECT 1`;holding();await gate;});await held;return {id:'saturated-pool'};
 });
 try {
  await held;
  const reply=await Promise.race([sending,pause(1000).then(()=>null)]);
  assert.notEqual(reply,null,'history must not queue behind the shared pool');assert.equal(calls,1);await assertHistory(id,'saturated-pool',reply);
 } finally {release();await occupied;await sending.catch(()=>{});sharedSql=undefined;await pool.end({timeout:1});}
});

test('double click during history retry never re-enters provider',async()=>{
 const {id,draft}=await prepare();let calls=0;await fault('40P01',1);
 try {
  const provider=async()=>({id:`double-click-${++calls}`});const first=delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,provider);
  let sent=false;for(let i=0;i<150;i++){if((await drafts.readPreparedSupportReply(id)).status==='sent'){sent=true;break;}await pause(5);}assert.ok(sent);
  await assert.rejects(delivery.sendPreparedSupportReply(id,draft.approvalFingerprint,provider));const reply=await first;assert.equal(calls,1);await assertHistory(id,'double-click-1',reply);
 } finally {await clearFault();}
});

// The actual Next POST handler and delivery/retry SQL execute here. Only admin
// authentication, transport and database connection creation are substituted.
const acceptedBody={error:"Email accepté : l'historique doit être réparé sans renvoi.",state:'sent',needsHistoryRepair:true};
const unknownBody={error:'Envoi incertain : vérification obligatoire, ne pas renvoyer.',state:'unknown'};
function request(id,approvalFingerprint){return new Request('http://localhost/api/support/prepared-send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,approvalFingerprint})});}
async function boundedResponse(promise,ms=1800){
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('route deadline: catch must not depend on shared pool')),ms);})]);}
 finally{clearTimeout(timer);}
}
async function assertConflict(response,expected){
 assert.equal(response.status,409);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 assert.deepEqual(await response.json(),expected);
}

for(const mode of ['closed','occupied'])test(`real prepared-send route: exhausted history retries with shared pool ${mode}`,{timeout:6000},async()=>{
 const {id,draft}=await prepare();let calls=0,release,occupied,readsAtAcceptance;
 const pool=postgres(url,{max:1,onnotice(){}});sharedSql=pool;
 await fault('55P03',99);
 routeProvider=async(payload,options)=>{
  calls++;assert.equal(payload.text,'Exact approved text');assert.equal(options.idempotencyKey,`support/${id}`);
  if(mode==='closed')await pool.end({timeout:1});
  else{
   let holding;const held=new Promise(r=>holding=r),gate=new Promise(r=>release=r);
   occupied=pool.begin(async tx=>{await tx`SELECT 1`;holding();await gate;});await held;
  }
  readsAtAcceptance=sharedReads;return {data:{id:`route-${mode}-private-provider-id`}};
 };
 const pending=route.POST(request(id,draft.approvalFingerprint));
 try{
  await assertConflict(await boundedResponse(pending),acceptedBody);
  assert.equal(sharedReads,readsAtAcceptance,'no catch re-read, including a failed read');
  assert.equal(calls,1);assert.equal((await db`SELECT last_value FROM history_failure_attempt`)[0].last_value,'3');
  const [row]=await db`SELECT status,reply_id,provider_id FROM support_prepared_replies WHERE id=${id}::uuid`;
  assert.equal(row.status,'sent');assert.equal(row.reply_id,null);assert.equal(row.provider_id,`route-${mode}-private-provider-id`);
 }finally{
  release?.();await occupied;await pending;sharedSql=undefined;await pool.end({timeout:1});await clearFault();
  // Complete the genuine repair in the disposable fixture before the next case.
  const reply=await delivery.reconcilePreparedSupportReply(id);await assertHistory(id,`route-${mode}-private-provider-id`,reply);
 }
});

test('real prepared-send route: closed pool before evidence is unknown, never refused',{timeout:4000},async()=>{
 const {id,draft}=await prepare();const pool=postgres(url,{max:1,onnotice(){}});await pool.end({timeout:1});sharedSql=pool;
 let calls=0;routeProvider=async()=>{calls++;throw Error('must not send');};const reads=sharedReads;
 try{await assertConflict(await boundedResponse(route.POST(request(id,draft.approvalFingerprint))),unknownBody);assert.equal(calls,0);assert.equal(sharedReads,reads+1,'only the original read, no catch read');}
 finally{sharedSql=undefined;}
});

test('real prepared-send route: valid request succeeds with actual history and exactly one transport',async()=>{
 const {id,draft}=await prepare();let calls=0;routeProvider=async()=>({data:{id:`route-success-${++calls}`}});
 const response=await route.POST(request(id,draft.approvalFingerprint));assert.equal(response.status,200);const body=await response.json();assert.equal(body.ok,true);assert.equal(calls,1);await assertHistory(id,'route-success-1',body.replyId);
});

test('real prepared-send route: syntactically invalid approval is explicitly rejected without SQL or transport',async()=>{
 const reads=sharedReads;let calls=0;routeProvider=async()=>{calls++;};
 const response=await route.POST(request('invalid','bad'));assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:'Approbation invalide.'});assert.equal(sharedReads,reads);assert.equal(calls,0);
});

test('real prepared-send route: ambiguous provider exception plus occupied pool stays unknown and bounded',{timeout:4000},async()=>{
 const {id,draft}=await prepare();let calls=0,release,occupied,readsAtFailure;
 const pool=postgres(url,{max:1,onnotice(){}});sharedSql=pool;
 routeProvider=async()=>{
  calls++;let holding;const held=new Promise(r=>holding=r),gate=new Promise(r=>release=r);
  occupied=pool.begin(async tx=>{await tx`SELECT 1`;holding();await gate;});await held;readsAtFailure=sharedReads;
  throw Object.assign(Error('synthetic@example.invalid secret-provider-id'),{state:'sent',needsHistoryRepair:true});
 };
 const pending=route.POST(request(id,draft.approvalFingerprint));
 try{
  await assertConflict(await boundedResponse(pending),unknownBody);assert.equal(calls,1);assert.equal(sharedReads,readsAtFailure);
  const [row]=await db`SELECT status,provider_id,reply_id FROM support_prepared_replies WHERE id=${id}::uuid`;assert.deepEqual({...row},{status:'sending',provider_id:null,reply_id:null});
  // Second real request must not invoke the provider again.
 }finally{release?.();await occupied;await pending;sharedSql=undefined;await pool.end({timeout:1});}
 await assertConflict(await boundedResponse(route.POST(request(id,draft.approvalFingerprint))),unknownBody);assert.equal(calls,1);
 // Only this disposable fixture is reset; never reset a production send fence.
 await db`TRUNCATE support_prepared_replies CASCADE`;
});

test('real prepared-send route: accepted transport survives three failed checkpoint transactions without leaking evidence',{timeout:5000},async()=>{
 const {id,draft}=await prepare();let calls=0,readsAtAcceptance;
 await db`CREATE SEQUENCE checkpoint_failure_attempt`;
 await db.unsafe(`CREATE FUNCTION checkpoint_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='sent' THEN PERFORM nextval('checkpoint_failure_attempt'); RAISE EXCEPTION 'synthetic@example.invalid private-provider-id' USING ERRCODE='40001'; END IF; RETURN NEW; END $$`);
 await db`CREATE TRIGGER checkpoint_failure BEFORE UPDATE ON support_prepared_replies FOR EACH ROW EXECUTE FUNCTION checkpoint_failure()`;
 const pool=postgres(url,{max:1,onnotice(){}});sharedSql=pool;
 routeProvider=async()=>{calls++;await pool.end({timeout:1});readsAtAcceptance=sharedReads;return {data:{id:'private-provider-id'}};};
 try{
  await assertConflict(await boundedResponse(route.POST(request(id,draft.approvalFingerprint))),acceptedBody);
  assert.equal(calls,1);assert.equal(sharedReads,readsAtAcceptance);assert.equal((await db`SELECT last_value FROM checkpoint_failure_attempt`)[0].last_value,'3');
  const [row]=await db`SELECT status,provider_id,reply_id FROM support_prepared_replies WHERE id=${id}::uuid`;assert.deepEqual({...row},{status:'sending',provider_id:null,reply_id:null});
 }finally{
  sharedSql=undefined;await pool.end({timeout:1});await db`DROP TRIGGER checkpoint_failure ON support_prepared_replies`;await db`DROP FUNCTION checkpoint_failure()`;await db`DROP SEQUENCE checkpoint_failure_attempt`;
 }
});
