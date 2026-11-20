import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, existsSync} from 'node:fs';
import {createRequire, Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
process.env.TZ='UTC';
function load(file,cache=new Map()) {
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;
 const m=new Module(file);m.filename=file;cache.set(file,m);const req=createRequire(file);
 m.require=name=>{
  if(name.startsWith('.')||name.startsWith('@/')) {
   const base=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(file),name);
   for(const ext of ['.ts','.tsx'])if(existsSync(base+ext))return load(base+ext,cache);
  }
  return req(name);
 };
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);return m.exports;
}
const {evenementAffiche}=load('lib/evenements.ts');
const at=s=>evenementAffiche('fr',new Date(s));

test('Black Friday 2026 : code affiché seulement pendant sa validité, fenêtre jusqu au Cyber Monday',()=>{
 assert.equal(at('2026-11-24T12:00:00Z').cle,'blackFriday');
 assert.equal(at('2026-11-24T12:00:00Z').offre,undefined);
 assert.equal(at('2026-11-26T22:59:00Z').offre,undefined);
 assert.deepEqual(at('2026-11-26T23:00:00Z').offre,{code:'BF2026',remise:20,fin:'30 novembre'});
 assert.equal(at('2026-11-29T12:00:00Z').offre?.code,'BF2026');
 assert.equal(at('2026-11-30T16:59:00Z').offre?.code,'BF2026');
 assert.equal(at('2026-11-30T17:00:00Z').offre,undefined);
 assert.equal(at('2026-11-30T12:00:00Z').cle,'blackFriday');
 assert.equal(at('2026-12-01T12:00:00Z').cle,'noel');
 assert.equal(at('2027-11-27T12:00:00Z').offre,undefined);
});

test('chaque langue a le texte du code, avec code, remise et date',()=>{
 for(const l of ['fr','en','es','de','it','nl','pl','sv','da','pt']){
  const t=JSON.parse(readFileSync(path.join(root,'messages',l+'.json'),'utf8')).evenements.blackFriday.promoCode;
  for(const k of ['{code}','{remise}','{fin}'])assert.ok(t.includes(k),l+' '+k);
 }
});
