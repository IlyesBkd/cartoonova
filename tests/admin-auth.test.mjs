import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { execFileSync } from 'node:child_process';
import postgres from 'postgres';
import { load } from './upload-harness.mjs';
const runtime=mkdtempSync(path.join(tmpdir(),'admin-auth-'));
const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const pg=(cmd,args)=>execFileSync('/usr/lib/postgresql/18/bin/'+cmd,args,{env,timeout:15000,stdio:'pipe'});
let db, started;
process.env.ADMIN_PASSWORD='synthetic-admin-password';
const auth=()=>load('lib/adminAuth.ts',{'@/lib/db':{withFreshDatabaseClient:fn=>fn(db)}});
const req=(method='GET',headers={})=>new Request('https://admin.invalid/api/admin/auth',{method,headers:{origin:'https://admin.invalid',...headers}});
before(async()=>{
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 pg('initdb',['-D',path.join(runtime,'pg'),'-U','admin_test','--auth=trust','--no-locale']);
 pg('pg_ctl',['-D',path.join(runtime,'pg'),'-l',path.join(runtime,'pg.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${runtime}`,'-w','start']);started=true;
 db=postgres(`postgresql://admin_test@127.0.0.1:${port}/postgres`,{max:10,onnotice(){}});
 const migration=new URL('../migrations/20261025_admin_sessions.sql',import.meta.url);
 const connection=await db.reserve();try{await connection.unsafe(readFileSync(migration,'utf8'));}finally{connection.release();}
});
beforeEach(async()=>{await db`TRUNCATE admin_sessions, admin_login_buckets`;});
const route=()=>load('app/api/admin/auth/route.ts',{'@/lib/adminAuth':auth()});
const login=()=>route().POST(new Request('https://admin.invalid/api/admin/auth',{method:'POST',headers:{origin:'https://admin.invalid','content-type':'application/json'},body:JSON.stringify({password:process.env.ADMIN_PASSWORD})}));
after(async()=>{if(db)await db.end({timeout:2});if(started)pg('pg_ctl',['-D',path.join(runtime,'pg'),'-m','fast','-w','stop']);});
test('password header alone no longer grants access to protected routes',async()=>{
 assert.equal((await auth().refuserSiPasAdmin(req('GET',{'x-admin-password':process.env.ADMIN_PASSWORD})))?.status,401);
});
test('login issues a short HttpOnly session accepted by a fresh guard instance',async()=>{
 const response=await login();
 assert.equal(response.status,204);
 const cookie=response.headers.get('set-cookie');
 assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=Strict/i);assert.match(cookie,/Max-Age=900/i);
 const token=cookie.match(/cartoonova-admin=([a-f0-9]{64})/)[1];
 assert.equal(await auth().requireAdmin(req('GET',{cookie:`cartoonova-admin=${token}`})),null);
 const [stored]=await db`SELECT * FROM admin_sessions`;
 assert.notEqual(stored.token_hash,token);assert.equal(stored.token_hash.length,64);
 assert.equal((await route().GET(req('GET',{cookie:`cartoonova-admin=${token}`}))).status,204);
});
test('cross-origin login cannot create an admin session',async()=>{
 const response=await route().POST(new Request('https://admin.invalid/api/admin/auth',{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:JSON.stringify({password:process.env.ADMIN_PASSWORD})}));
 assert.equal(response.status,403);
});
test('login attempt budget is atomic and shared between independent instances despite spoofed forwarding headers',async()=>{
 const attempts=await Promise.all(Array.from({length:20},(_,i)=>route().POST(new Request('https://admin.invalid/api/admin/auth',{method:'POST',headers:{origin:'https://admin.invalid','content-type':'application/json','x-forwarded-for':`192.0.2.${i}`},body:JSON.stringify({password:'wrong'})}))));
 assert.equal(attempts.filter(r=>r.status===401).length,5);
 assert.equal(attempts.filter(r=>r.status===429).length,15);
 assert.ok(attempts.filter(r=>r.status===429).every(r=>Number(r.headers.get('retry-after'))>0));
});
test('only explicit Vercel ingress trust enables per-client buckets; global budget still bounds rotating clients',async()=>{
 process.env.ADMIN_TRUST_PROXY='vercel';process.env.VERCEL='1';
 try {
  const attempt=ip=>route().POST(new Request('https://admin.invalid/api/admin/auth',{method:'POST',headers:{origin:'https://admin.invalid','content-type':'application/json','x-vercel-forwarded-for':ip},body:'{"password":"wrong"}'}));
  for(let i=0;i<5;i++)assert.equal((await attempt('192.0.2.1')).status,401);
  assert.equal((await attempt('192.0.2.1')).status,429);
  assert.equal((await attempt('192.0.2.2')).status,401);
  await db`UPDATE admin_login_buckets SET attempts=100 WHERE bucket_key='global'`;
  const count=(await db`SELECT count(*)::int n FROM admin_login_buckets`)[0].n;
  assert.equal((await attempt('192.0.2.3')).status,429);
  assert.equal((await db`SELECT count(*)::int n FROM admin_login_buckets`)[0].n,count,'global block cannot create unbounded client buckets');
 } finally {delete process.env.ADMIN_TRUST_PROXY;delete process.env.VERCEL;}
});
test('mutations and logout reject missing or foreign Origin even with a valid cookie',async()=>{
 const cookie=(await login()).headers.get('set-cookie').split(';')[0];
 for(const origin of ['', 'https://evil.invalid']) {
  const r=req('PATCH',{origin,cookie});assert.equal((await auth().requireAdmin(r)).status,403);
  assert.equal((await route().DELETE(req('DELETE',{origin,cookie}))).status,403);
 }
 assert.equal(await auth().requireAdmin(req('GET',{cookie})),null);
});
test('database never stores a reusable unsalted digest of the admin password',async()=>{
 await login();const [row]=await db`SELECT credential_hash FROM admin_sessions`;
 assert.notEqual(row.credential_hash,createHash('sha256').update(process.env.ADMIN_PASSWORD).digest('hex'));
});
test('expiration and credential rotation reject previously valid sessions',async()=>{
 const cookie=(await login()).headers.get('set-cookie').split(';')[0];
 await db`UPDATE admin_sessions SET expires_at=now()-interval '1 second'`;
 assert.equal((await auth().requireAdmin(req('GET',{cookie}))).status,401);
 const next=(await login()).headers.get('set-cookie').split(';')[0];
 const previous=process.env.ADMIN_PASSWORD;process.env.ADMIN_PASSWORD='rotated-synthetic-password';
 try{assert.equal((await auth().requireAdmin(req('GET',{cookie:next}))).status,401);}finally{process.env.ADMIN_PASSWORD=previous;}
});
test('absent password and unavailable database fail closed without leaking internals',async()=>{
 const cookie=(await login()).headers.get('set-cookie').split(';')[0];
 const previous=process.env.ADMIN_PASSWORD;delete process.env.ADMIN_PASSWORD;
 try{assert.equal((await auth().requireAdmin(req('GET',{cookie}))).status,503);assert.equal((await login()).status,503);}finally{process.env.ADMIN_PASSWORD=previous;}
 const broken=load('lib/adminAuth.ts',{'@/lib/db':{withFreshDatabaseClient:async()=>{throw Error('sensitive-db-detail');}}});
 for(const r of [await broken.requireAdmin(req('GET',{cookie})),await broken.loginAdmin(req('POST')),await broken.logoutAdmin(req('DELETE',{cookie}))]){assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/sensitive-db-detail/);}
});
test('production cookies are Secure and fixed expiry is never renewed by reads',async()=>{
 process.env.NODE_ENV='production';
 try{
  const response=await login();assert.match(response.headers.get('set-cookie'),/; Secure/);
  const cookie=response.headers.get('set-cookie').split(';')[0];
  const [before]=await db`SELECT expires_at FROM admin_sessions`;
  const check=await route().GET(req('GET',{cookie}));assert.equal(check.headers.get('set-cookie'),null);
  assert.equal((await db`SELECT expires_at FROM admin_sessions`)[0].expires_at.getTime(),before.expires_at.getTime());
 }finally{delete process.env.NODE_ENV;}
});
test('expired login window permits retries without instance-local resets',async()=>{
 for(let i=0;i<5;i++)await login();assert.equal((await login()).status,429);
 await db`UPDATE admin_login_buckets SET expires_at=now()-interval '1 second'`;
 assert.equal((await login()).status,204);
});
test('logout revokes the server record so a copied cookie cannot be replayed',async()=>{
 const response=await login();const cookie=response.headers.get('set-cookie').split(';')[0];
 const logout=route().DELETE;
 assert.equal(typeof logout,'function','logout endpoint must exist');
 const result=await logout(req('DELETE',{cookie}));
 assert.equal(result.status,204);assert.match(result.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await auth().requireAdmin(req('GET',{cookie}))).status,401);
});
