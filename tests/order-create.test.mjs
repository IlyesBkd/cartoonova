import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { execFileSync } from 'node:child_process';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
import postgres from 'postgres';

// Real route + real PostgreSQL. Only Stripe and outbound effects are replaced.
// No inherited database URL or provider credential is used.
const require = createRequire(import.meta.url);
require('tsx/cjs');
const root = path.resolve(import.meta.dirname, '..');
const pgBin = process.env.TEST_PG_BIN || '/usr/lib/postgresql/18/bin';
const runtime = mkdtempSync(path.join(tmpdir(), 'cartoonova-order-regression-'));
const pgData = path.join(runtime, 'pg');
const cleanEnv = Object.fromEntries(['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
let db, started = false, POST, CHECKOUT;
let checkoutCount = 0;
const effects = { promos: 0, analytics: 0, alerts: 0 };
const intents = new Map();
const digitalConfig = { format: 'portrait', people: 1, animals: 0, printKey: 'digital', banner: false, extraDecor: false, express: false, carteVoeux: false, calendrier: false };
function intent(overrides = {}) {
  return { object: 'payment_intent', amount: 3900, currency: 'eur', metadata: {
    promo_code: 'REGRESSION', discount: '5', lang: 'fr',
    checkout_quote: JSON.stringify({ version: 1, type: 'portrait_order', config: digitalConfig, amount: 3900, currency: 'EUR', shipping: 0, discount: 5, promoCode: 'REGRESSION' }),
  }, ...overrides };
}
function pg(command, args) {
  return execFileSync(path.join(pgBin, command), args, { env: cleanEnv, encoding: 'utf8', timeout: 15000, stdio: 'pipe' });
}

function loadTs(relative, replacements = {}) {
  const sourcePath = path.join(root, relative);
  const source = ts.transpileModule(readFileSync(sourcePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loaded = new Module(sourcePath);
  loaded.filename = sourcePath;
  const originalRequire = createRequire(sourcePath);
  loaded.require = name => Object.hasOwn(replacements, name) ? replacements[name] : originalRequire(name.startsWith('@/') ? path.join(root, name.slice(2)) : name);
  loaded._compile(source, sourcePath);
  return loaded.exports;
}

before(async () => {
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  assert.notEqual(port, 5432);
  pg('initdb', ['-D', pgData, '-U', 'cartoonova_test', '--auth=trust', '--no-locale', '--encoding=UTF8']);
  pg('pg_ctl', ['-D', pgData, '-l', path.join(runtime, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${runtime}`, '-w', 'start']);
  started = true;
  db = postgres(`postgresql://cartoonova_test@127.0.0.1:${port}/postgres`, { max: 8, onnotice() {} });
  const [identity] = await db`SELECT current_database() AS name, inet_server_port() AS port`;
  assert.equal(identity.port, port);
  assert.equal(identity.name, 'postgres');
  await db`CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_intent_id text UNIQUE NOT NULL,
    customer_email text, customer_name text, customer_address text,
    total_price numeric, currency text, options jsonb, photo_urls jsonb, status text,
    detected_country text, promo_code text, discount_amount numeric, origine jsonb, langue text,
    paid_at timestamptz
  )`;
  const replacements = {
    stripe: class { paymentIntents = {
      retrieve: async id => intents.get(id) ?? intent(),
      create: async params => {
        const id = `pi_checkout${++checkoutCount}`;
        const created = { object: 'payment_intent', id, ...params, client_secret: `${id}_secret_fixture` };
        intents.set(id, created);
        return created;
      },
    }; },
    '@/lib/db': { sql: db, runtimeSchemaBootstrapEnabled: false },
    '@/lib/promoCodes': { consumePromoCode: async () => { effects.promos++; } },
    '@/lib/analyticsServeur': { mesureServeur: async () => { effects.analytics++; } },
    '@/lib/alerteServeur': { signalerPanne: async () => { effects.alerts++; } },
  };
  POST = loadTs('app/api/order/create/route.ts', replacements).POST;
  const { DEFAULT_PRICE_SET } = require(path.join(root, 'lib/types.ts'));
  const orderQuote = loadTs('lib/orderQuote.ts', {
    './db': { getPricesForCurrency: async () => ({ ...DEFAULT_PRICE_SET }) },
    './promoCodes': { validatePromoCode: async () => ({ ok: true, discount: 1, code: 'TEST' }) },
  });
  CHECKOUT = loadTs('app/api/checkout/route.ts', { ...replacements, '@/lib/orderQuote': orderQuote,
    // This suite isolates quote binding; real reservations have PostgreSQL coverage separately.
    '@/lib/promoReservations': {
      reservePromoForCheckout: async () => true,
      releaseExpiredPromoReservations: async () => {},
    },
  }).POST;
});

after(async () => {
  if (db) await db.end({ timeout: 2 });
  if (started) pg('pg_ctl', ['-D', pgData, '-m', 'fast', '-w', 'stop']);
});

function request(paymentIntentId, overrides = {}) {
  return { json: async () => ({ paymentIntentId, email: 'retry@example.invalid', firstName: 'Test', format: 'portrait', people: 1, animals: 0, printKey: 'digital', photoUrls: [], ...overrides }) };
}

test('CODE-01: digital one-person quote cannot create a ten-person canvas order', async () => {
  const id = 'pi_quote_digital_canvas_attack';
  const before = { ...effects };
  const response = await POST(request(id, { people: 10, printKey: 'canvas' }));
  assert.equal(response.status, 409, 'configuration must match the immutable server quote');
  const rows = await db`SELECT * FROM orders WHERE payment_intent_id = ${id}`;
  assert.equal(rows.length, 0);
  assert.deepEqual(effects, before);
});

test('retry after a declined payment returns the same order without duplicate side effects', async () => {
  const id = 'pi_regression_declined';
  const first = await POST(request(id));
  assert.equal(first.status, 200);
  const original = await first.json();
  // A refusal leaves the original order PENDING; the next click calls POST again.
  const retry = await POST(request(id));
  assert.equal(retry.status, 200, 'valid-card retry must not fail with a unique-constraint HTTP 500');
  assert.deepEqual(await retry.json(), original);
  const rows = await db`SELECT * FROM orders WHERE payment_intent_id = ${id}`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'PENDING');
  assert.deepEqual(effects, { promos: 1, analytics: 1, alerts: 0 });
});

test('concurrent submissions create one order and emit creation effects once', async () => {
  const before = { ...effects };
  const id = 'pi_regression_concurrent';
  const responses = await Promise.all(Array.from({ length: 12 }, () => POST(request(id))));
  assert.ok(responses.every(response => response.status === 200));
  const bodies = await Promise.all(responses.map(response => response.json()));
  assert.equal(new Set(bodies.map(body => body.orderId)).size, 1);
  const [count] = await db`SELECT count(*)::int AS n FROM orders WHERE payment_intent_id = ${id}`;
  assert.equal(count.n, 1);
  assert.equal(effects.promos - before.promos, 1);
  assert.equal(effects.analytics - before.analytics, 1);
  assert.equal(effects.alerts - before.alerts, 0);
});

test('reload after payment does not reset payment, production details or photos', async () => {
  const id = 'pi_regression_paid';
  const first = await POST(request(id));
  const original = await first.json();
  await db`UPDATE orders SET status = 'in_progress', paid_at = NOW(),
    options = '{"people":1,"printKey":"digital"}'::jsonb,
    photo_urls = '["https://example.invalid/original.png"]'::jsonb
    WHERE payment_intent_id = ${id}`;
  const [before] = await db`SELECT * FROM orders WHERE payment_intent_id = ${id}`;
  const priorEffects = { ...effects };
  const response = await POST(request(id, { people: 10, printKey: 'canvas', firstName: 'Changed' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), original);
  const [after] = await db`SELECT * FROM orders WHERE payment_intent_id = ${id}`;
  assert.deepEqual(after, before);
  assert.deepEqual(effects, priorEffects);
});

test('another email cannot recover an existing order through a retry', async () => {
  const id = 'pi_regression_other_email';
  await POST(request(id));
  const [before] = await db`SELECT * FROM orders WHERE payment_intent_id = ${id}`;
  const response = await POST(request(id, { email: 'other@example.invalid' }));
  assert.equal(response.status, 409);
  assert.equal(Object.hasOwn(await response.json(), 'orderId'), false);
  const [after] = await db`SELECT * FROM orders WHERE payment_intent_id = ${id}`;
  assert.deepEqual(after, before);
});

test('invalid retry input is still rejected before returning an order', async () => {
  const id = 'pi_regression_invalid';
  await POST(request(id));
  assert.equal((await POST(request(id, { email: 'invalid' }))).status, 400);
  assert.equal((await POST(request(id, { printKey: 'poster', countryCode: 'FR', postalCode: 'wrong' }))).status, 400);
});

test('real checkout quote rejects altered deliverables and accepts the identical configuration', async () => {
  const response = await CHECKOUT({ json: async () => ({ orderConfig: digitalConfig, currency: 'EUR', photoUrls: [], lang: 'fr' }) });
  assert.equal(response.status, 200);
  const result = await response.json();
  const id = result.clientSecret.split('_secret_')[0];
  const created = intents.get(id);
  assert.equal(created.amount, 499, 'real pricing formula, not browser total');
  assert.ok(created.metadata.checkout_quote.length <= 500);
  const snapshot = JSON.parse(created.metadata.checkout_quote);
  assert.deepEqual(snapshot.config, digitalConfig);
  assert.equal(snapshot.amount, 499);
  assert.equal(snapshot.currency, 'EUR');
  for (const changed of [{ people: 10, printKey: 'canvas' }, { format: 'fullbody' }, { animals: 10 }, { printKey: 'framed' }, { people: '1' }]) {
    const refused = await POST(request(id, changed));
    assert.equal(refused.status, 409);
    assert.equal((await db`SELECT id FROM orders WHERE payment_intent_id = ${id}`).length, 0);
  }
  const accepted = await POST(request(id));
  assert.equal(accepted.status, 200);
  const [order] = await db`SELECT * FROM orders WHERE payment_intent_id = ${id}`;
  assert.equal(Number(order.total_price), 4.99);
  assert.equal(order.currency, 'EUR');
  for (const key of ['format', 'people', 'animals', 'printKey']) assert.equal(order.options[key], snapshot.config[key]);
});

test('invalid, missing, wrong-type and amount/currency-mismatched snapshots fail closed', async () => {
  const base = intent();
  const quote = JSON.parse(base.metadata.checkout_quote);
  const variants = [
    { metadata: {} },
    { metadata: { checkout_quote: '{broken' } },
    { metadata: { checkout_quote: JSON.stringify({ ...quote, type: 'gift_card' }) } },
    { metadata: { checkout_quote: JSON.stringify({ ...quote, version: 2 }) } },
    { amount: 100 },
    { currency: 'usd' },
    { object: 'setup_intent' },
    { metadata: { checkout_quote: JSON.stringify({ ...quote, config: { ...digitalConfig, people: 11 } }) } },
  ];
  const before = { ...effects };
  for (const [i, overrides] of variants.entries()) {
    const id = `pi_quote_invalid_${i}`;
    intents.set(id, intent(overrides));
    const response = await POST(request(id));
    assert.equal(response.status, 409, `variant ${i}`);
    assert.match((await response.json()).error, /support sans repayer/);
    assert.equal((await db`SELECT id FROM orders WHERE payment_intent_id = ${id}`).length, 0);
  }
  assert.deepEqual(effects, before);
});

test('existing legacy paid orders remain read-only without a quote on their PI', async () => {
  const id = 'pi_legacy_paid';
  await db`INSERT INTO orders (payment_intent_id, customer_email, status, paid_at, options)
    VALUES (${id}, 'retry@example.invalid', 'PAID', NOW(), '{"people":1,"printKey":"digital"}')`;
  intents.set(id, intent({ metadata: {} }));
  const [before] = await db`SELECT * FROM orders WHERE payment_intent_id = ${id}`;
  const priorEffects = { ...effects };
  const response = await POST(request(id, { people: 10, printKey: 'canvas' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).orderId, before.id);
  const [after] = await db`SELECT * FROM orders WHERE payment_intent_id = ${id}`;
  assert.deepEqual(after, before);
  assert.deepEqual(effects, priorEffects);
});

test('a forged translated support label cannot advertise a canvas for a digital quote', async () => {
  const id = 'pi_quote_forged_label';
  const response = await POST(request(id, { printOption: 'Portrait encadré sur toile' }));
  assert.equal(response.status, 200);
  const [order] = await db`SELECT * FROM orders WHERE payment_intent_id = ${id}`;
  assert.equal(order.options.printOption, 'Fichier numérique');
});

test('paid options, discount and shipping are delivered from the frozen quote only', async () => {
  const config = { ...digitalConfig, format: 'fullbody', people: 3, animals: 2, printKey: 'canvas', express: true, extraDecor: true };
  const response = await CHECKOUT({ json: async () => ({ orderConfig: config, currency: 'EUR', promoCode: 'TEST', photoUrls: [] }) });
  assert.equal(response.status, 200);
  const result = await response.json();
  const id = result.clientSecret.split('_secret_')[0];
  const pi = intents.get(id);
  const snapshot = JSON.parse(pi.metadata.checkout_quote);
  // Old loose metadata and browser flags must not override the snapshot.
  pi.metadata.options = 'banner';
  pi.metadata.discount = '1000';
  pi.metadata.shipping = '1000';
  const accepted = await POST(request(id, { ...config, express: false, banner: true }));
  assert.equal(accepted.status, 200);
  const [order] = await db`SELECT * FROM orders WHERE payment_intent_id = ${id}`;
  assert.equal(order.options.express, true);
  assert.equal(order.options.extraDecor, true);
  assert.equal(order.options.banner, false);
  assert.equal(order.options.shippingAmount, snapshot.shipping);
  assert.equal(Number(order.discount_amount), 1);
  assert.equal(order.promo_code, 'TEST');
  assert.equal(Number(order.total_price), snapshot.amount / 100);
});


test('malformed gift instructions are refused before an order is recorded', async () => {
  const invalid = [
    { recipientEmail: 'not-an-email' },
    { deliverAfter: '2026-02-30' },
    { deliverAfter: 'tomorrow' },
    { message: { text: 'not a string' } },
    'not an object',
    [],
  ];
  for (const [i, gift] of invalid.entries()) {
    const id = `pi_invalid_gift_${i}`;
    const response = await POST(request(id, { gift }));
    assert.equal(response.status, 400, `gift variant ${i}`);
    assert.equal((await db`SELECT id FROM orders WHERE payment_intent_id = ${id}`).length, 0);
  }
});
