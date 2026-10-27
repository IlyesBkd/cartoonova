import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { load } from './upload-harness.mjs';
const require = createRequire(import.meta.url);
require('tsx/cjs');
const { DEFAULT_PRICE_SET, DEFAULT_PRICES_BY_CURRENCY } = require('../lib/types.ts');
const { currencies, convertPrice } = require('../lib/currency.ts');
const approvedEUR = { base: 5, fullbodyExtra: 5, extraPerson: 5, extraAnimal: 5, digital: 0, canvas: 39, poster: 59, posterSimple: 19, banner: 3, extraDecor: 5, express: 7, carteVoeux: 4, calendrier: 9, shipping: 4.9 };
// Public approved configuration read 2026-10-27, E2E-03; no customer data.
test('EUR fallback matches approved public configuration, every field', () => {
  assert.deepEqual(DEFAULT_PRICE_SET, approvedEUR);
});
test('converted fallback currencies use the existing approved conversion policy', () => {
  for (const currency of ['PLN', 'SEK', 'DKK', 'CHF']) {
    assert.deepEqual(DEFAULT_PRICES_BY_CURRENCY[currency], Object.fromEntries(Object.entries(approvedEUR).map(([key, value]) => [key, key === 'digital' ? value : convertPrice(value, currency)])), currency);
  }
});
test('empty price configuration then recovery preserve displayed and server quote totals across all currencies and supports', async () => {
  let stored = null;
  const sql = async () => stored ? [{ data: stored }] : [];
  const previous = { DATABASE_URL: process.env.DATABASE_URL, VERCEL: process.env.VERCEL };
  process.env.DATABASE_URL = 'postgresql://synthetic@127.0.0.1:1/unused';
  process.env.VERCEL = '1';
  const db = load('lib/db.ts', { postgres: () => sql });
  await db.getPricesForCurrency('EUR');
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  const { quoteOrder } = load('lib/orderQuote.ts', { './db': db, './promoCodes': { validatePromoCode: () => { throw Error('no promo expected'); } } });
  const { computeOrderSubtotal, computeShipping } = require('../lib/pricing.ts');
  for (const currency of currencies) for (const printKey of ['digital', 'posterSimple', 'canvas', 'framed']) {
    const orderConfig = { format: 'fullbody', people: 3, animals: 2, printKey, banner: true, extraDecor: true, express: true };
    stored = null;
    const prices = await db.getPricesForCurrency(currency);
    const display = Math.round((computeOrderSubtotal(prices, orderConfig) + computeShipping(prices, printKey)) * 100) / 100;
    const fallback = await quoteOrder({ currency, orderConfig });
    stored = DEFAULT_PRICES_BY_CURRENCY;
    const recovered = await quoteOrder({ currency, orderConfig });
    assert.equal(fallback.quote.total, display);
    assert.deepEqual(recovered, fallback);
  }
});
