import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, before, after } from 'node:test';
import { database, loadDeep } from './order-delivery-harness.mjs';

let pg;
before(async () => { pg = await database(); await pg.migrate(); });
after(async () => { await pg?.close(); });
const copy = loadDeep('lib/email-i18n.ts');
const request = (id, body) => new Request('http://local/api/orders/send-final-image', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: id, ...body }),
});
async function fixture(options = { printOption: 'digital' }, lang = 'fr') {
  const id = randomUUID(), url = 'https://synthetic.invalid/final/A.png';
  await pg.db`INSERT INTO orders(id,paid_at,customer_email,customer_name,langue,options,final_image_url) VALUES(${id}::uuid,now(),'buyer@example.invalid','Test <Client>',${lang},${pg.db.json(options)},${url})`;
  const sends = [], keys = [];
  let schedules = 0;
  const db = {
    getOrderById: async () => (await pg.db`SELECT * FROM orders WHERE id=${id}::uuid`)[0],
    setOrderLastOutboundMessageId: async (_, emailId) => pg.db`UPDATE orders SET last_outbound_message_id=${emailId} WHERE id=${id}::uuid`,
    updateOrderFinalImage: async (_, image) => pg.db`UPDATE orders SET final_image_url=${image},final_image_scheduled_at=null,poster_confirmation_status=null,poster_confirmation_image_url=null,poster_confirmation_email=null WHERE id=${id}::uuid AND final_image_url IS DISTINCT FROM ${image}`,
    programmerEnvoiImageFinale: async () => { schedules++; },
    programmerEnvoiImageFinaleSiLibre: async () => { schedules++; return new Date('2099-01-01'); },
  };
  const replacements = {
    '@/lib/db': db,
    '@/lib/adminAuth': { refuserSiPasAdmin: async () => null },
    '@/lib/orderDelivery': pg.load('lib/orderDelivery.ts'),
    '@/lib/finalImage': {
      validateFinalImageUrl: () => {}, downloadFinalImage: async image => ({ bytes: Buffer.from(image.endsWith('A.png') ? 'original synthetic pixels' : 'retouched synthetic pixels') }),
      FinalImageError: class extends Error { constructor(message, status) { super(message); this.status = status; } },
    },
    '@/lib/emailToken': { orderTrackingToken: () => 'synthetic-token' },
    '@/lib/analyticsServeur': { mesureServeur: async () => {} },
    '@/lib/parrainage': { infosParrainage: async () => null },
    '@/lib/envoiEmail': { envoyerEmail: async (message, { idempotencyKey }) => { sends.push(message); keys.push(idempotencyKey); return { data: { id: 'capture-' + sends.length } }; } },
  };
  const route = () => loadDeep('app/api/orders/send-final-image/route.ts', replacements);
  return {
    id, db, replacements, sends, keys, get schedules() { return schedules; },
    post: async (body = {}) => route().POST(request(id, { finalImageUrl: (await db.getOrderById()).final_image_url, ...body })),
    approve: async () => pg.db`UPDATE orders SET poster_confirmation_status='confirmed',poster_confirmation_image_url=final_image_url,poster_confirmation_email=customer_email WHERE id=${id}::uuid`,
  };
}

test('retouch refuses first delivery, malformed mode and schedule with no effect', async () => {
  const f = await fixture();
  assert.equal((await f.post({ deliveryMode: 'retouch' })).status, 409);
  assert.equal((await f.post({ deliveryMode: 'retouch', saveOnly: true })).status, 409);
  assert.equal((await f.post({ deliveryMode: 'wrong' })).status, 400);
  assert.equal((await f.post({ deliveryMode: 'retouch', action: 'schedule' })).status, 400);
  assert.equal(f.sends.length, 0); assert.equal(f.schedules, 0);
});

test('silent replacement then explicit retouch shares durable dedupe, first date and extras ledger', async () => {
  const f = await fixture();
  assert.equal((await f.post()).status, 200);
  const first = (await f.db.getOrderById()).final_image_sent_at.toISOString();
  const saved = await f.post({ saveOnly: true, deliveryMode: 'retouch', finalImageUrl: 'https://synthetic.invalid/final/B.png' });
  assert.equal(saved.status, 200); assert.equal((await saved.json()).raisonNonProgramme, 'retouche');
  assert.equal(f.sends.length, 1); assert.equal(f.schedules, 0);
  const outcomes = await Promise.all(Array.from({ length: 8 }, () => f.post({ deliveryMode: 'retouch' })));
  assert.ok(outcomes.every(r => [200, 409].includes(r.status)));
  assert.equal(f.sends.length, 2);
  assert.equal((await f.post({ deliveryMode: 'retouch' })).status, 200);
  assert.equal((await f.post()).status, 200); // Existing resend button cannot duplicate the same bytes.
  assert.equal(f.sends.length, 2); assert.equal(new Set(f.keys).size, 2);
  assert.equal(f.sends[1].subject, copy.retouchedImageEmail.fr.subject);
  assert.match(f.sends[1].html, /Suite à ta demande de retouche/);
  assert.doesNotMatch(f.sends[1].html, /bonus\/|avis\/nouveau|HD|haute définition/);
  assert.match(f.sends[1].html, /Test &lt;Client&gt;/);
  const order = await f.db.getOrderById();
  assert.equal(order.final_image_sent_at.toISOString(), first); assert.equal(order.final_image_scheduled_at, null);
  assert.equal(order.last_outbound_message_id, 'capture-2');
  assert.equal((await pg.db`SELECT count(*)::int n FROM order_delivery_effects WHERE order_id=${f.id}::uuid AND kind='final_image' AND status='sent'`)[0].n, 2);
  if (process.env.RETOUCH_EVIDENCE_DIR) {
    mkdirSync(process.env.RETOUCH_EVIDENCE_DIR, { recursive: true });
    writeFileSync(process.env.RETOUCH_EVIDENCE_DIR + '/retouch-fr.html', f.sends[1].html);
  }
});

test('legacy replacement after delivery is silent too', async () => {
  const f = await fixture(); await f.post();
  assert.equal((await f.post({ saveOnly: true, finalImageUrl: 'https://synthetic.invalid/final/B.png' })).status, 200);
  assert.equal(f.sends.length, 1); assert.equal(f.schedules, 0);
});

for (const lang of Object.keys(copy.finalImageEmail)) test(`retouch email localized in ${lang} through the real shared sender`, async () => {
  const f = await fixture({ printOption: 'digital' }, lang); await f.post();
  await f.post({ saveOnly: true, deliveryMode: 'retouch', finalImageUrl: 'https://synthetic.invalid/final/B.png' });
  assert.equal((await f.post({ deliveryMode: 'retouch' })).status, 200);
  assert.equal(f.sends[1].subject, copy.retouchedImageEmail[lang].subject);
  assert.notEqual(f.sends[1].subject, f.sends[0].subject);
  assert.ok(f.sends[1].html.includes(copy.retouchedImageEmail[lang].title));
});

test('physical replacement invalidates approval; retouch only after approval of current image', async () => {
  const f = await fixture({ printOption: 'canvas' }); await f.approve(); await f.post();
  await f.post({ saveOnly: true, deliveryMode: 'retouch', finalImageUrl: 'https://synthetic.invalid/final/B.png' });
  assert.equal((await f.db.getOrderById()).poster_confirmation_status, null);
  assert.equal((await f.post({ deliveryMode: 'retouch' })).status, 409); assert.equal(f.sends.length, 1);
  await f.approve(); assert.equal((await f.post({ deliveryMode: 'retouch' })).status, 200);
});

test('gift recipient retained without repeating gift message, future promise never schedules retouch', async () => {
  const f = await fixture({ printOption: 'digital', gift: { recipientEmail: 'gift@example.invalid', message: 'SYNTHETIC_GIFT_MESSAGE' } });
  await f.post(); await f.post({ saveOnly: true, deliveryMode: 'retouch', finalImageUrl: 'https://synthetic.invalid/final/B.png' });
  assert.equal((await f.post({ deliveryMode: 'retouch' })).status, 200);
  assert.deepEqual(f.sends[1].to, ['gift@example.invalid']); assert.doesNotMatch(f.sends[1].html, /SYNTHETIC_GIFT_MESSAGE|synthetic-token|Test &lt;Client&gt;/);
  await pg.db`UPDATE orders SET options=jsonb_set(options,'{gift,deliverAfter}','"2099-01-01"') WHERE id=${f.id}::uuid`;
  assert.equal((await f.post({ deliveryMode: 'retouch' })).status, 409); assert.equal(f.schedules, 0); assert.equal(f.sends.length, 2);
});

test('retouch preserves unpaid, historical and uncertain-provider fail-closed guards', async () => {
  const f = await fixture(); await f.post();
  await f.post({ saveOnly: true, deliveryMode: 'retouch', finalImageUrl: 'https://synthetic.invalid/final/B.png' });
  await pg.db`UPDATE orders SET paid_at=null WHERE id=${f.id}::uuid`;
  assert.equal((await f.post({ deliveryMode: 'retouch' })).status, 409);
  await pg.db`UPDATE orders SET paid_at=now() WHERE id=${f.id}::uuid`;
  f.replacements['@/lib/envoiEmail'].envoyerEmail = async () => { throw Error('synthetic lost response'); };
  assert.equal((await f.post({ deliveryMode: 'retouch' })).status, 500);
  assert.equal((await f.post({ deliveryMode: 'retouch' })).status, 409);
  assert.equal((await pg.db`SELECT status FROM order_delivery_effects WHERE order_id=${f.id}::uuid AND status='uncertain'`).length, 1);
  const h = await fixture(); await pg.db`UPDATE orders SET final_image_sent_at=now() WHERE id=${h.id}::uuid`;
  assert.equal((await h.post({ deliveryMode: 'retouch' })).status, 409); assert.equal(h.sends.length, 0);
});

test('admin authorization and canonical recipient/image checks apply to retouch', async () => {
  const f = await fixture(); await f.post();
  assert.equal((await f.post({ deliveryMode: 'retouch', customerEmail: 'attacker@example.invalid' })).status, 409);
  assert.equal((await f.post({ deliveryMode: 'retouch', finalImageUrl: 'https://synthetic.invalid/final/unsaved.png' })).status, 409);
  f.replacements['@/lib/adminAuth'].refuserSiPasAdmin = async () => new Response(null, { status: 401 });
  assert.equal((await f.post({ deliveryMode: 'retouch' })).status, 401); assert.equal(f.sends.length, 1);
});

test('locked SQL guard independently refuses a retouch before first delivery', async () => {
  const f = await fixture(); let sends = 0;
  await assert.rejects(pg.load('lib/orderDelivery.ts').executeDelivery(await f.db.getOrderById(), 'final_image', 'new-content', 'buyer@example.invalid', async () => { sends++; }, 'retouch'), e => e.status === 409);
  assert.equal(sends, 0);
});
