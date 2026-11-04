import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

// Run the real recovery function with in-memory boundaries; no provider or DB access.
const file = path.resolve(import.meta.dirname, '../lib/supportProviderRecovery.ts');
const id = '11111111-1111-4111-8111-111111111111';
const providerId = '22222222-2222-4222-8222-222222222222';
const fingerprint = 'synthetic-fingerprint';

function fixture(approvedHeaders = null) {
  const draft = {
    status: 'uncertain', approvalFingerprint: fingerprint,
    toEmail: 'client@example.invalid', subject: 'Question', body: 'Bonjour', attachments: [],
    transport: { from: 'support@example.invalid', replyTo: 'support@example.invalid', html: '<p>Bonjour</p>', headers: approvedHeaders },
  };
  const sent = {
    id: providerId, created_at: '2026-01-02T03:04:05Z', from: draft.transport.from,
    to: [draft.toEmail], reply_to: [draft.transport.replyTo], subject: draft.subject,
    html: draft.transport.html, text: draft.body, tags: [{ name: 'support_draft', value: id }], cc: [], bcc: [],
  };
  const calls = { reads: 0, updates: 0, reconciles: 0, requests: [] };
  const m = new Module(file); m.filename = file;
  const originalRequire = createRequire(file);
  m.require = name => {
    if (name === '@/lib/db') return { sql: async () => { calls.updates++; return [{ id }]; } };
    if (name === '@/lib/supportPreparedReplies') return { readPreparedSupportReply: async () => { calls.reads++; return draft; } };
    if (name === '@/lib/supportPreparedDelivery') return { reconcilePreparedSupportReply: async () => { calls.reconciles++; return 'reconciled'; } };
    return originalRequire(name);
  };
  m._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
  const request = async (url, options) => {
    calls.requests.push({ url, options });
    if (url === `https://api.resend.com/emails/${providerId}`) return Response.json(sent);
    if (url === `https://api.resend.com/emails/${providerId}/attachments?limit=100`) return Response.json({ has_more: false, data: [] });
    throw new Error('Unexpected request: ' + url);
  };
  return { draft, sent, calls, run: () => m.exports.recoverUncertainSupportReply(id, fingerprint, providerId, request) };
}

// A synthetic key is local to this isolated process and fetch is always injected.
process.env.RESEND_API_KEY = 'synthetic-only';

for (const [label, headers] of [['omitted', undefined], ['null', null], ['empty object', {}], ['unexpected headers', { 'In-Reply-To': '<other@example.invalid>', References: '<other@example.invalid>' }]]) {
  test(`no approved headers: provider ${label} cannot establish absence`, async () => {
    const f = fixture();
    if (headers !== undefined) f.sent.headers = headers;
    await assert.rejects(f.run(), /en-têtes/);
    assert.equal(f.calls.updates, 0);
    assert.equal(f.calls.reconciles, 0);
    assert.equal(f.calls.requests.length, 1);
  });
}

test('approved threading headers: missing or mismatched evidence never repairs', async () => {
  for (const headers of [undefined, {}, { 'In-Reply-To': '<wrong@example.invalid>', References: '<source@example.invalid>' }, { 'In-Reply-To': '<source@example.invalid>', References: '<wrong@example.invalid>' }]) {
    const f = fixture({ 'In-Reply-To': '<source@example.invalid>', References: '<source@example.invalid>' });
    if (headers !== undefined) f.sent.headers = headers;
    await assert.rejects(f.run(), /en-têtes/);
    assert.equal(f.calls.updates, 0);
    assert.equal(f.calls.reconciles, 0);
  }
});

test('synthetic matching threaded evidence follows existing repair path', async () => {
  const headers = { 'In-Reply-To': '<source@example.invalid>', References: '<source@example.invalid>' };
  const f = fixture(headers); f.sent.headers = { ...headers };
  assert.equal(await f.run(), 'reconciled');
  assert.equal(f.calls.updates, 1);
  assert.equal(f.calls.reconciles, 1);
  assert.equal(f.calls.requests.length, 2);
  assert.ok(f.calls.requests.every(call => call.options.redirect === 'error'));
});

test('matching synthetic headers do not override mismatched email evidence', async () => {
  const headers = { 'In-Reply-To': '<source@example.invalid>', References: '<source@example.invalid>' };
  const f = fixture(headers); f.sent.headers = { ...headers }; f.sent.text = 'different';
  await assert.rejects(f.run(), /différente du brouillon/);
  assert.equal(f.calls.updates, 0);
  assert.equal(f.calls.reconciles, 0);
});
