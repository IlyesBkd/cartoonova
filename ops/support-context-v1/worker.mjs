#!/usr/bin/env node
import postgres from 'postgres';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
import {openProgressive,notificationParts,telegramSender} from '/home/hermes/projects/cartoonova/scripts/telegram-progressive.mjs';
import {parseBilingual} from '/home/hermes/projects/cartoonova/scripts/telegram-bilingual.mjs';
import {runInference} from './inference.mjs';
import {loadContext,formatContextSummary,formatOrderBrief,inferenceContext,safeText} from './context.mjs';
export {loadContext,formatContextSummary};
const STATUSES = ['Client existant','Aucun achat retrouvé','Statut non vérifié'];
// Same payment receipt and case-insensitive exact email policy as lib/parrainage.ts.
// Read only: never run ensurePaidAtSchema() from a notification worker.
export async function customerStatus(sql,email) {
  try {
    const rows=await sql`SELECT EXISTS(SELECT 1 FROM orders
      WHERE lower(customer_email)=lower(${email}) AND paid_at IS NOT NULL) AS purchased`;
    if(typeof rows[0]?.purchased!=='boolean') throw Error('Invalid lookup');
    return rows[0].purchased ? STATUSES[0] : STATUSES[1];
  } catch {return STATUSES[2];}
}

export const formatNotification=notificationParts;
export const createSender=telegramSender;

// Scan the entire snapshot, not a sliding time window: late inserts are eligible.
export async function scan(sql, limit=500) {
  if (!Number.isInteger(limit)||limit<1||limit>500) throw Error('Invalid bounds');
  return sql.begin('isolation level repeatable read read only', async tx => {
    const rows=[]; let last=0;
    for (;;) {
      const page=await tx`SELECT id,message_id,from_email,subject,body_text,received_at FROM support_messages
        WHERE id > ${last} AND message_id NOT LIKE 'chat-%' AND message_id NOT LIKE 'contact-%'
        ORDER BY id ASC LIMIT ${limit}`;
      rows.push(...page);
      if(page.length<limit) return rows;
      last=page[page.length-1].id;
    }
  });
}
export function state(path) {
  const db=new DatabaseSync(path); db.exec(`PRAGMA busy_timeout=30000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY,v TEXT NOT NULL);`);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec("CREATE TABLE IF NOT EXISTS items(message_id TEXT PRIMARY KEY,source_id INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('baseline','pending','processing','sent')))");
    if (!db.prepare('PRAGMA table_info(items)').all().some(c=>c.name==='processing_at')) db.exec('ALTER TABLE items ADD COLUMN processing_at INTEGER');
    db.exec('COMMIT');
  } catch(e) {db.exec('ROLLBACK');db.close();throw e;}
  db.progressive=openProgressive(path,{db});
  return db;
}
export async function generateDraft(sql,row,{signal,infer=runInference,context,supplierEvidence}={}) {
  const c=context??await loadContext(sql,row,{signal,supplierEvidence});
  if(signal?.aborted)throw Error('Draft aborted');
  const current=c.current??row;
  if(typeof current.body_text!=='string'||current.body_text.length>100000)throw Error('Full email exceeds inference capacity');
  return parseBilingual(await infer({subject:safeText(current.subject,200),bodyText:current.body_text,context:inferenceContext(c)},{signal}));
}
export async function runOnce(sql,db,{send,limit=500,draft=generateDraft,draftTimeoutMs=45000,supplierEvidence,infer=runInference}={}) {
  if(typeof send!=='function') throw Error('Missing sender');
  if(!Number.isInteger(draftTimeoutMs)||draftTimeoutMs<1||draftTimeoutMs>50000) throw Error('Invalid draft timeout');
  const rows=await scan(sql,limit); let baseline=false;
  db.exec('BEGIN IMMEDIATE');
  try {
    baseline=!db.prepare("SELECT 1 FROM meta WHERE k='initialized'").get();
    const insert=db.prepare('INSERT OR IGNORE INTO items(message_id,source_id,status) VALUES (?,?,?)');
    for(const row of rows) insert.run(row.message_id,row.id,baseline?'baseline':'pending');
    if(baseline) db.prepare("INSERT INTO meta VALUES ('initialized','1')").run();
    db.exec('COMMIT');
  } catch(e) {db.exec('ROLLBACK');throw e;}
  let attempted=0,sent=0,uncertain=0;
  if(!baseline) for(const row of rows) {
    const claim=db.prepare("UPDATE items SET status='processing',processing_at=? WHERE message_id=? AND status='pending'").run(Date.now(),row.message_id);
    if(!claim.changes)continue;
    attempted++;
    try {
      await db.progressive.initial(`email:${row.message_id}`,{id:row.id,email:String(row.from_email||''),subject:String(row.subject||'(sans objet)'),body:String(row.body_text||''),receivedAt:row.received_at,channel:'email',sourceRow:row,preparing:true},send);
      db.prepare("UPDATE items SET status='sent' WHERE message_id=? AND status='processing'").run(row.message_id);sent++;
    }catch{uncertain++;}
  }
  let enrichment;
  if(process.env.TELEGRAM_RECEIVE_ONLY!=='1')enrichment=await db.progressive.run({send,limit:1,enrich:async message=>{
    const controller=new AbortController();let timer;
    try {
      return await Promise.race([(async()=>{
        const context=await loadContext(sql,message.sourceRow,{signal:controller.signal,supplierEvidence});
        const proposal=await draft(sql,message.sourceRow,{signal:controller.signal,context,infer});
        return {...message,...(proposal&&typeof proposal==='object'?proposal:{}),draft:proposal?.draft??null,orderSummary:formatOrderBrief(context),customerContext:inferenceContext(context),preparing:false};
      })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Enrichment timeout'));},draftTimeoutMs);})]);
    }finally{clearTimeout(timer);}
  }});
  const processing=db.prepare("SELECT count(*) AS n FROM items WHERE status='processing'").get().n;
  return {scanned:rows.length,baseline,scanSaturated:false,attempted,sent,uncertain,processing,...(enrichment?{enrichment}:{})};
}

async function main(){
  process.umask(0o077);
  if(process.argv.length!==3 || process.argv[2]!=='--send') throw Error('Explicit --send required');
  const {CHAT_NOTIFY_DATABASE_URL,CHAT_NOTIFY_TELEGRAM_TOKEN,CHAT_NOTIFY_TELEGRAM_CHAT_ID,CHAT_NOTIFY_TELEGRAM_CONFIRMED_CHAT_ID,SUPPORT_NOTIFY_STATE}=process.env;
  if(!CHAT_NOTIFY_DATABASE_URL||!SUPPORT_NOTIFY_STATE) throw Error('Missing configuration');
  const send=createSender({token:CHAT_NOTIFY_TELEGRAM_TOKEN,chatId:CHAT_NOTIFY_TELEGRAM_CHAT_ID,confirmedChatId:CHAT_NOTIFY_TELEGRAM_CONFIRMED_CHAT_ID});
  const sql=postgres(CHAT_NOTIFY_DATABASE_URL,{max:1,onnotice(){},connection:{default_transaction_read_only:'on'}});
  const db=state(SUPPORT_NOTIFY_STATE);
  try {const r=await runOnce(sql,db,{send}); console.log(JSON.stringify(r)); if(r.uncertain||r.processing) process.exitCode=2; else if(r.scanSaturated||r.enrichment?.failed) process.exitCode=1;}
  finally {db.progressive.close();db.close();await sql.end({timeout:5});}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(()=>{console.error('Support worker failed; investigate configuration securely.');process.exitCode=1});
