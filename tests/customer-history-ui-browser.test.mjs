import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const root = process.cwd();
const bundle = await build({ absWorkingDir: root, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', stdin: { resolveDir: root, loader: 'tsx', contents: `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import Panel from './components/admin/CustomerHistoryPanel';
function App(){const [target,setTarget]=useState(null);window.changeTarget=setTarget;return <><button onClick={()=>setTarget({orderId:'order-a'})}>Ouvrir</button>{target&&<Panel target={target} onClose={()=>setTarget(null)}/>}</>};
createRoot(document.getElementById('root')).render(<App/>);` } });
const css = (await postcss([tailwind()]).process(await readFile(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') })).css;
const event = (id, status, at = '2026-11-24T10:00:00Z') => ({ id, at, kind: 'email', title: `Événement ${id}`, status, source: 'journal fictif', orderIds: ['order-a'], subject: '<script>unsafe()</script>', body: '<img src=x onerror=unsafe()>\n  texte préservé\n' + 'long'.repeat(100), details: 'Détail fictif' });
const first = { customer: { name: 'Client fictif A', email: 'a@example.test' }, orders: [{ id: 'order-a', createdAt: '2026-11-23T00:00:00Z', label: 'Portrait fictif' }], events: [event('older', 'recorded', '2026-11-23T10:00:00Z'), event('sent', 'sent'), event('planned', 'scheduled'), event('uncertain', 'uncertain'), event('failed', 'failed')], nextCursor: 'opaque+/=', warnings: ['Certaines anciennes traces ne sont pas disponibles.'] };

async function harness(run) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(5000);
    const state = { calls: [], fail: false, delayed: null, delay: false };
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== 'https://history.invalid') return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>' });
      if (url.pathname.startsWith('/polices/')) return route.fulfill({ status: 204 });
      assert.equal(url.pathname, '/api/admin/customer-history');
      assert.equal(request.method(), 'GET');
      state.calls.push(url);
      if (state.delay) { await new Promise(resolve => { state.delayed = resolve; }); }
      if (state.fail) return route.fulfill({ status: 503, body: '{}' });
      const response = url.searchParams.has('supportMessageId') ? { ...first, customer: { name: 'Client fictif B', email: 'b@example.test' }, events: [], orders: [], nextCursor: null } : url.searchParams.has('cursor') ? { ...first, events: [first.events[0], event('oldest', 'recorded', null)], nextCursor: null } : first;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) }).catch(() => {});
    });
    await page.goto('https://history.invalid/');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.getByRole('button', { name: 'Ouvrir' }).click();
    await run(page, state);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test('mobile history: statuses, escaped contents, Paris dates, pagination, refresh and accessible closing', async () => {
  await harness(async (page, state) => {
    const dialog = page.getByRole('dialog', { name: 'Historique client' });
    await dialog.getByText('a@example.test', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Fermer', exact: true }).evaluate(el => document.activeElement === el), true);
    for (const name of ['Enregistré', 'Envoyé', 'Programmé', 'Incertain', 'Échec']) assert.ok(await dialog.getByText(name, { exact: true }).count());
    await dialog.getByRole('region', { name: 'Historique partiel' }).waitFor();
    assert.match(await dialog.innerText(), /accepté par le fournisseur, pas reçu ni lu/);
    const timeline = dialog.getByRole('region', { name: 'Chronologie' });
    assert.match(await timeline.locator('ol > li').last().innerText(), /Événement older/);
    assert.match(await timeline.innerText(), /11:00/);
    await timeline.locator('summary').first().click();
    assert.equal(await dialog.locator('img,script').count(), 0);
    assert.match(await dialog.locator('pre').first().textContent(), /<img src=x onerror=unsafe\(\)>\n  texte préservé/);
    assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    const box = await dialog.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 390);
    if (process.env.CUSTOMER_HISTORY_SCREENSHOT) {
      await timeline.locator('summary').first().click();
      await dialog.screenshot({ path: process.env.CUSTOMER_HISTORY_SCREENSHOT });
    }
    await dialog.getByRole('button', { name: 'Charger la suite' }).click();
    await dialog.getByText('Date inconnue', { exact: false }).waitFor();
    assert.equal(await timeline.locator('ol > li').count(), 6);
    assert.equal(state.calls.at(-1).searchParams.get('cursor'), 'opaque+/=');
    await dialog.getByRole('button', { name: 'Actualiser' }).click();
    await dialog.getByRole('button', { name: 'Charger la suite' }).waitFor();
    assert.equal(state.calls.at(-1).searchParams.has('cursor'), false);
    // Native modal traps focus; Escape closes and returns focus to the opener.
    await dialog.getByRole('button', { name: 'Fermer', exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('button', { name: 'Ouvrir' }).evaluate(el => document.activeElement === el), true);
  });
});

test('target switch removes previous identity immediately, cancels stale loads, and handles error/retry', async () => {
  await harness(async (page, state) => {
    await page.getByText('a@example.test', { exact: true }).waitFor();
    state.delay = true;
    await page.getByRole('button', { name: 'Actualiser' }).click();
    await page.waitForFunction(() => !document.body.textContent.includes('a@example.test'));
    // Switch while the old request remains outstanding.
    state.delay = false;
    state.fail = true;
    await page.evaluate(() => window.changeTarget({ supportMessageId: 42 }));
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByText('a@example.test', { exact: true }).count(), 0);
    state.delayed?.();
    state.fail = false;
    await page.getByRole('button', { name: 'Réessayer' }).click();
    await page.getByText('b@example.test', { exact: true }).waitFor();
    assert.equal(await page.getByText('a@example.test', { exact: true }).count(), 0);
    await page.getByText('Aucun événement enregistré disponible.').waitFor();
    assert.equal(state.calls.at(-1).searchParams.get('supportMessageId'), '42');
    assert.equal(state.calls.at(-1).searchParams.has('orderId'), false);
    await page.getByRole('button', { name: 'Fermer', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
  });
});

test('switching a loaded client immediately clears its contents while the next request waits', async () => {
  await harness(async (page, state) => {
    await page.getByText('a@example.test', { exact: true }).waitFor();
    state.delay = true;
    await page.evaluate(() => window.changeTarget({ supportMessageId: 99 }));
    await page.getByRole('status').waitFor();
    assert.equal(await page.getByText('a@example.test', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Client fictif A', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Fermer', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    state.delayed?.();
  });
});

test('admin exposes read-only entry points from order details and support messages', async () => {
  const source = await readFile(path.join(root, 'app/[locale]/admin/page.tsx'), 'utf8');
  assert.match(source, /setHistoryTarget\(\{ orderId: selectedOrder.id \}\)/);
  assert.match(source, /setHistoryTarget\(\{ supportMessageId: m.id \}\)/);
  assert.match(source, /<CustomerHistoryPanel target=\{historyTarget\}/);
  const panel = await readFile(path.join(root, 'components/admin/CustomerHistoryPanel.tsx'), 'utf8');
  assert.doesNotMatch(panel, /dangerouslySetInnerHTML|method:\s*["'](?:POST|PATCH|PUT|DELETE)/);
});
