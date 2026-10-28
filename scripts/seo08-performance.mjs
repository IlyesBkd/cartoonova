import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='/home/hermes/.hermes/profiles/cartoonova/cache/four-followup/performance';
await mkdir(out,{recursive:true});
const hashes={};for(const file of ['components/pages/Accueil.tsx','app/[locale]/[produit]/FicheProduit.tsx','scripts/seo08-performance.mjs'])hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');await writeFile(out+'/'+(process.env.LABEL||'diagnostic')+'-hashes.json',JSON.stringify(hashes,null,2));
const browser=await chromium.launch({headless:true,args:['--disable-features=LocalNetworkAccessChecks']});
const results=[];
try {
for(const route of (process.env.ROUTE?[process.env.ROUTE]:['/fr/simpson','/fr'])){
// Replay the actual SSR response to exclude DB refusal/retry and dev compile time.
const warm=await browser.newPage();await warm.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'&&r.request().method()==='GET'?r.continue():r.abort());const response=await warm.goto('http://127.0.0.1:3188'+route,{waitUntil:'domcontentloaded',timeout:90000});const html=await response.text();await warm.close();await writeFile(out+'/'+process.env.LABEL+'-'+route.split('/').at(-1)+'.html',html);
for(let run=0;run<Number(process.env.RUNS||3);run++){
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();const errors=[];const blocked=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await page.route('**/*',r=>{if(new URL(r.request().url()).hostname==='127.0.0.1'&&r.request().method()==='GET')return r.continue();blocked.push(r.request().method()+' '+r.request().url());return r.abort();});
await page.route('**/api/prices?*',r=>r.fulfill({json:{base:5,fullbodyExtra:5,extraPerson:5,extraAnimal:5,digital:0,canvas:39,poster:59,posterSimple:19,banner:3,extraDecor:5,express:7,carteVoeux:4,calendrier:9,shipping:4.9}}));
if(process.env.REPLAY)await page.route('http://127.0.0.1:3188'+route,r=>r.fulfill({contentType:'text/html',body:html}));
await page.addInitScript(()=>{window.lcps=[];new PerformanceObserver(l=>l.getEntries().forEach(e=>window.lcps.push({time:e.startTime,url:e.url,size:e.size,element:e.element?.outerHTML}))).observe({type:'largest-contentful-paint',buffered:true});});
await page.goto('http://127.0.0.1:3188'+route,{waitUntil:'networkidle',timeout:90000});
await page.waitForTimeout(1500);
if(route.endsWith('/simpson')){try{await page.waitForFunction(()=>document.querySelector('button.ajouter')?.disabled===false,{},{timeout:45000});}catch(e){errors.push(e.message);errors.push((await page.locator('body').innerText()).slice(-3000));}await page.waitForLoadState('networkidle');await page.waitForTimeout(1000);}
results.push({route,errors,blocked,...await page.evaluate(()=>({disabled:document.querySelector('button.ajouter')?.disabled,title:document.title,navigation:performance.getEntriesByType('navigation').map(e=>({responseStart:e.responseStart,responseEnd:e.responseEnd,domContentLoaded:e.domContentLoadedEventEnd,load:e.loadEventEnd})),lcp:window.lcps,images:[...document.images].filter(e=>e.getBoundingClientRect().top<innerHeight).map(e=>({src:e.currentSrc,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,loading:e.loading,priority:e.fetchPriority,natural:e.naturalWidth})),resources:performance.getEntriesByType('resource').map(e=>({name:e.name,duration:e.duration,size:e.transferSize,start:e.startTime}))}))});
await writeFile(out+'/'+(process.env.LABEL||'diagnostic')+'.json',JSON.stringify(results,null,2));
if(process.env.INTENT&&route.endsWith('/simpson')){const before=new Set(await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name)));await page.locator('button.ajouter').click();await page.getByRole('dialog').waitFor({timeout:30000});await page.waitForTimeout(1500);await writeFile(out+'/intent.json',JSON.stringify({dialogVisible:await page.getByRole('dialog').isVisible(),newResources:await page.evaluate(names=>performance.getEntriesByType('resource').filter(e=>!names.includes(e.name)).map(e=>({name:e.name,size:e.transferSize})),[...before]),blocked,errors},null,2));}
await context.close();
}
}
}finally{await browser.close();}
await writeFile(out+'/'+(process.env.LABEL||'diagnostic')+'.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
