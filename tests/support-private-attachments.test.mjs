import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import { tmpdir } from 'node:os';
import net from 'node:net';
import postgres from 'postgres';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..'), runtime=mkdtempSync(path.join(tmpdir(),'support-files-')), bin='/usr/lib/postgresql/18/bin';
const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const pg=(cmd,args)=>execFileSync(path.join(bin,cmd),args,{env,timeout:15000,stdio:'pipe'});
let db,started=false,authorized=true;
function load(file,cache=new Map()) {
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;
 const m=new Module(file);m.filename=file;cache.set(file,m);const orig=createRequire(file);
 const deps={'@/lib/db':{sql:(...args)=>db(...args)},'@/lib/adminAuth':{refuserSiPasAdmin:async()=>authorized?null:Response.json({error:'Non autorisé'}, {status:401})}};
 m.require=name=>{if(name in deps)return deps[name];if(name.startsWith('@/')||name.startsWith('.')){const base=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(file),name);if(existsSync(base+'.ts'))return load(base+'.ts',cache);}return orig(name);};
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);return m.exports;
}
before(async()=>{
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));assert.notEqual(port,5432);
 pg('initdb',['-D',path.join(runtime,'pg'),'-U','support_test','--auth=trust','--no-locale','--encoding=UTF8']);
 pg('pg_ctl',['-D',path.join(runtime,'pg'),'-l',path.join(runtime,'pg.log'),'-o',`-h 127.0.0.1 -p ${port} -c unix_socket_directories=''`,'-w','start']);started=true;
 db=postgres(`postgresql://support_test@127.0.0.1:${port}/postgres`,{onnotice(){}});
 await db`CREATE TABLE support_replies (id SERIAL PRIMARY KEY)`;
 await db.unsafe(readFileSync(path.join(root,'migrations/20261104_support_private_attachments.sql'),'utf8'));
 await db.unsafe(readFileSync(path.join(root,'migrations/20261104_support_private_attachments.sql'),'utf8'));
 await db`INSERT INTO support_replies DEFAULT VALUES`;
});
after(async()=>{if(db)await db.end({timeout:2});if(started)pg('pg_ctl',['-D',path.join(runtime,'pg'),'-m','fast','-w','stop']);rmSync(runtime,{recursive:true,force:true});});
test('private reply attachment is persisted and returned only to an authenticated admin',async()=>{
 const store=load('lib/supportAttachments.ts');
 const file=await store.storeSupportAttachment({replyId:1,name:'preuve.pdf',contentType:'application/pdf',bytes:Buffer.from('%PDF-synthetic')});
 const route=load('app/api/support/attachments/[id]/route.ts');
 const context={params:Promise.resolve({id:file.id})};
 authorized=false;assert.equal((await route.GET(new Request('https://local.invalid'),context)).status,401);
 authorized=true;const response=await route.GET(new Request('https://local.invalid'),context);
 assert.equal(response.status,200);assert.equal(Buffer.from(await response.arrayBuffer()).toString(),'%PDF-synthetic');
 assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.match(response.headers.get('content-disposition'),/^attachment;/);
 assert.equal((await route.GET(new Request('https://local.invalid'),{params:Promise.resolve({id:'not-a-uuid'})})).status,404);
 await db`UPDATE support_private_attachments SET content=${Buffer.from('altered')} WHERE id=${file.id}::uuid`;
 assert.equal((await route.GET(new Request('https://local.invalid'),context)).status,503);
});
test('invalid files cannot be stored and a deleted reply removes its files',async()=>{
 const store=load('lib/supportAttachments.ts');
 await assert.rejects(store.storeSupportAttachment({replyId:1,name:'bad\r\nname.pdf',contentType:'application/pdf',bytes:Buffer.from('x')}));
 await assert.rejects(store.storeSupportAttachment({replyId:1,name:'large.pdf',contentType:'application/pdf',bytes:Buffer.alloc(2*1024*1024+1)}));
 await assert.rejects(store.storeSupportAttachment({replyId:1,name:'empty.pdf',contentType:'application/pdf',bytes:Buffer.alloc(0)}));
 await assert.rejects(store.storeSupportAttachment({replyId:999,name:'missing.pdf',contentType:'application/pdf',bytes:Buffer.from('x')}));
 const max=await store.storeSupportAttachment({replyId:1,name:'max.pdf',contentType:'application/pdf',bytes:Buffer.alloc(2*1024*1024)});
 assert.ok(max.id);
 await db`DELETE FROM support_replies WHERE id=1`;
 assert.equal((await db`SELECT count(*)::int AS n FROM support_private_attachments`)[0].n,0);
});
