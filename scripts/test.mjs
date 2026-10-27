import {readdirSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {tmpdir, homedir} from 'node:os';
import {randomBytes, randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {partition, summarizeTap} from './test-runner.mjs';
import {CampaignStore, runCampaignChild} from './operations-campaign.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inventory=()=>readdirSync(path.join(root,'tests')).filter(f=>f.endsWith('.test.mjs')).sort();
const files=inventory();
if(!files.length)throw new Error('Empty test inventory');
const groups=partition(files);
const scratch=tmpdir();
const artifacts=mkdtempSync(path.join(scratch,'tap-'));
const campaignId=`tests-${randomUUID()}`;
const store=new CampaignStore(path.join(artifacts,'campaign'));
await store.create(campaignId,{assessmentRequired:true});
const home=path.join(artifacts,'home');mkdirSync(home);
const pg='/usr/lib/postgresql/18/bin';
const env={PATH:`${path.dirname(process.execPath)}:/usr/bin:/bin`,HOME:home,TMPDIR:scratch,
  LANG:'C.UTF-8',LC_ALL:'C.UTF-8',TZ:'UTC',TEST_PG_BIN:pg,
  PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(homedir(),'.cache/ms-playwright')};
for(const binary of ['initdb','pg_ctl'])if(!existsSync(path.join(pg,binary)))throw new Error(`Missing ${pg}/${binary}; see tests/TESTING.md`);
if(process.getuid?.()===0)throw new Error('PostgreSQL tests require an unprivileged user');
writeFileSync(path.join(artifacts,'manifest.json'),JSON.stringify({files,groups,campaignId},null,2));
console.log(`Test artifacts: ${artifacts}\nInventory: ${files.length} files, disjoint groups: ${groups.length}`);
const results=[];const deadline=Date.now()+20*60*1000;
let interrupted=false;
const interrupt=()=>{interrupted=true;};
process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
// Keep the owned fixture root short: PostgreSQL Unix sockets have a 107-byte
// pathname ceiling. mkdir is exclusive; never reuse another invocation's root.
let fixtures;
for(let attempt=0;attempt<256;attempt++){
  const candidate=path.join(scratch,randomBytes(1).toString('hex'));
  try {mkdirSync(candidate,{mode:0o700});fixtures=candidate;break;}
  catch(error){if(error.code!=='EEXIST')throw error;}
}
if(!fixtures)throw new Error('Cannot allocate isolated fixture root');
const fixtureDirs=()=>readdirSync(fixtures,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name);
for(const group of groups)for(const file of group.files){
  if(interrupted || Date.now()>=deadline)break;
  const before=new Set(fixtureDirs());
  const log=path.join(artifacts,file+'.tap');
  const args=['--import','./scripts/test-network.mjs',...(group.tsx?['--import','tsx']:[]),
    '--test','--test-concurrency=1','--test-reporter=tap',`tests/${file}`];
  const task=`suite-${files.indexOf(file)}`;
  const attemptId=await store.beginAttempt(campaignId,task);
  const processId=`${task}-1`;
  const execution=await runCampaignChild({store,campaignId,attemptId,processId,args,cwd:root,log,env:{...env,TMPDIR:fixtures},timeoutMs:Math.min(180000,deadline-Date.now())});
  // PostgreSQL daemonizes outside the child's process group. Stop only fresh
  // fixture directories inside our exclusive root, never a DATABASE_URL.
  let cleanupFailed=false;const cleanup=[];
  for(const dir of fixtureDirs().filter(f=>!before.has(f))){
    const fixture=path.join(fixtures,dir);const data=path.join(fixture,'pg');
    let stop=null;let verification=null;let stopped=true;let removalError=null;
    if(existsSync(path.join(data,'postmaster.pid'))){
      const stopped=spawnSync(path.join(pg,'pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{env,timeout:10000,encoding:'utf8'});
      stop={code:stopped.status,signal:stopped.signal,error:stopped.error?.message??null};
      if(stopped.status!==0){cleanupFailed=true;console.error(`Could not stop fixture ${data}`);}
    }
    if(existsSync(path.join(data,'PG_VERSION')) || existsSync(path.join(data,'postmaster.pid'))){
      const status=spawnSync(path.join(pg,'pg_ctl'),['-D',data,'status'],{env,timeout:10000,encoding:'utf8'});
      verification={code:status.status,signal:status.signal,error:status.error?.message??null};
      stopped=status.status===3&&!status.signal&&!status.error&&!existsSync(path.join(data,'postmaster.pid'));
      if(!stopped)cleanupFailed=true;
    }
    if(stopped)try {rmSync(fixture,{recursive:true,force:true});}catch(error){cleanupFailed=true;removalError=error.message;}
    cleanup.push({fixture,data,stop,verification,stopped,removalError});
  }
  const tap=summarizeTap(readFileSync(log,'utf8'));
  const servicesStopped=(await store.snapshot(campaignId)).processes.find(p=>p.id===processId).stopped;
  const ok=execution.code===0 && !execution.signal && !execution.timedOut && !execution.overflow && !execution.error && !cleanupFailed && servicesStopped && tap.ok;
  await store.assessProcess(campaignId,processId,{ok,cleanup,suite:{file,log,tap}});
  await store.notification(campaignId,{eventId:`${processId}-completion`,attemptId,processId,kind:ok?'success':'failure'});
  results.push({file,group:{browser:group.browser,tsx:group.tsx},...execution,tap,ok,cleanupFailed});
  console.log(`${ok?'PASS':'FAIL'} ${file}: ${JSON.stringify(tap)}`);
  if(!ok)console.error(readFileSync(log,'utf8').slice(-16000));
}
if(!results.some(result=>result.cleanupFailed))rmSync(fixtures,{recursive:true,force:true});
const totals=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(key=>[key,results.reduce((n,r)=>n+(r.tap[key]??0),0)]));
const complete=results.length===files.length && JSON.stringify(inventory())===JSON.stringify(files);
let ok=complete && !interrupted && results.every(r=>r.ok);
let final;
try {
  await store.finalize(campaignId,{ok});
  final=await store.claimFinal(campaignId);
  ok=ok&&final?.status==='passed';
} catch(error) {
  ok=false;final={campaignId,status:'blocked',servicesStopped:false,error:error.message};
}
writeFileSync(path.join(artifacts,'campaign-final.json'),JSON.stringify(final,null,2));
writeFileSync(path.join(artifacts,'summary.json'),JSON.stringify({ok,complete,expectedFiles:files.length,executedFiles:results.length,totals,results,campaignId},null,2));
process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);
console.log(JSON.stringify({ok,complete,files:results.length,totals,artifacts},null,2));
process.exitCode=ok?0:1;
