import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import net from 'node:net';
import postgres from 'postgres';
import {openProgressive,telegramSender} from '../scripts/telegram-progressive.mjs';
export function transport(options={}) {
 const calls=[];let seq=100;
 const send=telegramSender({token:'fake',chatId:'123',confirmedChatId:'123',fetchImpl:async(url,o)=>{
  const body=JSON.parse(o.body),method=url.split('/').at(-1);calls.push({method,...body});
  if(options.fail?.(method,body,calls.length))throw Error('synthetic failure');
  return {ok:true,json:async()=>({ok:true,result:{message_id:body.message_id??++seq}})};
 }});return {send,calls};
}
export async function fixture() {
 const dir=mkdtempSync(join(tmpdir(),'telegram-progressive-')),bin='/usr/lib/postgresql/18/bin';
 const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const pg=(cmd,args)=>execFileSync(join(bin,cmd),args,{env,stdio:'pipe',timeout:20000});
 const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
 pg('initdb',['-D',dir+'/pg','-U','test','--auth=trust','--no-locale','--encoding=UTF8']);
 pg('pg_ctl',['-D',dir+'/pg','-l',dir+'/log','-o',`-h 127.0.0.1 -p ${port} -k ${dir}`,'-w','start']);
 const url=`postgresql://test@127.0.0.1:${port}/postgres`,db=postgres(url,{max:1,onnotice(){}}),other=postgres(url,{max:1,onnotice(){}});
 await db`CREATE TABLE support_messages(id serial PRIMARY KEY,message_id text UNIQUE,from_email text NOT NULL,subject text,body_text text,received_at timestamptz DEFAULT now(),order_id uuid)`;
 await db`CREATE TABLE support_replies(id serial PRIMARY KEY,to_email text,body_text text,sent_at timestamptz)`;
 await db`CREATE TABLE orders(id uuid,customer_email text,paid_at timestamptz,status text,created_at timestamptz,options jsonb)`;
 await db.unsafe(readFileSync(new URL('../migrations/20261026_chat_telegram_notifications.sql',import.meta.url),'utf8'));
 const path=dir+'/ledger.sqlite',ledger=openProgressive(path);
 return {db,other,dir,path,ledger,url,
  async add(body='Hello',email='a@example.invalid',age=0,channel='chat') {
   const [m]=await db`INSERT INTO support_messages(message_id,from_email,subject,body_text,received_at) VALUES(${channel+'-'+crypto.randomUUID()},${email},'Subject',${body},now()-make_interval(secs=>${age})) RETURNING id`;
   await db`INSERT INTO chat_telegram_notifications(support_message_id,available_at) VALUES(${m.id},now()-make_interval(secs=>${age}))`;return m.id;
  },
  async close(){ledger.close();await db.end();await other.end();pg('pg_ctl',['-D',dir+'/pg','-m','fast','-w','stop']);rmSync(dir,{recursive:true,force:true});}
 };
}
export const enriched=m=>({...m,preparing:false,language:'en',draft:'Hello,\nThe Cartoonova team',draftFR:'Bonjour,\nL’équipe Cartoonova',translation:{status:'ready',text:'Bonjour'}});
export const joined=parts=>parts.map(p=>(p.text??p).replace(/^\[[^\n]+\]\n/u,'')).join('');
