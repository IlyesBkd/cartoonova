import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const locales = ['fr','en','de','es','it','nl','pl','pt','sv','da'];
const messages = Object.fromEntries(locales.map(locale => [locale, JSON.parse(readFileSync(path.join(root,`messages/${locale}.json`),'utf8'))]));
const css = ['node_modules/tailwindcss/preflight.css','app/toonjaune.css','app/toonjaune-app.css','app/styles/pages.css'].map(file=>readFileSync(path.join(root,file),'utf8')).join('\n');
const stubs = {
  '@stripe/stripe-js': 'export const loadStripe=()=>null',
  '@stripe/react-stripe-js': 'export const Elements=({children})=>children;export const PaymentElement=()=>null;export const useElements=()=>null;export const useStripe=()=>null',
  '@/lib/analytics': 'export const mesure=()=>{};export const contexte=()=>{};export const accepterMesure=()=>{};export const refuserMesure=()=>{}',
  '@/components/JsonLd': 'export default ()=>null',
  '@/lib/seo': 'export const metadataPageLegale=()=>({});export const urlAbsolue=()=>"https://gift.invalid/cgv"',
  '@/lib/donneesStructurees': 'export const pageWeb=()=>({});export const filAriane=()=>({})',
  'next/link': 'export default props=><a {...props}/>',
  'next-intl/server': `import {createTranslator} from 'next-intl';export const setRequestLocale=()=>{};export const getTranslations=async({namespace}={})=>createTranslator({locale:window.locale,messages:window.messages,namespace})`,
};
const bundle = await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY':'"pk_test_unused"'},
  stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {renderToString} from 'react-dom/server';import {createRoot} from 'react-dom/client';import {NextIntlClientProvider} from 'next-intl';import CurrencyProvider,{useCurrency} from './components/CurrencyProvider';import Gift from './app/[locale]/bon-cadeau/BonCadeauClient';import CGV from './app/[locale]/cgv/page';import {montantsBon} from './lib/bonCadeauMontants';
function Controls(){const c=useCurrency();window.changeCurrency=c.setCurrency;return <output id="ready">{c.pret?c.currency:'waiting'}</output>}
(async()=>{window.amounts=montantsBon(window.currency);window.beforeHydration=renderToString(<NextIntlClientProvider locale={window.locale} messages={window.messages}><CurrencyProvider locale={window.locale}><Gift/></CurrencyProvider></NextIntlClientProvider>);const legal=await CGV({params:Promise.resolve({locale:window.locale})});createRoot(document.getElementById('root')).render(<NextIntlClientProvider locale={window.locale} messages={window.messages}><CurrencyProvider locale={window.locale}><Controls/><Gift/><div id="legal">{legal}</div></CurrencyProvider></NextIntlClientProvider>)})();`},
  plugins:[{name:'neutralized-io',setup(b){b.onResolve({filter:/./},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'stubs'}:undefined);b.onLoad({filter:/./,namespace:'stubs'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));}}],
});

test('CRO-07: real gift page and CGV render explicit minimum, partial use and expiry in ten languages × EUR/GBP/USD',async t=>{
 const browser=await chromium.launch({headless:true});
 try{
 for(const locale of locales) for(const currency of ['EUR','GBP','USD']) await t.test(`${locale}/${currency}`,async()=>{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(2000);const errors=[];const unexpected=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin==='https://gift.invalid'&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
   if(url.origin==='https://gift.invalid'&&/^\/polices\/[a-z0-9-]+\.woff2?$/.test(url.pathname))return route.fulfill({body:readFileSync(path.join(root,'public',url.pathname))});
   unexpected.push(route.request().url());return route.abort();
  });
  try{
   await page.goto('https://gift.invalid/');
   await page.evaluate(({locale,currency,messages})=>{window.locale=locale;window.currency=currency;window.messages=messages;document.cookie=`cartoonova_currency=${currency};path=/`;window.fetch=()=>{throw Error('transaction/network forbidden')};},{locale,currency,messages:messages[locale]});
   await page.addScriptTag({content:bundle.outputFiles[0].text});
   await page.addStyleTag({content:css});
   await page.evaluate(()=>document.fonts.ready);
   await page.waitForFunction(c=>document.querySelector('#ready')?.textContent===c,currency);
   assert.doesNotMatch(await page.evaluate(()=>window.beforeHydration),/\b(?:EUR|GBP|USD)\b/,'no provisional currency before visitor cookie resolves');
   const minimum=page.locator('.bon-achat__minimum');
   assert.equal(await minimum.count(),1,'minimum must be visible before continuing to payment');
   assert.ok((await minimum.innerText()).includes(`1 ${currency}`),'one native unit, not converted EUR');
   const gift=await page.evaluate(()=>window.amounts[1]);
   const example=page.locator('.bon-achat__exemple');
   const text=await example.innerText();
   for(const value of [`${gift} ${currency}`,`${gift-1} ${currency}`,`1 ${currency}`])assert.ok(text.includes(value),`${value} missing from partial-use example`);
   assert.match(text,/12/,'original expiry remains explicit');
   for(const button of await page.locator('.bon-achat__montants button').all())assert.ok((await button.innerText()).includes(currency));
   assert.ok((await page.locator('.bon-achat__carte > button').innerText()).includes(currency));
   const legal=await page.locator('#legal section').filter({has:page.locator('h2', {hasText:'9 bis'})}).innerText();
   for(const code of ['EUR','GBP','USD'])assert.ok(legal.includes(`1 ${code}`),'CGV must explain explicit native minimum');
   assert.match(legal,/12/);
   // Scope layout checks to the gift page and amended CGV article, not unrelated legal headings.
   const overflow=await page.evaluate(()=>{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const found=[];while(w.nextNode()){const parent=w.currentNode.parentElement;const article=parent.closest('#legal section');if(!parent.closest('.bon-achat')&&!article?.querySelector('h2')?.textContent.includes('9 bis'))continue;const r=document.createRange();r.selectNodeContents(w.currentNode);if(r.getBoundingClientRect().right>innerWidth+1)found.push({text:w.currentNode.textContent.slice(0,120),right:r.getBoundingClientRect().right})}return found});
   assert.deepEqual(overflow,[],'gift copy and CGV gift article must fit on mobile');
   const other=currency==='USD'?'GBP':'USD';
   await page.evaluate(c=>window.changeCurrency(c),other);
   await page.waitForFunction(c=>document.querySelector('#ready').textContent===c,other);
   assert.ok((await minimum.innerText()).includes(`1 ${other}`),'minimum stays one native unit after a currency change');
   assert.ok((await example.innerText()).includes(other));
   assert.ok(!(await example.innerText()).includes(currency),'no previous currency left in example');
   await page.evaluate(c=>window.changeCurrency(c),currency);
   await page.waitForFunction(c=>document.querySelector('#ready').textContent===c,currency);
   await page.locator('.bon-achat__montants button').first().click();
   const first=await page.evaluate(()=>window.amounts[0]);
   assert.ok((await example.innerText()).includes(`${first} ${currency}`),'example follows chosen amount');
   if(locale==='fr'&&currency==='EUR'){
    await page.locator('.bon-achat').screenshot({path:path.join(process.env.TMPDIR,'cro07-fr-EUR-mobile.png')});
    await page.setViewportSize({width:1280,height:900});
    await page.locator('.bon-achat').screenshot({path:path.join(process.env.TMPDIR,'cro07-fr-EUR-desktop.png')});
    await page.setViewportSize({width:390,height:844});
   }
   await page.evaluate(()=>{window.fetch=async(url,options)=>{
    if(url!=='/api/bon-cadeau/checkout')throw Error('unexpected network');
    window.checkoutBody=JSON.parse(options.body);
    return {ok:true,json:async()=>({clientSecret:'fixture-ui-only'})};
   }});
   await page.locator('#bon-email').fill('buyer@example.invalid');
   await page.locator('.bon-achat__carte > button').click();
   await page.locator('.bon-achat__recap').waitFor();
   assert.equal(await minimum.count(),1,'recipient minimum remains visible on payment step');
   assert.ok((await minimum.innerText()).includes(`1 ${currency}`));
   assert.ok((await example.innerText()).includes(`${first} ${currency}`));
   assert.ok((await page.locator('.bon-achat__recap').innerText()).includes(currency));
   assert.ok((await page.locator('.bon-achat__paiement button').innerText()).includes(currency));
   const payload=await page.evaluate(()=>window.checkoutBody);assert.equal(payload.montant,first);assert.equal(payload.currency,currency);
   assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  }finally{await page.close();}
 });
 }finally{await browser.close();}
});
