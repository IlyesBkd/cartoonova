import {createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {loadOrderContext,makeCandidates,LIMITS,UUID} from './evidence.mjs';
const ROOT='/home/hermes/projects/cartoonova/';
const require=createRequire(ROOT+'package.json');
export async function collectBrief(sql,drafts,{worker,getHistory,now=new Date(),physical}={}){
 const rows=(await worker.collect(sql)).filter(r=>!/(?:démonstration|demonstration|^test\b|^démo\b)/i.test(r.customer_label||''));
 const alerts=rows.map(r=>worker.evaluate(r,now,null)).filter(Boolean);
 const retIds=alerts.filter(a=>a.type==='retouche').map(a=>a.orderId);
 if(retIds.length){const notes=await sql.begin('read only',async tx=>{await tx`SET LOCAL statement_timeout='10s'`;return tx`select distinct on (order_id) order_id::text as id,note from retouches where order_id::text in ${tx(retIds)} order by order_id,demandee_le desc`;});
  const bad=new Set(notes.filter(n=>worker.UNHAPPY.test(String(n.note||''))).map(n=>n.id));
  for(const a of alerts)if(a.type==='retouche'&&bad.has(a.orderId))a.unhappy=true;
  alerts.sort((x,y)=>(y.unhappy?1:0)-(x.unhappy?1:0));}
 const pending=rows.filter(r=>!r.final_image_sent_at&&!r.poster_confirmation_sent_at).map(r=>({id:r.id,customer:r.customer_label,photos:Array.isArray(r.photo_urls)&&r.photo_urls.length>0,express:r.options?.express===true}));
 const readyPrint=rows.filter(r=>r.poster_confirmation_status==='confirmed'&&!r.fournisseur_ref&&physical(r.options)).map(r=>({id:r.id,customer:r.customer_label}));
 const support=await sql.begin('read only',async tx=>{await tx`SET LOCAL statement_timeout='10s'`;return tx`select m.id,m.received_at,m.subject from support_messages m where m.read_at is null and (m.category='customer' or m.category is null) and not exists(select 1 from support_replies r where r.support_message_id=m.id) and not exists(select 1 from support_replies r where lower(r.to_email)=lower(m.from_email) and r.sent_at>m.received_at) order by m.received_at desc,m.id desc`;});
 const data={alerts,pending,readyPrint,supportUnread:support.length,supportMessages:support,source:'site enregistré, pas boîte mail complète'};
 const ids=[...new Set([...alerts.map(a=>a.orderId),...pending.map(r=>r.id),...readyPrint.map(r=>r.id),...drafts.map(b=>b.commande)].filter(id=>UUID.test(id??'')))];
 const contexts={};
 for(const id of ids.slice(0,LIMITS.orders))contexts[id]=await loadOrderContext(sql,id,{getHistory,now});
 data.reviewCandidates=makeCandidates(data,drafts,contexts);
 return data;
}
async function main(){
 const input=readFileSync(0,'utf8');if(Buffer.byteLength(input)>1048576)throw Error('input_limit');
 const payload=input?JSON.parse(input):{};const drafts=payload.drafts??[];
 if(!Array.isArray(drafts)||drafts.length>200)throw Error('draft_limit');
 // Preserve the sibling import at runtime; checkout execution uses that existing worker.
 const sibling=new URL('../order-delay-watch/worker.mjs',import.meta.url);
 const worker=await import(existsSync(sibling)?sibling.href:pathToFileURL('/home/hermes/.hermes/profiles/cartoonova/artifacts/order-delay-watch/worker.mjs').href);
 const ts=require('typescript');
 const compiled=ts.transpileModule(readFileSync(ROOT+'lib/supportCommande.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const {estPhysique}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 const sql=require('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:10});
 try{console.log(JSON.stringify(await collectBrief(sql,drafts,{worker,physical:estPhysique})));}finally{await sql.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Collecte du bilan indisponible');process.exitCode=1;});
