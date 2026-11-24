// Shared read-only notification projection of the admin history, not a second ledger.
const ROOT='/home/hermes/projects/cartoonova/';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso=v=>v&&Number.isFinite(new Date(v).getTime())?new Date(v).toISOString():null;
const email=v=>String(v??'').trim().toLowerCase();
export function redact(value,max=700) {
 let s=String(value??'').replace(/https?:\/\/[^\s<>"']+|(?:s3|storage):\/\/\S+/gi,'[lien masqué]')
 .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email masqué]')
 .replace(/\b(?:bearer\s+\S+|(?:token|secret|password|signature|api[_-]?key)\s*[:=]\s*\S+)/gi,'[secret masqué]')
 .replace(/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]+|\bsk-[A-Za-z0-9_-]{8,}|\b(?:re_|gh[pousr]_|github_pat_|hf_|xox[baprs]-)[A-Za-z0-9_-]{12,}|\bAKIA[A-Z0-9]{16}\b|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[secret masqué]')
 .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi,'[identifiant masqué]')
 .replace(/(?:\+\d[\d\s().-]{7,}\d|\b0\d(?:[ .-]?\d){8}\b)/g,'[téléphone masqué]')
 .replace(/\b(?:livr(?:er|aison)|exp[ée]di(?:er|tion)|adresse|destinataire|recipient|address|indirizzo|direcci[oó]n)\b[^\n;]*(?:\b\d+\b|\bchez\b)[^\n;]*/giu,'[adresse masquée]')
 .replace(/\b\d+(?:\s*(?:bis|ter|[a-z]))?[ ,]+(?:rue|avenue|av\.|boulevard|bd\.?|chemin|route|impasse|allée|allee|place|square|quai|cours|passage|résidence|residence|hameau|lieu-dit|lotissement|traverse|faubourg|montée|montee|promenade|villa|street|road|lane|drive|way|court|via|viale|piazza|vicolo|calle|carrer|avenida|paseo|plaza|rua|travessa|estrada)\b[^\n;]*/giu,'[adresse masquée]')
 .replace(/\b(?:rue|avenue|boulevard|chemin|route|impasse|allée|allee|place|square|quai|cours|passage|résidence|residence|lieu-dit|via|viale|piazza|vicolo|calle|avenida|rua)\s+[\p{L} .'-]+(?:[, ]+\d{1,5})?[^\n;]*/giu,'[adresse masquée]')
 .replace(/\b\d{5}\s+[\p{L}][\p{L} .'-]*/gu,'[code postal et ville masqués]')
 .replace(/\b\d{1,5}\s+[\p{L} .'-]{0,80}\b(?:Street|Road|Avenue|Lane|Drive)\b[^\n;,]*/giu,'[adresse masquée]')
 .replace(/\b\p{Lu}[\p{L}'-]+(?:[ \t]+\p{Lu}[\p{L}'-]+)+\b/gu,'[nom masqué]')
 .replace(/(?:nom|prénom|destinataire|recipient)\s*:\s*[^\n;,]+/giu,'[identité masquée]')
 .replace(/[\p{Cc}\p{Cf}]/gu,' ').trim();
 if(s.length>max)s=s.slice(0,max-1).replace(/[\uD800-\uDBFF]$/,'')+'…';
 return s;
}
export function emptyCustomerContext(reason='Contexte indisponible : lecture non vérifiée.') {
 return {version:2,observedAt:new Date().toISOString(),messageAt:null,linkage:'unavailable',identity:'unknown',selectedOrder:null,orders:[],history:[],events:[],supplier:{status:'unavailable',evidence:[],limitations:['Emails fournisseur indisponibles ; transporteur non vérifié.']},limitations:[reason]};
}
const orderStates=new Set(['pending','paid','awaiting_payment','awaiting_photos','non_payee','a_traiter','photos','retouche','a_imprimer','attente_client','shipped','delivered','completed','cancelled','canceled','in_progress','confirmed','envoi_programme','a_envoyer']);
const previewStates=new Set(['pending','confirmed','retouch','retouch_requested','revision_requested','changes_requested']);
function projectOrder(o,key){const options=typeof o.options==='object'&&o.options&&!Array.isArray(o.options)?o.options:{};return {key,style:['simpson','dbz','ghibli','disney','pokemon','naruto','onepiece','southpark','rickmorty','pixar','manga','comic'].includes(options.style)?options.style:null,support:['digital','posterSimple','canvas','framed'].includes(options.printKey)?options.printKey:null,format:['fullbody','portrait','landscape','square'].includes(options.format)?options.format:null,createdAt:iso(o.created_at),paidAt:iso(o.paid_at),status:orderStates.has(String(o.status??'').toLowerCase())?String(o.status).toLowerCase():'autre état enregistré',finalImageSentAt:iso(o.final_image_sent_at),posterConfirmationStatus:previewStates.has(o.poster_confirmation_status)?o.poster_confirmation_status:null,shippedAt:iso(o.expedie_le),supplierReferencePresent:!!o.fournisseur_ref,trackingRecorded:!!(o.suivi_url||o.shipping_details),portraitPresent:!!o.final_image_url,previewPresent:!!o.poster_confirmation_image_url,scheduledAt:iso(o.final_image_scheduled_at)};}
const category=e=>/retouch/i.test(e.kind+e.title)?'retouch':/shipping|suivi|expéd/i.test(e.kind+e.title)?'shipping':/delivery|portrait|preview|aperçu/i.test(e.kind+e.title)?'portrait':/email|chat|contact/i.test(e.kind)?'exchange':'order';
export async function loadCustomerContext(sql,row,{signal,getHistory,loadSupplier}={}) {
 let c=emptyCustomerContext();
 try {
  if(signal?.aborted)throw Error('aborted');
  return await sql.begin('isolation level repeatable read read only',async tx=>{
   await tx`SET LOCAL statement_timeout='5000ms'`;
   const [m]=await tx`SELECT id,message_id,from_email,received_at,order_id,to_char(received_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "messageAt" FROM support_messages WHERE id=${row.id}`;
   if(!m||!email(m.from_email)||!iso(m.received_at)||(row.message_id&&row.message_id!==m.message_id))throw Error('missing source');
   c={...emptyCustomerContext(),messageAt:m.messageAt,linkage:'none',identity:'exact_email',limitations:[]};
   if(row.conflictingOrders){c.linkage='contradiction';c.identity='unknown';c.limitations=['Liens explicites contradictoires : contexte exclu.'];return c;}
   const explicit=m.order_id;
   if(explicit&&!uuid.test(explicit))throw Error('invalid link');
   const orders=await tx`SELECT jsonb_build_object('id',to_jsonb(o)->'id','customer_email',to_jsonb(o)->'customer_email','created_at',to_jsonb(o)->'created_at','paid_at',to_jsonb(o)->'paid_at','status',to_jsonb(o)->'status','options',to_jsonb(o)->'options','final_image_url',to_jsonb(o)->'final_image_url','final_image_sent_at',to_jsonb(o)->'final_image_sent_at','final_image_scheduled_at',to_jsonb(o)->'final_image_scheduled_at','poster_confirmation_status',to_jsonb(o)->'poster_confirmation_status','poster_confirmation_image_url',to_jsonb(o)->'poster_confirmation_image_url','fournisseur_ref',to_jsonb(o)->'fournisseur_ref','suivi_url',to_jsonb(o)->'suivi_url','suivi_transporteur',to_jsonb(o)->'suivi_transporteur','expedie_le',to_jsonb(o)->'expedie_le','shipping_details',to_jsonb(o)->'shipping_details') AS data FROM orders o WHERE lower(btrim(customer_email))=${email(m.from_email)} OR id=${explicit}::uuid ORDER BY (id=${explicit}::uuid) DESC NULLS LAST,created_at DESC,id DESC LIMIT 9`;
   const raw=orders.map(o=>o.data);
   if(explicit&&!raw.some(o=>o.id===explicit&&email(o.customer_email)===email(m.from_email))){c.linkage='contradiction';c.identity='unknown';c.limitations=['Lien explicite incompatible avec l’adresse exacte : contexte exclu.'];return c;}
   const own=raw.filter(o=>email(o.customer_email)===email(m.from_email));
   c.linkage=explicit||own.length===1?'verified':own.length>1?'ambiguous':'none';
   const labels=new Map(own.slice(0,8).map((o,i)=>[o.id,`commande-${i+1}`]));
   c.orders=own.slice(0,8).map(o=>projectOrder(o,labels.get(o.id)));
   c.selectedOrder=c.linkage==='verified'?labels.get(explicit??own[0]?.id)??null:null;
   if(loadSupplier&&c.selectedOrder){try{c.supplier=await loadSupplier(own.find(o=>labels.get(o.id)===c.selectedOrder),c.messageAt);}catch{}}
   if(own.length>8)c.limitations.push('Commandes limitées à 8 : lien explicite puis achats les plus récents ; d’autres commandes existent.');
   if(c.linkage==='ambiguous')c.limitations.push('Plusieurs commandes de la même adresse exacte ; aucune sélectionnée ni attribuée au nouveau message.');
   if(!own.length)c.limitations.push('Aucune commande retrouvée ; échanges de la même adresse exacte seulement.');
   // Exact recipients only, unlike the broader admin UI's explicit-order links.
   const tables=await tx`SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename=ANY(${['support_replies','support_prepared_replies']}::text[])`;
   let history=await tx`SELECT 'customer' AS role,to_char(received_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,body_text AS text,id FROM support_messages WHERE lower(btrim(from_email))=${email(m.from_email)} AND received_at<${m.messageAt}::text::timestamptz AND id<>${m.id} ORDER BY received_at DESC,id DESC LIMIT 13`;
   if(tables.some(t=>t.tablename==='support_replies'))history.push(...await tx`SELECT 'support' AS role,to_char(sent_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,body_text AS text,id FROM support_replies WHERE lower(btrim(to_email))=${email(m.from_email)} AND sent_at<${m.messageAt}::text::timestamptz ORDER BY sent_at DESC,id DESC LIMIT 13`);
   history.sort((a,b)=>b.at.localeCompare(a.at)||b.id-a.id);
   c.history=history.slice(0,12).reverse().map(h=>({role:h.role,at:h.at,text:redact(h.text)}));
   if(history.length>12)c.limitations.push('Échanges limités aux 12 derniers, sans fenêtre de 48 heures ; textes limités à 700 caractères.');
   const events=[];let cursor={snapshot:c.observedAt,at:null,id:null},pages=0;
   try {
    if(!getHistory){const {tsImport}=await import('tsx/esm/api');getHistory=(await tsImport(ROOT+'lib/customerHistory.ts',import.meta.url)).getCustomerHistory;}
    await tx.savepoint(async historyTx=>{do {
    if(signal?.aborted)throw Error('aborted');
    const page=await getHistory(historyTx,{orderId:null,supportMessageId:m.id,limit:100,cursor});
    events.push(...page.events);cursor=page.nextCursor?JSON.parse(Buffer.from(page.nextCursor,'base64url').toString()):null;pages++;
    if(pages===1)c.limitations.push(...page.warnings.slice(0,2).map(w=>redact(w,200)));
   }while(cursor&&pages<3);});}catch{c.limitations.push('Traces agrégées indisponibles ; échanges exacts conservés.');events.length=0;}
   // No free-form admin details, recipient names, addresses, attachment URLs or
   // provider bodies: these can concern a gift recipient or another customer.
   const preparedIds=events.filter(e=>e.source==='support_prepared_replies').map(e=>e.id.replace(/^prepared:/,''));
   const exactPrepared=preparedIds.length&&tables.some(t=>t.tablename==='support_prepared_replies')?await tx`SELECT id FROM support_prepared_replies WHERE lower(btrim(to_email))=${email(m.from_email)} AND id::text=ANY(${preparedIds}::text[])`:[];
   const allowedPrepared=new Set(exactPrepared.map(r=>'prepared:'+r.id));
   const eligible=events.filter(e=>e.source!=='support_messages'&&e.source!=='support_replies'&&(e.source!=='support_prepared_replies'||allowedPrepared.has(e.id)));
   const chosen=new Map();for(const kind of ['retouch','shipping','portrait','exchange','order'])for(const e of eligible.filter(e=>category(e)===kind).slice(0,4))chosen.set(e.id,e);
   for(const e of eligible){if(chosen.size>=24)break;chosen.set(e.id,e);}
   c.events=[...chosen.values()].slice(0,24).map(e=>({kind:redact(e.kind,80),title:redact(e.title,160),at:iso(e.at),status:['recorded','scheduled','sent','failed','uncertain'].includes(e.status)?e.status:'recorded',orders:e.orderIds.filter(id=>labels.has(id)).map(id=>labels.get(id)),temporal:'observed',text:e.source==='retouches'?redact(e.body,400):null}));
   c.limitations.push('État actuel observé à observedAt, pas reconstitution au moment du message. Dates absentes : inconnues. Emails fournisseur non vérifiés auprès du transporteur.');
   c.limitations.push(`Contexte borné : 8 commandes, 12 échanges (700 caractères), 24 traces ; ${pages} page(s) de 100 consultée(s)${cursor?' ; historique supplémentaire non consulté':''}.`);
   c.limitations=c.limitations.slice(0,8).map(x=>redact(x,200));return c;
  });
 }catch{return emptyCustomerContext();}
}
export function frenchState(s){return ({paid:'payée',awaiting_payment:'paiement en attente',pending:'en attente',non_payee:'non payée',awaiting_photos:'photos attendues',photos:'photos attendues',a_traiter:'à traiter',retouche:'retouche à réaliser',a_imprimer:'à imprimer',attente_client:'réponse client attendue',shipped:'expédiée',delivered:'livrée',completed:'terminée',cancelled:'annulée',canceled:'annulée',in_progress:'en cours',confirmed:'validé',changes_requested:'retouches demandées',envoi_programme:'envoi programmé',a_envoyer:'à envoyer',recorded:'enregistré',scheduled:'programmé',sent:'envoyé (accepté par le prestataire)',failed:'échec',uncertain:'résultat incertain'})[s]??'état à vérifier';}
function parisDate(value){return iso(value)?new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'}).format(new Date(value)):'date inconnue';}
const orderName=key=>String(key).replace('commande-','Commande ');
export function customerContextSummary(c){
 if(!c||c.version!==2)return '';
 const lines=['🗂 Contexte client interne — résumé',`Point au ${parisDate(c.observedAt)} (Paris). Adresse exacte, identité non authentifiée.`];
 if(c.linkage==='contradiction')return [...lines,'⚠ Rattachement contradictoire : aucun historique utilisé.'].join('\n');
 if(c.linkage==='unavailable')return [...lines,'⚠ Contexte indisponible : vérification manuelle nécessaire.'].join('\n');
 if(c.linkage==='ambiguous')lines.push('⚠ Plusieurs commandes, aucune sélectionnée : celle évoquée reste à préciser.');
 if(!c.orders.length)lines.push('Aucune commande retrouvée avec cette adresse. Cela ne prouve pas une absence d’achat.');
 for(const o of c.orders.slice(0,3)){
  const milestones=[o.finalImageSentAt?`portrait envoyé le ${parisDate(o.finalImageSentAt)}`:null,o.scheduledAt?`envoi prévu le ${parisDate(o.scheduledAt)} (pas une preuve d’envoi)`:null,o.posterConfirmationStatus==='confirmed'?'portrait validé':o.posterConfirmationStatus==='changes_requested'?'retouches demandées':null,o.shippedAt?`expédition enregistrée le ${parisDate(o.shippedAt)}`:o.supplierReferencePresent?'référence imprimeur enregistrée (fabrication non confirmée)':null].filter(Boolean);
  lines.push(`${orderName(o.key)}${c.selectedOrder===o.key?' (rattachée)':''} du ${parisDate(o.createdAt)} : ${frenchState(o.status)}${milestones.length?' ; '+milestones.join(' ; '):' ; avancement à vérifier'}.`);
 }
 if(c.orders.length>3)lines.push(`+ ${c.orders.length-3} autre(s) commande(s) dans le contexte du brouillon.`);
 for(const h of c.history.slice(-2))lines.push(`${h.role==='support'?'Dernière réponse envoyée':'Message précédent'} · ${parisDate(h.at)} : ${redact(h.text,240)}`);
 const byDate=(a,b)=>(b.at??'').localeCompare(a.at??'');
 const chosen=new Map();
 for(const cat of ['retouch','portrait','shipping','exchange'])for(const e of c.events.filter(e=>category(e)===cat).sort(byDate).slice(0,cat==='retouch'?2:1))chosen.set(JSON.stringify(e),e);
 for(const e of [...c.events].sort(byDate)){if(chosen.size>=6)break;chosen.set(JSON.stringify(e),e);}
 for(const e of chosen.values())lines.push(`${e.orders.map(orderName).join(', ')||'Client'} · ${parisDate(e.at)} : ${e.title} — ${frenchState(e.status)}${e.text?' · '+redact(e.text,180):''}.`);
 for(const e of c.supplier.evidence.slice(-1))lines.push(`Déclaration fournisseur · ${parisDate(e.at)} : ${redact(e.text,220)} (transporteur non vérifié).`);
 if(c.history.length>2||c.events.length>chosen.size)lines.push(`Résumé : 2 échanges et 6 traces au plus affichés ; ${c.history.length} échange(s) et ${c.events.length} trace(s) fournis au brouillon.`);
 const warnings=c.limitations.filter(x=>!/État actuel observé|Contexte borné|Plusieurs commandes|Aucune commande retrouvée/.test(x));
 for(const warning of warnings.slice(0,3))lines.push('⚠ '+warning);
 const bounds=c.limitations.find(x=>/^Contexte borné/.test(x));
 lines.push('Dates inconnues conservées. État actuel, pas reconstitution au moment du message.');
 lines.push(bounds??'Contexte borné : 8 commandes, 12 échanges, 24 traces ; historique admin pour le détail.');
 if(c.limitations.some(x=>/supplémentaire non consulté/.test(x)))lines.push('⚠ Une partie de l’historique ancien n’a pas été consultée.');
 return lines.join('\n');
}
