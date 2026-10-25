import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
const require=createRequire(import.meta.url);
const sharp=require('sharp');
const {MockAgent,setGlobalDispatcher,getGlobalDispatcher}=require('undici');
const origin='https://review-synthetic.public.blob.vercel-storage.com';
const url=origin+'/final/review/image.png';
function load(file,replacements={},cache=new Map()) {
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;
 const m=new Module(file);m.filename=file;cache.set(file,m);const original=createRequire(file);
 m.require=name=>{const normalized=name.startsWith('.')?'@/'+path.relative(root,path.resolve(path.dirname(file),name)):name;if(normalized in replacements)return replacements[normalized];if(normalized.startsWith('@/'))return load(normalized.slice(2)+'.ts',replacements,cache);return original(name);};
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);return m.exports;
}
async function isolated(run) {
 const oldOrigin=process.env.FINAL_IMAGE_STORAGE_ORIGIN;
 const previous=getGlobalDispatcher();const agent=new MockAgent();agent.disableNetConnect();
 process.env.FINAL_IMAGE_STORAGE_ORIGIN=origin;setGlobalDispatcher(agent);
 try {await run(agent);agent.assertNoPendingInterceptors();}
 finally {setGlobalDispatcher(previous);await agent.close();if(oldOrigin===undefined)delete process.env.FINAL_IMAGE_STORAGE_ORIGIN;else process.env.FINAL_IMAGE_STORAGE_ORIGIN=oldOrigin;}
}
test('independent review: downloaded PNG JPEG and WebP are complete decodable images',async()=>{
 await isolated(async agent=>{
  const {downloadFinalImage}=load('lib/finalImage.ts');
  for(const format of ['png','jpeg','webp']) {
   const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#facc15'}}).toFormat(format).toBuffer();
   agent.get(origin).intercept({path:'/final/review/image.png',method:'GET'}).reply(200,bytes,{headers:{'content-type':'image/'+format}});
   const image=await downloadFinalImage(url);
   assert.equal(image.contentType,'image/'+format);assert.deepEqual(Buffer.from(image.bytes),bytes);
   const decoded=await sharp(image.bytes).raw().toBuffer({resolveWithObject:true});
   assert.equal(decoded.info.width,2);assert.equal(decoded.info.height,2);assert.equal(decoded.data.length,12);
  }
 });
});
test('independent review: truncated PNG is rejected by downloader and bonus proxy',async()=>{
 await isolated(async agent=>{
  // Deliberately truncated after dimensions: no image data, CRC, or IEND.
  const truncated=Buffer.alloc(24);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(truncated);
  truncated.writeUInt32BE(13,8);truncated.write('IHDR',12);truncated.writeUInt32BE(1,16);truncated.writeUInt32BE(1,20);
  await assert.rejects(sharp(truncated).raw().toBuffer());
  const {GET}=load('app/api/bonus/[token]/image/route.ts',{
   '@/lib/db':{getOrderById:async()=>({final_image_url:url,final_image_sent_at:'synthetic'})},
   '@/lib/emailToken':{parseOrderTrackingToken:()=> 'synthetic'},
  });
  agent.get(origin).intercept({path:'/final/review/image.png',method:'GET'}).reply(200,truncated,{headers:{'content-type':'image/png'}});
  const response=await GET(new Request('https://local/bonus/token/image'),{params:Promise.resolve({token:'synthetic'})});
  assert.equal(response.status,502);
  const {downloadFinalImage}=load('lib/finalImage.ts');
  agent.get(origin).intercept({path:'/final/review/image.png',method:'GET'}).reply(200,truncated,{headers:{'content-type':'image/png'}});
  await assert.rejects(downloadFinalImage(url),error=>error.status===400&&!error.message.includes(url));
 });
});
test('independent review: rejects overlong dimensions without excluding high-resolution portraits',async()=>{
 await isolated(async agent=>{
  const {downloadFinalImage}=load('lib/finalImage.ts');
  for (const [width,height,accepted] of [[12001,1,false],[1,12001,false],[2400,3200,true]]) {
   const bytes=await sharp({create:{width,height,channels:3,background:'#facc15'}}).png().toBuffer();
   agent.get(origin).intercept({path:'/final/review/image.png',method:'GET'}).reply(200,bytes,{headers:{'content-type':'image/png'}});
   if(accepted) assert.deepEqual(Buffer.from((await downloadFinalImage(url)).bytes),bytes);
   else await assert.rejects(downloadFinalImage(url),/Portrait/);
  }
 });
});
test('independent review: header-readable PNG corruption and signature-only JPEG/WebP fail closed',async()=>{
 await isolated(async agent=>{
  const {downloadFinalImage}=load('lib/finalImage.ts');
  const complete=await sharp({create:{width:2,height:2,channels:3,background:'#facc15'}}).png().toBuffer();
  // Valid header and chunk structure, but corrupt compressed pixel payload.
  const corruptPixels=Buffer.from(complete);
  const idat=corruptPixels.indexOf('IDAT');
  corruptPixels.fill(0,idat+4,idat+4+corruptPixels.readUInt32BE(idat-4));
  assert.equal((await sharp(corruptPixels).metadata()).width,2);
  const malformed=[
   [corruptPixels,'png'],
   [Buffer.from([255,216,255,224,0,0,255,217]),'jpeg'],
   [Buffer.from('524946460e000000574542505650384c010000000000','hex'),'webp'],
  ];
  for(const [bytes,format] of malformed) {
   await assert.rejects(sharp(bytes).raw().toBuffer());
   agent.get(origin).intercept({path:'/final/review/image.png',method:'GET'}).reply(200,bytes,{headers:{'content-type':'image/'+format}});
   await assert.rejects(downloadFinalImage(url),error=>error.status===400&&!error.message.includes(url));
  }
 });
});
test('independent review: oversized pixel declarations are refused before decompression',async()=>{
 await isolated(async agent=>{
  const {downloadFinalImage,MAX_FINAL_IMAGE_PIXELS,MAX_FINAL_IMAGE_DIMENSION}=load('lib/finalImage.ts');
  assert.equal(MAX_FINAL_IMAGE_PIXELS,64_000_000);assert.equal(MAX_FINAL_IMAGE_DIMENSION,12_000);
  const original=await sharp({create:{width:1,height:1,channels:3,background:'#facc15'}}).png().toBuffer();
  for(const [width,height] of [[8001,8000],[12000,12000],[100000,100000]]) {
   const bytes=Buffer.from(original);
   bytes.writeUInt32BE(width,16);bytes.writeUInt32BE(height,20);
   // Update IHDR CRC, so rejection is for the declared pixel budget, not bad CRC.
   let crc=0xffffffff;
   for(const byte of bytes.subarray(12,29)) {
    crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
   }
   bytes.writeUInt32BE((crc^0xffffffff)>>>0,29);
   assert.equal((await sharp(bytes,{limitInputPixels:false}).metadata()).width,width);
   await assert.rejects(sharp(bytes,{limitInputPixels:MAX_FINAL_IMAGE_PIXELS}).metadata(),/pixel limit/i);
   agent.get(origin).intercept({path:'/final/review/image.png',method:'GET'}).reply(200,bytes,{headers:{'content-type':'image/png'}});
   await assert.rejects(downloadFinalImage(url),/Portrait/);
  }
 });
});
test('independent review: continuously ready empty chunks cannot starve the deadline',async()=>{
 await isolated(async()=>{
  const previous=globalThis.fetch;
  let pulls=0,cancelled=false;
  try {
   globalThis.fetch=async()=>new Response(new ReadableStream({pull(c){if(++pulls<100000)c.enqueue(new Uint8Array());else c.close();},cancel(){cancelled=true;}}),{headers:{'content-type':'image/png'}});
   const {downloadFinalImage}=load('lib/finalImage.ts');
   await assert.rejects(downloadFinalImage(url,{timeoutMs:15}),/Portrait/);
   assert.ok(pulls<100000,'deadline stops a continuously-ready stream before exhausting it');
   assert.equal(cancelled,true);
  } finally {globalThis.fetch=previous;}
 });
});
test('independent review: missing configuration fails closed with 503 before transport',async()=>{
 await isolated(async()=>{
  delete process.env.FINAL_IMAGE_STORAGE_ORIGIN;
  const {downloadFinalImage}=load('lib/finalImage.ts');
  await assert.rejects(downloadFinalImage(url),error=>error.status===503&&!error.message.includes(url));
 });
});
