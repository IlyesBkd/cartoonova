import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const root=path.resolve(import.meta.dirname,'..');
function load(file,replacements={}){
 const filename=path.join(root,file),m=new Module(filename),real=createRequire(filename);m.filename=filename;
 real('tsx/cjs');m.require=n=>Object.hasOwn(replacements,n)?replacements[n]:real(n.startsWith('@/')?path.join(root,n.slice(2)):n);
 m._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return m.exports;
}
const marker=props=>React.createElement('div',{'data-client-action':'true','data-props':JSON.stringify(props)});
test('FLOW05 real server pages do not expose actionable forms in unpaid or closed phases',async()=>{
 let order={id:'12345678-1234-1234-1234-123456789abc',paid_at:null,photo_urls:[],options:{},customer_email:'synthetic@example.invalid',poster_confirmation_token:'preview',poster_confirmation_sent_at:'2026-01-01',final_image_url:'https://example.invalid/final.png',poster_confirmation_image_url:'https://example.invalid/final.png',poster_confirmation_email:'synthetic@example.invalid'};
 const deps={'@/lib/db':{getOrderById:async()=>order,getOrderByConfirmationToken:async()=>order},'@/lib/emailToken':{parseOrderTrackingToken:()=>order.id},'next/image':()=>null,'next-intl/server':{setRequestLocale:()=>{}},'./DepotClient':{default:marker,__esModule:true},'./ConfirmClient':{default:marker,__esModule:true},'./NouvelAvisClient':{default:marker,__esModule:true}};
 const depot=load('app/(hors-langue)/depot/[token]/page.tsx',deps).default;
 const confirm=load('app/(hors-langue)/confirm-poster/[token]/page.tsx',deps).default;
 const review=load('app/[locale]/avis/nouveau/page.tsx',deps).default;
 const render=async f=>renderToStaticMarkup(await f({params:Promise.resolve({token:'synthetic',locale:'fr'}),searchParams:Promise.resolve({c:'synthetic'})}));
 for(const f of [depot,confirm,review])assert.ok(!(await render(f)).includes('data-client-action'),f.name+': unpaid');
 order={...order,paid_at:'2026-01-01',poster_confirmation_sent_at:null};assert.ok((await render(depot)).includes('data-client-action'));
 order.poster_confirmation_sent_at='2026-01-01';assert.ok((await render(confirm)).includes('data-client-action'));assert.ok(!(await render(depot)).includes('data-client-action'));
 order.final_image_sent_at='2026-01-02';assert.ok(!(await render(confirm)).includes('data-client-action'));assert.ok((await render(review)).includes('data-client-action'));
});

async function bundle(){
 const stubs={'@/lib/analytics':'export const mesure=()=>{}','@/lib/uploadClient':'export const uploadImage=async()=>({url:"https://synthetic.invalid/orders/new.jpg"})'};
 return (await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Depot from './app/(hors-langue)/depot/[token]/DepotClient';import Confirm from './app/(hors-langue)/confirm-poster/[token]/ConfirmClient';createRoot(document.getElementById('root')).render(<><section id="depot"><Depot token="synthetic" lang="fr" initialPhotos={['https://synthetic.invalid/orders/old.jpg']}/></section><section id="confirm"><Confirm token="synthetic" lang="fr" initialStatus={null} respondedAt={null} initialNote={null} initialPhotos={[]}/></section></>);`},plugins:[{name:'local',setup(b){b.onResolve({filter:/./},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'local'}:undefined);b.onLoad({filter:/./,namespace:'local'},a=>({contents:stubs[a.path],loader:'js'}));}}]})).outputFiles[0].text;
}
test('FLOW07 actual Chromium displays persisted references and sends explicit removal and replacement snapshots',async()=>{
 const script=await bundle(),browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage(),payloads=[];await page.route('**/*',async r=>{
  if(r.request().url().endsWith('/api/orders/photos')){const b=r.request().postDataJSON();payloads.push(b);await r.fulfill({json:{ok:true,photoUrls:b.operation==='remove'?[]:b.photoUrls}});}else await r.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
 });await page.goto('https://local.invalid');await page.addScriptTag({content:script});
 assert.equal(await page.locator('#depot img').count(),1,'existing references visible');
 await page.locator('#depot button[aria-label="Retirer cette référence"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#depot img').length===0);
 assert.equal(payloads[0].operation,'remove');assert.deepEqual(payloads[0].expectedPhotos,['https://synthetic.invalid/orders/old.jpg']);
 await page.locator('#depot input[type=file]').setInputFiles({name:'new.png',mimeType:'image/png',buffer:Buffer.from('synthetic')});
 await page.locator('#depot select').selectOption('replace');page.once('dialog',d=>d.accept());await page.locator('#depot button').last().click();
 await page.getByText("C'est reçu, merci !",{exact:true}).waitFor();
 assert.equal(payloads[1].operation,'replace');assert.deepEqual(payloads[1].expectedPhotos,[]);assert.deepEqual(payloads[1].photoUrls,['https://synthetic.invalid/orders/new.jpg']);
 }finally{await browser.close();}
});

test('FLOW09 actual Chromium textarea exposes and enforces the shared 2000-unit limit',async()=>{
 const script=await bundle(),browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));await page.goto('https://local.invalid');await page.addScriptTag({content:script});
 await page.locator('#confirm button').nth(1).click();const note=page.locator('#confirm textarea');assert.equal(await note.getAttribute('maxlength'),'2000');await note.fill('x'.repeat(2000));await note.press('End');await note.press('x');assert.equal((await note.inputValue()).length,2000);
 }finally{await browser.close();}
});
