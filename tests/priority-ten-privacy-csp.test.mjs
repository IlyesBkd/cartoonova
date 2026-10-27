import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import vm from 'node:vm';
import ts from 'typescript';
import {chromium} from 'playwright';
const root = new URL('..', import.meta.url).pathname;
const require = createRequire(new URL('../package.json', import.meta.url));
function load(file, env = {NODE_ENV:'production'}) {
 const sandboxModule = {exports:{}};
 const localRequire = id => id.startsWith('.') ? load(new URL(id + '.ts', 'file://' + file).pathname, env) : require(id);
 vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText, {module:sandboxModule,exports:sandboxModule.exports,require:localRequire,process:{env},console,URL});
 return sandboxModule.exports;
}
function evidence(name, data) {
 if (!process.env.PRIVACY_CAPTURE_DIR) return;
 mkdirSync(process.env.PRIVACY_CAPTURE_DIR,{recursive:true});
 writeFileSync(process.env.PRIVACY_CAPTURE_DIR+'/'+name+'.json',JSON.stringify(data,null,2));
}
test('CRO-10 ten legal catalogs reuse the implemented default-on / refusal / disabled-advertising notices', () => {
 const {COOKIE_CONSENT,COOKIE_CHOICES} = load(root+'lib/i18n/cookieConsent.ts');
 const locales = ['fr','en','de','es','it','nl','pl','sv','da','pt'];
 assert.deepEqual(Object.keys(COOKIE_CONSENT).sort(),locales.toSorted());
 const proof=[];
 for (const locale of locales) {
  const notice = COOKIE_CONSENT[locale].notice;
  assert.ok(notice.includes('PostHog') && notice.includes('ChatGPT'));
  assert.ok(notice.includes(COOKIE_CHOICES[locale].refuser));
  const legal = load(root+'lib/legal/'+locale+'.ts');
  const strings=[];
  function visit(value) {if(typeof value==='string')strings.push(value);else if(value&&typeof value==='object')Object.values(value).forEach(visit);}
  visit(legal);
  assert.equal(strings.filter(s=>s===notice).length,2,locale+': terms and privacy must share the exact current notice');
  proof.push({locale,notice,choices:COOKIE_CHOICES[locale],legalOccurrences:2});
 }
 evidence('ten-locale-consent-notices',proof);
});

test('CODE-14 actual Next config exposes enforcing production headers without unsafe-eval',async()=>{
 const config=load(root+'next.config.ts').default;
 const rules=await config.headers();
 assert.equal(rules[0].source,'/(.*)');
 const headers=Object.fromEntries(rules[0].headers.map(h=>[h.key,h.value]));
 const policy=headers['Content-Security-Policy'];
 assert.ok(policy);assert.equal(headers['Content-Security-Policy-Report-Only'],undefined);
 for(const directive of ["default-src 'self'","object-src 'none'","script-src-attr 'none'","base-uri 'self'","frame-ancestors 'none'","form-action 'self' https://hooks.stripe.com",'report-uri /api/csp'])assert.ok(policy.split('; ').includes(directive),directive);
 assert.ok(!policy.includes("'unsafe-eval'"));
 assert.ok(policy.includes("'unsafe-inline'"),'inline-script residual must remain explicit, not misreported as nonce strict');
 assert.equal(headers['X-Content-Type-Options'],'nosniff');assert.equal(headers['X-Frame-Options'],'DENY');
 assert.equal(headers['Permissions-Policy'],'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")');
 const dev=await load(root+'next.config.ts',{NODE_ENV:'development'}).default.headers();
 assert.ok(dev[0].headers.find(h=>h.key==='Content-Security-Policy').value.includes("'unsafe-eval'"));
 evidence('csp-config-headers',{headers,nonceStrict:false,realStripePaymentTested:false,realWalletTested:false});
});

async function withCspResources(server, launch, probe) {
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try {
  browser=await launch();
  return await probe(browser, 'http://127.0.0.1:'+server.address().port);
 } finally {
  try { await browser?.close(); }
  finally { await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())); }
 }
}

test('CSP cleanup closes the actual listener when Chromium launch fails',async()=>{
 const server=createServer();
 try {
  await assert.rejects(withCspResources(server,()=>chromium.launch({executablePath:'/nonexistent/cartoonova-cleanup-chromium'}),()=>assert.fail('probe must not run')),/executable.*exist/i);
  assert.equal(server.listening,false);
 } finally { if(server.listening)await new Promise(r=>server.close(r)); }
});

test('CSP cleanup closes the actual listener even when browser.close rejects',async()=>{
 const server=createServer();
 try {
  await assert.rejects(withCspResources(server,async()=>({close:async()=>{throw new Error('close failed');}}),async()=>{}),/close failed/);
  assert.equal(server.listening,false);
 } finally { if(server.listening)await new Promise(r=>server.close(r)); }
});

test('CODE-14 Chromium enforces actual CSP: blocked script, handler, eval, connection, frame, form, base and object; allowed origins are synthetic probes only',async()=>{
 const headers=Object.fromEntries((await load(root+'next.config.ts').default.headers())[0].headers.map(h=>[h.key,h.value]));
 const server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html',...headers});res.end('<main>CSP local fixture</main>');});
 await withCspResources(server,()=>chromium.launch({headless:true}),async(browser,origin)=>{
  const page=await browser.newPage();const wire=[];
  await page.route('**/*',async route=>{
   const u=route.request().url();
   if(u===origin+'/'){
    const response=await fetch(u);
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
   }
   wire.push(u);
   if(u===origin+'/self.js'||u==='https://js.stripe.com/probe.js')return route.fulfill({contentType:'text/javascript',body:`window.allowedScript=(window.allowedScript||0)+1;try{eval('window.badEval=true')}catch{window.evalBlocked=true}`});
   if(u===origin+'/ingest/probe')return route.fulfill({contentType:'application/json',body:'{}'});
   if(u==='https://js.stripe.com/probe-frame')return route.fulfill({contentType:'text/html',body:'synthetic Stripe-origin frame, not SDK'});
   if(u===origin+'/api/csp')return route.fulfill({status:204,body:''});
   return route.abort();
  });
  await page.goto(origin);
  await page.evaluate(async()=>{
   window.violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));
   for(const src of ['/self.js','https://js.stripe.com/probe.js','https://evil.invalid/script.js']){const s=document.createElement('script');s.src=src;document.body.append(s);}
   const inline=document.createElement('script');inline.textContent='window.inlineResidual=true';document.body.append(inline);
   const b=document.createElement('button');b.setAttribute('onclick','window.badHandler=true');document.body.append(b);b.click();
   fetch('https://evil.invalid/event').catch(()=>{});await fetch('/ingest/probe');
   for(const src of ['https://evil.invalid/frame','https://js.stripe.com/probe-frame']){const f=document.createElement('iframe');f.src=src;document.body.append(f);}
   const base=document.createElement('base');base.href='https://evil.invalid/';document.head.append(base);
   const object=document.createElement('object');object.data='/plugin';object.type='application/pdf';document.body.append(object);
   const form=document.createElement('form');form.action='https://evil.invalid/submit';document.body.append(form);form.submit();
  });
  await page.waitForFunction(()=>window.allowedScript===2 && ['script-src-elem','script-src-attr','script-src','connect-src','frame-src','base-uri','object-src','form-action'].every(d=>violations.some(v=>v.directive===d)),null,{timeout:3000});
  const result=await page.evaluate(()=>({allowedScript,inlineResidual,evalBlocked,badHandler:!!window.badHandler,badEval:!!window.badEval,violations,baseURI:document.baseURI}));
  assert.equal(result.badHandler,false);assert.equal(result.badEval,false);assert.equal(result.inlineResidual,true);assert.equal(result.baseURI,origin+'/');
  assert.equal(wire.some(u=>u.startsWith('https://evil.invalid/')),false,'CSP blocks before transport');
  assert.ok(wire.includes(origin+'/ingest/probe'));assert.ok(wire.includes('https://js.stripe.com/probe-frame'));
  evidence('csp-browser-local',{...result,wire,realStripePaymentTested:false,realWalletTested:false,syntheticOriginProbesOnly:true});
 });
});
