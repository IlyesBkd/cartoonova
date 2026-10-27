import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire, Module } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Execute the actual route, replacing the IMAP boundary so no mailbox is touched.
const file = path.resolve(import.meta.dirname, '../app/api/cron/sync-support-inbox/route.ts');
let calls = 0;
let failure = false;
const fixture = { synced: 2 };
const mod = new Module(file);
mod.filename = file;
const require = createRequire(file);
mod.require = name => {
  if (name === '@/lib/imapSync') return { syncSupportInbox: async () => {
    calls++;
    if (failure) throw new Error('synthetic sync failure');
    return fixture;
  } };
  if (name === '@/lib/confidentialiteMesure') return { bilanJournal: x => x, diagnosticJournal: () => 'synthetic' };
  return require(name);
};
mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);
const { GET } = mod.exports;
const { NextRequest } = require('next/server');
const request = authorization => new NextRequest('https://local.invalid/api/cron/sync-support-inbox', {
  headers: authorization === undefined ? {} : { authorization },
});
async function run(secret, req) {
  const previous = process.env.CRON_SECRET;
  if (secret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = secret;
  calls = 0;
  try { return await GET(req); }
  finally { if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous; }
}

test('missing secret rejects literal Bearer undefined before IMAP', async () => {
  const response = await run(undefined, request('Bearer undefined'));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Non autorisé.' });
  assert.equal(calls, 0);
});

test('empty secret rejects even an unnormalized synthetic header before IMAP', async () => {
  // Real Headers trim trailing whitespace; this object exercises the route guard itself.
  const response = await run('', { headers: { get: () => 'Bearer ' } });
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
  const real = await run('', request('Bearer '));
  assert.equal(real.status, 401);
  assert.equal(calls, 0);
});

test('configured secret accepts only the matching bearer and preserves response', async () => {
  const secret = 'synthetic-local-value';
  for (const header of [undefined, 'Bearer wrong', 'Basic synthetic-local-value', 'Bearer undefined']) {
    const response = await run(secret, request(header));
    assert.equal(response.status, 401);
    assert.equal(calls, 0);
  }
  const response = await run(secret, request(`Bearer ${secret}`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, ...fixture });
  assert.equal(calls, 1);
});

test('configured matching bearer preserves sync failure response', async () => {
  failure = true;
  try {
    const response = await run('synthetic-local-value', request('Bearer synthetic-local-value'));
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'synthetic sync failure' });
    assert.equal(calls, 1);
  } finally { failure = false; }
});
