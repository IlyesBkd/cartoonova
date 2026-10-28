import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);require('tsx/cjs');
test('server preparation is disabled before reading any request, consent or storage',async()=>{
 assert.ok(existsSync(new URL('../lib/giftGuideServer.ts',import.meta.url)), 'missing disabled server preparation');
 const {giftGuideMeasurementRequest}=require('../lib/giftGuideServer.ts');
 let touched=0;
 const response=await giftGuideMeasurementRequest(new Request('https://local.invalid/api/measurement/gift-guide',{method:'POST',body:'invalid'}),{enabled:false, consent:()=>{touched++;throw Error('must not run');}});
 assert.equal(response.status,404);assert.equal(touched,0);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('set-cookie'),null);
});
test('deployed route refuses default/public-only flags and cannot activate without consent adapter',async()=>{
 assert.ok(existsSync(new URL('../app/api/measurement/gift-guide/route.ts',import.meta.url)),'missing deployable disabled route');
 const {POST,DELETE}=require('../app/api/measurement/gift-guide/route.ts');
 const req=()=>new Request('https://local.invalid/api/measurement/gift-guide',{method:'POST',body:JSON.stringify({consent:true,sessionId:'spoof',paid:true,amount:999999})});
 delete process.env.GIFT_GUIDE_SERVER_MEASUREMENT;process.env.NEXT_PUBLIC_GIFT_GUIDE_LOCAL_MEASUREMENT='1';
 assert.equal((await POST(req())).status,404);
 process.env.GIFT_GUIDE_SERVER_MEASUREMENT='1';
 assert.equal((await POST(req())).status,503);assert.equal((await DELETE(req())).status,503);
 delete process.env.GIFT_GUIDE_SERVER_MEASUREMENT;delete process.env.NEXT_PUBLIC_GIFT_GUIDE_LOCAL_MEASUREMENT;
});
