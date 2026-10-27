import test, {after} from 'node:test';
import {writeFile, readFile} from 'node:fs/promises';
import {runChild} from '../scripts/test-runner.mjs';
const evidence=[];
after(async () => {
  if(process.env.OPS_REPORT_PATH) await writeFile(process.env.OPS_REPORT_PATH, JSON.stringify(evidence,null,2)+'\n');
});
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const load = () => import('../scripts/operations-campaign.mjs');

async function competingCalls(root, campaignId, expression, count=5) {
  const moduleUrl=new URL('../scripts/operations-campaign.mjs',import.meta.url).href;
  return Promise.all(Array.from({length:count},async(_,i)=>{
    const log=join(root,`contender-${i}.log`);
    const result=await runChild({args:['--input-type=module','-e',`import {CampaignStore} from ${JSON.stringify(moduleUrl)}; const store=new CampaignStore(${JSON.stringify(root)}); const id=${JSON.stringify(campaignId)}; try {console.log(JSON.stringify({accepted:true,value:await (${expression})}));} catch(error) {console.log(JSON.stringify({accepted:false,error:error.message}));}`],cwd:root,log,env:{PATH:process.env.PATH}});
    assert.equal(result.code,0);return JSON.parse(await readFile(log,'utf8'));
  }));
}

test('OS contenders reserve a task exclusively before any process starts',async()=>{
  const {CampaignStore,runCampaignChild}=await load();const root=await mkdtemp(join(tmpdir(),'ops-reserve-'));
  try {
    const store=new CampaignStore(root);await store.create('reservation');
    const calls=await competingCalls(root,'reservation',"store.beginAttempt(id,'suite')");
    assert.equal(calls.filter(c=>c.accepted).length,1);
    assert.ok(calls.filter(c=>!c.accepted).every(c=>/reserved|running/.test(c.error)));
    const attemptId=calls.find(c=>c.accepted).value;
    await runCampaignChild({store,campaignId:'reservation',attemptId,processId:'winner',args:['-e','process.exit(0)'],cwd:root,log:join(root,'winner.log'),env:{PATH:process.env.PATH}});
    assert.equal((await store.finalize('reservation')).status,'passed');
    assert.equal((await store.snapshot('reservation')).attempts.length,1);
    evidence.push({scenario:'exclusive-pre-start-reservation',calls,state:await store.snapshot('reservation')});
  } finally {await rm(root,{recursive:true,force:true});}
});

test('OS retry contenders cannot overlap an exited process with stopped false',async()=>{
  const {CampaignStore}=await load();const root=await mkdtemp(join(tmpdir(),'ops-retry-'));
  try {
    const store=new CampaignStore(root);await store.create('retry');
    const attempt=await store.beginAttempt('retry','suite');
    await store.startProcess('retry',attempt,'old');
    await store.finishProcess('retry','old',{code:0},false);
    const calls=await competingCalls(root,'retry',"store.beginAttempt(id,'suite')");
    assert.equal(calls.filter(c=>c.accepted).length,0);
    assert.ok(calls.every(c=>/not verified stopped/.test(c.error)));
    assert.equal((await store.snapshot('retry')).attempts.length,1);
    await assert.rejects(store.finalize('retry'),/services not verified stopped/);
    evidence.push({scenario:'retry-refused-unverified-stop',calls,state:await store.snapshot('retry')});
  } finally {await rm(root,{recursive:true,force:true});}
});

test('suite retries require persisted assessment even after verified group exit',async()=>{
  const {CampaignStore,runCampaignChild}=await load();const root=await mkdtemp(join(tmpdir(),'ops-assess-retry-'));
  try {
    const store=new CampaignStore(root);await store.create('suite',{assessmentRequired:true});
    const attemptId=await store.beginAttempt('suite','task');
    await runCampaignChild({store,campaignId:'suite',attemptId,processId:'old',args:['-e','process.exit(7)'],cwd:root,log:join(root,'old.log'),env:{PATH:process.env.PATH}});
    const pending=await competingCalls(root,'suite',"store.beginAttempt(id,'task')");
    assert.equal(pending.filter(c=>c.accepted).length,0);
    assert.ok(pending.every(c=>/assessment pending/.test(c.error)));
    await new CampaignStore(root).assessProcess('suite','old',{ok:false,cleanup:[],suite:{tap:{ok:false}}});
    const ready=await competingCalls(root,'suite',"store.beginAttempt(id,'task')");
    assert.equal(ready.filter(c=>c.accepted).length,1);
    const retry=ready.find(c=>c.accepted).value;
    await runCampaignChild({store,campaignId:'suite',attemptId:retry,processId:'new',args:['-e','process.exit(0)'],cwd:root,log:join(root,'new.log'),env:{PATH:process.env.PATH}});
    await store.assessProcess('suite','new',{ok:true,cleanup:[],suite:{tap:{ok:true}}});
    assert.equal((await store.finalize('suite')).status,'passed');
    evidence.push({scenario:'retry-assessment-gate',pending,ready,state:await store.snapshot('suite')});
  } finally {await rm(root,{recursive:true,force:true});}
});

test('OS finalizers cannot claim suite success before TAP and cleanup assessment',async()=>{
  const {CampaignStore,runCampaignChild}=await load();const root=await mkdtemp(join(tmpdir(),'ops-assess-final-'));
  try {
    const store=new CampaignStore(root);
    for(const mode of ['tap','cleanup']) {
      await store.create(mode,{assessmentRequired:true});
      const attemptId=await store.beginAttempt(mode,'task');
      await runCampaignChild({store,campaignId:mode,attemptId,processId:'child',args:['-e','process.exit(0)'],cwd:root,log:join(root,`${mode}.log`),env:{PATH:process.env.PATH}});
      const pending=await competingCalls(root,mode,'store.finalize(id)');
      assert.equal(pending.filter(c=>c.accepted).length,0);
      assert.ok(pending.every(c=>/assessment pending/.test(c.error)));
      await assert.rejects(new CampaignStore(root).claimFinal(mode),/not finalized/);
      const before=await store.snapshot(mode);
      assert.equal(before.assessmentRequired,true);assert.equal(before.final,null);
      await store.assessProcess(mode,'child',{ok:false,cleanup:mode==='cleanup'?[{stopped:false}]:[],suite:{tap:{ok:false}}});
      const assessed=await competingCalls(root,mode,'store.finalize(id)');
      if(mode==='tap') {
        assert.ok(assessed.every(c=>c.accepted&&c.value.status==='failed'));
        const claims=await competingCalls(root,mode,'store.claimFinal(id)');
        assert.equal(claims.filter(c=>c.value).length,1);
        assert.equal(claims.find(c=>c.value).value.status,'failed');
      } else {
        assert.ok(assessed.every(c=>!c.accepted&&/services not verified stopped/.test(c.error)));
        await assert.rejects(store.claimFinal(mode),/not finalized/);
        await assert.rejects(store.beginAttempt(mode,'task'),/services not verified stopped/);
      }
      evidence.push({scenario:`final-assessment-gate-${mode}`,pending,before,assessed,state:await store.snapshot(mode)});
    }
  } finally {await rm(root,{recursive:true,force:true});}
});

test('finalize refuses an attempt without a process and treats code zero with signal as failure',async()=>{
  const {CampaignStore}=await load();const root=await mkdtemp(join(tmpdir(),'ops-final-'));
  try {
    const store=new CampaignStore(root);await store.create('missing');
    await store.beginAttempt('missing','suite');
    await assert.rejects(store.finalize('missing'),/attempt without process/);
    await store.create('signal');const attempt=await store.beginAttempt('signal','suite');
    await store.startProcess('signal',attempt,'child');
    await store.finishProcess('signal','child',{code:0,signal:'SIGTERM'},true);
    assert.equal((await store.finalize('signal')).status,'failed');
  } finally {await rm(root,{recursive:true,force:true});}
});

test('duplicates and competing OS processes cannot claim a second final or mix campaigns', async () => {
  const {CampaignStore, runCampaignChild} = await load();
  const root=await mkdtemp(join(tmpdir(),'ops-isolation-'));
  try {
    const store=new CampaignStore(root);
    for(const id of ['alpha','beta']) {
      await store.create(id);
      const attemptId=await store.beginAttempt(id,'build');
      await runCampaignChild({store,campaignId:id,attemptId,processId:'same-process',args:['-e','process.exit(0)'],cwd:root,log:join(root,`${id}.log`),env:{PATH:process.env.PATH}});
      const event={eventId:'same-event',attemptId,processId:'same-process',kind:'success'};
      const results=await Promise.all(Array.from({length:6},()=>store.notification(id,event)));
      assert.equal(results.filter(x=>x.reason==='completed-process').length,1);
      assert.equal(results.filter(x=>x.reason==='duplicate').length,5);
      await store.finalize(id);
    }
    const betaBefore=await store.snapshot('beta');
    const moduleUrl=new URL('../scripts/operations-campaign.mjs',import.meta.url).href;
    const claims=await Promise.all(Array.from({length:5},async(_,i)=>{
      const log=join(root,`claim-${i}.log`);
      const result=await runChild({args:['--input-type=module','-e',`import {CampaignStore} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(await new CampaignStore(${JSON.stringify(root)}).claimFinal('alpha')));`],cwd:root,log,env:{PATH:process.env.PATH}});
      assert.equal(result.code,0);return JSON.parse(await readFile(log,'utf8'));
    }));
    assert.equal(claims.filter(Boolean).length,1);
    assert.deepEqual(await store.snapshot('beta'),betaBefore);
    assert.ok(await store.claimFinal('beta'));
    await assert.rejects(store.beginAttempt('alpha','build'),/finalized/);
    evidence.push({scenario:'multiprocess-claims-isolation',osProcesses:5,winners:claims.filter(Boolean).length,alpha:await store.snapshot('alpha'),beta:await store.snapshot('beta')});
  } finally {await rm(root,{recursive:true,force:true});}
});

test('cleanup assessment blocks final while services remain and preserves cleanup failure',async()=>{
  const {CampaignStore}=await load();const root=await mkdtemp(join(tmpdir(),'ops-cleanup-'));
  try {
    const store=new CampaignStore(root);await store.create('cleanup');
    const attempt=await store.beginAttempt('cleanup','suite');
    await store.startProcess('cleanup',attempt,'child');
    await store.finishProcess('cleanup','child',{code:0},true);
    await store.assessProcess('cleanup','child',{ok:false,cleanup:[{stopped:false,stop:{code:1}}]});
    await assert.rejects(store.finalize('cleanup'),/services not verified stopped/);
    assert.equal((await store.snapshot('cleanup')).processes[0].result.ok,false);
    await assert.rejects(store.claimFinal('cleanup'),/not finalized/);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('real listening descendant is killed and checked before final, including timeout',async()=>{
  const {CampaignStore,runCampaignChild,liveGroupMembers}=await load();
  const root=await mkdtemp(join(tmpdir(),'ops-services-'));
  try {
    const store=new CampaignStore(root);await store.create('services');
    for(const mode of ['success','timeout']) {
      const attemptId=await store.beginAttempt('services',mode);
      const childCode=`const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>console.log('LISTENING'));process.on('SIGTERM',()=>{});`;
      const parentCode=`const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e',${JSON.stringify(childCode)}],{stdio:['ignore','pipe','ignore']});c.stdout.once('data',()=>{console.log('CHILD_LISTENING');${mode==='success'?'process.exit(0)':'setInterval(()=>{},1000)'}});`;
      const result=await runCampaignChild({store,campaignId:'services',attemptId,processId:mode,args:['-e',parentCode],cwd:root,log:join(root,`${mode}.log`),env:{PATH:process.env.PATH},timeoutMs:mode==='timeout'?1500:5000});
      assert.match(await readFile(join(root,`${mode}.log`),'utf8'),/CHILD_LISTENING/);
      assert.equal(result.timedOut,mode==='timeout');
      const p=(await store.snapshot('services')).processes.at(-1);
      assert.equal(p.stopped,true);assert.deepEqual(await liveGroupMembers(p.pid),[]);
    }
    const final=await store.finalize('services');assert.equal(final.status,'failed');
    evidence.push({scenario:'real-service-shutdown',state:await store.snapshot('services')});
  } finally {await rm(root,{recursive:true,force:true});}
});

test('pending process prevents final and retries; uncorrelated messages never become user alerts',async()=>{
  const {CampaignStore}=await load();const root=await mkdtemp(join(tmpdir(),'ops-gates-'));
  try {
    const store=new CampaignStore(root);await store.create('gates');
    const attemptId=await store.beginAttempt('gates','build');
    await store.startProcess('gates',attemptId,'pending');
    await assert.rejects(store.finalize('gates'),/services not verified stopped/);
    await assert.rejects(store.beginAttempt('gates','build'),/still running/);
    await assert.rejects(store.startProcess('gates',attemptId,'pending'),/duplicate process/);
    assert.deepEqual(await store.notification('gates',{eventId:'unbound',attemptId,processId:'other',kind:'failure'}),{notify:false,reason:'unknown-process'});
    assert.deepEqual(await store.notification('gates',{eventId:'progress',attemptId,processId:'pending',kind:'failure'}),{notify:false,reason:'internal-only'});
    await store.finishProcess('gates','pending',{code:0},false);
    await assert.rejects(store.finalize('gates'),/services not verified stopped/);
    await assert.rejects(store.claimFinal('gates'),/not finalized/);
    await assert.rejects(store.create('../escape'));
    evidence.push({scenario:'fail-closed-gates',state:await store.snapshot('gates')});
  } finally {await rm(root,{recursive:true,force:true});}
});
test('failed startup then retry produces one coherent durable final report', async () => {
  const {CampaignStore, runCampaignChild} = await load();
  const root = await mkdtemp(join(tmpdir(), 'ops-campaign-'));
  try {
    const store = new CampaignStore(root);
    await store.create('recovery');
    const first = await store.beginAttempt('recovery', 'build');
    const failed = await runCampaignChild({store, campaignId:'recovery', attemptId:first, processId:'failed-start', args:['-e','process.exit(7)'], cwd:root, log:join(root,'failed.log'), env:{PATH:process.env.PATH}});
    assert.equal(failed.code, 7);
    const retry = await store.beginAttempt('recovery', 'build');
    const success = await runCampaignChild({store, campaignId:'recovery', attemptId:retry, processId:'retry', args:['-e','console.log("recovered")'], cwd:root, log:join(root,'retry.log'), env:{PATH:process.env.PATH}});
    assert.equal(success.code, 0);
    assert.equal((await store.notification('recovery', {eventId:'late-failure', attemptId:first, processId:'failed-start', kind:'failure'})).reason, 'obsolete-attempt');
    const final = await store.finalize('recovery');
    assert.equal(final.status, 'passed');
    assert.equal(final.attempts.length, 2);
    assert.equal(final.processes.every(p => p.stopped), true);
    const claims = await Promise.all(Array.from({length:8}, () => new CampaignStore(root).claimFinal('recovery')));
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal((await store.notification('recovery', {eventId:'late-success', attemptId:retry, processId:'retry', kind:'success'})).reason, 'finalized');
    assert.equal(await new CampaignStore(root).claimFinal('recovery'), null);
    evidence.push({scenario:'failure-recovery',claims:claims.filter(Boolean).length,state:await store.snapshot('recovery')});
  } finally { await rm(root,{recursive:true,force:true}); }
});
