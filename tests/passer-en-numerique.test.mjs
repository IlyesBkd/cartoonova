import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {database,loadDeep} from './order-delivery-harness.mjs';

/* Poster ou toile abandonne, le client garde le numerique (dossier du 25/11/2026). */
test('passer en numerique : garde SQL, ancien support garde, historique client, refus chez imprimeur ou expedie', async () => {
  const pg = await database();
  const before = process.env.DATABASE_URL; process.env.DATABASE_URL = pg.connectionUrl;
  try {
    await pg.db.unsafe(readFileSync(new URL('../migrations/20261124_customer_history.sql', import.meta.url), 'utf8'));
    const actual = loadDeep('lib/db.ts', {postgres: () => pg.db});
    const [poster, imprimeur, expediee, numerique] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    await pg.db`INSERT INTO orders(id,paid_at,customer_email,options) VALUES
      (${poster},NOW(),' Client@Example.invalid ','{"printKey":"posterSimple","printOption":"Poster","people":4}'),
      (${numerique},NOW(),'d@example.invalid','{"printKey":"digital"}')`;
    await pg.db`INSERT INTO orders(id,paid_at,customer_email,options,fournisseur_ref) VALUES (${imprimeur},NOW(),'i@example.invalid','{"printKey":"canvas"}','39055588')`;
    await pg.db`INSERT INTO orders(id,paid_at,customer_email,options,expedie_le) VALUES (${expediee},NOW(),'e@example.invalid','{"printKey":"framed"}',NOW())`;

    const ok = await actual.passerCommandeEnNumerique(poster, 'poster remboursé');
    assert.deepEqual(ok, {ok: true, avant: 'posterSimple'});
    const [row] = await pg.db`SELECT options FROM orders WHERE id=${poster}`;
    assert.equal(row.options.printKey, 'digital');
    assert.equal(row.options.supportAvant, 'posterSimple');
    assert.equal(row.options.supportAvantLibelle, 'Poster');
    assert.equal(row.options.people, 4, 'les autres options restent');
    assert.equal(row.options.passeEnNumeriqueMotif, 'poster remboursé');
    assert.equal(typeof row.options, 'object', 'pas de double encodage JSON');
    const hist = await pg.db`SELECT customer_email, kind, status, details FROM customer_history_events WHERE order_id=${poster}`;
    assert.equal(hist.length, 1);
    assert.equal(hist[0].customer_email, 'client@example.invalid');
    assert.equal(hist[0].kind, 'order.support');
    assert.deepEqual(hist[0].details, {field: 'printKey', before: 'posterSimple', after: 'digital'});

    assert.deepEqual(await actual.passerCommandeEnNumerique(poster, null), {ok: false, raison: 'deja_numerique'}, 'rejouer ne change rien');
    assert.deepEqual(await actual.passerCommandeEnNumerique(numerique, null), {ok: false, raison: 'deja_numerique'});
    assert.deepEqual(await actual.passerCommandeEnNumerique(imprimeur, null), {ok: false, raison: 'chez_imprimeur'});
    assert.deepEqual(await actual.passerCommandeEnNumerique(expediee, null), {ok: false, raison: 'expediee'});
    assert.deepEqual(await actual.passerCommandeEnNumerique(randomUUID(), null), {ok: false, raison: 'introuvable'});
    const [i] = await pg.db`SELECT options FROM orders WHERE id=${imprimeur}`;
    assert.equal(i.options.printKey, 'canvas', 'une commande chez l imprimeur ne bouge pas');
    assert.equal((await pg.db`SELECT count(*)::int n FROM customer_history_events WHERE kind='order.support'`)[0].n, 1, 'un seul passage noté, refus compris');

    const {PATCH} = loadDeep('app/api/orders/route.ts', {'@/lib/db': actual, '@/lib/adminAuth': {refuserSiPasAdmin: async () => null}});
    const call = body => PATCH(new Request('http://localhost/api/orders', {method: 'PATCH', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)}));
    const refus = await call({id: imprimeur, passerEnNumerique: true});
    assert.equal(refus.status, 409);
    assert.match((await refus.json()).error, /imprimeur/);
    const autre = randomUUID();
    await pg.db`INSERT INTO orders(id,paid_at,customer_email,options) VALUES (${autre},NOW(),'a@example.invalid','{"printKey":"canvas"}')`;
    const bon = await call({id: autre, passerEnNumerique: true, motif: '  toile remboursée  '});
    assert.equal(bon.status, 200);
    assert.deepEqual(await bon.json(), {ok: true, avant: 'canvas'});
    const [a] = await pg.db`SELECT options FROM orders WHERE id=${autre}`;
    assert.equal(a.options.passeEnNumeriqueMotif, 'toile remboursée');
  } finally {
    if (before === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = before;
    await pg.close();
  }
});
