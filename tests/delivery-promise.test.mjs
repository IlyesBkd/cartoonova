import assert from 'node:assert/strict';
import { test, mock, beforeEach, afterEach } from 'node:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider, useTranslations, createTranslator } from 'next-intl';
import { parse } from '@formatjs/icu-messageformat-parser';
import ts from 'typescript';
const root = path.resolve(import.meta.dirname, '..');
process.env.TZ = 'UTC';
beforeEach(() => mock.timers.enable({apis: ['Date'], now: new Date('2026-10-23T12:00:00Z')}));
afterEach(() => mock.timers.reset());
const messages = Object.fromEntries(readdirSync(path.join(root, 'messages')).filter(f => f.endsWith('.json')).map(f => [f.slice(0,-5), JSON.parse(readFileSync(path.join(root,'messages',f),'utf8'))]));
const terms = {
 fr: [/ouvrés/i, /paiement/i, /photos/i], en: [/business days/i,/payment/i,/photos/i],
 de: [/Werktag/i,/Zahlung/i,/Fotos/i], es: [/hábiles/i,/pago/i,/fotos/i],
 it: [/lavorativi/i,/pagamento/i,/foto/i], nl: [/werkdagen/i,/betaling/i,/foto/i],
 pl: [/robocz/i,/płatno/i,/zdję/i], sv: [/arbetsdag/i,/betalning/i,/foton/i],
 da: [/hverdage/i,/betaling/i,/fotos/i], pt: [/úteis/i,/pagamento/i,/fotos/i]
};
const promiseKeys = ['collections.reassurance2','collections.badgeDelivery24h','product.digitalDelivery48h','product.joinClients','product.delivered48h','product.delivery48h','product.digital48h','product.pillDelivered48h','checkout.guaranteeLine','home.delivered48h','home.step3Desc','home.whyUs3Title','home.whyUs3Desc','tj.promoFort','tj.heroNote','tj.ctaAtout1','tj.tuileDelai'];
function Copy({id}) { const t=useTranslations(); return React.createElement('p',null,t(id)); }
for (const [locale, catalog] of Object.entries(messages)) {
 test(`${locale}: rendered marketing promises start after payment AND photos, in business days`,()=>{
  for(const id of promiseKeys) {
   const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:catalog,timeZone:'UTC'},React.createElement(Copy,{id})));
   for(const term of terms[locale]) assert.match(html,term,`${locale}:${id}`);
  }
 });
}
function flatten(value,prefix='') { return Object.entries(value).flatMap(([key,item])=>typeof item==='object'?flatten(item,`${prefix}${key}.`):[[`${prefix}${key}`,item]]); }
const reference=flatten(messages.fr);
test('all ten locales retain identical message keys and ICU argument signatures; every ICU message parses',()=>{
 assert.equal(Object.keys(messages).length,10);
 function signature(ast) {return ast.flatMap(n=>[...(n.value && n.type>=1 && n.type<=6?[n.value]:[]),...(n.options?Object.values(n.options).flatMap(o=>signature(o.value)):[]),...(n.children?signature(n.children):[])]).sort();}
 for(const [locale,catalog] of Object.entries(messages)) {
  const entries=flatten(catalog); assert.deepEqual(entries.map(([k])=>k).sort(),reference.map(([k])=>k).sort(),locale);
  const t=createTranslator({locale,messages:catalog});
  for(const [key,value] of entries){
   const ast=parse(value);const expected=parse(reference.find(([k])=>k===key)[1]);
   assert.deepEqual(signature(ast),signature(expected),`${locale}:${key}`);
   if(!/[<{]/.test(value)) assert.equal(typeof t(key),'string');
  }
 }
});
function load(file, replacements={}, cache=new Map()) {
 file=path.resolve(root,file); if(cache.has(file)) return cache.get(file).exports;
 const m=new Module(file);m.filename=file;cache.set(file,m);const original=createRequire(file);
 m.require=name=>{
  if(name in replacements)return replacements[name];
  if(name.startsWith('@/')) {
   const target=name.slice(2);return load(target+(existsSync(path.join(root,target+'.ts'))?'.ts':'.tsx'),replacements,cache);
  }
  return original(name);
 };
 m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);return m.exports;
}
test('preview dates use business days, express uses exactly 24 hours including weekends, and inputs stay immutable',()=>{
 const {calculDateApercu}=load('components/DateApercu.tsx');
 for(const [input,expected] of [['2026-10-23T12:00:00Z','2026-10-27T12:00:00Z'],['2026-10-24T12:00:00Z','2026-10-27T12:00:00Z'],['2026-10-25T12:00:00Z','2026-10-27T12:00:00Z'],['2026-12-31T12:00:00Z','2027-01-04T12:00:00Z']]) {
  const now=new Date(input); const standard=calculDateApercu(now,false);assert.equal(standard.dessin.getTime(),Date.parse(expected));assert.equal(now.getTime(),Date.parse(input));
  const express=calculDateApercu(now,true);assert.equal(express.dessin.getTime()-now.getTime(),86400000);
 }
});
test('rendered date estimates are conditional on BOTH payment and photos, including printed and express variants',()=>{
 const {default:DateApercu}=load('components/DateApercu.tsx',{react:{...React,useSyncExternalStore:(_subscribe,snapshot)=>snapshot()}});
 for(const [locale,catalog] of Object.entries(messages)) for(const physique of [false,true]) for(const express of [false,true]) {
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:catalog,timeZone:'UTC'},React.createElement(DateApercu,{physique,express})));
  for(const term of terms[locale].slice(1))assert.match(html,term,`${locale} print=${physique} express=${express}`);
 }
});
for(const [locale,catalog] of Object.entries(messages)) test(`${locale}: FAQ and seasonal deadlines use conditional estimates, not order-only guarantees`,()=>{
 const t=createTranslator({locale,messages:catalog});
 for(const key of ['faq.a1','product.faqA1','home.faqA1','checkout.orderByGuidance','gift.generic','gift.deadline','gift.deadlineDouble','gift.deadlineNumerique','evenements.phaseNumerique','noel.impressionTexte','noel.numeriqueTexte']) {
  const text=t(key,{date:'DATE',dateNumerique:'DIGITAL',event:'EVENT',digitalDays:2,daysMin:6,days:10});
  for(const term of terms[locale].slice(1))assert.match(text,term,`${locale}:${key}`);
 }
});
test('real DateApercu renders the frozen weekend dates, print ranges and safe SSR fallback',()=>{
 const {default:DateApercu}=load('components/DateApercu.tsx',{react:{...React,useSyncExternalStore:(_subscribe,snapshot)=>snapshot()}});
 const render=(physique,express)=>renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages:messages.en,timeZone:'UTC'},React.createElement(DateApercu,{physique,express})));
 assert.match(render(false,false),/Tuesday, October 27/);
 assert.match(render(false,true),/Saturday, October 24/);
 const printed=render(true,false);assert.match(printed,/November 2 and 6/);
 const {default:ServerDate}=load('components/DateApercu.tsx');
 assert.equal(renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages:messages.en,timeZone:'UTC'},React.createElement(ServerDate,{physique:false,express:false}))), '');
});
test('real GiftDeadlineNote renders generic, double-deadline and digital-only seasonal branches in all locales',()=>{
 for(const date of ['2026-01-02T12:00:00Z','2026-12-01T12:00:00Z','2026-12-21T12:00:00Z']) {
  mock.timers.setTime(Date.parse(date));
  // Fresh module cache for each clock value, as on a new page visit.
  const {default:GiftDeadlineNote}=load('components/GiftDeadlineNote.tsx',{react:{...React,useSyncExternalStore:(_subscribe,snapshot)=>snapshot()}});
  for(const [locale,catalog] of Object.entries(messages))for(const variante of ['ligne','pastille']) {
   const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:catalog,timeZone:'UTC'},React.createElement(GiftDeadlineNote,{variante})));
   for(const term of terms[locale].slice(1))assert.match(html,term,`${locale}:${date}:${variante}`);
   assert.doesNotMatch(html,/undefined|INVALID_MESSAGE|MISSING_MESSAGE/);
  }
 }
});
