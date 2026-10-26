import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import {deliveryBoundaryDouble} from './order-delivery-double.mjs';
const root=path.resolve(import.meta.dirname,'..');
function load(file,replacements={},cache=new Map()) {
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;
 const m=new Module(file);m.filename=file;cache.set(file,m);const original=createRequire(file);
 m.require=name=>{const normalized=name.startsWith('.')?'@/'+path.relative(root,path.resolve(path.dirname(file),name)):name;if(normalized in replacements)return replacements[normalized];if(normalized.startsWith('@/'))return load(normalized.slice(2)+'.ts',replacements,cache);return original(name);};
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);return m.exports;
}
const origin='https://synthetic.public.blob.vercel-storage.com';
process.env.FINAL_IMAGE_STORAGE_ORIGIN=origin;
const url=origin+'/final/context/portrait.png';
const sharp=createRequire(import.meta.url)('sharp');
const png=await sharp({create:{width:1,height:1,channels:3,background:'#facc15'}}).png().toBuffer();
test('only configured storage and actual admin final prefix are authorized, before any request',async()=>{
 const {validateFinalImageUrl}=load('lib/finalImage.ts');
 assert.equal(validateFinalImageUrl(url),url);
 assert.equal(validateFinalImageUrl(origin+'/final/old-image.png'),origin+'/final/old-image.png');
 for(const bad of ['http://127.0.0.1/final/x.png','https://10.0.0.1/final/x.png','https://[::1]/final/x.png','https://localhost/final/x.png','https://other.public.blob.vercel-storage.com/final/x.png',origin+':444/final/x.png',origin+':443/final/x.png',origin+'/orders/x.png',origin+'/finality/x.png',origin+'/final/x.png#fragment',origin+'/final/x.png?download=1',origin.replace('https://','https://user:pass@')+'/final/x.png',origin+'/final/%2e%2e/orders/x.png',origin+'/final/x.png\" onclick=\"x']) assert.throws(()=>validateFinalImageUrl(bad),/portrait|stockage/i,bad);
 const old=process.env.FINAL_IMAGE_STORAGE_ORIGIN;
 for(const config of ['', 'https://127.0.0.1','https://10.0.0.1','https://localhost',origin+'/final/']) {process.env.FINAL_IMAGE_STORAGE_ORIGIN=config;assert.throws(()=>validateFinalImageUrl(url));}
 process.env.FINAL_IMAGE_STORAGE_ORIGIN=old;
});

test('real bonus route never proxies HTML and returns only verified bytes with nosniff',async()=>{
 const replacements={'@/lib/db':{getOrderById:async()=>({final_image_url:url,final_image_sent_at:'today'})},'@/lib/emailToken':{parseOrderTrackingToken:()=> 'synthetic'}};
 const {GET}=load('app/api/bonus/[token]/image/route.ts',replacements);
 await transport(async pool=>{
  pool.intercept({path:'/final/context/portrait.png'}).reply(200,'<html>private</html>',{headers:{'content-type':'text/html'}});
  const refused=await GET(new Request('https://local/bonus/token/image'),{params:Promise.resolve({token:'synthetic'})});assert.equal(refused.status,502);
  pool.intercept({path:'/final/context/portrait.png'}).reply(200,png,{headers:{'content-type':'image/png'}});
  const response=await GET(new Request('https://local/bonus/token/image'),{params:Promise.resolve({token:'synthetic'})});
  assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
 });
});
test('real poster route attaches verified content, never a provider-fetched path',async()=>{
 let captured;let writes=0;
 const {POST}=load('app/api/orders/send-poster-confirmation/route.ts',{'@/lib/db':{getOrderById:async()=>({id:'synthetic',customer_email:'captured@example.invalid',final_image_url:url,langue:'en'}),setPosterConfirmationToken:async()=>{writes++;return true;},recordPosterConfirmationMessage:async()=>{},setOrderLastOutboundMessageId:async()=>{}},'@/lib/adminAuth':{refuserSiPasAdmin:()=>null},'@/lib/envoiEmail':{envoyerEmail:async p=>{captured=p;return {data:{id:'captured'}};}}});
 const req=image=>new Request('https://local/api/orders/send-poster-confirmation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:'synthetic',customerEmail:'captured@example.invalid',finalImageUrl:image})});
 await transport(async pool=>{
  assert.equal((await POST(req('https://127.0.0.1/final/x.png'))).status,409);assert.equal(writes,0);assert.equal(captured,undefined);
  pool.intercept({path:'/final/context/portrait.png'}).reply(200,png,{headers:{'content-type':'image/png'}});
  assert.equal((await POST(req(url))).status,200);
  assert.equal(captured.attachments[0].path,undefined);assert.deepEqual(Buffer.from(captured.attachments[0].content,'base64'),png);assert.match(captured.attachments[0].filename,/\.png$/);
 });
});
test('manual persistence rejects untrusted portraits before writing, including saveOnly',async()=>{
 let writes=0;
 const {POST}=load('app/api/orders/send-final-image/route.ts',{'@/lib/db':{getOrderById:async()=>({options:{}}),updateOrderFinalImage:async()=>writes++},'@/lib/adminAuth':{refuserSiPasAdmin:()=>null},'@/lib/emailImageFinale':{envoyerImageFinale:async()=>assert.fail('no delivery before portrait validation')}});
 await transport(async()=>{
  const response=await POST(new Request('https://local/api/orders/send-final-image',{method:'POST',body:JSON.stringify({orderId:'synthetic',finalImageUrl:'https://127.0.0.1/final/x.png',saveOnly:true})}));
  assert.equal(response.status,400);assert.equal(writes,0);
 });
});
test('real final email helper checks saved portrait before provider and delivered marker',async()=>{
 let sends=0;let marks=0;
 const {envoyerImageFinale}=load('lib/emailImageFinale.ts',{'@/lib/orderDelivery':deliveryBoundaryDouble(()=>marks++),'@/lib/db':{getOrderById:async()=>order,markFinalImageSent:async()=>marks++,setOrderLastOutboundMessageId:async()=>{}},'@/lib/envoiEmail':{envoyerEmail:async()=>{sends++;return {data:{id:'capture'}};}},'@/lib/analyticsServeur':{mesureServeur:async()=>{}},'@/lib/parrainage':{infosParrainage:async()=>null},'@/lib/emailToken':{orderTrackingToken:()=> 'synthetic'}});
 const order={status:'PAID',paid_at:'2026-01-01',id:'synthetic',customer_email:'capture@example.invalid',customer_name:null,detected_country:null,langue:'en',final_image_url:url,options:{}};
 await transport(async pool=>{
  pool.intercept({path:'/final/context/portrait.png'}).reply(200,'<html>bad</html>',{headers:{'content-type':'image/png'}});
  await assert.rejects(envoyerImageFinale(order),/Portrait/);assert.equal(sends,0);assert.equal(marks,0);
  pool.intercept({path:'/final/context/portrait.png'}).reply(200,png,{headers:{'content-type':'image/png'}});
  await envoyerImageFinale(order);assert.equal(sends,1);assert.equal(marks,1);
 });
});
test('extras route and shared PDF image helper reject HTML before Blob or decoder',async()=>{
 const {POST}=load('app/api/orders/extras/route.ts',{'@/lib/db':{getOrderById:async()=>({id:'synthetic',options:{carteVoeux:true},final_image_url:url})},'@/lib/adminAuth':{refuserSiPasAdmin:()=>null},'@/lib/envoiEmail':{envoyerEmail:async()=>assert.fail('no mail')},'@vercel/blob':{put:async()=>assert.fail('no Blob writes')}});
 await transport(async pool=>{
  pool.intercept({path:'/final/context/portrait.png'}).reply(200,'<html>bad</html>',{headers:{'content-type':'text/html'}});
  const response=await POST(new Request('https://local/api/orders/extras',{method:'POST',body:JSON.stringify({orderId:'synthetic'})}));assert.notEqual(response.status,200);
  const {embarquerImage}=load('lib/extras/carteVoeux.ts');
  await assert.rejects(embarquerImage({},new Uint8Array(Buffer.from('<html>bad</html>'))),/Portrait/);
 });
});
test('deadline covers stalled body and streaming cap cancels a lying source',async()=>{
 const {downloadFinalImage,MAX_FINAL_IMAGE_BYTES}=load('lib/finalImage.ts');
 const previous=globalThis.fetch;
 await transport(async()=>{
  let cancelled=false;
  try {
   globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(png);},cancel(){cancelled=true;}}),{headers:{'content-type':'image/png'}});
   await assert.rejects(downloadFinalImage(url,{timeoutMs:15}),/Portrait/);assert.equal(cancelled,true);
   cancelled=false;
   globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(png);c.enqueue(new Uint8Array(MAX_FINAL_IMAGE_BYTES));},cancel(){cancelled=true;}}),{headers:{'content-type':'image/png','content-length':'1'}});
   await assert.rejects(downloadFinalImage(url),/Portrait/);assert.equal(cancelled,true);
  } finally {globalThis.fetch=previous;}
 });
});
test('poster uses real Resend SDK transport with captured bytes and no remote attachment',async()=>{
 const key=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY='re_synthetic_local_only';
 const agent=new MockAgent();agent.disableNetConnect();const previous=getGlobalDispatcher();setGlobalDispatcher(agent);
 try {
  const {POST}=load('app/api/orders/send-poster-confirmation/route.ts',{'@/lib/db':{getOrderById:async()=>({id:'synthetic',customer_email:'captured@example.invalid',final_image_url:url,langue:'en'}),setPosterConfirmationToken:async()=>true,recordPosterConfirmationMessage:async()=>{},setOrderLastOutboundMessageId:async()=>{}},'@/lib/adminAuth':{refuserSiPasAdmin:()=>null}});
  agent.get(origin).intercept({path:'/final/context/portrait.png'}).reply(200,png,{headers:{'content-type':'image/png'}});
  let captured;
  agent.get('https://api.resend.com').intercept({path:'/emails',method:'POST'}).reply(200,({body})=>{captured=JSON.parse(body);return {id:'synthetic-capture'};});
  const response=await POST(new Request('https://local/api/orders/send-poster-confirmation',{method:'POST',body:JSON.stringify({orderId:'synthetic',customerEmail:'captured@example.invalid',finalImageUrl:url})}));
  assert.equal(response.status,200);assert.equal(captured.attachments[0].path,undefined);assert.deepEqual(Buffer.from(captured.attachments[0].content,'base64'),png);agent.assertNoPendingInterceptors();
 } finally {setGlobalDispatcher(previous);await agent.close();if(key===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=key;}
});
const require=createRequire(import.meta.url);
const {MockAgent,setGlobalDispatcher,getGlobalDispatcher}=require('undici');
async function transport(run) {
 const agent=new MockAgent();agent.disableNetConnect();const previous=getGlobalDispatcher();setGlobalDispatcher(agent);
 try {await run(agent.get(origin));} finally {setGlobalDispatcher(previous);await agent.close();}
}
test('bounded downloader accepts PNG JPEG WEBP only with matching MIME and real signature',async()=>{
 const {downloadFinalImage}=load('lib/finalImage.ts');
 await transport(async pool=>{
  for(const format of ['png','jpeg','webp']) {
   const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#facc15'}}).toFormat(format).toBuffer();
   const mime='image/'+format;
   pool.intercept({path:'/final/context/portrait.png'}).reply(200,bytes,{'headers':{'content-type':mime}});
   const image=await downloadFinalImage(url);assert.equal(image.contentType,mime);assert.deepEqual(Buffer.from(image.bytes),bytes);
  }
  for(const [bytes,mime] of [[Buffer.from('<html>secret</html>'),'image/png'],[png,'text/html'],[png,'image/jpeg'],[png,'application/octet-stream']]) {
   pool.intercept({path:'/final/context/portrait.png'}).reply(200,bytes,{'headers':{'content-type':mime}});
   await assert.rejects(downloadFinalImage(url),/Portrait/);
  }
 });
});
test('redirects never contact another destination and limits do not trust Content-Length',async()=>{
 const {downloadFinalImage,MAX_FINAL_IMAGE_BYTES}=load('lib/finalImage.ts');
 await transport(async pool=>{
  pool.intercept({path:'/final/context/portrait.png'}).reply(302,'',{'headers':{location:'https://127.0.0.1/secret'}});
  await assert.rejects(downloadFinalImage(url),/Portrait/);
  for(const length of [undefined,'1',String(MAX_FINAL_IMAGE_BYTES+1)]) {
   pool.intercept({path:'/final/context/portrait.png'}).reply(200,Buffer.alloc(MAX_FINAL_IMAGE_BYTES+1),{headers:{'content-type':'image/png',...(length?{'content-length':length}:{})}});
   await assert.rejects(downloadFinalImage(url),/Portrait/);
  }
  pool.intercept({path:'/final/context/portrait.png'}).reply(200,png,{headers:{'content-type':'image/png'}}).delay(70);
  await assert.rejects(downloadFinalImage(url,{timeoutMs:15}),/Portrait/);
 });
});
