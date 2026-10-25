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
let db, started = false, POST;
const effects = { promos: 0, analytics: 0, alerts: 0 };
function pg(command, args) {
  return execFileSync(path.join(pgBin, command), args, { env: cleanEnv, encoding: 'utf8', timeout: 15000, stdio: 'pipe' });
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
  const sourcePath = path.join(root, 'app/api/order/create/route.ts');
  const source = ts.transpileModule(readFileSync(sourcePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const route = new Module(sourcePath);
  route.filename = sourcePath;
  const originalRequire = createRequire(sourcePath);
  const replacements = {
    stripe: class { paymentIntents = { retrieve: async () => ({ amount: 3900, currency: 'eur', metadata: { promo_code: 'REGRESSION', discount: '5', lang: 'fr' } }) }; },
    '@/lib/db': { sql: db, runtimeSchemaBootstrapEnabled: false },
    '@/lib/promoCodes': { consumePromoCode: async () => { effects.promos++; } },
    '@/lib/analyticsServeur': { mesureServeur: async () => { effects.analytics++; } },
    '@/lib/alerteServeur': { signalerPanne: async () => { effects.alerts++; } },
  };
  route.require = name => Object.hasOwn(replacements, name) ? replacements[name] : originalRequire(name.startsWith('@/') ? path.join(root, name.slice(2)) : name);
  route._compile(source, sourcePath);
  POST = route.exports.POST;
});

after(async () => {
  if (db) await db.end({ timeout: 2 });
  if (started) pg('pg_ctl', ['-D', pgData, '-m', 'fast', '-w', 'stop']);
});

function request(paymentIntentId, overrides = {}) {
  return { json: async () => ({ paymentIntentId, email: 'retry@example.invalid', firstName: 'Test', format: 'portrait', people: 1, animals: 0, printKey: 'digital', photoUrls: [], ...overrides }) };
}

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
