import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const root=new URL('..',import.meta.url).pathname;
test('no automatic cookie banner; default analytics respects withdrawal and existing choices in Chromium',async()=>{
 const result=await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env':'{}','process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_POSTHOG_KEY':'"synthetic"'},stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Provider from './components/PostHogProvider';import Preferences from './components/CookiePreferences';createRoot(document.getElementById('root')!).render(<Provider><main>Collections</main><section id="legal"><Preferences locale="fr"/></section></Provider>);`},plugins:[{name:'isolated-boundaries',setup(b){b.onResolve({filter:/^(next\/navigation|posthog-js|next\/dynamic|@\/components\/SuiviGlobal)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({resolveDir:root,loader:'tsx',contents:a.path==='next/navigation'?`export const usePathname=()=>'/fr/collections';export const useSearchParams=()=>new URLSearchParams();`:a.path==='@/components/SuiviGlobal'?`export default function Suivi(){return null}`:a.path==='next/dynamic'?`import React from 'react';export default function dynamic(load){const C=React.lazy(load);return ()=> <React.Suspense fallback={null}><C/></React.Suspense>}`:`window.sdkImports=(window.sdkImports||0)+1;export default new Proxy({}, {get:(_,k)=>k==='get_distinct_id'?()=> 'synthetic':()=>{}});`}));}}]});
 const browser=await chromium.launch({headless:true});try {
 const page=await browser.newPage({userAgent:'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36'});const external=[];
 await page.addInitScript(()=>Object.defineProperty(navigator,'webdriver',{get:()=>false}));
 await page.route('**/*',r=>{if(r.request().url().startsWith('https://consent.invalid/'))return r.fulfill({contentType:'text/html',body:'<div id="root"></div>'});external.push(r.request().url());return r.abort();});
 const mount=async()=>{await page.addScriptTag({content:result.outputFiles[0].text});await page.locator('#legal').waitFor();await page.waitForTimeout(150);};
 await page.goto('https://consent.invalid/fr/collections');await mount();
 assert.equal(await page.getByRole('dialog').count(),0,'no automatic cookie banner');
 assert.equal(await page.getByRole('button',{name:'Accepter',exact:true}).count(),0,'opt-in is not displayed automatically');
 assert.equal(await page.evaluate(()=>window.sdkImports||0),1,'analytics is enabled by default for new visitors');assert.equal(external.length,0);
 await page.getByText('Modifier mes préférences cookies',{exact:true}).click();
 await page.getByRole('button',{name:'Accepter',exact:true}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('cartoonova_consent_v1')),'granted');
 await page.waitForFunction(()=>window.sdkImports===1);
 assert.equal(await page.evaluate(()=>Object.hasOwn(window,'oaiq')),false);
 await page.reload();await mount();
 assert.equal(await page.getByRole('dialog').count(),0,'existing consent never brings the banner back');
 await page.getByText('Modifier mes préférences cookies',{exact:true}).click();
 await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Refuser',exact:true}).click()]);await mount();
 assert.equal(await page.evaluate(()=>localStorage.getItem('cartoonova_consent_v1')),'denied');
 assert.equal(await page.evaluate(()=>window.sdkImports||0),0,'withdrawal keeps analytics unloaded on reload');
 assert.equal(await page.getByRole('dialog').count(),0);assert.equal(external.length,0);
 }finally {await browser.close();}
});
