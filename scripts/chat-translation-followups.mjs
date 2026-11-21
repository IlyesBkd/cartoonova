// Separate local delivery ledger. Never reads/writes the existing chat dedup state.
// Ambiguous Telegram outcomes stay processing, exactly like the original worker.
import {openQueue} from '/home/hermes/.hermes/profiles/cartoonova/scripts/notification-translation.mjs';
import {translateMessage,orderBrief} from './chat-notification-context.mjs';
export const DEFAULT_STATE='/home/hermes/.hermes/profiles/cartoonova/state/chat-translation-followups/queue.sqlite';
export function openFollowups(path=DEFAULT_STATE) {
 // Reuse the queue's hardened 0700/0600, NOFOLLOW and busy_timeout handling.
 // Its empty translations table is unused here; the existing translation cache
 // remains the only source of translations and is never modified by this ledger.
 const db=openQueue(path);
 try{db.exec(`CREATE TABLE IF NOT EXISTS chat_followups(id INTEGER PRIMARY KEY,payload TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','processing','sent')) DEFAULT 'pending');`);}catch(error){db.close();throw error;}
 return {
  close:()=>db.close(),
  schedule(message) {
   const {id,email,body,orderContext,customerStatus}=message;
   if(!Number.isSafeInteger(id)||id<1||typeof email!=='string'||typeof body!=='string')throw Error('Invalid followup');
   // Snapshot only the displayed brief, not raw options/addresses/history.
   db.prepare('INSERT OR IGNORE INTO chat_followups(id,payload) VALUES (?,?)').run(id,JSON.stringify({id,email,body,orderSummary:orderBrief(orderContext),customerStatus}));
  },
  async run({send,translate=translateMessage,ready=async()=>true,limit=1}={}) {
   if(typeof send!=='function'||typeof ready!=='function'||!Number.isInteger(limit)||limit<1||limit>50)throw Error('Invalid followup options');
   let attempted=0,sent=0,failed=0;
   for(const row of db.prepare("SELECT id,payload FROM chat_followups WHERE state='pending' ORDER BY id").all()) {
    if(attempted>=limit)break;
    const message=JSON.parse(row.payload);let translation;
    try{if(!await ready(message))continue;translation=await translate(message.body);}catch{continue;}
    if(translation?.status!=='ready'||typeof translation.text!=='string'||!translation.text.trim())continue;
    // Conditional atomic claim also fences overlapping worker invocations.
    if(!db.prepare("UPDATE chat_followups SET state='processing' WHERE id=? AND state='pending'").run(row.id).changes)continue;
    attempted++;
    try {
     await send({...message,translation,translationOnly:true});
     db.prepare("UPDATE chat_followups SET state='sent' WHERE id=? AND state='processing'").run(row.id);sent++;
    }catch{failed++;}
   }
   const {pending,processing}=db.prepare("SELECT count(*) FILTER (WHERE state='pending') AS pending,count(*) FILTER (WHERE state='processing') AS processing FROM chat_followups").get();
   return {attempted,sent,failed,pending,processing};
  }
 };
}
