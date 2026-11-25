// Untrusted DB material enters by stdin only; reuse the order-scoped projector.
import {readFileSync} from 'node:fs';
import {projectOrderContext,makeCandidates,UUID} from './evidence.mjs';
import {redact} from './redaction.mjs';
const input=readFileSync(0,'utf8');
if(Buffer.byteLength(input)>262144)throw Error('lookup_budget');
const {id,order,events,drafts,now,limited}=JSON.parse(input);
if(!UUID.test(id)||order?.id!==id||!Array.isArray(events)||events.length>125||!Array.isArray(drafts)||drafts.length>200)throw Error('lookup_schema');
if(order.final_image_sent_at)events.push({at:order.final_image_sent_at,kind:'order.final_image',status:'sent',title:'Portrait envoyé (trace historique)',orderIds:[id]});
const context=projectOrderContext(order,events,{observedAt:now,multiple:order.own_count!==1,limited,textLimit:6000,warnings:events.some(e=>e.kind?.startsWith('email.')&&e.body?.length>=5000)?['text_limit']:[]});
// Read local drafts as proposals, never evidence that a reply has been sent.
const projected=makeCandidates({alerts:[],pending:[],readyPrint:[]},drafts.filter(d=>d.commande===id),{[id]:context});
console.log(JSON.stringify({context,drafts:projected.map(d=>({at:d.at,text:d.proposal,limitations:d.limitations})),customer:redact(order.customer_name,40)}));
