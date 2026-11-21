// Disposable PostgreSQL only. No production env, external transport or client send.
import assert from 'node:assert/strict';
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import vm from 'node:vm';
import { randomUUID, webcrypto } from 'node:crypto';
import postgres from 'postgres';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'support-signal-'));
const bin = '/usr/lib/postgresql/18/bin';
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
const pg = (cmd, args) => execFileSync(path.join(bin, cmd), args, { env, timeout: 15000, stdio: 'pipe' });
let db, observer, listener, started = false, subscription;
const notifications = [], logs = [];
const pause = () => new Promise(resolve => setTimeout(resolve, 40));
function load(file, modules = {}, source = readFileSync(file, 'utf8'), globals = {}) {
  const sandboxModule = { exports: {} };
  const NextResponse = class extends Response { static json(body, options) { return Response.json(body, options); } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, {
    module: sandboxModule, exports: sandboxModule.exports, Request, Response, Date, TextDecoder, Uint8Array, crypto: webcrypto,
    setTimeout, clearTimeout, ...globals,
    console: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
    require: id => {
      if (id === 'next/server') return { NextResponse };
      if (id === 'node:crypto') return { randomUUID };
      if (id in modules) return modules[id];
      throw Error('Unexpected dependency: ' + id);
    },
  });
  return sandboxModule.exports;
}
const signal = load('lib/supportNotificationSignal.ts');
function insert(sql = db) {
  const source = ts.createSourceFile('db.ts', readFileSync('lib/db.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const fn = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'insertSupportMessage');
  return load('lib/db.ts', { './test-db': { sql }, './supportNotificationSignal': signal },
    'import {sql} from "./test-db"; import {signalSupportIncoming} from "./supportNotificationSignal"; async function ensureSupportInboxSchema() {}\n' + fn.getText(source)).insertSupportMessage;
}
function chat(sql = db) {
  return load('app/api/chat/route.ts', {
    '@/lib/db': { sql }, '@/lib/supportNotificationSignal': signal,
    '@/lib/email': { emailValide: email => email.includes('@') },
    '@/lib/rateLimit': { cleDepuisRequete: () => 'local', limiteur: () => () => false },
    '@/lib/confidentialiteMesure': { diagnosticJournal: () => 'safe-error' },
  }).POST;
}
const message = id => ({ messageId: id, fromEmail: 'synthetic@example.invalid', subject: 'Original subject', bodyText: 'Original 😀', receivedAt: new Date(), orderId: null, category: 'customer' });
const body = () => ({ email: 'synthetic@example.invalid', message: 'Original 😀', idempotencyKey: randomUUID() });
const request = data => new Request('https://local.invalid/api/chat', { method: 'POST', body: JSON.stringify(data) });
async function received(expected) {
  for (let i = 0; i < 50 && notifications.length < expected.length; i++) await pause();
  await pause();
  assert.deepEqual(notifications, expected);
}
// Observe durable rows on an independent connection BEFORE allowing pg_notify.
function checkedSql({ fail = false } = {}) {
  return async (strings, ...values) => {
    if (strings.join('').includes('pg_notify')) {
      const rows = await observer`SELECT m.message_id,n.id AS queued FROM support_messages m LEFT JOIN chat_telegram_notifications n ON n.support_message_id=m.id`;
      assert.ok(rows.length > 0, 'message must already be externally visible at signal invocation');
      for (const row of rows) assert.equal(row.queued !== null, /^(chat|contact)-/.test(row.message_id));
      if (fail) return db`SELECT 1 / 0`;
    }
    return db(strings, ...values);
  };
}
before(async () => {
  const server = net.createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port; await new Promise(r => server.close(r)); assert.notEqual(port, 5432);
  pg('initdb', ['-D', dir + '/pg', '-U', 'signal_test', '--auth=trust', '--no-locale', '--encoding=UTF8']);
  pg('pg_ctl', ['-D', dir + '/pg', '-l', dir + '/pg.log', '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, '-w', 'start']); started = true;
  const url = `postgresql://signal_test@127.0.0.1:${port}/postgres`;
  db = postgres(url, { max: 2, onnotice() {} }); observer = postgres(url, { max: 1, onnotice() {} }); listener = postgres(url, { max: 1, onnotice() {} });
  await db`CREATE TABLE support_messages(id SERIAL PRIMARY KEY,message_id TEXT UNIQUE NOT NULL,from_email TEXT NOT NULL,subject TEXT,body_text TEXT,received_at TIMESTAMPTZ,order_id UUID,category TEXT)`;
  await db.unsafe(readFileSync('migrations/20261026_chat_telegram_notifications.sql', 'utf8'));
  subscription = await listener.listen('cartoonova_support_incoming', payload => notifications.push(payload));
});
beforeEach(async () => { await pause(); notifications.length = 0; logs.length = 0; await db`TRUNCATE chat_telegram_notifications,support_messages RESTART IDENTITY`; });
after(async () => {
  await subscription?.unlisten(); await Promise.all([db, observer, listener].filter(Boolean).map(sql => sql.end({ timeout: 2 })));
  if (started) pg('pg_ctl', ['-D', dir + '/pg', '-m', 'fast', '-w', 'stop']);
  rmSync(dir, { recursive: true, force: true });
});

test('chat/contact/email notify only new, committed rows; payload is fixed and duplicates stay silent', async () => {
  const post = chat(checkedSql()), save = insert(checkedSql()), data = body();
  assert.equal((await post(request(data))).status, 200); await received(['chat']);
  assert.equal((await post(request(data))).status, 200);
  assert.equal((await post(request({ ...data, message: 'conflicting body' }))).status, 409);
  for (const [id, payload] of [['contact-local', 'chat'], ['<imap-local>', 'email']]) {
    assert.equal((await save(message(id))).isNew, true);
    assert.equal((await save(message(id))).isNew, false);
    await received(payload === 'chat' ? ['chat', 'chat'] : ['chat', 'chat', 'email']);
  }
  assert.equal((await db`SELECT * FROM chat_telegram_notifications`).length, 2);
  assert.ok((await db`SELECT body_text FROM support_messages`).every(row => row.body_text === 'Original 😀'));
});

test('blocked insertion cannot notify before commit; signal sees committed message and queue', async () => {
  let locked, release;
  const entered = new Promise(r => { locked = r; }), held = new Promise(r => { release = r; });
  const blocker = observer.begin(async tx => { await tx`LOCK TABLE support_messages IN ACCESS EXCLUSIVE MODE`; locked(); await held; });
  await entered;
  const running = chat(checkedSql())(request(body()));
  try { await pause(); assert.deepEqual(notifications, []); } finally { release(); await blocker; }
  assert.equal((await running).status, 200); await received(['chat']);
});

test('concurrent duplicates signal once for each channel', async () => {
  const save = insert(), post = chat(), data = body();
  const results = await Promise.all([save(message('contact-race')), save(message('contact-race')), save(message('<imap-race>')), save(message('<imap-race>')), post(request(data)), post(request(data))]);
  assert.deepEqual(results.slice(0, 2).map(r => r.isNew).sort(), [false, true]);
  assert.deepEqual(results.slice(2, 4).map(r => r.isNew).sort(), [false, true]);
  assert.ok(results.slice(4).every(r => r.status === 200));
  for (let i = 0; i < 50 && notifications.length < 3; i++) await pause();
  await pause(); assert.deepEqual([...notifications].sort(), ['chat', 'chat', 'email']);
});

test('real PostgreSQL signal error never loses message/queue or turns chat/contact into HTTP 500', async () => {
  const sql = checkedSql({ fail: true }), post = chat(sql), save = insert(sql);
  assert.equal((await post(request(body()))).status, 200);
  const contact = load('app/api/contact/route.ts', {
    '@/lib/db': { insertSupportMessage: save, findOrderByCustomerEmail: async () => null },
    '@/lib/email': { emailValide: () => true }, '@/lib/rateLimit': { cleDepuisRequete: () => 'local', limiteur: () => () => false },
    '@/lib/confidentialiteMesure': { diagnosticJournal: () => 'safe-error' },
  });
  assert.equal((await contact.POST(request({ nom: 'Synthetic', email: 'synthetic@example.invalid', sujet: 'Support', message: 'Original' })) ).status, 200);
  assert.equal((await save(message('<imap-failure>'))).isNew, true);
  assert.equal((await db`SELECT * FROM support_messages`).length, 3);
  assert.equal((await db`SELECT * FROM chat_telegram_notifications`).length, 2);
  await received([]);
  assert.equal(logs.length, 3);
  assert.ok(logs.every(args => args.length === 1 && args[0] === '[support notification] wake signal unavailable'));
});

test('queue failure rolls back chat/contact and emits no wake signal', async () => {
  await db`ALTER TABLE chat_telegram_notifications ADD CONSTRAINT synthetic_failure CHECK (false) NOT VALID`;
  try {
    assert.equal((await chat()(request(body()))).status, 500);
    await assert.rejects(insert()(message('contact-rollback')));
  } finally { await db`ALTER TABLE chat_telegram_notifications DROP CONSTRAINT synthetic_failure`; }
  assert.equal((await db`SELECT * FROM support_messages`).length, 0); await received([]);
});

test('helper awaits notify completion, swallows errors without private logs, and rejects arbitrary payloads', async () => {
  let release, completed = false;
  const held = new Promise(r => { release = r; });
  const running = signal.signalSupportIncoming(async (strings, ...values) => {
    assert.equal(strings.join('?'), "SELECT pg_notify('cartoonova_support_incoming', ?)");
    assert.deepEqual(values, ['email']); await held; throw Error('private@example.invalid SECRET');
  }, 'email').then(() => { completed = true; });
  await pause(); assert.equal(completed, false); release(); await running;
  assert.equal(JSON.stringify(logs), '[["[support notification] wake signal unavailable"]]');
  await signal.signalSupportIncoming(() => assert.fail('arbitrary payload must not reach PostgreSQL'), 'private@example.invalid');
});

function trackedSignal() {
  const timers = new Set();
  const helper = load('lib/supportNotificationSignal.ts', {}, undefined, {
    setTimeout(fn, ms) { const timer = setTimeout(fn, ms); timers.add(timer); return timer; },
    clearTimeout(timer) { timers.delete(timer); clearTimeout(timer); },
  });
  return { ...helper, timers };
}

test('success, early rejection and synchronous query failure clear timers without cancellation', async () => {
  const helper = trackedSignal();
  let cancelled = 0;
  for (const pending of [Promise.resolve([]), Promise.reject(Error('private@example.invalid SECRET'))]) {
    pending.cancel = () => { cancelled++; };
    await helper.signalSupportIncoming(() => pending, 'chat');
    assert.equal(helper.timers.size, 0);
  }
  await helper.signalSupportIncoming(() => { throw Error('private@example.invalid SECRET'); }, 'email');
  assert.equal(helper.timers.size, 0);
  assert.equal(cancelled, 0);
  assert.deepEqual(logs, Array.from({ length: 2 }, () => ['[support notification] wake signal unavailable']));
});

test('never-settling signal is bounded even when cancel throws; late rejection is drained', { timeout: 4000 }, async () => {
  const helper = trackedSignal();
  for (const throws of [false, true]) {
    let reject, cancelled = 0;
    const pending = new Promise((_, r) => { reject = r; });
    pending.cancel = () => { cancelled++; if (throws) throw Error('private@example.invalid SECRET'); };
    const start = performance.now();
    await helper.signalSupportIncoming(() => pending, 'email');
    const elapsed = performance.now() - start;
    assert.ok(elapsed >= 450 && elapsed < 1000, `signal took ${elapsed} ms`);
    assert.equal(cancelled, 1);
    assert.equal(helper.timers.size, 0);
    reject(Error('late private@example.invalid SECRET'));
    await pause(); // node:test also fails on an unhandled rejection.
  }
  assert.deepEqual(logs, Array.from({ length: 2 }, () => ['[support notification] wake signal unavailable']));
});

test('real PostgreSQL slow signal is cancelled without touching committed insertion/queue', { timeout: 5000 }, async () => {
  let cancelled = 0, pending;
  const sql = (strings, ...values) => {
    if (!strings.join('').includes('pg_notify')) return db(strings, ...values);
    pending = db`SELECT pg_sleep(10)`;
    const cancel = pending.cancel.bind(pending);
    pending.cancel = () => { cancelled++; cancel(); };
    return pending;
  };
  const start = performance.now();
  assert.equal((await chat(sql)(request(body()))).status, 200);
  assert.ok(performance.now() - start < 1500, 'chat must not await the slow signal');
  assert.equal(cancelled, 1);
  await assert.rejects(pending, error => error.code === '57014');
  assert.equal((await observer`SELECT * FROM support_messages`).length, 1);
  assert.equal((await observer`SELECT * FROM chat_telegram_notifications`).length, 1);
  await received([]);
  assert.deepEqual(logs, [['[support notification] wake signal unavailable']]);
});
