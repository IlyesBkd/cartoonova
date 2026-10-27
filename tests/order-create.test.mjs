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
import { chromium } from 'playwright';
import { blobMock } from './upload-harness.mjs';
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
const previousDispatcher=getGlobalDispatcher(),offline=new MockAgent();
offline.disableNetConnect();setGlobalDispatcher(offline);
const previousFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw new Error('External transport forbidden in order tests');};

// Real route + real PostgreSQL. Only Stripe and outbound effects are replaced.
// No inherited database URL or provider credential is used.
const require = createRequire(import.meta.url);
require('tsx/cjs');
const root = path.resolve(import.meta.dirname, '..');
const pgBin = process.env.TEST_PG_BIN || '/usr/lib/postgresql/18/bin';
const runtime = mkdtempSync(path.join(tmpdir(), 'cartoonova-order-regression-'));
const pgData = path.join(runtime, 'pg');
const cleanEnv = Object.fromEntries(['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
let db, started = false, POST, CHECKOUT, uploadContext, uploadPolicy;
let checkoutCount = 0;
const effects = { promos: 0, analytics: 0, alerts: 0 };
const intents = new Map();
const proofCookies = new Map();
const { newCheckoutProof, checkoutProofCookieName } = require(path.join(root, 'lib/checkoutProof.ts'));
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
  await db.unsafe(readFileSync(path.join(root,'migrations/20261025_upload_quotas.sql'),'utf8'));
  const database = { sql: db, runtimeSchemaBootstrapEnabled: false, withFreshDatabaseClient: fn => fn(db) };
  uploadPolicy = loadTs('lib/uploadPolicy.ts', {'@/lib/db':database});
  uploadContext = loadTs('app/api/upload/context/route.ts', {'@/lib/uploadPolicy':uploadPolicy}).POST;
  const ownership = loadTs('lib/photoOwnership.ts', {'@/lib/db':database});
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
    '@/lib/db': database,
    '@/lib/photoOwnership': ownership,
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
  const checkoutHandler = loadTs('app/api/checkout/route.ts', { ...replacements, '@/lib/orderQuote': orderQuote,
    // This suite isolates quote binding; real reservations have PostgreSQL coverage separately.
    '@/lib/promoReservations': {
      reservePromoForCheckout: async () => true,
      releaseExpiredPromoReservations: async () => {},
    },
  }).POST;
  CHECKOUT = async req => {
    const response = await checkoutHandler(req);
    if (response.status === 200) {
      const body = await response.clone().json();
      proofCookies.set(body.clientSecret.split('_secret_')[0], response.headers.get('set-cookie').split(';')[0]);
    }
    return response;
  };
});

after(async () => {
  if (db) await db.end({ timeout: 2 });
  if (started) pg('pg_ctl', ['-D', pgData, '-m', 'fast', '-w', 'stop']);
  globalThis.fetch=previousFetch;setGlobalDispatcher(previousDispatcher);await offline.close();
});

function request(paymentIntentId, overrides = {}) {
  // Existing quote/retry fixtures represent the legitimate browser. New CODE-02
  // tests separately exercise missing/foreign proof; do not bypass the guard.
  if (!proofCookies.has(paymentIntentId)) {
    const proof = newCheckoutProof(), pi = intents.get(paymentIntentId) ?? intent();
    pi.id = paymentIntentId;
    pi.metadata = { ...pi.metadata, type: 'portrait_order', checkout_proof_hash: proof.hash, checkout_proof_expires_at: proof.expiresAt };
    intents.set(paymentIntentId, pi);
    proofCookies.set(paymentIntentId, `${checkoutProofCookieName(paymentIntentId)}=${proof.token}`);
  }
  return { headers: new Headers({ cookie: proofCookies.get(paymentIntentId) }), json: async () => ({ paymentIntentId, email: 'retry@example.invalid', firstName: 'Test', format: 'portrait', people: 1, animals: 0, printKey: 'digital', photoUrls: [], ...overrides }) };
}

const photoOrigin='https://synthetic.public.blob.vercel-storage.com';
async function browserPhoto(cookie) {
 process.env.BLOB_READ_WRITE_TOKEN='vercel_blob_rw_synthetic_localonly';
 const issued=await uploadContext(new Request('https://localhost/api/upload/context',{method:'POST',headers:{origin:'https://localhost','content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify({purpose:'checkout',product:'simpson'})}));
 assert.equal(issued.status,200);
 cookie=issued.headers.get('set-cookie').split(';')[0];
 const c=await issued.json();
 await uploadPolicy.reserveUpload(new Request('https://localhost/api/upload',{headers:{origin:'https://localhost',cookie}}),c.prefix+'photo.jpg',c.context);
 return {cookie,url:photoOrigin+'/'+c.prefix+'photo.jpg'};
}
function photoRequest(body,cookie) {
 const cookies = [cookie, proofCookies.get(body.paymentIntentId)].filter(Boolean).join('; ');
 return new Request('https://localhost/api/checkout',{method:'POST',headers:{origin:'https://localhost','content-type':'application/json',...(cookies?{cookie:cookies}:{})},body:JSON.stringify(body)});
}
test('CODE11 checkout and new orders reject another browser photo on the same IP before payment, SQL or effects',async()=>{
 const a=await browserPhoto(),b=await browserPhoto();
 const count=checkoutCount, before={...effects};
 for(const cookie of [undefined,b.cookie,'__Host-cartoonova-photo='+'f'.repeat(64)]) {
  const checkout=await CHECKOUT(photoRequest({orderConfig:digitalConfig,currency:'EUR',photoUrls:[a.url]},cookie));
  assert.equal(checkout.status,403);
  const created=await POST(photoRequest({paymentIntentId:'pi_foreign_photo',email:'synthetic@example.invalid',...digitalConfig,photoUrls:[a.url]},cookie));
  assert.equal(created.status,403);
 }
 assert.equal(checkoutCount,count);assert.deepEqual(effects,before);
 assert.equal((await db`SELECT count(*)::int n FROM orders WHERE payment_intent_id='pi_foreign_photo'`)[0].n,0);
});

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
  assert.equal(created.amount, 500, 'approved EUR fallback, not browser total');
  assert.ok(created.metadata.checkout_quote.length <= 500);
  const snapshot = JSON.parse(created.metadata.checkout_quote);
  assert.deepEqual(snapshot.config, digitalConfig);
  assert.equal(snapshot.amount, 500);
  assert.equal(snapshot.currency, 'EUR');
  for (const changed of [{ people: 10, printKey: 'canvas' }, { format: 'fullbody' }, { animals: 10 }, { printKey: 'framed' }, { people: '1' }]) {
    const refused = await POST(request(id, changed));
    assert.equal(refused.status, 409);
    assert.equal((await db`SELECT id FROM orders WHERE payment_intent_id = ${id}`).length, 0);
  }
  const accepted = await POST(request(id));
  assert.equal(accepted.status, 200);
  const [order] = await db`SELECT * FROM orders WHERE payment_intent_id = ${id}`;
  assert.equal(Number(order.total_price), 5);
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
    assert.equal(response.status, overrides.object === 'setup_intent' ? 403 : 409, `variant ${i}`);
    if (response.status === 409) assert.match((await response.json()).error, /support sans repayer/);
    assert.equal((await db`SELECT id FROM orders WHERE payment_intent_id = ${id}`).length, 0);
  }
  assert.deepEqual(effects, before);
});

test('authorized existing paid orders remain read-only without a quote on their PI', async () => {
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


test('CODE11 owned photos survive expiry, duplicate input, payment retries and concurrent order creation',async()=>{
 const a=await browserPhoto();
 await db`UPDATE upload_contexts SET expires_at=now()-interval '1 day'`;
 const checkout=await CHECKOUT(photoRequest({orderConfig:digitalConfig,currency:'EUR',photoUrls:[a.url,a.url]},a.cookie));
 assert.equal(checkout.status,200);
 const paymentIntentId=(await checkout.json()).clientSecret.split('_secret_')[0];
 const body={paymentIntentId,email:'owned@example.invalid',...digitalConfig,photoUrls:[a.url,a.url]};
 const before={...effects};
 const responses=await Promise.all(Array.from({length:12},()=>POST(photoRequest(body,a.cookie))));
 assert.ok(responses.every(r=>r.status===200));
 const ids=await Promise.all(responses.map(async r=>(await r.json()).orderId));
 assert.equal(new Set(ids).size,1);
 const rows=await db`SELECT * FROM orders WHERE payment_intent_id=${paymentIntentId}`;
 assert.equal(rows.length,1);assert.deepEqual(rows[0].photo_urls,[a.url]);
 assert.equal(effects.analytics-before.analytics,1);
 assert.equal((await POST(photoRequest(body,a.cookie))).status,200);
 assert.deepEqual((await db`SELECT * FROM orders WHERE payment_intent_id=${paymentIntentId}`)[0],rows[0]);
});
test('CODE11 rejects unreserved modern/legacy objects and wrong-purpose reservations even with a valid browser cookie',async()=>{
 const a=await browserPhoto();
 const prefix=new URL(a.url).pathname.slice(1).split('/').slice(0,-1).join('/')+'/';
 const [wrongScope]=await db`INSERT INTO upload_contexts(id,token_hash,purpose,subject,ip_hash,prefix,expires_at)
  SELECT gen_random_uuid(),repeat('e',64),'depot',subject,ip_hash,'orders/wrong-purpose/',now()+interval '1 hour' FROM upload_contexts WHERE prefix=${prefix} RETURNING id`;
 await db`INSERT INTO upload_reservations(id,context_id,pathname,reserved_bytes) VALUES (gen_random_uuid(),${wrongScope.id},'orders/wrong-purpose/photo.jpg',10485760)`;
 const [oldIpScope]=await db`INSERT INTO upload_contexts(id,token_hash,purpose,subject,ip_hash,prefix,expires_at)
  SELECT gen_random_uuid(),repeat('d',64),'checkout','checkout:'||ip_hash,ip_hash,'orders/old-ip-scope/',now()+interval '1 hour' FROM upload_contexts WHERE prefix=${prefix} RETURNING id`;
 await db`INSERT INTO upload_reservations(id,context_id,pathname,reserved_bytes) VALUES (gen_random_uuid(),${oldIpScope.id},'orders/old-ip-scope/photo.jpg',10485760)`;
 const before={...effects},count=checkoutCount;
 for(const url of [photoOrigin+'/orders/wrong-purpose/photo.jpg',photoOrigin+'/orders/old-ip-scope/photo.jpg',photoOrigin+'/orders/1792890000000-old%20image.jpg',photoOrigin+'/orders/12345678-1234-1234-1234-123456789abc/unreserved.jpg',photoOrigin+'/retouches/unattached.jpg']) {
  assert.equal((await CHECKOUT(photoRequest({orderConfig:digitalConfig,currency:'EUR',photoUrls:[url]},a.cookie))).status,403);
  assert.equal((await POST(photoRequest({paymentIntentId:'pi_unreserved',email:'synthetic@example.invalid',...digitalConfig,photoUrls:[url]},a.cookie))).status,403);
 }
 assert.deepEqual(effects,before);assert.equal(checkoutCount,count);
 assert.equal((await db`SELECT count(*)::int n FROM orders WHERE payment_intent_id='pi_unreserved'`)[0].n,0);
});
test('CODE11 ledger outage fails closed, while no-photo checkout/create need no photo cookie or storage configuration',async()=>{
 const a=await browserPhoto();
 await db`ALTER TABLE upload_reservations RENAME TO upload_reservations_unavailable`;
 const count=checkoutCount;
 try {
  assert.equal((await CHECKOUT(photoRequest({orderConfig:digitalConfig,currency:'EUR',photoUrls:[a.url]},a.cookie))).status,500);
  assert.equal((await POST(photoRequest({paymentIntentId:'pi_sql_photo',email:'synthetic@example.invalid',...digitalConfig,photoUrls:[a.url]},a.cookie))).status,500);
  assert.equal(checkoutCount,count);
  assert.equal((await db`SELECT count(*)::int n FROM orders WHERE payment_intent_id='pi_sql_photo'`)[0].n,0);
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const response=await CHECKOUT(photoRequest({orderConfig:digitalConfig,currency:'EUR',photoUrls:[]}));
  assert.equal(response.status,200);
  const paymentIntentId=(await response.json()).clientSecret.split('_secret_')[0];
  assert.equal((await POST(photoRequest({paymentIntentId,email:'no-photo@example.invalid',...digitalConfig,photoUrls:[]}))).status,200);
 }finally{await db`ALTER TABLE upload_reservations_unavailable RENAME TO upload_reservations`;process.env.BLOB_READ_WRITE_TOKEN='vercel_blob_rw_synthetic_localonly';}
});

test('CODE11 two Chromium browser contexts isolate HttpOnly photo cookies through real handlers and SQL',async()=>{
 process.env.BLOB_READ_WRITE_TOKEN='vercel_blob_rw_synthetic_localonly';
 const browser=await chromium.launch({headless:true});
 const upload=loadTs('app/api/upload/route.ts',{'@/lib/uploadPolicy':uploadPolicy,'@vercel/blob/client':blobMock}).POST;
 const handlers={'/api/upload/context':uploadContext,'/api/upload':upload,'/api/checkout':CHECKOUT,'/api/order/create':POST};
 try {
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
  for(const context of contexts)await context.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.origin!=='https://photos.invalid')return route.abort();
   if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Photo session test</title>'});
   const handler=handlers[u.pathname];if(!handler)return route.abort();
   const response=await handler(new Request(r.url(),{method:r.method(),headers:await r.allHeaders(),body:r.postData()}));
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  });
  const [a,b]=await Promise.all(contexts.map(async c=>{const page=await c.newPage();await page.goto('https://photos.invalid/');return page;}));
  const call=(page,path,body)=>page.evaluate(async({path,body})=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};},{path,body});
  const [ac,bc]=await Promise.all([a,b].map(p=>call(p,'/api/upload/context',{purpose:'checkout',product:'simpson'})));
  assert.equal(ac.status,200);assert.equal(bc.status,200);
  assert.equal(Object.hasOwn(ac.body,'photoSession'),false,'session capability must never appear in JSON');
  const [cookiesA,cookiesB]=await Promise.all(contexts.map(c=>c.cookies()));
  assert.equal(cookiesA.length,1);assert.equal(cookiesB.length,1);
  assert.equal(cookiesA[0].httpOnly,true);assert.equal(cookiesA[0].secure,true);assert.equal(cookiesA[0].sameSite,'Strict');
  assert.notEqual(cookiesA[0].value,cookiesB[0].value);
  assert.equal(await a.evaluate(()=>document.cookie),'');assert.equal(await b.evaluate(()=>document.cookie),'');
  const body={type:'blob.generate-client-token',payload:{pathname:ac.body.prefix+'browser.jpg',clientPayload:ac.body.context}};
  assert.equal((await call(b,'/api/upload',body)).status,403);
  assert.equal((await call(a,'/api/upload',body)).status,200);
  const photo=photoOrigin+'/'+body.payload.pathname;
  const quoteBody={orderConfig:digitalConfig,currency:'EUR',photoUrls:[photo]};
  assert.equal((await call(b,'/api/checkout',quoteBody)).status,403);
  const quoted=await call(a,'/api/checkout',quoteBody);assert.equal(quoted.status,200);
  const paymentIntentId=quoted.body.clientSecret.split('_secret_')[0];
  const createBody={paymentIntentId,email:'browser@example.invalid',...digitalConfig,photoUrls:[photo]};
  assert.equal((await call(b,'/api/order/create',createBody)).status,403);
  const created=await call(a,'/api/order/create',createBody);assert.equal(created.status,200);
  assert.deepEqual(await call(a,'/api/order/create',createBody),created);
  const rows=await db`SELECT photo_urls FROM orders WHERE payment_intent_id=${paymentIntentId}`;
  assert.equal(rows.length,1);assert.deepEqual(rows[0].photo_urls,[photo]);
  const scopes=await db`SELECT ip_hash,subject FROM upload_contexts WHERE prefix IN ${db([ac.body.prefix,bc.body.prefix])}`;
  assert.equal(scopes[0].ip_hash,scopes[1].ip_hash);assert.notEqual(scopes[0].subject,scopes[1].subject);
 }finally{await browser.close();}
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
