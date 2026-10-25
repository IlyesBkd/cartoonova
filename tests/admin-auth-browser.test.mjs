import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const bundle=await build({absWorkingDir:process.cwd(),bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Admin from './app/[locale]/admin/page';createRoot(document.getElementById('root')).render(<Admin/>);`}});
test('admin UI sends password only at login, clears it, restores session, revokes logout and returns to login on expiration',async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(3000);
 let active=false;const calls=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const r=route.request(),url=new URL(r.url());
  if(url.origin!=='https://admin.invalid')return route.abort();
  if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
  calls.push({url:url.pathname,method:r.method(),headers:r.headers(),body:r.postData()});
  if(url.pathname==='/api/admin/auth'){
   if(r.method()==='POST'){active=true;return route.fulfill({status:204,headers:{'set-cookie':'cartoonova-admin=synthetic-session; Path=/; Secure; HttpOnly; SameSite=Strict'}});}
   if(r.method()==='DELETE'){active=false;return route.fulfill({status:204});}
   return route.fulfill({status:active?204:401,body:active?'':'{"error":"expired"}'});
  }
  return route.fulfill({status:active?200:401,contentType:'application/json',body:active?'[]':'{"error":"expired"}'});
 });
 try{
  await page.goto('https://admin.invalid/');await page.addScriptTag({content:bundle.outputFiles[0].text});
  const ordersRequested=page.waitForRequest('**/api/orders');
  await page.locator('input[type=password]').fill('synthetic-login-password');await page.getByRole('button',{name:'Connexion',exact:true}).click();
  await page.getByRole('button',{name:/Déconnexion/}).waitFor();
  const orders=await ordersRequested;assert.equal(orders.method(),'GET');assert.equal(orders.postData(),null);
  const login=calls.find(c=>c.url==='/api/admin/auth'&&c.method==='POST');
  assert.equal(JSON.parse(login.body||'{}').password,'synthetic-login-password');
  assert.ok(calls.every(c=>!('x-admin-password' in c.headers)));
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  assert.equal(await page.evaluate(()=>document.cookie.includes('cartoonova-admin')),false);
  await page.reload();await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.getByRole('button',{name:/Déconnexion/}).waitFor();
  await page.getByRole('button',{name:/Déconnexion/}).click();await page.locator('input[type=password]').waitFor();
  assert.equal(active,false);assert.ok(calls.some(c=>c.method==='DELETE'));assert.equal(await page.locator('input[type=password]').inputValue(),'');
  await page.locator('input[type=password]').fill('synthetic-login-password');await page.getByRole('button',{name:'Connexion',exact:true}).click();await page.getByRole('button',{name:/Déconnexion/}).waitFor();
  active=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('input[type=password]').waitFor();
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
