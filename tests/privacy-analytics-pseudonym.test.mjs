import test from 'node:test';
import assert from 'node:assert/strict';

// The success page identifies the browser session with the pseudonym the server
// measures purchases under, so PostHog links the visit to the order. It must be
// stable for one address, never reveal the email, and stay off without a secret.

const load = async () => import(`../lib/analyticsServeur.ts?${Math.random()}`);

test('pseudonym is stable per address, case and spacing included', async () => {
  process.env.NEWSLETTER_SECRET = 'synthetic-secret-for-tests';
  const { pseudonymeMesure } = await load();
  const a = pseudonymeMesure('Buyer@Synthetic.example');
  assert.match(a, /^person_[a-f0-9]{64}$/);
  assert.equal(pseudonymeMesure('  buyer@synthetic.example '), a);
  assert.notEqual(pseudonymeMesure('other@synthetic.example'), a);
});

test('pseudonym never contains the email', async () => {
  process.env.NEWSLETTER_SECRET = 'synthetic-secret-for-tests';
  const { pseudonymeMesure } = await load();
  const p = pseudonymeMesure('buyer@synthetic.example');
  assert.ok(!p.includes('buyer') && !p.includes('@'));
});

test('no secret configured: no pseudonym rather than a random id', async () => {
  for (const k of ['NEWSLETTER_SECRET', 'CRON_SECRET', 'STRIPE_SECRET_KEY']) delete process.env[k];
  const { pseudonymeMesure } = await load();
  assert.equal(pseudonymeMesure('buyer@synthetic.example'), null);
});

test('the browser identifier accepts exactly this shape', async () => {
  // Mirrors the guard in lib/analytics.ts `identifier`: pseudonyms pass, emails do not.
  const guard = /^(?:person_[a-f0-9]{64}|order_[a-zA-Z0-9_-]+)$/;
  process.env.NEWSLETTER_SECRET = 'synthetic-secret-for-tests';
  const { pseudonymeMesure } = await load();
  assert.ok(guard.test(pseudonymeMesure('buyer@synthetic.example')));
  assert.ok(!guard.test('buyer@synthetic.example'));
});
