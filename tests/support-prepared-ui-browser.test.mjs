import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const root=process.cwd();
const bundle=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Admin from './app/[locale]/admin/page';createRoot(document.getElementById('root')).render(<Admin/>);`}});
test('each pending order email stays repairable after a linked message arrives',async()=>{
 const browser=await chromium.launch({headless:true}),page=await browser.newPage();page.setDefaultTimeout(3000);
 const calls=[],orderId='order-synthetic';
 let pending=['sent','uncertain'].map((status,i)=>({id:`pending-${i}`,targetType:'order',targetId:orderId,toEmail:'customer@example.invalid',subject:`Objet ${i}`,body:`Contenu ${i}`,status,approvalFingerprint:String(i).repeat(64),attachments:[]}));
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin!=='https://admin.invalid')return route.abort();
  calls.push({path:url.pathname,body:req.postData()});
  if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
  if(url.pathname==='/api/admin/auth')return route.fulfill({status:204});
  if(url.pathname==='/api/support/messages')return route.fulfill({json:[{id:42,message_id:'new@example.invalid',from_email:'customer@example.invalid',subject:'Réponse reçue',body_text:'Message rattaché',received_at:'2026-01-01T00:00:00Z',read_at:'2026-01-01T00:00:00Z',category:'support',order_id:orderId,replies:[]}]});
  if(url.pathname==='/api/support/prepared-pending')return route.fulfill({json:pending});
  if(url.pathname==='/api/support/prepared-repair'){const body=JSON.parse(req.postData());pending=pending.filter(item=>item.id!==body.id);return route.fulfill({json:{ok:true}});}
  return route.fulfill({json:[]});
 });
 try{
  await page.goto('https://admin.invalid/');await page.addScriptTag({content:bundle.outputFiles[0].text});await page.getByRole('button',{name:/Déconnexion/}).waitFor();await page.getByRole('button',{name:/Support/}).first().click();
  await page.getByText('Envois à vérifier : 2.').waitFor();
  const first=page.locator('li').filter({hasText:'Objet 0'}),second=page.locator('li').filter({hasText:'Objet 1'});
  await first.getByRole('button',{name:'Réparer l’historique sans renvoyer'}).click();
  await page.getByText('Envois à vérifier : 1.').waitFor();
  page.once('dialog',dialog=>dialog.accept('proof-123'));
  await second.getByRole('button',{name:'Vérifier la preuve et réparer'}).click();
  await page.getByText('Envois à vérifier : 1.').waitFor({state:'detached'});
  const repairs=calls.filter(c=>c.path==='/api/support/prepared-repair').map(c=>JSON.parse(c.body));
  assert.deepEqual(repairs,[{id:'pending-0',approvalFingerprint:'0'.repeat(64)},{id:'pending-1',approvalFingerprint:'1'.repeat(64),providerId:'proof-123'}]);
  assert.equal(calls.filter(c=>c.path==='/api/support/prepared-send'||c.path==='/api/support/prepared-approve').length,0);
 }finally{await browser.close();}
});
test('an old pending conversation outside the 200 loaded messages can be repaired without sending',async()=>{
 const browser=await chromium.launch({headless:true}),page=await browser.newPage();page.setDefaultTimeout(3000);const calls=[];
 const old={id:1,message_id:'old@example.invalid',from_email:'old-client@example.invalid',subject:'Ancienne question',body_text:'Ancien message',received_at:'2020-01-01T00:00:00Z',read_at:null,category:'spam',order_id:null,replies:[]};
 const pending={id:'11111111-1111-4111-8111-111111111111',targetType:'message',targetId:'1',toEmail:old.from_email,subject:'Re: Ancienne question',body:'Bonjour',status:'sent',approvalFingerprint:'a'.repeat(64),attachments:[]};let repaired=false;
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin!=='https://admin.invalid')return route.abort();
  calls.push({url:url.pathname,query:url.search,method:req.method()});
  if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
  if(url.pathname==='/api/admin/auth')return route.fulfill({status:204});
  if(url.pathname==='/api/support/messages')return route.fulfill({json:url.searchParams.has('id')?old:Array.from({length:200},(_,i)=>({...old,id:i+2,from_email:`recent${i}@example.invalid`,category:'customer'}))});
  if(url.pathname==='/api/support/prepared-pending')return route.fulfill({json:repaired?[]:[pending]});
  if(url.pathname==='/api/support/prepared-repair'){repaired=true;return route.fulfill({json:{ok:true,replyId:1}});}
  return route.fulfill({json:[]});
 });
 try{await page.goto('https://admin.invalid/');await page.addScriptTag({content:bundle.outputFiles[0].text});await page.getByRole('button',{name:/Déconnexion/}).waitFor();await page.getByRole('button',{name:/Support/}).first().click();
  await page.getByRole('button',{name:'Conversation #1'}).click();await page.getByText('Ancien message',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Confirmer et envoyer'}).isDisabled(),true);
  await page.getByRole('button',{name:'Réparer l’historique sans renvoyer'}).click();await page.getByText('Envois à vérifier : 1.').waitFor({state:'detached'});
  assert.ok(calls.some(c=>c.url==='/api/support/messages'&&c.query==='?id=1'));assert.equal(calls.filter(c=>c.url==='/api/support/prepared-send').length,0);
 }finally{await browser.close();}
});

test('admin previews the exact file and message before explicit sending',async()=>{
 const browser=await chromium.launch({headless:true}),page=await browser.newPage();page.setDefaultTimeout(3000);const calls=[];const errors=[];let pending=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());if(url.origin!=='https://admin.invalid')return route.abort();
  if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
  calls.push({url:url.pathname,method:request.method(),body:request.postData()});
  if(url.pathname==='/api/admin/auth')return route.fulfill({status:204});
  if(url.pathname==='/api/support/messages')return route.fulfill({json:[{id:42,message_id:'source@example.invalid',from_email:'client@example.invalid',subject:'question',body_text:'Aidez-moi',received_at:'2026-01-01T00:00:00Z',read_at:'2026-01-01T00:00:00Z',category:'support',order_id:null,replies:[{id:7,to_email:'client@example.invalid',subject:'Objet envoyé très long '.repeat(12)+'FIN',body_text:'Réponse précédente',sent_at:'2026-01-01T01:00:00Z',assistee_ia:false,attachments:[]}]}]});
  if(url.pathname==='/api/support/prepare')return route.fulfill({json:{draft:{id:'11111111-1111-4111-8111-111111111111',toEmail:'client@example.invalid',subject:'Re: question',body:'Bonjour',approvalFingerprint:'a'.repeat(64),transport:{from:'Cartoonova <support@example.invalid>',replyTo:'support@example.invalid',html:'<p>Bonjour</p>',headers:null},attachments:[{name:'portrait.jpg',size:5,contentType:'image/jpeg'}]}}});
  if(url.pathname==='/api/support/prepared-approve')return route.fulfill({json:{approved:true}});
  if(url.pathname==='/api/support/prepared-send')return route.fulfill({json:{ok:true,replyId:1}});
  if(url.pathname==='/api/support/prepared-pending')return route.fulfill({json:pending});
  if(url.pathname==='/api/support/prepared-repair'){pending=[];return route.fulfill({json:{ok:true,replyId:1}});}
  return route.fulfill({json:[]});
 });
 try{
  await page.goto('https://admin.invalid/');
  if(process.env.SUPPORT_UI_CAPTURE){const css=await postcss([tailwind()]).process(await readFile('app/globals.css','utf8'),{from:'app/globals.css'});await page.addStyleTag({content:css.css});}
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.getByRole('button',{name:/Déconnexion/}).waitFor();await page.getByRole('button',{name:/Support/}).first().click();
  await page.getByRole('button',{name:/client@example.invalid/}).click();
  const historySubject=page.getByText('Objet envoyé très long '.repeat(12)+'FIN',{exact:false});
  assert.ok(await historySubject.isVisible());assert.equal(await historySubject.textContent(),'Objet : '+ 'Objet envoyé très long '.repeat(12)+'FIN');
  assert.equal(await historySubject.evaluate(el=>el.classList.contains('truncate')),false);
  await page.locator('textarea').fill('Bonjour');
  await page.locator('input[type=file]').setInputFiles({name:'portrait.jpg',mimeType:'image/jpeg',buffer:Buffer.from('proof')});
  await page.getByRole('button',{name:'Préparer l’aperçu'}).click();
  await page.getByText('À vérifier avant envoi').waitFor();assert.equal(calls.filter(x=>x.url==='/api/support/prepared-send').length,0);
  assert.ok(await page.getByText('Re: question').isVisible());assert.ok(await page.getByRole('paragraph').filter({hasText:'Bonjour'}).isVisible());
  const fingerprint=page.getByText('Empreinte du brouillon : '+ 'a'.repeat(64),{exact:true});
  assert.ok(await fingerprint.isVisible());assert.equal(calls.filter(x=>x.url==='/api/support/prepared-approve').length,0);
  assert.equal((await page.locator('iframe[title="Aperçu email"]').getAttribute('srcdoc')).includes('a'.repeat(64)),false);
  if(process.env.SUPPORT_UI_CAPTURE)await page.screenshot({path:process.env.SUPPORT_UI_CAPTURE,fullPage:true});
  assert.equal(await page.getByRole('link',{name:/portrait.jpg/}).getAttribute('href'),'/api/support/prepared-attachments/11111111-1111-4111-8111-111111111111/0');
  await page.getByRole('button',{name:'Confirmer et envoyer'}).click();await page.waitForFunction(()=>document.querySelector('textarea')?.value==='');
  const approve=calls.filter(x=>x.url==='/api/support/prepared-approve');assert.equal(approve.length,1);assert.deepEqual(JSON.parse(approve[0].body),{id:'11111111-1111-4111-8111-111111111111',approvalFingerprint:'a'.repeat(64),confirmed:true});
  const send=calls.filter(x=>x.url==='/api/support/prepared-send');assert.equal(send.length,1);assert.deepEqual(JSON.parse(send[0].body),{id:'11111111-1111-4111-8111-111111111111',approvalFingerprint:'a'.repeat(64)});
  pending=[{id:'11111111-1111-4111-8111-111111111111',targetType:'message',targetId:'42',toEmail:'client@example.invalid',subject:'Re: question',body:'Bonjour',status:'sent',approvalFingerprint:'a'.repeat(64),attachments:[{name:'portrait.jpg',size:5,contentType:'image/jpeg'}]}];
  await page.reload();await page.addScriptTag({content:bundle.outputFiles[0].text});await page.getByRole('button',{name:/Déconnexion/}).waitFor();await page.getByRole('button',{name:/Support/}).first().click();
  await page.getByText('Envois à vérifier : 1.').waitFor();await page.getByRole('button',{name:'Conversation #42'}).click();
  assert.equal(await page.getByRole('button',{name:'Confirmer et envoyer'}).isDisabled(),true);
  await page.getByRole('button',{name:'Réparer l’historique sans renvoyer'}).click();await page.getByText('Envois à vérifier : 1.').waitFor({state:'detached'});
  assert.equal(calls.filter(x=>x.url==='/api/support/prepared-repair').length,1);assert.equal(calls.filter(x=>x.url==='/api/support/prepared-send').length,1);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
