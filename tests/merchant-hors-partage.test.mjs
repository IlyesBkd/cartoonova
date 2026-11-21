import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, existsSync} from 'node:fs';
import {createRequire, Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
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
const {visuelsProduit}=load('lib/visuels.ts');

test('Rick et Morty : photos reelles et armes restent sur le site mais ne partent pas dans le flux', ()=>{
 const v=visuelsProduit('rickandmorty');
 assert.equal(v.galerie[0],'/rickandmorty/Photo_produits/1.png');
 assert.equal(v.partage[0],'/rickandmorty/Photo_produits/il_1140xN.6929433252_cgte.png');
 for(const exclu of ['1.png','il_1140xN.6929430540_28j8.png','il_1140xN.6977423979_mjqy.png','il_794xN.4850315697_f5io.png'])
  assert.ok(!v.partage.some(s=>s.endsWith('/'+exclu)), exclu);
 assert.equal(v.partage.length, v.galerie.length-4);
});

test('un produit sans horsPartage garde toute sa galerie dans le flux', ()=>{
 const v=visuelsProduit('simpson');
 assert.equal(v.partage.length, v.galerie.length);
});
