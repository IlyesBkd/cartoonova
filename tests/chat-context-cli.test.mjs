// Fresh-process CLI harness. Every provider and PostgreSQL call is intercepted.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {nextTask,saveTranslation} from '/home/hermes/.hermes/profiles/cartoonova/scripts/notification-translation.mjs';
const script=new URL('../scripts/chat-telegram-worker.mjs',import.meta.url).pathname;
test('real CLI: immediate original, shared-cache completion, one later French notification; no real SQL/network/inference',()=>{
 const dir=mkdtempSync(join(tmpdir(),'chat-context-cli-'));
 try {
  const fixture=join(dir,'state.json'),cache=join(dir,'cache.sqlite'),ledger=join(dir,'ledger.sqlite');
  writeFileSync(fixture,JSON.stringify({state:'pending',attempts:0,payloads:[],queries:[]}));
  const mock=join(dir,'postgres.mjs');
  writeFileSync(mock,`
import {readFileSync,writeFileSync} from 'node:fs';
const path=process.env.FIXTURE;
export default function postgres(url){
 if(url!=='fixture://no-network')throw Error('Real DB forbidden');
 const sql=async(strings,...values)=>{
  const q=strings.join('?');const s=JSON.parse(readFileSync(path));s.queries.push(q);let result;
  if(q.startsWith('WITH candidate')){if(s.state==='pending'){s.state='processing';s.attempts++;s.token=values[1];result=[{id:1,support_message_id:42,email:'synthetic@example.invalid',body:'Hello | source complete 😀'}];}else result=[];}
  else if(q.includes('SELECT count(*)::int AS n'))result=[{n:s.state==='pending'?1:0}];
  else if(q.includes("SET status='processing'")){if(s.state==='pending'){s.state='processing';s.attempts++;s.token=values[0];result=[{id:1,support_message_id:42}];}else result=[];}
  else if(q.includes('FROM support_messages'))result=[{id:42,email:'synthetic@example.invalid',body:'Hello | source complete 😀'}];
  else if(q.includes('SET LOCAL'))result=[];
  else if(q.includes('FROM orders'))result=[];
  else if(q.includes("SET status='sent'")){if(s.token!==values[1])throw Error('Lost fence');s.state='sent';result=[{id:1}];}
  else if(q.includes('SELECT status FROM chat_telegram_notifications'))result=[{status:s.state}];
  else if(q.includes('FILTER'))result=[{pending:s.state==='pending'?1:0,processing:s.state==='processing'?1:0,staleProcessing:0}];
  else throw Error('Unexpected SQL');
  writeFileSync(path,JSON.stringify(s));return result;
 };
 sql.begin=async(mode,fn)=>{if(mode!=='isolation level repeatable read read only')throw Error('Unsafe context');return fn(sql);};
 sql.end=async()=>{};return sql;
}
`);
  const loader=join(dir,'loader.mjs');
  writeFileSync(loader,`
export async function resolve(specifier,context,next){
 if(specifier==='postgres')return {url:${JSON.stringify(pathToFileURL(mock).href)},shortCircuit:true};
 if(specifier.endsWith('/support-email-local-v2/inference.mjs'))return {url:'data:text/javascript,export async function runInference(){return "Brouillon synthétique"}',shortCircuit:true};
 return next(specifier,context);
}
`);
  const preload=join(dir,'preload.mjs');
  writeFileSync(preload,`
import {readFileSync,writeFileSync} from 'node:fs';
globalThis.fetch=async(url,options)=>{
 if(url!=='https://api.telegram.org/botfake/sendMessage')throw Error('Unexpected destination');
 const path=process.env.FIXTURE,s=JSON.parse(readFileSync(path));
 s.payloads.push(JSON.parse(options.body));writeFileSync(path,JSON.stringify(s));
 return {ok:true,json:async()=>({ok:true})};
};
`);
  const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,FIXTURE:fixture,
   CARTOONOVA_TRANSLATION_DB:cache,CHAT_NOTIFY_TRANSLATION_STATE:ledger,CHAT_NOTIFY_DATABASE_URL:'fixture://no-network',
   CHAT_NOTIFY_TELEGRAM_TOKEN:'fake',CHAT_NOTIFY_TELEGRAM_CHAT_ID:'123',CHAT_NOTIFY_TELEGRAM_CONFIRMED_CHAT_ID:'123'};
  const tick=(expectedStatus=0)=>{
   const r=spawnSync(process.execPath,['--experimental-loader',loader,'--import',preload,script,'--send'],{env,encoding:'utf8',timeout:15000});
   assert.equal(r.status,expectedStatus,r.stderr);return JSON.parse(r.stdout);
  };
  assert.equal(tick().sent,1);
  let s=JSON.parse(readFileSync(fixture));assert.equal(s.attempts,1);assert.equal(s.payloads.length,2);
  assert.match(s.payloads[0].text,/Traduction FR en attente/);assert.ok(s.payloads[0].text.endsWith('Hello | source complete 😀'));
  const task=nextTask(cache);assert.equal(task.source,'Hello | source complete 😀');
  saveTranslation({key:task.key,fr:'Bonjour | source complète 😀'},cache);
  // An ambiguous original (e.g. process stopped before SQL acknowledgement)
  // must not release the persisted translation, even when the cache is ready.
  s.state='processing';writeFileSync(fixture,JSON.stringify(s));
  assert.equal(tick().translationFollowups.attempted,0);
  s=JSON.parse(readFileSync(fixture));assert.equal(s.payloads.length,2);
  s.state='sent';writeFileSync(fixture,JSON.stringify(s));
  assert.equal(tick().translationFollowups.sent,1);
  s=JSON.parse(readFileSync(fixture));assert.equal(s.payloads.length,3);assert.equal(s.attempts,1);assert.equal(s.state,'sent');
  assert.match(s.payloads[2].text,/Traduction FR · Chat #42/);assert.ok(s.payloads[2].text.endsWith('Bonjour | source complète 😀'));
  assert.equal(tick().translationFollowups.attempted,0);
  s=JSON.parse(readFileSync(fixture));assert.equal(s.payloads.length,3);assert.equal(s.attempts,1);
  assert.ok(s.queries.filter(q=>/^(INSERT|UPDATE|DELETE)/.test(q)).every(q=>q.startsWith('UPDATE chat_telegram_notifications')));
  // Broken cache AND followup state must still deliver the incoming original.
  const broken=join(dir,'broken');mkdirSync(broken);
  env.CARTOONOVA_TRANSLATION_DB=broken;env.CHAT_NOTIFY_TRANSLATION_STATE=broken;
  writeFileSync(fixture,JSON.stringify({state:'pending',attempts:0,payloads:[],queries:[]}));
  const degraded=tick(1);assert.equal(degraded.sent,1);assert.equal(degraded.translationFollowupsUnavailable,true);
  s=JSON.parse(readFileSync(fixture));assert.equal(s.state,'sent');assert.equal(s.payloads.length,2);
  assert.match(s.payloads[0].text,/Traduction FR indisponible/);assert.ok(s.payloads[0].text.endsWith('Hello | source complete 😀'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
