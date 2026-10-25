import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
require('tsx/cjs');
export function load(file, replacements = {}) {
  const filename = path.join(root, file);
  const mod = new Module(filename);
  mod.filename = filename;
  const real = createRequire(filename);
  mod.require = name => Object.hasOwn(replacements, name) ? replacements[name] : real(name.startsWith('@/') ? path.join(root, name.slice(2)) : name);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
export const provider = { generated: 0 };
export const blobMock = { handleUpload: async options => {
  if (options.body.type === 'blob.upload-completed') return { type: 'blob.upload-completed' };
  const rules = await options.onBeforeGenerateToken(options.body.payload.pathname, options.body.payload.clientPayload, false);
  provider.generated++;
  return { rules };
}};
export function request(body) { return new Request('http://localhost/api/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
