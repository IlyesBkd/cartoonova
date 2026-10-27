import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);require('tsx/cjs');
const {measureGiftGuide}=require('../lib/giftGuideMeasurement.ts');
const {settleGiftGuide}=require('../lib/giftGuideSettlement.ts');
if(process.argv.length!==3){console.error('Usage: node scripts/measure-gift-guide.mjs <consented-joined-export.json>');process.exitCode=2;}
else try{
 const input=JSON.parse(readFileSync(process.argv[2],'utf8'));
 console.log(JSON.stringify(Object.hasOwn(input,'journals')?settleGiftGuide(input):measureGiftGuide(input),null,2));
}
catch{console.error('Invalid measurement input; no report produced.');process.exitCode=1;}
