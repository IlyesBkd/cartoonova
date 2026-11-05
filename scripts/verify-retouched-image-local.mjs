// Local built UI only. Every API and all external network requests intercepted.
// Run after python scripts/verify-ten-cards-local.py, and the synthetic mail test.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { chromium } from 'playwright';
const root = path.resolve(import.meta.dirname, '..');
assert.ok(!readdirSync(root).some(f => f.startsWith('.env')), 'Refuse local env files');
const out = process.env.RETOUCH_EVIDENCE_DIR;
assert.ok(out && path.isAbsolute(out), 'Set absolute RETOUCH_EVIDENCE_DIR');
assert.ok(existsSync(path.join(root, '.next-ten-local/BUILD_ID')), 'Isolated build required');
mkdirSync(out, { recursive: true });
const probe = net.createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r));
const port = probe.address().port; await new Promise(r => probe.close(r));
const origin = `http://127.0.0.1:${port}`;
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'PLAYWRIGHT_BROWSERS_PATH'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, { CARTOONOVA_BUILD_DIR: '.next-ten-local', NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: 'postgresql://synthetic@127.0.0.1:1/no_database', RESEND_API_KEY: 're_synthetic_no_send' });
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', b => { serverLog += b; }); server.stderr.on('data', b => { serverLog += b; });
let browser;
const order = {
  id: '11111111-1111-4111-8111-111111111111', customer_email: 'buyer@example.invalid', customer_name: 'Client de démonstration',
  total_price: 29.9, currency: 'eur', options: { printOption: 'digital', style: 'simpson', numberOfPeople: 1 }, photo_urls: [],
  status: 'PAID', paid_at: '2026-10-01T12:00:00Z', created_at: '2026-10-01T12:00:00Z', final_image_url: 'https://synthetic.invalid/final/B.png',
  final_image_sent_at: '2026-10-03T12:00:00Z', final_image_scheduled_at: null, detected_country: 'FR', langue: 'fr', poster_confirmation_status: null,
};
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="240"><rect width="500" height="240" fill="#d1fae5"/><circle cx="250" cy="85" r="40" fill="#fbbf24"/><path d="M180 220 Q250 110 320 220" fill="#10b981"/><text x="250" y="28" text-anchor="middle" font-family="sans-serif" font-size="15">PORTRAIT SYNTHÉTIQUE — TEST LOCAL</text></svg>';
const payloads = [], errors = [];
try {
  for (let i = 0; i < 100; i++) {
    try { await fetch(origin + '/fr/admin'); break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1800, height: 1100 }, serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== origin) {
      if (req.resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: svg });
      return route.abort();
    }
    if (url.pathname.startsWith('/api/')) {
      let body = [];
      if (url.pathname === '/api/admin/auth') body = { ok: true };
      else if (url.pathname === '/api/orders') body = [order];
      else if (url.pathname === '/api/orders/send-final-image') { payloads.push(req.postDataJSON()); body = { ok: true, emailId: 'synthetic-browser-capture' }; }
      else if (url.pathname === '/api/prices/all') return route.fulfill({ status: 503, json: {} });
      return route.fulfill({ json: body });
    }
    return route.continue();
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/fr/admin');
  await page.getByRole('row').filter({ hasText: 'buyer@example.invalid' }).click();
  const button = page.getByRole('button', { name: 'Envoyer le portrait retouché', exact: true });
  await button.waitFor({ state: 'visible' }); await button.scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + '/admin-retouche.png', fullPage: false });
  await page.locator('div.bg-emerald-50').filter({ has: button }).screenshot({ path: out + '/admin-retouche-detail.png' });
  page.once('dialog', async d => { assert.match(d.message(), /buyer@example.invalid/); await d.accept(); });
  await button.click();
  await page.getByText('Email envoyé avec succès !', { exact: true }).waitFor();
  assert.equal(payloads.length, 1); assert.equal(payloads[0].deliveryMode, 'retouch');
  assert.equal(payloads[0].finalImageUrl, order.final_image_url);
  assert.ok((await page.locator('body').innerText()).includes('03/10/2026'), 'Original first delivery date remains visible');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: out + '/admin-retouche-apres-clic-simule.png', fullPage: false });
  const emailPath = out + '/retouch-fr.html';
  if (existsSync(emailPath)) {
    const mail = await context.newPage();
    await mail.setContent(readFileSync(emailPath, 'utf8'));
    await mail.screenshot({ path: out + '/email-retouche-fr.png', fullPage: true });
  }
  const report = { success: true, builtAdminUI: true, apiMocked: true, externalNetworkBlocked: true, realEmailSent: false, payloads, pageErrors: errors };
  writeFileSync(out + '/browser-retouch.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser?.close(); server.kill('SIGTERM');
  await new Promise(r => server.exitCode !== null ? r() : server.once('exit', r));
  writeFileSync(out + '/local-server.log', serverLog);
}
