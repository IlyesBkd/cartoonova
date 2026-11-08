import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { load } from './upload-harness.mjs';

// All database/provider/email boundaries are isolated. No real sends or uploads.
const id = '11111111-1111-4111-8111-111111111111';
const fileId = '22222222-2222-4222-8222-222222222222';
const reference = `vps://private/final/${id}/${fileId}.png`;
const legacy = 'https://fixture.public.blob.vercel-storage.com/final/old.png';
const originalEnv = { ...process.env };
after(() => { process.env = originalEnv; });
process.env.STORAGE_HMAC_SECRET = 'isolated-fixture-secret-not-used-outside-tests';
const core = load('lib/storageCore.ts');
const storage = load('lib/storage.ts', { '@/lib/db': {} });
const display = load('lib/storageDisplay.ts');
const response = value => Response.json(value);
const request = (body, path = '/api/orders/extras') => new Request(`https://fixture.invalid${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

function assertRestrictedUrl(url, ref) {
  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://www.cartoonova.com');
  assert.equal(parsed.pathname, '/api/storage/email');
  assert.deepEqual([...parsed.searchParams.keys()].sort(), ['ref', 'signature']);
  assert.equal(parsed.searchParams.get('ref'), ref);
  assert.equal(core.verifyEmailCapability(ref, parsed.searchParams.get('signature')), true);
  assert.equal(core.verifyEmailCapability(ref.replace(id, '44444444-4444-4444-8444-444444444444'), parsed.searchParams.get('signature')), false);
}

test('display URLs preserve legacy values and keep capabilities in same-origin read queries', () => {
  for (const url of [legacy, '/local.jpg', 'blob:https://fixture.invalid/uuid']) assert.equal(display.storageDisplayUrl(url, { token: 'unused' }), url);
  for (const capability of [{}, { token: 'tracking & ?' }, { posterToken: 'preview & ?' }]) {
    const url = new URL(display.storageDisplayUrl(reference, capability), 'https://fixture.invalid');
    assert.equal(url.pathname, '/api/storage/read');
    assert.equal(url.searchParams.get('ref'), reference);
    for (const [key, value] of Object.entries(capability)) assert.equal(url.searchParams.get(key), value);
    assert.deepEqual([...url.searchParams.keys()].sort(), ['ref', ...Object.keys(capability)].sort());
  }
  assert.match(display.storageDisplayUrl('vps://malformed'), /^\/api\/storage\/read\?/);
});

test('client canonical grammar matches server parser including namespace/extension boundaries', () => {
  for (const namespace of ['orders', 'retouches', 'final', 'extras', 'other']) {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf', 'html']) {
      const ref = `vps://private/${namespace}/${id}/${fileId}.${ext}`;
      for (const value of [ref, ref + '?token=a', ref.toUpperCase(), ref + '/extra']) assert.equal(display.isPrivateStorageReference(value), core.isVpsReference(value));
    }
  }
});

test('real email signer preserves legacy and creates immutable file-only URLs', () => {
  assert.equal(storage.storageEmailUrl(legacy), legacy);
  assertRestrictedUrl(storage.storageEmailUrl(reference), reference);
  assert.equal(storage.storageEmailUrl(reference), storage.storageEmailUrl(reference));
  const version = reference.replace(fileId, '33333333-3333-4333-8333-333333333333');
  assertRestrictedUrl(storage.storageEmailUrl(version), version);
  assert.notEqual(storage.storageEmailUrl(reference), storage.storageEmailUrl(version));
});

for (const provider of [undefined, 'vps']) test(`uploader ${provider ?? 'legacy'} preserves ownership pathname and returns canonical persistence reference`, async () => {
  const previousFetch = globalThis.fetch;
  const calls = [], blobs = [];
  const uploader = load('lib/uploadClient.ts', { '@vercel/blob/client': { upload: async (...args) => { blobs.push(args); return { url: legacy }; } } });
  const file = new File(['synthetic pixels'], 'private-customer-name.png', { type: 'image/png' });
  let reservedRef;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/upload/context') return response({ context: 'opaque-context', prefix: `orders/${id}/`, expiresAt: Date.now() + 300_000, ...(provider ? { provider } : {}) });
    if (url === '/api/upload/vps-grant') {
      const body = JSON.parse(options.body);
      assert.match(body.pathname, new RegExp(`^orders/${id}/[0-9a-f-]+\\.png$`));
      assert.equal(body.sha256, createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex'));
      assert.equal(body.size, file.size); assert.equal(body.contentType, file.type); assert.equal(body.context, 'opaque-context');
      assert.doesNotMatch(body.pathname, /customer/);
      reservedRef = `vps://private/${body.pathname}`;
      return response({ url: 'https://storage.fixture.invalid/v1/files/orders/0123456789abcdef0123456789abcdef', grant: 'fixture-grant', reference: reservedRef });
    }
    if (url.startsWith('https://storage.fixture.invalid/')) {
      assert.equal(options.method, 'PUT'); assert.equal(options.body, file);
      assert.equal(options.headers.Authorization, 'Bearer fixture-grant');
      assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
      return response({});
    }
    assert.equal(url, '/api/upload/complete');
    assert.deepEqual(JSON.parse(options.body), { reference: reservedRef, context: 'opaque-context' });
    return response({ ok: true });
  };
  try {
    const result = await uploader.uploadImage(file, { purpose: 'checkout', product: 'simpson' });
    assert.equal(result.url, provider ? reservedRef : legacy);
    assert.equal(blobs.length, provider ? 0 : 1);
    assert.equal(calls.length, provider ? 4 : 1);
    if (!provider) assert.deepEqual(blobs[0][2], { access: 'public', handleUploadUrl: '/api/upload', clientPayload: 'opaque-context' });
  } finally { globalThis.fetch = previousFetch; }
});

for (const failure of ['grant', 'put', 'complete', 'oversize']) test(`private uploader fails closed on ${failure}, without public SDK fallback`, async () => {
  const previousFetch = globalThis.fetch;
  let blobCalls = 0, writes = 0;
  const uploader = load('lib/uploadClient.ts', { '@vercel/blob/client': { upload: async () => { blobCalls++; } } });
  globalThis.fetch = async (url, options) => {
    if (url === '/api/upload/context') return response({ context: 'fixture', prefix: `orders/${id}/`, provider: 'vps', expiresAt: Date.now() + 300_000 });
    if (url === '/api/upload/vps-grant') return failure === 'grant' ? new Response(null, { status: 403 }) : response({ url: 'https://storage.fixture.invalid/v1/files/orders/0123456789abcdef0123456789abcdef', grant: 'fixture-grant', reference: `vps://private/${JSON.parse(options.body).pathname}` });
    writes++;
    if (url === '/api/upload/complete' || failure === 'put') return new Response(null, { status: 502 });
    return response({});
  };
  try {
    const file = new File([failure === 'oversize' ? new Uint8Array(10 * 1024 * 1024 + 1) : 'fixture'], 'fixture.png', { type: 'image/png' });
    await assert.rejects(uploader.uploadImage(file, { purpose: 'poster', token: 'fixture-preview-token' }));
    assert.equal(blobCalls, 0);
    assert.equal(writes, failure === 'complete' ? 2 : failure === 'put' ? 1 : 0);
  } finally { globalThis.fetch = previousFetch; }
});

function emailFixture(ref, { gift = false, retouch = false } = {}) {
  const saved = { id, paid_at: '2026-01-01', final_image_url: ref, final_image_sent_at: retouch ? '2026-01-01' : null, customer_email: 'buyer@example.invalid', customer_name: 'Buyer', langue: 'fr', options: gift ? { gift: { recipientEmail: 'recipient@example.invalid' } } : {} };
  const sends = [], hashes = [];
  const delivery = {
    deliveryContentHash: bytes => createHash('sha256').update(bytes).digest('hex'),
    executeDelivery: async (order, kind, hash, to, run) => {
      assert.equal(order.final_image_url, ref); hashes.push(hash);
      await run({ send: async callback => callback('fixture-idempotency-key') });
      return { emailId: 'fixture-email', duplicate: false };
    }, OrderDeliveryError: class extends Error {},
  };
  const final = { validateFinalImageUrl: () => {}, downloadFinalImage: async value => { assert.equal(value, ref); return { bytes: Buffer.from('isolated immutable image bytes'), contentType: 'image/png' }; }, FinalImageError: class extends Error {} };
  const db = { getOrderById: async () => saved, setOrderLastOutboundMessageId: async () => {}, programmerEnvoiImageFinale: async () => {} };
  const send = { envoyerEmail: async message => { sends.push(message); return { data: { id: 'fixture-email' } }; } };
  const sender = load('lib/emailImageFinale.ts', {
    './db': db, './storage': storage, './finalImage': final, './orderDelivery': delivery,
    './emailToken': { orderTrackingToken: () => 'BUYER-ORDER-TOKEN' }, './analyticsServeur': { mesureServeur: async () => {} },
    './parrainage': { infosParrainage: async () => null }, '@/lib/envoiEmail': send,
  });
  return { saved, sends, hashes, sender, final, db, send, delivery };
}

for (const ref of [legacy, reference]) for (const gift of [false, true]) for (const retouch of [false, true]) test(`final email renders ${ref === legacy ? 'legacy' : 'private'} image+download; gift=${gift}; retouch=${retouch}`, async () => {
  const fixture = emailFixture(ref, { gift, retouch });
  await fixture.sender.envoyerImageFinale(fixture.saved, retouch ? 'retouch' : 'initial');
  assert.equal(fixture.sends.length, 1);
  const message = fixture.sends[0];
  assert.deepEqual(message.to, [gift ? 'recipient@example.invalid' : 'buyer@example.invalid']);
  assert.equal(fixture.saved.final_image_url, ref);
  assert.equal(fixture.hashes[0], createHash('sha256').update('isolated immutable image bytes').digest('hex'));
  const urls = [...message.html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1].replaceAll('&amp;', '&'));
  if (ref === reference) {
    assert.doesNotMatch(message.html, /vps:\/\//);
    const fileUrls = urls.filter(url => url.startsWith('https://www.cartoonova.com/api/storage/email?'));
    // emailImage wraps the image in a download link, plus the explicit button.
    assert.equal(fileUrls.length, 3);
    for (const url of fileUrls) assertRestrictedUrl(url, ref);
  } else assert.equal(urls.filter(url => url === ref).length, 3);
  if (gift) assert.doesNotMatch(message.html, /BUYER-ORDER-TOKEN|\/bonus\/|avis\/nouveau/);
});

test('poster preview email signs only the file, attaches original bytes and preserves saved image identity', async () => {
  const fixture = emailFixture(reference);
  let persistedRef;
  const route = load('app/api/orders/send-poster-confirmation/route.ts', {
    '@/lib/storage': storage, '@/lib/adminAuth': { refuserSiPasAdmin: async () => null }, '@/lib/envoiEmail': fixture.send,
    '@/lib/finalImage': fixture.final,
    '@/lib/db': { ...fixture.db, setPosterConfirmationToken: async (_id, _token, ref) => { persistedRef = ref; return true; }, recordPosterConfirmationMessage: async () => {} },
  });
  assert.equal((await route.POST(request({ orderId: id, customerEmail: fixture.saved.customer_email, finalImageUrl: reference }))).status, 200);
  assert.equal(persistedRef, reference);
  const message = fixture.sends[0];
  assert.equal(Buffer.from(message.attachments[0].content, 'base64').toString(), 'isolated immutable image bytes');
  const url = [...message.html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => m[1].replaceAll('&amp;', '&')).find(url => url.includes('/api/storage/email?'));
  assertRestrictedUrl(url, reference);
  assert.doesNotMatch(message.html, /vps:\/\//);
});

for (const enabled of [false, true]) test(`extras keep artifact refs and checkpoint reuse while emailing readable URLs; VPS=${enabled}`, async () => {
  const beforeFlag = process.env.CARTOONOVA_STORAGE_PROVIDER;
  if (enabled) process.env.CARTOONOVA_STORAGE_PROVIDER = 'vps'; else delete process.env.CARTOONOVA_STORAGE_PROVIDER;
  const fixture = emailFixture(reference);
  fixture.saved.options = { carteVoeux: true, calendrier: true };
  let artifacts = {}, generated = 0, uploads = 0;
  const refs = [];
  const route = load('app/api/orders/extras/route.ts', {
    '@/lib/db': fixture.db, '@/lib/adminAuth': { refuserSiPasAdmin: async () => null }, '@/lib/envoiEmail': fixture.send,
    '@/lib/finalImage': fixture.final,
    '@/lib/storage': { ...storage, uploadVpsServerObject: async (bytes, namespace, type) => {
      assert.equal(namespace, `extras/${id}`); assert.equal(type, 'application/pdf'); assert.ok(bytes.length > 0);
      uploads++; const ref = `vps://private/extras/${id}/${uploads === 1 ? fileId : id}.pdf`; refs.push(ref); return ref;
    } },
    '@vercel/blob': { put: async (_path, _bytes, options) => { assert.equal(enabled, false); assert.equal(options.access, 'public'); uploads++; const url = `https://fixture.public.blob.vercel-storage.com/extras/${uploads}.pdf`; refs.push(url); return { url }; } },
    '@/lib/extras/carteVoeux': { genererCarteVoeux: async () => { generated++; return Buffer.from('synthetic PDF carte'); } },
    '@/lib/extras/calendrier': { genererCalendrier: async () => { generated++; return Buffer.from('synthetic PDF calendar'); } },
    '@/lib/orderDelivery': { ...fixture.delivery, executeDelivery: async (_order, _kind, _hash, _to, run) => {
      await run({ artifacts, checkpoint: async value => { artifacts = value; }, send: async callback => callback('fixture-key') });
      return { artifacts, emailId: 'fixture-email', duplicate: false };
    } },
  });
  try {
    for (let i = 0; i < 2; i++) assert.equal((await route.POST(request({ orderId: id }))).status, 200);
    assert.equal(generated, 2); assert.equal(uploads, 2);
    assert.deepEqual(artifacts.fichiers.map(f => f.url), refs);
    for (const message of fixture.sends) {
      assert.doesNotMatch(message.html, /vps:\/\//);
      const urls = [...message.html.matchAll(/href="([^"]+)"/g)].map(m => m[1].replaceAll('&amp;', '&'));
      for (const ref of refs) {
        if (enabled) { const url = urls.find(url => new URL(url).searchParams.get('ref') === ref); assert.ok(url); assertRestrictedUrl(url, ref); }
        else assert.ok(urls.includes(ref));
      }
    }
  } finally { if (beforeFlag === undefined) delete process.env.CARTOONOVA_STORAGE_PROVIDER; else process.env.CARTOONOVA_STORAGE_PROVIDER = beforeFlag; }
});

test('private preview bypasses optimizer and UI never substitutes display URLs into persistence payloads', () => {
  const source = readFileSync(new URL('../app/(hors-langue)/confirm-poster/[token]/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /unoptimized=\{isPrivateStorageReference\(order.final_image_url\)\}/);
  const depot = readFileSync(new URL('../app/(hors-langue)/depot/[token]/DepotClient.tsx', import.meta.url), 'utf8');
  assert.match(depot, /photoUrls: selection/);
  assert.match(depot, /expectedPhotos: existingPhotos/);
  assert.match(depot, /src=\{storageDisplayUrl\(url, \{ token \}\)\}/);
  const confirm = readFileSync(new URL('../app/(hors-langue)/confirm-poster/[token]/ConfirmClient.tsx', import.meta.url), 'utf8');
  assert.match(confirm, /storageDisplayUrl\(url, \{ posterToken: token \}\)/);
});

test('revision acknowledgement signs each private attachment without changing stored refs', async () => {
  const photo = reference.replace('/final/', '/retouches/');
  const fixture = emailFixture(reference);
  Object.assign(fixture.saved, { poster_confirmation_photos: [photo, legacy], poster_confirmation_note: 'Fixture request', status: 'paid' });
  let persisted;
  const route = load('app/api/orders/confirm-poster/route.ts', {
    '@/lib/storage': storage, '@/lib/envoiEmail': fixture.send,
    '@/lib/clientOrderPolicy': { canRespondToPreview: () => true },
    '@/lib/photoOwnership': { validatePhotoOwnership: async () => null },
    '@/lib/orderPhotos': { parsePhotoUrls: photos => photos, photosInvalides: () => false },
    '@/lib/retouches': { nombreRetouches: async () => 1 },
    '@/lib/alerteServeur': { signalerPanne: async () => { throw Error('Unexpected fixture error'); } },
    '@/lib/db': { ...fixture.db, getOrderByConfirmationToken: async () => fixture.saved,
      recordPosterConfirmationResponse: async (_token, _status, _note, photos) => {
        persisted = photos; return { changed: true, order: fixture.saved };
      } },
  });
  const result = await route.POST(request({ token: 'fixture-preview', action: 'changes', note: 'Fixture request', photos: [photo, legacy] }));
  assert.equal(result.status, 200);
  assert.deepEqual(persisted, [photo, legacy]);
  assert.equal(fixture.sends.length, 1);
  const html = fixture.sends[0].html;
  assert.doesNotMatch(html, /vps:\/\//);
  const urls = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1].replaceAll('&amp;', '&'));
  assertRestrictedUrl(urls.find(url => url.includes('/api/storage/email?')), photo);
  assert.ok(urls.includes(legacy));
});

test('bonus proxy reads canonical saved version via shared downloader and disables browser caching', async () => {
  const fixture = emailFixture(reference);
  fixture.saved.final_image_sent_at = '2026-01-01';
  const route = load('app/api/bonus/[token]/image/route.ts', {
    '@/lib/db': fixture.db, '@/lib/emailToken': { parseOrderTrackingToken: token => token === 'fixture-tracking' ? id : null },
    '@/lib/finalImage': fixture.final,
  });
  const result = await route.GET(new Request('https://fixture.invalid/api/bonus/fixture-tracking/image'), { params: Promise.resolve({ token: 'fixture-tracking' }) });
  assert.equal(result.status, 200);
  assert.equal(await result.text(), 'isolated immutable image bytes');
  assert.equal(result.headers.get('content-type'), 'image/png');
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
  assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
});

test('CSP adds only the exact configured HTTPS upload origin when VPS is explicitly enabled', async () => {
  const before = { ...process.env };
  const config = () => load('next.config.ts', { 'next-intl/plugin': () => value => value }).default;
  const csp = async () => (await config().headers())[0].headers.find(header => header.key === 'Content-Security-Policy').value;
  try {
    process.env.STORAGE_VPS_ORIGIN = 'https://storage.fixture.invalid';
    delete process.env.CARTOONOVA_STORAGE_PROVIDER;
    assert.doesNotMatch(await csp(), /https:\/\/storage\.fixture\.invalid/);
    process.env.CARTOONOVA_STORAGE_PROVIDER = 'vps';
    const policy = await csp();
    assert.match(policy.split('; ').find(part => part.startsWith('connect-src ')), / https:\/\/storage\.fixture\.invalid$/);
    for (const origin of ['http://storage.fixture.invalid', 'https://user:password@storage.fixture.invalid', 'https://storage.fixture.invalid/path', 'https://storage.fixture.invalid?query=1', 'https://storage.fixture.invalid/#hash']) {
      process.env.STORAGE_VPS_ORIGIN = origin;
      assert.throws(config);
    }
  } finally { process.env = before; }
});
