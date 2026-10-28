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

// Real adapter, fake SDK only: cannot contact Resend or read a real API key.
const filename=path.resolve(import.meta.dirname,'../lib/envoiEmail.ts');
const calls=[];
let result={data:{id:'local'},error:null};
const adapter=new Module(filename);
adapter.filename=filename;
adapter.require=name=>{
 if(name==='./emailTemplate')return {emailText};
 assert.equal(name,'resend');
 return {Resend:class {emails={send:async(...args)=>{calls.push(args);return result;}};}};
};
adapter._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {envoyerEmail}=adapter.exports;
const payload={from:'local@example.invalid',to:['local@example.invalid'],subject:'Local',html:'Local'};
test('adapter forwards stable idempotency key to Resend without mutating the payload',async()=>{
 const options={idempotencyKey:'order:local'};
 await envoyerEmail(payload,options);
 assert.deepEqual(calls.at(-1),[{...payload,text:'Local'},options]);
 assert.equal(payload.text,undefined);
});
test('provider error object is an actual rejected delivery, never success',async()=>{
 result={data:null,error:{name:'rate_limit_exceeded',message:'local refusal'}};
 await assert.rejects(envoyerEmail(payload,{idempotencyKey:'order:local'}),/rate_limit_exceeded/);
});
