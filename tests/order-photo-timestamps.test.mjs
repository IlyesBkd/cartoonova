import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {execFileSync} from 'node:child_process';
import postgres from 'postgres';
const runtime=mkdtempSync(path.join(tmpdir(),'photo-clock-'));
const migration=new URL('../migrations/20261028_order_photo_timestamps.sql',import.meta.url);
const command=(name,args)=>execFileSync('/usr/lib/postgresql/18/bin/'+name,args,{timeout:15000,stdio:'pipe'});
let db,started=false;
const photo=n=>`https://synthetic.public.blob.vercel-storage.com/orders/${n}.jpg`;
const migrate=async()=>{if(!existsSync(migration))return;const connection=await db.reserve();try{await connection.unsafe(readFileSync(migration,'utf8'));}finally{connection.release();}};
const get=async id=>(await db`SELECT * FROM orders WHERE id=${id}`)[0];
const insert=async (id,photos)=>{await db`INSERT INTO orders(id,photo_urls) VALUES(${id},${JSON.stringify(photos)}::text::jsonb)`;return get(id);};
const update=async (id,photos)=>{await db`UPDATE orders SET photo_urls=${JSON.stringify(photos)}::text::jsonb WHERE id=${id}`;return get(id);};
const dates=row=>[row.photos_received_at?.toISOString()??null,row.photos_updated_at?.toISOString()??null];
before(async()=>{
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));assert.notEqual(port,5432);
 command('initdb',['-D',runtime+'/pg','-U','photo_test','--auth=trust','--no-locale','--encoding=UTF8']);
 command('pg_ctl',['-D',runtime+'/pg','-l',runtime+'/pg.log','-o',`-h 127.0.0.1 -p ${port} -k ${runtime}`,'-w','start']);started=true;
 db=postgres(`postgresql://photo_test@127.0.0.1:${port}/postgres`,{max:8,onnotice(){}});
 await db`CREATE TABLE orders(id text PRIMARY KEY, photo_urls jsonb, status text)`;
 await insert('legacy-full',[photo('old')]);await insert('legacy-empty',[]);
 await migrate();
});
after(async()=>{try{if(db)await db.end({timeout:2});}finally{if(started)command('pg_ctl',['-D',runtime+'/pg','-m','fast','-w','stop']);rmSync(runtime,{recursive:true,force:true});}});
test('server dates initial nonempty deposit; empty insert remains unknown',async()=>{
 const empty=await insert('empty',[]);assert.deepEqual(dates(empty),[null,null]);
 const row=await insert('full',[photo(1)]);
 assert.ok(row.photos_received_at instanceof Date,`first photo date is recorded by PostgreSQL: ${JSON.stringify(row)}`);
 assert.deepEqual(dates(row),[row.photos_received_at.toISOString(),row.photos_received_at.toISOString()]);
 const [clock]=await db`SELECT clock_timestamp() now`;
 assert.ok(row.photos_received_at<=clock.now);
});
test('add replace remove redeposit preserve first; equal retry and unrelated writes preserve both',async()=>{
 let row=await insert('transitions',[]);
 row=await update(row.id,[photo(1)]);assert.ok(row.photos_received_at instanceof Date);
 const first=row.photos_received_at.toISOString();
 for(const list of [[photo(1),photo(2)],[photo(2)],[],[photo(3)]]){
  const previous=dates(row);await db`SELECT pg_sleep(0.003)`;row=await update(row.id,list);
  assert.equal(dates(row)[0],first);assert.ok(row.photos_updated_at.toISOString()>previous[1]);
  const stable=dates(row);assert.deepEqual(dates(await update(row.id,list)),stable);
  await db`UPDATE orders SET status='PAID',photos_received_at='2000-01-01',photos_updated_at='2099-01-01' WHERE id=${row.id}`;
  assert.deepEqual(dates(await get(row.id)),stable);
 }
});
test('legacy histories remain unknown without backfill, including removal then redeposit',async()=>{
 assert.deepEqual(dates(await get('legacy-full')),[null,null]);
 assert.deepEqual(dates(await update('legacy-full',[photo('old')])),[null,null]);
 for(const list of [[photo('old'),photo('new')],[photo('replacement')],[],[photo('again')]]){
  const row=await update('legacy-full',list);assert.equal(row.photos_received_at,null);assert.ok(row.photos_updated_at instanceof Date);
 }
 const row=await update('legacy-empty',[photo('fresh')]);assert.ok(row.photos_received_at instanceof Date);
});
test('normalize historical encoding and duplicates without claiming invalid lists are available',async()=>{
 const encoded=await insert('encoded',JSON.stringify([photo(1)]));assert.ok(encoded.photos_received_at instanceof Date);
 const stable=dates(encoded);
 assert.deepEqual(dates(await update('encoded',[photo(1),photo(1)])),stable);
 assert.deepEqual(dates(await update('encoded',JSON.stringify(JSON.stringify([photo(1)])))),stable);
 const empty=await insert('null',null);assert.deepEqual(dates(await update('null',[])),dates(empty));
 assert.ok((await update('null',[photo(1)])).photos_received_at instanceof Date);
 for(const [index,value] of [null,{},42,'not json','[bad', [null],[''],['http://wrong.invalid/a.jpg'],[photo(1),42],Array(9).fill(0).map((_,i)=>photo(i))].entries()){
  const row=await insert('invalid-'+index,value);assert.deepEqual(dates(row),[null,null],JSON.stringify(value));
 }
 const invalid=await insert('invalid-history',{});
 const changed=await update(invalid.id,[photo(1)]);assert.equal(changed.photos_received_at,null,'invalid history is not known empty');assert.ok(changed.photos_updated_at instanceof Date);
});
test('uppercase photo extensions accepted by the API receive first-deposit dates',async()=>{
 const upper=photo('uppercase').replace('.jpg','.JPG');
 const created=await insert('uppercase-insert',[upper]);
 assert.ok(created.photos_received_at instanceof Date);
 await insert('uppercase-update',[]);
 const deposited=await update('uppercase-update',[upper]);
 assert.ok(deposited.photos_received_at instanceof Date);
 assert.deepEqual(dates(await update('uppercase-update',[upper])),dates(deposited));
});
test('invalid encoded Unicode does not break order writes or claim a deposit',async()=>{
 const row=await insert('invalid-unicode','"\\u0000"');assert.deepEqual(dates(row),[null,null]);
});
test('insert forgery is ignored; migration repeated preserves exact dates and has no elevated function',async()=>{
 await db`INSERT INTO orders(id,photo_urls,photos_received_at,photos_updated_at) VALUES('forged-empty','[]','2000-01-01','2099-01-01')`;
 assert.deepEqual(dates(await get('forged-empty')),[null,null]);
 const [row]=await db`INSERT INTO orders(id,photo_urls,photos_received_at,photos_updated_at) VALUES('forged-full',${JSON.stringify([photo(1)])}::text::jsonb,'2000-01-01','2099-01-01') RETURNING *`;
 assert.ok(row.photos_received_at instanceof Date);assert.notEqual(row.photos_received_at.getUTCFullYear(),2000);assert.equal(+row.photos_received_at,+row.photos_updated_at);
 const before=await db`SELECT id,photos_received_at::text,photos_updated_at::text FROM orders ORDER BY id`;
 await migrate();await migrate();
 assert.deepEqual(await db`SELECT id,photos_received_at::text,photos_updated_at::text FROM orders ORDER BY id`,before);
 const functions=await db`SELECT prosecdef FROM pg_proc WHERE oid IN ('public.track_order_photo_timestamps()'::regprocedure,'public.order_photo_timestamp_list(jsonb)'::regprocedure)`;
 assert.equal(functions.length,2);assert.ok(functions.every(row=>row.prosecdef===false));
});
test('rolled back deposit leaves no timestamp or photo change',async()=>{
 await insert('rollback',[]);
 await assert.rejects(db.begin(async tx=>{await tx`UPDATE orders SET photo_urls=${JSON.stringify([photo(1)])}::text::jsonb WHERE id='rollback'`;const [row]=await tx`SELECT * FROM orders WHERE id='rollback'`;assert.ok(row.photos_received_at instanceof Date);throw new Error('rollback proof');}),/rollback proof/);
 assert.deepEqual(dates(await get('rollback')),[null,null]);assert.deepEqual((await get('rollback')).photo_urls,[]);
});
test('concurrent locked deposits use the committed first date; blocked duplicate is idempotent',async()=>{
 for(const same of [false,true]){
  const id='concurrent-'+same;await insert(id,[]);let release,ready;
  const gate=new Promise(r=>release=r),held=new Promise(r=>ready=r);
  const first=db.begin(async tx=>{await tx`UPDATE orders SET photo_urls=${JSON.stringify([photo(1)])}::text::jsonb WHERE id=${id}`;const [row]=await tx`SELECT photos_received_at::text,photos_updated_at::text FROM orders WHERE id=${id}`;ready(row);await gate;return row;});
  const snapshot=await held;
  const connection=await db.reserve();
  try{
   const [{pid}]=await connection`SELECT pg_backend_pid() pid`;
   const pending=connection`UPDATE orders SET photo_urls=${JSON.stringify(same?[photo(1)]:[photo(1),photo(2)])}::text::jsonb,photos_received_at='2000-01-01',photos_updated_at='2099-01-01' WHERE id=${id}`.execute();
   try{
    const deadline=Date.now()+3000;let blocked=false;
    while(Date.now()<deadline){const [state]=await db`SELECT wait_event_type FROM pg_stat_activity WHERE pid=${pid}`;if(state.wait_event_type==='Lock'){blocked=true;break;}await new Promise(r=>setTimeout(r,5));}
    assert.ok(blocked,'second writer really waited for PostgreSQL row lock');
   }finally{release();await first;await pending;}
  }finally{release();connection.release();}
  const [saved]=await db`SELECT photos_received_at::text,photos_updated_at::text FROM orders WHERE id=${id}`;
  assert.equal(saved.photos_received_at,snapshot.photos_received_at);
  if(same)assert.deepEqual(saved,snapshot);else assert.notEqual(saved.photos_updated_at,snapshot.photos_updated_at);
 }
});
