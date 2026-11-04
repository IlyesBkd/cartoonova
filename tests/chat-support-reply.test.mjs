import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..'); let sent=[], messageId='chat-123', prepared;
function load(file,cache=new Map()) {
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;
 const m=new Module(file);m.filename=file;cache.set(file,m);const original=createRequire(file);
 const deps={
  '@/lib/db':{getSupportMessageById:async()=>({id:1,message_id:messageId,from_email:'client@example.invalid',subject:'chat',order_id:null,read_at:null}),insertSupportReply:async()=>({id:1}),markSupportMessageRead:async()=>{}},
  '@/lib/adminAuth':{refuserSiPasAdmin:async()=>null},
  '@/lib/expediteur':{EXPEDITEUR:'support@example.invalid',SUPPORT_EMAIL:'support@example.invalid'},
  '@/lib/envoiEmail':{envoyerEmail:async mail=>{sent.push(mail);return {data:{id:'synthetic'}};}},
  '@/lib/supportPreparedReplies':{prepareSupportReply:async input=>{prepared=input;return '11111111-1111-4111-8111-111111111111';},readPreparedSupportReply:async()=>({...prepared,id:'11111111-1111-4111-8111-111111111111',approvalFingerprint:'a'.repeat(64)})},
  '@/lib/supportPreparedDelivery':{sendPreparedSupportReply:async (_id,_fp,send,validate)=>{const ref=prepared.reference;const draft={id:_id,...prepared,attachments:[],transport:{from:'support@example.invalid',replyTo:'support@example.invalid',html:'Hello',headers:ref?{'In-Reply-To':ref,References:ref}:null}};validate(draft);await send(draft,'key');return 1;}},
 };
 m.require=name=>{
  if(name in deps)return deps[name];
  if(name.startsWith('@/')||name.startsWith('.')){
   const base=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(file),name);
   if(existsSync(base+'.ts'))return load(base+'.ts',cache);
  }
  return original(name);
 };
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);return m.exports;
}
const post=load('app/api/support/prepared-send/route.ts').POST;
test('legacy direct endpoint cannot bypass preparation',async()=>{
 const direct=load('app/api/support/reply/route.ts').POST;sent=[];
 const response=await direct(new Request('https://local.invalid',{method:'POST',body:JSON.stringify({messageId:1,corps:'Hello'})}));
 assert.equal(response.status,410);assert.equal(sent.length,0);
});
test('chat replies address the customer without synthetic threading headers; genuine email references remain',async()=>{
 for(const [id,headers] of [['chat-11111111-1111-4111-8111-111111111111',undefined],['chat-real@example.invalid',{'In-Reply-To':'<chat-real@example.invalid>',References:'<chat-real@example.invalid>'}],['real@example.invalid',{'In-Reply-To':'<real@example.invalid>',References:'<real@example.invalid>'}]]) {
  messageId=id;sent=[];const form=new FormData();form.set('messageId','1');form.set('body','Hello');
  assert.equal((await load('app/api/support/prepare/route.ts').POST(new Request('https://local.invalid',{method:'POST',body:form}))).status,200);
  const response=await post(new Request('https://local.invalid',{method:'POST',body:JSON.stringify({id:'11111111-1111-4111-8111-111111111111',approvalFingerprint:'a'.repeat(64)})}));
  assert.equal(response.status,200);assert.deepEqual(sent[0].to,['client@example.invalid']);assert.deepEqual(sent[0].headers,headers);
 }
});
