import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { load } from './upload-harness.mjs';

const root = path.resolve(import.meta.dirname, '..');
const id = '11111111-1111-4111-8111-111111111111';
const fileId = '22222222-2222-4222-8222-222222222222';
const privatePhoto = `vps://private/orders/${id}/${fileId}.png`;
const privateRetouch = `vps://private/retouches/${id}/${fileId}.png`;
const legacy = 'https://fixture.public.blob.vercel-storage.com/orders/legacy.png';

test('real mobile React depot and preview render private/legacy photos and submit unchanged canonical references', async () => {
  const stubs = {
    '@/lib/analytics': 'export const mesure=()=>{}',
    '@/lib/uploadClient': "export const uploadImage=()=>{throw Error('Real uploads forbidden in fixture')}"
  };
  const bundle = await build({ absWorkingDir: root, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import Depot from './app/(hors-langue)/depot/[token]/DepotClient';
      import Confirm from './app/(hors-langue)/confirm-poster/[token]/ConfirmClient';
      createRoot(document.getElementById('root')).render(<><section id="depot"><Depot token="fixture-tracking" lang="fr" initialPhotos={${JSON.stringify([privatePhoto, legacy])}}/></section><section id="preview"><Confirm token="fixture-preview" lang="fr" initialStatus={null} respondedAt={null} initialNote="Fixture retouche" initialPhotos={${JSON.stringify([privateRetouch, legacy])}}/></section></>);` },
    plugins: [{ name: 'isolated-storage-fixtures', setup(b) {
      b.onResolve({ filter: /./ }, args => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: 'stubs' } : undefined);
      b.onLoad({ filter: /./, namespace: 'stubs' }, args => ({ contents: stubs[args.path], loader: 'jsx', resolveDir: root }));
    } }],
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const writes = [];
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (req.method() === 'POST') {
        assert.ok(['/api/orders/photos', '/api/orders/confirm-poster'].includes(url.pathname));
        writes.push({ path: url.pathname, body: req.postDataJSON() });
        return route.fulfill({ json: url.pathname.endsWith('/photos') ? { ok: true, photoUrls: [legacy] } : { ok: true, changed: true, status: 'changes_requested' } });
      }
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' });
      // No external network, storage, or real capability resolution in UI tests.
      return route.fulfill({ status: 404, body: '' });
    });
    await page.goto('https://fixture.invalid/');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.locator('#depot img').first().waitFor({ state: 'attached' });
    const depotSources = await page.locator('#depot img').evaluateAll(images => images.map(image => image.getAttribute('src')));
    assert.equal(depotSources[1], legacy);
    const read = new URL(depotSources[0], 'https://fixture.invalid');
    assert.equal(read.pathname, '/api/storage/read'); assert.equal(read.searchParams.get('ref'), privatePhoto);
    assert.equal(read.searchParams.get('token'), 'fixture-tracking'); assert.equal(read.searchParams.has('posterToken'), false);
    const copy = load('lib/i18n/clientActions.ts').clientActionCopy.fr;
    await page.locator('#depot').getByRole('button', { name: copy.remove }).first().click();
    await page.waitForFunction(() => document.querySelectorAll('#depot img').length === 1);
    assert.deepEqual(writes[0].body, { token: 'fixture-tracking', photoUrls: [privatePhoto], operation: 'remove', expectedPhotos: [privatePhoto, legacy] });

    await page.locator('#preview button').nth(1).click();
    const previewSources = await page.locator('#preview img').evaluateAll(images => images.map(image => image.getAttribute('src')));
    assert.equal(previewSources[1], legacy);
    const previewRead = new URL(previewSources[0], 'https://fixture.invalid');
    assert.equal(previewRead.searchParams.get('ref'), privateRetouch);
    assert.equal(previewRead.searchParams.get('posterToken'), 'fixture-preview'); assert.equal(previewRead.searchParams.has('token'), false);
    const t = load('lib/email-i18n.ts').posterConfirmationPage.fr;
    await page.locator('#preview').getByRole('button', { name: t.changesSubmit, exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#preview textarea') === null);
    assert.deepEqual(writes[1].body.photos, [privateRetouch, legacy]);
    assert.equal(writes[1].body.token, 'fixture-preview');
    assert.equal(writes[1].body.action, 'changes');
    assert.equal(await page.locator('[src^="vps:"], [href^="vps:"]').count(), 0);
  } finally { await browser.close(); }
});
