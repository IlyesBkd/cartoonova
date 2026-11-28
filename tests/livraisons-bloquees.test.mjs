import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { database } from './order-delivery-harness.mjs';

/* 27/11/2026 : mail parti chez Resend, fonction coupée avant de noter l'envoi (Jeanne, Lisa). */
test('réparation des livraisons bloquées : seulement sur preuve de l historique e-mail, jamais de renvoi', async () => {
  const pg = await database();
  try {
    await pg.migrate();
    await pg.db.unsafe(readFileSync(new URL('../migrations/20261124_customer_history.sql', import.meta.url), 'utf8'));
    const lib = pg.load('lib/livraisonsBloquees.ts', { '@/lib/orderDelivery': pg.load('lib/orderDelivery.ts') });
    const [lisa, sansPreuve, recent, jeanne] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    for (const id of [lisa, sansPreuve, recent, jeanne]) {
      await pg.db`INSERT INTO orders(id,status,paid_at,customer_email,options,final_image_url,final_image_scheduled_at) VALUES(${id},'PAID',now(),'c@example.invalid','{}','vps://private/final/x.png',now() + interval '1 day')`;
    }
    const effet = async (id, status, il_y_a, extra = {}) => pg.db`INSERT INTO order_delivery_effects(order_id,kind,version,status,artifacts,updated_at)
      VALUES(${id},'final_image','v1',${status},${pg.db.json({ deliveryHistory: { mode: 'initial', ...extra } })},now() - ${il_y_a}::interval)`;
    await effet(lisa, 'sending', '20 minutes');
    await effet(sansPreuve, 'sending', '20 minutes');
    await effet(recent, 'sending', '2 minutes');
    await effet(jeanne, 'sent', '30 minutes', { sentAt: '2026-11-27T14:05:16.660954+00:00' });
    const hist = (id, status, providerId) => pg.db`INSERT INTO customer_history_events(customer_email,kind,status,details,attempt_id,provider_id,sent_at)
      VALUES('c@example.invalid','email',${status},${JSON.stringify({ idempotencyKey: `delivery/${id}/final_image/v1` })}::text::jsonb,${randomUUID()},${providerId},${providerId ? '2026-11-27T18:15:15Z' : null})`;
    await hist(lisa, 'uncertain', null);
    await hist(lisa, 'sent', 'resend-lisa');
    await hist(sansPreuve, 'uncertain', null);
    await hist(recent, 'sent', 'resend-recent');

    const r = await lib.reparerLivraisonsBloquees();
    assert.equal(r.reparees.length, 1, 'seule Lisa a une preuve et un blocage de plus de 10 min');
    assert.equal(r.reparees[0].emailId, 'resend-lisa');
    assert.equal(r.restantes, 1, 'sans preuve : laissé à la main, rien n est renvoyé');
    const [e] = await pg.db`SELECT status, email_id, artifacts FROM order_delivery_effects WHERE order_id=${lisa}`;
    assert.equal(e.status, 'sent'); assert.equal(e.email_id, 'resend-lisa');
    assert.match(JSON.stringify(e.artifacts.reconciliation), /Réparation automatique/);
    const [s] = await pg.db`SELECT status FROM order_delivery_effects WHERE order_id=${sansPreuve}`;
    assert.equal(s.status, 'sending', 'aucune preuve : on ne touche à rien');
    const [rc] = await pg.db`SELECT status FROM order_delivery_effects WHERE order_id=${recent}`;
    assert.equal(rc.status, 'sending', 'un envoi récent est peut-être encore en cours');
    // Dates d'envoi : celle de l'historique pour Lisa, celle du journal pour Jeanne ; programmation annulée.
    const [l] = await pg.db`SELECT final_image_sent_at, final_image_scheduled_at FROM orders WHERE id=${lisa}`;
    assert.equal(l.final_image_sent_at.toISOString(), '2026-11-27T18:15:15.000Z'); assert.equal(l.final_image_scheduled_at, null);
    const [j] = await pg.db`SELECT final_image_sent_at, final_image_scheduled_at FROM orders WHERE id=${jeanne}`;
    assert.equal(j.final_image_sent_at.toISOString(), '2026-11-27T14:05:16.660Z'); assert.equal(j.final_image_scheduled_at, null);
    assert.equal(r.datesCompletees, 1);
    const [o] = await pg.db`SELECT final_image_sent_at FROM orders WHERE id=${sansPreuve}`;
    assert.equal(o.final_image_sent_at, null, 'sans preuve : pas de date inventée');
    assert.equal((await lib.reparerLivraisonsBloquees()).reparees.length, 0, 'rejouer ne refait rien');
  } finally { await pg.close(); }
});
