import postgres from 'postgres';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);

// processing is intentionally never retried automatically: provider outcomes can be ambiguous.
export async function runOnce(sql,{dryRun=false,send,limit=50}={}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Invalid limit');
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
    try { await send(rows[0].support_message_id); } catch { failed++; continue; }
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

export function createSender({token,chatId,confirmedChatId,fetchImpl=fetch}) {
  if (!token || typeof chatId !== 'string' || !/^[1-9][0-9]*$/.test(chatId) || chatId !== confirmedChatId)
    throw new Error('Destination not explicitly confirmed');
  return async(id)=>{
    if (!Number.isSafeInteger(id) || id<1) throw new Error('Invalid support identifier');
    const response=await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({chat_id:chatId,text:`Cartoonova : nouveau message chat. Identifiant support : ${id}.`}),
      signal:AbortSignal.timeout(10000)
    });
    const data=await response.json();
    if(!response.ok || data.ok!==true) throw new Error('Provider outcome unconfirmed');
  };
}

export function createHermesSender({chatId,confirmedChatId,exec=execFileAsync}) {
  if (typeof chatId !== 'string' || !/^[1-9][0-9]*$/.test(chatId) || chatId !== confirmedChatId)
    throw new Error('Destination not explicitly confirmed');
  return async(id)=>{
    if (!Number.isSafeInteger(id) || id<1) throw new Error('Invalid support identifier');
    await exec('/home/hermes/.local/bin/hermes', ['send','--quiet','--to',`telegram:${chatId}`,
      `Cartoonova : nouveau message chat. Identifiant support : ${id}.`],
      {timeout:30000, maxBuffer:65536});
  };
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
    const result=await runOnce(sql,{dryRun,send});
    console.log(JSON.stringify(result));
    if(result.failed || result.staleProcessing || (!dryRun && result.pending)) process.exitCode=1;
  }
  finally {await sql.end({timeout:5});}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(()=>{console.error('Chat notification worker failed; inspect configuration and database securely.');process.exitCode=1;});