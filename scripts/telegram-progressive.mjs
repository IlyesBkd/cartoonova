// Durable local delivery fence shared by chat/contact and email. No production DDL.
import {randomUUID} from 'node:crypto';
import {customerContextSummary} from './customer-notification-context.mjs';
import {openQueue} from '/home/hermes/.hermes/profiles/cartoonova/scripts/notification-translation.mjs';
const clean=v=>String(v??'non renseigné').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu,' ');
export function notificationParts(m) {
 const date=new Date(m.receivedAt??NaN);
 const received=Number.isFinite(date.getTime())?new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Paris'}).format(date)+' (Paris)':'non renseignée';
 const header=`${m.channel==='email'?'✉️ Nouvel email':'💬 Nouveau message'} · Cartoonova · #${m.id}\n📅 Date : ${received}\n👤 Client / expéditeur : ${clean(m.email)}\n📨 Canal : ${clean(m.channel??'chat')}\n📝 Objet : ${clean(m.subject??'(sans objet)')}\n📦 Commande : ${clean(m.orderSummary??'Contexte en préparation, identité non authentifiée')}\n`;
 const t=m.translation;
 const context=m.customerContext?customerContextSummary(m.customerContext):'';
 const content=`${header}${context?'\n'+context+'\n':''}\n📩 Message original intégral\n${m.body}\n\n${t?.status==='ready'?`🇫🇷 Traduction française intégrale\n${t.text}\n\n`:t?.status==='french'?'🇫🇷 Langue du client : français\n\n':'⏳ Traduction française : en préparation / indisponible\n\n'}${m.preparing!==false?'⏳ Préparation en cours — brouillon, rien envoyé':`✍️ Brouillon — rien envoyé · langue client : ${clean(m.language??'à déterminer')}\n${m.draft??'Indisponible : rédaction manuelle nécessaire.'}\n\n🇫🇷 Version française du brouillon\n${m.draftFR??(m.language==='fr'?m.draft:null)??'Indisponible : rédaction manuelle nécessaire.'}`}\n\nBrouillon uniquement. Rien d’envoyé au client.`;
 // Reserve numbering overhead; UTF-16 boundaries match Telegram entity offsets.
 const chunks=[];for(let i=0;i<content.length;){let end=Math.min(i+3960,content.length);if(/[\uD800-\uDBFF]/.test(content[end-1])&&/[\uDC00-\uDFFF]/.test(content[end]??''))end--;chunks.push(content.slice(i,end));i=end;}
 return chunks.map((text,i)=>{
  text=(chunks.length>1?`[${m.channel??'chat'} #${m.id} · partie ${i+1}/${chunks.length}]\n`:'')+text;
  const headings=/^(?:✉️ Nouvel email[^\n]*|💬 Nouveau message[^\n]*|📩 Message original intégral|🇫🇷 Traduction française intégrale|✍️ Brouillon — rien envoyé[^\n]*|🇫🇷 Version française du brouillon|⏳ Préparation en cours[^\n]*)$/gm;
  const entities=[...text.matchAll(headings)].map(match=>({type:'bold',offset:match.index,length:match[0].length}));
  return {text,entities};
 });
}
export function telegramSender({token,chatId,confirmedChatId,fetchImpl=fetch,formatParts=notificationParts}) {
 if(!token||typeof chatId!=='string'||! /^[1-9][0-9]*$/.test(chatId)||chatId!==confirmedChatId)throw Error('Destination not explicitly confirmed');
 const request=async(method,payload)=>{
  const response=await fetchImpl(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,...payload,link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(10000)});
  const data=await response.json();
  if(method==='editMessageText'&&data.error_code===400&&/message is not modified/i.test(data.description??''))return;
  if(!response.ok||data.ok!==true)throw Error('Provider outcome unconfirmed');
  if(method==='sendMessage'&&!Number.isSafeInteger(data.result?.message_id))throw Error('Provider message id missing');
  return data.result?.message_id;
 };
 const send=async(m,{existingIds=[],onPart=()=>{},beforePart=()=>{}}={})=>{
  const ids=[...existingIds],parts=formatParts(m);
  for(let i=0;i<parts.length;i++) {
   beforePart({append:!ids[i],index:i});
   if(ids[i])await request('editMessageText',{message_id:ids[i],...parts[i]});
   else {const id=await request('sendMessage',{...parts[i],...(ids[0]?{reply_parameters:{message_id:ids[0]}}:{})});onPart(id,i);ids[i]=id;}
  }
  // Never leave stale draft/translation text in now-unused continuation pages.
  for(let i=parts.length;i<ids.length;i++)await request('editMessageText',{message_id:ids[i],text:`[${m.channel??'chat'} #${m.id} · partie ${i+1}] Suite regroupée dans les parties précédentes.`,entities:[]});
  return ids;
 };
 send.destination=chatId;return send;
}
export function openProgressive(path,{db:existing}={}) {
 const db=existing??openQueue(path);
 db.exec(`CREATE TABLE IF NOT EXISTS telegram_progressive_v1(k TEXT PRIMARY KEY,payload TEXT NOT NULL,destination TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'initial',ids TEXT NOT NULL DEFAULT '[]',desired TEXT,owner TEXT,lease INTEGER,error TEXT);`);
 if(!db.prepare('PRAGMA table_info(telegram_progressive_v1)').all().some(c=>c.name==='touched')){
  try{db.exec('ALTER TABLE telegram_progressive_v1 ADD COLUMN touched INTEGER NOT NULL DEFAULT 0');}catch(error){if(!db.prepare('PRAGMA table_info(telegram_progressive_v1)').all().some(c=>c.name==='touched'))throw error;}
 }
 const get=k=>db.prepare('SELECT * FROM telegram_progressive_v1 WHERE k=?').get(k);
 const saveIds=(k,id,i)=>{if(!Number.isSafeInteger(id)||id<1)throw Error('Invalid Telegram id');const ids=JSON.parse(get(k).ids);ids[i]=id;db.prepare('UPDATE telegram_progressive_v1 SET ids=?,error=NULL WHERE k=?').run(JSON.stringify(ids),k);};
 return {db,close:()=>{if(!existing)db.close();},get,
  async initial(k,message,send) {
   if(!send.destination)throw Error('Sender destination missing');
   if(!db.prepare('INSERT OR IGNORE INTO telegram_progressive_v1(k,payload,destination) VALUES (?,?,?)').run(k,JSON.stringify(message),send.destination).changes){
    const old=get(k);if(old.destination!==send.destination||old.state==='initial')throw Error('Initial outcome unconfirmed');return false;
   }
   // Insert initial fence BEFORE external I/O; ambiguous calls never replay.
   await send(message,{onPart:(id,i)=>saveIds(k,id,i)});
   if(JSON.parse(get(k).ids).length!==notificationParts(message).length)throw Error('Sender did not persist all message ids');
   db.prepare("UPDATE telegram_progressive_v1 SET state='pending' WHERE k=?").run(k);return true;
  },
  async run({send,enrich,limit=5,leaseMs=120000,now=()=>Date.now()}={}) {
   let edited=0,failed=0;
   // A fully acknowledged original can resume after a crash before the final state write.
   for(const r of db.prepare("SELECT * FROM telegram_progressive_v1 WHERE state='initial'").all()){
    if(JSON.parse(r.ids).length===notificationParts(JSON.parse(r.payload)).length)db.prepare("UPDATE telegram_progressive_v1 SET state='pending' WHERE k=? AND state='initial'").run(r.k);
   }
   const rows=db.prepare("SELECT * FROM telegram_progressive_v1 WHERE state IN ('pending','editing') AND (lease IS NULL OR lease<=?) ORDER BY touched,rowid LIMIT ?").all(now(),limit);
   for(const row of rows) {
    if(row.destination!==send.destination)continue;
    const owner=randomUUID();
    if(!db.prepare("UPDATE telegram_progressive_v1 SET owner=?,lease=?,touched=? WHERE k=? AND (lease IS NULL OR lease<=?)").run(owner,now()+leaseMs,now(),row.k,now()).changes)continue;
    try {
     let desired=row.desired?JSON.parse(row.desired):null;
     if(!desired){desired=await enrich(JSON.parse(row.payload));if(!desired)throw Error('Enrichment pending');
      if(!db.prepare("UPDATE telegram_progressive_v1 SET desired=?,state='editing' WHERE k=? AND owner=? AND lease>?").run(JSON.stringify(desired),row.k,owner,now()).changes)continue;}
     if(get(row.k).owner!==owner||get(row.k).lease<=now())continue;
     // For an appended page, fence ambiguous outcomes before calling Telegram.
     const ids=JSON.parse(get(row.k).ids),needed=notificationParts(desired).length;
     if(needed>ids.length&&row.error==='append-uncertain')throw Error('Ambiguous continuation requires manual review');
     await send(desired,{existingIds:ids,onPart:(id,i)=>saveIds(row.k,id,i),beforePart:({append=false}={})=>{
      if(!db.prepare('UPDATE telegram_progressive_v1 SET lease=? WHERE k=? AND owner=? AND lease>?').run(now()+leaseMs,row.k,owner,now()).changes)throw Error('Edit lease lost');
      // Fence only a genuinely new send, not a replay-safe edit. Confirmed IDs
      // clear this fence atomically, including between multiple appended pages.
      if(append)db.prepare("UPDATE telegram_progressive_v1 SET error='append-uncertain' WHERE k=? AND owner=?").run(row.k,owner);
     }});
     db.prepare("UPDATE telegram_progressive_v1 SET state='done',owner=NULL,lease=NULL,error=NULL WHERE k=? AND owner=?").run(row.k,owner);edited++;
    }catch {failed++;db.prepare('UPDATE telegram_progressive_v1 SET owner=NULL,lease=NULL WHERE k=? AND owner=?').run(row.k,owner);}
   }
   return {edited,failed};
  }
 };
}
