import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, mkdtempSync, readdirSync, existsSync, writeFileSync, symlinkSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const pgCtl = '/usr/lib/postgresql/18/bin/pg_ctl';
const minimalEnv = () => Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
test('Python cooperatively stops its real owned PostgreSQL on SIGTERM', async()=>{
 const sandbox=mkdtempSync(path.join(process.env.TMPDIR,'bs-'));
 const child=spawn('python3',['scripts/verify-ten-cards-local.py','--fixture-only'],{cwd:root,env:{...minimalEnv(),TMPDIR:sandbox},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 const closed=once(child,'close');
 let database;
 try {
  for(let i=0;i<1000;i++) {
   database=readdirSync(sandbox).map(p=>path.join(sandbox,p,'pg')).find(p=>existsSync(path.join(p,'postmaster.pid')));
   if(database && spawnSync(pgCtl,['-D',database,'status']).status===0 && existsSync(path.join(database,'postmaster.opts')))break;
   if(child.exitCode!==null)assert.fail(output);
   await delay(10);
  }
  assert.ok(database,'real PostgreSQL started');
  child.kill('SIGTERM');await closed;
  assert.equal(spawnSync(pgCtl,['-D',database,'status']).status,3,'owned postmaster must be stopped');
 } finally {
  if(child.exitCode===null && child.signalCode===null){child.kill('SIGKILL');await closed;}
  if(database)spawnSync(pgCtl,['-D',database,'-m','immediate','-w','stop'],{encoding:'utf8'});
 }
});
import path from 'node:path';
import { runOwnedBuild, stopOwnedDatabase } from './helpers/owned-build-harness.mjs';
import { createConnection } from 'node:net';

test('real timeout stops a disposable PostgreSQL even when Python cannot execute finally',async()=>{
 let ready=false;
 const result=await runOwnedBuild({root,timeoutMs:3000,graceMs:200,hold:true,onReady:child=>{ready=true;child.kill('SIGSTOP');}});
 try {
  assert.equal(ready,true,'real fixture reached readiness before timeout');
  assert.equal(result.timedOut,true);
  assert.equal(result.signal,'SIGKILL','frozen Python cannot run finally');
  assert.equal(spawnSync(pgCtl,['-D',path.join(result.runtime,'pg'),'status']).status,3,'parent must stop its owned daemon on actual timeout');
  const {port}=JSON.parse(result.stdout.trim().split('\n')[0]);
  await assert.rejects(new Promise((resolve,reject)=>{const socket=createConnection({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();resolve();});socket.once('error',reject);}),{code:'ECONNREFUSED'});
  console.log(JSON.stringify({forcedTimeoutCleanup:result}));
 }finally{spawnSync(pgCtl,['-D',path.join(result.runtime,'pg'),'-m','immediate','-w','stop']);}
});
test('real timeout first gives Python a cooperative shutdown grace period',async()=>{
 let ready=false;
 const result=await runOwnedBuild({root,timeoutMs:3000,hold:true,onReady:()=>{ready=true;}});
 assert.equal(ready,true);
 assert.equal(result.timedOut,true);
 assert.equal(result.status,143);
 assert.equal(result.signal,null);
 assert.equal(result.cleanup.stopped,true);
 assert.equal(result.cleanup.parentStoppedDatabase,false,'Python finally already stopped its database');
 console.log(JSON.stringify({cooperativeTimeoutCleanup:result}));
});

test('parent cleanup and Python both reject unowned or redirected runtimes',()=>{
 const runtime=mkdtempSync(path.join(process.env.TMPDIR,'ten-build-'));
 writeFileSync(path.join(runtime,'.build-owner'),'owned-token',{mode:0o600});
 assert.throws(()=>stopOwnedDatabase(runtime,'wrong-token'),/unowned/);
 const rejected=spawnSync('python3',['scripts/verify-ten-cards-local.py','--fixture-only','--runtime-dir',runtime,'--owner-token','wrong-token'],{cwd:root,env:minimalEnv(),encoding:'utf8'});
 assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/unowned runtime/);
 assert.equal(existsSync(path.join(runtime,'pg')),false);
 const foreign=mkdtempSync(path.join(process.env.TMPDIR,'foreign-'));
 writeFileSync(path.join(foreign,'sentinel'),'untouched');
 symlinkSync(foreign,path.join(runtime,'pg'));
 assert.throws(()=>stopOwnedDatabase(runtime,'owned-token'),/redirected/);
 assert.equal(readFileSync(path.join(foreign,'sentinel'),'utf8'),'untouched');
});
const root = path.resolve(import.meta.dirname, '..');
test('build harness depends only on versioned synthetic schema, not a private schema snapshot', () => {
  const source = readFileSync(path.join(root, 'scripts/verify-ten-cards-local.py'), 'utf8');
  assert.doesNotMatch(source, /e2e-purchase-2026-10-25|schema-only\.sql/);
  assert.match(source, /build-fixture\.sql/);
});
test('synthetic build fixture applies all repository migrations in PostgreSQL and stops its own service', async() => {
  assert.match(readFileSync(path.join(root, 'scripts/verify-ten-cards-local.py'), 'utf8'), /--fixture-only/);
  const result = await runOwnedBuild({root});
  assert.equal(result.timedOut,false);
  assert.equal(result.cleanup.stopped,true);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const summary = JSON.parse(result.stdout.trim().split('\n').at(-1));
  assert.equal(summary.fixtureOnly, true);
  assert.equal(summary.disposableDatabaseStopped, true);
  assert.equal(summary.serverStopped, true);
  assert.ok(summary.migrations.length > 0);
  assert.equal(summary.migrations.length, summary.migrationsReapplied);
  console.log(JSON.stringify({ buildFixture: summary }));
});
