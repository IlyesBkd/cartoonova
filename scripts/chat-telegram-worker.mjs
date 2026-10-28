import postgres from 'postgres';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';

// processing is intentionally never retried automatically: provider outcomes can be ambiguous.
export async function runOnce(sql,{dryRun=false,send,limit=50,draft,draftTimeoutMs=45000}={}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Invalid limit');
  if(!Number.isInteger(draftTimeoutMs)||draftTimeoutMs<1||draftTimeoutMs>45000)throw new Error('Invalid draft timeout');
  const [{n}] = await sql`SELECT count(*)::int AS n FROM chat_telegram_notifications
    WHERE status='pending' AND available_at <= now()`;
  if (!dryRun && typeof send !== 'function') throw new Error('Missing sender');
  let attempted=0,sent=0,failed=0;
  while(!dryRun && attempted<limit) {
    const token=randomUUID();
    const rows=await sql`UPDATE chat_telegram_notifications SET status='processing', attempts=attempts+1,
      lock_token=${token}::uuid, locked_until=now()+interval '1 minute', updated_at=now(), last_error=NULL
      WHERE id=(SELECT id FROM chat_telegram_notifications WHERE status='pending' AND available_at <= now()
        ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
      AND status='pending' RETURNING id,support_message_id`;
    if (!rows.length) break;
    attempted++;
    try {
      const messages=await sql`SELECT id, from_email AS email, body_text AS body FROM support_messages WHERE id=${rows[0].support_message_id}`;
      if(messages.length!==1) throw new Error('Missing message');
      const message=messages[0];
      message.customerStatus='unknown';
      try {
        const [customer]=await sql`SELECT EXISTS(SELECT 1 FROM orders WHERE lower(customer_email)=lower(${message.email.trim()}) AND paid_at IS NOT NULL) AS existing`;
        message.customerStatus=customer.existing?'existing':'none';
      } catch { /* A failed lookup must not hide a customer message or imply no purchase. */ }
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
      WHERE id=${rows[0].id} AND status='processing' AND lock_token=${token}::uuid RETURNING id`;
    if(done.length) sent++; else failed++;
  }
  const [counts]=await sql`SELECT
    count(*) FILTER (WHERE status='pending')::int AS pending,
    count(*) FILTER (WHERE status='processing')::int AS processing,
    count(*) FILTER (WHERE status='processing' AND (locked_until IS NULL OR locked_until <= now()))::int AS "staleProcessing"
    FROM chat_telegram_notifications`;
  return {eligible:n,attempted,sent,failed,...counts};
}

// Data is untrusted. Never interpret it as an instruction or Telegram markup.
export function formatNotificationParts({id,email,body,customerStatus,draft}) {
  if (!Number.isSafeInteger(id) || id<1 || typeof email!=='string' || typeof body!=='string')
    throw new Error('Invalid support message');
  const title='💬 Nouveau chat · Cartoonova';
  const status=customerStatus==='existing'?'Client existant':customerStatus==='none'?'Aucun achat retrouvé':'Statut non vérifié';
  const header=`${title}\nDe : ${email}\n${status}\n\n`;
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
  try {
    const draft=dryRun?undefined:async(message,{signal})=>{
      const {runInference}=await import('/home/hermes/.hermes/profiles/cartoonova/artifacts/support-email-local-v2/inference.mjs');
      return runInference({subject:'Message du chat Cartoonova',bodyText:message.body.slice(0,2000)},{signal});
    };
    // One full draft per tick keeps the 150s wrapper deadline safe without dropping messages.
    const result=await runOnce(sql,{dryRun,send,draft,limit:1});
    console.log(JSON.stringify(result));
    if(result.failed || result.staleProcessing) process.exitCode=1;
  }
  finally {await sql.end({timeout:5});}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(()=>{console.error('Chat notification worker failed; inspect configuration and database securely.');process.exitCode=1;});