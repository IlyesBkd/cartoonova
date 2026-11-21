// Private notification evidence only. No order mutation, supplier lookup or inference.
import {resolveInstructions} from '/home/hermes/.hermes/profiles/cartoonova/scripts/notification-translation.mjs';
export const unavailableContext=()=>({linkage:'unavailable',customerStatus:'unknown'});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function loadOrderContext(sql,message) {
 try {
  if(message.conflictingOrders)return {linkage:'contradiction',customerStatus:'unknown'};
  if(typeof message.email!=='string'||(message.orderId&&!uuid.test(message.orderId)))return unavailableContext();
  // Same exact-email/paid-at and explicit-link precedence as support-context-v1.
  // Deliberately omit its history/supplier adapter: private chat only needs a brief.
  return await sql.begin('isolation level repeatable read read only',async tx=>{
   await tx`SET LOCAL statement_timeout = '5000ms'`;
   const orders=await tx`SELECT to_jsonb(o)->>'id' AS id, o.customer_email, o.paid_at,
     to_jsonb(o)->>'created_at' AS created_at, o.status, to_jsonb(o)->'options' AS options
     FROM orders o WHERE (lower(o.customer_email)=lower(${message.email.trim()}) AND o.paid_at IS NOT NULL)
       OR (${message.orderId||null}::text IS NOT NULL AND to_jsonb(o)->>'id'=${message.orderId||null})
     ORDER BY (to_jsonb(o)->>'id'=${message.orderId||null}) DESC NULLS LAST LIMIT 3`;
   const paid=orders.filter(o=>o.customer_email?.toLowerCase()===message.email.trim().toLowerCase()&&o.paid_at);
   const customerStatus=paid.length?'existing':'none';
   let order;
   if(message.orderId) {
    order=orders.find(o=>o.id===message.orderId);
    if(!order||order.customer_email?.toLowerCase()!==message.email.trim().toLowerCase())return {linkage:'contradiction',customerStatus};
   }else if(paid.length>1)return {linkage:'ambiguous',customerStatus};
   else order=paid[0];
   return order?{linkage:'verified',customerStatus,order}:{linkage:'none',customerStatus};
  });
 }catch{return unavailableContext();}
}
// Inline metadata is bounded and cannot forge section boundaries or bold entities.
export function inline(value,max=120) {
 if(typeof value!=='string')return 'non renseigné';
 const text=value.toWellFormed().replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu,' ').replace(/\s+/gu,' ').trim();
 let result='';for(const ch of text){if(result.length+ch.length>max-1)return result+'…';result+=ch;}
 return result||'non renseigné';
}
const styles={simpson:'Simpsons',dbz:'Dragon Ball Z (DBZ)',ghibli:'Studio Ghibli',disney:'Disney'};
const supports={digital:'Numérique',posterSimple:'Poster',canvas:'Toile',framed:'Poster encadré'};
const formats={fullbody:'Corps entier',portrait:'Portrait (buste)',landscape:'Paysage',square:'Carré'};
export function orderBrief(context) {
 if(context?.linkage==='ambiguous')return 'Plusieurs commandes payées retrouvées · commande à préciser (aucune sélectionnée).';
 if(context?.linkage==='contradiction')return 'Rattachement contradictoire · commande à vérifier (aucune sélectionnée).';
 if(context?.linkage==='none')return 'Aucune commande payée retrouvée.';
 if(context?.linkage!=='verified'||!context.order)return 'Contexte commande indisponible · lecture non vérifiée.';
 const o=context.order;let options=o.options;
 if(typeof options==='string'){try{options=JSON.parse(options);}catch{options={};}}
 if(!options||typeof options!=='object'||Array.isArray(options))options={};
 const date=o.created_at?new Date(o.created_at):null;
 const dateFR=date&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat('fr-FR',{timeZone:'UTC',dateStyle:'short'}).format(date):'non renseignée';
 return `Date : ${dateFR} (UTC) · Portrait cartoon / ${inline(styles[options.style]??options.style)} · Support : ${inline(supports[options.printKey]??options.printOption??options.printKey)} · Format : ${inline(formats[options.format]??options.format)} · État enregistré : ${inline(o.status,80)}. Rattachement par email, identité non authentifiée.`;
}
// 11/11/2026: a message already in French needs no translation (the owner got the same text twice).
const FR_WORDS=new Set(['je','j','tu','il','elle','nous','vous','le','la','les','un','une','des','du','de','et','est','pas','ne','mon','ma','mes','votre','vos','notre','pour','avec','sur','dans','que','qui','ce','ça','cela','c','merci','bonjour','bonsoir','commande','photo','photos','dessin','aimerais','voudrais','pouvez','pouvons','beaucoup','oui','non','mais','aussi','très','si','au','aux','où','quand','comment','est-ce','modifier','rajouter','personnalisation','envoyé','reçu']);
const OTHER_WORDS=new Set(['the','and','is','you','my','to','of','for','with','order','please','hi','hello','thanks','thank','what','can','have','el','los','por','para','es','muy','gracias','hola','pedido','y','der','die','das','und','ist','ich','nicht','bitte','danke','il','che','per','non','grazie','ciao','sono','het','een','ik','niet','en','och','jag','är','tack','eu','obrigado','não','você']);
export function looksFrench(text){
 if(typeof text!=='string'||!text.trim())return false;
 const words=text.toLowerCase().normalize('NFC').split(/[^a-zàâäçéèêëîïôöùûüÿœæ'-]+/u).flatMap(w=>w.split("'")).filter(Boolean);
 let fr=0,other=0;for(const w of words){if(OTHER_WORDS.has(w))other++;else if(FR_WORDS.has(w))fr++;}
 // False negatives cost a translation; false positives suppress one altogether.
 // Shared words (il/non/en…) must not masquerade as French evidence, nor may
 // accents or a long French paragraph outweigh a foreign-language fragment.
 return fr>=2&&other===0;
}
export function translateMessage(body,{resolve=resolveInstructions,...options}={}) {
 try {
  // Group labels are metadata, not evidence of the customer's language.
  const fragments=String(body).split(/(?:^|\n\n)Message \d+ \(chat #\d+\) :\n/u).filter(s=>s.trim());
  if(fragments.length&&fragments.every(looksFrench))return {status:'french'};
  // Prefix is essential: instruction() removes everything BEFORE the first '|'.
  // It preserves every character of the chat, including leading/trailing whitespace
  // and additional pipes. Never truncate the text sent to the existing queue.
  const result=resolve({options:{description:'chat|'+body}},options);
  if(result.ready&&typeof result.instructionsFR==='string'&&result.instructionsFR.trim())return {status:'ready',text:result.instructionsFR};
  return {status:'pending'};
 }catch{return {status:'unavailable'};}
}
