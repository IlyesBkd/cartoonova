import { pathToFileURL } from 'node:url';

/** No fallback between modes; never export credentials or provider errors. */
export async function inspectDomains({ mode, domain, env = process.env, fetcher = fetch }) {
  const base = { mode, domain, registration: 'inconnu', applePay: 'inconnu', googlePay: 'inconnu' };
  if (!['live', 'test'].includes(mode)) return { ...base, reason: 'invalid_mode' };
  if (typeof domain !== 'string' || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) return { ...base, domain: null, reason: 'invalid_domain' };
  const key = env[mode === 'test' ? 'CARTOONOVA_STRIPE_TEST_SECRET_KEY' : 'STRIPE_SECRET_KEY'];
  if (!key) return { ...base, reason: 'credential_missing' };
  if (!new RegExp(`^[sr]k_${mode}_[A-Za-z0-9]+$`).test(key)) return { ...base, reason: 'invalid_credential_mode' };
  const matches = [];
  let cursor;
  const seen = new Set();
  try {
    for (let page = 0; page < 20; page++) {
      const url = new URL('https://api.stripe.com/v1/payment_method_domains');
      url.searchParams.set('domain_name', domain);
      url.searchParams.set('limit', '100');
      if (cursor) url.searchParams.set('starting_after', cursor);
      const res = await fetcher(url, { method: 'GET', headers: { Authorization: `Bearer ${key}` }, redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!res.ok) return { ...base, reason: 'provider_http_error', httpStatus: res.status };
      const body = await res.json();
      if (!Array.isArray(body.data) || typeof body.has_more !== 'boolean') return { ...base, reason: 'invalid_provider_response' };
      for (const row of body.data) {
        if (row.livemode !== (mode === 'live')) return { ...base, reason: 'provider_mode_mismatch' };
        if (row.domain_name === domain) matches.push(row);
      }
      if (!body.has_more) {
        if (!matches.length) return { ...base, registration: 'absent', applePay: 'absent', googlePay: 'absent', reason: 'domain_not_registered', pages: page + 1 };
        if (matches.length !== 1) return { ...base, reason: 'ambiguous_domain_records' };
        const row = matches[0];
        const state = (value) => row.enabled === false ? 'absent' : row.enabled !== true ? 'inconnu' : value === 'active' ? 'présent' : value === 'inactive' ? 'absent' : 'inconnu';
        return { ...base, registration: 'présent', enabled: typeof row.enabled === 'boolean' ? row.enabled : null, applePay: state(row.apple_pay?.status), googlePay: state(row.google_pay?.status), reason: 'domain_record_read', pages: page + 1 };
      }
      cursor = body.data.at(-1)?.id;
      if (typeof cursor !== 'string' || !/^pmd_[A-Za-z0-9]+$/.test(cursor) || seen.has(cursor)) return { ...base, reason: 'invalid_pagination' };
      seen.add(cursor);
    }
    return { ...base, reason: 'pagination_limit' };
  } catch {
    return { ...base, reason: 'provider_transport_or_json_error' };
  }
}

export async function inspectPublic({ fetcher = fetch } = {}) {
  const target = 'https://www.cartoonova.com/fr/simpson';
  const report = { target, httpStatus: null, publishableKey: { live: 'inconnu', test: 'inconnu' }, chunksComplete: false, csp: { enforcement: 'inconnu', inlineScript: 'inconnu' } };
  const keys = {};
  const headers = {};
  try {
    const get = (url) => fetcher(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000) });
    const res = await get(target);
    report.httpStatus = res.status;
    if (!res.ok) return { report, keys, headers };
    for (const name of ['content-security-policy', 'content-security-policy-report-only', 'permissions-policy']) headers[name] = res.headers.get(name) || '';
    const policy = headers['content-security-policy'];
    report.csp = { enforcement: policy ? 'présent' : 'absent', policy, reportOnly: Boolean(headers['content-security-policy-report-only']), inlineScript: /(?:script-src(?:-elem)?)[^;]*'unsafe-inline'/.test(policy) ? 'présent' : 'absent', permissionsPolicy: headers['permissions-policy'] };
    const html = await res.text();
    const scripts = [...new Set([...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map((m) => new URL(m[1], target)).filter((u) => u.origin === new URL(target).origin && u.pathname.startsWith('/_next/static/') && u.pathname.endsWith('.js')).map(String))];
    let complete = scripts.length <= 40;
    const queue = [...scripts];
    const seenChunks = new Set(queue);
    let scanned = 0;
    const scan = (text) => {
      for (const match of text.matchAll(/pk_(live|test)_[A-Za-z0-9]+/g)) keys[match[1]] = match[0];
      for (const match of text.matchAll(/static\/(?:immutable\/)?chunks\/[A-Za-z0-9_.~-]+\.js/g)) {
        const url = new URL(`/_next/${match[0]}`, target).href;
        if (!seenChunks.has(url)) { seenChunks.add(url); queue.push(url); }
      }
    };
    scan(html);
    while (queue.length && scanned < 80) {
      const url = queue.shift();
      scanned++;
      try { const chunk = await get(url); if (!chunk.ok) complete = false; else scan(await chunk.text()); } catch { complete = false; }
    }
    if (queue.length) complete = false;
    report.publishableKeyScope = 'reachable static JavaScript from this page only; not all account configuration';
    report.chunksScanned = scanned;
    report.chunksComplete = complete;
    for (const mode of ['live', 'test']) report.publishableKey[mode] = keys[mode] ? 'présent' : complete ? 'absent' : 'inconnu';
  } catch { report.reason = 'public_transport_or_parse_error'; }
  return { report, keys, headers };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const publicState = await inspectPublic();
  const domains = [];
  for (const mode of ['test', 'live']) for (const domain of ['www.cartoonova.com', 'cartoonova.com']) domains.push(await inspectDomains({ mode, domain }));
  console.log(JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), paymentCreated: false, configurationChanged: false, public: publicState.report, domains }, null, 2));
}
