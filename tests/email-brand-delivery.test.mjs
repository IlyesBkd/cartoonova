import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const safe = new Set(['email-i18n', 'deliveryCopy', 'emailTemplate', 'livraisonCadeau', 'bonCadeauMontants', 'i18n/relances']);
function load(file, replacements, cache = new Map()) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const m = new Module(file); m.filename = file; cache.set(file, m);
  const original = createRequire(file);
  m.require = name => {
    const normalized = name.startsWith('.') ? '@/' + path.relative(root, path.resolve(path.dirname(file), name)) : name;
    if (normalized in replacements) return replacements[normalized];
    if (normalized.startsWith('@/lib/') && safe.has(normalized.slice(6))) return load(normalized.slice(2) + '.ts', replacements, cache);
    if (name === 'crypto' || name === 'node:crypto') return original(name);
    throw new Error('Unexpected dependency (no network or DB permitted): ' + name);
  };
  m._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
  return m.exports;
}
const noop = async () => {};
const base = {
  '@/lib/confidentialiteMesure': { diagnosticJournal: () => 'isolated' },
  '@/lib/site': { SITE_URL: 'https://cartoonova.test' },
  '@/lib/expediteur': { EXPEDITEUR: 'Cartoonova <hello@cartoonova.test>', SUPPORT_EMAIL: 'support@cartoonova.test' },
  '@/lib/emailToken': { orderTrackingToken: id => 'signed-' + id, bonToken: code => 'signed-' + code },
  '@/lib/analyticsServeur': { mesureServeur: noop, personneServeur: noop },
  '@/lib/evenementsMesure': { MESURES: {} },
  '@/lib/discord': { alerteDiscord: noop },
  '@/lib/currency': { toEUR: n => n, currencies: ['EUR'] },
  '@/lib/consigneClient': { lireConsigne: () => ({ texte: '' }), pourDiscord: x => x },
  '@/lib/occasions': { estOccasion: () => false },
  '@/lib/conversionsChatgpt': { envoyerConversionChatgpt: noop },
  '@/lib/orderPhotos': { attendDesPhotos: photos => !photos.length },
  '@/lib/utmEmail': { lienEmail: (url, campaign) => url + '?utm_campaign=' + campaign },
  '@/lib/parrainage': { recompenserParrain: noop, infosParrainage: async () => ({ code: '<code&>', recompense: '<reward&>' }) },
};
const order = { id: 'order123456', customer_email: 'buyer@cartoonova.test', customer_name: '<img src=x onerror=alert(1)>', detected_country: null, paid_at: '2026-01-01', total_price: 120, currency: 'EUR', photo_urls: [], final_image_url: 'https://images.cartoonova.test/final.png?x=1&y=2', options: { format: 'portrait', people: 2, animals: 1, printOption: '<option&>', banner: true, extraDecor: true, express: true, carteVoeux: true, calendrier: true, shippingAmount: 5 } };
function brand(html) {
  assert.doesNotMatch(html, /border:\s*[234]px\s+(?:solid|dashed)\s+#000|box-shadow:\s*[468]px/i);
  assert.match(html, /<table\b/i);
}
function visible(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&(?:amp|lt|gt|quot|apos|#39|#x27|nbsp);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ' })[entity]).replace(/\s+/g, ' ').trim();
}
function containsText(html, text) { assert.ok(visible(html).includes(visible(text)), `Missing translated text: ${text}`); }
const i18n = load('lib/email-i18n.ts', base);

test('confirmation: common brand, all translations, signed CTAs and immutable outbox envelope', async () => {
  for (const langue of i18n.LANGS) {
    let payload; const drains = [];
    const { finaliserCommande } = load('lib/finaliserCommande.ts', { ...base, '@/lib/emailOutbox': { payerAvecConfirmation: async (id, p) => { assert.equal(id, order.id); payload = p; return false; }, drainerEmails: async (...args) => drains.push(args) } });
    assert.equal(await finaliserCommande({ ...order, langue }, 'webhook'), false);
    assert.deepEqual(drains, [[`order:${order.id}`, 1]]);
    assert.deepEqual(payload.to, [order.customer_email]); assert.equal(payload.subject, i18n.confirmationEmail[langue].subject);
    brand(payload.html); assert.match(payload.html, /&lt;option&amp;&gt;/); assert.doesNotMatch(payload.html, /<option&>/);
    for (const route of ['depot', 'suivi']) assert.ok(payload.html.includes(`https://cartoonova.test/${route}/signed-${order.id}`));
    const t = i18n.confirmationEmail[langue]; const oc = i18n.optionsCommande[langue];
    for (const text of [t.title, t.orderConfirmed(order.id.slice(0, 8)), t.summary, t.artistsWorking, oc.deliveryExpress, oc.banner, oc.extraDecor, oc.express, oc.carteVoeux, oc.calendrier, oc.shipping, t.total, t.trackOrder, t.thanks, t.team, i18n.depotPhotosPage[langue].emailRappel, i18n.depotPhotosPage[langue].submit]) containsText(payload.html, text);
  }
});

function finalHarness(saved, { duplicate = false, mutate = false } = {}) {
  const sent = [], schedules = [], outbound = []; let reads = 0, tokens = 0, referrals = 0;
  class DeliveryError extends Error {}
  class ImageError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const replacements = { ...base,
    '@/lib/db': { getOrderById: async () => (++reads > 1 && mutate ? { ...saved, customer_email: 'changed@cartoonova.test' } : saved), setOrderLastOutboundMessageId: async (...x) => outbound.push(x), programmerEnvoiImageFinale: async (...x) => schedules.push(x) },
    '@/lib/emailToken': { orderTrackingToken: id => { tokens++; return 'signed-' + id; } },
    '@/lib/parrainage': { infosParrainage: async () => { referrals++; return { code: '<code&>', recompense: '<reward&>' }; } },
    '@/lib/finalImage': { validateFinalImageUrl: () => {}, downloadFinalImage: async () => ({ bytes: Buffer.from('local image') }), FinalImageError: ImageError },
    '@/lib/orderDelivery': { OrderDeliveryError: DeliveryError, deliveryContentHash: () => 'hash', executeDelivery: async (o, kind, hash, recipient, send) => { assert.equal(kind, 'final_image'); assert.equal(hash, 'hash'); if (!duplicate) await send({ send: fn => fn('durable-key') }); return { emailId: 'mail-id', duplicate }; } },
    '@/lib/envoiEmail': { envoyerEmail: async (payload, options) => { sent.push({ payload, options }); return { id: 'mail-id' }; } },
  };
  return { ...load('lib/emailImageFinale.ts', replacements), sent, schedules, outbound, counts: () => ({ tokens, referrals }) };
}
test('final image: localized common brand preserves download, review, bonus, referral and delivery key', async () => {
  for (const langue of i18n.LANGS) {
    const saved = { ...order, langue }; const h = finalHarness(saved);
    assert.deepEqual(await h.envoyerImageFinale(saved), { id: 'mail-id' });
    const { payload, options } = h.sent[0]; brand(payload.html);
    assert.equal(payload.subject, i18n.finalImageEmail[langue].subject); assert.deepEqual(options, { idempotencyKey: 'durable-key' });
    assert.ok(payload.html.includes('final.png?x=1&amp;y=2'));
    assert.ok(payload.html.includes(`/bonus/signed-${order.id}`)); assert.ok(payload.html.includes(`/${langue}/avis/nouveau?c=signed-${order.id}`));
    assert.match(payload.html, /&lt;img src=x onerror=alert\(1\)&gt;/); assert.match(payload.html, /&lt;code&amp;&gt;/); assert.match(payload.html, /&lt;reward&amp;&gt;/);
    assert.doesNotMatch(payload.html, /<img src=x/); assert.deepEqual(h.outbound, [[order.id, 'mail-id']]);
    const t = i18n.finalImageEmail[langue];
    for (const text of [t.title, t.ready(order.id.slice(0, 8)), t.question, t.download, t.feedback, t.thanks, t.team, i18n.bonusLiens[langue].email, i18n.avisLiens[langue].texte, i18n.avisLiens[langue].bouton]) containsText(payload.html, text);
    assert.match(payload.html, /<strong>#order123<\/strong>/);
  }
});
test('final image: third-party gifts exclude buyer identity, signed buyer links and referral', async () => {
  const saved = { ...order, langue: 'fr', options: { gift: { recipientEmail: 'friend@cartoonova.test', message: '<script>gift</script>\nMerci & oui' } } };
  const h = finalHarness(saved); await h.envoyerImageFinale(saved);
  const { payload } = h.sent[0]; brand(payload.html); assert.deepEqual(payload.to, ['friend@cartoonova.test']);
  assert.match(payload.html, /&lt;script&gt;gift&lt;\/script&gt;/); assert.doesNotMatch(payload.html, /<script>|signed-|\/bonus\/|avis\/nouveau|onerror/);
  assert.deepEqual(h.counts(), { tokens: 0, referrals: 0 });
});
test('final image: deferred, stale, unpaid, invalid and duplicate deliveries retain guards', async () => {
  const deferred = { ...order, options: { gift: { deliverAfter: '2099-12-01' } } }; const d = finalHarness(deferred);
  assert.deepEqual(await d.envoyerImageFinale(deferred), { id: null, deferredUntil: '2099-12-01T09:00:00.000Z' }); assert.equal(d.sent.length, 0); assert.equal(d.schedules.length, 1);
  for (const saved of [{ ...order, paid_at: null }, { ...order, options: { gift: { recipientEmail: 'invalid' } } }]) {
    const h = finalHarness(saved); await assert.rejects(h.envoyerImageFinale(saved)); assert.equal(h.sent.length, 0);
  }
  const stale = finalHarness(order, { mutate: true }); await assert.rejects(stale.envoyerImageFinale(order), /changé/); assert.equal(stale.sent.length, 0);
  const dup = finalHarness(order, { duplicate: true }); await dup.envoyerImageFinale(order); assert.equal(dup.sent.length, 0);
});

test('gift voucher: purchased/offered localized payloads keep code, signature, validity and atomic queue', async () => {
  for (const lang of i18n.LANGS) for (const offered of [false, true]) {
    let payload; let query; let params;
    const { finaliserBonCadeau, creerBonOffert } = load('lib/bonCadeau.ts', { ...base,
      '@/lib/db': { sql: async (strings, ...values) => { query = strings.join('?'); params = values; payload = JSON.parse(values.find(v => typeof v === 'string' && v.startsWith('{'))); return [{ code: values[0] }]; } },
      '@/lib/emailOutbox': { drainerEmails: noop },
    });
    const bon = offered ? await creerBonOffert({ email: 'buyer@cartoonova.test', montant: 50, devise: 'EUR', raison: 'local', lang, cle: 'local-gift', textes: () => ({ sujet: 'Offert', titre: '<admin&>', intro: '<intro&>' }) }) : await finaliserBonCadeau({ id: 'pi_local', currency: 'eur', amount: 5000, metadata: { lang, email: 'buyer@cartoonova.test', prenom: '<name>', message: '<message>' } });
    brand(payload.html); assert.ok(payload.html.includes(bon.code)); assert.ok(payload.html.includes(`/bon/signed-${bon.code}`));
    assert.deepEqual(payload.to, ['buyer@cartoonova.test']); assert.match(query, /WITH created AS/); assert.match(query, /INSERT INTO email_outbox/); assert.ok(params.includes(offered ? 'gift:local-gift' : 'gift:pi_local'));
    if (offered) { assert.equal(payload.subject, 'Offert'); assert.match(payload.html, /&lt;admin&amp;&gt;/); assert.match(payload.html, /&lt;intro&amp;&gt;/); }
    else {
      const t = i18n.bonCadeauTextes[lang]; assert.equal(payload.subject, t.emailSujet);
      for (const text of [t.emailTitre, t.emailIntro(new Intl.NumberFormat(lang, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(50)), t.code, t.modeEmploi, t.imprimer, t.validite(new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(bon.expireLe))), t.equipe]) containsText(payload.html, text);
      assert.match(payload.html, /<strong>/);
    }
  }
});
