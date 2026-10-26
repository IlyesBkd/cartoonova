import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {execFileSync} from 'node:child_process';
import postgres from 'postgres';
const env=Object.fromEntries(['PATH','HOME','LANG','LC_ALL','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const runtime=mkdtempSync(path.join(tmpdir(),'cartoonova-gift-migration-'));
const bin=process.env.TEST_PG_BIN||'/usr/lib/postgresql/18/bin';
const pg=(cmd,args)=>execFileSync(path.join(bin,cmd),args,{env,encoding:'utf8',timeout:15000});
test('gift_lang migration: historical data, idempotence, transactional abort and lossless down/up',async()=>{
 let db,started=false;
 try {
  const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));assert.notEqual(port,5432);
  pg('initdb',['-D',path.join(runtime,'pg'),'-U','migration_test','--auth=trust','--no-locale','--encoding=UTF8']);
  pg('pg_ctl',['-D',path.join(runtime,'pg'),'-l',path.join(runtime,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${runtime}`,'-w','start']);started=true;
  db=postgres(`postgresql://migration_test@127.0.0.1:${port}/postgres`,{max:1,onnotice(){}});
  await db`CREATE TABLE promo_codes(code text PRIMARY KEY,kind text,value numeric,solde numeric,used_count integer)`;
  await db`INSERT INTO promo_codes VALUES('HISTORICAL','amount',30,12.5,2)`;
  const migration=readFileSync(new URL('../migrations/20261026_gift_language.sql',import.meta.url),'utf8');
  await db.unsafe(migration);await db.unsafe(migration);
  assert.deepEqual({... (await db`SELECT * FROM promo_codes`)[0]}, {code:'HISTORICAL',kind:'amount',value:'30',solde:'12.5',used_count:2,gift_lang:null});
  await db`INSERT INTO promo_codes VALUES('FR','amount',40,40,0,'fr'),('EN','amount',50,50,0,'en')`;
  const snapshot=JSON.stringify(await db`SELECT * FROM promo_codes ORDER BY code`);
  await db`BEGIN`;await db`ALTER TABLE promo_codes DROP COLUMN gift_lang`;await db`ROLLBACK`;
  assert.equal(JSON.stringify(await db`SELECT * FROM promo_codes ORDER BY code`),snapshot);
  // Maintenance-only down/up: retain language values in a backup before dropping.
  await db`BEGIN`;await db`LOCK TABLE promo_codes IN ACCESS EXCLUSIVE MODE`;
  await db`CREATE TABLE gift_language_rollback_20261026 AS SELECT code,gift_lang FROM promo_codes`;
  await db`ALTER TABLE promo_codes DROP COLUMN gift_lang`;await db`COMMIT`;
  assert.equal((await db`SELECT count(*)::int AS n FROM promo_codes`)[0].n,3);
  await db.unsafe(migration);
  await db`UPDATE promo_codes p SET gift_lang=b.gift_lang FROM gift_language_rollback_20261026 b WHERE p.code=b.code`;
  assert.equal(JSON.stringify(await db`SELECT * FROM promo_codes ORDER BY code`),snapshot);
 } finally {if(db)await db.end({timeout:2});if(started)pg('pg_ctl',['-D',path.join(runtime,'pg'),'-m','fast','-w','stop']);}
});
