import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const root=process.cwd();
const bundle=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Admin from './app/[locale]/admin/page';createRoot(document.getElementById('root')).render(<Admin/>);`}});
const css=(await postcss([tailwind()]).process(await readFile(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')})).css;
const base={created_at:'2026-10-29T12:00:00Z',paid_at:'2026-10-29T12:00:00Z',status:'PAID',total_price:35,currency:'EUR',options:{style:'simpson',printOption:'Digital'},photo_urls:[]};
const orders=[{...base,id:'11111111-1111-4111-8111-111111111111',customer_name:'  Camille Martin  ',customer_email:'camille@example.test'},{...base,id:'22222222-2222-4222-8222-222222222222',customer_name:null,customer_email:'sans-nom@example.test'},{...base,id:'33333333-3333-4333-8333-333333333333',customer_name:'   ',customer_email:'nom-vide@example.test'}];
test('orders table has a dedicated full-name column, safe missing names and aligned empty state',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(5000);let empty=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const u=new URL(route.request().url());if(u.origin!=='https://admin.invalid')return route.abort();
   if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>'});
   if(u.pathname==='/api/admin/auth')return route.fulfill({status:204});
   return route.fulfill({contentType:'application/json',body:JSON.stringify(u.pathname==='/api/orders'&&!empty?orders:[])});
  });
  await page.goto('https://admin.invalid/');await page.addStyleTag({content:css});await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.getByRole('columnheader',{name:'Nom et prénom',exact:true}).waitFor();
  assert.equal(await page.locator('thead th').count(),8);
  const rows=page.locator('tbody tr');await rows.first().waitFor();assert.equal(await rows.count(),3);
  assert.equal(await rows.nth(0).locator('td').nth(2).innerText(),'Camille Martin');
  for(const i of [1,2])assert.equal(await rows.nth(i).locator('td').nth(2).innerText(),'—');
  assert.match(await rows.nth(0).locator('td').nth(3).innerText(),/camille@example.test/);
  if(process.env.ADMIN_NAME_SCREENSHOTS){
   const out=process.env.ADMIN_NAME_SCREENSHOTS;await mkdir(out,{recursive:true});
   await page.screenshot({path:path.join(out,'admin-commandes-nom-desktop.png')});
   await page.setViewportSize({width:390,height:844});
   await page.locator('table').evaluate(el=>el.parentElement.scrollLeft=120);
   await page.screenshot({path:path.join(out,'admin-commandes-nom-mobile.png')});
   await page.setViewportSize({width:1440,height:1000});
  }
  await rows.first().click();await page.getByRole('heading',{name:'Détail commande',exact:true}).waitFor();
  empty=true;await page.reload();await page.addStyleTag({content:css});await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.getByText('Aucune commande pour le moment.',{exact:true}).waitFor();assert.equal(await page.locator('tbody td').getAttribute('colspan'),'8');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
