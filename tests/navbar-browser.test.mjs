import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const locales = ['fr','en','es','de','it','nl','pl','sv','da','pt'];
const stubs = {
  'next/image': `export default function Image({priority, ...props}) {return <img {...props}/>}`,
  'next/link': `export default function Link(props) {return <a {...props}/>}`,
  'next/navigation': `export const usePathname=()=>'/'+window.locale; export const useRouter=()=>({replace:()=>{}})`,
  '@/components/ChatWidget': `export const EVENEMENT_AIDE='test-help'`,
  '@/components/CurrencyProvider': `export const useCurrency=()=>({currency:'EUR',setCurrency:()=>{}})`,
  '@/lib/analytics': `export const mesure=()=>{}`,
};
const bundle = await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',
  stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {NextIntlClientProvider} from 'next-intl';import Navbar from './components/Navbar';createRoot(document.getElementById('root')).render(<NextIntlClientProvider locale={window.locale} messages={window.messages}><Navbar/></NextIntlClientProvider>);`},
  plugins:[{name:'boundaries',setup(b){
    b.onResolve({filter:/./},a=>Object.hasOwn(stubs,a.path)?{path:a.path,namespace:'stubs'}:undefined);
    b.onLoad({filter:/./,namespace:'stubs'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));
    b.onLoad({filter:/\.css$/},async a=>({contents:`document.head.appendChild(Object.assign(document.createElement('style'),{textContent:${JSON.stringify(await readFile(a.path,'utf8'))}}))`,loader:'js'}));
  }}]});
const css = (await Promise.all(['app/toonjaune.css','app/toonjaune-app.css'].map(p=>readFile(path.join(root,p),'utf8')))).join('\n');
async function mount(browser,locale,height){
  const context=await browser.newContext({viewport:{width:390,height},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root" style="min-height:3000px"></div><main style="height:3000px"><button id="background">Background</button></main>'}));
  await page.goto('https://navbar.invalid/'+locale);
  await page.addStyleTag({content:css});
  await page.evaluate(({locale,messages})=>Object.assign(window,{locale,messages}),{locale,messages:JSON.parse(await readFile(path.join(root,'messages',locale+'.json'),'utf8'))});
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.locator('.burger').waitFor();
  return {context,page};
}
async function swipe(page, target){
  const cdp=await page.context().newCDPSession(page);
  const height=page.viewportSize().height;
  const panel=await page.locator('.replie').boundingBox();
  const box=await target.boundingBox();
  const up=box.y<panel.y;
  const distance=Math.min(95,Math.max(40,up?panel.y-box.y+30:box.y+box.height-height+30));
  const start=up?panel.y+20:height-25,end=up?panel.y+20+distance:height-25-distance;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:start}]});
  for(let i=1;i<=4;i++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y:start+(end-start)*i/4}]});
    await page.waitForTimeout(16);
  }
  // End at rest: inertial flings can skip a target in a 320px viewport.
  await page.waitForTimeout(100);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(60);
  await cdp.detach();
}
async function hit(page,locator){
  return locator.evaluate(el=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;return y>=0&&y<innerHeight&&x>=0&&x<innerWidth&&el.contains(document.elementFromPoint(x,y));});
}

test('each category stays open while every link is touch-reachable in ten locales and short viewports',async()=>{
  const browser=await chromium.launch({headless:true});
  let visited=0;
  try{await Promise.all(locales.map(async locale=>{for(const height of [844,480,320]){
    const {context,page}=await mount(browser,locale,height);
    try{
      await page.locator('.burger').tap();
      const categories=page.locator('.replie__declencheur');
      for(let i=0;i<await categories.count();i++){
        // Returning to the top is a gesture, never collapsing the preceding category.
        await page.locator('.replie').evaluate(el=>el.scrollTop=0);
        for(let n=0;!await hit(page,categories.nth(i))&&n<12;n++)await swipe(page,categories.nth(i));
        assert.equal(await hit(page,categories.nth(i)),true,`${locale}/${height}: category ${i} reachable without collapsing`);
        await categories.nth(i).tap();
        const links=page.locator('.replie__styles a');
        for(let j=0;j<await links.count();j++){
          for(let n=0;!await hit(page,links.nth(j))&&n<12;n++)await swipe(page,links.nth(j));
          assert.equal(await hit(page,links.nth(j)),true,`${locale}/${height}: category ${i} link ${j} touch reachable; ${JSON.stringify(await links.nth(j).boundingBox())}; panel=${JSON.stringify(await page.locator('.replie').evaluate(el=>({scroll:el.scrollTop,top:el.getBoundingClientRect().top,height:el.clientHeight})))}`);
          assert.equal(await categories.nth(i).getAttribute('aria-expanded'),'true');
          visited++;
        }
      }
      const secondary=page.locator('.replie nav a, .replie > .enveloppe > .bouton, .replie__outils button');
      for(let j=0;j<await secondary.count();j++){
        for(let n=0;!await hit(page,secondary.nth(j))&&n<12;n++)await swipe(page,secondary.nth(j));
        assert.equal(await hit(page,secondary.nth(j)),true,`${locale}/${height}: secondary control ${j} touch reachable`);
      }
    }finally{await context.close();}
  }}));console.log(JSON.stringify({locales:locales.length,viewports:[844,480,320],touchLinks:visited}));
  }finally{await browser.close();}
});

test('mobile focus, Escape, background lock and keyboard reachability',async()=>{
  const browser=await chromium.launch({headless:true});
  try{await Promise.all(locales.map(async locale=>{
    const {context,page}=await mount(browser,locale,320);
    try{
      const burger=page.locator('.burger');
      await burger.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.replie__declencheur').first().evaluate(el=>el===document.activeElement),true,'opening moves focus into the mobile navigation');
      const y=await page.evaluate(()=>scrollY);
      await page.mouse.move(5,310);
      await page.mouse.wheel(0,400);
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>scrollY),y,'background must not scroll');
      const categories=page.locator('.replie__declencheur');
      for(let i=0;i<await categories.count();i++){
        await categories.nth(i).focus();
        await page.keyboard.press('Enter');
        const links=page.locator('.replie__styles a');
        for(let j=0;j<await links.count();j++){
          await page.keyboard.press('Tab');
          assert.equal(await links.nth(j).evaluate(el=>el===document.activeElement),true);
          assert.equal(await hit(page,links.nth(j)),true,`${locale}: keyboard focus must not be hidden by the sticky header`);
        }
      }
      const controls=page.locator('.entete a:visible, .entete button:visible');
      await controls.last().focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.entete').evaluate(el=>el.contains(document.activeElement)),true,'Tab must not escape to background');
      await page.keyboard.press('Escape');
      assert.equal(await burger.getAttribute('aria-expanded'),'false');
      assert.equal(await burger.evaluate(el=>el===document.activeElement),true,'Escape returns focus to opener');
      await page.mouse.wheel(0,400);
      await page.waitForTimeout(100);
      assert.ok(await page.evaluate(()=>scrollY)>y,'closing restores background scroll');
      await burger.click();
      await page.goBack();
      await page.waitForFunction(()=>document.querySelector('.burger').getAttribute('aria-expanded')==='false');
      assert.equal(await burger.evaluate(el=>el===document.activeElement),true,'phone Back returns focus');
      await burger.click();
      await page.locator('.replie__declencheur').first().click();
      await page.evaluate(()=>document.addEventListener('click',event=>{
        const anchor=event.target.closest('a[href]');
        if(anchor){event.preventDefault();window.activatedHref=anchor.getAttribute('href');}
      },{capture:true}));
      const firstLink=page.locator('.replie__style').first();
      const href=await firstLink.getAttribute('href');
      await firstLink.tap();
      assert.equal(await page.evaluate(()=>window.activatedHref),href,'touch activates the localized destination');
      assert.equal(await burger.getAttribute('aria-expanded'),'false','link activation closes menu');
      assert.equal(await burger.evaluate(el=>el===document.activeElement),true,'link activation returns focus');
      await burger.click();
      await page.setViewportSize({width:1280,height:844});
      await page.waitForFunction(()=>document.querySelector('.burger').getAttribute('aria-expanded')==='false');
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'','desktop transition releases scroll lock');
    }finally{await context.close();}
  }));}finally{await browser.close();}
});
