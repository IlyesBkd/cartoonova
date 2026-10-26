import {test} from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';
import {loadDeep} from './order-delivery-harness.mjs';
import {NextRequest} from 'next/server.js';

test('poster transport attachments keep PNG/JPEG/WebP bytes, MIME and extension coherent',async()=>{
 for(const [format,mime,ext] of [['png','image/png','png'],['jpeg','image/jpeg','jpg'],['webp','image/webp','webp']]){
  const bytes=await sharp({create:{width:8,height:8,channels:3,background:'#fedcba'}}).toFormat(format).toBuffer();let payload;
  const order={id:'11111111-1111-4111-8111-111111111111',customer_email:'synthetic@example.invalid',final_image_url:'https://synthetic.public.blob.vercel-storage.com/final/test.'+ext,langue:'en',detected_country:'FR'};
  const {POST}=loadDeep('app/api/orders/send-poster-confirmation/route.ts',{
   '@/lib/adminAuth':{refuserSiPasAdmin:async()=>null},
   '@/lib/db':{getOrderById:async()=>order,setPosterConfirmationToken:async()=>true,recordPosterConfirmationMessage:async()=>{},setOrderLastOutboundMessageId:async()=>{}},
   '@/lib/envoiEmail':{envoyerEmail:async p=>{payload=p;return {data:{id:'local'},error:null};}},
   '@/lib/finalImage':{downloadFinalImage:async()=>({bytes,contentType:mime}),FinalImageError:class extends Error{}},
  });
  const response=await POST(new NextRequest('http://localhost/api/orders/send-poster-confirmation',{method:'POST',body:JSON.stringify({orderId:order.id,customerEmail:order.customer_email,finalImageUrl:order.final_image_url})}));assert.equal(response.status,200);
  const attachment=payload.attachments[0];assert.ok(attachment.filename.endsWith('.'+ext));assert.equal(attachment.contentType,mime);
  const actual=Buffer.from(attachment.content,'base64');assert.deepEqual(actual,bytes);assert.equal((await sharp(actual).metadata()).format,format);
 }
});

test('apex redirects combine host/protocol/path and keep root locale temporary',()=>{
 const {proxy}=loadDeep('proxy.ts',{'next-intl/middleware':()=>()=>{throw Error('should not reach intl');}});
 for(const port of ['',':38225']) for(const [path,target,status] of [['/?utm_source=fixture','/en?utm_source=fixture',307],['/simpson?x=1','/fr/simpson?x=1',308],['/de/collections','/de/collections',308]]){
  const response=proxy(new NextRequest('http://cartoonova.com'+port+path,{headers:{host:'cartoonova.com'}}));assert.equal(response.status,status);assert.equal(response.headers.get('location'),'https://www.cartoonova.com'+target);
 }
});
