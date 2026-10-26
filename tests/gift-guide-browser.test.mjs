import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const stubs={
 'next/link':`export default function Link(p){return <a {...p}/>}`,
 'next-intl':`export const useLocale=()=>window.locale;export const useTranslations=()=>()=>'';`,
 '@/components/CurrencyProvider':`export const useCurrency=()=>({currency:'USD',pret:true,formatRaw:n=>'$'+n.toFixed(2)});`,
 '@/lib/analytics':`export const mesure=(...args)=>window.events.push(args);`,
};
const bundle=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Guide from './app/[locale]/cadeau/GiftGuide';import {GiftPricingProvider} from './app/[locale]/cadeau/GiftPricing';createRoot(document.getElementById('root')).render(<GiftPricingProvider initialPrices={null}><Guide/></GiftPricingProvider>);`},plugins:[{name:'boundaries',setup(b){b.onResolve({filter:/./},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'stub'}:undefined);b.onLoad({filter:/./,namespace:'stub'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));}}]});
const grid={base:10,fullbodyExtra:5,extraPerson:5,extraAnimal:5,digital:0,canvas:39,poster:59,posterSimple:19,banner:3,extraDecor:5,express:7,carteVoeux:4,calendrier:9,shipping:4.9};
for(const locale of ['fr','en'])test(`${locale}: guide unavailable click is silent; failed prices retry, keyboard and available activation measured`,async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage();let pending;
  await page.route('**/*',r=>new URL(r.request().url()).pathname==='/api/prices'?(pending=r):r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
  await page.goto('https://guide.invalid/');await page.evaluate(locale=>{window.locale=locale;window.events=[];document.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();});},locale);
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const guide=page.locator('section');const disabled=guide.locator('[aria-disabled="true"]');
  const clicks=()=>page.evaluate(()=>window.events.filter(([n])=>n==='gift_guide_recommendation_clicked'));
  await disabled.waitFor();{const box=await disabled.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);}assert.deepEqual(await clicks(),[],'loading must not count as a recommendation click');
  await pending.fulfill({status:503,body:''});await page.getByRole('alert').waitFor();
  await disabled.waitFor();{const box=await disabled.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);}assert.deepEqual(await clicks(),[],'failed prices must not count as a recommendation click');
  const retry=page.waitForRequest('**/api/prices?currency=USD');await page.getByRole('button').click();await retry;await pending.fulfill({json:grid});
  const link=guide.locator('a[href$="#configurateur"]');await link.waitFor();
  const selects=guide.locator('select');await selects.nth(0).focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');
  assert.equal(await selects.nth(0).inputValue(),'soon');assert.equal(await selects.nth(1).evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');
  assert.equal(await selects.nth(1).inputValue(),'couple');assert.equal(await selects.nth(2).inputValue(),'manga');
  assert.match(await guide.locator('[aria-live]').innerText(),/\$15\.00/);assert.equal(await link.getAttribute('href'),`/${locale}/dbz#configurateur`);
  assert.ok(await guide.locator(`a[href="/${locale}/bon-cadeau"]`).count());
  await link.focus();await page.keyboard.press('Enter');assert.deepEqual(await clicks(),[['gift_guide_recommendation_clicked',{people:'couple',style:'manga',slug:'dbz'}]]);
  await link.click();assert.equal((await clicks()).length,2);
 }finally{await browser.close();}
});
