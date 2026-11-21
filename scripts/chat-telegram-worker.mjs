import postgres from 'postgres';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {loadOrderContext,unavailableContext,orderBrief,inline,translateMessage} from './chat-notification-context.mjs';
import {openProgressive,notificationParts,telegramSender} from './telegram-progressive.mjs';
import {bilingualDraft} from './telegram-bilingual.mjs';

// processing is intentionally never retried automatically: provider outcomes can be ambiguous.
export async function runOnce(sql,{dryRun=false,send,limit=50,draft,draftTimeoutMs=45000,loadContext=loadOrderContext,translate=translateMessage,settleSeconds=0,history,progressive,enrich=true}={}) {
  if(!dryRun&&!progressive)throw Error('Missing durable progressive ledger');
  const enrichMessage=async message=>{
    if(history)try{message.history=await history(sql,message);}catch{}
    message.orderContext=unavailableContext();
    try{message.orderContext=await loadContext(sql,message)||unavailableContext();}catch{}
    message.orderSummary=orderBrief(message.orderContext);
    message.customerStatus=message.orderContext.customerStatus||'unknown';
    try{message.translation=await translate(message.body);}catch{message.translation={status:'unavailable'};}
    message.draft=null;message.preparing=false;
    if(draft){const controller=new AbortController();let timer;
      try{const result=await Promise.race([draft(message,{signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Draft timeout'));},draftTimeoutMs);})]);
        if(typeof result==='object'&&result)Object.assign(message,result);
        else if(typeof result==='string')message.draft=result;
      }finally{clearTimeout(timer);}
    }
    // Cache-based translation may finish on a later tick; retry enrichment instead
    // of freezing a pending translation permanently.
    if(message.translation?.status==='pending')return null;
    return message;
  };
  if(!Number.isInteger(settleSeconds)||settleSeconds<0||settleSeconds>600)throw new Error('Invalid settle delay');
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Invalid limit');
  if(!Number.isInteger(draftTimeoutMs)||draftTimeoutMs<1||draftTimeoutMs>45000)throw new Error('Invalid draft timeout');
  const [{n}] = await sql`SELECT count(*)::int AS n FROM chat_telegram_notifications
    WHERE status='pending' AND available_at <= now()`;
  if (!dryRun && typeof send !== 'function') throw new Error('Missing sender');
  let attempted=0,sent=0,failed=0;
  while(!dryRun && attempted<limit) {
    const token=randomUUID();
    // Claim the whole settled sender in ONE statement/snapshot. Two separate
    // claims could split a burst between overlapping workers, or swallow a message
    // arriving after the quiet-period check. Advisory locks only live in this SQL
    // transaction; hash collisions merely postpone an unrelated sender one tick.
    const rows=settleSeconds>0?await sql`WITH candidate AS MATERIALIZED (
      SELECT n.id, lower(btrim(m.from_email)) AS email
      FROM chat_telegram_notifications n JOIN support_messages m ON m.id=n.support_message_id
      WHERE n.status='pending' AND n.available_at <= now()
        AND NOT EXISTS (SELECT 1 FROM chat_telegram_notifications p
          JOIN support_messages pm ON pm.id=p.support_message_id
          WHERE p.status='pending' AND lower(btrim(pm.from_email))=lower(btrim(m.from_email))
            AND p.available_at > now()-make_interval(secs=>${settleSeconds}))
        AND pg_try_advisory_xact_lock(hashtextextended(lower(btrim(m.from_email)), 90117))
      ORDER BY n.available_at,n.id FOR UPDATE OF n SKIP LOCKED LIMIT 1)
      UPDATE chat_telegram_notifications n SET status='processing', attempts=n.attempts+1,
        lock_token=${token}::uuid, locked_until=now()+interval '1 minute', updated_at=now(), last_error=NULL
      FROM support_messages m,candidate c
      WHERE m.id=n.support_message_id AND n.status='pending' AND n.available_at<=now()
        AND lower(btrim(m.from_email))=c.email
      RETURNING n.id,n.support_message_id,m.from_email AS email,m.body_text AS body,
        to_jsonb(m)->>'order_id' AS "orderId"`
      :await sql`UPDATE chat_telegram_notifications SET status='processing', attempts=attempts+1,
        lock_token=${token}::uuid, locked_until=now()+interval '1 minute', updated_at=now(), last_error=NULL
        WHERE id=(SELECT id FROM chat_telegram_notifications WHERE status='pending' AND available_at <= now()
          ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
        AND status='pending' RETURNING id,support_message_id`;
    if (!rows.length) break;
    attempted++;
    try {
      const messages=settleSeconds>0
        ?rows.map(r=>({...r,id:r.support_message_id})).sort((a,b)=>a.id-b.id)
        :await sql`SELECT id, from_email AS email, body_text AS body, to_jsonb(m)->>'received_at' AS "receivedAt", to_jsonb(m)->>'subject' AS subject, CASE WHEN to_jsonb(m)->>'message_id' LIKE 'contact-%' THEN 'contact' ELSE 'chat' END AS channel, to_jsonb(m)->>'order_id' AS "orderId" FROM support_messages m WHERE id=${rows[0].support_message_id}`;
      if(!messages.length) throw new Error('Missing message');
      const message={...messages[0]};
      message.groupedIds=messages.map(m=>m.id);
      // Do not silently attach a multi-order burst to its first order.
      const orderIds=[...new Set(messages.map(m=>m.orderId).filter(Boolean))];
      message.conflictingOrders=orderIds.length>1;
      message.orderId=orderIds.length===1?orderIds[0]:undefined;
      if(messages.length>1)message.body=messages.map((m,i)=>`Message ${i+1} (chat #${m.id}) :\n${m.body}`).join('\n\n');
      message.preparing=true;
      await progressive.initial(`chat:${message.id}`,message,send);
    } catch { failed++; continue; }
    const done=await sql`UPDATE chat_telegram_notifications SET status='sent',sent_at=now(),
      locked_until=NULL, lock_token=NULL, updated_at=now()
      WHERE (id=${rows[0].id} OR lock_token=${token}::uuid) AND status='processing' AND lock_token=${token}::uuid RETURNING id`;
    if(done.length===rows.length) sent++; else failed++;
  }
  const [counts]=await sql`SELECT
    count(*) FILTER (WHERE status='pending')::int AS pending,
    count(*) FILTER (WHERE status='processing')::int AS processing,
    count(*) FILTER (WHERE status='processing' AND (locked_until IS NULL OR locked_until <= now()))::int AS "staleProcessing"
    FROM chat_telegram_notifications`;
  const enrichment=!dryRun&&enrich?await progressive.run({send,enrich:enrichMessage,limit:1}):undefined;
  return {eligible:n,attempted,sent,failed,...counts,...(enrichment?{enrichment}:{})};
}

export const formatNotificationParts=notificationParts;
export function formatNotification(message){return notificationParts(message).map(p=>p.text);}
export const createSender=telegramSender;

// Hermes send interprets MEDIA: directives in text. Never pass untrusted data to it.
export function createHermesSender() {
  throw new Error('Hermes transport disabled for untrusted chat content');
}

// Keep the new message complete; reject rather than silently clip oversized input.
export function draftInput(message) {
  if(typeof message.body!=='string'||message.body.length>100000)throw Error('Full chat exceeds draft capacity');
  const context=[message.orderContext?'Commande : '+orderBrief(message.orderContext):'',
    message.history?'Échanges récents :\n'+message.history:''].filter(Boolean).join('\n');
  const prefix='[Contexte]\n',separator='\n[Nouveau message]\n';
  const room=Math.min(4000,100000-message.body.length-prefix.length-separator.length);
  let brief=room>80?context.slice(0,room):'';
  if(/[\uD800-\uDBFF]$/.test(brief))brief=brief.slice(0,-1);
  return {subject:'Message du chat Cartoonova',bodyText:(brief?prefix+brief+separator:'')+message.body};
}

export async function loadHistory(db,m) {
  const rows=await db`SELECT * FROM (
    SELECT received_at AS at, 'Client' AS who, body_text AS body, id AS source_id
    FROM support_messages WHERE lower(btrim(from_email))=lower(btrim(${m.email}))
      AND id<${m.id} AND received_at>now()-interval '48 hours'
    UNION ALL SELECT sent_at, 'Cartoonova', body_text, id FROM support_replies
    WHERE lower(btrim(to_email))=lower(btrim(${m.email})) AND sent_at IS NOT NULL
      AND sent_at>now()-interval '48 hours'
    ) t ORDER BY at DESC,who,source_id DESC LIMIT 6`;
  return rows.reverse().map(r=>`${r.who} : ${inline(String(r.body??''),300)}`).join('\n');
}

async function main() {
  const args=process.argv.slice(2);
  if(args.some(x=>x!=='--send') || args.length>1) throw new Error('Usage: node scripts/chat-telegram-worker.mjs [--send]');
  const dryRun=!args.includes('--send');
  if(!process.env.CHAT_NOTIFY_DATABASE_URL) throw new Error('Missing CHAT_NOTIFY_DATABASE_URL');
  const destination={chatId:process.env.CHAT_NOTIFY_TELEGRAM_CHAT_ID,confirmedChatId:process.env.CHAT_NOTIFY_TELEGRAM_CONFIRMED_CHAT_ID};
  const send=dryRun?undefined:process.env.CHAT_NOTIFY_TRANSPORT==='hermes'
    ?createHermesSender(destination)
    :createSender({...destination,token:process.env.CHAT_NOTIFY_TELEGRAM_TOKEN});
  const sql=postgres(process.env.CHAT_NOTIFY_DATABASE_URL,{max:2,onnotice(){}});
  const progressive=dryRun?null:openProgressive(process.env.CHAT_NOTIFY_TRANSLATION_STATE||'/home/hermes/.hermes/profiles/cartoonova/state/chat-translation-followups/queue.sqlite');
  try {
    const draft=async(message,{signal})=>bilingualDraft(draftInput(message),{signal});
    const result=await runOnce(sql,{dryRun,send,progressive,draft,limit:50,settleSeconds:0,history:loadHistory,enrich:process.env.TELEGRAM_RECEIVE_ONLY!=='1'});
    console.log(JSON.stringify(result));
    if(result.failed||result.staleProcessing||result.enrichment?.failed)process.exitCode=1;
  }finally{progressive?.close();await sql.end({timeout:5});}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(()=>{console.error('Chat notification worker failed; inspect configuration and database securely.');process.exitCode=1;});