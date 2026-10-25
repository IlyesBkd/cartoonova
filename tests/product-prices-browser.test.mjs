import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const stubs = {
  'next/image': `export default function Image({priority, ...props}) { return <img {...props}/> }`,
  'next/link': `export default function Link(props) { return <a {...props}/> }`,
  'next/dynamic': `export default () => () => null`,
  'next-intl': `export const useLocale = () => 'fr'; export const useTranslations = () => (key) => key`,
  '@/components/CurrencyProvider': `import {useSyncExternalStore} from 'react'; let currency='EUR',ready=window.initialReady??true; const listeners=new Set(); window.setReady=()=>{ready=true;listeners.forEach(f=>f())}; window.changeCurrency=c=>{currency=c;listeners.forEach(f=>f())}; export function useCurrency(){const snapshot=useSyncExternalStore(f=>{listeners.add(f);return()=>listeners.delete(f)},()=>currency+':'+ready);const c=snapshot.split(':')[0];return {currency:c,pret:ready,formatRaw:n=>c+':'+n}}`,
  '@/hooks/useProductTracking': `export const useProductTracking=()=>new Proxy({}, {get:()=>()=>{}})`,
  '@/components/CheckoutModal': `export default ()=>null`,
  '@/lib/uploadClient': `export const uploadImage=()=>{throw Error('not part of this test')}`,
  '@/components/GiftDeadlineNote': `export default ()=>null`,
  '@/components/DateApercu': `export default ()=>null`,
  '@/components/useLien': `export const useLien=()=>x=>x`,
  '@/lib/useRetourFerme': `export const useRetourFerme=()=>{}`,
};
const bundle = await build({
  absWorkingDir: root, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Fiche from './app/[locale]/[produit]/FicheProduit';
  createRoot(document.getElementById('root')).render(<Fiche prixInitial={window.initialPrices} donnees={{slug:'fixture',idProduit:'fixture',univers:'Fixture',titre:'Fixture',description:'Fixture',categorieNom:'Fixture',categorieCle:'fixture',personnages:true,galerie:[],legendes:[],decors:[],supports:{digital:'/d.png',posterSimple:'/p.png',canvas:'/c.png',framed:'/f.png'},similaires:[]}}/>);` },
  plugins: [{ name: 'isolated-boundaries', setup(b) {
    b.onResolve({ filter: /./ }, args => Object.hasOwn(stubs, args.path) ? {path: args.path, namespace: 'stubs'} : undefined);
    b.onLoad({ filter: /./, namespace: 'stubs' }, args => ({ contents: stubs[args.path], loader: 'jsx', resolveDir: root }));
    b.onLoad({filter: /\.css$/}, () => ({contents:'',loader:'js'}));
  }}],
});
const grid = base => ({base,fullbodyExtra:5,extraPerson:5,extraAnimal:5,digital:0,canvas:39,poster:59,posterSimple:19,banner:3,extraDecor:5,express:7,carteVoeux:4,calendrier:9,shipping:4.9});

test('approved initial EUR grid enables Commander without waiting for a prices API round trip', async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    let priceRequests = 0;
    await page.route('https://prices.invalid/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
      if (url.pathname === '/api/prices') { priceRequests++; return; }
      return route.fulfill({status:404,body:''});
    });
    await page.goto('https://prices.invalid/');
    await page.evaluate(prices => { window.initialPrices = prices; window.initialReady = false; }, grid(4.99));
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.waitForFunction(() => document.querySelector('button.ajouter'));
    assert.equal(await page.locator('button.ajouter').isDisabled(), true);
    assert.equal(await page.locator('.panneau__prix strong').innerText(), '—');
    assert.equal(priceRequests, 0, 'no fetch before visitor currency is known');
    await page.evaluate(() => window.setReady());
    assert.equal(await page.locator('button.ajouter').isDisabled(), false, 'server grid must remove the client network waterfall');
    assert.equal(await page.locator('.panneau__prix strong').innerText(), 'EUR:4.99');
    assert.equal(priceRequests, 0);
  } finally { await browser.close(); }
});

test('real product React UI: currency race hides old grid and ignores late responses', async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    const pending = new Map();
    await page.route('https://prices.invalid/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
      if (url.pathname === '/api/prices') { pending.set(url.searchParams.get('currency'), route); return; }
      return route.fulfill({status:404,body:''});
    });
    await page.goto('https://prices.invalid/');
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const buy = page.locator('button.ajouter');
    await page.waitForFunction(() => document.querySelector('button.ajouter'));
    await page.waitForTimeout(30);
    await pending.get('EUR').fulfill({json:grid(4.99)});
    await page.waitForFunction(() => !document.querySelector('button.ajouter').disabled);
    await page.evaluate(() => window.changeCurrency('USD'));
    await page.waitForTimeout(30);
    assert.equal(await buy.isDisabled(), true, 'old EUR grid must not enable USD purchase');
    assert.equal(await page.locator('.panneau__prix strong').innerText(), '—');
    await page.evaluate(() => window.changeCurrency('CHF'));
    await page.waitForTimeout(30);
    await pending.get('CHF').fulfill({json:grid(7)});
    await page.waitForFunction(() => document.querySelector('.panneau__prix strong').textContent === 'CHF:7');
    await pending.get('USD').fulfill({json:grid(6)}).catch(() => {});
    await page.waitForTimeout(30);
    assert.equal(await page.locator('.panneau__prix strong').innerText(), 'CHF:7');
    assert.equal(await buy.isDisabled(), false);

    // A stalled currency must fail visibly, then recover without losing options.
    await page.locator('button.vignette').filter({hasText:'fullbody'}).click();
    await page.clock.install();
    const gbpRequested = page.waitForRequest('**/api/prices?currency=GBP');
    await page.evaluate(() => window.changeCurrency('GBP'));
    await gbpRequested;
    await page.clock.fastForward(8000);
    await page.getByRole('alert').waitFor();
    assert.equal(await buy.isDisabled(), true);
    assert.equal(await page.locator('.barre-achat__bouton').isDisabled(), true);
    assert.match(await page.getByRole('alert').innerText(), /prix.*indisponibles/);
    const retryRequested = page.waitForRequest('**/api/prices?currency=GBP');
    await page.getByRole('button', {name:'Réessayer'}).click();
    await retryRequested;
    await pending.get('GBP').fulfill({json:grid(5)});
    await page.waitForFunction(() => !document.querySelector('button.ajouter').disabled);
    assert.equal(await page.locator('.panneau__prix strong').innerText(), 'GBP:10');
    assert.equal(await page.getByRole('alert').count(), 0);
    console.log(JSON.stringify({ UI: 'real React / isolated browser', timeoutMs: 8000, currencyRace: 'passed', retryPreservesOptions: true }));
  } finally { await browser.close(); }
});
