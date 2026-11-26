import {test as nodeTest} from 'node:test';
import {serverSkip,serverOnly} from './helpers/server-only.mjs';
const skip=serverSkip();
const test=serverOnly(nodeTest,skip);
import assert from 'node:assert/strict';
const {bilingualDraft,parseBilingual}=skip?{}:await import('../scripts/telegram-bilingual.mjs');
const {notificationParts}=skip?{}:await import('../scripts/telegram-progressive.mjs');
const {joined}=skip?{}:await import('./telegram-test-helpers.mjs');
for(const language of ['fr','it','en'])test(`bilingual ${language}: complete client draft and French version remain distinct from original`,async()=>{
 const body='Original 😀\n'.repeat(800),draftClient=`${language} client draft 😀`,draftFR='Version française du brouillon';
 const result=await bilingualDraft({bodyText:body,subject:'Synthetic'},{infer:async input=>{assert.equal(input.bodyText,body);return JSON.stringify({language,draftClient,draftFR,messageFR:'Traduction française intégrale'});}});
 assert.equal(result.language,language);assert.equal(result.translation.status,language==='fr'?'french':'ready');
 const all=joined(notificationParts({id:1,email:'a@example.invalid',body,...result,preparing:false}));
 assert.ok(all.includes(body));assert.ok(all.includes(draftClient));assert.ok(all.includes(draftFR));
});
test('bilingual parser rejects plain drafts, malformed JSON and missing French version',()=>{
 for(const value of ['plain draft','```json {} ```','{}',JSON.stringify({language:'en',draftClient:'Hello',messageFR:'Bonjour'})])assert.throws(()=>parseBilingual(value));
});
