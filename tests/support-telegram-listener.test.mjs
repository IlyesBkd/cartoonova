import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createDispatcher,runWrapper,CHANNEL} from '../scripts/support-telegram-listener.mjs';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('notifications coalesce per channel while reception is busy; enrichment never blocks new originals',async()=>{
 const gate=deferred(),draft=deferred(),events=[];let count=0;
 const d=createDispatcher({receive:async kind=>{events.push('receive:'+kind);if(++count===1)await gate.promise;},enrich:async kind=>{events.push('enrich:'+kind);await draft.promise;}});
 d.notify('chat');d.notify('chat');d.notify('chat');
 assert.deepEqual(events,['receive:chat']);gate.resolve();await tick();
 assert.equal(events.filter(x=>x==='receive:chat').length,2);
 assert.equal(events.filter(x=>x==='enrich:chat').length,1);
 d.notify('chat');await tick();
 assert.equal(events.filter(x=>x==='receive:chat').length,3,'new original is not blocked by inference');
 draft.resolve();await d.idle();await d.close();
});

test('reconnect checks both queues; invalid payload cannot invoke a wrapper',async()=>{
 const events=[];const d=createDispatcher({receive:async k=>events.push('receive:'+k),enrich:async k=>events.push('enrich:'+k)});
 for(const value of ['__proto__','constructor','email; touch x','',{},null])d.notify(value);
 await d.idle();assert.equal(events.length,0);
 d.reconnect();await d.idle();assert.deepEqual(new Set(events),new Set(['receive:chat','receive:email','enrich:chat','enrich:email']));
 await d.close();d.notify('chat');await d.idle();assert.equal(events.length,4);
 assert.equal(CHANNEL,'cartoonova_support_incoming');
});

test('failed reception leaves cron fallback and does not spin indefinitely',async()=>{
 const errors=[];let receives=0,enrichments=0;
 const d=createDispatcher({receive:async()=>{receives++;throw Error('synthetic');},enrich:async()=>{enrichments++;},onError:(...a)=>errors.push(a)});
 d.notify('email');await d.idle();assert.equal(receives,1);assert.equal(enrichments,1);assert.deepEqual(errors,[['email','receive']]);await d.close();
});

test('wrappers receive separate modes and never use a shell or expose output',async()=>{
 const calls=[];
 const spawnImpl=(command,args,options)=>{calls.push({command,args,options});const child=new EventEmitter();process.nextTick(()=>child.emit('exit',0));return child;};
 await runWrapper('chat',{receiveOnly:true,env:{TEST:'fixture'},spawnImpl});
 await runWrapper('email',{env:{TEST:'fixture',TELEGRAM_RECEIVE_ONLY:'1'},spawnImpl});
 assert.equal(calls[0].command,'/usr/bin/python3');assert.equal(calls[0].options.shell,undefined);
 assert.equal(calls[0].options.stdio,'ignore');assert.equal(calls[0].options.env.TELEGRAM_RECEIVE_ONLY,'1');
 assert.equal(calls[1].options.env.TELEGRAM_RECEIVE_ONLY,undefined);
 assert.throws(()=>runWrapper('unknown',{spawnImpl}),/Invalid support channel/);
});
