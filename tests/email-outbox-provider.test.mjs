import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const templateFile=path.resolve(import.meta.dirname,'../lib/emailTemplate.ts');
const template=new Module(templateFile);
template.require=name=>{assert.equal(name,'./site');return {SITE_URL:'https://www.cartoonova.com'};};
template._compile(ts.transpileModule(readFileSync(templateFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,templateFile);
const {emailText}=template.exports;

// Real adapter, fake SDK and journal only: no provider or database access.
const filename=path.resolve(import.meta.dirname,'../lib/envoiEmail.ts');
const calls=[];
const journal=[];
let result={data:{id:'local'},error:null};
let providerError;
const history={
 beginEmailHistory:async(payload,key)=>{journal.push(['begin',payload,key]);return 'local-attempt';},
 finishEmailHistory:async(...args)=>{journal.push(['finish',...args]);},
 emailHistoryDiagnostic:()=>assert.fail('unexpected journal failure'),
};
const adapter=new Module(filename);
adapter.filename=filename;
adapter.require=name=>{
 if(name==='./emailTemplate')return {emailText};
 if(name==='./customerHistoryJournal')return history;
 assert.equal(name,'resend');
 return {Resend:class {emails={send:async(...args)=>{calls.push(args);journal.push(['provider']);if(providerError)throw providerError;return result;}};}};
};
adapter._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {envoyerEmail}=adapter.exports;
const payload={from:'local@example.invalid',to:['local@example.invalid'],subject:'Local',html:'Local'};
test('adapter forwards stable idempotency key to Resend without mutating the payload',async()=>{
 journal.length=0;
 const options={idempotencyKey:'order:local'};
 assert.equal(await envoyerEmail(payload,options),result);
 assert.deepEqual(calls.at(-1),[{...payload,text:'Local'},options]);
 assert.deepEqual(journal,[['begin',{...payload,text:'Local'},'order:local'],['provider'],['finish','local-attempt','sent','local']]);
 assert.equal(payload.text,undefined);
});
test('provider error object is an actual rejected delivery, never success',async()=>{
 journal.length=0;
 const before=calls.length;
 result={data:null,error:{name:'rate_limit_exceeded',message:'local refusal'}};
 await assert.rejects(envoyerEmail(payload,{idempotencyKey:'order:local'}),/rate_limit_exceeded/);
 assert.equal(calls.length,before+1);
 assert.deepEqual(journal,[['begin',{...payload,text:'Local'},'order:local'],['provider'],['finish','local-attempt','failed']]);
});
test('provider exception is preserved and journaled as uncertain, never sent',async()=>{
 journal.length=0;
 const before=calls.length;
 providerError=new Error('local transport failure');
 try {
  await assert.rejects(envoyerEmail(payload),error=>error===providerError);
  assert.equal(calls.length,before+1);
  assert.deepEqual(journal,[['begin',{...payload,text:'Local'},undefined],['provider'],['finish','local-attempt','uncertain']]);
 } finally {providerError=undefined;}
});
