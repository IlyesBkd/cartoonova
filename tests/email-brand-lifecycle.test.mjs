import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const source = (path) => readFileSync(resolve(root, path), 'utf8');

// No production module loader: only explicitly allowed pure local modules run.
// Every transport, database, analytics and Stripe dependency is isolated here.
function harness({ failSend = false, paid = false } = {}) {
  const emails = [], events = [], marks = [], calls = [];
  const order = { id: 'abc12345-order', customer_email: 'test+tag@example.invalid', customer_name: '<img src=x onerror=bad()>', locale: 'fr', langue: 'fr', currency: 'EUR', options: { style: 'simpson', printKey: 'digital' }, payment_intent_id: 'pi_local', created_at: new Date(Date.now() - 30 * 3600000).toISOString() };
  const db = new Proxy({
    runtimeSchemaBootstrapEnabled: false,
    sql: async (strings) => strings.join('').includes('SELECT') ? [order] : [],
    getPricesForCurrency: async () => ({posterSimple: 42}),
    getSubscribersDueForWelcome: async (step, delay) => { calls.push(['getSubscribersDueForWelcome', step, delay]); return [{email: order.customer_email, locale: order.locale}]; },
  }, { get(target, key) {
    if (key in target) return target[key];
    if (String(key).startsWith('get')) return async (...args) => { calls.push([key, ...args]); return [order]; };
    return async (...args) => { marks.push([key, ...args]); };
  }});
  const mocks = {
    db,
    envoiEmail: { envoyerEmail: async (email) => { if (failSend) throw new Error('isolated transport failure'); emails.push(email); } },
    analyticsServeur: { mesureServeur: async (...args) => { events.push(args); } },
    emailToken: { signEmail: () => 'signed-local', orderTrackingToken: () => 'tracking-local' },
    site: { SITE_URL: 'https://cartoonova.test' },
    expediteur: { EXPEDITEUR: 'Cartoonova <local@example.invalid>', SUPPORT_EMAIL: 'support@example.invalid' },
    confidentialiteMesure: { diagnosticJournal: String, bilanJournal: (x) => x },
    leadsCaisse: { getLeadsARelancer: async () => [{ ...order, email: order.customer_email, style: 'simpson' }], marquerLeadRelance: async (...args) => marks.push(['lead', ...args]) },
    supportCommande: { estNumerique: () => true, tailleImpression: () => 'A3' },
    bonCadeauMontants: { deviseValide: () => 'EUR' },
    emailImageFinale: { envoyerImageFinale: async () => ({}) },
    finaliserCommande: { finaliserCommande: async () => true },
    discord: { alerteDiscord: async () => {}, COULEUR_ATTENTION: 0 },
    alerteServeur: { signalerPanne: async () => {} },
    emailOutbox: { drainerEmails: async () => 0 },
    recompenseAvis: { recompenseAvisFormatee: () => '10 €' },
  };
  const cache = new Map();
  function load(path) {
    path = resolve(root, path);
    if (cache.has(path)) return cache.get(path).exports;
    const loaded = {exports: {}}; cache.set(path, loaded);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText;
    const require = (id) => {
      if (id === 'next/server') return { NextResponse: { json: (value, options) => ({ value, status: options?.status ?? 200 }) } };
      if (id === 'stripe') return class { paymentIntents = { retrieve: async () => ({status: paid ? 'succeeded' : 'requires_payment_method'}) }; };
      const key = id.split('/').at(-1);
      if (Object.hasOwn(mocks, key)) return mocks[key];
      const allowed = ['email-i18n', 'deliveryCopy', 'relances', 'utmEmail', 'evenementsMesure', 'welcomeSequence', 'emailTemplate'];
      assert.ok(allowed.includes(key), `Unexpected dependency blocked: ${id}`);
      return load(id.startsWith('@/') ? `${id.slice(2)}.ts` : resolve(dirname(path), `${id}.ts`));
    };
    vm.runInNewContext(`(function(require,module,exports,process,console){${code}\n})`, { URL, Date, Map, Set })(require, loaded, loaded.exports, {env: {CRON_SECRET: 'local-only'}}, {log() {}, warn() {}, error() {}});
    return loaded.exports;
  }
  return {load, emails, marks, calls, events, order};
}

test('lifecycle and welcome use the common layout without legacy frames or duplicate titles', () => {
  for (const file of ['app/api/cron/lifecycle-emails/route.ts', 'lib/welcomeSequence.ts']) {
    const text = source(file);
    assert.match(text, /from "@\/lib\/emailTemplate"/);
    assert.doesNotMatch(text, /function shell\(|function button\(|<h1|#fef3c7|box-shadow: 8px|border: [34]px solid #000/);
  }
});

test('all welcome steps and languages retain copy, tracked links, unsubscribe and send-before-mark ordering', async () => {
  const h = harness();
  const {LANGS, welcomeSequence} = h.load('lib/email-i18n.ts');
  const welcome = h.load('lib/welcomeSequence.ts');
  assert.deepEqual({...welcome.WELCOME_DELAYS_DAYS}, {2: 3, 3: 8});
  assert.equal(welcome.langFromLocale('unknown'), 'fr');
  for (const lang of LANGS) for (const step of [1, 2, 3]) {
    await welcome.sendWelcomeStep({email: h.order.customer_email, locale: lang}, step);
    const email = h.emails.at(-1), content = welcomeSequence[lang][step - 1];
    assert.equal(email.subject, content.subject);
    assert.equal((email.html.match(/<h1\b/g) || []).length, 1);
    assert.ok(email.html.includes(`lang="${lang}"`));
    for (const paragraph of content.paragraphs) assert.ok(email.html.includes(paragraph), `${lang}/${step} copy preserved`);
    assert.match(email.html, /utm_campaign=bienvenue/);
    assert.ok(email.html.includes(`/${lang}${content.ctaPath}`));
    assert.ok(email.html.includes('signed-local'));
    assert.ok(email.headers['List-Unsubscribe'].includes('email=test%2Btag%40example.invalid&t=signed-local&lang=' + lang));
    assert.equal(email.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.equal(h.marks.at(-1)[0], 'markWelcomeStepSent');
    assert.equal(h.marks.at(-1)[2], step);
  }
  assert.equal(h.emails.length, 30);
});

test('welcome transport failure never advances the welcome step or analytics', async () => {
  const h = harness({failSend: true});
  await assert.rejects(h.load('lib/welcomeSequence.ts').sendWelcomeStep({email: h.order.customer_email, locale: 'fr'}, 1), /isolated transport failure/);
  assert.equal(h.marks.length, 0);
  assert.equal(h.events.length, 0);
});

test('paid pending orders are still excluded from abandoned-cart messages', async () => {
  const h = harness({paid: true});
  const result = await h.load('app/api/cron/lifecycle-emails/route.ts').GET({headers: {get: () => 'Bearer local-only'}});
  assert.equal(result.status, 200);
  assert.ok(!h.emails.some(email => email.html.includes('utm_campaign=panier_abandonne')));
  assert.equal(result.value.abandoned.payeesNonEnregistrees, 1);
  assert.ok(h.marks.some(mark => mark[0] === 'markAbandonedEmailSent'));
});

test('upsell price preserves trusted bold copy and readable text in every language', async () => {
  const languages = harness().load('lib/email-i18n.ts').LANGS;
  for (const lang of languages) {
    const h = harness();
    Object.assign(h.order, {locale: lang, langue: lang});
    const {upsellPosterEmail, formatPrix} = h.load('lib/i18n/relances.ts');
    const {emailText, escapeEmailHtml} = h.load('lib/emailTemplate.ts');
    await h.load('app/api/cron/lifecycle-emails/route.ts').GET({headers: {get: () => 'Bearer local-only'}});
    const email = h.emails.find(email => email.html.includes('utm_campaign=upsell_poster'));
    assert.ok(email, lang);
    const price = formatPrix(42, 'EUR', lang);
    assert.ok(email.html.includes(upsellPosterEmail[lang].price(escapeEmailHtml(price))), `${lang}: trusted price HTML retained`);
    assert.doesNotMatch(email.html, /&lt;\/?strong&gt;/);
    assert.ok(emailText(email.html).includes(price), lang);
    assert.doesNotMatch(emailText(email.html), /<\/?strong>/);
  }
});

test('cron renders every lifecycle email locally with tokens, UTM, optout, delays and escaped names', async () => {
  const h = harness();
  const route = h.load('app/api/cron/lifecycle-emails/route.ts');
  assert.equal((await route.GET({headers: {get: () => 'bad'}})).status, 401);
  assert.equal(h.emails.length, 0);
  const result = await route.GET({headers: {get: () => 'Bearer local-only'}});
  assert.equal(result.status, 200);
  assert.equal(h.emails.length, 9);
  for (const email of h.emails) {
    assert.equal((email.html.match(/<h1\b/g) || []).length, 1);
    assert.doesNotMatch(email.html, /<img src=x onerror=bad\(\)>/);
    assert.doesNotMatch(email.html, /#fef3c7|border: [34]px solid #000/);
    assert.equal(email.replyTo, 'support@example.invalid');
    if (email.headers) {
      assert.equal(email.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
      assert.ok(email.html.includes('signed-local'));
    }
  }
  for (const campaign of ['demande_avis', 'relance_avis', 'rachat', 'panier_abandonne', 'relance_caisse', 'upsell_poster', 'rappel_photos']) {
    assert.ok(h.emails.some(email => email.html.includes(`utm_campaign=${campaign}`)), campaign);
  }
  assert.ok(h.emails.some(email => email.html.includes('/depot/tracking-local')));
  assert.ok(h.emails.some(email => email.html.includes('/avis/nouveau?c=tracking-local')));
  for (const [name, delay] of [['getOrdersDueForReviewRequest',10], ['getOrdersDueForReviewReminder',10], ['getOrdersDueForReorderEmail',90], ['getOrdersDueForAbandonedEmail',4], ['getOrdersAwaitingPhotos',24]]) {
    assert.ok(h.calls.some(call => call[0] === name && call[1] === delay), name);
  }
});
