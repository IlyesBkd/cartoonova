import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { execFileSync } from 'node:child_process';
import postgres from 'postgres';
import { load, blobMock } from './upload-harness.mjs';
import { handleUpload, getPayloadFromClientToken, put } from '@vercel/blob/client';
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
const runtime = mkdtempSync(path.join(tmpdir(), 'upload-quota-'));
const bin = '/usr/lib/postgresql/18/bin';
const env = Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const pg = (cmd,args) => execFileSync(path.join(bin,cmd),args,{env,timeout:15000,stdio:'pipe'});
let db, started, policy;
const previousSecret=process.env.NEWSLETTER_SECRET, previousAdmin=process.env.ADMIN_PASSWORD;
process.env.NEWSLETTER_SECRET='synthetic-upload-test-secret';
process.env.ADMIN_PASSWORD='synthetic-admin-test-secret';
before(async()=>{
 const server=net.createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r)); const port=server.address().port; await new Promise(r=>server.close(r));
 pg('initdb',['-D',path.join(runtime,'pg'),'-U','upload_test','--auth=trust','--no-locale']);
 pg('pg_ctl',['-D',path.join(runtime,'pg'),'-l',path.join(runtime,'pg.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${runtime}`,'-w','start']); started=true;
 db=postgres(`postgresql://upload_test@127.0.0.1:${port}/postgres`,{max:10,onnotice(){}});
 // Migration is applied only to this freshly started random-port instance.
 await db.unsafe(readFileSync(new URL('../migrations/20261025_upload_quotas.sql',import.meta.url),'utf8'));
 policy=load('lib/uploadPolicy.ts',{'@/lib/db':{withFreshDatabaseClient:fn=>fn(db)}});
});
after(async()=>{if(previousSecret===undefined)delete process.env.NEWSLETTER_SECRET;else process.env.NEWSLETTER_SECRET=previousSecret;if(previousAdmin===undefined)delete process.env.ADMIN_PASSWORD;else process.env.ADMIN_PASSWORD=previousAdmin;if(db)await db.end({timeout:2});if(started)pg('pg_ctl',['-D',path.join(runtime,'pg'),'-m','fast','-w','stop']);});
async function reset() { await db`TRUNCATE upload_reservations, upload_contexts, upload_quota_buckets`; }
const sessionCookie='__Host-cartoonova-photo='+'a'.repeat(64);
const req=()=>new Request('http://localhost/api/upload',{headers:{origin:'http://localhost',cookie:sessionCookie}});
test('context HTTP endpoint issues a checkout scope and denies foreign origins',async()=>{
 const {POST}=load('app/api/upload/context/route.ts',{'@/lib/uploadPolicy':policy});
 const request=(origin)=>new Request('http://localhost/api/upload/context',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({purpose:'checkout',product:'simpson'})});
 assert.equal((await POST(request('http://evil.invalid'))).status,403);
 const response=await POST(request('http://localhost'));
 assert.equal(response.status,200); assert.equal((await response.json()).context.length,64);
});
test('opaque checkout context reserves cumulative quota atomically before token generation',async()=>{
 const c=await policy.createUploadContext(req(),{purpose:'checkout',product:'simpson'});
 assert.match(c.prefix,/^orders\/[a-f0-9-]+\/$/);
 const settled=await Promise.allSettled(Array.from({length:24},(_,i)=>policy.reserveUpload(req(),`${c.prefix}photo${i}.jpg`,c.context)));
 assert.equal(settled.filter(x=>x.status==='fulfilled').length,16);
 const [row]=await db`SELECT count(*)::int AS n FROM upload_reservations`;
 assert.equal(row.n,16);
 const good=settled.find(x=>x.status==='fulfilled').value;
 assert.equal(good.maximumSizeInBytes,10485760); assert.equal(good.addRandomSuffix,false); assert.equal(good.allowOverwrite,false);
 assert.ok(good.validUntil <= Date.now()+120000);
});

test('SDK token pins the reserved pathname and replay cannot create a second object (simulated provider contract)',async()=>{
 await reset();
 const c=await policy.createUploadContext(req(),{purpose:'checkout',product:'simpson'});
 const pathname=`${c.prefix}synthetic.jpg`;
 const {clientToken}=await handleUpload({token:'vercel_blob_rw_synthetic_localonly',request:req(),
  body:{type:'blob.generate-client-token',payload:{pathname,clientPayload:c.context}},
  onBeforeGenerateToken:(name,context)=>policy.reserveUpload(req(),name,context)});
 const payload=getPayloadFromClientToken(clientToken);
 assert.equal(payload.pathname,pathname);
 assert.equal(payload.addRandomSuffix,false);
 assert.equal(payload.allowOverwrite,false);
 const previousRetries=process.env.VERCEL_BLOB_RETRIES;process.env.VERCEL_BLOB_RETRIES='0';
 const previous=getGlobalDispatcher(), agent=new MockAgent();agent.disableNetConnect();setGlobalDispatcher(agent);
 const objects=new Set();let requests=0;
 // This models the documented provider contract, NOT a real Blob acceptance test.
 agent.get('https://vercel.com').intercept({path:/^\/api\/blob\/\?/,method:'PUT'}).reply(options=>{
  requests++;
  const headers=new Headers(options.headers);
  assert.equal(headers.get('authorization'),`Bearer ${clientToken}`);
  const target=new URL(options.path,'https://vercel.com').searchParams.get('pathname');
  if(target!==payload.pathname)return {statusCode:400,data:{error:{code:'client_token_pathname_mismatch'}}};
  if(objects.has(target))return {statusCode:400,data:{error:{code:'bad_request',message:'Blob already exists'}}};
  objects.add(target);
  return {statusCode:200,data:{url:`https://synthetic.public.blob.vercel-storage.com/${target}`,downloadUrl:`https://synthetic.public.blob.vercel-storage.com/${target}`,pathname:target,contentType:'image/jpeg',contentDisposition:'inline'}};
 }).persist();
 try {
  await put(pathname,'synthetic',{access:'public',token:clientToken,contentType:'image/jpeg',abortSignal:AbortSignal.timeout(3000)});
  await assert.rejects(put(pathname,'replay',{access:'public',token:clientToken,contentType:'image/jpeg',abortSignal:AbortSignal.timeout(3000)}),/already exists/);
  await assert.rejects(put(`${c.prefix}other.jpg`,'replay',{access:'public',token:clientToken,contentType:'image/jpeg',abortSignal:AbortSignal.timeout(3000)}),/Pathname mismatch/);
  assert.equal(objects.size,1);assert.equal(requests,3);
  assert.equal((await db`SELECT count(*)::int n FROM upload_reservations`)[0].n,1);
 }finally{setGlobalDispatcher(previous);await agent.close();if(previousRetries===undefined)delete process.env.VERCEL_BLOB_RETRIES;else process.env.VERCEL_BLOB_RETRIES=previousRetries;}
});

test('same pathname cannot mint a second token or debit quota twice, even concurrently',async()=>{
 await reset();
 const c=await policy.createUploadContext(req(),{purpose:'checkout',product:'simpson'});
 const pathname=`${c.prefix}synthetic.jpg`;
 const results=await Promise.allSettled(Array.from({length:8},()=>policy.reserveUpload(req(),pathname,c.context)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.status===409));
 assert.equal((await db`SELECT count(*)::int n FROM upload_reservations`)[0].n,1);
 assert.equal(Number((await db`SELECT used FROM upload_quota_buckets WHERE key LIKE 'bytes:global:%'`)[0].used),10485760);
 await assert.rejects(db`INSERT INTO upload_reservations(id,context_id,pathname,reserved_bytes)
  VALUES ('12345678-1234-1234-1234-123456789abc',${(await db`SELECT id FROM upload_contexts`)[0].id},${pathname},10485760)`,e=>e.code==='23505');
});

test('localized checkout product slugs remain eligible',async()=>{
 await reset();
 const c=await policy.createUploadContext(req(),{purpose:'checkout',product:'custom-naruto-portrait'});
 assert.match(c.prefix,/^orders\//);
});
test('foreign prefixes, traversal, expiry and forged contexts never reserve bytes', async()=>{
 await reset();
 const c=await policy.createUploadContext(req(),{purpose:'checkout',product:'simpson'});
 for(const name of ['final/stolen.jpg',`${c.prefix}../escape.jpg`,`${c.prefix}nested/a.jpg`,`${c.prefix}x.svg`,`${c.prefix}a%2f.jpg`]) {
  await assert.rejects(policy.reserveUpload(req(),name,c.context),e=>e.status===403);
 }
 await assert.rejects(policy.reserveUpload(req(),`${c.prefix}a.jpg`,'f'.repeat(64)),e=>e.status===403);
 await db`UPDATE upload_contexts SET expires_at=now()-interval '1 second'`;
 await assert.rejects(policy.reserveUpload(req(),`${c.prefix}a.jpg`,c.context),e=>e.status===403);
 assert.equal((await db`SELECT count(*)::int n FROM upload_reservations`)[0].n,0);
});

test('new contexts cannot bypass shared IP, subject, or global reservations and failures roll back',async()=>{
 for(const [scope,limit] of [['global',1000],['ip',64],['subject',32]]) {
  await reset();
  const contexts=await Promise.all(Array.from({length:8},()=>policy.createUploadContext(req(),{purpose:'checkout',product:'simpson'})));
  // Establish bucket keys through the real reservation path, then approach its boundary.
  await policy.reserveUpload(req(),`${contexts[0].prefix}seed.jpg`,contexts[0].context);
  await db`UPDATE upload_quota_buckets SET used=${(limit-1)*10485760} WHERE key LIKE ${`bytes:${scope}:%`}`;
  const secondInstance=load('lib/uploadPolicy.ts',{'@/lib/db':{withFreshDatabaseClient:fn=>fn(db)}});
  const outcomes=await Promise.allSettled(contexts.map((c,i)=>(i%2?policy:secondInstance).reserveUpload(req(),`${c.prefix}p${i}.jpg`,c.context)));
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1,scope);
  assert.ok(outcomes.filter(r=>r.status==='rejected').every(r=>r.reason.status===429));
  assert.equal((await db`SELECT count(*)::int n FROM upload_reservations`)[0].n,2);
  const [global]=await db`SELECT used FROM upload_quota_buckets WHERE key LIKE 'bytes:global:%'`;
  assert.equal(Number(global.used),10485760*(scope==='global'?1000:2),'no partial debits on rejected reservations');
 }
});

test('rotating checkout photo sessions cannot rotate the independent IP quota',async()=>{
 await reset();
 const sessions=Array.from({length:8},(_,i)=>new Request('http://localhost/api/upload',{headers:{origin:'http://localhost',cookie:'__Host-cartoonova-photo='+String(i+1).repeat(64)}}));
 const contexts=await Promise.all(sessions.map(r=>policy.createUploadContext(r,{purpose:'checkout',product:'simpson'})));
 await policy.reserveUpload(sessions[0],contexts[0].prefix+'seed.jpg',contexts[0].context);
 await db`UPDATE upload_quota_buckets SET used=63*10485760 WHERE key LIKE 'bytes:ip:%'`;
 const outcomes=await Promise.allSettled(contexts.map((c,i)=>policy.reserveUpload(sessions[i],c.prefix+'concurrent.jpg',c.context)));
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
 assert.ok(outcomes.filter(r=>r.status==='rejected').every(r=>r.reason.status===429));
 assert.equal((await db`SELECT count(*)::int n FROM upload_reservations`)[0].n,2);
 assert.equal(Number((await db`SELECT used FROM upload_quota_buckets WHERE key LIKE 'bytes:ip:%'`)[0].used),64*10485760);
 assert.equal(Number((await db`SELECT used FROM upload_quota_buckets WHERE key LIKE 'bytes:global:%'`)[0].used),2*10485760);
 assert.equal((await db`SELECT count(DISTINCT subject)::int n FROM upload_contexts`)[0].n,8);
 await reset();
 const issued=await Promise.allSettled(Array.from({length:24},(_,i)=>policy.createUploadContext(new Request('http://localhost/api/upload',{headers:{origin:'http://localhost',cookie:'__Host-cartoonova-photo='+i.toString(16).padStart(64,'0')}}),{purpose:'checkout',product:'simpson'})));
 assert.equal(issued.filter(r=>r.status==='fulfilled').length,12);
 assert.ok(issued.filter(r=>r.status==='rejected').every(r=>r.reason.status===429));
 assert.equal((await db`SELECT count(*)::int n FROM upload_contexts`)[0].n,12);
});
test('public context issuance itself is shared, bounded and atomic',async()=>{
 await reset();
 const outcomes=await Promise.allSettled(Array.from({length:24},()=>policy.createUploadContext(req(),{purpose:'checkout',product:'simpson'})));
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,12);
 assert.equal((await db`SELECT count(*)::int n FROM upload_contexts`)[0].n,12);
 assert.equal(Number((await db`SELECT used FROM upload_quota_buckets WHERE key LIKE 'issue:global:%'`)[0].used),12);
 await reset();
 const [{day}]=await db`SELECT (now() AT TIME ZONE 'UTC')::date::text AS day`;
 await db`INSERT INTO upload_quota_buckets(key,used) VALUES (${`issue:global:${day}`},999)`;
 const global=await Promise.allSettled(Array.from({length:8},()=>policy.createUploadContext(req(),{purpose:'checkout',product:'simpson'})));
 assert.equal(global.filter(r=>r.status==='fulfilled').length,1);
});

test('provider failure keeps its pessimistic reservation and DB errors fail closed',async()=>{
 await reset();
 const c=await policy.createUploadContext(req(),{purpose:'checkout',product:'simpson'});
 const failedProvider={handleUpload:async o=>{await o.onBeforeGenerateToken(o.body.payload.pathname,o.body.payload.clientPayload,false);throw new Error('synthetic provider outage');}};
 const {POST}=load('app/api/upload/route.ts',{'@vercel/blob/client':failedProvider,'@/lib/uploadPolicy':policy});
 const r=await POST(new Request('http://localhost/api/upload',{method:'POST',headers:{origin:'http://localhost',cookie:sessionCookie,'content-type':'application/json'},body:JSON.stringify({type:'blob.generate-client-token',payload:{pathname:`${c.prefix}a.jpg`,clientPayload:c.context}})}));
 assert.equal(r.status,503);assert.equal((await db`SELECT count(*)::int n FROM upload_reservations`)[0].n,1);
 await assert.rejects(policy.reserveUpload(req(),`${c.prefix}a.jpg`,c.context),e=>e.status===409);
 const broken=load('lib/uploadPolicy.ts',{'@/lib/db':{withFreshDatabaseClient:async()=>{throw new Error('synthetic SQL outage');}}});
 let providerCalled=false;
 const route=load('app/api/upload/route.ts',{'@/lib/uploadPolicy':broken,'@vercel/blob/client':{handleUpload:async o=>{await o.onBeforeGenerateToken(`${c.prefix}a.jpg`,c.context,false);providerCalled=true;}}});
 assert.equal((await route.POST(new Request('http://localhost/api/upload',{method:'POST',headers:{origin:'http://localhost',cookie:sessionCookie,'content-type':'application/json'},body:JSON.stringify({type:'blob.generate-client-token',payload:{pathname:`${c.prefix}a.jpg`,clientPayload:c.context}})}))).status,503);
 assert.equal(providerCalled,false);
});
test('IP binding uses only the trusted Vercel header, not caller X-Forwarded-For',async()=>{
 await reset(); const old=process.env.VERCEL;process.env.VERCEL='1';
 const request=ip=>new Request('http://localhost/api/upload',{headers:{origin:'http://localhost',cookie:sessionCookie,'x-vercel-forwarded-for':ip,'x-forwarded-for':'attacker-controlled'}});
 try {
  const c=await policy.createUploadContext(request('192.0.2.1'),{purpose:'checkout',product:'simpson'});
  await assert.rejects(policy.reserveUpload(request('192.0.2.2'),`${c.prefix}a.jpg`,c.context),e=>e.status===403);
  await policy.reserveUpload(request('192.0.2.1'),`${c.prefix}a.jpg`,c.context);
 }finally{if(old===undefined)delete process.env.VERCEL;else process.env.VERCEL=old;}
});
test('authenticated admin context budget is separate from public IP budget and still globally capped',async()=>{
 await reset();
 await db`CREATE TABLE IF NOT EXISTS orders(id uuid PRIMARY KEY, paid_at timestamptz, poster_confirmation_token text)`;
 const id='12345678-1234-1234-1234-123456789abc';
 await db`INSERT INTO orders(id,paid_at) VALUES (${id},now()) ON CONFLICT(id) DO UPDATE SET paid_at=now()`;
 await Promise.all(Array.from({length:12},()=>policy.createUploadContext(req(),{purpose:'checkout',product:'simpson'})));
 await assert.rejects(policy.createUploadContext(req(),{purpose:'checkout',product:'simpson'}),e=>e.status===429);
 const adminReq=new Request('http://localhost/api/upload',{headers:{origin:'http://localhost','x-admin-password':'synthetic-admin-test-secret'}});
 for(let i=0;i<13;i++) await policy.createUploadContext(adminReq,{purpose:'admin',orderId:id});
 assert.equal(Number((await db`SELECT used FROM upload_quota_buckets WHERE key LIKE 'issue:admin:ip:%'`)[0].used),13);
 await db`UPDATE upload_quota_buckets SET used=127 WHERE key LIKE 'issue:admin:ip:%'`;
 const bounded=await Promise.allSettled(Array.from({length:4},()=>policy.createUploadContext(adminReq,{purpose:'admin',orderId:id})));
 assert.equal(bounded.filter(r=>r.status==='fulfilled').length,1);
 assert.ok(bounded.filter(r=>r.status==='rejected').every(r=>r.reason.status===429));
 await db`UPDATE upload_quota_buckets SET used=1000 WHERE key LIKE 'issue:global:%'`;
 await assert.rejects(policy.createUploadContext(adminReq,{purpose:'admin',orderId:id}),e=>e.status===429);
});

test('admin byte envelope bypasses exhausted public IP only, not context/subject/global caps',async()=>{
 await reset();
 await db`CREATE TABLE IF NOT EXISTS orders(id uuid PRIMARY KEY, paid_at timestamptz, poster_confirmation_token text)`;
 const id='12345678-1234-1234-1234-123456789abc';
 await db`INSERT INTO orders(id,paid_at) VALUES (${id},now()) ON CONFLICT(id) DO UPDATE SET paid_at=now()`;
 const publicContext=await policy.createUploadContext(req(),{purpose:'checkout',product:'simpson'});
 await policy.reserveUpload(req(),`${publicContext.prefix}seed.jpg`,publicContext.context);
 await db`UPDATE upload_quota_buckets SET used=64*10485760 WHERE key LIKE 'bytes:ip:%'`;
 await assert.rejects(policy.reserveUpload(req(),`${publicContext.prefix}blocked.jpg`,publicContext.context),e=>e.status===429);
 const adminReq=new Request('http://localhost/api/upload',{headers:{origin:'http://localhost','x-admin-password':'synthetic-admin-test-secret'}});
 const c=await policy.createUploadContext(adminReq,{purpose:'admin',orderId:id});
 await policy.reserveUpload(req(),`${c.prefix}seed.jpg`,c.context);
 await db`UPDATE upload_quota_buckets SET used=${255*10485760} WHERE key LIKE 'bytes:admin:ip:%'`;
 const results=await Promise.allSettled(Array.from({length:4},(_,i)=>policy.reserveUpload(req(),`${c.prefix}p${i}.jpg`,c.context)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.status===429));
 assert.equal(Number((await db`SELECT used FROM upload_quota_buckets WHERE key LIKE 'bytes:global:%'`)[0].used),3*10485760);
 for(const [scope,limit] of [['global',1000],['subject',32],['context',16]]) {
  await db`UPDATE upload_quota_buckets SET used=10485760 WHERE key LIKE 'bytes:%'`;
  await db`UPDATE upload_quota_buckets SET used=${limit*10485760} WHERE key LIKE ${`bytes:${scope}:%`}`;
  await assert.rejects(policy.reserveUpload(req(),`${c.prefix}blocked-${scope}.jpg`,c.context),e=>e.status===429);
 }
});

test('depot/poster need paid legitimate orders; admin needs real admin authentication',async()=>{
 await reset();
 await db`CREATE TABLE IF NOT EXISTS orders(id uuid PRIMARY KEY, paid_at timestamptz, poster_confirmation_token text)`;
 await db`TRUNCATE orders`;
 const id='12345678-1234-1234-1234-123456789abc';
 await db`INSERT INTO orders VALUES (${id},now(),'poster-synthetic-token')`;
 const {orderTrackingToken}=load('lib/emailToken.ts');
 const signed=orderTrackingToken(id);
 for(const input of [{purpose:'depot',token:'forged'},{purpose:'poster',token:'forged'},{purpose:'admin',orderId:id}]) {
  await assert.rejects(policy.createUploadContext(req(),input),e=>e.status===403||e.status===401);
 }
 const depot=await policy.createUploadContext(req(),{purpose:'depot',token:signed});
 const poster=await policy.createUploadContext(req(),{purpose:'poster',token:'poster-synthetic-token'});
 const adminReq=new Request('http://localhost/api/upload',{headers:{origin:'http://localhost','x-admin-password':'synthetic-admin-test-secret'}});
 const admin=await policy.createUploadContext(adminReq,{purpose:'admin',orderId:id});
 assert.match(depot.prefix,/^orders\//);assert.match(poster.prefix,/^retouches\//);assert.match(admin.prefix,/^final\//);
 // Exercise the actual upload handler with a mocked provider only.
 const {POST}=load('app/api/upload/route.ts',{'@vercel/blob/client':blobMock,'@/lib/uploadPolicy':policy});
 for(const c of [depot,poster,admin]) {
  const response=await POST(new Request('http://localhost/api/upload',{method:'POST',headers:{origin:'http://localhost',cookie:sessionCookie,'content-type':'application/json'},body:JSON.stringify({type:'blob.generate-client-token',payload:{pathname:`${c.prefix}photo.jpg`,clientPayload:c.context}})}));
  assert.equal(response.status,200);
 }
 await db`UPDATE orders SET paid_at=NULL`;
 await assert.rejects(policy.createUploadContext(req(),{purpose:'depot',token:signed}),e=>e.status===403);
 await assert.rejects(policy.createUploadContext(req(),{purpose:'poster',token:'poster-synthetic-token'}),e=>e.status===403);
});
