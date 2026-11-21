import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { readFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import vm from 'node:vm';
import { randomUUID, webcrypto } from 'node:crypto';
import postgres from 'postgres';
import ts from 'typescript';

const runtime = mkdtempSync(path.join(tmpdir(), 'support-notifications-pg-'));
const bin = '/usr/lib/postgresql/18/bin';
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
const pg = (cmd, args) => execFileSync(path.join(bin, cmd), args, { env, timeout: 15000, stdio: 'pipe' });
let db, started = false;
function load(file, modules = {}, source = readFileSync(file, 'utf8')) {
  const sandboxModule = { exports: {} }, effects = [], logs = [];
  const NextResponse = class extends Response { static json(body, options) { return Response.json(body, options); } };
  const context = {
    module: sandboxModule, exports: sandboxModule.exports, Request, Response, URL, Date, TextDecoder, Uint8Array, crypto: webcrypto,
    process: { env: { DISCORD_WEBHOOK_URL: 'https://discord.invalid/webhook', IMAP_HOST: 'imap.invalid', IMAP_USER: 'synthetic', IMAP_PASSWORD: 'synthetic' } },
    console: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
    fetch: async (...args) => { effects.push(args); throw Error('network forbidden'); },
    require: id => {
      if (id === 'next/server') return { NextResponse };
      if (id === 'node:crypto') return { randomUUID };
      if (id.includes('discord')) return { alerteDiscord: async (...args) => effects.push(args) };
      if (id === '@/lib/supportNotificationSignal' || id === './supportNotificationSignal') return load('lib/supportNotificationSignal.ts').api;
      if (id in modules) return modules[id];
      throw Error('Unexpected dependency: ' + id);
    },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
  return { api: sandboxModule.exports, effects, logs };
}
let insert;
before(async () => {
  const socket = net.createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
  const port = socket.address().port; await new Promise(r => socket.close(r)); assert.notEqual(port, 5432);
  pg('initdb', ['-D', path.join(runtime, 'pg'), '-U', 'support_test', '--auth=trust', '--no-locale', '--encoding=UTF8']);
  pg('pg_ctl', ['-D', path.join(runtime, 'pg'), '-l', path.join(runtime, 'pg.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${runtime}`, '-w', 'start']); started = true;
  db = postgres(`postgresql://support_test@127.0.0.1:${port}/postgres`, { onnotice() {} });
  await db`CREATE TABLE support_messages (id SERIAL PRIMARY KEY, message_id TEXT UNIQUE NOT NULL, from_email TEXT NOT NULL, subject TEXT, body_text TEXT, received_at TIMESTAMPTZ, order_id UUID, category TEXT)`;
  await db.unsafe(readFileSync('migrations/20261026_chat_telegram_notifications.sql', 'utf8'));
  const source = ts.createSourceFile('db.ts', readFileSync('lib/db.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const fn = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'insertSupportMessage');
  insert = load('lib/db.ts', { './test-db': { sql: db } }, 'import {sql} from "./test-db"; import {signalSupportIncoming} from "./supportNotificationSignal"; async function ensureSupportInboxSchema() {}\n' + fn.getText(source)).api.insertSupportMessage;
});
after(async () => { if (db) await db.end({ timeout: 2 }); if (started) pg('pg_ctl', ['-D', path.join(runtime, 'pg'), '-m', 'fast', '-w', 'stop']); });
const rate = { cleDepuisRequete: () => 'synthetic', limiteur: () => () => false };
const shared = { '@/lib/email': { emailValide: email => email.includes('@') }, '@/lib/rateLimit': rate, '@/lib/confidentialiteMesure': { diagnosticJournal: () => 'safe-error' } };
const request = (route, body) => new Request('https://local.invalid/api/' + route, { method: 'POST', body: JSON.stringify(body) });
const message = id => ({ messageId: id, fromEmail: 'local@example.invalid', subject: 'Support', bodyText: 'Message original', receivedAt: new Date(), orderId: null, category: 'customer' });

test('contact persists original content and queues Telegram without Discord even when configured', async () => {
  const route = load('app/api/contact/route.ts', { ...shared, '@/lib/db': { insertSupportMessage: insert, findOrderByCustomerEmail: async () => ({ id: '11111111-1111-4111-8111-111111111111' }) } });
  const response = await route.api.POST(request('contact', { nom: 'Test Local', email: 'local@example.invalid', sujet: 'Question', message: 'Contenu original' }));
  assert.equal(response.status, 200); assert.equal(route.effects.length, 0);
  const rows = await db`SELECT m.*, n.status FROM support_messages m JOIN chat_telegram_notifications n ON n.support_message_id=m.id WHERE m.subject='[Formulaire] Question'`;
  assert.equal(rows.length, 1); assert.match(rows[0].message_id, /^contact-/); assert.equal(rows[0].body_text, 'Test Local <local@example.invalid>\n\nContenu original'); assert.equal(rows[0].status, 'pending'); assert.equal(rows[0].order_id, '11111111-1111-4111-8111-111111111111');
});

test('contact concurrent duplicate queues once and queue failure rolls back message', async () => {
  const results = await Promise.all([insert(message('contact-duplicate')), insert(message('contact-duplicate'))]);
  assert.deepEqual(results.map(r => r.isNew).sort(), [false, true]);
  const rows = await db`SELECT n.id FROM chat_telegram_notifications n JOIN support_messages m ON m.id=n.support_message_id WHERE m.message_id='contact-duplicate'`; assert.equal(rows.length, 1);
  await db`ALTER TABLE chat_telegram_notifications ADD CONSTRAINT synthetic_failure CHECK (false) NOT VALID`;
  try { await assert.rejects(insert(message('contact-rollback'))); } finally { await db`ALTER TABLE chat_telegram_notifications DROP CONSTRAINT synthetic_failure`; }
  assert.equal((await db`SELECT id FROM support_messages WHERE message_id='contact-rollback'`).length, 0);
});

test('chat retains atomic Telegram persistence with configured Discord and makes no outgoing call', async () => {
  const route = load('app/api/chat/route.ts', { ...shared, '@/lib/db': { sql: db } });
  const body = { email: 'local@example.invalid', message: 'Chat original', idempotencyKey: '22222222-2222-4222-8222-222222222222' };
  for (let i = 0; i < 2; i++) assert.equal((await route.api.POST(request('chat', body))).status, 200);
  assert.equal(route.effects.length, 0);
  const rows = await db`SELECT m.body_text,n.status FROM support_messages m JOIN chat_telegram_notifications n ON n.support_message_id=m.id WHERE m.message_id=${'chat-' + body.idempotencyKey}`;
  assert.equal(rows.length, 1); assert.equal(rows[0].body_text, body.message); assert.equal(rows[0].status, 'pending');
});

test('IMAP persists full originals including >5000 characters/emoji without Discord or chat queue; duplicates stay deduplicated', async () => {
  const states = [], categories = ['customer', null, 'spam'];
  // The old 5000-code-unit cut split this emoji and discarded the entire tail.
  const longOriginal = 'x'.repeat(4999) + '😀' + ' texte intégral '.repeat(500) + ' FIN 😀';
  const original = uid => uid === 3 ? longOriginal : `Original ${uid}`;
  class ImapFlow {
    async connect() {} async mailboxOpen() { return { uidNext: 4 }; }
    async *fetch() { for (let uid = 1; uid <= 3; uid++) yield { uid, source: uid }; }
    async logout() {} close() {}
  }
  const route = load('lib/imapSync.ts', {
    imapflow: { ImapFlow }, mailparser: { simpleParser: async uid => ({ from: { value: [{ address: 'LOCAL@EXAMPLE.INVALID' }] }, messageId: `<imap-${uid}>`, subject: `Email ${uid}`, text: original(uid), date: new Date() }) },
    './db': { getImapSyncState: async () => ({ lastUid: 0 }), setImapSyncState: async uid => states.push(uid), insertSupportMessage: insert, findOrderByCustomerEmail: async () => null },
    './aiClassify': { classifySupportMessage: async msg => categories[Number(msg.subject.slice(-1)) - 1] },
  });
  for (const expected of [3, 0]) { const result = await route.api.syncSupportInbox(); assert.equal(result.checked, 3); assert.equal(result.newMessages, expected); }
  assert.deepEqual(states, [3, 3]); assert.equal(route.effects.length, 0);
  const rows = await db`SELECT m.*,n.id AS notification_id FROM support_messages m LEFT JOIN chat_telegram_notifications n ON n.support_message_id=m.id WHERE m.message_id LIKE '<imap-%' ORDER BY m.message_id`;
  assert.equal(rows.length, 3);
  rows.forEach((row, i) => { assert.equal(row.category, categories[i]); assert.equal(row.body_text, original(i + 1)); assert.equal(row.from_email, 'local@example.invalid'); assert.equal(row.notification_id, null); });
});
