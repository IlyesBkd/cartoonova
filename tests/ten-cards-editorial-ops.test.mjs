import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {spawnSync,execFileSync} from 'node:child_process';
import {loadDeep} from './order-delivery-harness.mjs';

test('artifact guard fails closed without printing the synthetic secret',()=>{
 const cwd=mkdtempSync(path.join(tmpdir(),'artifact-guard-'));execFileSync('git',['init','-q'],{cwd});
 const synthetic=['sk','live','SYNTHETICNOTAREALKEY123456789'].join('_');writeFileSync(path.join(cwd,'example.txt'),synthetic);execFileSync('git',['add','example.txt'],{cwd});
 const scan=spawnSync(process.execPath,[path.resolve('scripts/check-artifact-secrets.mjs'),'--staged'],{cwd,encoding:'utf8'});assert.equal(scan.status,1);assert.ok(!scan.stdout.includes(synthetic));assert.ok(scan.stdout.includes('secret signature'));
});

test('isolated build refuses all .env* entries before setup without printing contents',()=>{
 for(const name of ['.env','.env.local','.env.production','.env.production.local','.env.example']){
  const cwd=mkdtempSync(path.join(tmpdir(),'build-env-'));mkdirSync(path.join(cwd,'scripts'));
  copyFileSync('scripts/verify-ten-cards-local.py',path.join(cwd,'scripts/verify-ten-cards-local.py'));
  writeFileSync(path.join(cwd,name),'SYNTHETIC_CONTENT_MUST_NOT_PRINT');
  const run=spawnSync('python3',[path.join(cwd,'scripts/verify-ten-cards-local.py')],{encoding:'utf8',env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:tmpdir()}});
  assert.notEqual(run.status,0);assert.match(run.stdout+run.stderr,/Refusing isolated build: \.env\* entries present/);assert.ok(!(run.stdout+run.stderr).includes('SYNTHETIC_CONTENT_MUST_NOT_PRINT'));
 }
});

test('inherited and unknown slugs preserve the original article and have no editorial aside',()=>{
 const {withEditorialIntent,getFrenchArticleIntent}=loadDeep('lib/articleIntents.ts');
 for(const slug of ['constructor','toString','__proto__','hasOwnProperty','ordinary']){
  const article={slug,locale:'fr',title:'Original',excerpt:'Original',seo:{title:'Original',description:'Original'}};
  assert.equal(withEditorialIntent(article),article);
  assert.equal(getFrenchArticleIntent(slug),undefined);
 }
});

test('four editorial intents are distinct, paired contextually and preserve other locales',()=>{
 const {FRENCH_ARTICLE_INTENTS:map,withEditorialIntent}=loadDeep('lib/articleIntents.ts');
 assert.equal(new Set(Object.values(map).map(x=>x.query)).size,4);assert.equal(new Set(Object.values(map).map(x=>x.title)).size,4);
 for(const [slug,intent] of Object.entries(map)){
  assert.ok(map[intent.related]);assert.notEqual(intent.related,slug);
  const article={slug,locale:'fr',title:'Original',excerpt:'Original',seo:{title:'Original',description:'Original'}};
  assert.equal(withEditorialIntent(article).title,intent.title);assert.equal(withEditorialIntent({...article,locale:'en'}).title,'Original');
 }
});
