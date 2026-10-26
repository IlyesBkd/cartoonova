import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {execFileSync} from 'node:child_process';
import postgres from 'postgres';
import {load} from './upload-harness.mjs';
import {Module,createRequire} from 'node:module';
import ts from 'typescript';
export function loadDeep(file,replacements={},cache=new Map()){
 const filename=path.resolve(import.meta.dirname,'..',file);
 if(cache.has(filename))return cache.get(filename).exports;
 const mod=new Module(filename);mod.filename=filename;cache.set(filename,mod);const real=createRequire(filename);
 mod.require=name=>{const normalized=name.startsWith('.')?'@/'+path.relative(path.resolve(import.meta.dirname,'..'),path.resolve(path.dirname(filename),name)):name;
 if(Object.hasOwn(replacements,normalized))return replacements[normalized];
 if(normalized.startsWith('@/'))return loadDeep(normalized.slice(2)+'.ts',replacements,cache);
 return real(name);};
 mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
 return mod.exports;
}
// Build a genuine sent final-image ledger entry via the production SQL guard.
// Call only on a fresh fixture (or a legitimate subsequent version), never erase
// historical markers to bypass the fail-closed production policy.
export async function deliverFixture(pg,id,contentHash) {
 const [saved]=await pg.db`SELECT * FROM orders WHERE id=${id}::uuid`;
 const opts=typeof saved.options==='string'?JSON.parse(saved.options):saved.options;
 return pg.load('lib/orderDelivery.ts').executeDelivery(saved,'final_image',contentHash,opts?.gift?.recipientEmail?.trim()||saved.customer_email,async ctx=>ctx.send(async()=>({data:{id:'fixture-final'}})));
}
export async function database(){
 const runtime=mkdtempSync(path.join(tmpdir(),'delivery-pg-'));
 const pg=(cmd,args)=>execFileSync('/usr/lib/postgresql/18/bin/'+cmd,args,{env:Object.fromEntries(['PATH','HOME','TMPDIR'].map(k=>[k,process.env[k]])),timeout:15000,stdio:'pipe'});
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 pg('initdb',['-D',runtime+'/pg','-U','delivery_test','--auth=trust','--no-locale']);
 pg('pg_ctl',['-D',runtime+'/pg','-l',runtime+'/pg.log','-o',`-h 127.0.0.1 -p ${port} -k ${runtime}`,'-w','start']);
 const db=postgres(`postgresql://delivery_test@127.0.0.1:${port}/postgres`,{max:20,onnotice(){}});
 await db`CREATE TABLE orders(id uuid PRIMARY KEY,status text,paid_at timestamptz, customer_email text,customer_name text,detected_country text,langue text,options jsonb,final_image_url text,final_image_sent_at timestamptz,final_image_scheduled_at timestamptz,poster_confirmation_status text,poster_confirmation_image_url text,poster_confirmation_email text,last_outbound_message_id text,fournisseur_ref text,suivi_url text,suivi_transporteur text,cout numeric,cout_note text,expedie_le timestamptz,expedition_email_envoye_le timestamptz)`;
 return {connectionUrl:`postgresql://delivery_test@127.0.0.1:${port}/postgres`,db,load:(file,extra={})=>load(file,{'@/lib/db':{withFreshDatabaseClient:fn=>fn(db)},...extra}),migrate:async()=>db.unsafe(readFileSync(new URL('../migrations/20261026_order_delivery_effects.sql',import.meta.url),'utf8')),close:async()=>{await db.end({timeout:2});pg('pg_ctl',['-D',runtime+'/pg','-m','fast','-w','stop']);}};
}
