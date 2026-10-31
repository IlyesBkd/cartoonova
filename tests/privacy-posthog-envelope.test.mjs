import test from 'node:test';
import assert from 'node:assert/strict';

// From 25/10/2026, filtrerAvantEnvoi ran the whole event through proprietesMesure:
// the timestamp Date became {} and PostHog dropped every browser event. The
// envelope must survive intact while the payloads stay cleaned.

const store = new Map();
globalThis.window = { location: { hash: '', hostname: 'www.cartoonova.com', pathname: '/fr' }, addEventListener() {} };
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
Object.defineProperty(globalThis, 'navigator', { value: { webdriver: false, userAgent: 'Mozilla/5.0 Chrome/141' }, configurable: true });
globalThis.document = { cookie: '' };
globalThis.location = globalThis.window.location;
process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_synthetic_project_key';

const { filtrerAvantEnvoi } = await import('../lib/analytics.ts');

const evenement = () => ({
  uuid: '0199b7c4-synthetic',
  event: '$pageview',
  timestamp: new Date('2026-10-31T12:00:00Z'),
  properties: {
    distinct_id: '0199b7c4-anon',
    token: 'phc_synthetic_project_key',
    $lib: 'web',
    $pathname: '/fr/suivi/abc123secret',
    $current_url: 'https://www.cartoonova.com/fr/suivi/abc123secret?email=client%40synthetic.example&utm_source=newsletter',
    $referrer: 'https://www.google.com/search?q=portrait+simpson',
    email: 'client@synthetic.example',
    label: 'Contact client@synthetic.example',
  },
  $set_once: { $initial_referrer: 'https://chatgpt.com/c/abc?x=1', $initial_current_url: 'https://www.cartoonova.com/fr?gclid=1' },
});

test('the envelope survives: timestamp stays a Date, uuid and event unchanged', () => {
  const out = filtrerAvantEnvoi(evenement());
  assert.ok(out, 'a consented visitor event must not be dropped');
  assert.ok(out.timestamp instanceof Date, `timestamp became ${JSON.stringify(out.timestamp)}`);
  assert.equal(out.timestamp.toISOString(), '2026-10-31T12:00:00.000Z');
  assert.equal(out.uuid, '0199b7c4-synthetic');
  assert.equal(out.event, '$pageview');
  assert.equal(out.properties.token, 'phc_synthetic_project_key');
  assert.equal(out.properties.distinct_id, '0199b7c4-anon');
});

test('page and referrer keep origin and path, never the query, a private segment or an email', () => {
  const out = filtrerAvantEnvoi(evenement());
  assert.equal(out.properties.$current_url, 'https://www.cartoonova.com/fr/suivi/[prive]');
  assert.equal(out.properties.$referrer, 'https://www.google.com/search');
  assert.equal(out.$set_once.$initial_referrer, 'https://chatgpt.com/c/abc');
  assert.equal(out.$set_once.$initial_current_url, 'https://www.cartoonova.com/fr');
  assert.equal(out.properties.$pathname, '/fr/suivi/[prive]');
});

test('payload privacy still holds', () => {
  const out = filtrerAvantEnvoi(evenement());
  const json = JSON.stringify(out);
  assert.ok(!('email' in out.properties), 'email key must be removed');
  assert.ok(!json.includes('synthetic.example'), 'no email may survive anywhere');
  assert.ok(!json.includes('abc123secret'), 'no private access segment may survive');
  assert.ok(!json.includes('?'), 'no query string may survive');
});

test('the serialized event is what PostHog expects (ISO timestamp string)', () => {
  const sent = JSON.parse(JSON.stringify(filtrerAvantEnvoi(evenement())));
  assert.equal(typeof sent.timestamp, 'string');
  assert.match(sent.timestamp, /^2026-10-31T12:00:00/);
});

test('a stored refusal still sends nothing', () => {
  store.set('cartoonova_consent_v1', 'denied');
  try {
    assert.equal(filtrerAvantEnvoi(evenement()), null);
  } finally {
    store.clear();
  }
});

test('automated browsers still send nothing', () => {
  Object.defineProperty(globalThis, 'navigator', { value: { webdriver: true, userAgent: 'Mozilla/5.0' }, configurable: true });
  try {
    assert.equal(filtrerAvantEnvoi(evenement()), null);
  } finally {
    Object.defineProperty(globalThis, 'navigator', { value: { webdriver: false, userAgent: 'Mozilla/5.0 Chrome/141' }, configurable: true });
  }
});
