import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {execFileSync} from 'node:child_process';
import postgres from 'postgres';
import {load} from './upload-harness.mjs';
import {MockAgent,getGlobalDispatcher,setGlobalDispatcher} from 'undici';
const previousDispatcher=getGlobalDispatcher(), offline=new MockAgent();
offline.disableNetConnect();setGlobalDispatcher(offline);
globalThis.fetch=async()=>{throw new Error('External transport forbidden in photo validation tests');};
const runtime=mkdtempSync(path.join(tmpdir(),'photo-validation-'));
const bin='/usr/lib/postgresql/18/bin';
const pg=(cmd,args)=>execFileSync(path.join(bin,cmd),args,{env:process.env,timeout:15000,stdio:'pipe'});
const origin='https://synthetic.public.blob.vercel-storage.com';
const id='12345678-1234-1234-1234-123456789abc';
const other='22345678-1234-1234-1234-123456789abc';
process.env.BLOB_READ_WRITE_TOKEN='vercel_blob_rw_synthetic_localonly';
process.env.NEWSLETTER_SECRET='synthetic-photo-validation-secret';
process.env.VERCEL='1';
let db, started, database, photosRoute, posterRoute, signed, policy;
let effects=0;
const noEffect=async()=>{effects++;};
const request=body=>new Request('http://localhost/api/orders/photos',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
before(async()=>{
 const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
 pg('initdb',['-D',path.join(runtime,'pg'),'-U','photo_test','--auth=trust','--no-locale']);
 pg('pg_ctl',['-D',path.join(runtime,'pg'),'-l',path.join(runtime,'pg.log'),'-o',`-h 127.0.0.1 -p ${port} -k ''`,'-w','start']);started=true;
 process.env.DATABASE_URL=`postgresql://photo_test@127.0.0.1:${port}/postgres`;
 db=postgres(process.env.DATABASE_URL,{onnotice(){}});
 await db.unsafe(readFileSync(new URL('../migrations/20261025_upload_quotas.sql',import.meta.url),'utf8'));
 await db`CREATE TABLE orders(id uuid PRIMARY KEY, photo_urls jsonb DEFAULT '[]',customer_email text DEFAULT 'synthetic@example.invalid',created_at timestamptz DEFAULT now(),paid_at timestamptz DEFAULT now(),poster_confirmation_token text,poster_confirmation_status text,poster_confirmation_responded_at timestamptz,poster_confirmation_note text,poster_confirmation_photos jsonb, options jsonb DEFAULT '{}')`;
 await db`ALTER TABLE orders ADD COLUMN last_outbound_message_id text`;
 await db`ALTER TABLE orders ADD COLUMN final_image_url text DEFAULT 'https://synthetic.public.blob.vercel-storage.com/final/photo-fixture.png'`;
 await db.unsafe(readFileSync(new URL('../migrations/20261025_order_notification_versions.sql',import.meta.url),'utf8'));
 await db`INSERT INTO orders(id,poster_confirmation_token,poster_confirmation_image_url,poster_confirmation_email)
   VALUES (${id},'poster-own','https://synthetic.public.blob.vercel-storage.com/final/photo-fixture.png','synthetic@example.invalid'),
          (${other},'poster-other','https://synthetic.public.blob.vercel-storage.com/final/photo-fixture.png','synthetic@example.invalid')`;
 const client=new Proxy(db,{get:(target,key)=>key==='end'?async()=>{}:Reflect.get(target,key)});
 database=load('lib/db.ts',{'postgres':()=>client});
 signed=load('lib/emailToken.ts').orderTrackingToken(id);
 policy=load('lib/uploadPolicy.ts',{'@/lib/db':database});
 // Both route and ownership helper use the same real SQL against disposable PG.
 const ownership=()=>load('lib/photoOwnership.ts',{'@/lib/db':database});
 const deps={'@/lib/db':database,'@/lib/analyticsServeur':{mesureServeur:noEffect},'@/lib/discord':{alerteDiscord:noEffect,COULEUR_SOLEIL:0},'@/lib/alerteServeur':{signalerPanne:async()=>{}}};
 // Lazy loading allows the RED test to exercise the old route before the helper exists.
 Object.defineProperty(deps,'@/lib/photoOwnership',{get:ownership});
 photosRoute=load('app/api/orders/photos/route.ts',deps);
 await db`CREATE TABLE retouches(id serial PRIMARY KEY,order_id uuid REFERENCES orders(id),note text,photos jsonb,demandee_le timestamptz DEFAULT now())`;
 const retouches=load('lib/retouches.ts',{'./db':database});
 deps['@/lib/retouches']=retouches;
 deps['@/lib/envoiEmail']={envoyerEmail:async()=>{effects++;return {data:{id:'synthetic'}};}};
 posterRoute=load('app/api/orders/confirm-poster/route.ts',deps);
});
after(async()=>{try{if(db)await db.end({timeout:2});}finally{if(started)pg('pg_ctl',['-D',path.join(runtime,'pg'),'-m','fast','-w','stop']);rmSync(runtime,{recursive:true,force:true});setGlobalDispatcher(previousDispatcher);await offline.close();}});
async function reserved(purpose,orderId=id){
 const token=purpose==='depot'?load('lib/emailToken.ts').orderTrackingToken(orderId):orderId===id?'poster-own':'poster-other';
 const req=new Request('http://localhost/api/upload',{headers:{origin:'http://localhost','x-vercel-forwarded-for':'192.0.2.10'}});
 const c=await policy.createUploadContext(req,{purpose,token});
 await policy.reserveUpload(req,`${c.prefix}photo.jpg`,c.context);
 return origin+'/'+c.prefix+'photo.jpg';
}
test('checkout context sets an opaque HttpOnly session, not shared by browsers behind one IP',async()=>{
 const {POST}=load('app/api/upload/context/route.ts',{'@/lib/uploadPolicy':policy});
 const issue=async(cookie)=>POST(new Request('https://localhost/api/upload/context',{method:'POST',headers:{origin:'https://localhost','content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify({purpose:'checkout',product:'simpson'})}));
 const a=await issue(), b=await issue();
 assert.equal(a.status,200);assert.equal(b.status,200);
 const ca=a.headers.get('set-cookie'),cb=b.headers.get('set-cookie');
 assert.ok(ca,'checkout must establish a browser-specific session');
 assert.match(ca,/HttpOnly/i);assert.match(ca,/Secure/i);assert.match(ca,/SameSite=Strict/i);assert.match(ca,/Path=\//i);
 assert.notEqual(ca.split(';')[0],cb.split(';')[0]);
 const first=await a.json(),second=await b.json();
 const ra=new Request('https://localhost/api/upload',{headers:{origin:'https://localhost',cookie:ca.split(';')[0]}});
 const rb=new Request('https://localhost/api/upload',{headers:{origin:'https://localhost',cookie:cb.split(';')[0]}});
 await assert.rejects(policy.reserveUpload(rb,first.prefix+'stolen.jpg',first.context),e=>e.status===403);
 await policy.reserveUpload(ra,first.prefix+'own.jpg',first.context);
 const rows=await db`SELECT subject,ip_hash FROM upload_contexts WHERE prefix IN ${db([first.prefix,second.prefix])}`;
 assert.equal(rows[0].ip_hash,rows[1].ip_hash);assert.notEqual(rows[0].subject,rows[1].subject);
 const repeat=await issue(ca.split(';')[0]);assert.equal(repeat.status,200);
 const again=await repeat.json();
 assert.equal((await db`SELECT subject FROM upload_contexts WHERE prefix=${again.prefix}`)[0].subject,(await db`SELECT subject FROM upload_contexts WHERE prefix=${first.prefix}`)[0].subject);
});
test('signed depot rejects a reserved object owned by a different order without write or notification',async()=>{
 const foreign=await reserved('depot',other);
 const r=await photosRoute.POST(request({token:signed,photoUrls:[foreign]}));
 assert.equal(r.status,403);
 assert.match((await r.json()).error,/appartient|autoris/i);
 assert.deepEqual((await db`SELECT photo_urls FROM orders WHERE id=${id}`)[0].photo_urls,[]);
 assert.equal(effects,0);
});
test('poster changes reject a foreign reservation before confirmation, history or email',async()=>{
 const foreign=await reserved('poster',other);
 const prior=effects;
 const r=await posterRoute.POST(request({token:'poster-own',action:'changes',photos:[foreign],note:'Synthetic correction'}));
 assert.equal(r.status,403);
 assert.equal((await db`SELECT poster_confirmation_status FROM orders WHERE id=${id}`)[0].poster_confirmation_status,null);
 assert.equal((await db`SELECT count(*)::int n FROM retouches`)[0].n,0);
 assert.equal(effects,prior);
});
test('depot accepts its own reserved objects after context expiry, deduplicates and persists exact URLs',async()=>{
 const own=await reserved('depot');
 await db`UPDATE upload_contexts SET expires_at=now()-interval '1 day'`;
 const r=await photosRoute.POST(request({token:signed,photoUrls:[own,own]}));
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,photos:1});
 assert.deepEqual((await db`SELECT photo_urls FROM orders WHERE id=${id}`)[0].photo_urls,[own]);
 const repeat=await photosRoute.POST(request({token:signed,photoUrls:[own]}));
 assert.equal(repeat.status,200);
});
test('depot preserves exact existing legacy photos, not unbound or another order legacy objects',async()=>{
 const legacy=origin+'/orders/1792890000000-famille%20%C3%A9t%C3%A9-Ab12cd.jpg';
 await db`UPDATE orders SET photo_urls=${JSON.stringify([legacy])}::text::jsonb WHERE id=${id}`;
 const r=await photosRoute.POST(request({token:signed,photoUrls:[legacy]}));assert.equal(r.status,200);
 for(const foreign of [origin+'/orders/unattached.jpg',origin+'/retouches/unattached.jpg']){
  const rejected=await photosRoute.POST(request({token:signed,photoUrls:[foreign]}));assert.equal(rejected.status,403);
 }
 const foreign=await photosRoute.POST(request({token:load('lib/emailToken.ts').orderTrackingToken(other),photoUrls:[legacy]}));assert.equal(foreign.status,403);
 assert.deepEqual((await db`SELECT photo_urls FROM orders WHERE id=${id}`)[0].photo_urls,[legacy]);
});
test('invalid photo input and overflow on both routes never change stored data',async()=>{
 const before=(await db`SELECT * FROM orders WHERE id=${id}`)[0];const prior=effects;
 const many=Array.from({length:9},(_,i)=>origin+`/orders/a${i}.jpg`);
 for(const photos of [['https://'],['https://evil.invalid/orders/x.jpg'],['data:image/png;base64,x'],[{}],{},many]) {
  assert.equal((await photosRoute.POST(request({token:signed,photoUrls:photos}))).status,400);
  assert.equal((await posterRoute.POST(request({token:'poster-own',action:'changes',photos}))).status,400);
 }
 assert.deepEqual((await db`SELECT * FROM orders WHERE id=${id}`)[0],before);assert.equal(effects,prior);
 assert.equal((await photosRoute.POST(request({token:'forged',photoUrls:[]}))).status,403);
 assert.equal((await photosRoute.POST(request({token:signed,photoUrls:[]}))).status,400);
});
test('poster accepts owned reservation; real SQL preserves idempotency and stale response conflicts',async()=>{
 const own=await reserved('poster');
 const body={token:'poster-own',action:'changes',photos:[own,own],note:'Synthetic correction'};
 const r=await posterRoute.POST(request(body));assert.equal(r.status,200);assert.equal((await r.json()).changed,true);
 const row=(await db`SELECT * FROM orders WHERE id=${id}`)[0];
 assert.deepEqual(row.poster_confirmation_photos,[own]);
 assert.deepEqual((await db`SELECT photos FROM retouches WHERE order_id=${id}`)[0].photos,[own]);
 const again=await posterRoute.POST(request(body));assert.equal(again.status,200);assert.equal((await again.json()).changed,false);
 const conflict=await posterRoute.POST(request({...body,note:'Changed without version'}));assert.equal(conflict.status,409);
 assert.equal((await db`SELECT count(*)::int n FROM retouches WHERE order_id=${id}`)[0].n,1);
});
test('poster retains legacy attachments bound to the same order but rejects new legacy and wrong purpose',async()=>{
 const legacy=origin+'/retouches/1792890000000-old%20image-Ab12cd.png';
 await db`UPDATE orders SET poster_confirmation_photos=${JSON.stringify([legacy])}::text::jsonb,poster_confirmation_responded_at=NULL WHERE id=${id}`;
 const accepted=await posterRoute.POST(request({token:'poster-own',action:'changes',photos:[legacy]}));assert.equal(accepted.status,200);
 for(const url of [origin+'/retouches/unattached.png',await reserved('depot'),await reserved('poster',other)]) {
  const r=await posterRoute.POST(request({token:'poster-own',action:'changes',photos:[url]}));assert.equal(r.status,403);
 }
 assert.equal((await posterRoute.POST(request({token:'forged',action:'changes',photos:[legacy]}))).status,404);
});
test('ownership ledger SQL outage fails closed on both real routes without writes or email',async()=>{
 const own=await reserved('depot'), poster=await reserved('poster');
 const before=(await db`SELECT * FROM orders WHERE id=${id}`)[0], prior=effects;
 await db`ALTER TABLE upload_reservations RENAME TO upload_reservations_unavailable`;
 try {
  assert.equal((await photosRoute.POST(request({token:signed,photoUrls:[own]}))).status,500);
  assert.equal((await posterRoute.POST(request({token:'poster-own',action:'changes',photos:[poster]}))).status,500);
  assert.deepEqual((await db`SELECT * FROM orders WHERE id=${id}`)[0],before);assert.equal(effects,prior);
 }finally{await db`ALTER TABLE upload_reservations_unavailable RENAME TO upload_reservations`;}
});
test('poster confirmation and note-only changes remain valid without photos or storage credentials',async()=>{
 await db`UPDATE orders SET poster_confirmation_responded_at=NULL WHERE id=${other}`;
 const previous=process.env.BLOB_READ_WRITE_TOKEN;delete process.env.BLOB_READ_WRITE_TOKEN;
 try {
  const r=await posterRoute.POST(request({token:'poster-other',action:'changes',note:'Only a note'}));assert.equal(r.status,200);
  await db`UPDATE orders SET poster_confirmation_responded_at=NULL WHERE id=${other}`;
  const confirm=await posterRoute.POST(request({token:'poster-other',action:'confirm'}));assert.equal(confirm.status,200);
 }finally{process.env.BLOB_READ_WRITE_TOKEN=previous;}
});
for (const purpose of ['depot','poster']) {
 test(`${purpose} retains exact attached legacy punctuation but cannot adopt it`,async()=>{
  const namespace=purpose==='depot'?'orders':'retouches';
  const urls=['famille+amis','famille,amis',"famille'amis",'famille%20%C3%A9t%C3%A9+amis'].map(name=>`${origin}/${namespace}/1792890000000-${name}-Ab12cd.jpg`);
  const send=(token,photos)=>purpose==='depot'
   ? photosRoute.POST(request({token,photoUrls:photos}))
   : posterRoute.POST(request({token,action:'changes',photos,note:'Synthetic legacy punctuation retention'}));
  const ownToken=purpose==='depot'?signed:'poster-own';
  const otherToken=purpose==='depot'?load('lib/emailToken.ts').orderTrackingToken(other):'poster-other';
  if(purpose==='depot') await db`UPDATE orders SET photo_urls=${JSON.stringify(urls)}::text::jsonb WHERE id=${id}`;
  else await db`UPDATE orders SET poster_confirmation_photos=${JSON.stringify(urls)}::text::jsonb,poster_confirmation_responded_at=NULL WHERE id=${id}`;
  const accepted=await send(ownToken,[...urls,urls[0]]);
  assert.equal(accepted.status,200,JSON.stringify(await accepted.json()));
  const saved=(await db`SELECT * FROM orders WHERE id=${id}`)[0];
  assert.deepEqual(purpose==='depot'?saved.photo_urls:saved.poster_confirmation_photos,urls);
  if(purpose==='poster') assert.deepEqual((await db`SELECT photos FROM retouches WHERE order_id=${id} ORDER BY id DESC LIMIT 1`)[0].photos,urls);
  const before=(await db`SELECT * FROM orders ORDER BY id`), prior=effects;
  const history=(await db`SELECT * FROM retouches ORDER BY id`);
  for(const url of urls) {
   assert.ok([400,403].includes((await send(otherToken,[url])).status),'another order must not adopt legacy');
   assert.ok([400,403].includes((await send(ownToken,[url.replace('1792890000000','1792890000001')])).status),'unattached legacy must fail');
   assert.ok([400,403].includes((await send(ownToken,[` ${url} `])).status),'exception requires exact raw URL');
  }
  assert.deepEqual(await db`SELECT * FROM orders ORDER BY id`,before);
  assert.deepEqual(await db`SELECT * FROM retouches ORDER BY id`,history);assert.equal(effects,prior);
 });
 test(`${purpose} rejects ambiguous or foreign-origin URLs even when already attached`,async()=>{
  const namespace=purpose==='depot'?'orders':'retouches';
  const base=`${origin}/${namespace}/1792890000000-photo.jpg`;
  const invalid=[base+'?',base+'#',base+'?x=1',base+'#x',base.replace('https:','http:'),base.replace('synthetic.public','foreign.public'),base.replace('/179','/../'+namespace+'/179'),base.replace('photo.jpg','a%2fb.jpg'),base.replace('photo.jpg','a%5cb.jpg'),base.replace('photo.jpg','a%252fb.jpg'),base.replace('photo.jpg','a%3fb.jpg'),base.replace('photo.jpg','a%00b.jpg'),base.replace('photo.jpg','a%23b.jpg')];
  if(purpose==='depot') await db`UPDATE orders SET photo_urls=${JSON.stringify(invalid)}::text::jsonb WHERE id=${id}`;
  else await db`UPDATE orders SET poster_confirmation_photos=${JSON.stringify(invalid)}::text::jsonb,poster_confirmation_responded_at=NULL WHERE id=${id}`;
  const before=await db`SELECT * FROM orders ORDER BY id`,history=await db`SELECT * FROM retouches ORDER BY id`,prior=effects;
  for(const url of invalid) {
   const r=purpose==='depot'?await photosRoute.POST(request({token:signed,photoUrls:[url]})):await posterRoute.POST(request({token:'poster-own',action:'changes',photos:[url]}));
   assert.equal(r.status,400,url);
  }
  assert.deepEqual(await db`SELECT * FROM orders ORDER BY id`,before);
  assert.deepEqual(await db`SELECT * FROM retouches ORDER BY id`,history);assert.equal(effects,prior);
 });
}
test('order authentication precedes parsing or any legacy exception',async()=>{
 for(const photos of [['https://'],[origin+'/orders/1792890000000-famille+amis.jpg']]) {
  assert.equal((await photosRoute.POST(request({token:'forged',photoUrls:photos}))).status,403);
  const missing=load('lib/emailToken.ts').orderTrackingToken('32345678-1234-1234-1234-123456789abc');
  assert.equal((await photosRoute.POST(request({token:missing,photoUrls:photos}))).status,404);
  assert.equal((await posterRoute.POST(request({token:'forged',action:'changes',photos}))).status,404);
 }
});
