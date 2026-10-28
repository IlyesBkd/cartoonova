import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const routes = ['confirm-poster', 'review-request', 'expedition', 'send-poster-confirmation', 'extras'];
const allowed = new Set(['lib/email-i18n.ts', 'lib/deliveryCopy.ts', 'lib/i18n/serveur.ts', 'lib/emailTemplate.ts']);
function load(relative, mocks = {}, cache = new Map()) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const m = new Module(file); m.filename = file; cache.set(file, m);
  m.require = name => {
    if (name in mocks) return mocks[name];
    if (name === 'crypto') return { randomBytes: () => Buffer.alloc(24, 7) };
    if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? name.slice(2) + '.ts' : path.relative(root, path.resolve(path.dirname(file), name + '.ts'));
      const alias = '@/' + target.slice(0, -3);
      if (alias in mocks) return mocks[alias];
      assert.ok(allowed.has(target), `Unmocked dependency forbidden: ${name}`);
      return load(target, mocks, cache);
    }
    throw new Error(`External dependency forbidden: ${name}`);
  };
  m._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
  return m.exports;
}
const copy = load('lib/email-i18n.ts');
const revisions = load('lib/i18n/serveur.ts').accuseRetoucheEmail;
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

for (const route of routes) test(`${route}: legacy frame removed, shared layout and blocks required`, () => {
  const source = readFileSync(path.join(root, `app/api/orders/${route}/route.ts`), 'utf8');
  assert.match(source, /emailLayout\(/);
  assert.doesNotMatch(source, /#fef3c7|box-shadow|border: [234]px solid #000/);
});

for (const lang of copy.LANGS) for (const route of routes) test(`${route}/${lang}: renders safely without sending, preserving envelope and delivery data`, async () => {
  const sent = [], effects = [];
  const order = { id: 'abcdefgh-1234', customer_email: 'client@example.test', customer_name: '<img src=x onerror=attack> & Name', final_image_url: 'https://images.example.test/final.png?a=1&b=2', options: { carteVoeux: true, calendrier: true }, currency: 'EUR', poster_confirmation_note: '<script>attack</script>\nsecond line', poster_confirmation_photos: ['https://images.example.test/photo.png?a=1&b=2'], suivi_url: 'https://tracking.example.test/?a=1&b=2', suivi_transporteur: '<svg onload=attack>' };
  const fichiers = [ { cle: 'carteVoeux', libelle: copy.optionsCommande[lang].extrasCarte, url: 'https://files.example.test/card.pdf?a=1&b=2' }, { cle: 'calendrier', libelle: copy.optionsCommande[lang].extrasCalendrier, url: 'https://files.example.test/calendar.pdf' } ];
  class ShippingError extends Error {}
  class FinalImageError extends Error {}
  class OrderDeliveryError extends Error {}
  class ClientActionError extends Error {}
  const mocks = {
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } },
    '@/lib/email-i18n': { ...copy, langueCommande: () => lang },
    '@/lib/adminAuth': { refuserSiPasAdmin: async () => null },
    '@/lib/confidentialiteMesure': { diagnosticJournal: x => x },
    '@/lib/expediteur': { EXPEDITEUR: 'Cartoonova <from@example.test>', SUPPORT_EMAIL: 'support@example.test' },
    '@/lib/site': { SITE_URL: 'https://cartoonova.example.test' },
    '@/lib/envoiEmail': { envoyerEmail: async (...args) => { sent.push(args); return { data: { id: 'email-local' } }; } },
    '@/lib/db': { getOrderById: async () => order, getOrderByConfirmationToken: async () => order, recordPosterConfirmationResponse: async () => ({ order, changed: true }), setPosterConfirmationToken: async (...args) => { effects.push(['token', ...args]); return true; }, recordPosterConfirmationMessage: async (...args) => effects.push(['poster', ...args]), setOrderLastOutboundMessageId: async (...args) => effects.push(['outbound', ...args]), markReviewRequestSent: async (...args) => effects.push(['review', ...args]) },
    '@/lib/recompenseAvis': { recompenseAvisFormatee: () => '10 €' },
    '@/lib/emailToken': { orderTrackingToken: id => `signed-${id}` },
    '@/lib/reviewsDb': { avisExistePourCommande: async () => false },
    '@/lib/finalImage': { FinalImageError, downloadFinalImage: async () => ({ bytes: Buffer.from('local image'), contentType: 'image/png' }) },
    '@/lib/orderDeliveryShipping': { ShippingError, patchShipping: async () => {}, notifyShipping: async (id, data, send) => { effects.push(['shipping', id, data]); await send(order); return order; } },
    '@/lib/orderDelivery': { OrderDeliveryError, deliveryContentHash: () => 'local-hash', executeDelivery: async (o, kind, hash, recipient, callback) => { effects.push(['delivery', kind, hash, recipient]); await callback({ artifacts: { fichiers }, checkpoint: async () => assert.fail('Existing artifacts must be reused'), send: fn => fn('local-idempotency-key') }); return { artifacts: { fichiers }, emailId: 'email-local', duplicate: false }; } },
    '@vercel/blob': { put: async () => assert.fail('No upload allowed') },
    '@/lib/extras/carteVoeux': { genererCarteVoeux: async () => assert.fail('No generation on replay') },
    '@/lib/extras/calendrier': { genererCalendrier: async () => assert.fail('No generation on replay') },
    '@/lib/clientActionError': { ClientActionError },
    '@/lib/retouchePolicy': { MAX_RETOUCHE_NOTE: 5000, validRetoucheNote: () => true },
    '@/lib/clientOrderPolicy': { canRespondToPreview: () => true },
    '@/lib/photoOwnership': { validatePhotoOwnership: async () => null },
    '@/lib/orderPhotos': { parsePhotoUrls: () => [], photosInvalides: () => false },
    '@/lib/supportCommande': { libelleSupportCourt: () => 'Poster' },
    '@/lib/retouches': { nombreRetouches: async () => 1 },
    '@/lib/alerteServeur': { signalerPanne: async () => assert.fail('Unexpected server error') },
  };
  // Block all accidental network access, even if a future dependency bypasses the loader.
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('Network forbidden in local email rendering tests');
  const previousWebhook = process.env.DISCORD_WEBHOOK_URL;
  delete process.env.DISCORD_WEBHOOK_URL;
  try {
    const handler = load(`app/api/orders/${route}/route.ts`, mocks);
    const result = await handler.POST({ url: 'https://cartoonova.example.test/api/orders/local', json: async () => ({ orderId: order.id, customerEmail: order.customer_email, finalImageUrl: order.final_image_url, token: 'existing-token', action: 'changes', note: order.poster_confirmation_note, suiviUrl: order.suivi_url }) });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(sent.length, 1);
    const [email, deliveryOptions] = sent[0];
    assert.deepEqual(email.to, [order.customer_email]);
    assert.equal(email.from, mocks['@/lib/expediteur'].EXPEDITEUR);
    assert.equal(email.replyTo, mocks['@/lib/expediteur'].SUPPORT_EMAIL);
    const t = route === 'confirm-poster' ? revisions[lang] : route === 'extras' ? copy.optionsCommande[lang] : copy[{ 'review-request': 'reviewRequestEmail', expedition: 'shippingEmail', 'send-poster-confirmation': 'posterConfirmationEmail' }[route]][lang];
    assert.equal(email.subject, route === 'confirm-poster' ? t.subject(order.id.slice(0, 8)) : route === 'extras' ? t.extrasSujet : t.subject);
    assert.match(email.html, /<!doctype html>/i);
    assert.match(email.html, new RegExp(`<html[^>]*lang="${lang}"`));
    assert.equal((email.html.match(/<h1\b/g) ?? []).length, 1);
    assert.ok(email.html.includes(escape(route === 'extras' ? t.extrasTitre : t.title)));
    for (const text of route === 'extras' ? [t.extrasIntro, t.extrasConseil] : [t.thanks, t.team]) {
      assert.ok(email.html.includes(escape(text)), `Missing preserved copy: ${text}`);
    }
    assert.doesNotMatch(email.html, /<script>|<svg onload=attack>|<img src=x onerror=attack>/);
    if (route !== 'extras') assert.ok(email.html.includes('&lt;img src=x onerror=attack&gt; &amp; Name'));
    if (route === 'confirm-poster') {
      assert.match(email.html, /&lt;script&gt;attack&lt;\/script&gt;<br\s*\/?>second line/);
      assert.ok(email.html.includes(escape(order.poster_confirmation_photos[0])));
      assert.deepEqual(effects.find(e => e[0] === 'outbound'), ['outbound', order.id, 'email-local']);
    }
    if (route === 'review-request') {
      assert.ok(email.html.includes(`/${lang}/avis/nouveau?c=signed-${order.id}`));
      assert.deepEqual(effects.find(e => e[0] === 'review'), ['review', order.id]);
    }
    if (route === 'expedition') {
      assert.ok(email.html.includes('&lt;svg onload=attack&gt;'));
      assert.ok(email.html.split(escape(order.suivi_url)).length >= 3, 'Tracking button and fallback URL');
      assert.equal(effects.find(e => e[0] === 'shipping')[1], order.id);
    }
    if (route === 'send-poster-confirmation') {
      assert.ok(email.html.indexOf(escape(t.modification)) < email.html.indexOf(escape(t.reassurance)), 'Revision option stays before the printing reassurance');
      const token = Buffer.alloc(24, 7).toString('hex');
      assert.ok(email.html.includes(`/confirm-poster/${token}`));
      assert.ok(email.html.includes(escape(order.final_image_url)));
      assert.deepEqual(email.attachments, [{ filename: 'cartoonova-abcdefgh.png', content: Buffer.from('local image').toString('base64'), contentType: 'image/png' }]);
      assert.deepEqual(effects.find(e => e[0] === 'poster'), ['poster', order.id, token, 'email-local']);
    }
    if (route === 'extras') {
      assert.deepEqual(deliveryOptions, { idempotencyKey: 'local-idempotency-key' });
      for (const file of fichiers) assert.ok(email.html.includes(escape(file.url)));
      assert.deepEqual(effects.find(e => e[0] === 'delivery'), ['delivery', 'extras', 'local-hash', order.customer_email]);
      assert.deepEqual(result.body.fichiers, fichiers);
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWebhook === undefined) delete process.env.DISCORD_WEBHOOK_URL; else process.env.DISCORD_WEBHOOK_URL = previousWebhook;
  }
});
