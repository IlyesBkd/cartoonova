import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {readFileSync,mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import {tmpdir} from 'node:os';
import net from 'node:net';
import postgres from 'postgres';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..'), runtime=mkdtempSync(path.join(tmpdir(),'chat-pg-')), bin='/usr/lib/postgresql/18/bin';
const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const pg=(cmd,args)=>execFileSync(path.join(bin,cmd),args,{env,timeout:15000,stdio:'pipe'});
let db,started=false;
function load(file,cache=new Map()) {
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;const m=new Module(file);m.filename=file;cache.set(file,m);const orig=createRequire(file);
 const deps={'@/lib/db':{sql:(...args)=>db(...args)},'@/lib/rateLimit':{cleDepuisRequete:()=>'',limiteur:()=>()=>false}};
 m.require=name=>name in deps?deps[name]:name.startsWith('@/')?load(name.slice(2)+'.ts',cache):orig(name);
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);return m.exports;
}
const post=load('app/api/chat/route.ts').POST;
const req=(key='11111111-1111-4111-8111-111111111111',message='Test local')=>new Request('https://local.invalid',{method:'POST',body:JSON.stringify({email:'local@example.invalid',message,idempotencyKey:key})});
before(async()=>{
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));assert.notEqual(port,5432);
 pg('initdb',['-D',path.join(runtime,'pg'),'-U','chat_test','--auth=trust','--no-locale','--encoding=UTF8']);pg('pg_ctl',['-D',path.join(runtime,'pg'),'-l',path.join(runtime,'pg.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${runtime}`,'-w','start']);started=true;
 db=postgres(`postgresql://chat_test@127.0.0.1:${port}/postgres`,{onnotice(){}});
 await db`CREATE TABLE support_messages (id SERIAL PRIMARY KEY, message_id TEXT UNIQUE NOT NULL, from_email TEXT NOT NULL, subject TEXT, body_text TEXT, received_at TIMESTAMPTZ, category TEXT)`;
 await db.unsafe(readFileSync(path.join(root,'migrations/20261026_chat_telegram_notifications.sql'),'utf8'));
});
after(async()=>{if(db)await db.end({timeout:2});if(started)pg('pg_ctl',['-D',path.join(runtime,'pg'),'-m','fast','-w','stop']);});
test('actual SQL commits support and pending notification together',async()=>{
 assert.equal((await post(req())).status,200);
 const rows=await db`SELECT m.message_id,m.from_email,m.body_text,n.status,n.attempts,n.support_message_id FROM support_messages m JOIN chat_telegram_notifications n ON n.support_message_id=m.id`;
 assert.equal(rows.length,1);assert.match(rows[0].message_id,/^chat-/);assert.equal(rows[0].from_email,'local@example.invalid');assert.equal(rows[0].body_text,'Test local');assert.equal(rows[0].status,'pending');assert.equal(rows[0].attempts,0);
});
test('queue insertion failure rolls back support insert',async()=>{
 await db`ALTER TABLE chat_telegram_notifications ADD CONSTRAINT synthetic_failure CHECK (false) NOT VALID`;
 assert.equal((await post(req('22222222-2222-4222-8222-222222222222'))).status,500);const rows=await db`SELECT count(*)::int AS n FROM support_messages`;assert.equal(rows[0].n,1);await db`ALTER TABLE chat_telegram_notifications DROP CONSTRAINT synthetic_failure`;
});

test('legacy requests without a key save distinct messages and queue notifications',async()=>{
 const legacy=()=>new Request('https://local.invalid',{method:'POST',body:JSON.stringify({email:' legacy@example.invalid ',message:' Legacy message '})});
 assert.deepEqual((await Promise.all([post(legacy()),post(legacy())])).map(r=>r.status),[200,200]);
 const rows=await db`SELECT m.message_id,m.from_email,m.body_text,n.status FROM support_messages m JOIN chat_telegram_notifications n ON n.support_message_id=m.id WHERE m.from_email='legacy@example.invalid'`;
 assert.equal(rows.length,2);assert.notEqual(rows[0].message_id,rows[1].message_id);
 for(const row of rows){assert.match(row.message_id,/^chat-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);assert.equal(row.body_text,'Legacy message');assert.equal(row.status,'pending');}
});

test('retries and simultaneous requests are idempotent; changed payload is rejected',async()=>{
 const key='33333333-3333-4333-8333-333333333333';
 const responses=await Promise.all([post(req(key)),post(req(key))]);
 assert.deepEqual(responses.map(r=>r.status),[200,200]);
 assert.equal((await post(req(key,'Other'))).status,409);
 const rows=await db`SELECT m.id FROM support_messages m JOIN chat_telegram_notifications n ON n.support_message_id=m.id WHERE m.message_id=${'chat-'+key}`;
 assert.equal(rows.length,1);
});
