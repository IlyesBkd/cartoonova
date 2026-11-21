import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadOrderContext,orderBrief,translateMessage} from '../scripts/chat-notification-context.mjs';
import {nextTask,saveTranslation} from '/home/hermes/.hermes/profiles/cartoonova/scripts/notification-translation.mjs';
const id='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const order={id,customer_email:'TEST@example.invalid',paid_at:'2026-11-01T00:00:00Z',created_at:'2026-10-31T23:30:00Z',status:'PAID',options:{style:'ghibli',printKey:'canvas',format:'portrait'}};
const message={id:42,email:'test@example.invalid',body:'Where is my order? | Keep this pipe.'};
function contextSQL(orders,{fail=false}={}) {
 const calls=[];
 const tx=async(strings,...values)=>{const query=strings.join('?');calls.push({query,values});if(query.includes('SET LOCAL'))return [];if(query.includes('FROM orders')){if(fail)throw Error('private error');return orders;}throw Error('Unexpected context SQL');};
 const sql={calls,begin:async(mode,fn)=>{assert.equal(mode,'isolation level repeatable read read only');return fn(tx);}};return sql;
}
function isolated(fn) {const dir=mkdtempSync(join(tmpdir(),'chat-context-fr-'));try{return fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}}

test('unique exact-email paid purchase: short French brief has date/year, style, support, format and recorded status',async()=>{
 const sql=contextSQL([order]);const context=await loadOrderContext(sql,message);
 assert.equal(context.linkage,'verified');assert.equal(context.customerStatus,'existing');
 const text=orderBrief(context);
 for(const expected of ['31/10/2026','Studio Ghibli','Toile','Portrait (buste)','PAID','identité non authentifiée'])assert.ok(text.includes(expected),expected);
 assert.equal(sql.calls.length,2);assert.deepEqual(sql.calls[1].values,[message.email,null,null,null]);
 assert.ok(sql.calls.every(c=>!/^\s*(INSERT|UPDATE|DELETE)/.test(c.query)));
});
test('no purchase, ambiguous purchases, explicit valid relation and contradictory relation are distinct',async()=>{
 assert.equal((await loadOrderContext(contextSQL([]),message)).linkage,'none');
 const ambiguous=await loadOrderContext(contextSQL([order,{...order,id:other}]),message);
 assert.equal(ambiguous.linkage,'ambiguous');assert.equal(ambiguous.order,undefined);
 assert.match(orderBrief(ambiguous),/Plusieurs commandes.*aucune sélectionnée/);
 const linked=await loadOrderContext(contextSQL([order,{...order,id:other}]),{...message,orderId:other});
 assert.equal(linked.order.id,other);
 const contradiction=await loadOrderContext(contextSQL([{...order,customer_email:'someone-else@example.invalid'}]),{...message,orderId:id});
 assert.equal(contradiction.linkage,'contradiction');assert.equal(contradiction.order,undefined);
 assert.match(orderBrief(contradiction),/contradictoire/);
 assert.equal((await loadOrderContext(contextSQL([]),{...message,orderId:'not-a-uuid'})).linkage,'unavailable');
});
test('lookup error is not misreported as no purchase; invalid order date/options cannot break notification',async()=>{
 const context=await loadOrderContext(contextSQL([],{fail:true}),message);
 assert.equal(context.customerStatus,'unknown');assert.match(orderBrief(context),/indisponible/);
 assert.match(orderBrief({linkage:'none'}),/Aucune commande payée/);
 assert.match(orderBrief({linkage:'verified',order:{created_at:'invalid',options:'not json'}}),/non renseignée/);
});
test('existing local translation queue preserves the entire original, including pipes and whitespace; no new API',()=>isolated(dir=>{
 const path=join(dir,'cache.sqlite');const body=' \nHello | <b>world</b> MEDIA:/etc/passwd 😀\n'.repeat(400)+' END  ';
 const before=translateMessage(body,{path});assert.deepEqual(before,{status:'pending'});
 const task=nextTask(path);assert.equal(task.source,body);
 const french=' \nBonjour | <b>monde</b> MEDIA:/etc/passwd 😀\n'.repeat(400)+' FIN  ';
 saveTranslation({key:task.key,fr:french},path);
 const after=translateMessage(body,{path});assert.deepEqual(after,{status:'ready',text:french});
 assert.equal(nextTask(path),null);assert.equal(statSync(path).mode&0o777,0o600);
 assert.equal(after.text,french);
}));

test('French language bypass remains conservative for Italian and mixed-language input',()=>{
 const resolve=()=>({ready:false});
 assert.deepEqual(translateMessage('Bonjour je voudrais modifier ma commande',{resolve}),{status:'french'});
 assert.deepEqual(translateMessage('Il non è per me, la foto',{resolve}),{status:'pending'});
 assert.deepEqual(translateMessage('Bonjour je voudrais modifier ma commande. Hello please change my order',{resolve}),{status:'pending'});
});
