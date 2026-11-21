// Context is advisory evidence, never authority to send or change an order.
const LANGUAGES=new Set(['fr','en','de','es','it','nl','pt','pl','sv','da']);
const clip=(v,n=160)=>String(v??'').slice(0,n);
export const safeText=(v,n=1000)=>clip(v,n).replace(/https?:\/\/[^\s<>"']+/gi,'[lien masqué]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email masqué]');
const stamp=v=>v ? new Date(v).toISOString() : null;
const unavailable=()=>({status:'unavailable',evidence:[],limitations:['Emails fournisseur indisponibles ; transporteur non vérifié.']});
async function defaultSupplier(order,options) {
  try {const m=await import('./supplier.mjs');return await m.supplierEvidence(order,options);} catch {return unavailable();}
}
export function emptyContext(reason='Contexte indisponible : lecture PostgreSQL impossible.') {
 return {version:1,observedAt:new Date().toISOString(),linkage:'unavailable',language:null,order:null,history:[],supplier:unavailable(),limitations:[reason],current:null,trackingUrl:null};
}
export function safeTrackingUrl(value) {
 try {
  const u=new URL(value); const hosts=['laposte.fr','colissimo.fr','chronopost.fr','dhl.com','dhl.de','ups.com','fedex.com','gls-group.com','mondialrelay.fr','dsv.com','dpdgroup.com','dpd.fr','postnord.com','postnord.se','postnord.dk','postnord.no','bring.com','bring.se','bring.no'];
  if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))return null;
  if(u.href.length>600||/token|signature|secret|auth|key|access|session|confirm/i.test(u.pathname+u.search+u.hash))return null;
  const allowed=new Set(['code','codes','numero','numeros','shipment','tracking','tracking-id','trackingnumber','tracknum','tracknums','id','lang','locale','match','refnumber','language_region','uimode','parcelnumber','idc','runtime']);
  if([...u.searchParams.keys()].some(k=>!allowed.has(k.toLowerCase())))return null;
  u.hash='';return u.href;
 }catch{return null;}
}
function supplierData(raw,asOf) {
 if(!raw||!['available','unavailable','not_applicable'].includes(raw.status))return unavailable();
 const evidence=[];
 for(const e of (Array.isArray(raw.evidence)?raw.evidence:[]).slice(0,4)) {
  if(!e||typeof e!=='object')continue;
  const at=e.date??e.receivedAt??e.received_at??e.sentAt??e.sent_at??null;
  if(!at||!Number.isFinite(Date.parse(at))||Date.parse(at)>Date.parse(asOf))continue;
  let text=e.text??e.excerpt??e.bodyText??e.summary;
  if(typeof e.declaredStatus==='string') {
   const states=new Set(['unknown','confirmed','processing','printing','production','shipped','delivered','cancelled','dispatched','in_production','in_transit','incident']);
   const status=states.has(e.declaredStatus)?e.declaredStatus:'unknown';
   text=`Statut déclaré par le fournisseur : ${status} ; négation expédition/livraison : ${e.shippingOrDeliveryNegated===true?'oui':'non établie'} ; transporteur déclaré : ${safeText(e.carrier,80)||'inconnu'} ; non vérifié auprès du transporteur.`;
  }
  if(typeof text!=='string'||!text.trim())continue;
  evidence.push({at:stamp(at),text:safeText(text,600),source:'email fournisseur — non vérifié auprès du transporteur'});
 }
 return {status:raw.status==='available'&&!evidence.length?'unavailable':raw.status,evidence,limitations:(Array.isArray(raw.limitations)?raw.limitations:[]).slice(0,4).filter(x=>typeof x==='string').map(x=>safeText(x,200))};
}
export async function loadContext(sql,row,{supplierEvidence=defaultSupplier,signal=new AbortController().signal}={}) {
 let c=emptyContext();
 try {
  if(signal.aborted)throw Error('aborted');
  c=await sql.begin('isolation level repeatable read read only',async tx=>{
   await tx`SET LOCAL statement_timeout = '5000ms'`;
   const messages=await tx`SELECT id,message_id,from_email,subject,body_text,received_at,order_id FROM support_messages WHERE id=${row.id} AND message_id=${row.message_id}`;
   const current=messages[0];
   if(!current||!current.from_email||!current.received_at)throw Error('current missing');
   const result={...emptyContext(),current,linkage:'none',limitations:[]};
   const orders=await tx`SELECT id,customer_email,paid_at,status,created_at,langue,final_image_sent_at,poster_confirmation_status,fournisseur_ref,suivi_url,suivi_transporteur,expedie_le FROM orders
    WHERE (${current.order_id}::uuid IS NOT NULL AND id=${current.order_id}::uuid)
       OR (lower(customer_email)=lower(${current.from_email}) AND paid_at IS NOT NULL)
    ORDER BY (id=${current.order_id}::uuid) DESC NULLS LAST,created_at DESC LIMIT 3`;
   let order;
   if(current.order_id) {
    order=orders.find(o=>o.id===current.order_id);
    if(!order||order.customer_email.toLowerCase()!==current.from_email.toLowerCase())result.linkage='contradiction';
   } else {
    if(orders.length===1)order=orders[0];
    else if(orders.length>1)result.linkage='ambiguous';
   }
   if(!order||['ambiguous','contradiction'].includes(result.linkage)) {
    result.limitations.push(result.linkage==='none'?'Aucune commande rattachée de façon fiable.':'Rattachement ambigu ou contradictoire : aucune donnée commande ni historique utilisé.');
    return result;
   }
   result.linkage='verified';
   result.language=LANGUAGES.has(order.langue)?order.langue:null;
   result.order={status:safeText(order.status,80),createdAt:stamp(order.created_at),paidAt:stamp(order.paid_at),finalImageSentAt:stamp(order.final_image_sent_at),posterConfirmationStatus:safeText(order.poster_confirmation_status,40)||null,shippedAt:stamp(order.expedie_le),supplierReferencePresent:!!order.fournisseur_ref,trackingRecorded:!!order.suivi_url,carrier:safeText(order.suivi_transporteur,80)||null};
   result.trackingUrl=safeTrackingUrl(order.suivi_url);
   const history=await tx`SELECT * FROM (
    SELECT 'customer' AS role,m.body_text AS text,m.received_at AS at,m.id AS source_id FROM support_messages m
    WHERE m.id<>${current.id} AND m.received_at<${current.received_at} AND lower(m.from_email)=lower(${current.from_email})
      AND m.order_id=${order.id}::uuid
    UNION ALL
    SELECT 'support' AS role,r.body_text AS text,r.sent_at AS at,r.id AS source_id FROM support_replies r
    LEFT JOIN support_messages m ON m.id=r.support_message_id
    WHERE r.sent_at<${current.received_at} AND lower(r.to_email)=lower(${current.from_email})
      AND (r.order_id=${order.id}::uuid OR (r.order_id IS NULL AND m.order_id=${order.id}::uuid))
      AND (m.id IS NULL OR (m.id<>${current.id} AND m.received_at<${current.received_at} AND lower(m.from_email)=lower(${current.from_email}) AND m.order_id=${order.id}::uuid))
   ) h ORDER BY at DESC,source_id DESC LIMIT 6`;
   result.history=history.reverse().map(h=>({role:h.role,at:stamp(h.at),text:safeText(h.text)}));
   // Raw reference and URL stay local to supplier adapter; never in inference data.
   result.supplierOrder={id:order.id,fournisseur_ref:order.fournisseur_ref,suivi_url:order.suivi_url,suivi_transporteur:order.suivi_transporteur,asOf:stamp(current.received_at)};
   return result;
  });
 }catch {return emptyContext();}
 if(c.supplierOrder) {
  try {if(signal.aborted)throw Error('aborted');c.supplier=supplierData(await supplierEvidence(c.supplierOrder,{signal}),c.supplierOrder.asOf);}catch {c.supplier=unavailable();}
  delete c.supplierOrder;
 }
 return c;
}
export function inferenceContext(c) {
 return {version:1,observedAt:c.observedAt,messageAt:stamp(c.current?.received_at),linkage:c.linkage,language:c.language,order:c.order,history:c.history,supplier:c.supplier,limitations:c.limitations};
}
export function formatOrderBrief(c) {
 if(c.linkage!=='verified'||!c.order) {
  if(c.linkage==='ambiguous')return 'Plusieurs achats · commande à préciser';
  if(c.linkage==='none')return 'Commande non identifiée';
  return 'Commande à vérifier';
 }
 const o=c.order;
 const shortDate=value=>{const d=new Date(value);return value&&Number.isFinite(d.getTime())?`${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}`:null;};
 const shipping=shortDate(o.shippedAt),illustration=shortDate(o.finalImageSentAt);
 const portrait=o.posterConfirmationStatus==='confirmed'?'Portrait validé':o.posterConfirmationStatus==='changes_requested'?'Retouches demandées':null;
 if(shipping)return [portrait,`Expédition enregistrée le ${shipping}`].filter(Boolean).join(' · ');
 if(o.supplierReferencePresent)return [portrait,'Réf. imprimeur enregistrée'].filter(Boolean).join(' · ');
 if(illustration)return [portrait,`Illustration envoyée le ${illustration}`].filter(Boolean).join(' · ');
 if(portrait)return portrait;
 return o.paidAt?'Payée · avancement à vérifier':'Avancement à vérifier';
}
export function formatContextSummary(c) {
 if(c.linkage!=='verified')return `Contexte SAV : ${c.limitations.join(' ') || 'Commande non vérifiée.'} Langue à déterminer d’après le message.`;
 const o=c.order;
 return [`Contexte SAV — commande rattachée par email exact (identité non authentifiée).`,
  `État DB observé le ${c.observedAt} : ${o.status||'inconnu'} ; fabrication ${o.supplierReferencePresent?'référence fournisseur enregistrée (état non confirmé)':'non confirmée'} ; expédition ${o.shippedAt||'non enregistrée'}.`,
  `Historique : ${c.history.length} échange(s) antérieur(s). Langue : ${c.language||'à déterminer d’après le message'}.`,
  ...c.history.slice(-2).map(h=>`${h.role==='support'?'Dernière réponse SAV':'Dernier message antérieur'} (${h.at}) : ${h.text.slice(0,400)}`),
  `Illustration envoyée : ${o.finalImageSentAt||'non enregistrée'} ; validation portrait : ${o.posterConfirmationStatus||'inconnue'}.`,
  `Fournisseur : ${c.supplier.status==='available'?'emails disponibles':c.supplier.status==='not_applicable'?'non applicable':'indisponible'} ; non vérifié auprès du transporteur.`,
  ...c.supplier.evidence.map(e=>`Email fournisseur (${e.at}) : ${e.text}`),
  ...c.supplier.limitations,
  c.trackingUrl?`Suivi enregistré — vérification manuelle uniquement : ${c.trackingUrl}`:'Suivi transporteur non consulté ; aucun lien validé affichable.',
  ...c.limitations].join('\n');
}
