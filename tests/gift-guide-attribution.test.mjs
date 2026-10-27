import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);require('tsx/cjs');
const load=()=>require('../lib/giftGuideAttribution.ts');
test('local journal keeps stable explicit control; withdrawal erases and cannot attach payment',()=>{
 const {createGiftGuideJournal}=load();
 let consent='granted';let stored=null;let randomCalls=0;
 const journal=createGiftGuideJournal({enabled:()=>true,consent:()=>consent,read:()=>stored,write:v=>{stored=v;},id:()=> '00000000-0000-4000-8000-000000000001',random:()=>{randomCalls++;return 0;}});
 assert.equal(journal.enroll().cohort,'control');
 assert.equal(journal.enroll().cohort,'control');assert.equal(randomCalls,1);
 journal.record('viewed');journal.record('clicked');
 assert.equal(journal.export().events.length,0,'control is assigned, never exposed to guide');
 journal.attachCheckout('pi_synthetic_secret_NEVERSTORE',journal.captureCheckout());
 assert.equal(journal.export().checkouts[0].paymentIntentId,'pi_synthetic');
 assert.ok(!JSON.stringify(stored).includes('NEVERSTORE'));
 consent='denied';assert.equal(journal.export(),null);assert.equal(stored,null);
 journal.attachCheckout('pi_second_secret_NEVERSTORE',journal.captureCheckout());assert.equal(stored,null);
 consent='pending';assert.equal(journal.enroll(),null);
});
test('withdrawal invalidates the generation even when removal throws and writes recover later',()=>{
 const {createGiftGuideJournal}=load();let consent='granted',stored=null,blocked=false,n=0;
 const j=createGiftGuideJournal({enabled:()=>true,consent:()=>consent,read:()=>stored,write:v=>{if(blocked)throw Error('SecurityError');stored=v;},id:()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`,random:()=>0.9});
 const a=j.enroll();j.record('viewed');j.attachCheckout('pi_old_secret_SYNTHETIC',j.captureCheckout());
 blocked=true;consent='denied';assert.equal(j.export(),null);assert.ok(stored,'physical deletion really failed');
 consent='granted';assert.equal(j.export(),null,'stale readable data remains invalidated');assert.equal(j.enroll(),null,'cannot collect without durable replacement');
 blocked=false;const b=j.enroll();assert.notEqual(b.sessionId,a.sessionId);assert.deepEqual(b.events,[]);assert.deepEqual(b.checkouts,[]);
});
test('guided journal separates rendered, exposed and clicked; disabled and blocked storage fail closed',()=>{
 const {createGiftGuideJournal}=load();let stored=null;let enabled=true;
 const io={enabled:()=>enabled,consent:()=> 'granted',read:()=>stored,write:v=>{stored=v;},id:()=> '00000000-0000-4000-8000-000000000002',random:()=>0.9};
 const j=createGiftGuideJournal(io);assert.equal(j.enroll().cohort,'guided-v1');
 j.record('viewed');j.record('clicked');assert.deepEqual(j.export().events,['viewed']);
 j.record('exposed');j.record('clicked');j.record('clicked');assert.deepEqual(j.export().events,['viewed','exposed','clicked']);
 j.attachCheckout('email@example.test',j.captureCheckout());assert.deepEqual(j.export().checkouts,[]);
 enabled=false;assert.equal(j.export(),null);assert.equal(stored,null);
 assert.equal(createGiftGuideJournal({...io,enabled:()=>true,write:()=>{throw Error('blocked');}}).enroll(),null);
});
