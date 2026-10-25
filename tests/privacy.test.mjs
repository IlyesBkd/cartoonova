import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
after(() => { globalThis.fetch = originalFetch; console.error = originalError; });

// Run with env -i. Only synthetic credentials; fail closed on every transport.
process.env.RESEND_API_KEY = 're_synthetic_privacy_test';
process.env.VERCEL = '1';
process.env.VERCEL_ENV = 'production';
process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_synthetic';
process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://analytics.invalid';
process.env.DISCORD_WEBHOOK_URL = 'https://discord.invalid/webhook';
process.env.CRON_SECRET = 'synthetic-privacy-hmac-key';
process.env.OPENAI_CONVERSIONS_API_KEY = 'synthetic-conversion-key';
const email = 'privacy.customer@synthetic.invalid';
const photo = 'https://synthetic.public.blob.vercel-storage.com/private-photo.jpg';
const token = 'synthetic-access-token-123';
const privateMessage = `${email} ${photo} https://cartoonova.invalid/suivi/${token}?token=${token}`;
const wire = [];
const logs = [];
const originalFetch = globalThis.fetch;
const originalError = console.error;
globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  let body = options.body;
  if (body instanceof Blob) body = await body.arrayBuffer();
  if (body instanceof ArrayBuffer) body = new Uint8Array(body);
  if (body instanceof Uint8Array) {
    const { gunzipSync } = await import('node:zlib');
    try { body = gunzipSync(body).toString(); } catch { body = Buffer.from(body).toString(); }
  }
  const decoded = body ? JSON.parse(String(body)) : null;
  wire.push({ target, body: decoded });
  if (target.startsWith('https://api.resend.com/')) return new Response(JSON.stringify({ name: 'validation_error', message: privateMessage }), { status: 422, headers: { 'content-type': 'application/json' } });
  if (target.startsWith('https://analytics.invalid/')) return new Response(JSON.stringify({ status: 1 }), { status: 200 });
  if (target.startsWith('https://discord.invalid/')) return new Response(null, { status: 204 });
  throw new Error('Unexpected network destination');
};
console.error = (...args) => logs.push(args.map(x => x instanceof Error ? `${x.name}: ${x.message} ${x.stack}` : x));
function clean(value) {
  const text = JSON.stringify(value);
  for (const secret of [email, photo, token]) assert.ok(!text.includes(secret), `private fixture escaped: ${secret}`);
}
function save(name, value) {
  if (!process.env.PRIVACY_CAPTURE_DIR) return;
  mkdirSync(process.env.PRIVACY_CAPTURE_DIR, { recursive: true });
  writeFileSync(path.join(process.env.PRIVACY_CAPTURE_DIR, name + '.json'), JSON.stringify(value, null, 2));
}

test('Resend rejection through real adapter and SDK does not export recipient or provider message in exceptions', async () => {
  try {
    const { envoyerEmail } = await import('../lib/envoiEmail.ts');
    let failure;
    try { await envoyerEmail({ from: 'test@synthetic.invalid', to: email, subject: 'Synthetic', html: '<p>synthetic</p>' }); } catch (error) { failure = error; }
    assert.ok(failure instanceof Error);
    assert.match(failure.message, /Resend/);
    assert.ok(wire.some(x => x.target.includes('api.resend.com')));
    clean({ message: failure.message, stack: failure.stack });
    save('resend-safe-exception', { message: failure.message });
  } finally { /* transports restored after all tests */ }
});

test('server failure captures contain safe diagnostics, not raw exception or details, on Discord, PostHog and console', async () => {
  wire.length = 0; logs.length = 0;
  const { signalerPanne } = await import('../lib/alerteServeur.ts');
  await signalerPanne('privacy synthetic', new Error(privateMessage), { email, photoUrl: photo, token, jeton: token, orderId: 'synthetic-order', status: 503 });
  assert.ok(wire.some(x => x.target.startsWith('https://discord.invalid/')));
  assert.ok(wire.some(x => x.target.startsWith('https://analytics.invalid/')), JSON.stringify({wire,logs}));
  clean(wire); clean(logs);
  assert.match(JSON.stringify(wire), /synthetic-order/);
  save('failure-transport', { wire, logs });
});

test('business server SDK transport uses stable keyed pseudonyms and recursively removes private properties', async () => {
  wire.length = 0;
  const { mesureServeur, personneServeur } = await import('../lib/analyticsServeur.ts');
  const { MESURES } = await import('../lib/evenementsMesure.ts');
  for (const identifiant of [email, email.toUpperCase(), 'other.customer@synthetic.invalid']) {
    await mesureServeur(MESURES.panneServeur, { identifiant, proprietes: { total: 42, nested: [{ email, photoUrl: photo, token, text: privateMessage }] } });
  }
  await personneServeur(email, { email, total: 42, nested: { token } });
  const events = wire.flatMap(x => x.body?.batch || []);
  assert.equal(events.length, 4);
  clean(wire);
  const ids = events.map(x => x.distinct_id ?? x.properties.distinct_id);
  assert.match(ids[0], /^person_[a-f0-9]{64}$/);
  assert.equal(ids[0], ids[1]); assert.equal(ids[0], ids[3]); assert.notEqual(ids[0], ids[2]);
  assert.match(JSON.stringify(events), /42/);
  save('business-transport', { wire });
});

test('server keeps pseudonyms stable using the existing Stripe server secret when newsletter/cron secrets are absent', async () => {
  const { mesureServeur } = await import('../lib/analyticsServeur.ts');
  const { MESURES } = await import('../lib/evenementsMesure.ts');
  delete process.env.CRON_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_synthetic_privacy_hmac';
  wire.length = 0;
  try {
    await mesureServeur(MESURES.panneServeur, { identifiant: email });
    await mesureServeur(MESURES.panneServeur, { identifiant: email });
    const ids = wire.flatMap(x => x.body?.batch || []).map(x => x.distinct_id);
    assert.equal(ids.length, 2); assert.match(ids[0], /^person_[a-f0-9]{64}$/); assert.equal(ids[0], ids[1]);
    clean(wire);
  } finally { delete process.env.STRIPE_SECRET_KEY; process.env.CRON_SECRET = 'synthetic-privacy-hmac-key'; }
});

test('Discord direct notification and its failed transport never export private fields or raw errors', async () => {
  wire.length = 0; logs.length = 0;
  const { alerteDiscord } = await import('../lib/discord.ts');
  await alerteDiscord({ titre: privateMessage, couleur: 1, champs: [{ name: 'token', value: token }, { name: 'Email', value: email }, { name: 'Diagnostic', value: privateMessage }], piedDePage: privateMessage });
  clean(wire);
  const fetchCapture = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error(privateMessage); };
    await alerteDiscord({ titre: 'Synthetic', couleur: 1, champs: [] });
    clean(logs);
  } finally { globalThis.fetch = fetchCapture; }
});

test('conversion failure keeps status without echoing provider response into logs or caller', async () => {
  logs.length = 0;
  const { envoyerConversionChatgpt } = await import('../lib/conversionsChatgpt.ts');
  const fetchCapture = globalThis.fetch;
  const requests = [];
  try {
    globalThis.fetch = async (url, options) => {
      assert.ok(String(url).startsWith('https://bzr.openai.com/'));
      requests.push(JSON.parse(options.body));
      return new Response(privateMessage, { status: 422 });
    };
    const result = await envoyerConversionChatgpt({ id: 'synthetic-order', customer_email: email, total_price: 42, currency: 'EUR', origine: null });
    assert.equal(result.ok, false); assert.equal(result.statut, 422);
    assert.equal(requests.length, 1);
    clean(requests); clean(result); clean(logs);
    save('conversion-transport', { requests, result, logs });
    globalThis.fetch = async () => { throw new Error(privateMessage); };
    clean(await envoyerConversionChatgpt({ id: 'synthetic-order', customer_email: email, total_price: 42, currency: 'EUR', origine: null }));
    clean(logs);
  } finally { globalThis.fetch = fetchCapture; }
});
