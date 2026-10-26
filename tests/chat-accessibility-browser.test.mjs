import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
// Real widget, translations, history hook and styles. Only telemetry is replaced.
const bundle = await build({
  absWorkingDir: root, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  stdin: { resolveDir: root, loader: 'tsx', contents: `import React from 'react';
    import {createRoot} from 'react-dom/client'; import {NextIntlClientProvider} from 'next-intl';
    import ChatWidget,{EVENEMENT_AIDE} from './components/ChatWidget';
    document.getElementById('help').onclick=()=>window.dispatchEvent(new Event(EVENEMENT_AIDE));
    createRoot(document.getElementById('root')).render(<NextIntlClientProvider locale="fr" messages={window.messages}><ChatWidget/></NextIntlClientProvider>);` },
  plugins: [{ name: 'no-provider', setup(b) {
    b.onResolve({filter:/^@\/lib\/analytics$/}, () => ({path:'analytics',namespace:'isolated'}));
    b.onLoad({filter:/.*/,namespace:'isolated'}, () => ({contents:'export const mesure=()=>{};export const identifier=()=>{};',loader:'js'}));
  }}],
});
const css = (await postcss([tailwind({base:root})]).process(await readFile(path.join(root,'app/globals.css'),'utf8'), {from:path.join(root,'app/globals.css')})).css;
const messages = JSON.parse(await readFile(path.join(root,'messages/fr.json'),'utf8'));
const axe = await readFile(path.join(root,'node_modules/axe-core/axe.min.js'),'utf8');
const viewports = [{name:'desktop',width:1280,height:900}, {name:'mobile',width:390,height:844}];

async function mount(viewport, run) {
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:viewport.name==='mobile',hasTouch:viewport.name==='mobile',serviceWorkers:'block'});
  const page = await context.newPage();
  const unexpected = [], errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',async route=> {
    const url = new URL(route.request().url());
    if(url.origin==='http://chat.localhost' && /^\/polices\/[\w-]+\.woff2?$/.test(url.pathname)) {
      return route.fulfill({contentType:'font/woff2',body:await readFile(path.join(root,'public',url.pathname))});
    }
    if(route.request().isNavigationRequest() && route.request().url()==='http://chat.localhost/') return route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1"><button id="before">Before</button><button id="help">Aide</button><div id="root"></div><button id="after">After</button>'});
    unexpected.push(route.request().url());
    return route.abort();
  });
  try {
    await page.goto('http://chat.localhost/');
    await page.addStyleTag({content:css});
    await page.evaluate(messages=>{window.messages=messages;},messages);
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.locator('.clavardage__lanceur').waitFor();
    await run(page);
    assert.deepEqual(errors, [], 'no browser runtime errors');
    assert.deepEqual(unexpected, [], 'no provider or other network calls');
  } finally { await context.close(); await browser.close(); }
}
const focused = locator => locator.evaluate(el=>el===document.activeElement);

async function assertNoHiddenFocus(page) {
  await page.addScriptTag({content:axe});
  const result = await page.evaluate(()=>window.axe.run(document.getElementById('root'),{runOnly:{type:'rule',values:['aria-hidden-focus']}}));
  assert.deepEqual(result.violations,[],'axe aria-hidden-focus must have no violations');
  assert.deepEqual(result.incomplete,[],'axe aria-hidden-focus must not need manual review');
}

for (const viewport of viewports) {
  test(`${viewport.name}: pointer/touch opening and close preserve keyboard focus`, async()=>mount(viewport,async page=>{
    const launcher = page.locator('.clavardage__lanceur');
    if(viewport.name==='mobile') await launcher.tap(); else await launcher.click();
    await page.waitForFunction(()=>document.querySelector('.clavardage__lien--principal')===document.activeElement);
    const action = page.locator('.clavardage__lien--principal');
    await action.scrollIntoViewIfNeeded();
    const box = await action.boundingBox();
    assert.ok(box && box.x>=0 && box.y>=0 && box.x+box.width<=viewport.width && box.y+box.height<=viewport.height,'initial action is onscreen');
    if(viewport.name==='mobile') await page.locator('.clavardage__fermer').tap(); else await page.locator('.clavardage__fermer').click();
    await page.waitForFunction(()=>document.querySelector('.clavardage__lanceur').getAttribute('aria-expanded')==='false');
    assert.equal(await focused(launcher),true);
    await assertNoHiddenFocus(page);
  }));
  test(`${viewport.name}: real email/conversation flow stays usable across closing and reopening without a focus trap`, async()=>mount(viewport,async page=>{
    const launcher = page.locator('.clavardage__lanceur');
    await assertNoHiddenFocus(page);
    await launcher.focus();
    await page.keyboard.press('Enter');
    await page.locator('.clavardage__lien--principal').press('Enter');
    const email = page.getByRole('textbox',{name:messages.chat.emailAria});
    assert.equal(await focused(email),true,'email screen focuses its field');
    await email.fill('keyboard@example.invalid');
    await page.keyboard.press('Escape');
    assert.equal(await focused(launcher),true);
    await page.waitForFunction(()=>!history.state?.retourFerme);
    await assertNoHiddenFocus(page);
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('input[type=email]')===document.activeElement);
    assert.equal(await email.inputValue(),'keyboard@example.invalid','reopening preserves the draft');
    await page.keyboard.press('Enter');
    const input = page.getByRole('textbox',{name:messages.chat.saisieAria});
    await input.waitFor();
    assert.equal(await focused(input),true,'conversation focuses its message field');
    await input.fill('Message synthétique non envoyé');
    await page.keyboard.press('Tab');
    assert.equal(await focused(page.locator('.clavardage__envoi')),true,'send action is keyboard reachable');
    await page.keyboard.press('Tab');
    assert.equal(await focused(launcher),true,'non-modal dialog allows Tab out');
    await page.keyboard.press('Tab');
    assert.equal(await focused(page.locator('#after')),true,'background remains keyboard accessible');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await focused(page.locator('.clavardage__envoi')),true,'reverse Tab can return to the panel');
    await assertNoHiddenFocus(page);
    await page.keyboard.press('Escape');
    assert.equal(await focused(launcher),true);
    await page.waitForFunction(()=>!history.state?.retourFerme);
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.clavardage__pilule input')===document.activeElement);
    assert.equal(await input.inputValue(),'Message synthétique non envoyé');
    await page.locator('.clavardage__retour').press('Enter');
    assert.equal(await focused(page.locator('.clavardage__lien--principal')),true,'back to home gives focus to the primary action');
    await page.locator('.clavardage__fermer').press('Enter');
    assert.equal(await focused(launcher),true,'close button restores the opener');
    await page.waitForFunction(()=>!history.state?.retourFerme);
    await page.keyboard.press('Enter');
    await page.goBack();
    await page.waitForFunction(()=>document.querySelector('.clavardage__lanceur').getAttribute('aria-expanded')==='false');
    assert.equal(await focused(launcher),true,'browser/mobile Back restores the opener');
    await assertNoHiddenFocus(page);
  }));
  test(`${viewport.name}: Escape restores the actual opener on every reopening`, async()=>mount(viewport,async page=>{
    const launcher = page.locator('.clavardage__lanceur');
    for(const opener of [launcher,page.locator('#help'),launcher]) {
      await opener.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(()=>document.querySelector('.clavardage__lanceur').getAttribute('aria-expanded')==='true');
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>document.querySelector('.clavardage__lanceur').getAttribute('aria-expanded')==='false');
      assert.equal(await focused(opener),true,'Escape restores the control that opened the chat');
      // Wait for the real history hook to remove its entry before reopening.
      await page.waitForFunction(()=>!history.state?.retourFerme);
    }
  }));
  test(`${viewport.name}: Escape is handled at the opening DOM commit before passive effects`, async()=>mount(viewport,async page=>{
    const opener = page.locator('#help');
    await opener.focus();
    // A native/custom-event opening can commit before React runs useEffect.
    // Observe that exact boundary rather than hoping Playwright wins the race.
    await page.evaluate(()=>new Promise(resolve=> {
      const launcher = document.querySelector('.clavardage__lanceur');
      const observer = new MutationObserver(()=> {
        if(launcher.getAttribute('aria-expanded')!=='true') return;
        observer.disconnect();
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
        resolve();
      });
      observer.observe(launcher,{attributes:true,attributeFilter:['aria-expanded']});
      document.getElementById('help').click();
    }));
    await page.waitForFunction(()=>document.querySelector('.clavardage__lanceur').getAttribute('aria-expanded')==='false');
    assert.equal(await focused(opener),true,'immediate Escape restores the actual opener');
    await page.waitForFunction(()=>!history.state?.retourFerme);
  }));
  test(`${viewport.name}: keyboard opening focuses a useful action in the non-modal dialog`, async()=>mount(viewport,async page=>{
    const launcher = page.locator('.clavardage__lanceur');
    await launcher.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.clavardage__lanceur').getAttribute('aria-expanded')==='true');
    assert.equal(await focused(page.locator('.clavardage__lien--principal')),true,'opening focuses Start conversation');
    const dialog = page.getByRole('dialog',{name:messages.chat.ariaDialog});
    assert.equal(await dialog.count(),1);
    assert.notEqual(await dialog.getAttribute('aria-modal'),'true','background stays available');
    assert.equal(await launcher.getAttribute('aria-controls'),await dialog.getAttribute('id'),'launcher identifies its dialogue');
    assert.ok(await dialog.getAttribute('id'));
  }));
  test(`${viewport.name}: closed chat is excluded from forward and reverse Tab`, async()=>mount(viewport,async page=>{
    await page.locator('#help').focus();
    await page.keyboard.press('Tab');
    assert.equal(await focused(page.locator('.clavardage__lanceur')),true,'Tab must skip every invisible panel control');
    await page.keyboard.press('Tab');
    assert.equal(await focused(page.locator('#after')),true);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await focused(page.locator('#help')),true,'reverse Tab must skip the closed panel');
    // Programmatic focus must also fail, not just sequential navigation.
    for(const control of await page.locator('.clavardage button, .clavardage input').all()) {
      await control.evaluate(el=>el.focus());
      assert.equal(await focused(control),false,'hidden panel controls cannot receive focus');
    }
    assert.equal(await page.getByRole('dialog').count(),0,'closed dialogue is absent from accessibility tree');
  }));
}

for (const status of [500, 200]) {
  test(`chat confirmation follows HTTP ${status}`, async()=>mount(viewports[0],async page=>{
    await page.route('**/api/chat',r=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(status===200?{ok:true}:{error:'server_error'})}));
    await page.locator('.clavardage__lanceur').click();
    await page.locator('.clavardage__lien--principal').click();
    await page.getByRole('textbox',{name:messages.chat.emailAria}).fill('client@example.invalid');
    await page.getByRole('button',{name:messages.chat.continuer}).click();
    const input=page.getByRole('textbox',{name:messages.chat.saisieAria});
    await input.fill('Message test'); await page.locator('.clavardage__envoi').click();
    if(status===500) { await page.getByText(messages.contactForm.erreurServeur).waitFor(); assert.equal(await input.inputValue(),'Message test'); assert.equal(await page.getByText(messages.chat.botMerci).count(),0); }
    else { await page.locator('.bulle').filter({hasText:messages.chat.botMerci}).waitFor(); assert.equal(await input.inputValue(),''); }
  }));
}

test('changing topic preserves an oversized draft but blocks sending until corrected',async()=>mount(viewports[0],async page=>{
 await page.locator('.clavardage__lanceur').click(); await page.locator('.clavardage__lien--principal').click();
 await page.getByRole('textbox',{name:messages.chat.emailAria}).fill('client@example.invalid'); await page.getByRole('button',{name:messages.chat.continuer}).click();
 const input=page.getByRole('textbox',{name:messages.chat.saisieAria});
 await input.fill('x'.repeat(5000)); await page.locator('.clavardage__retour').click();
 await page.getByText(messages.chat.sujetCommande,{exact:true}).click();
 assert.equal((await input.inputValue()).length,5000,'draft is not truncated');
 const max=Number(await input.getAttribute('maxlength'));
 assert.ok(max<5000); assert.match(await page.locator(`#${await input.getAttribute('aria-describedby')}`).textContent(),new RegExp(String(max)));
 assert.equal(await page.locator('.clavardage__envoi').isDisabled(),true,'oversized draft cannot be sent');
}));

test('keyboard retry retains focus and idempotency key after an uncertain response',async()=>mount(viewports[0],async page=>{
 const bodies=[]; let release; const gate=new Promise(r=>release=r);
 await page.route('**/api/chat',async r=>{bodies.push(r.request().postDataJSON()); if(bodies.length===1){await gate;return r.abort();} return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});});
 await page.locator('.clavardage__lanceur').click();await page.locator('.clavardage__lien--principal').click();
 await page.getByRole('textbox',{name:messages.chat.emailAria}).fill('client@example.invalid');await page.getByRole('button',{name:messages.chat.continuer}).click();
 const input=page.getByRole('textbox',{name:messages.chat.saisieAria});await input.fill('Retry');await input.press('Enter');
 await page.waitForFunction(()=>document.querySelector('.clavardage__frappe'));
 assert.equal(await focused(input),true,'focus remains while sending');release();
 await page.getByRole('alert').waitFor();assert.equal(await focused(input),true,'focus remains after failure');
 assert.equal(await input.getAttribute('readonly'),'','uncertain draft cannot be edited');
 assert.match(await page.getByRole('alert').textContent(),/incertaine/);
 assert.equal(await page.locator('.clavardage__retour').isDisabled(),true);
 await page.keyboard.press('Escape'); await page.waitForFunction(()=>!history.state?.retourFerme);
 await page.locator('.clavardage__lanceur').click();
 assert.equal(await input.inputValue(),'Retry','closing preserves the uncertain draft');
 assert.equal(await input.getAttribute('readonly'),'');
 await input.press('Enter');await page.locator('.bulle').filter({hasText:messages.chat.botMerci}).waitFor();
 assert.equal(await page.getByRole('status').textContent(),messages.chat.botMerci,'success is announced');
 assert.equal(await input.getAttribute('readonly'),null,'editing resumes after confirmation');
 assert.match(bodies[0].idempotencyKey,/^[0-9a-f-]{36}$/);assert.deepEqual(bodies[0],bodies[1],'retry sends the same payload and key');
}));


test('uncertain submission survives reload and retry reuses the exact payload',async()=>mount(viewports[0],async page=>{
 const bodies=[]; await page.route('**/api/chat',async r=>{bodies.push(r.request().postDataJSON()); if(bodies.length===1)return r.abort();return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});});
 await page.locator('.clavardage__lanceur').click();await page.getByText(messages.chat.sujetCommande,{exact:true}).click();
 await page.getByRole('textbox',{name:messages.chat.emailAria}).fill('client@example.invalid');await page.getByRole('button',{name:messages.chat.continuer}).click();
 await page.getByRole('textbox',{name:messages.chat.saisieAria}).fill('Reload retry');await page.locator('.clavardage__envoi').click();await page.getByRole('alert').waitFor();
 await page.reload();await page.addStyleTag({content:css});await page.evaluate(messages=>{window.messages=messages;},messages);await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.locator('.clavardage__lanceur').click();const input=page.getByRole('textbox',{name:messages.chat.saisieAria});await input.waitFor();
 assert.equal(await input.inputValue(),'Reload retry');assert.equal(await input.getAttribute('readonly'),'');
 await input.press('Enter');await page.locator('.bulle').filter({hasText:messages.chat.botMerci}).waitFor();assert.deepEqual(bodies[1],bodies[0]);
 assert.equal(await page.evaluate(()=>sessionStorage.length),0,'successful retry cleans persisted personal data');
}));

for (const [status,error] of [[400,'invalid_input'],[413,'body_too_large'],[429,'rate_limited']]) test(`definite ${status} rejection allows correcting the draft`,async()=>mount(viewports[0],async page=>{
 const bodies=[];await page.route('**/api/chat',r=>{bodies.push(r.request().postDataJSON());return r.fulfill({status:bodies.length===1?status:200,contentType:'application/json',body:JSON.stringify(bodies.length===1?{error}:{ok:true})});});
 await page.locator('.clavardage__lanceur').click();await page.locator('.clavardage__lien--principal').click();await page.getByRole('textbox',{name:messages.chat.emailAria}).fill('client@example.invalid');await page.getByRole('button',{name:messages.chat.continuer}).click();
 const input=page.getByRole('textbox',{name:messages.chat.saisieAria});await input.fill('Original');await input.press('Enter');await page.getByRole('alert').waitFor();
 assert.equal(await input.getAttribute('readonly'),null);assert.doesNotMatch(await page.getByRole('alert').textContent(),/incertaine/);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
 await input.fill('Corrigé');await input.press('Enter');await page.locator('.bulle').filter({hasText:messages.chat.botMerci}).waitFor();assert.notEqual(bodies[0].idempotencyKey,bodies[1].idempotencyKey);
}));


test('rate limit after ambiguous attempt cannot unlock or discard the original retry',async()=>mount(viewports[0],async page=>{
 const bodies=[];await page.route('**/api/chat',r=>{bodies.push(r.request().postDataJSON());if(bodies.length===1)return r.abort();if(bodies.length===2)return r.fulfill({status:429,contentType:'application/json',body:'{"error":"rate_limited"}'});return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});});
 await page.locator('.clavardage__lanceur').click();await page.locator('.clavardage__lien--principal').click();await page.getByRole('textbox',{name:messages.chat.emailAria}).fill('client@example.invalid');await page.getByRole('button',{name:messages.chat.continuer}).click();
 const input=page.getByRole('textbox',{name:messages.chat.saisieAria});await input.fill('Ambiguous');await input.press('Enter');await page.getByRole('alert').waitFor();await input.press('Enter');await page.getByRole('alert').waitFor();
 assert.equal(await input.getAttribute('readonly'),'');assert.match(await page.getByRole('alert').textContent(),/incertaine/);assert.equal(await page.evaluate(()=>sessionStorage.length),1);
 await input.press('Enter');await page.locator('.bulle').filter({hasText:messages.chat.botMerci}).waitFor();assert.deepEqual(bodies[0],bodies[1]);assert.deepEqual(bodies[0],bodies[2]);
}));
