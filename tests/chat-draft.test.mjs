import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bilingualDraft,parseBilingual} from '../scripts/telegram-bilingual.mjs';
import {notificationParts} from '../scripts/telegram-progressive.mjs';
import {joined} from './telegram-test-helpers.mjs';
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
