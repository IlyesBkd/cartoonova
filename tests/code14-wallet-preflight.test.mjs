import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectDomains } from '../scripts/code14-wallet-preflight.mjs';
// Provider simulations only: accidental default-fetch use cannot contact a provider.
globalThis.fetch = () => { throw Error('Network disabled in isolated CODE14 tests'); };

test('public preflight extracts modes without persisting keys; chunks same-origin GET only', async () => {
  const { inspectPublic } = await import('../scripts/code14-wallet-preflight.mjs');
  const calls = [];
  const result = await inspectPublic({ fetcher: async (url, options) => {
    calls.push([String(url), options]);
    return { ok: true, status: 200, headers: new Headers({ 'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; script-src-attr 'none'", 'permissions-policy': 'payment=(self "https://js.stripe.com")' }), text: async () => String(url).endsWith('.js') ? 'const key="pk_live_SYNTHETIC";' : '<script src="/_next/static/a.js"></script><script src="https://evil.example/key.js"></script>' };
  } });
  assert.equal(result.report.publishableKey.live, 'présent');
  assert.equal(result.report.publishableKey.test, 'absent');
  assert.equal(result.report.csp.inlineScript, 'présent');
  assert.equal(result.report.csp.enforcement, 'présent');
  assert.equal(result.report.chunksComplete, true);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(([url, options]) => new URL(url).origin === 'https://www.cartoonova.com' && options.method === 'GET'));
  assert.doesNotMatch(JSON.stringify(result.report), /SYNTHETIC/);
  assert.equal(result.keys.live, 'pk_live_SYNTHETIC'); // memory only; CLI prints report, never keys
});

test('failed public fetch and incomplete chunk scan are unknown, not absent', async () => {
  const { inspectPublic } = await import('../scripts/code14-wallet-preflight.mjs');
  assert.equal((await inspectPublic({ fetcher: async () => { throw Error('PRIVATE'); } })).report.publishableKey.live, 'inconnu');
  const result = await inspectPublic({ fetcher: async (url) => {
    if (String(url).endsWith('.js')) throw Error('PRIVATE');
    return { ok: true, status: 200, headers: new Headers(), text: async () => '<script src="/_next/static/a.js"></script>' };
  } });
  assert.equal(result.report.publishableKey.live, 'inconnu');
  assert.equal(result.report.csp.enforcement, 'absent');
  assert.doesNotMatch(JSON.stringify(result.report), /PRIVATE/);
});

test('browser safety permits SDK GET resources but refuses all writes and app endpoints', async () => {
  const { sdkRequestAllowed, probeBrowser } = await import('../scripts/code14-wallet-browser.mjs');
  for (const url of ['https://js.stripe.com/v3/', 'https://api.stripe.com/v1/elements/sessions?key=pk_test_SYNTHETIC', 'https://pay.google.com/gp/p/js/pay.js']) assert.equal(sdkRequestAllowed('GET', url), true);
  for (const [method, url] of [['POST', 'https://api.stripe.com/v1/payment_intents'], ['GET', 'https://api.stripe.com/v1/payment_intents'], ['POST', 'https://www.cartoonova.com/api/csp'], ['GET', 'https://www.cartoonova.com/api/prices'], ['GET', 'http://js.stripe.com/v3/'], ['GET', 'https://evilstripe.com/'], ['POST', 'https://r.stripe.com/b']]) assert.equal(sdkRequestAllowed(method, url), false);
  const result = await probeBrowser({ mode: 'test', key: 'pk_live_SYNTHETIC' });
  assert.equal(result.reason, 'invalid_publishable_key_mode');
  assert.equal(result.applePay, 'inconnu');
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC/);
});

test('public preflight follows public lazy chunk references without claiming initial HTML is full configuration', async () => {
  const { inspectPublic } = await import('../scripts/code14-wallet-preflight.mjs');
  const result = await inspectPublic({ fetcher: async (url) => ({ ok: true, status: 200, headers: new Headers(), text: async () => String(url).endsWith('/lazy.js') ? 'pk_live_SYNTHETIC' : String(url).endsWith('.js') ? 'load("static/immutable/chunks/lazy.js")' : '<script src="/_next/static/immutable/chunks/entry.js"></script>' }) });
  assert.equal(result.report.publishableKey.live, 'présent');
  assert.equal(result.report.chunksScanned, 2);
  assert.match(result.report.publishableKeyScope, /reachable/);
});

const env = { STRIPE_SECRET_KEY: 'rk_live_SYNTHETIC', CARTOONOVA_STRIPE_TEST_SECRET_KEY: 'rk_test_SYNTHETIC' };
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });

test('GET-only domain pagination distinguishes test/live and reduces to public statuses', async () => {
  const calls = [];
  const result = await inspectDomains({ mode: 'test', domain: 'www.cartoonova.com', env, fetcher: async (url, options) => {
    calls.push({ url: String(url), options });
    return response(calls.length === 1 ? { data: [{ id: 'pmd_one', domain_name: 'other.example', livemode: false }], has_more: true } : {
      data: [{ id: 'pmd_two', domain_name: 'www.cartoonova.com', enabled: true, livemode: false, apple_pay: { status: 'active' }, google_pay: { status: 'inactive', status_details: { error_message: 'PRIVATE' } } }], has_more: false,
    });
  } });
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.equal(c.options.method, 'GET');
    assert.equal(new URL(c.url).origin, 'https://api.stripe.com');
    assert.equal(new URL(c.url).pathname, '/v1/payment_method_domains');
    assert.equal(c.options.redirect, 'error');
    assert.equal(c.options.headers.Authorization, `Bearer ${env.CARTOONOVA_STRIPE_TEST_SECRET_KEY}`);
  }
  assert.equal(new URL(calls[1].url).searchParams.get('starting_after'), 'pmd_one');
  assert.equal(result.registration, 'présent');
  assert.equal(result.applePay, 'présent');
  assert.equal(result.googlePay, 'absent');
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
});

test('missing domain is absent only after a complete successful list', async () => {
  assert.equal((await inspectDomains({ mode: 'live', domain: 'www.cartoonova.com', env, fetcher: async () => response({ data: [], has_more: false }) })).registration, 'absent');
});

for (const [name, fetcher] of [
  ['HTTP denial', async () => response({ message: env.STRIPE_SECRET_KEY }, 403)],
  ['echoing thrown error', async () => { throw Error(env.STRIPE_SECRET_KEY); }],
  ['malformed JSON shape', async () => response({ data: 'PRIVATE' })],
  ['mode mismatch', async () => response({ data: [{ domain_name: 'www.cartoonova.com', enabled: true, livemode: false }], has_more: false })],
  ['broken pagination', async () => response({ data: [], has_more: true })],
]) test(`${name} remains unknown and never leaks provider messages`, async () => {
  const result = await inspectDomains({ mode: 'live', domain: 'www.cartoonova.com', env, fetcher });
  assert.equal(result.registration, 'inconnu');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|SYNTHETIC/);
});

test('invalid mode, domain or wrong-mode key refuses network', async () => {
  const fetcher = () => { throw Error('must not call'); };
  for (const input of [{ mode: 'prod', domain: 'www.cartoonova.com' }, { mode: 'live', domain: 'www.cartoonova.com/?secret' }, { mode: 'live', domain: 'www.cartoonova.com', env: { STRIPE_SECRET_KEY: 'rk_test_SYNTHETIC' } }]) {
    const result = await inspectDomains({ env, fetcher, ...input });
    assert.equal(result.registration, 'inconnu');
    assert.match(result.reason, /invalid/);
  }
});

test('CODE14 unknown is not absent when credentials are unavailable; no network', async () => {
  const { inspectDomains } = await import('../scripts/code14-wallet-preflight.mjs');
  const result = await inspectDomains({ mode: 'live', domain: 'www.cartoonova.com', env: {}, fetcher: () => { throw Error('network forbidden'); } });
  assert.equal(result.registration, 'inconnu');
  assert.equal(result.reason, 'credential_missing');
});
