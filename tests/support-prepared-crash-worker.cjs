/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS worker used by the crash harness. */
const { readFileSync, existsSync } = require('node:fs');
const { createRequire, Module } = require('node:module');
const path = require('node:path');
const postgres = require('postgres');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
process.on('message', async ({ url, id, fingerprint, stall }) => {
  const sql = postgres(url, { max: 1, onnotice() {} });
  function load(file, cache = new Map()) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file); mod.filename = file; cache.set(file, mod);
    const original = createRequire(file);
    mod.require = name => {
      if (name === '@/lib/db') return { sql, withFreshDatabaseClient: async run => {
        const client = postgres(url, { max: 1, onnotice() {} });
        try { return await run(client); } finally { await client.end({ timeout: 2 }); }
      } };
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.resolve(root, name.slice(2)) : path.resolve(path.dirname(file), name);
        if (existsSync(base + '.ts')) return load(base + '.ts', cache);
      }
      return original(name);
    };
    mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
    return mod.exports;
  }
  try {
    await load('lib/supportPreparedDelivery.ts').sendPreparedSupportReply(id, fingerprint, async () => {
      process.send({ provider: true });
      if (stall) await new Promise(() => {});
      return { id: 'worker-provider' };
    });
  } catch {}
  await sql.end({ timeout: 2 });
  process.exit(0);
});
