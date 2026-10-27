import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
const root=new URL('..',import.meta.url).pathname;
const require=createRequire(new URL('../package.json',import.meta.url));
const stubs={'next-intl':`export const useLocale=()=> 'fr';`,'next/image':`export default function Image({fill,preload,...p}){return <img {...p}/>}`,'next/link':`export default function Link(p){return <a {...p}/>}`,'@/lib/analytics':`export const mesure=()=>{};`,'./GiftPricing':`export const GiftExampleTotal=()=> '10 EUR';export const GiftConfiguratorLink=p=><a {...p}/>;`};
const boundaries={name:'boundaries',setup(b){b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));b.onResolve({filter:/./},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'stub'}:undefined);b.onLoad({filter:/./,namespace:'stub'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));}};
test('SSR and delayed hydration never expose local control; default public guide remains rendered',async()=>{
 const browser=await chromium.launch({headless:true});
 try{for(const flag of ['0','1']){
  const options={absWorkingDir:root,bundle:true,write:false,jsx:'automatic',define:{'process.env.NEXT_PUBLIC_GIFT_GUIDE_LOCAL_MEASUREMENT':JSON.stringify(flag)},plugins:[boundaries]};
  const server=await build({...options,platform:'node',format:'cjs',packages:'external',stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {renderToString} from 'react-dom/server';import Guide from './app/[locale]/cadeau/GiftGuide';module.exports=renderToString(<Guide/>);`}});
  const m={exports:{}};new Function('require','module','exports',server.outputFiles[0].text)(require,m,m.exports);const html=m.exports;
  const client=await build({...options,platform:'browser',format:'iife',stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {hydrateRoot} from 'react-dom/client';import Guide from './app/[locale]/cadeau/GiftGuide';import {localGiftGuide} from './lib/giftGuideLocal';window.guide=localGiftGuide;hydrateRoot(document.getElementById('root'),<Guide/>,{onRecoverableError:e=>window.hydrationErrors.push(e.message)});`}});
  for(const scenario of [{host:'localhost',cohort:'control'},{host:'localhost',cohort:null,random:0},{host:'localhost',cohort:null,random:0.9},{host:'localhost',cohort:'guided-v1'},{host:'public.invalid',cohort:null}]){
   const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const traffic=[];
   await page.route('**/*',r=>{traffic.push(r.request().url());return r.fulfill({contentType:'text/html; charset=utf-8',body:`<div style="height:2000px"></div><div id="root">${html}</div>`});});
   await page.goto(`http://${scenario.host}:41239/`);
   await page.evaluate(s=>{window.hydrationErrors=[];if(s.cohort)sessionStorage.setItem('cartoonova_guide_local_v1',JSON.stringify({version:1,sessionId:'00000000-0000-4000-8000-000000000003',consent:true,cohort:s.cohort,events:[],checkouts:[]}));if(s.random!==undefined)crypto.getRandomValues=a=>{a[0]=s.random*4294967296;return a;};},scenario);
   // Explicit delay with no hydration script: inspect initial HTML, not eventual DOM.
   await page.waitForTimeout(100);
   assert.equal(await page.locator('section').count(),flag==='1'?0:1,'initial SSR must not expose an unassigned local visitor');
   await page.addScriptTag({content:client.outputFiles[0].text});
   const local=flag==='1'&&scenario.host==='localhost';const control=local&&(scenario.cohort==='control'||scenario.random===0);
   if(control){await page.waitForFunction(()=>window.guide.export()?.cohort==='control');assert.equal(await page.locator('section').count(),0);assert.deepEqual((await page.evaluate(()=>window.guide.export())).events,[]);}
   else{await page.locator('section').waitFor();if(local){await page.waitForFunction(()=>window.guide.export()?.events.includes('viewed'));assert.deepEqual((await page.evaluate(()=>window.guide.export())).events,['viewed']);await page.locator('section').scrollIntoViewIfNeeded();await page.waitForFunction(()=>window.guide.export()?.events.includes('exposed'));}else assert.equal(await page.evaluate(()=>window.guide.export()),null);}
   assert.deepEqual(await page.evaluate(()=>window.hydrationErrors),[]);assert.deepEqual(errors,[]);
   assert.ok(traffic.every(u=>new URL(u).host===`${scenario.host}:41239`),'no external transport');await page.close();
  }
 }}finally{await browser.close();}
});
