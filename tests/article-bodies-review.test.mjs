import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadDeep} from './order-delivery-harness.mjs';
test('reviewed FR bodies deliver the specific intent without inherited commercial claims',()=>{
 const {FRENCH_ARTICLE_INTENTS:map,withEditorialIntent}=loadDeep('lib/articleIntents.ts');
 const topics=[['budget','délai'],['passions','souvenirs'],['tirage','numérique'],['brief','souvenir']];
 Object.entries(map).forEach(([slug],i)=>{
  const original={slug,locale:'fr',body:'Ancien corps : livraison sous 48h, jusqu’à satisfaction.',title:'Old',excerpt:'Old',seo:{title:'Old',description:'Old'}};
  const revised=withEditorialIntent(original);
  assert.notEqual(revised.body,original.body,'title/intro alone must not mask an unrelated old body');
  for(const topic of topics[i])assert.ok(revised.body.toLowerCase().includes(topic));
  assert.ok(revised.body.length>1800);
  assert.doesNotMatch(revised.body,/48\s*h|24\s*[–-]\s*72|jusqu.?à satisfaction|100\s*%|5\s*\/\s*5/i);
  assert.equal(withEditorialIntent({...original,locale:'en'}).body,original.body);
 });
});
