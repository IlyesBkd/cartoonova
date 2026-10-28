import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { inspectPublic } from './code14-wallet-preflight.mjs';

/** Fail closed: no app API, no payment/confirmation/token endpoints, no POST at all. */
export function sdkRequestAllowed(method, address) {
  try {
    const u = new URL(address);
    if (method !== 'GET' || u.protocol !== 'https:') return false;
    if (u.hostname === 'api.stripe.com') return u.pathname === '/v1/elements/sessions';
    return /(^|\.)(js\.stripe\.com|stripe\.network|stripecdn\.com)$/.test(u.hostname) || ['pay.google.com', 'www.gstatic.com', 'm.stripe.network'].includes(u.hostname);
  } catch { return false; }
}

/** Ephemeral, empty browser profile, real SDK, no enrolled wallet asserted or fabricated. */
export async function probeBrowser({ mode, key, headers = {}, executablePath } = {}) {
  const result = { generatedAt: new Date().toISOString(), platform: process.platform, cspSha256: createHash('sha256').update(headers['content-security-policy'] || '').digest('hex'), mode, fixture: 'intercepted HTTPS document; real provider SDK/resources; no app checkout', sdkLoaded: false, ready: false, applePay: 'inconnu', googlePay: 'inconnu', enrolledWallet: 'inconnu', paymentCreated: false, confirmationCalled: false, writesAllowed: false, blockedRequests: 0, violations: [], frames: [] };
  if (!['test', 'live'].includes(mode) || typeof key !== 'string' || !new RegExp(`^pk_${mode}_[A-Za-z0-9]+$`).test(key)) return { ...result, reason: 'invalid_publishable_key_mode' };
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true, executablePath, env: Object.fromEntries(['PATH', 'HOME', 'TMPDIR'].filter(name => process.env[name]).map(name => [name, process.env[name]])), args: ['--no-sandbox'] });
    result.browserVersion = browser.version();
    result.network = { allowedGet: 0, blockedWrite: 0, blockedPaymentEndpoints: 0, blockedOther: 0 };
    const context = await browser.newContext({ serviceWorkers: 'block', locale: 'fr-FR' });
    const target = 'https://www.cartoonova.com/__code14_wallet_preflight__';
    const fixture = `<!doctype html><meta charset="utf-8"><title>CODE14 no-payment SDK preflight</title><div id="wallet"></div>
<script src="https://js.stripe.com/v3/"></script><script>
window.__code14 = { ready: false, available: null, violations: [] };
document.addEventListener('securitypolicyviolation', e => window.__code14.violations.push(e.effectiveDirective));
window.__code14boot = (key) => {
  const stripe = Stripe(key);
  const elements = stripe.elements({mode:'payment',amount:499,currency:'eur',locale:'fr'});
  const ece = elements.create('expressCheckout');
  const update = e => { window.__code14.ready = true; window.__code14.available = e.availablePaymentMethods || null; };
  ece.on('ready', update);
  ece.on('availablepaymentmethodschange', update);
  ece.on('loaderror', () => { window.__code14.loadError = true; });
  // Deliberately no click, confirm, resolve, submit or payment API handler.
  ece.mount('#wallet');
};</script>`;
    await context.route('**/*', async (route) => {
      const request = route.request();
      if (request.url() === target && request.method() === 'GET' && request.isNavigationRequest()) {
        const safeHeaders = { 'content-type': 'text/html; charset=utf-8' };
        for (const name of ['content-security-policy', 'permissions-policy']) if (headers[name]) safeHeaders[name] = headers[name];
        return route.fulfill({ status: 200, headers: safeHeaders, body: fixture });
      }
      if (sdkRequestAllowed(request.method(), request.url())) {
        result.network.allowedGet++;
        return route.continue();
      }
      result.blockedRequests++;
      if (/\/v1\/(payment_intents|setup_intents|payment_methods|checkout|tokens)(\/|\?|$)/.test(new URL(request.url()).pathname)) result.network.blockedPaymentEndpoints++;
      else if (request.method() !== 'GET') result.network.blockedWrite++;
      else result.network.blockedOther++;
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto(target, { waitUntil: 'load', timeout: 25000 });
    result.sdkLoaded = await page.evaluate(() => typeof window.Stripe === 'function');
    if (!result.sdkLoaded) return { ...result, reason: 'sdk_unavailable' };
    await page.evaluate((publicKey) => window.__code14boot(publicKey), key);
    try { await page.waitForFunction(() => window.__code14.ready || window.__code14.loadError, null, { timeout: 20000 }); } catch { /* bounded unknown */ }
    const state = await page.evaluate(() => ({ ready: window.__code14.ready, available: { applePay: window.__code14.available?.applePay, googlePay: window.__code14.available?.googlePay }, violations: window.__code14.violations.filter(v => typeof v === 'string' && /^[a-z-]+$/.test(v)) }));
    result.ready = state.ready;
    for (const method of ['applePay', 'googlePay']) result[method] = !state.ready ? 'inconnu' : state.available[method] === true ? 'présent' : 'absent';
    result.violations = [...new Set(state.violations)];
    result.frames = await page.locator('iframe').evaluateAll(nodes => nodes.map(n => ({ origin: new URL(n.src).origin, paymentDelegated: /\bpayment\b/.test(n.getAttribute('allow') || '') })));
    result.reason = state.ready ? 'ready_in_empty_headless_profile_not_enrollment_proof' : 'ready_not_observed_restricted_transport';
    return result;
  } catch { return { ...result, reason: 'browser_or_sdk_error_filtered' }; }
  finally {
    if (browser) {
      try { await browser.close(); result.browserClosed = true; }
      catch { result.browserClosed = false; }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] || 'test';
  const publicState = await inspectPublic();
  const key = mode === 'test' ? process.env.CARTOONOVA_STRIPE_TEST_PUBLISHABLE_KEY : publicState.keys.live;
  console.log(JSON.stringify(await probeBrowser({ mode, key, headers: publicState.headers }), null, 2));
}
