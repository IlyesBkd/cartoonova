import assert from 'node:assert/strict';
import {before, after, test} from 'node:test';
import {mkdtempSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {execFileSync, spawnSync} from 'node:child_process';
import postgres from 'postgres';
import {loadDeep} from './order-delivery-harness.mjs';

const runtime=mkdtempSync(path.join(tmpdir(),'flow11-pg-'));
const data=path.join(runtime,'pg');
const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const bin='/usr/lib/postgresql/18/bin/';
const pg=(cmd,args)=>execFileSync(bin+cmd,args,{env,timeout:15000,stdio:'pipe'});
let db, referral, promo, started=false;
before(async()=>{
 const server=net.createServer();
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port;
 await new Promise(r=>server.close(r));
 assert.notEqual(port,5432);
 pg('initdb',['-D',data,'-U','flow11_test','--auth=trust','--no-locale','--encoding=UTF8']);
 pg('pg_ctl',['-D',data,'-l',path.join(runtime,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${runtime}`,'-w','start']);started=true;
 db=postgres(`postgresql://flow11_test@127.0.0.1:${port}/postgres`,{max:20,onnotice(){}});
 const database={sql:db,runtimeSchemaBootstrapEnabled:true,ensurePaidAtSchema:async()=>{}};
 promo=loadDeep('lib/promoCodes.ts',{'@/lib/db':database});
 await promo.ensurePromoSchema();
 await db`CREATE TABLE orders(currency text,customer_email text,paid_at timestamptz)`;
 referral=loadDeep('lib/parrainage.ts',{
  '@/lib/db':database,'@/lib/promoCodes':promo,
  '@/lib/bonCadeau':{formatMontant:()=> '5 EUR',creerBonOffert:()=>{throw new Error('unexpected reward');}},
  '@/lib/analyticsServeur':{mesureServeur:()=>{throw new Error('unexpected analytics');}},
 });
});
after(async()=>{
 try {if(db)await db.end({timeout:2});}
 finally {if(started){pg('pg_ctl',['-D',data,'-m','fast','-w','stop']);
  assert.equal(spawnSync(bin+'pg_ctl',['-D',data,'status'],{env}).status,3);
  assert.equal(existsSync(path.join(data,'postmaster.pid')),false);
 }}
});
async function snapshot(email){return (await db`SELECT * FROM promo_codes WHERE lower(parrain_email)=${email}`)[0];}

test('FLOW-11: initial get-or-create issues one code with a fixed 12 month deadline under concurrency',async()=>{
 const before=new Date(); before.setMonth(before.getMonth()+12);
 const codes=await Promise.all(Array.from({length:20},(_,i)=>referral.codeParrainage(i%2?' NEW@EXAMPLE.INVALID ':'new@example.invalid','fr')));
 const after=new Date(); after.setMonth(after.getMonth()+12);
 assert.equal(new Set(codes).size,1);
 assert.match(codes[0],/^AMI-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
 const rows=await db`SELECT * FROM promo_codes WHERE lower(parrain_email)='new@example.invalid'`;
 assert.equal(rows.length,1);
 const row=rows[0];
 assert.ok(row.ends_at>=before && row.ends_at<=after);
 assert.equal(row.active,true);assert.equal(row.parrain_lang,'fr');
 assert.equal(row.kind,'percent');assert.equal(Number(row.value),20);
 assert.equal(await referral.codeParrainage('new@example.invalid','en'),row.code);
 assert.deepEqual(await snapshot('new@example.invalid'),row);
});

for(const [label,ends,active,reason] of [
 ['expired','2020-01-01T00:00:00Z',true,'expired'],
 ['disabled','2099-01-01T00:00:00Z',false,'inactive'],
 ['disabled-expired','2020-01-01T00:00:00Z',false,'inactive'],
 ['legacy-null',null,true,null],
 ['admin-future','2099-01-01T00:00:00Z',true,null],
]) test(`FLOW-11: ${label} remains unchanged after concurrent reads, without renewal or replacement`,async()=>{
 const email=`${label}@example.invalid`,code=`AMI-${label.toUpperCase()}`;
 await db`INSERT INTO promo_codes(code,kind,value,ends_at,active,parrain_email,parrain_lang)
 VALUES(${code},'percent',20,${ends},${active},${email},'fr')`;
 const before=await snapshot(email);
 const codes=await Promise.all(Array.from({length:20},()=>referral.codeParrainage(email.toUpperCase(),'de')));
 assert.deepEqual([...new Set(codes)],[code]);
 assert.deepEqual(await snapshot(email),before);
 assert.equal((await db`SELECT count(*)::int AS n FROM promo_codes WHERE lower(parrain_email)=${email}`)[0].n,1);
 const validation=await promo.validatePromoCode(code,100,'EUR');
 assert.deepEqual(validation,reason?{ok:false,reason}:{ok:true,code,discount:20});
});

test('FLOW-11: empty addresses cannot create a referral',async()=>{
 await assert.rejects(referral.codeParrainage('  ','fr'),/adresse vide/);
 assert.equal((await db`SELECT count(*)::int AS n FROM promo_codes WHERE parrain_email=''`)[0].n,0);
});

test('FLOW-11: two information reads preserve the complete existing referral row and fixed deadline',async()=>{
 await db`INSERT INTO promo_codes(code,kind,value,ends_at,parrain_email,parrain_lang)
 VALUES('AMI-FIXED-TEST','percent',20,now()+interval '2 days','fixed@example.invalid','fr')`;
 const before=await snapshot('fixed@example.invalid');
 for(const lang of ['en','de']){
  assert.equal((await referral.infosParrainage(' FIXED@EXAMPLE.INVALID ',lang)).code,before.code);
  assert.deepEqual(await snapshot('fixed@example.invalid'),before);
 }
});
