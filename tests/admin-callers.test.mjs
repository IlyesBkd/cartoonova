import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${dir}/${e.name}`):/\.tsx?$/.test(e.name)?[`${dir}/${e.name}`]:[]);}
test('every protected caller awaits the asynchronous guard before examining its result',()=>{
 const invalid=[];
 for(const file of [...files('app/api'), 'lib/uploadPolicy.ts']){
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  const visit=node=>{if(ts.isCallExpression(node)&&['requireAdmin','refuserSiPasAdmin'].includes(node.expression.getText(source))&&!ts.isAwaitExpression(node.parent))invalid.push(file);ts.forEachChild(node,visit);};visit(source);
 }
 assert.deepEqual(invalid,[]);
});
