import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);require('tsx/cjs');
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const load=()=>require('../lib/giftGuideSettlement.ts').settleGiftGuide;
const journal={version:1,sessionId:'00000000-0000-4000-8000-000000000001',cohort:'guided-v1',consent:true,events:['viewed','exposed','clicked'],checkouts:[{paymentIntentId:'pi_one'}]};
const payment={source:'authoritative-payment-export',paymentIntentId:'pi_one',orderId:'order1',paidAt:'2026-10-27T12:00:00Z',status:'succeeded',currency:'EUR',receivedMinor:3000,refundedMinor:500,taxNetMinor:400,variableCostMinor:700};
test('join uses exact prepared payment ID; actual refunds, net tax and variable costs determine margin',()=>{
 const result=load()({journals:[journal],payments:[payment,payment]});
 assert.equal(result.measurement.cohorts[0].paidOrders,1);assert.equal(result.measurement.groups[0].revenueMinor,2100);assert.equal(result.measurement.groups[0].marginMinor,1400);
 assert.deepEqual(result.funnel,[{cohort:'guided-v1',assignedSessions:1,viewedSessions:1,exposedSessions:1,clickedSessions:1}]);
 assert.equal(result.refunds[0].refundedMinor,500);assert.equal(result.refunds[0].refundedOrders,1);assert.equal(result.refunds[0].refundOrderRate,1);
});
test('unknown refund/tax/cost stays unknown, full refunds still represent historical paid conversion',()=>{
 for(const field of ['refundedMinor','taxNetMinor','variableCostMinor']){
  const r=load()({journals:[journal],payments:[{...payment,[field]:null}]});
  assert.equal(r.measurement.cohorts[0].paidOrders,1);assert.equal(r.measurement.groups[0].marginMinor,null);
  if(field!=='variableCostMinor')assert.equal(r.measurement.groups[0].revenueMinor,null);
 }
 const r=load()({journals:[journal],payments:[{...payment,refundedMinor:3000,taxNetMinor:0}]});
 assert.equal(r.measurement.groups[0].revenueMinor,0);assert.equal(r.measurement.groups[0].marginMinor,-700);assert.equal(r.measurement.cohorts[0].paidOrders,1);
});
test('pending intents, clicks, orphan settlements and separate currencies cannot fabricate attributable paid conversions',()=>{
 const control={...journal,sessionId:'00000000-0000-4000-8000-000000000002',cohort:'control',events:[],checkouts:[]};
 const r=load()({journals:[journal,control],payments:[{...payment,status:'pending',paidAt:null},{...payment,paymentIntentId:'pi_orphan',orderId:'orphan'}]});
 assert.equal(r.measurement.unattributedPaidOrders,1);assert.deepEqual(r.measurement.cohorts.map(c=>c.paidOrders),[0,0]);assert.deepEqual(r.refunds,[]);
 const multi=load()({journals:[{...journal,checkouts:[...journal.checkouts,{paymentIntentId:'pi_usd'}]}],payments:[payment,{...payment,paymentIntentId:'pi_usd',orderId:'usd',currency:'USD',variableCostMinor:null}]});
 assert.equal(multi.measurement.cohorts[0].paidSessions,1);assert.deepEqual(multi.measurement.groups.map(g=>g.currency),['EUR','USD']);assert.equal(multi.refunds[1].unknownCostOrders,1);
});
test('ambiguous attribution, conflicting refunds and unauthorized journals fail closed',()=>{
 for(const input of [
  {journals:[journal,{...journal,sessionId:'00000000-0000-4000-8000-000000000002'}],payments:[payment]},
  {journals:[{...journal,consent:false}],payments:[payment]},
  {journals:[journal],payments:[payment,{...payment,refundedMinor:600}]},
  ...[{paidAt:null},{receivedMinor:0,refundedMinor:0,taxNetMinor:0},{refundedMinor:3001},{taxNetMinor:3000},{variableCostMinor:-1},{source:'browser-event'},{receivedMinor:NaN}].map(p=>({journals:[journal],payments:[{...payment,...p}]}))
 ])assert.throws(()=>load()(input));
});
test('real offline CLI recognizes raw journal plus authoritative settlement contract, redacts invalid inputs',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'guide-settlement-'));
 try{
  const file=path.join(dir,'export.json');const input={journals:[journal],payments:[payment]};writeFileSync(file,JSON.stringify(input));
  const run=()=>spawnSync(process.execPath,['scripts/measure-gift-guide.mjs',file],{encoding:'utf8',timeout:10000});
  const child=run();assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),load()(input));
  writeFileSync(file,JSON.stringify({journals:[{...journal,sessionId:'private@example.invalid'}],payments:[]}));const bad=run();assert.equal(bad.status,1);assert.equal(bad.stdout,'');assert.ok(!bad.stderr.includes('private@'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
