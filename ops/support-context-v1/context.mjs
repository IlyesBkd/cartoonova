// Context is advisory evidence, never authority to send or change an order.
import {customerContextSummary,redact,frenchState} from '/home/hermes/projects/cartoonova/scripts/customer-notification-context.mjs';
export const safeText=(v,n=1000)=>redact(v,n);
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
  if(!at||!Number.isFinite(Date.parse(at))||Date.parse(at)>=Date.parse(asOf))continue;
  let text=e.text??e.excerpt??e.bodyText??e.summary;
  if(typeof e.declaredStatus==='string') {
   const states=new Set(['unknown','confirmed','processing','printing','production','shipped','delivered','cancelled','dispatched','in_production','in_transit','incident']);
   const status=states.has(e.declaredStatus)?e.declaredStatus:'unknown';
   text=`Statut déclaré par le fournisseur : ${status} ; négation expédition/livraison : ${e.shippingOrDeliveryNegated===true?'oui':'non établie'} ; transporteur déclaré : ${safeText(e.carrier,80)||'inconnu'} ; non vérifié auprès du transporteur.`;
  }
  if(typeof text!=='string'||!text.trim())continue;
  evidence.push({at:stamp(at),text:redact(text,600),source:'email fournisseur — non vérifié auprès du transporteur'});
 }
 return {status:raw.status==='available'&&!evidence.length?'unavailable':raw.status,evidence,limitations:(Array.isArray(raw.limitations)?raw.limitations:[]).slice(0,4).filter(x=>typeof x==='string').map(x=>safeText(x,200))};
}
export async function loadContext(sql,row,options={}) {
 const {loadCustomerContext}=await import('/home/hermes/projects/cartoonova/scripts/customer-notification-context.mjs');
 const context=await loadCustomerContext(sql,row,{...options,loadSupplier:async(order,asOf)=>supplierData(await (options.supplierEvidence??defaultSupplier)({id:order.id,fournisseur_ref:order.fournisseur_ref,suivi_url:order.suivi_url,suivi_transporteur:order.suivi_transporteur,asOf},{signal:options.signal}),asOf)});
 return {...context,current:null};
}
export function inferenceContext(c) {
 if(c.version===2)return Object.fromEntries(['version','observedAt','messageAt','linkage','identity','selectedOrder','orders','history','events','supplier','limitations'].map(k=>[k,c[k]]));
 return {version:1,observedAt:c.observedAt,messageAt:stamp(c.current?.received_at),linkage:c.linkage,language:c.language,order:c.order,history:c.history,supplier:c.supplier,limitations:c.limitations};
}
export function formatOrderBrief(c) {
 if(c.version===2){if(c.linkage==='ambiguous')return 'Plusieurs commandes · aucune sélectionnée';if(c.linkage==='contradiction')return 'Rattachement contradictoire · contexte exclu';const o=c.orders.find(o=>o.key===c.selectedOrder);return o?`${o.key.replace('commande-','Commande ')} · ${frenchState(o.status)} · identité non authentifiée`:c.linkage==='none'?'Commande non identifiée':'Commande à vérifier';}
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
 if(c.version===2)return customerContextSummary(c);
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
