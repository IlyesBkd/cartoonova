import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';

import { AsyncLocalStorage } from 'node:async_hooks';
globalThis.AsyncLocalStorage = AsyncLocalStorage;
const require = createRequire(import.meta.url);
require('tsx/cjs');
const root = path.resolve(import.meta.dirname, '..');
const { DEFAULT_PRICE_SET } = require(path.join(root, 'lib/types.ts'));
function loadTs(relative, replacements = {}) {
  const filename = path.join(root, relative);
  const loaded = new Module(filename);
  loaded.filename = filename;
  const originalRequire = createRequire(filename);
  loaded.require = name => Object.hasOwn(replacements, name) ? replacements[name] : originalRequire(name.startsWith('@/') ? path.join(root, name.slice(2)) : name);
  loaded._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return loaded.exports;
}

// Exercise the real Next cache algorithm; replace only persistence and the DB
// boundary. Logical latency is deterministic, not a production benchmark.
test('warm price route reuses the shared Next data cache, isolated by currency', async () => {
  require('next/cache');
  const entries = new Map();
  let latency = 0, calls = 0, unavailable = false;
  globalThis.__incrementalCache = {
    generateSimpleCacheKey: async key => key,
    get: async key => entries.get(key),
    set: async (key, value) => { entries.set(key, { value, isStale: false }); },
  };
  const read = async currency => {
    calls++; latency += 15000;
    if (unavailable) throw new Error('isolated DB failure');
    return { ...DEFAULT_PRICE_SET, base: currency === 'USD' ? 6 : 4.99 };
  };
  const lectures = loadTs('lib/lecturesCache.ts', {
    './db': { getPricesForCurrency: read }, './contenuFiche': {}, './reviewsDb': {}, './blogDb': {}, './indexation': {},
  });
  const { GET } = loadTs('app/api/prices/route.ts', {
    '@/lib/db': { getPricesForCurrency: read }, '@/lib/lecturesCache': lectures,
  });
  const request = currency => ({ nextUrl: new URL(`https://example.invalid/api/prices?currency=${currency}`) });
  try {
    assert.equal((await (await GET(request('EUR'))).json()).base, 4.99);
    assert.equal(latency, 15000);
    const cold = latency;
    // A fresh wrapper represents another instance; persistence remains shared.
    const lecturesOtherInstance = loadTs('lib/lecturesCache.ts', {
      './db': { getPricesForCurrency: read }, './contenuFiche': {}, './reviewsDb': {}, './blogDb': {}, './indexation': {},
    });
    assert.equal((await lecturesOtherInstance.prixEnCache('EUR')).base, 4.99);
    assert.equal((await (await GET(request('EUR'))).json()).base, 4.99);
    assert.equal(latency - cold, 0, 'warm CTA price fetch must not repeat the 15-second DB read');
    assert.equal((await (await GET(request('USD'))).json()).base, 6);
    assert.equal(calls, 2);
    console.log(JSON.stringify({ boundary: 'DB injected logical latency', coldMs: cold, warmMs: latency - cold - 15000, calls }));
    // A failure is not a grid and must not poison recovery for another instance.
    unavailable = true;
    assert.equal((await GET(request('CHF'))).status, 500);
    assert.equal((await GET(request('EUR'))).status, 200, 'warm data survives DB outage');
    unavailable = false;
    assert.equal((await GET(request('CHF'))).status, 200);
    assert.equal(calls, 4, 'failed read was not cached');
  } finally { delete globalThis.__incrementalCache; }
});

test('price loader rejects HTTP errors instead of enabling Commander with an error object', async () => {
  assert.ok(existsSync(path.join(root, 'lib/productPrices.ts')), 'bounded, validated product price loader is missing');
  const { loadProductPrices } = loadTs('lib/productPrices.ts');
  let calls = 0;
  await assert.rejects(loadProductPrices('EUR', {
    fetcher: async () => { calls++; return Response.json({ error: 'unavailable' }, { status: 503 }); },
  }));
  assert.equal(calls, 1, 'no unbounded retries');
});

test('invalid/missing/non-finite price fields never become an orderable grid', async () => {
  const { loadProductPrices } = loadTs('lib/productPrices.ts');
  for (const body of [{ error: 'bad' }, { ...DEFAULT_PRICE_SET, base: -1 }, { ...DEFAULT_PRICE_SET, shipping: '4.90' }, null]) {
    await assert.rejects(loadProductPrices('CHF', { fetcher: async () => Response.json(body) }));
  }
  assert.deepEqual(await loadProductPrices('CHF', { fetcher: async url => {
    assert.equal(url, '/api/prices?currency=CHF');
    return Response.json(DEFAULT_PRICE_SET);
  } }), DEFAULT_PRICE_SET);
});

test('hung request has an 8-second bound, aborts transport and permits explicit recovery', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { loadProductPrices } = loadTs('lib/productPrices.ts');
  let result = 'pending', transport;
  const pending = loadProductPrices('USD', { fetcher: async (_url, options) => {
    transport = options.signal;
    return new Promise(() => {});
  } }).then(() => { result = 'ok'; }, () => { result = 'failed'; });
  t.mock.timers.tick(7999);
  await Promise.resolve();
  assert.equal(result, 'pending');
  t.mock.timers.tick(1);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(result, 'failed', 'must stop waiting at 8000ms');
  assert.equal(transport.aborted, true);
  await pending;
  assert.deepEqual(await loadProductPrices('USD', { fetcher: async () => Response.json(DEFAULT_PRICE_SET) }), DEFAULT_PRICE_SET);
  console.log(JSON.stringify({ boundary: 'fake clock / hanging transport', failureMs: 8000, automaticRetries: 0, manualRecovery: 'ok' }));
});
