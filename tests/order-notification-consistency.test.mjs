import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {mkdtempSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {execFileSync} from 'node:child_process';
import postgres from 'postgres';
import {createRequire,Module} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=path.resolve(import.meta.dirname,'..');
function load(file,replacements={},cache=new Map()) {
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;
 const m=new Module(file);m.filename=file;cache.set(file,m);const original=createRequire(file);
 m.require=name=>{const normalized=name.startsWith('.')?'@/'+path.relative(root,path.resolve(path.dirname(file),name)):name;if(normalized in replacements)return replacements[normalized];if(normalized.startsWith('@/'))return load(normalized.slice(2)+'.ts',replacements,cache);return original(name);};
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);return m.exports;
}
import {MockAgent,getGlobalDispatcher,setGlobalDispatcher} from 'undici';
const runtime=mkdtempSync(path.join(tmpdir(),'order-notifications-'));
const bin='/usr/lib/postgresql/18/bin';
const pg=(cmd,args)=>execFileSync(path.join(bin,cmd),args,{env:process.env,timeout:15000,stdio:'pipe'});
const origin='https://notification-synthetic.public.blob.vercel-storage.com';
const image=origin+'/final/context/a.png',otherImage=origin+'/final/context/b.png';
const id='12345678-1234-4234-8234-123456789abc';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4dUYUAASfAdxNa9nPAAAAAElFTkSuQmCC','base64');
let db,database,started,agent,previous,sends=[],downloads=0;
let duringDownload=async()=>{};
process.env.NEWSLETTER_SECRET='synthetic-notification-test';
process.env.VERCEL='1';process.env.FINAL_IMAGE_STORAGE_ORIGIN=origin;
before(async()=>{
 const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
 pg('initdb',['-D',path.join(runtime,'pg'),'-U','notification_test','--auth=trust','--no-locale']);
 pg('pg_ctl',['-D',path.join(runtime,'pg'),'-l',path.join(runtime,'pg.log'),'-o',`-h 127.0.0.1 -p ${port} -k ''`,'-w','start']);started=true;
 process.env.DATABASE_URL=`postgresql://notification_test@127.0.0.1:${port}/postgres`;
 db=postgres(process.env.DATABASE_URL,{onnotice(){}});
 await db`CREATE TABLE orders(id uuid PRIMARY KEY,status text,paid_at timestamptz,expedie_le timestamptz,customer_email text,customer_name text,detected_country text,langue text,options jsonb,final_image_url text,final_image_sent_at timestamptz,final_image_scheduled_at timestamptz,poster_confirmation_token text,poster_confirmation_sent_at timestamptz,poster_confirmation_status text,poster_confirmation_responded_at timestamptz,poster_confirmation_note text,poster_confirmation_photos jsonb,last_outbound_message_id text,review_request_sent_at timestamptz)`;
 const migration=new URL('../migrations/20261025_order_notification_versions.sql',import.meta.url);
 if(existsSync(migration))await db.unsafe(readFileSync(migration,'utf8'));
 const client=new Proxy(db,{get:(target,key)=>key==='end'?async()=>{}:Reflect.get(target,key)});
 database=load('lib/db.ts',{'postgres':()=>client});
 previous=getGlobalDispatcher();agent=new MockAgent();agent.disableNetConnect();setGlobalDispatcher(agent);
 agent.get(origin).intercept({path:/\/final\/context\/[ab]\.png/}).reply(200,async()=>{downloads++;await duringDownload();return png;},{headers:{'content-type':'image/png'}}).persist();
});
after(async()=>{try{if(db)await db.end({timeout:2});}finally{if(started)pg('pg_ctl',['-D',path.join(runtime,'pg'),'-m','fast','-w','stop']);rmSync(runtime,{recursive:true,force:true});if(agent){setGlobalDispatcher(previous);await agent.close();}}});
beforeEach(async()=>{
 sends=[];downloads=0;duringDownload=async()=>{};
 await db`TRUNCATE orders`;
 // Paid, not delivered/dispatched: preview responses remain open until a real milestone closes them.
 await db`INSERT INTO orders(id,status,paid_at,customer_email,customer_name,detected_country,langue,options,final_image_url) VALUES (${id},'in_progress','2026-10-01T10:00:00Z','buyer@example.invalid','Saved Buyer','FR','en',${db.json({printKey:'poster',gift:{recipientEmail:'gift@example.invalid',deliverAfter:'2099-12-31'}})},${image})`;
});
function route(file,extra={}){
 return load(file,{'@/lib/db':database,'@/lib/adminAuth':{refuserSiPasAdmin:()=>null},'@/lib/envoiEmail':{envoyerEmail:async payload=>{sends.push(payload);return {data:{id:'captured-message'},error:null};}},...extra});
}
function request(body){return new Request('https://local/api/orders/send-poster-confirmation',{method:'POST',body:JSON.stringify(body)});}
const body=()=>({orderId:id,customerEmail:'buyer@example.invalid',finalImageUrl:image});
test('real preview page renders the invitation portrait and no portrait after replacement',async()=>{
 await route('app/api/orders/send-poster-confirmation/route.ts').POST(request(body()));
 const saved=await database.getOrderById(id);
 const Page=route('app/(hors-langue)/confirm-poster/[token]/page.tsx',{
  'next/image':props=>createElement('img',{src:props.src,alt:props.alt}),
  '@/app/(hors-langue)/confirm-poster/[token]/ConfirmClient':()=>null,
 }).default;
 const html=renderToStaticMarkup(await Page({params:Promise.resolve({token:saved.poster_confirmation_token})}));
 assert.ok(html.includes(`src="${saved.poster_confirmation_image_url}"`));
 await database.updateOrderFinalImage(id,otherImage);
 const expired=renderToStaticMarkup(await Page({params:Promise.resolve({token:saved.poster_confirmation_token})}));
 assert.doesNotMatch(expired,/<img|a\.png|b\.png/);
});
test('preview compare-and-set refuses changes made while downloading the attachment',async()=>{
 duringDownload=async()=>{await database.updateOrderFinalImage(id,otherImage);};
 const r=await route('app/api/orders/send-poster-confirmation/route.ts').POST(request(body()));
 assert.equal(r.status,409);assert.equal(sends.length,0);assert.equal((await database.getOrderById(id)).poster_confirmation_token,null);
});
test('review rejects stale images and sends valid requests only to the saved buyer even for gifts',async()=>{
 const {POST}=route('app/api/orders/review-request/route.ts',{'@/lib/reviewsDb':{avisExistePourCommande:async()=>false}});
 assert.equal((await POST(request({...body(),finalImageUrl:otherImage}))).status,409);
 assert.equal(sends.length,0);
 const r=await POST(request({...body(),customerName:'Forged Name',detectedCountry:'DE'}));
 assert.equal(r.status,200);assert.deepEqual(sends[0].to,['buyer@example.invalid']);
 assert.match(sends[0].html,/Saved Buyer/);assert.doesNotMatch(sends[0].html,/Forged Name|gift@example.invalid/);
});
test('replacing a portrait cancels the previous image delivery schedule atomically; identical saves preserve it',async()=>{
 await db`UPDATE orders SET final_image_scheduled_at='2099-12-31T09:00:00Z' WHERE id=${id}`;
 await database.updateOrderFinalImage(id,image);
 assert.ok((await database.getOrderById(id)).final_image_scheduled_at);
 await database.updateOrderFinalImage(id,otherImage);
 assert.equal((await database.getOrderById(id)).final_image_scheduled_at,null);
});
test('saving a replacement physical portrait cannot reuse approval of the previous image to schedule delivery',async()=>{
 await route('app/api/orders/send-poster-confirmation/route.ts').POST(request(body()));
 const token=(await database.getOrderById(id)).poster_confirmation_token;
 await database.recordPosterConfirmationResponse(token,'confirmed');sends=[];
 const r=await route('app/api/orders/send-final-image/route.ts').POST(request({...body(),finalImageUrl:otherImage,saveOnly:true}));
 assert.equal(r.status,200);assert.equal((await r.json()).raisonNonProgramme,'validation_tirage');
 const saved=await database.getOrderById(id);
 assert.equal(saved.final_image_scheduled_at,null);assert.equal(saved.poster_confirmation_token,null);assert.equal(sends.length,0);
});
test('save schedule compare-and-set rejects replacement after canonical read (barrier)',async()=>{
 await route('app/api/orders/send-poster-confirmation/route.ts').POST(request(body()));
 await database.recordPosterConfirmationResponse((await database.getOrderById(id)).poster_confirmation_token,'confirmed');
 let entered,release;
 const atBarrier=new Promise(r=>entered=r),resume=new Promise(r=>release=r);
 const guarded={...database,programmerEnvoiImageFinaleSiLibre:async(...args)=>{entered();await resume;return database.programmerEnvoiImageFinaleSiLibre(...args);}};
 const pending=route('app/api/orders/send-final-image/route.ts',{'@/lib/db':guarded}).POST(request({...body(),saveOnly:true}));
 await atBarrier;
 await database.updateOrderFinalImage(id,otherImage);
 release();
 const response=await pending;
 assert.equal(response.status,409);
 const saved=await database.getOrderById(id);
 assert.equal(saved.final_image_url,otherImage);assert.equal(saved.poster_confirmation_status,null);
 assert.equal(saved.final_image_scheduled_at,null);assert.equal(sends.length,1);
});
test('automatic scheduling binds buyer, options and physical approval to the saved portrait',async()=>{
 await route('app/api/orders/send-poster-confirmation/route.ts').POST(request(body()));
 await database.recordPosterConfirmationResponse((await database.getOrderById(id)).poster_confirmation_token,'confirmed');
 const snapshot=await database.getOrderById(id),date=new Date('2099-12-31T09:00:00Z');
 for(const mutation of [
  ()=>db`UPDATE orders SET customer_email='changed@example.invalid' WHERE id=${id}`,
  ()=>db`UPDATE orders SET options='{"printKey":"digital"}'::jsonb WHERE id=${id}`,
  ()=>db`UPDATE orders SET poster_confirmation_image_url=${otherImage} WHERE id=${id}`,
  ()=>db`UPDATE orders SET poster_confirmation_email='changed@example.invalid' WHERE id=${id}`,
  ()=>db`UPDATE orders SET poster_confirmation_status='changes_requested' WHERE id=${id}`,
 ]) {
  await mutation();
  assert.equal(await database.programmerEnvoiImageFinaleSiLibre(id,date,snapshot),null);
  assert.equal((await database.getOrderById(id)).final_image_scheduled_at,null);
  await db`UPDATE orders SET customer_email=${snapshot.customer_email},options=${db.json(snapshot.options)},poster_confirmation_image_url=${image},poster_confirmation_email=${snapshot.customer_email},poster_confirmation_status='confirmed' WHERE id=${id}`;
 }
 assert.equal((await database.programmerEnvoiImageFinaleSiLibre(id,date,snapshot)).toISOString(),date.toISOString());
 const later=new Date('2100-01-02T09:00:00Z');
 assert.equal((await database.programmerEnvoiImageFinaleSiLibre(id,later,snapshot)).toISOString(),date.toISOString(),'identical save preserves an existing schedule');
});
test('automatic digital gift scheduling preserves its date without requiring physical approval',async()=>{
 await db`UPDATE orders SET options=${db.json({printKey:'digital',gift:{recipientEmail:'gift@example.invalid',deliverAfter:'2099-12-31'}})} WHERE id=${id}`;
 const response=await route('app/api/orders/send-final-image/route.ts').POST(request({...body(),saveOnly:true}));
 assert.equal(response.status,200);assert.equal((await response.json()).scheduledAt,'2099-12-31T09:00:00.000Z');
 const saved=await database.getOrderById(id);
 assert.equal(saved.final_image_scheduled_at.toISOString(),'2099-12-31T09:00:00.000Z');assert.equal(saved.poster_confirmation_status,null);assert.equal(sends.length,0);
});
test('admin browser replaces confirmed A with canonical unapproved B and offers a fresh invitation',async()=>{
 const {build}=await import('esbuild');const {chromium}=await import('playwright');
 const bundle=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',plugins:[{name:'synthetic-upload',setup(b){b.onLoad({filter:/lib\/uploadClient\.ts$/},()=>({loader:'js',contents:`export async function uploadImage(){return {url:${JSON.stringify(otherImage)}}}` }));}}],stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Admin from './app/[locale]/admin/page';createRoot(document.getElementById('root')).render(<Admin/>);`}});
 await route('app/api/orders/send-poster-confirmation/route.ts').POST(request(body()));
 await database.recordPosterConfirmationResponse((await database.getOrderById(id)).poster_confirmation_token,'confirmed');
 await db`UPDATE orders SET final_image_scheduled_at='2099-12-31T09:00:00Z' WHERE id=${id}`;
 const browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(4000);
 let rejectUpload=true;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async interception=>{
  const req=interception.request(),url=new URL(req.url());if(url.origin!=='https://admin.invalid')return interception.abort();
  if(url.pathname==='/')return interception.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
  if(url.pathname==='/api/admin/auth')return interception.fulfill({status:204});
  if(url.pathname==='/api/orders')return interception.fulfill({json:[{created_at:'2026-10-01T10:00:00Z',amount_total:5000,currency:'eur',status:'PAID',photo_urls:[],...await database.getOrderById(id)}]});
  if(url.pathname==='/api/orders/send-final-image'){
   if(rejectUpload){rejectUpload=false;return interception.fulfill({status:409,json:{error:'synthetic save conflict'}});}
   const response=await route('app/api/orders/send-final-image/route.ts').POST(request(req.postDataJSON()));
   return interception.fulfill({status:response.status,json:await response.json()});
  }
  return interception.fulfill({json:[]});
 });
 try {
  await page.goto('https://admin.invalid/');await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.getByRole('row').filter({hasText:'buyer@example.invalid'}).click();
  await page.getByText(/Client a confirmé le/).waitFor();
  const rejected=new Promise(resolve=>page.once('dialog',async dialog=>{const text=dialog.message();await dialog.dismiss();resolve(text);}));
  await page.locator('input[type=file]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:png});
  assert.match(await rejected,/synthetic save conflict/);
  await page.getByRole('button',{name:'Remplacer',exact:true}).waitFor();
  assert.equal(await page.locator('img[alt="Image finale"]').getAttribute('src'),image);
  assert.equal(await page.getByText(/Client a confirmé le/).count(),1);
  await page.locator('input[type=file]').setInputFiles([]);
  await page.locator('input[type=file]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(url=>document.querySelector('img[alt="Image finale"]')?.getAttribute('src')===url,otherImage);
  assert.equal(await page.getByText(/Client a confirmé le/).count(),0);
  assert.equal(await page.getByText(/Envoi programmé le/).count(),0);
  await page.getByText(/Tirage physique — faites valider/).waitFor();
  assert.equal(await page.getByRole('button',{name:'📮 Envoyer pour confirmation avant impression',exact:true}).isEnabled(),true);
  let warning='';page.once('dialog',async dialog=>{warning=dialog.message();await dialog.dismiss();});
  await page.getByRole('button',{name:'Envoyer au client',exact:true}).click();
  assert.match(warning,/pas encore validé/);assert.deepEqual(errors,[]);
 }catch(e){console.log('BROWSER',await page.locator('body').innerText(),errors);throw e;}finally{await browser.close();}
});
test('deployment migration invalidates unversioned legacy links instead of inventing sent-image history',async()=>{
 await db`UPDATE orders SET poster_confirmation_token='legacy-synthetic' WHERE id=${id}`;
 const migration=readFileSync(new URL('../migrations/20261025_order_notification_versions.sql',import.meta.url),'utf8');
 await db.unsafe(migration);
 assert.equal((await database.getOrderById(id)).poster_confirmation_token,null);
 await route('app/api/orders/send-poster-confirmation/route.ts').POST(request(body()));
 const token=(await database.getOrderById(id)).poster_confirmation_token;
 await db.unsafe(migration);
 assert.equal((await database.getOrderById(id)).poster_confirmation_token,token,'reapplying migration preserves versioned links');
});
test('local schema bootstrap upgrades legacy invitations without an explicit migration',async()=>{
 // Destructive legacy DDL belongs to its own schema and connection pool. Keeping
 // public.orders stable also preserves the real prepared SELECT * plans used by
 // the notification/response tests before and after this bootstrap regression.
 await db`CREATE SCHEMA notification_legacy`;
 const legacyDb=postgres(process.env.DATABASE_URL,{connection:{search_path:'notification_legacy'},onnotice(){}});
 try {
  await legacyDb`CREATE TABLE orders (LIKE public.orders INCLUDING ALL)`;
  await legacyDb`INSERT INTO orders SELECT * FROM public.orders`;
  await legacyDb`UPDATE orders SET poster_confirmation_token='legacy-synthetic' WHERE id=${id}`;
  await legacyDb`ALTER TABLE orders DROP COLUMN poster_confirmation_image_url,DROP COLUMN poster_confirmation_email,DROP COLUMN poster_confirmation_message_id`;
  delete process.env.VERCEL;
  const local=load('lib/db.ts',{'postgres':()=>legacyDb});
  const saved=await local.getOrderByConfirmationToken('legacy-synthetic');
  assert.equal(saved,null,'a legacy message has no proven image version and must not display a guessed portrait');
  assert.equal((await local.getOrderById(id)).poster_confirmation_token,null);
 } finally {
  process.env.VERCEL='1';
  await legacyDb.end({timeout:2});
  await db`DROP SCHEMA notification_legacy CASCADE`;
 }
});
test('order notification routes await the asynchronous admin guard before reading or sending',async()=>{
 for(const file of ['app/api/orders/send-poster-confirmation/route.ts','app/api/orders/send-final-image/route.ts','app/api/orders/review-request/route.ts']) {
  const r=await route(file,{'@/lib/adminAuth':{requireAdmin:async()=>null,refuserSiPasAdmin:async()=>null}}).POST(request({...body(),customerEmail:'foreign@example.invalid'}));
  assert.equal(r.status,409,file);
 }
});
test('delivery refuses a portrait changed during its final download before provider submission',async()=>{
 await db`UPDATE orders SET options='{}'::jsonb WHERE id=${id}`;
 const input=await database.getOrderById(id);
 duringDownload=async()=>{await database.updateOrderFinalImage(id,otherImage);};
 await assert.rejects(route('lib/emailImageFinale.ts',{'@/lib/parrainage':{infosParrainage:async()=>null}}).envoyerImageFinale(input),e=>e.status===409);
 assert.equal(sends.length,0);assert.equal((await database.getOrderById(id)).final_image_sent_at,null);
});
test('manual delivery does not overwrite a portrait replaced while validation downloads',async()=>{
 duringDownload=async()=>{await db`UPDATE orders SET final_image_url=${otherImage} WHERE id=${id}`;};
 const r=await route('app/api/orders/send-final-image/route.ts').POST(request(body()));
 assert.equal(r.status,409);assert.equal(sends.length,0);assert.equal((await database.getOrderById(id)).final_image_url,otherImage);
});
test('delivery helper rejects stale image or buyer rather than sending an unseen version',async()=>{
 for(const change of [{final_image_url:otherImage},{customer_email:'foreign@example.invalid'}]) {
  const input={...await database.getOrderById(id),...change};
  await assert.rejects(route('lib/emailImageFinale.ts').envoyerImageFinale(input),e=>e.status===409);
 }
 assert.equal(sends.length,0);assert.equal(downloads,0);
});
test('delivery helper reloads canonical gift policy instead of trusting a stale caller snapshot',async()=>{
 const input=await database.getOrderById(id);input.options={printKey:'digital'};
 await assert.rejects(route('lib/emailImageFinale.ts').envoyerImageFinale(input),e=>e.status===409);
 assert.equal((await database.getOrderById(id)).final_image_scheduled_at,null,'unapproved physical gift is not scheduled');
 await db`UPDATE orders SET poster_confirmation_status='confirmed',poster_confirmation_image_url=final_image_url,poster_confirmation_email=customer_email WHERE id=${id}`;
 const result=await route('lib/emailImageFinale.ts').envoyerImageFinale(input);
 assert.equal(sends.length,0);assert.equal(downloads,0);assert.equal(result.deferredUntil,'2099-12-31T09:00:00.000Z');
});
test('delivery and review refuse divergent client email assertions',async()=>{
 for(const file of ['app/api/orders/send-final-image/route.ts','app/api/orders/review-request/route.ts']) {
  const r=await route(file,{'@/lib/reviewsDb':{avisExistePourCommande:async()=>false}}).POST(request({...body(),customerEmail:'foreign@example.invalid'}));
  assert.equal(r.status,409,file);assert.equal(downloads,0);assert.equal(sends.length,0);
 }
});
test('manual delivery refuses an unsaved image instead of overwriting the canonical portrait',async()=>{
 const r=await route('app/api/orders/send-final-image/route.ts').POST(request({...body(),finalImageUrl:otherImage}));
 assert.equal(r.status,409);assert.equal(downloads,0);assert.equal(sends.length,0);
 assert.equal((await database.getOrderById(id)).final_image_url,image);
});
test('out-of-band image change fails closed on preview lookup and response too',async()=>{
 await route('app/api/orders/send-poster-confirmation/route.ts').POST(request(body()));
 const token=(await database.getOrderById(id)).poster_confirmation_token;
 await db`UPDATE orders SET final_image_url=${otherImage} WHERE id=${id}`;
 assert.equal(await database.getOrderByConfirmationToken(token),null);
 assert.equal((await database.recordPosterConfirmationResponse(token,'confirmed')).order,null);
});
test('replacing a portrait invalidates old invitation and confirmation; saving same image preserves it',async()=>{
 await route('app/api/orders/send-poster-confirmation/route.ts').POST(request(body()));
 const token=(await database.getOrderById(id)).poster_confirmation_token;
 await database.recordPosterConfirmationResponse(token,'confirmed');
 await database.updateOrderFinalImage(id,image);
 assert.ok(await database.getOrderByConfirmationToken(token));
 await database.updateOrderFinalImage(id,otherImage);
 assert.equal(await database.getOrderByConfirmationToken(token),null);
 assert.equal((await database.recordPosterConfirmationResponse(token,'confirmed')).order,null);
 const saved=await database.getOrderById(id);
 assert.equal(saved.poster_confirmation_status,null);assert.equal(saved.poster_confirmation_token,null);
});
test('preview binds buyer, saved identity and image version to email and token page even for future gifts',async()=>{
 const r=await route('app/api/orders/send-poster-confirmation/route.ts').POST(request({...body(),customerName:'Forged Name',orderRef:'FORGEDREF',detectedCountry:'DE'}));
 assert.equal(r.status,200);
 const saved=await database.getOrderById(id), mail=sends[0];
 assert.deepEqual(mail.to,['buyer@example.invalid']);assert.match(mail.html,/Saved Buyer/);assert.doesNotMatch(mail.html,/Forged Name|FORGEDREF|gift@example.invalid/);
 assert.equal(saved.poster_confirmation_image_url,image);
 assert.equal(saved.poster_confirmation_email,'buyer@example.invalid');
 assert.equal(saved.poster_confirmation_message_id,'captured-message');
 assert.match(mail.html,new RegExp(saved.poster_confirmation_token));
 assert.equal((await database.getOrderByConfirmationToken(saved.poster_confirmation_token)).final_image_url,image);
 assert.deepEqual(Buffer.from(mail.attachments[0].content,'base64'),png);
});
test('preview refuses a divergent image before fetch or invitation',async()=>{
 const r=await route('app/api/orders/send-poster-confirmation/route.ts').POST(request({...body(),finalImageUrl:otherImage}));
 assert.equal(r.status,409);assert.equal(downloads,0);assert.equal(sends.length,0);
 assert.equal((await database.getOrderById(id)).poster_confirmation_token,null);
});
test('preview refuses a divergent buyer email before image fetch, token or provider',async()=>{
 const r=await route('app/api/orders/send-poster-confirmation/route.ts').POST(request({...body(),customerEmail:'foreign@example.invalid'}));
 assert.equal(r.status,409);assert.equal(downloads,0);assert.equal(sends.length,0);
 assert.equal((await database.getOrderById(id)).poster_confirmation_token,null);
});
