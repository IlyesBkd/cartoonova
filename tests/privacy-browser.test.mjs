import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright';
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

test('real browser SDK transport never exports email identity, nested PII, photo URL or signed query/path', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36' });

    const payloads = [];
    await page.route('**/*', async route => {
      if (route.request().isNavigationRequest()) return route.fulfill({ body: '<html><body>synthetic</body></html>', contentType: 'text/html' });
      if (route.request().method() === 'POST') {
        const raw = route.request().postDataBuffer();
        payloads.push(raw?.[0] === 31 && raw?.[1] === 139 ? gunzipSync(raw).toString() : raw?.toString());
      }
      else { const data = new URL(route.request().url()).searchParams.get('data'); if (data) payloads.push('data=' + encodeURIComponent(data)); }
      return route.fulfill({ body: '{}', contentType: 'application/json' });
    });
    await page.goto('https://shop.synthetic.invalid/suivi/synthetic-access-token-123?arbitrary=synthetic-access-token-123');
    await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    await page.evaluate(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    await page.addScriptTag({ content: readFileSync(new URL('../node_modules/posthog-js/dist/array.full.no-external.js', import.meta.url), 'utf8') });
    const privacy = compile('../lib/confidentialiteMesure.ts');
    const analytics = compile('../lib/analytics.ts');
    const consent = compile('../lib/consentementMesure.ts');
    const pixel = compile('../lib/pixelChatgpt.ts');
    await page.evaluate(async ({privacy, analytics, consent, pixel}) => {
      const consentExports = {};
      new Function('exports', consent)(consentExports);
      // This transport audit exercises the explicitly opted-in branch.
      consentExports.enregistrerChoixMesure('granted');
      const pixelExports = {};
      new Function('exports','require','process',pixel)(pixelExports, name=>{
        if(name==='@/lib/consentementMesure')return consentExports;
        throw new Error('unexpected module '+name);
      },{env:{}});
      const privacyExports = {};
      new Function('exports', privacy)(privacyExports);
      const exports = {};
      new Function('exports', 'require', 'process', analytics)(exports, name => {
        if (name === 'posthog-js') return { default: window.posthog };
        if (name === '@/lib/consentementMesure') return consentExports;
        if (name === '@/lib/pixelChatgpt') return pixelExports;
        if (name === '@/lib/confidentialiteMesure') return privacyExports;
        throw new Error('unexpected module '+name);
      }, { env: { NEXT_PUBLIC_POSTHOG_KEY: 'phc_synthetic' } });
      window.analyticsTest = exports;
      exports.mesure('$pageview', { initial: true });
      await new Promise(resolve => setTimeout(resolve, 100));
      window.posthog.set_config({ request_batching: false, disable_compression: true, api_transport: 'fetch', opt_out_useragent_filter: true });
      const email = 'privacy.customer@synthetic.invalid';
      exports.identifier(email, { email });
      exports.mesure('privacy_synthetic', {
        amount: 42,
        nested: [{ email, photoUrl: 'https://synthetic.public.blob.vercel-storage.com/private-photo.jpg', token: 'synthetic-access-token-123' }],
        $current_url: 'https://shop.synthetic.invalid/suivi/synthetic-access-token-123?arbitrary=synthetic-access-token-123',
        $set: { email },
      });

      await new Promise(resolve => setTimeout(resolve, 200));
    }, {privacy, analytics, consent, pixel});
    assert.equal(await page.evaluate(() => window.posthog.config.disable_session_recording), true, 'unverifiable compressed replay must stay disabled; business events remain active');
    assert.ok(payloads.length > 0, 'no SDK network payload captured');
    const decoded = payloads.map(body => {
      try { return JSON.parse(body); } catch {
        const params = new URLSearchParams(body); const data = params.get('data');
        return data ? JSON.parse(Buffer.from(data, 'base64').toString()) : body;
      }
    });
    const text = JSON.stringify(decoded);
    assert.match(text, /privacy_synthetic/);
    assert.match(text, /42/);

    for (const value of ['privacy.customer@synthetic.invalid', 'private-photo.jpg', 'synthetic-access-token-123']) assert.ok(!text.includes(value), `private fixture escaped: ${value}`);
    if (process.env.PRIVACY_CAPTURE_DIR) {
      mkdirSync(process.env.PRIVACY_CAPTURE_DIR, { recursive: true });
      writeFileSync(path.join(process.env.PRIVACY_CAPTURE_DIR, 'browser-transport.json'), JSON.stringify(decoded, null, 2));
    }
  } finally { await browser.close(); }
});
