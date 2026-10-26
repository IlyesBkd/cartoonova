import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
let calls=[], fail=false;
function load(file,cache=new Map(),realRate=false) {
 file=path.resolve(root,file); if(cache.has(file)) return cache.get(file).exports;
 const m=new Module(file); m.filename=file; cache.set(file,m); const original=createRequire(file);
 const replacements={
  '@/lib/db':{sql:async (parts,...values)=>{calls.push({query:parts.join('?'),values});if(fail)throw Error('db down');return [{id:1,inserted:true}];},findOrderByCustomerEmail:async()=>null},
  '@/lib/rateLimit':{cleDepuisRequete:()=>'',limiteur:()=>()=>false},
 };
 if(realRate) delete replacements['@/lib/rateLimit'];
 m.require=name=>name in replacements?replacements[name]:name.startsWith('@/')?load(name.slice(2)+'.ts',cache):original(name);
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file); return m.exports;
}
const post=load('app/api/chat/route.ts').POST;
const req=(body)=>new Request('https://local.invalid/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idempotencyKey:'11111111-1111-4111-8111-111111111111',...body})});
test('accepted chat is saved atomically with a pending durable notification without Discord configured',async()=>{
 calls=[];delete process.env.DISCORD_WEBHOOK_URL; const res=await post(req({email:'visitor@example.invalid',message:'Hello support'}));
 assert.equal(res.status,200); assert.equal(calls.length,1); assert.match(calls[0].query,/support_messages/i);assert.match(calls[0].query,/chat_telegram_notifications/i);assert.ok(calls[0].values.some(x=>typeof x==='string'&&x.startsWith('chat-')));
});
test('database failure is reported, not acknowledged',async()=>{fail=true;try {assert.equal((await post(req({email:'visitor@example.invalid',message:'Hello support'}))).status,500);}finally{fail=false;}});
test('invalid email and oversize message are rejected before persistence',async()=>{calls=[];assert.equal((await post(req({email:'oops',message:'hi'}))).status,400);assert.equal((await post(req({email:'ok@example.invalid',message:'x'.repeat(5001)}))).status,400);assert.equal(calls.length,0);});

test('body bytes are bounded even with absent or false content length',async()=>{
 for(const headers of [{},{'content-length':'1'}]) {
  const r=new Request('https://local.invalid',{method:'POST',headers,body:JSON.stringify({email:'ok@example.invalid',message:'x',padding:'é'.repeat(20000)})});
  assert.equal((await post(r)).status,413);
 }
});

test('real IP limiter counts malformed requests before parsing and rejects without reading',async()=>{
 const limited=load('app/api/chat/route.ts',new Map(),true).POST;
 for(let i=0;i<5;i++) assert.equal((await limited(new Request('https://local.invalid',{method:'POST',headers:{'x-forwarded-for':'192.0.2.7'},body:'{'}))).status,400);
 let pulled=false;
 const body=new ReadableStream({pull(c){pulled=true;c.enqueue(new TextEncoder().encode('{}'));c.close();}},{highWaterMark:0});
 const response=await limited(new Request('https://local.invalid',{method:'POST',headers:{'x-forwarded-for':'192.0.2.7'},body,duplex:'half'}));
 assert.equal(response.status,429);assert.equal(pulled,false);
 assert.equal((await limited(new Request('https://local.invalid',{method:'POST',headers:{'x-forwarded-for':'192.0.2.8'},body:'{'}))).status,400);
});
