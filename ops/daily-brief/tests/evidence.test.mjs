import test from 'node:test';
import assert from 'node:assert/strict';
import {dedupeDrafts,projectOrderContext,makeCandidates,loadOrderContext} from '../evidence.mjs';
import {collectBrief} from '../collect.mjs';
import {A,B,NOW,order,event,draft,empty} from './fixtures.mjs';
const context=(o=order(),events=[event()],opts={})=>projectOrderContext(o,events,{observedAt:NOW,...opts});
test('Tiffany: relance et brouillon anciens conservés avec doute, jamais prouvés par cinq fichiers',()=>{
 const o={...order(),photo_urls:Array(5).fill('groupe'),poster_confirmation_sent_at:'2026-11-21T08:00:00Z'};
 const data={...empty(),alerts:[{orderId:A,type:'photos_incomplete',eventAt:'2026-11-20T10:00:00Z',customer:'Tiffany fictive'}]};
 const originals=[draft()];const before=JSON.stringify(originals);
 const cs=makeCandidates(data,originals,{[A]:context(o)});
 assert.equal(cs.length,2);assert.ok(cs.every(c=>c.blocked===null&&c.limitations.length>0));assert.equal(JSON.stringify(originals),before);
});
test('Tanguy: doublons exacts normalisés, sources non supprimées et idempotence',()=>{
 const ds=[draft({client:'Tanguy fictif'}),draft({id:8,client:'Tanguy fictif',texte:' Merci de nous envoyer les photos.  '})];
 const before=JSON.stringify(ds);assert.equal(dedupeDrafts(ds).length,1);assert.equal(JSON.stringify(ds),before);
 assert.deepEqual(dedupeDrafts(dedupeDrafts(ds)),dedupeDrafts(ds));
 assert.equal(dedupeDrafts([draft(),draft({commande:B})]).length,2);
 assert.equal(dedupeDrafts([draft({texte:''}),draft({id:8,texte:''})]).length,2);
});
test('photos groupées: aucun seuil personnes/fichiers dans pending',()=>{
 const data={...empty(),pending:[{id:A,customer:'Groupe',photos:true,count:1,subjects:8}]};
 const [c]=makeCandidates(data,[],{[A]:context(order(),[])});
 assert.equal(c.kind,'pending');assert.equal(c.action,'Dessiner le portrait');assert.equal(c.blocked,null);
});
test('multi-commandes: échange B jamais attribué à A ; non assigné => doute',()=>{
 const c=context(order(),[event({orderIds:[B],body:'Correction B envoyée'}),event({orderIds:[],kind:'email.incoming',body:'Pour quelle commande ?',exactEmail:true})],{multiple:true});
 assert.equal(c.evidence.length,1);assert.ok(c.limitations.includes('unassigned_multi_order_exchange'));
 assert.ok(!JSON.stringify(c).includes('Correction B'));
});
test('adresse exacte unique vérifiée: échange non assigné utilisable, pas lien étranger explicite',()=>{
 const c=context(order(),[event({orderIds:[],kind:'email.incoming',body:'Photo complémentaire demandée',exactEmail:true}),event({orderIds:[B],body:'Étranger',exactEmail:true})]);
 assert.equal(c.evidence.length,2);assert.deepEqual(c.limitations,[]);assert.ok(!JSON.stringify(c).includes('Étranger'));
});
test('identité inconnue ou seul nom: aucun échange non assigné utilisé',()=>{
 const c=context(order(),[event({orderIds:[],kind:'email.incoming',body:'Tiffany fictive'} )]);
 assert.equal(c.evidence.length,1);assert.ok(c.limitations.includes('unassigned_exchange'));
});
test('demande récente postérieure au portrait conserve le candidat pour jugement IA',()=>{
 const data={...empty(),alerts:[{orderId:A,type:'photos_incomplete',eventAt:'2026-11-24T09:00:00Z'}]};
 const c=context(order(),[event(),event({kind:'email.outgoing',at:'2026-11-24T09:00:00Z',body:'Veuillez fournir une photo nette du visage de droite.'})]);
 assert.equal(makeCandidates(data,[],{[A]:c})[0].blocked,null);
});
test('date de préparation aperçu et brouillon ancien seuls ne prouvent pas un envoi',()=>{
 const c=context(order(),[event({kind:'order.preview',status:'recorded',title:'Aperçu préparé'})]);
 assert.equal(makeCandidates(empty(),[draft()],{[A]:c})[0].blocked,null);
});
test('même sujet ne prouve pas un doublon ; texte envoyé identique rend le projet périmé',()=>{
 const c=context(order(),[event({kind:'email.outgoing',subject:draft().objet,body:'Version corrigée envoyée.'})]);
 assert.equal(makeCandidates(empty(),[draft()],{[A]:c})[0].blocked,null);
 const exact=context(order(),[event({kind:'email.outgoing',body:draft().texte})]);
 assert.equal(makeCandidates(empty(),[draft()],{[A]:exact})[0].blocked,'duplicate');
 const other=context(order(),[event({orderIds:[B],kind:'email.outgoing',subject:draft().objet,body:'Version B.'})]);
 assert.equal(makeCandidates(empty(),[draft()],{[A]:other})[0].blocked,null);
});
test('état terminé exclu même avec un brouillon en attente',()=>{
 assert.equal(makeCandidates(empty(),[draft()],{[A]:context({...order(),status:'completed'},[])})[0].blocked,'completed');
});
test('liens signés, secrets, emails, téléphone, adresse et détails libres expurgés',()=>{
 const c=context(order(),[event({kind:'email.outgoing',body:'https://private.example/a?signature=secret abc@example.com token=abc +33612345678 12 rue Exemple; Bonjour',details:'NE PAS EXPOSER'})]);
 const text=JSON.stringify(makeCandidates(empty(),[draft()],{[A]:c})[0].evidence);
 for(const raw of ['private.example','abc@example.com','token=abc','33612345678','12 rue','NE PAS EXPOSER'])assert.ok(!text.includes(raw),raw);
 assert.ok(!text.includes('Fingerprint'));
});
test('budget événements/texte, dates absentes/futures et historique partiel signalés',()=>{
 const c=context(order(),[...Array.from({length:26},(_,i)=>event({id:String(i)})),event({at:null}),event({at:'2027-01-01T00:00:00Z'}),event({body:'a'.repeat(1000)})],{limited:true});
 assert.equal(c.evidence.length,25);
 for(const l of ['event_limit','text_limit','invalid_or_future_date','history_limit'])assert.ok(c.limitations.includes(l));
});
test('dates brouillons absentes/invalides/futures non vérifiables',()=>{
 for(const value of [null,'hier','2027-01-01T00:00:00Z']){
  const c=makeCandidates(empty(),[draft({cree_le:value})],{[A]:context(order(),[])})[0];assert.ok(c.limitations.length>0);
 }
});
test('historique: transactions explicitement read only, erreur et lien invalide fermés',async()=>{
 const sql={begin:async(mode,fn)=>{assert.ok(mode.includes('read only'));throw Error('DB indisponible');}};
 assert.deepEqual((await loadOrderContext(sql,A)).limitations,['history_unavailable']);
 assert.deepEqual((await loadOrderContext(sql,'nom client')).limitations,['invalid_order_link']);
});
test('collecte simulée sans réseau: pending et readyPrint couvrent la relecture ; historique borné',async()=>{
 const modes=[];let pages=0;
 const sql={begin:async(mode,fn)=>{
  modes.push(mode);
  const tx=(strings,...values)=>{
   const text=strings.join('?');
   assert.ok(!/INSERT|UPDATE |DELETE |CREATE |ALTER /i.test(text));
   if(text.includes('to_jsonb(o)'))return [{data:order(values[0]),own_count:1}];
   return [];
  };
  return fn(tx);
 }};
 const rows=[{...order(),customer_label:'Groupe',options:{printKey:'digital'}},{...order(B),customer_label:'Impression',poster_confirmation_status:'confirmed',options:{printKey:'canvas'}}];
 const worker={collect:async()=>rows,evaluate:()=>null,UNHAPPY:/jamais/};
 const getHistory=async()=>{pages++;return {events:[event()],warnings:[],nextCursor:Buffer.from(JSON.stringify({v:1,snapshot:NOW,at:NOW,id:'x'})).toString('base64url')};};
 const data=await collectBrief(sql,[],{worker,getHistory,physical:o=>o.printKey==='canvas',now:new Date(NOW)});
 assert.deepEqual(data.reviewCandidates.map(c=>c.kind),['readyPrint','pending']);
 assert.equal(pages,6);assert.ok(modes.every(m=>m.includes('read only')));
 assert.ok(data.reviewCandidates.every(c=>c.limitations.includes('history_limit')));
});
test('Tanguy b3/b5: mêmes textes mais UUID de commande différents, deux candidats conservés',()=>{
 const ds=[draft({id:3,client:'Tanguy fictif'}),draft({id:5,client:'Tanguy fictif',commande:B})];
 const cs=makeCandidates(empty(),ds,{[A]:context(order(),[]),[B]:context(order(B),[])});
 assert.deepEqual(cs.map(c=>[c.draftId,c.orderId]),[[3,A],[5,B]]);
});
test('titre fallback et objet+corps dépassant 700 signalent text_limit',()=>{
 const c=context(order(),[event({body:null,subject:null,title:'x'.repeat(701)})]);
 assert.ok(c.limitations.includes('text_limit'));assert.ok(c.evidence[1].text.length<=700);
 for(const b of [draft({objet:'x'.repeat(690),texte:'y'.repeat(20)}),draft({objet:'x'.repeat(701),texte:'y'})]){
  const [candidate]=makeCandidates(empty(),[b],{[A]:context(order(),[])});
  assert.ok(candidate.limitations.includes('text_limit'));assert.ok(candidate.proposal.length<=700);
 }
});
test('dates impossibles, jours hors calendrier et 24h rejetés plutôt que normalisés',()=>{
 for(const at of ['2026-02-30T10:00:00Z','2026-02-29T10:00:00Z','2026-04-31T10:00:00Z','2026-11-24T24:00:00Z']){
  const c=context(order(),[event({at})]);assert.equal(c.evidence.length,1);assert.ok(c.limitations.includes('invalid_or_future_date'));
  const [b]=makeCandidates(empty(),[draft({cree_le:at})],{[A]:context(order(),[])});
  assert.equal(b.at,null);assert.ok(b.limitations.includes('invalid_candidate_date'));
 }
 assert.equal(context(order(),[event({at:'2024-02-29T10:00:00Z'})]).evidence.length,2);
 const shipped=context({...order(),expedie_le:'2026-02-30T10:00:00Z'},[]);
 assert.equal(shipped.terminal,false);assert.ok(shipped.limitations.includes('invalid_or_future_date'));
});
test('PAID est paid ; statut inconnu reste inconnu sans nouvelle invention',()=>{
 const paid=context({...order(),status:'PAID'},[]);
 assert.deepEqual(paid.limitations,[]);assert.equal(JSON.parse(paid.evidence[0].text).status,'paid');
 const unknown=context({...order(),status:'MAGIC_PAID'},[]);
 assert.ok(unknown.limitations.includes('unknown_state'));assert.equal(JSON.parse(unknown.evidence[0].text).status,'unknown');
});
test('relance validation antérieure au portrait conservée ; ancienne demande photos et demande récente aussi',()=>{
 const c=context(order(),[event(),event({kind:'email.outgoing',at:'2026-11-24T09:00:00Z',body:'Merci d’envoyer une photo complémentaire.'})]);
 const data={...empty(),alerts:[{orderId:A,type:'photos_incomplete',eventAt:'2026-11-20T09:00:00Z'}]};
 const cs=makeCandidates(data,[draft({objet:'Validation',texte:'Pouvez-vous valider votre aperçu ?'})],{[A]:c});
 assert.ok(cs.every(c=>c.blocked===null));assert.ok(cs.every(c=>c.limitations.length>0));
});
test('doublon envoyé exact ne disparaît pas si historique limité ou texte tronqué',()=>{
 const exact=context(order(),[event({kind:'email.outgoing',body:draft().texte})],{limited:true});
 assert.equal(makeCandidates(empty(),[draft()],{[A]:exact})[0].blocked,null);
 const b=draft({objet:'x'.repeat(701)});
 assert.equal(makeCandidates(empty(),[b],{[A]:context(order(),[event({kind:'email.outgoing',body:b.texte})])})[0].blocked,null);
});
