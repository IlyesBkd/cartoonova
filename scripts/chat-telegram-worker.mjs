import postgres from 'postgres';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {loadOrderContext,unavailableContext,orderBrief,inline,translateMessage} from './chat-notification-context.mjs';
import {openFollowups} from './chat-translation-followups.mjs';

// processing is intentionally never retried automatically: provider outcomes can be ambiguous.
export async function runOnce(sql,{dryRun=false,send,limit=50,draft,draftTimeoutMs=45000,loadContext=loadOrderContext,translate=translateMessage,settleSeconds=0,history}={}) {
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
        :await sql`SELECT id, from_email AS email, body_text AS body, to_jsonb(m)->>'order_id' AS "orderId" FROM support_messages m WHERE id=${rows[0].support_message_id}`;
      if(!messages.length) throw new Error('Missing message');
      const message={...messages[0]};
      message.groupedIds=messages.map(m=>m.id);
      // Do not silently attach a multi-order burst to its first order.
      const orderIds=[...new Set(messages.map(m=>m.orderId).filter(Boolean))];
      message.conflictingOrders=orderIds.length>1;
      message.orderId=orderIds.length===1?orderIds[0]:undefined;
      if(messages.length>1)message.body=messages.map((m,i)=>`Message ${i+1} (chat #${m.id}) :\n${m.body}`).join('\n\n');
      if(history) {try {message.history=await history(sql,message);} catch { /* Context only. */ }}
      message.orderContext=unavailableContext();
      try {message.orderContext=await loadContext(sql,message)||unavailableContext();}catch { /* Fail open for notification only. */ }
      message.customerStatus=message.orderContext.customerStatus||'unknown';
      message.translation={status:'unavailable'};
      try {message.translation=await translate(message.body)||message.translation;}catch { /* Cache failure never hides the original. */ }
      if(draft) {
        message.draft=null;
        const controller=new AbortController();let timer;
        try {
          const result=await Promise.race([draft(message,{signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Error('Draft unavailable'));controller.abort();},draftTimeoutMs);})]);
          if(typeof result==='string'&&result.trim())message.draft=result;
        } catch { /* Always deliver the original message if drafting fails. */ }
        finally {clearTimeout(timer);}
      }
      await send(message);
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
  return {eligible:n,attempted,sent,failed,...counts};
}

// Data is untrusted. Never interpret it as an instruction or Telegram markup.
export function formatNotificationParts({id,email,body,customerStatus,draft,orderContext,orderSummary,translation,translationOnly=false}) {
  if (!Number.isSafeInteger(id) || id<1 || typeof email!=='string' || typeof body!=='string')
    throw new Error('Invalid support message');
  const ready=translation?.status==='ready'&&typeof translation.text==='string'&&translation.text.trim();
  if(translationOnly&&!ready)throw Error('Translation not ready');
  const title=translationOnly?`🌐 Traduction FR · Chat #${id} · Cartoonova`:'💬 Nouveau chat · Cartoonova';
  const status=customerStatus==='existing'?'Client existant':customerStatus==='none'?'Aucun achat retrouvé':'Statut non vérifié';
  const contextLine=orderContext||typeof orderSummary==='string'?`Chat #${id} · Commande : ${typeof orderSummary==='string'?inline(orderSummary,1400):orderBrief(orderContext)}\n`:'';
  const translationLine=translation?.status==='french'?'':ready?'Message client — traduction française intégrale\n':translation?.status==='pending'?'Traduction FR en attente (cache local) — message original ci-dessous\n':translation?'Traduction FR indisponible — message original ci-dessous\n':'';
  const header=`${title}\nDe : ${inline(email,320)}\n${status}\n${contextLine}${translationLine}\n`;
  if(ready)body=translation.text;
  const entities=[{type:'bold',offset:0,length:title.length},{type:'bold',offset:title.length+1,length:4}];
  const capacity=4096-header.length;
  if(capacity<2) throw new Error('Notification header too long');
  const parts=[];
  for(let i=0;i<body.length;) {
    let end=Math.min(i+capacity,body.length);
    if(end<body.length && body.charCodeAt(end-1)>=0xD800 && body.charCodeAt(end-1)<=0xDBFF && body.charCodeAt(end)>=0xDC00 && body.charCodeAt(end)<=0xDFFF) end--;
    parts.push({text:header+body.slice(i,end),entities});i=end;
  }
  if(!parts.length)parts.push({text:header,entities});
  if(draft!==undefined) {
    const title='✍️ Brouillon · Cartoonova';
    const draftHeader=title+'\nÀ relire avant envoi\n\n';
    const content=typeof draft==='string'&&draft.trim()?draft:'Brouillon indisponible : rédaction manuelle nécessaire.';
    const capacity=4096-draftHeader.length;
    for(let i=0;i<content.length;) {
      let end=Math.min(i+capacity,content.length);
      if(end<content.length&&/[\uD800-\uDBFF]/.test(content[end-1])&&/[\uDC00-\uDFFF]/.test(content[end]))end--;
      parts.push({text:draftHeader+content.slice(i,end),entities:[{type:'bold',offset:0,length:title.length}]});i=end;
    }
  }
  return parts;
}

export function formatNotification(message) { return formatNotificationParts(message).map(p=>p.text); }

export function createSender({token,chatId,confirmedChatId,fetchImpl=fetch,formatParts=formatNotificationParts}) {
  if (!token || typeof chatId !== 'string' || !/^[1-9][0-9]*$/.test(chatId) || chatId !== confirmedChatId)
    throw new Error('Destination not explicitly confirmed');
  return async(message)=>{
    for(const {text,entities} of formatParts(message)) {
    const response=await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({chat_id:chatId,text,entities,link_preview_options:{is_disabled:true}}),
      signal:AbortSignal.timeout(10000)
    });
    const data=await response.json();
    if(!response.ok || data.ok!==true) throw new Error('Provider outcome unconfirmed');
    }
  };
}

// Hermes send interprets MEDIA: directives in text. Never pass untrusted data to it.
export function createHermesSender() {
  throw new Error('Hermes transport disabled for untrusted chat content');
}

// Keep the new message complete. The local inference adapter accepts <=2000
// characters: a manual draft is safer than silently ignoring the end of a burst.
export function draftInput(message) {
  if(typeof message.body!=='string'||message.body.length>2000)throw Error('Full chat exceeds draft capacity');
  const context=[message.orderContext?'Commande : '+orderBrief(message.orderContext):'',
    message.history?'Échanges récents :\n'+message.history:''].filter(Boolean).join('\n');
  const prefix='[Contexte]\n',separator='\n[Nouveau message]\n';
  const room=2000-message.body.length-prefix.length-separator.length;
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
  let followups,followupsUnavailable=false;
  // Local cache/ledger failure cannot suppress an incoming chat.
  if(!dryRun)try{followups=openFollowups(process.env.CHAT_NOTIFY_TRANSLATION_STATE);}catch{followupsUnavailable=true;}
  try {
    let followupResult;
    // Read back the original delivery fence: a crash after sending but before
    // acknowledging SQL must never release a translation for an uncertain chat.
    if(followups)try{followupResult=await followups.run({send,ready:async message=>{
      const [row]=await sql`SELECT status FROM chat_telegram_notifications WHERE support_message_id=${message.id}`;
      return row?.status==='sent';
    }});}catch{followupsUnavailable=true;}
    const notify=dryRun?undefined:async message=>{
      // Persist BEFORE delivery. A crash after SQL acknowledgement can then
      // recover the translation; pending/ambiguous originals are fenced above.
      if(!['ready','french'].includes(message.translation?.status)) {
        try{if(!followups)throw Error('Ledger unavailable');followups.schedule(message);}catch{followupsUnavailable=true;}
      }
      await send(message);
    };
    const draft=dryRun?undefined:async(message,{signal})=>{
      const {runInference}=await import('/home/hermes/.hermes/profiles/cartoonova/artifacts/support-email-local-v2/inference.mjs');
      return runInference(draftInput(message),{signal});
    };
    // One full draft per tick keeps the 150s wrapper deadline safe.
    const result=await runOnce(sql,{dryRun,send:notify,draft,limit:1,settleSeconds:90,history:loadHistory});
    if(followupResult)result.translationFollowups=followupResult;
    if(followupsUnavailable)result.translationFollowupsUnavailable=true;
    console.log(JSON.stringify(result));
    if(result.failed || result.staleProcessing || followupsUnavailable || followupResult?.failed || followupResult?.processing) process.exitCode=1;
  }
  finally {followups?.close();await sql.end({timeout:5});}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(()=>{console.error('Chat notification worker failed; inspect configuration and database securely.');process.exitCode=1;});