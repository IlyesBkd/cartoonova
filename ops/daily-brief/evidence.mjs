// Read-only, order-scoped projection. The admin aggregator stays the sole history reader.
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire('/home/hermes/projects/cartoonova/package.json');
import {redact} from './redaction.mjs';
const iso=v=>{
 if(v instanceof Date)return Number.isFinite(v.getTime())?v.toISOString():null;
 if(typeof v!=='string')return null;
 const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.exec(v);
 if(!m)return null;
 const [y,month,day,hour,minute,second]=m.slice(1).map(Number);
 const leap=y%4===0&&(y%100!==0||y%400===0);
 const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 if(month<1||month>12||day<1||day>days[month-1]||hour>23||minute>59||second>59)return null;
 return Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
};
const norm=v=>String(v??'').normalize('NFKC').replace(/\s+/gu,' ').trim();
const hash=v=>createHash('sha256').update(v).digest('hex');
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Local display only: accept the structured order name, never labels, draft
// identities or email fallbacks. Reject rather than truncate arbitrary input.
export function localDisplayName(value){
 if(typeof value!=='string'||value.length>80)return null;
 const name=value.normalize('NFC').trim().replace(/ +/g,' ');
 if(!name||Array.from(name).length>60||!/^\p{L}[\p{L}\p{M}]*(?:[ '’\-][\p{L}\p{M}]+)*$/u.test(name))return null;
 if(name.split(' ').length>6||/\b(?:rue|avenue|boulevard|chemin|route|impasse|allée|place|quai|square|cours|passage|sentier|résidence|lotissement|street|road|lane|drive|platz|strasse|straße|via|piazza|calle|email|tel|téléphone|adresse)\b/iu.test(name))return null;
 return name;
}
export const LIMITS={orders:40,events:24,pages:3,text:700,candidates:40};
const SENT_PORTRAIT=new Set(['delivery.final_image','order.final_image','delivery.preview','delivery.poster_confirmation']);
const TERMINAL=new Set(['completed','shipped','delivered','cancelled','canceled']);
const STATES=new Set([...TERMINAL,'pending','paid','awaiting_payment','awaiting_photos','non_payee','a_traiter','photos','retouche','a_imprimer','attente_client','in_progress','confirmed','envoi_programme','a_envoyer']);
const actionNames={print_order:'Imprimer le portrait',print_check:'Vérifier l’expédition',validation_wait:'Relancer la validation',retouche:'Faire la retouche',photos_missing:'Demander les photos',photos_incomplete:'Vérifier la demande de photos',preview_overdue:'Dessiner le portrait',preview_unknown:'Vérifier le dessin',digital_final:'Envoyer le portrait',scheduled_failed:'Vérifier l’envoi du portrait'};
export function dedupeDrafts(drafts){
 const seen=new Set(),kept=[];
 for(const b of drafts){
  // Missing content/identity cannot establish equality. Never dedupe by name.
  const key=UUID.test(b.commande??'')&&norm(b.texte)?hash(JSON.stringify([b.commande,norm(b.objet),norm(b.texte),b.langue??'',b.canal??''])):null;
  if(key&&seen.has(key))continue;
  if(key)seen.add(key);kept.push(b);
 }
 return kept;
}
export function projectOrderContext(order,events,{observedAt=new Date().toISOString(),multiple=false,limited=false,warnings=[],textLimit=LIMITS.text}={}){
 const evidence=[],limitations=[...warnings];
 if(limited)limitations.push('history_limit');
 if(!order)return {evidence,limitations:['order_unavailable']};
 const observed=iso(observedAt);
 if(!observed)return {evidence,limitations:['invalid_date']};
 const status=typeof order.status==='string'?order.status.trim().toLowerCase():null;
 if(!STATES.has(status))limitations.push('unknown_state');
 if(order.statut_force!=null)limitations.push('forced_state');
 for(const k of ['poster_confirmation_sent_at','final_image_sent_at','expedie_le'])if(order[k]&&(!iso(order[k])||iso(order[k])>observed))limitations.push('invalid_or_future_date');
 evidence.push({id:'state',at:observed,kind:'current_state',status:'recorded',text:JSON.stringify({status:STATES.has(status)?status:'unknown',photosPresent:Array.isArray(order.photo_urls)&&order.photo_urls.length>0,photoCount:Array.isArray(order.photo_urls)?order.photo_urls.length:null,previewPreparedAt:iso(order.poster_confirmation_sent_at),finalImageSentAt:iso(order.final_image_sent_at),previewStatus:['confirmed','pending','changes_requested','retouch','retouch_requested','revision_requested'].includes(order.poster_confirmation_status)?order.poster_confirmation_status:null,supplierReferencePresent:!!order.fournisseur_ref,shippedAt:iso(order.expedie_le)})});
 const selected=[];
 for(const e of events){
  const linked=Array.isArray(e.orderIds)&&e.orderIds.includes(String(order.id));
  // Unassigned exchanges must not migrate from order B to A, even at exact email.
  // They remain a visible limitation, not a usable per-order proof.
  if(!linked&&e.orderIds?.length)continue;
  if(!linked&&!(e.exactEmail===true&&!multiple)){if(e.body||e.subject)limitations.push(multiple?'unassigned_multi_order_exchange':'unassigned_exchange');continue;}
  const at=iso(e.at);
  if(!at||at>observed){limitations.push('invalid_or_future_date');continue;}
  // Do not expose raw admin details, URLs, provider payloads or attachments.
  const raw=[e.subject,e.body].filter(Boolean).join('\n')||String(e.title??'');
  if(raw.length>textLimit)limitations.push('text_limit');
  selected.push({at,kind:redact(e.kind,80),status:['sent','failed','uncertain','scheduled','recorded'].includes(e.status)?e.status:'uncertain',text:redact(raw||e.title,textLimit),bodyFingerprint:e.body?hash(norm(e.body)):null});
 }
 selected.sort((a,b)=>b.at.localeCompare(a.at));
 if(selected.length>LIMITS.events)limitations.push('event_limit');
 for(const [i,e] of selected.slice(0,LIMITS.events).entries())evidence.push({id:'event-'+(i+1),...e});
 return {evidence,limitations:[...new Set(limitations)],localDisplayName:localDisplayName(order.customer_name),terminal:TERMINAL.has(status)||!!iso(order.expedie_le)&&iso(order.expedie_le)<=observed};
}
export async function loadOrderContext(sql,id,{getHistory,now=new Date()}={}){
 if(!UUID.test(id??''))return {evidence:[],limitations:['invalid_order_link']};
 try{return await sql.begin('isolation level repeatable read read only',async tx=>{
  await tx`SET LOCAL statement_timeout='5000ms'`;
  const [entry]=await tx`SELECT to_jsonb(o) AS data,(SELECT count(*)::int FROM orders x WHERE lower(btrim(x.customer_email))=lower(btrim(o.customer_email))) AS own_count FROM orders o WHERE id=${id}::uuid`;
  if(!entry)return {evidence:[],limitations:['order_unavailable']};
  if(!getHistory){const {tsImport}=await import(require.resolve('tsx/esm/api'));getHistory=(await tsImport('/home/hermes/projects/cartoonova/lib/customerHistory.ts',import.meta.url)).getCustomerHistory;}
  const events=[];let cursor=null,pages=0,warnings=[];
  do{
   const page=await getHistory(tx,{orderId:id,supportMessageId:null,limit:100,cursor});
   events.push(...page.events);warnings.push(...page.warnings.filter(w=>w.startsWith('Source indisponible')).map(()=> 'source_unavailable'));
   cursor=page.nextCursor?JSON.parse(Buffer.from(page.nextCursor,'base64url').toString()):null;
  }while(cursor&&++pages<LIMITS.pages);
  // The aggregator intentionally groups by customer email. Recover only exact
  // recipient links for unassigned support exchanges, never name/transitive matches.
  if(entry.own_count===1){
   const incoming=events.filter(e=>e.source==='support_messages'&&!e.orderIds?.length).map(e=>e.id.replace(/^message:/,''));
   const outgoing=events.filter(e=>e.source==='support_replies'&&!e.orderIds?.length).map(e=>e.id.replace(/^reply:/,''));
   const allowed=new Set();
   if(incoming.length){const exact=await tx`SELECT id FROM support_messages WHERE id::text=ANY(${incoming}::text[]) AND lower(btrim(from_email))=lower(btrim(${entry.data.customer_email})) AND order_id IS NULL`;for(const r of exact)allowed.add('message:'+r.id);}
   if(outgoing.length){const exact=await tx`SELECT id FROM support_replies WHERE id::text=ANY(${outgoing}::text[]) AND lower(btrim(to_email))=lower(btrim(${entry.data.customer_email})) AND order_id IS NULL`;for(const r of exact)allowed.add('reply:'+r.id);}
   for(const e of events)if(allowed.has(e.id))e.exactEmail=true;
  }
  return projectOrderContext(entry.data,events,{observedAt:now.toISOString(),multiple:entry.own_count>1,limited:!!cursor,warnings});
 });}catch{return {evidence:[],limitations:['history_unavailable']};}
}
export function makeCandidates(data,drafts,contexts){
 const candidates=[];
 const add=(kind,orderId,action,source,{at=null,draft=null}={})=>{
  const context=contexts[orderId]??{evidence:[],limitations:['context_unavailable']};
  const evidence=context.evidence.map(({bodyFingerprint,...e})=>e);
  let blocked=null;
  if(context.terminal)blocked='completed';
  const sent=context.evidence.filter(e=>e.status==='sent'&&SENT_PORTRAIT.has(e.kind));
  const limitations=[...context.limitations];
  // A portrait does not establish the meaning of a photo request or a draft.
  // Keep these visible for review, including a possible recent clarification.
  if(['photos_missing','photos_incomplete'].includes(kind)&&sent.some(e=>!iso(at)||e.at>=iso(at)))limitations.push('photo_request_semantics_unproven');
  if(at&&!iso(at))limitations.push('invalid_candidate_date');
  if(iso(at)&&iso(at)>evidence[0]?.at)limitations.push('future_candidate_date');
  if(draft&&(!iso(draft.cree_le)||!norm(draft.texte)))limitations.push('draft_incomplete');
  if(draft&&[draft.objet,draft.texte].filter(Boolean).join('\n').length>LIMITS.text)limitations.push('text_limit','draft_text_limit');
  // Exact full-body equality is local proof; never use a truncated history.
  if(draft&&!limitations.length&&iso(draft.cree_le)&&norm(draft.texte)&&context.evidence.some(e=>e.status==='sent'&&e.at>=iso(draft.cree_le)&&e.bodyFingerprint===hash(norm(draft.texte))))blocked=blocked??'duplicate';
  if(draft&&sent.some(e=>!iso(at)||e.at>=iso(at)))limitations.push('draft_semantics_unproven');
  candidates.push({id:'candidate-'+(candidates.length+1),kind,orderId,action,customer:redact(source.customer??source.client??'Client',40),displayLabel:localDisplayName(context.localDisplayName)??('Dossier '+(draft&&/^[1-9]\d{0,5}$/.test(String(draft.id))?'b'+draft.id:'c'+(candidates.length+1))),draftId:draft?.id??null,language:draft?.langue??null,at:iso(at),proposal:draft?redact([draft.objet,draft.texte].filter(Boolean).join('\n'),LIMITS.text):null,evidence,limitations:[...new Set(limitations)],blocked});
 };
 for(const a of data.alerts)add(a.type,a.orderId,actionNames[a.type]??'Vérifier la commande',a,{at:a.eventAt});
 const alerted=new Set(data.alerts.map(a=>a.orderId));
 for(const r of data.readyPrint)if(!alerted.has(r.id))add('readyPrint',r.id,'Imprimer le portrait',r);
 for(const r of data.pending)if(!alerted.has(r.id)&&!data.readyPrint.some(p=>p.id===r.id))add('pending',r.id,r.photos?'Dessiner le portrait':'Vérifier les photos avant de dessiner',r);
 for(const b of dedupeDrafts(drafts))add('draft',b.commande,'Relire le brouillon',b,{at:b.cree_le,draft:b});
 return candidates;
}
