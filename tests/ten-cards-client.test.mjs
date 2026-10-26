import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {load} from './upload-harness.mjs';
const runtime=mkdtempSync(path.join(tmpdir(),'client-flow-'));
const bin='/usr/lib/postgresql/18/bin';
const pg=(cmd,args)=>execFileSync(path.join(bin,cmd),args,{env:process.env,timeout:15000,stdio:'pipe'});
const origin='https://synthetic.public.blob.vercel-storage.com';
const id='12345678-1234-1234-1234-123456789abc';
process.env.BLOB_READ_WRITE_TOKEN='vercel_blob_rw_synthetic_localonly';
process.env.NEWSLETTER_SECRET='synthetic-client-flow-secret';
process.env.VERCEL='1';
globalThis.fetch=async()=>{throw new Error('External transport forbidden');};
let db,started,database,photosRoute,posterRoute,signed,reviewsRoute;
let effects=0, emails=[];
const request=body=>new Request('http://localhost/api/local',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.'+(++request.n)},body:JSON.stringify(body)});request.n=0;
before(async()=>{
 const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
 pg('initdb',['-D',path.join(runtime,'pg'),'-U','client_test','--auth=trust','--no-locale','--encoding=UTF8']);
 pg('pg_ctl',['-D',path.join(runtime,'pg'),'-l',path.join(runtime,'pg.log'),'-o',`-h 127.0.0.1 -p ${port} -k ''`,'-w','start']);started=true;
 process.env.DATABASE_URL=`postgresql://client_test@127.0.0.1:${port}/postgres`;
 db=postgres(process.env.DATABASE_URL,{onnotice(){}});
 await db.unsafe(readFileSync(new URL('../migrations/20261025_upload_quotas.sql',import.meta.url),'utf8'));
 await db`CREATE TABLE orders(id uuid PRIMARY KEY, photo_urls jsonb DEFAULT '[]',customer_email text DEFAULT 'synthetic@example.invalid',customer_name text,created_at timestamptz DEFAULT now(),paid_at timestamptz DEFAULT now(),status text DEFAULT 'PAID',final_image_url text,final_image_sent_at timestamptz,expedie_le timestamptz,poster_confirmation_token text,poster_confirmation_sent_at timestamptz,poster_confirmation_status text,poster_confirmation_responded_at timestamptz,poster_confirmation_note text,poster_confirmation_photos jsonb, options jsonb DEFAULT '{}',last_outbound_message_id text,detected_country text)`;
 await db.unsafe(readFileSync(new URL('../migrations/20261025_order_notification_versions.sql',import.meta.url),'utf8'));
 await db`CREATE TABLE retouches(id serial PRIMARY KEY,order_id uuid REFERENCES orders(id),note text,photos jsonb,demandee_le timestamptz DEFAULT now())`;
 await db`CREATE TABLE reviews(id serial PRIMARY KEY, order_id text UNIQUE,auteur text,locale text,note int,texte text,verifie boolean,statut text,modere_le timestamptz,cree_le timestamptz DEFAULT now())`;
 const client=new Proxy(db,{get:(target,key)=>key==='end'?async()=>{}:Reflect.get(target,key)});
 database=load('lib/db.ts',{'postgres':()=>client});
 signed=load('lib/emailToken.ts').orderTrackingToken(id);
 const deps={'@/lib/db':database,'@/lib/photoOwnership':load('lib/photoOwnership.ts',{'@/lib/db':database}),'@/lib/analyticsServeur':{mesureServeur:async()=>{effects++;}},'@/lib/discord':{alerteDiscord:async()=>{effects++;},COULEUR_SOLEIL:0},'@/lib/alerteServeur':{signalerPanne:async()=>{}},'@/lib/retouches':load('lib/retouches.ts',{'./db':database}),'@/lib/envoiEmail':{envoyerEmail:async m=>{emails.push(m);return {data:{id:'synthetic'}};}}};
 photosRoute=load('app/api/orders/photos/route.ts',deps);
 posterRoute=load('app/api/orders/confirm-poster/route.ts',deps);
 reviewsRoute=load('app/api/reviews/route.ts',{'@/lib/db':database,'@/lib/reviewsDb':load('lib/reviewsDb.ts',{'./db':database}),'@/lib/recompenseAvis':{recompenserAvis:async()=>{effects++;}},'next/cache':{revalidateTag:()=>{effects++;}}});
});
after(async()=>{try{if(db)await db.end({timeout:2});}finally{if(started)pg('pg_ctl',['-D',path.join(runtime,'pg'),'-m','fast','-w','stop']);rmSync(runtime,{recursive:true,force:true});}});
beforeEach(async()=>{await db`DELETE FROM retouches`;await db`DELETE FROM reviews`;await db`DELETE FROM orders`;await db`INSERT INTO orders(id) VALUES (${id})`;effects=0;emails=[];});
const photo=n=>`${origin}/orders/legacy-${n}.jpg`;
async function attach(urls){await db`UPDATE orders SET photo_urls=${JSON.stringify(urls)}::text::jsonb WHERE id=${id}`;}
async function preview(){await db`UPDATE orders SET final_image_url=${origin+'/final/fixture.png'},poster_confirmation_token='preview',poster_confirmation_sent_at=now(),poster_confirmation_image_url=${origin+'/final/fixture.png'},poster_confirmation_email=customer_email WHERE id=${id}`;}
test('FLOW07 a second deposit adds by default instead of deleting existing references',async()=>{
 await attach([photo(1),photo(2)]);
 const r=await photosRoute.POST(request({token:signed,photoUrls:[photo(2)]}));
 assert.equal(r.status,200);
 assert.deepEqual((await db`SELECT photo_urls FROM orders WHERE id=${id}`)[0].photo_urls,[photo(1),photo(2)]);
});

test('FLOW07 explicit replacement requires a current snapshot; stale tabs cannot erase references',async()=>{
 await attach([photo(1),photo(2)]);
 const send=body=>photosRoute.POST(request({token:signed,operation:'replace',photoUrls:[photo(2)],...body}));
 assert.equal((await send({})).status,400);
 assert.equal((await send({expectedPhotos:[photo(1)]})).status,409);
 assert.equal((await send({expectedPhotos:[photo(1),photo(2)]})).status,200);
 assert.deepEqual((await db`SELECT photo_urls FROM orders WHERE id=${id}`)[0].photo_urls,[photo(2)]);
 assert.equal((await send({expectedPhotos:[photo(1),photo(2)]})).status,200,'exact retry is idempotent');
 assert.equal((await photosRoute.POST(request({token:signed,operation:'remove',photoUrls:[photo(2)],expectedPhotos:[photo(2)]}))).status,200);
 assert.deepEqual((await db`SELECT photo_urls FROM orders WHERE id=${id}`)[0].photo_urls,[]);
 assert.equal((await photosRoute.POST(request({token:signed,operation:'remove',photoUrls:[photo(2)],expectedPhotos:[photo(2)]}))).status,200,'remove retry remains idempotent for legacy references');
});

test('FLOW05 preview response rejects unpaid or closed phases even with a current invitation',async()=>{
 await preview();
 for (const field of ['paid_at','final_image_sent_at','expedie_le']) {
  await db`UPDATE orders SET paid_at=now(),final_image_sent_at=NULL,expedie_le=NULL WHERE id=${id}`;
  if(field==='paid_at') await db`UPDATE orders SET paid_at=NULL WHERE id=${id}`;
  else await db.unsafe(`UPDATE orders SET ${field}=now() WHERE id='${id}'`);
  const r=await posterRoute.POST(request({token:'preview',action:'changes',note:'Synthetic change'}));
  assert.equal(r.status,409,field);
  assert.equal((await db`SELECT count(*)::int n FROM retouches`)[0].n,0);assert.equal(emails.length,0);
 }
});

test('FLOW05 verified reviews require a paid delivered order; absent token still allows moderation',async()=>{
 const send=jeton=>reviewsRoute.POST(request({jeton,auteur:'Synthetic',note:4,texte:'Une expérience synthétique pour vérifier le parcours.',locale:'fr'}));
 assert.equal((await send(signed)).status,409);
 assert.equal((await db`SELECT count(*)::int n FROM reviews`)[0].n,0);assert.equal(effects,0);
 await db`UPDATE orders SET final_image_sent_at=now(),paid_at=NULL WHERE id=${id}`;
 assert.equal((await send(signed)).status,409);
 await db`UPDATE orders SET paid_at=now() WHERE id=${id}`;
 assert.equal((await send(signed)).status,200);
 assert.deepEqual((await db`SELECT verifie,statut FROM reviews`)[0],{verifie:true,statut:'publie'});
 assert.equal((await send(signed)).status,200);
 assert.equal((await db`SELECT count(*)::int n FROM reviews`)[0].n,1);
 assert.equal((await send('forged')).status,403);
 assert.equal((await send('')).status,200);
 assert.equal((await db`SELECT statut FROM reviews WHERE order_id IS NULL`)[0].statut,'en_attente');
});

test('FLOW09 rejects over-limit and non-string notes before any write or email',async()=>{
 await preview();
 for(const note of ['x'.repeat(2001),42,{},[],null]) {
  const r=await posterRoute.POST(request({token:'preview',action:'changes',note}));
  assert.equal(r.status,400,JSON.stringify(note));
  assert.equal((await db`SELECT poster_confirmation_status FROM orders WHERE id=${id}`)[0].poster_confirmation_status,null);
  assert.equal((await db`SELECT count(*)::int n FROM retouches`)[0].n,0);assert.equal(emails.length,0);
 }
});

test('FLOW09 valid boundary note and photo are identical in persisted response history and email',async()=>{
 await preview();const attached=origin+'/retouches/legacy.jpg';
 await db`UPDATE orders SET poster_confirmation_photos=${JSON.stringify([attached])}::text::jsonb WHERE id=${id}`;
 const note='  <&>\n'+'é'.repeat(1992)+'  ';
 assert.equal(note.length,2000);
 const r=await posterRoute.POST(request({token:'preview',action:'changes',note,photos:[attached]}));
 assert.equal(r.status,200);
 assert.equal((await db`SELECT poster_confirmation_note FROM orders WHERE id=${id}`)[0].poster_confirmation_note,note);
 assert.deepEqual((await db`SELECT note,photos FROM retouches WHERE order_id=${id}`)[0],{note,photos:[attached]});
 assert.equal(emails.length,1);assert.ok(emails[0].html.includes('  &lt;&amp;&gt;\n'+'é'.repeat(1992)+'  '));
 assert.ok(emails[0].html.includes(attached));
});

test('FLOW09 history outage rolls response back instead of acknowledging an incomplete request',async()=>{
 await preview();await db`ALTER TABLE retouches RENAME TO retouches_offline`;
 try {
  const r=await posterRoute.POST(request({token:'preview',action:'changes',note:'A retained request'}));
  assert.equal(r.status,500);
  assert.equal((await db`SELECT poster_confirmation_status FROM orders WHERE id=${id}`)[0].poster_confirmation_status,null);
  assert.equal(emails.length,0);
 } finally {await db`ALTER TABLE retouches_offline RENAME TO retouches`;}
});

async function reserved(purpose='depot',subject=`depot:${id}`){const context=randomUUID(),pathname=`${purpose==='poster'?'retouches':'orders'}/${context}/new.jpg`;await db`INSERT INTO upload_contexts(id,token_hash,purpose,subject,ip_hash,prefix,expires_at) VALUES(${context},${context},${purpose},${subject},'synthetic',${pathname},now()+interval '1 hour')`;await db`INSERT INTO upload_reservations(id,context_id,pathname,reserved_bytes) VALUES(${randomUUID()},${context},${pathname},100)`;return `${origin}/${pathname}`;}

test('FLOW07 concurrent default additions merge and exact retries emit no duplicate effects',async()=>{
 const urls=await Promise.all([reserved(),reserved()]);
 const responses=await Promise.all(urls.map(url=>photosRoute.POST(request({token:signed,photoUrls:[url,url]}))));assert.deepEqual(responses.map(r=>r.status),[200,200]);
 const final=(await db`SELECT photo_urls FROM orders WHERE id=${id}`)[0].photo_urls;assert.deepEqual([...final].sort(),[...urls].sort());
 const before=effects;assert.equal((await photosRoute.POST(request({token:signed,photoUrls:urls}))).status,200);assert.equal(effects,before);
});
test('FLOW07 concurrent additions cannot exceed eight; foreign ownership cannot be attached',async()=>{
 await attach(Array.from({length:7},(_,i)=>photo(i)));
 const urls=await Promise.all([reserved(),reserved()]);const results=await Promise.all(urls.map(url=>photosRoute.POST(request({token:signed,photoUrls:[url]}))));assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
 assert.equal((await db`SELECT photo_urls FROM orders WHERE id=${id}`)[0].photo_urls.length,8);
 const foreign=await reserved('depot','depot:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');const before=effects;
 assert.equal((await photosRoute.POST(request({token:signed,operation:'replace',expectedPhotos:[],photoUrls:[foreign]}))).status,403);assert.equal(effects,before);
});
test('FLOW05 existing signature cannot operate on absent order; paid free admin labels remain eligible',async()=>{
 await db`DELETE FROM orders WHERE id=${id}`;
 assert.equal((await photosRoute.POST(request({token:signed,photoUrls:[photo(1)]}))).status,404);
 assert.equal((await reviewsRoute.POST(request({jeton:signed,auteur:'Synthetic',note:5,texte:'Synthetic valid review text'}))).status,404);
 await db`INSERT INTO orders(id,status) VALUES(${id},'PENDING')`;const url=await reserved();
 assert.equal((await photosRoute.POST(request({token:signed,photoUrls:[url]}))).status,200);
 for(const field of ['poster_confirmation_sent_at','final_image_sent_at','expedie_le']){
  await db.unsafe(`UPDATE orders SET ${field}=now() WHERE id='${id}'`);const before=effects;
  assert.equal((await photosRoute.POST(request({token:signed,photoUrls:[url]}))).status,409);assert.equal(effects,before);
  await db.unsafe(`UPDATE orders SET ${field}=NULL WHERE id='${id}'`);
 }
});
test('FLOW05 concurrent identical preview submissions persist one history event and email; stale changes conflict',async()=>{
 await preview();const body={token:'preview',action:'changes',note:'Synthetic same note'};
 const results=await Promise.all([posterRoute.POST(request(body)),posterRoute.POST(request(body))]);assert.deepEqual(results.map(r=>r.status),[200,200]);
 const json=await Promise.all(results.map(r=>r.json()));assert.deepEqual(json.map(r=>r.changed).sort(),[false,true]);
 assert.equal((await db`SELECT count(*)::int n FROM retouches`)[0].n,1);assert.equal(emails.length,1);
 assert.equal((await posterRoute.POST(request({...body,note:'Stale changed note'}))).status,409);
 const current=(await db`SELECT poster_confirmation_responded_at FROM orders WHERE id=${id}`)[0].poster_confirmation_responded_at.toISOString();
 assert.equal((await posterRoute.POST(request({...body,action:'confirm',note:undefined,previousRespondedAt:current}))).status,200);
 assert.equal((await db`SELECT poster_confirmation_status FROM orders WHERE id=${id}`)[0].poster_confirmation_status,'confirmed');
});
test('FLOW05 concurrent verified review retries publish and reward only once',async()=>{
 await db`UPDATE orders SET expedie_le=now() WHERE id=${id}`;
 const body={jeton:signed,auteur:'Synthetic',note:5,texte:'Synthetic valid review text'};
 const results=await Promise.all([reviewsRoute.POST(request(body)),reviewsRoute.POST(request(body))]);assert.deepEqual(results.map(r=>r.status),[200,200]);
 assert.equal((await db`SELECT count(*)::int n FROM reviews`)[0].n,1);assert.equal(effects,2,'one reward plus one invalidation');
});

test('FLOW05 queued actions recheck payment under the SQL row lock before persisting',async()=>{
 for(const action of ['depot','preview','review']){
  await db`UPDATE orders SET paid_at=now(),poster_confirmation_sent_at=NULL,final_image_sent_at=NULL,expedie_le=NULL WHERE id=${id}`;
  if(action==='preview')await preview();if(action==='review')await db`UPDATE orders SET expedie_le=now() WHERE id=${id}`;
  const url=await reserved();let unlock,locked;
  const held=new Promise(r=>locked=r),release=new Promise(r=>unlock=r);
  const transaction=db.begin(async tx=>{await tx`UPDATE orders SET paid_at=NULL WHERE id=${id}`;locked();await release;});
  await held;const before=effects;
  const running=action==='depot'?photosRoute.POST(request({token:signed,photoUrls:[url]})):action==='preview'?posterRoute.POST(request({token:'preview',action:'changes',note:'Queued synthetic request'})):reviewsRoute.POST(request({jeton:signed,auteur:'Synthetic',note:5,texte:'Queued synthetic review text'}));
  try{
   let waiting=false;for(let n=0;n<100;n++){waiting=(await db`SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`)[0].n>0;if(waiting)break;await new Promise(r=>setTimeout(r,10));}
   assert.ok(waiting,action+' reached locked persistence');
  }finally{unlock();await transaction;}
  assert.equal((await running).status,409,action);assert.equal(effects,before);assert.equal(emails.length,0);
 }
 assert.equal((await db`SELECT count(*)::int n FROM reviews`)[0].n,0);assert.equal((await db`SELECT count(*)::int n FROM retouches`)[0].n,0);
});

test('FLOW05 preview requires a current sent invitation and refuses unbound old versions',async()=>{
 await preview();
 for(const column of ['poster_confirmation_sent_at','poster_confirmation_image_url','poster_confirmation_email']){
  await preview();await db.unsafe(`UPDATE orders SET ${column}=NULL WHERE id='${id}'`);
  const r=await posterRoute.POST(request({token:'preview',action:'confirm'}));assert.ok([404,409].includes(r.status));
  assert.equal((await db`SELECT poster_confirmation_status FROM orders WHERE id=${id}`)[0].poster_confirmation_status,null);assert.equal(emails.length,0);
 }
});
test('FLOW07 simultaneous explicit replacements permit one current snapshot only',async()=>{
 const old=photo(1);await attach([old]);const urls=await Promise.all([reserved(),reserved()]);
 const results=await Promise.all(urls.map(url=>photosRoute.POST(request({token:signed,operation:'replace',expectedPhotos:[old],photoUrls:[url]}))));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const saved=(await db`SELECT photo_urls FROM orders WHERE id=${id}`)[0].photo_urls;assert.equal(saved.length,1);assert.ok(urls.includes(saved[0]));
});

test('FLOW05 unpaid signed depot refuses without write or effects',async()=>{
 await attach([photo(1)]);await db`UPDATE orders SET paid_at=NULL WHERE id=${id}`;
 const r=await photosRoute.POST(request({token:signed,photoUrls:[photo(1)]}));
 assert.equal(r.status,409,JSON.stringify(await r.json()));assert.equal(effects,0);
});
