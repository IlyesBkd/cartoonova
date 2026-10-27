import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as privacy from '../lib/confidentialiteMesure.ts';

const privateValues = ['customer.privacy@synthetic.invalid', 'CAPABILITY_private_123', 'Private Customer Name', 'private free-form note'];
const raw = privateValues.join(' ') + ' https://blob.invalid/private.jpg?token=CAPABILITY_private_123';
const error = Object.assign(new TypeError(raw), { status: 422, response: { body: raw }, code: raw });
const excluded = /send-final-image|send-poster-confirmation|orders\/extras|bonus\/|emailImageFinale|extras\/carteVoeux/;
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []); }
const ownedLibraries = ['imapSync', 'aiReponse', 'traduction', 'finaliserCommande', 'journalTaches', 'indexation', 'retouches', 'parrainage', 'bonCadeau', 'contenuFiche', 'aiClassify', 'recompenseAvis', 'productFeed'].map(n => `lib/${n}.ts`);
function routeModule(file, modules = {}, extraExports = '') {
  const wire = [], logs = [];
  const sandboxModule = { exports: {} };
  const NextResponse = class extends Response { static json(body, options) { return Response.json(body, options); } };
  const context = {
    module: sandboxModule, exports: sandboxModule.exports, require: id => id === 'next/server' ? { NextResponse } : id === '@/lib/confidentialiteMesure' ? privacy : modules[id] ?? {},
    Response, Request, URL, Date, Error, TypeError, RangeError,
    process: { env: { DISCORD_WEBHOOK_URL: 'https://discord.invalid/webhook', CRON_SECRET: 'synthetic-cron' } },
    console: Object.fromEntries(['error', 'warn', 'log'].map(level => [level, (...args) => logs.push({ level, args })])),
    fetch: async (url, options) => { assert.equal(String(url), 'https://discord.invalid/webhook'); wire.push(JSON.parse(options.body)); return new Response(null, { status: 204 }); },
  };
  const js = ts.transpileModule(readFileSync(file, 'utf8') + '\n' + extraExports, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(js, context);
  return { api: sandboxModule.exports, wire, logs };
}
function assertPrivateFree(value) {
  const text = JSON.stringify(value);
  for (const fixture of privateValues) assert.ok(!text.includes(fixture), `private fixture escaped: ${fixture}`);
}

test('confirm-poster Discord notification sends only operational status/counts, not customer content', async () => {
  const { api, wire, logs } = routeModule('app/api/orders/confirm-poster/route.ts', {}, 'exports.notify = sendDiscordNotification;');
  await api.notify({ id: 'synthetic-order', customer_email: privateValues[0], status: 'changes_requested', note: raw, photos: ['https://blob.invalid/CAPABILITY_private_123'], support: 'Poster', rang: 2 });
  assert.equal(wire.length, 1);
  assertPrivateFree({ wire, logs });
  assert.match(JSON.stringify(wire), /synthet/);
  saveCapture('confirm-poster-safe-discord', { wire, logs });
});

function saveCapture(name, value) {
  if (!process.env.PRIVACY_CAPTURE_DIR) return;
  mkdirSync(process.env.PRIVACY_CAPTURE_DIR, { recursive: true });
  writeFileSync(path.join(process.env.PRIVACY_CAPTURE_DIR, name + '.json'), JSON.stringify(value, null, 2));
}

test('real checkout handler catches database echoes without changing accepted response', async () => {
  const route = routeModule('app/api/checkout/lead/route.ts', {
    '@/i18n/config': { locales: ['fr'] }, '@/lib/currency': { currencies: ['EUR'] }, '@/lib/pricing': { PRINT_KEYS: [] },
    '@/lib/email': { emailValide: () => true },
    '@/lib/rateLimit': { cleDepuisRequete: () => 'synthetic', verifierLimite: () => ({ bloque: false }) },
    '@/lib/leadsCaisse': { enregistrerLead: async () => { throw error; } },
  });
  const response = await route.api.POST(new Request('https://cartoonova.invalid/api/checkout/lead', { method: 'POST', body: JSON.stringify({ email: privateValues[0], locale: 'fr' }) }));
  assert.equal(response.status, 204); assert.equal(route.logs.length, 1);
  assertPrivateFree(route.logs); assert.match(JSON.stringify(route.logs), /422/);
  saveCapture('checkout-handler-safe-console', route.logs);
});

test('real support reply handler logs rejected/throwing provider safely and leaves required recipient unchanged', async () => {
  for (const throws of [false, true]) {
    const transactions = [];
    const route = routeModule('app/api/support/reply/route.ts', {
      '@/lib/adminAuth': { refuserSiPasAdmin: () => null }, '@/lib/email': { emailValide: () => true },
      '@/lib/expediteur': { EXPEDITEUR: 'synthetic@sender.invalid', SUPPORT_EMAIL: 'support@sender.invalid' },
      '@/lib/db': { getOrderById: async () => ({ id: 'synthetic-order', customer_email: privateValues[0] }) },
      '@/lib/envoiEmail': { envoyerEmail: async payload => { transactions.push(payload); if (throws) throw error; return { error }; } },
    });
    const response = await route.api.POST(new Request('https://cartoonova.invalid/api/support/reply', { method: 'POST', body: JSON.stringify({ orderId: 'synthetic-order', corps: raw }) }));
    assert.equal(response.status, throws ? 500 : 502); assert.equal(transactions[0].to[0], privateValues[0]); assert.equal(transactions[0].text, raw);
    assert.equal(route.logs.length, 1); assertPrivateFree(route.logs); assert.match(JSON.stringify(route.logs), /422/);
    saveCapture('support-reply-' + (throws ? 'thrown' : 'rejected') + '-console', route.logs);
  }
});

test('real CSP handler sanitizes malicious directive, resource URL and private access paths before console and Discord', async () => {
  const alerts = [];
  const route = routeModule('app/api/csp/route.ts', { '@/lib/discord': { alerteDiscord: async body => alerts.push(body), COULEUR_ATTENTION: 1 } });
  const response = await route.api.POST(new Request('https://cartoonova.invalid/api/csp', { method: 'POST', body: JSON.stringify({ 'csp-report': { 'effective-directive': raw, 'blocked-uri': raw, 'document-uri': `https://cartoonova.invalid/fr/extras/CAPABILITY_private_123?email=${privateValues[0]}`, 'source-file': raw } }) }));
  assert.equal(response.status, 204); assert.equal(route.logs.length, 1); assert.equal(alerts.length, 1);
  assertPrivateFree({ logs: route.logs, alerts });
  assert.match(JSON.stringify(route.logs), /extras/);
  assert.equal(alerts[0].titre, 'CSP : violations signalées');
  assert.equal(alerts[0].piedDePage, 'Politique bloquante — disposition rapportée par le navigateur');
  saveCapture('csp-handler-safe-outputs', { logs: route.logs, alerts });
});

test('real support sync cron logs safe counters and safe failed-provider diagnostics', async () => {
  for (const throws of [false, true]) {
    const route = routeModule('app/api/cron/sync-support-inbox/route.ts', {
      '@/lib/imapSync': { syncSupportInbox: async () => { if (throws) throw error; return { checked: 3, newMessages: 2, erreur: raw }; } },
    });
    const response = await route.api.GET(new Request('https://cartoonova.invalid/api/cron/sync-support-inbox', { headers: { authorization: 'Bearer synthetic-cron' } }));
    assert.equal(response.status, throws ? 500 : 200);
    assert.equal(route.logs.length, 1); assertPrivateFree(route.logs);
    assert.match(JSON.stringify(route.logs), throws ? /422/ : /checked/);
    saveCapture('sync-cron-' + (throws ? 'failed' : 'success') + '-console', route.logs);
  }
});

test('job journal stores only safe new error/category and numeric summaries, not raw customer/provider content', async () => {
  const writes = [];
  const journal = routeModule('lib/journalTaches.ts', { './db': { sql: async (strings, ...values) => { writes.push({ sql: strings.join('?'), values }); return []; } } });
  await journal.api.enregistrerPassage('synthetic-task', false, new Date(), { produit: 2, sent: 1, erreur: raw, [raw]: raw }, raw);
  assert.equal(writes.length, 3); assertPrivateFree(writes);
  assert.ok(writes[2].values.includes(2));
  saveCapture('job-journal-safe-write', writes);
});

test('cron aggregate logger bounds cyclic provider-shaped results', () => {
  const result = { sent: 2, failed: 1, erreur: raw }; result.photos = result;
  assert.doesNotThrow(() => privacy.bilanJournal(result));
  assertPrivateFree(privacy.bilanJournal(result));
  assert.equal(privacy.bilanJournal(result).sent, 2);
});

function capture() {
  const captures = [];
  for (const file of [...files('app/api'), ...ownedLibraries].filter(f => !excluded.test(f))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isCallExpression(node) && /^console\.(error|warn|log|info|debug)$/.test(node.expression.getText(source))) {
        const order = { id: 'synthetic-order', payment_intent_id: 'pi_synthetic', customer_email: privateValues[0] };
        const context = {
          ...privacy, error, erreur: error, e: error, message: raw, detail: raw, label: raw,
          result: { sent: 2, failed: 1, checked: 3, newMessages: 1, enAttente: 4, recap: { impressions: 2 }, erreur: raw, nested: { recipient: raw }, [raw]: raw },
          order, commande: order, lead: { id: 'synthetic-lead' }, orderId: order.id, paymentIntentId: 'pi_synthetic', pi: { id: 'pi_synthetic' },
          step: 2, tache: 'synthetic-task', source: 'webhook', code: 'CAPABILITY_private_123', produit: 'simpson', locale: 'fr', reparee: true,
          r: { status: 422 }, response: { status: 422, body: raw }, resultError: error, envoi: { error }, resultResend: { error },
          v: { directive: 'script-src', bloque: raw, page: `https://cartoonova.invalid/extras/CAPABILITY_private_123?email=${privateValues[0]}`, source: raw },
          cheminPropre: () => '/extras/CAPABILITY_private_123',
        };
        // The confirm-poster result represents the real Resend rejection shape.
        if (file.includes('confirm-poster')) context.result = { error };
        if (file === 'app/api/csp/route.ts') {
          context.URL = URL;
          const functions = source.statements.filter(ts.isFunctionDeclaration).filter(n => !n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)).map(n => n.getText(source)).join('\n');
          vm.runInNewContext(ts.transpileModule(functions + '\nglobalThis.cheminPropre = cheminPropre; globalThis.directive = directiveCsp(v.directive); globalThis.bloque = ressourceCsp(v.bloque); globalThis.source = ressourceCsp(v.source);', {}).outputText, context);
        }
        const expression = '[' + node.arguments.map(a => a.getText(source)).join(',') + ']';
        const js = ts.transpileModule('globalThis.captured = ' + expression, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
        vm.runInNewContext(js, context, { timeout: 1000 });
        captures.push({ file, line: source.getLineAndCharacterOfPosition(node.pos).line + 1, args: context.captured });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return captures;
}
test('all owned route/cron and dependent-library console arguments reject private provider errors and capabilities', () => {
  const captures = capture();
  for (const entry of captures) {
    const serialized = JSON.stringify(entry.args, (k, v) => v instanceof Error ? { message: v.message, stack: v.stack, ...v } : v);
    for (const value of privateValues) assert.ok(!serialized.includes(value), `${entry.file}:${entry.line} leaked ${value}`);
  }
  assert.ok(captures.length > 80);
  assert.ok(captures.some(c => c.file.includes('lifecycle-emails') && JSON.stringify(c.args).includes('synthetic-order')));
  assert.ok(captures.some(c => c.file === 'app/api/chat/route.ts' && c.args.includes('[POST /api/chat] Discord indisponible') && c.args.includes(422)), 'chat Discord rejection must log only its numeric status');
  if (process.env.PRIVACY_CAPTURE_DIR) {
    mkdirSync(process.env.PRIVACY_CAPTURE_DIR, { recursive: true });
    writeFileSync(path.join(process.env.PRIVACY_CAPTURE_DIR, 'route-console-arguments.json'), JSON.stringify(captures, null, 2));
  }
});
