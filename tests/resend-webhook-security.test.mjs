import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import ts from 'typescript';
import postgres from 'postgres';
const root = path.resolve(import.meta.dirname, '..');
const runtime = mkdtempSync(path.join(tmpdir(), 'resend-webhook-'));
const pgBin = '/usr/lib/postgresql/18/bin';
const env = Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k => process.env[k]).map(k => [k,process.env[k]]));
const pg = (cmd,args) => execFileSync(path.join(pgBin,cmd),args,{env,timeout:15000,stdio:'pipe'});
let db, started=false, calls=[], failMeasurement=false, failDatabase=false, loseDatabaseAfterMeasurement=false, measurementGate=null;
const secret = 'whsec_' + Buffer.from('synthetic-local-webhook-key').toString('base64');
process.env.CRON_SECRET = 'synthetic-local-cron';
process.env.RESEND_WEBHOOK_SECRET = secret;
// Fail closed for any accidental provider HTTP access; DB uses only the isolated local cluster.
globalThis.fetch = async () => assert.fail('No external HTTP transport allowed');
function load(file, cache=new Map()) {
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;
 const m=new Module(file);m.filename=file;cache.set(file,m);const original=createRequire(file);
 const replacements={
  '@/lib/db': {sql:(...args)=>{if(failDatabase)throw new Error('synthetic database unavailable');return db(...args);},findOrderByCustomerEmail:async()=>{calls.push('lookup');return {id:'local-order'};}},
  '@/lib/analyticsServeur':{mesureServeur:async()=>{calls.push('measurement');if(measurementGate)await measurementGate;if(loseDatabaseAfterMeasurement)failDatabase=true;if(failMeasurement)throw new Error('synthetic transport failure');}},
  '@/lib/discord':{alerteDiscord:async()=>{calls.push('discord');},COULEUR_ALERTE:1,COULEUR_ATTENTION:2},
 };
 m.require=name=>{if(name in replacements)return replacements[name];if(name.startsWith('@/'))return load(name.slice(2)+'.ts',cache);return original(name);};
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);return m.exports;
}
const route=()=>load('app/api/resend/webhook/route.ts').POST;
function request({id='msg-local',timestamp=String(Math.floor(Date.now()/1000)),body=JSON.stringify({type:'email.bounced',data:{to:['local@example.invalid'],subject:'Local test'}}),sign=true,version='v1',query=true}={}) {
 const headers={'content-type':'application/json','svix-id':id,'svix-timestamp':timestamp};
 if(sign)headers['svix-signature']=`${version},${createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
 const key=createHash('sha256').update(`${process.env.CRON_SECRET}:resend-webhook`).digest('hex').slice(0,40);
 const {NextRequest}=createRequire(import.meta.url)('next/server');
 return new NextRequest('https://local.invalid/api/resend/webhook'+(query?`?cle=${key}`:''),{method:'POST',headers,body});
}
before(async()=>{
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));assert.notEqual(port,5432);
 pg('initdb',['-D',path.join(runtime,'pg'),'-U','resend_test','--auth=trust','--no-locale','--encoding=UTF8']);
 pg('pg_ctl',['-D',path.join(runtime,'pg'),'-l',path.join(runtime,'pg.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${runtime}`,'-w','start']);started=true;
 db=postgres(`postgresql://resend_test@127.0.0.1:${port}/postgres`,{max:8,onnotice(){}});
 const migration=path.join(root,'migrations/2026-10-resend-webhook.sql');
 if(existsSync(migration)) {
  const connection=await db.reserve();
  try {await connection.unsafe(readFileSync(migration,'utf8'));} finally {connection.release();}
 }
});
after(async()=>{if(db)await db.end({timeout:2});if(started)pg('pg_ctl',['-D',path.join(runtime,'pg'),'-m','fast','-w','stop']);});
test('signed Svix request needs neither query key nor CRON_SECRET',async()=>{
 const old=process.env.CRON_SECRET;delete process.env.CRON_SECRET;calls=[];
 try {assert.equal((await route()(request({id:'no-query',query:false}))).status,200);assert.deepEqual(calls,['measurement','lookup','discord']);}
 finally {process.env.CRON_SECRET=old;}
});
test('non-finite and non-decimal timestamps never authorize effects',async()=>{
 for(const timestamp of ['NaN','Infinity','-Infinity','1e309','not-a-date','0x10']) {
  calls=[];assert.equal((await route()(request({id:`invalid-${timestamp}`,timestamp}))).status,401,timestamp);assert.deepEqual(calls,[]);
 }
});
test('unknown Svix signature version is rejected',async()=>{
 calls=[];assert.equal((await route()(request({id:'wrong-version',version:'v0'}))).status,401);assert.deepEqual(calls,[]);
});
test('replay across fresh route modules never repeats effects and persists completion',async()=>{
 calls=[];
 assert.equal((await route()(request({id:'durable-replay'}))).status,200);
 assert.equal((await route()(request({id:'durable-replay'}))).status,200);
 assert.deepEqual(calls,['measurement','lookup','discord']);
 const rows=await db`SELECT svix_id, status, completed_at IS NOT NULL AS completed FROM resend_webhook_events WHERE svix_id='durable-replay'`;
 assert.deepEqual([...rows],[{svix_id:'durable-replay',status:'completed',completed:true}]);
});
test('transport failure keeps durable failed claim and retry never repeats partial effects',async()=>{
 calls=[];failMeasurement=true;
 try {assert.equal((await route()(request({id:'transport-failure'}))).status,503);}
 finally {failMeasurement=false;}
 assert.deepEqual(calls,['measurement']);
 const [row]=await db`SELECT status, completed_at FROM resend_webhook_events WHERE svix_id='transport-failure'`;
 assert.deepEqual(row,{status:'failed',completed_at:null});
 const retry=await route()(request({id:'transport-failure'}));assert.equal(retry.status,200);assert.equal((await retry.json()).duplicate,true);
 assert.deepEqual(calls,['measurement']);
});
test('database outage rejects before effects and permits retry after recovery',async()=>{
 calls=[];failDatabase=true;
 try {assert.equal((await route()(request({id:'db-failure'}))).status,503);}
 finally {failDatabase=false;}
 assert.deepEqual(calls,[]);
 assert.equal((await route()(request({id:'db-failure'}))).status,200);assert.deepEqual(calls,['measurement','lookup','discord']);
});
test('lost database after effects leaves processing claim and replay does not repeat effects',async()=>{
 calls=[];loseDatabaseAfterMeasurement=true;
 try {assert.equal((await route()(request({id:'lost-completion'}))).status,503);}
 finally {loseDatabaseAfterMeasurement=false;failDatabase=false;}
 assert.deepEqual(calls,['measurement','lookup','discord']);
 const [row]=await db`SELECT status, completed_at FROM resend_webhook_events WHERE svix_id='lost-completion'`;
 assert.deepEqual(row,{status:'processing',completed_at:null});
 assert.equal((await route()(request({id:'lost-completion'}))).status,200);
 assert.deepEqual(calls,['measurement','lookup','discord']);
});
test('missing signing secret rejects even a valid legacy query key without effects',async()=>{
 delete process.env.RESEND_WEBHOOK_SECRET;calls=[];
 try {assert.equal((await route()(request({sign:false}))).status,401);assert.deepEqual(calls,[]);}
 finally {process.env.RESEND_WEBHOOK_SECRET=secret;}
});

test('concurrent instances reject replays while the first claim is still processing',async()=>{
 calls=[];let release;measurementGate=new Promise(r=>{release=r;});
 const first=route()(request({id:'concurrent'}));
 try {
  for(let i=0;i<200 && !calls.length;i++)await new Promise(r=>setTimeout(r,5));
  assert.deepEqual(calls,['measurement']);
  const [processing]=await db`SELECT status, completed_at FROM resend_webhook_events WHERE svix_id='concurrent'`;
  assert.deepEqual(processing,{status:'processing',completed_at:null});
  const responses=await Promise.all(Array.from({length:16},()=>route()(request({id:'concurrent'}))));
  for(const response of responses){assert.equal(response.status,200);assert.equal((await response.json()).duplicate,true);}
  assert.deepEqual(calls,['measurement']);
 } finally {release();measurementGate=null;await first;}
 assert.deepEqual(calls,['measurement','lookup','discord']);
 assert.equal((await db`SELECT status FROM resend_webhook_events WHERE svix_id='concurrent'`)[0].status,'completed');
});

test('migration reapplies without changing exact existing records',async()=>{
 const before=await db`SELECT * FROM resend_webhook_events ORDER BY svix_id`;
 const migration=readFileSync(path.join(root,'migrations/2026-10-resend-webhook.sql'),'utf8');
 const connection=await db.reserve();
 try {await connection.unsafe(migration);await connection.unsafe(migration);} finally {connection.release();}
 assert.deepEqual(await db`SELECT * FROM resend_webhook_events ORDER BY svix_id`,before);
 const columns=await db`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='resend_webhook_events' ORDER BY ordinal_position`;
 assert.deepEqual([...columns],[
  {column_name:'svix_id',data_type:'text',is_nullable:'NO'},
  {column_name:'status',data_type:'text',is_nullable:'NO'},
  {column_name:'claimed_at',data_type:'timestamp with time zone',is_nullable:'NO'},
  {column_name:'completed_at',data_type:'timestamp with time zone',is_nullable:'YES'},
 ]);
 await assert.rejects(db`INSERT INTO resend_webhook_events(svix_id,status) VALUES('bad-status','invalid')`,{code:'23514'});
 await assert.rejects(db`INSERT INTO resend_webhook_events(svix_id,status) VALUES('bad-completed','completed')`,{code:'23514'});
});

test('rolled-back claim is absent and a subsequent route retry acquires it',async()=>{
 await assert.rejects(db.begin(async tx=>{
  await tx`INSERT INTO resend_webhook_events(svix_id) VALUES('rolled-back')`;
  throw new Error('synthetic rollback');
 }),/synthetic rollback/);
 assert.equal((await db`SELECT * FROM resend_webhook_events WHERE svix_id='rolled-back'`).length,0);
 calls=[];assert.equal((await route()(request({id:'rolled-back'}))).status,200);
 assert.deepEqual(calls,['measurement','lookup','discord']);
});

test('unsigned, missing headers, altered bodies and invalid signatures have no effects or claims',async()=>{
 const cases=[request({id:'unsigned',sign:false}),request({id:'altered-body'}),request({id:'wrong-signature'})];
 for(const header of ['svix-id','svix-timestamp','svix-signature']) {const req=request({id:`missing-${header}`});req.headers.delete(header);cases.push(req);}
 cases[1].headers.set('svix-id','tampered-id');cases[2].headers.set('svix-signature','v1,invalid');
 const signed=request({id:'body-tamper'});cases.push(new (createRequire(import.meta.url)('next/server').NextRequest)(signed.url,{method:'POST',headers:signed.headers,body:'{}'}));
 const [before]=await db`SELECT count(*)::int AS count FROM resend_webhook_events`;
 for(const req of cases){calls=[];assert.equal((await route()(req)).status,401);assert.deepEqual(calls,[]);}
 assert.deepEqual((await db`SELECT count(*)::int AS count FROM resend_webhook_events`)[0],before);
});

test('timestamp window allows exact five-minute boundaries but rejects older and future requests',async()=>{
 const original=Date.now;const now=Math.floor(original()/1000);Date.now=()=>now*1000;
 try {
  for(const delta of [-301,301]){calls=[];assert.equal((await route()(request({id:`age-${delta}`,timestamp:String(now+delta)}))).status,401);assert.deepEqual(calls,[]);}
  for(const delta of [-300,300])assert.equal((await route()(request({id:`age-${delta}`,timestamp:String(now+delta)}))).status,200);
 } finally {Date.now=original;}
});

test('multiple signatures allow the valid v1 entry and raw JSON bytes are preserved',async()=>{
 const req=request({id:'rotation',body:'{ "type": "email.delivered", "data": { "to": "local@example.invalid" } }'});
 req.headers.set('svix-signature','v1,wrong v0,wrong '+req.headers.get('svix-signature'));
 calls=[];assert.equal((await route()(req)).status,200);assert.deepEqual(calls,['measurement']);
});

test('invalid JSON and ignored events do not consume claims',async()=>{
 calls=[];assert.equal((await route()(request({id:'invalid-json',body:'{'}))).status,400);
 assert.equal((await route()(request({id:'ignored',body:JSON.stringify({type:'email.sent'})}))).status,200);
 assert.deepEqual(calls,[]);
 assert.equal((await db`SELECT * FROM resend_webhook_events WHERE svix_id IN ('invalid-json','ignored')`).length,0);
});

test('a re-signed id with changed content stays deduplicated but a distinct id is processed',async()=>{
 calls=[];
 const changedBody=JSON.stringify({type:'email.complained',data:{to:'other@example.invalid'}});
 const replay=await route()(request({id:'durable-replay',timestamp:String(Math.floor(Date.now()/1000)+1),body:changedBody}));
 assert.equal(replay.status,200);assert.equal((await replay.json()).duplicate,true);assert.deepEqual(calls,[]);
 const fresh=request({id:'distinct-id'});fresh.nextUrl.searchParams.set('cle','invalid-legacy-key');
 assert.equal((await route()(fresh)).status,200);assert.deepEqual(calls,['measurement','lookup','discord']);
});
