import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const out=process.env.GIFT_GUIDE_ARTIFACTS||'/home/hermes/.hermes/profiles/cartoonova/cache/gift-guide-premium-components';
const stubs={
 'next/link':`export default function Link(p){return <a {...p}/>}`,
 'next/image':`export default function Image({fill,preload,...p}){return <img {...p}/>}`,
 'next-intl':`export const useLocale=()=>window.locale;export const useTranslations=()=>()=>'';`,
 '@/components/CurrencyProvider':`export const useCurrency=()=>({currency:'USD',pret:true,formatRaw:n=>'$'+n.toFixed(2)});`,
 '@/lib/analytics':`export const mesure=(...args)=>window.events.push(args);`,
};
const bundle=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Guide from './app/[locale]/cadeau/GiftGuide';import {GiftPricingProvider} from './app/[locale]/cadeau/GiftPricing';createRoot(document.getElementById('root')).render(<main className="page-tj"><GiftPricingProvider initialPrices={null}><Guide/></GiftPricingProvider></main>);`},plugins:[{name:'boundaries',setup(b){b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));b.onResolve({filter:/./},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'stub'}:undefined);b.onLoad({filter:/./,namespace:'stub'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));}}]});
const css=(await postcss([tailwind({base:root})]).process(await readFile(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')})).css;
const guideCss=await readFile(path.join(root,'app/[locale]/cadeau/GiftGuide.css'),'utf8').catch(()=> '');
const axe=await readFile(path.join(root,'node_modules/axe-core/axe.min.js'),'utf8');
const grid={base:10,fullbodyExtra:5,extraPerson:5,extraAnimal:5,digital:0,canvas:39,poster:59,posterSimple:19,banner:3,extraDecor:5,express:7,carteVoeux:4,calendrier:9,shipping:4.9};
for(const locale of ['fr','en','de','es','it','nl','pl','sv','da','pt'])for(const mobile of [false,true])test(`${locale} ${mobile?'mobile':'desktop'}: illustrated radio choices, unavailable silence, price retry, keyboard and exact tracking`,async()=>{
 const browser=await chromium.launch({headless:true});try{
  await mkdir(out,{recursive:true});const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});page.setDefaultTimeout(3000);let pending;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.pathname==='/api/prices'){pending=r;return;}if(u.pathname==='/')return r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="${locale}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guide test</title><div id="root"></div></html>`});if(u.origin!=='https://guide.invalid')throw Error('External request forbidden');return r.fulfill({body:await readFile(path.join(root,'public',decodeURIComponent(u.pathname)))});});
  await page.goto('https://guide.invalid/');await page.evaluate(locale=>{window.locale=locale;window.events=[];document.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();});},locale);
  await page.addStyleTag({content:css+'\n'+guideCss});await page.addScriptTag({content:bundle.outputFiles[0].text});
  const guide=page.locator('section');const disabled=guide.locator('[aria-disabled="true"]');
  const clicks=()=>page.evaluate(()=>window.events.filter(([n])=>n==='gift_guide_recommendation_clicked'));
  await disabled.waitFor();await disabled.scrollIntoViewIfNeeded();{const box=await disabled.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);}assert.deepEqual(await clicks(),[],'loading must not count as a recommendation click');
  await pending.fulfill({status:503,body:''});await page.getByRole('alert').waitFor();
  await disabled.scrollIntoViewIfNeeded();{const box=await disabled.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);}assert.deepEqual(await clicks(),[],'failed prices must not count as a recommendation click');
  const retry=page.waitForRequest('**/api/prices?currency=USD');await page.getByRole('alert').getByRole('button').click();await retry;await pending.fulfill({json:grid});
  const link=guide.locator('a[href$="#configurateur"]');await link.waitFor();
  const mappings=[['classic','Simpsons','simpson','/framed.jpg'],['manga','Dragon Ball Z (DBZ)','dbz','/DBZ/Photo_produits/il_1140xN.7733273072_b9q7.png'],['hero','Disney','disney','/Disney/Photo_produits/il_1140xN.6576111634_dwx3.png']];
  for(const [value,name,slug,image] of mappings){
   const radio=guide.locator(`input[name="gift-style"][value="${value}"]`);
   assert.equal(await radio.locator('..').locator('strong').innerText(),name,'the named universe, not a broad category');
   assert.equal(await radio.locator('..').locator('img').getAttribute('src'),image);
   await radio.check();assert.equal(await guide.locator('#gift-guide-result-title').innerText(),name);
   assert.equal(await guide.locator('.gift-guide__artwork img').getAttribute('src'),image);
   assert.ok((await guide.locator('.gift-guide__artwork img').getAttribute('alt')).endsWith(name));
   assert.equal(await link.getAttribute('href'),`/${locale}/${slug}#configurateur`);
  }
  await guide.locator('input[name="gift-style"][value="classic"]').check();
  await page.evaluate(()=>{window.events=window.events.filter(([n])=>n!=='gift_guide_choice');});
  const solo=guide.locator('input[name="gift-people"][value="solo"]');await page.keyboard.press('Tab');await solo.focus();assert.equal(await solo.evaluate(e=>getComputedStyle(e.closest('label')).outlineWidth),'3px','visible keyboard focus ring');await page.keyboard.press('ArrowRight');assert.equal(await guide.locator('input[name="gift-people"][value="couple"]').isChecked(),true);
  await page.keyboard.press('Tab');assert.equal(await guide.locator('input[name="gift-deadline"][value="flexible"]').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');assert.equal(await guide.locator('input[name="gift-style"][value="classic"]').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('ArrowRight');
  assert.equal(await guide.locator('input[name="gift-style"][value="manga"]').isChecked(),true);
  assert.match(await guide.locator('[aria-live]').innerText(),/\$15\.00/);assert.equal(await link.getAttribute('href'),`/${locale}/dbz#configurateur`);
  assert.ok(await guide.locator(`a[href="/${locale}/bon-cadeau"]`).count());
  await link.focus();await page.keyboard.press('Enter');assert.deepEqual(await clicks(),[['gift_guide_recommendation_clicked',{people:'couple',style:'manga',slug:'dbz'}]]);
  await link.click();assert.equal((await clicks()).length,2);
  assert.deepEqual(await page.evaluate(()=>window.events.filter(([n])=>n==='gift_guide_choice').map(([,p])=>p)),[{question:'people',choice:'couple'},{question:'deadline',choice:'soon'},{question:'style',choice:'manga'}]);
  await guide.locator('input[name="gift-people"][value="family"]').check();assert.match(await guide.locator('[aria-live]').innerText(),/\$25\.00/);
  await guide.locator('input[name="gift-style"][value="hero"]').check();assert.equal(await link.getAttribute('href'),`/${locale}/disney#configurateur`);
  await guide.locator('input[name="gift-style"][value="classic"]').check();assert.equal(await link.getAttribute('href'),`/${locale}/simpson#configurateur`);
  await page.evaluate(()=>document.fonts.ready);await guide.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));assert.equal(await guide.locator('img').count(),4,'three illustrated choices and real result image');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
  if(mobile){await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no overflow at 320px');}
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await guide.locator('label').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  const sizes=await guide.locator('label').evaluateAll(labels=>labels.map(l=>({width:l.getBoundingClientRect().width,height:l.getBoundingClientRect().height})));assert.ok(sizes.every(s=>s.width>=44&&s.height>=44),'touch targets');
  await page.addScriptTag({content:axe});const audit=await page.evaluate(()=>window.axe.run(document.querySelector('section'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],'axe accessible guide');
  await writeFile(path.join(out,`${locale}-${mobile?'mobile':'desktop'}.json`),JSON.stringify({locale,mobile,errors,events:await page.evaluate(()=>window.events),axeViolations:audit.violations,axeIncomplete:audit.incomplete.map(v=>v.id),touchTargets:sizes,images:await guide.locator('img').evaluateAll(imgs=>imgs.map(i=>({src:i.getAttribute('src'),loaded:i.naturalWidth>0})))},null,2));assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
