import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createTranslator } from 'next-intl';
const root = path.resolve(import.meta.dirname, '..');
function load(file, replacements = {}, cache = new Map()) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const m = new Module(file); m.filename = file; cache.set(file, m);
  const original = createRequire(file);
  m.require = name => {
    if (name in replacements) return replacements[name];
    if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(target + (existsSync(target + '.ts') ? '.ts' : '.tsx'), replacements, cache);
    }
    return original(name);
  };
  m._compile(ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText, file);
  return m.exports;
}
const link = ({children, ...props}) => React.createElement('a', props, children);
const { PAGES_LEGALES } = load('lib/legal/index.ts');
const {default: PageLegale} = load('components/PageLegale.tsx', {'next/link': link});
test('product and revision uploads show the same notice in real React/intl across ten locales on mobile', async () => {
  const stubs = {
    'next/image': 'export default function Image({priority, ...props}) {return <img {...props}/>} ',
    'next/link': 'export default function Link(props) {return <a {...props}/>} ',
    'next/dynamic': 'export default () => () => null',
    '@/components/CheckoutModal': 'export default () => null',
    '@/components/CurrencyProvider': "export const useCurrency=()=>({currency:'EUR',pret:true,formatRaw:n=>'EUR '+n})",
    '@/hooks/useProductTracking': 'export const useProductTracking=()=>new Proxy({}, {get:()=>()=>{}})',
    '@/components/useLien': 'export const useLien=()=>x=>x',
    '@/lib/useRetourFerme': 'export const useRetourFerme=()=>{}',
    '@/lib/analytics': 'export const mesure=()=>{}',
    '@/lib/uploadClient': "export const uploadImage=()=>{throw Error('No real uploads')}"
  };
  const bundle = await build({absWorkingDir:root,bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',
    stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import {NextIntlClientProvider} from 'next-intl';
      import Fiche from './app/[locale]/[produit]/FicheProduit'; import Confirm from './app/(hors-langue)/confirm-poster/[token]/ConfirmClient';
      const prices={base:5,fullbodyExtra:5,extraPerson:5,extraAnimal:5,digital:0,canvas:39,poster:59,posterSimple:19,banner:3,extraDecor:5,express:7,carteVoeux:4,calendrier:9,shipping:4.9};
      createRoot(document.getElementById('root')).render(<NextIntlClientProvider locale={window.locale} messages={window.messages} timeZone="UTC"><div id="product"><Fiche prixInitial={prices} donnees={{slug:'fixture',idProduit:'fixture',univers:'Fixture',titre:'Fixture',description:'Fixture',categorieNom:'Fixture',categorieCle:'fixture',personnages:true,galerie:[],legendes:[],decors:[],supports:{digital:'/d.png',posterSimple:'/p.png',canvas:'/c.png',framed:'/f.png'},similaires:[]}}/></div><div id="revision"><Confirm token="synthetic" lang={window.locale} initialStatus={null} respondedAt={null} initialNote={null} initialPhotos={[]}/></div></NextIntlClientProvider>);`},
    plugins:[{name:'isolated-boundaries',setup(b){
      b.onResolve({filter:/./},args=>Object.hasOwn(stubs,args.path)?{path:args.path,namespace:'stubs'}:undefined);
      b.onLoad({filter:/./,namespace:'stubs'},args=>({contents:stubs[args.path],loader:'jsx',resolveDir:root}));
      b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
    }}]});
  const browser = await chromium.launch({headless:true});
  try {
    for(const locale of Object.keys(terms)) {
      const page = await browser.newPage({viewport:{width:390,height:844}});
      await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
      await page.goto('https://privacy.invalid/');
      const messages=JSON.parse(readFileSync(path.join(root,'messages',locale+'.json'),'utf8'));
      await page.evaluate(({locale,messages})=>{window.locale=locale;window.messages=messages;},{locale,messages});
      await page.addScriptTag({content:bundle.outputFiles[0].text});
      await page.locator('#product input[type="file"]').waitFor({state:'attached'});
      assert.equal(await page.locator('#product [data-photo-privacy]').count(),1,locale+': product upload notice');
      await page.locator('#revision button').nth(1).click();
      assert.equal(await page.locator('#revision [data-photo-privacy]').count(),1,locale+': revision upload notice');
      const {PHOTO_PRIVACY}=load('lib/i18n/photoPrivacy.ts');
      for(const container of ['#product','#revision']) {
        const notice=page.locator(container+' [data-photo-privacy]');
        assert.ok((await notice.innerText()).includes(PHOTO_PRIVACY[locale].notice),locale);
        assert.equal(await notice.locator('a').getAttribute('href'),`/${locale}/politique-de-confidentialite`);
        assert.equal(await notice.locator('input').count(),0);
        assert.equal(await notice.evaluate(el=>el.scrollWidth<=el.clientWidth),true,locale+': no notice overflow');
      }
      await page.close();
    }
  } finally {await browser.close();}
});

const renderLegal = (document, locale) => renderToStaticMarkup(React.createElement(PageLegale, {document, locale, avertissement: ''}));
const terms = {
  fr: [/photos sources/i, /portraits finaux/i, /autorisation séparée/i, /automatique/i, /manuellement/i],
  en: [/source photos/i, /final portraits/i, /separate authorisation/i, /automatic/i, /manually/i],
  de: [/Ausgangsfotos/i, /fertigen Porträts/i, /gesonderte Zustimmung/i, /automatisch/i, /manuell/i],
  es: [/fotos originales/i, /retratos finales/i, /autorización independiente/i, /automátic/i, /manualmente/i],
  it: [/foto originali/i, /ritratti finali/i, /autorizzazione separata/i, /automatic/i, /manualmente/i],
  nl: [/bronfoto/i, /uiteindelijke portretten/i, /afzonderlijke toestemming/i, /automatisch/i, /handmatig/i],
  pl: [/zdjęcia źródłowe/i, /gotowe portrety/i, /odrębnej zgody/i, /automatyczn/i, /ręcznie/i],
  sv: [/källfoton/i, /färdiga porträtt/i, /separat tillstånd/i, /automatisk/i, /manuellt/i],
  da: [/kildefotos/i, /færdige portrætter/i, /særskilt tilladelse/i, /automatisk/i, /manuelt/i],
  pt: [/fotografias originais/i, /retratos finais/i, /autorização separada/i, /automátic/i, /manualmente/i],
};
test('ten rendered legal translations distinguish source photos and final portraits, forbid default promotion, disclose real deletion limits', () => {
  assert.equal(Object.keys(PAGES_LEGALES).length, 10);
  for (const [locale, pages] of Object.entries(PAGES_LEGALES)) {
    const article10 = pages.cgv.sections.find(s => /10\s*—/.test(s.titre));
    const article12 = pages.cgv.sections.find(s => /12\s*—/.test(s.titre));
    const promotion = renderLegal({...pages.cgv, sections: [article10]}, locale);
    const storage = renderLegal({...pages.cgv, sections: [article12]}, locale);
    const privacy = renderLegal(pages.confidentialite, locale);
    for (const pattern of terms[locale].slice(0, 3)) assert.match(promotion, pattern, locale);
    for (const pattern of terms[locale].slice(3)) assert.match(storage, pattern, locale);
    for (const pattern of terms[locale]) assert.match(privacy, pattern, locale);
    assert.ok(privacy.includes(promotion.match(/<p>([^]*?)<\/p>/g).at(-1)), `${locale}: same publication policy in privacy`);
    assert.ok(privacy.includes(storage.match(/<p>([^]*?)<\/p>/g).at(-1).slice(3, -4)), `${locale}: same storage limits in privacy`);
    assert.doesNotMatch(storage + privacy, /90/);
    assert.match(storage, /mailto:support@cartoonova.com/);
  }
});

test('legacy product reassurance catalogues no longer promise unimplemented 30-day deletion', () => {
  for (const locale of Object.keys(terms)) {
    const messages = JSON.parse(readFileSync(path.join(root,'messages',locale+'.json'),'utf8'));
    const t = createTranslator({locale, messages});
    const html = renderToStaticMarkup(React.createElement('p', null, t('product.photosDeletedAfter30Days')));
    assert.doesNotMatch(html, /30|90/, locale);
    assert.match(html, /support@cartoonova.com/, locale);
  }
});

test('support draft prompt states the real storage policy without claiming automatic deletion', async () => {
  const {redigerReponseSupport} = load('lib/aiReponse.ts');
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  let payload;
  process.env.OPENAI_API_KEY = 'synthetic-test-key';
  globalThis.fetch = async (url, options) => {
    assert.equal(url,'https://api.openai.com/v1/chat/completions');
    payload = JSON.parse(options.body);
    return Response.json({choices:[{message:{content:'Synthetic draft'}}]});
  };
  try {
    const result = await redigerReponseSupport({message:{fromEmail:'synthetic@example.invalid',subject:'Photos',bodyText:'Delete photos'},commande:null,historique:[]});
    assert.equal(result.texte,'Synthetic draft');
    const facts=payload.messages.find(m=>m.role==='user').content;
    assert.doesNotMatch(facts,/90 jours/);
    assert.match(facts,/aucun effacement automatique/i);
    assert.match(facts,/autorisation separee/i);
    assert.match(facts,/manuellement/i);
  } finally {
    globalThis.fetch = originalFetch;
    if(originalKey===undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY=originalKey;
  }
});

test('post-payment upload renders a short localised no-promotion notice and a local privacy link without consent controls', () => {
  const {default: DepotClient} = load('app/(hors-langue)/depot/[token]/DepotClient.tsx', {
    '@/lib/uploadClient': {uploadImage: () => {throw new Error('No upload allowed in rendering test');}},
    '@/lib/analytics': {mesure: () => {}},
  });
  for (const locale of Object.keys(terms)) {
    const html = renderToStaticMarkup(React.createElement(DepotClient, {token: 'synthetic-token', lang: locale}));
    assert.match(html, new RegExp(`href="/${locale}/politique-de-confidentialite"`), locale);
    assert.match(html, /data-photo-privacy/);
    assert.doesNotMatch(html, /type="checkbox"|checked=""|90/);
    assert.ok(html.indexOf('data-photo-privacy') > html.indexOf('type="file"'), locale);
  }
});
