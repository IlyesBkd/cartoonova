import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);require('tsx/cjs');
const measure=()=>require('../lib/giftGuideMeasurement.ts').measureGiftGuide;
const sessions=[{sessionId:'s1',cohort:'guided-v1',consent:true},{sessionId:'s2',cohort:'guided-v1',consent:true}];
const order={orderId:'o1',sessionId:'s1',paid:true,currency:'EUR',netRevenueMinor:2000,variableCostMinor:400};
test('paid conversion uses unique consented sessions, not orders or CTA clicks',()=>{
 const result=measure()({sessions:[...sessions,sessions[0]],orders:[order,order,{...order,orderId:'o2'}]});
 assert.equal(result.groups[0].sessions,2);assert.equal(result.groups[0].paidSessions,1);assert.equal(result.groups[0].conversion,0.5);assert.equal(result.groups[0].revenuePerSessionMinor,2000);assert.equal(result.groups[0].marginPerSessionMinor,1600);
});
test('unpaid, denied, orphan and unknown costs cannot create measured margin',()=>{
 const result=measure()({sessions:[...sessions,{sessionId:'denied',cohort:'guided-v1',consent:false}],orders:[{...order,paid:false},{...order,orderId:'denied',sessionId:'denied'},{...order,orderId:'orphan',sessionId:'missing'},{...order,orderId:'unknown',variableCostMinor:null}]});
 assert.equal(result.groups[0].paidSessions,1);assert.equal(result.groups[0].marginMinor,null);assert.equal(result.groups[0].marginPerSessionMinor,null);assert.equal(result.unattributedPaidOrders,2);
});
test('currency totals remain separate and empty data has no fabricated zero rate',()=>{
 assert.deepEqual(measure()({sessions:[],orders:[]}).groups,[]);
 const result=measure()({sessions,orders:[order,order,{...order,orderId:'usd',currency:'USD'},{...order,orderId:'usd-s2',sessionId:'s2',currency:'USD',netRevenueMinor:1000,variableCostMinor:null}]});
 assert.deepEqual(result.cohorts,[{cohort:'guided-v1',sessions:2,paidSessions:2,paidOrders:3,conversion:1}]);
 assert.deepEqual(result.groups,[
  {cohort:'guided-v1',currency:'EUR',sessions:2,paidSessions:1,paidOrders:1,revenueMinor:2000,marginMinor:1600,conversion:0.5,revenuePerSessionMinor:1000,marginPerSessionMinor:800},
  {cohort:'guided-v1',currency:'USD',sessions:2,paidSessions:2,paidOrders:2,revenueMinor:3000,marginMinor:null,conversion:1,revenuePerSessionMinor:1500,marginPerSessionMinor:null},
 ]);
});
test('zero-purchase control remains in cohort conversion without fabricated financial rows',()=>{
 const result=measure()({sessions:[...sessions,{sessionId:'control',cohort:'control',consent:true},{sessionId:'denied-control',cohort:'control',consent:false}],orders:[order]});
 assert.deepEqual(result.cohorts,[
  {cohort:'control',sessions:1,paidSessions:0,paidOrders:0,conversion:0},
  {cohort:'guided-v1',sessions:2,paidSessions:1,paidOrders:1,conversion:0.5},
 ]);
 assert.equal(result.consentedSessions,3);
 assert.deepEqual(result.groups.map(g=>[g.cohort,g.currency]),[['guided-v1','EUR']]);
});
test('sessions without orders retain zero conversion and no invented currency',()=>{
 const result=measure()({sessions:[...sessions,sessions[0],{sessionId:'control',cohort:'control',consent:true},{sessionId:'denied',cohort:'denied',consent:false}],orders:[]});
 assert.deepEqual(result.cohorts,[{cohort:'control',sessions:1,paidSessions:0,paidOrders:0,conversion:0},{cohort:'guided-v1',sessions:2,paidSessions:0,paidOrders:0,conversion:0}]);
 assert.equal(result.consentedSessions,3);
 assert.deepEqual(result.groups,[]);
 assert.deepEqual(measure()({sessions:[],orders:[]}).cohorts,[]);
});
test('ambiguous joins and invalid financial inputs fail closed',()=>{
 for(const data of [{sessions:[...sessions,{...sessions[0],cohort:'other'}],orders:[]},{sessions,orders:[order,{...order,netRevenueMinor:99}]},{sessions,orders:[{...order,variableCostMinor:-1}]},{sessions,orders:[{...order,netRevenueMinor:NaN}]}])assert.throws(()=>measure()(data));
});
test('unknown net revenue preserves paid conversion without inventing zero revenue or margin',()=>{
 const result=measure()({sessions,orders:[{...order,netRevenueMinor:null}]});
 assert.equal(result.cohorts[0].paidOrders,1);assert.equal(result.groups[0].revenueMinor,null);assert.equal(result.groups[0].marginMinor,null);assert.equal(result.groups[0].revenuePerSessionMinor,null);
});
test('offline CLI emits both conversion and financial tables, including sessions-only exports',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'measure-cli-'));
 try{
  const file=path.join(dir,'fixture.json');
  for(const orders of [[],[order]]){
   const input={sessions:[...sessions,{sessionId:'control',cohort:'control',consent:true}],orders};
   writeFileSync(file,JSON.stringify(input));
   const child=spawnSync(process.execPath,['scripts/measure-gift-guide.mjs',file],{encoding:'utf8',timeout:10000});
   assert.equal(child.status,0,child.stderr);assert.equal(child.stderr,'');
   assert.deepEqual(JSON.parse(child.stdout),measure()(input));
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
