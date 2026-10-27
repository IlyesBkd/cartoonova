// Local-only campaign ledger. No gateway hooks and no notification transport.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile, rename, rm, readdir} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {runChild} from './test-runner.mjs';

const valid = value => assert.match(value, /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/);
const active = s => assert.equal(s.final, null, 'campaign finalized');
const attemptFor = (s,id) => {const a=s.attempts.find(a=>a.id===id);assert.ok(a,'unknown attempt');return a;};

export class CampaignStore {
  constructor(root) {this.root=resolve(root);}
  async transaction(id, update) {
    valid(id);
    await mkdir(this.root,{recursive:true,mode:0o700});
    const lock=join(this.root,`${id}.lock`), path=join(this.root,`${id}.json`);
    const deadline=Date.now()+5000;
    for (;;) {
      try {await mkdir(lock,{mode:0o700});break;} catch(e) {
        if(e.code!=='EEXIST') throw e;
        assert.ok(Date.now()<deadline,'campaign lock busy; inspect owner before recovery');
        await delay(10);
      }
    }
    try {
      let state=null;
      try {state=JSON.parse(await readFile(path,'utf8'));} catch(e) {if(e.code!=='ENOENT')throw e;}
      const {state:next, result}=await update(state);
      const temp=`${path}.${randomUUID()}.tmp`;
      try {await writeFile(temp,JSON.stringify(next,null,2)+'\n',{mode:0o600});await rename(temp,path);}
      finally {await rm(temp,{force:true});}
      return structuredClone(result);
    } finally {await rm(lock,{recursive:true});}
  }
  // Raw commands may opt out; suite orchestrators must require TAP/cleanup assessment.
  create(id, {assessmentRequired=false}={}) {
    assert.equal(typeof assessmentRequired,'boolean','invalid assessmentRequired');
    return this.transaction(id,s=>{assert.equal(s,null,'campaign exists');return {state:{version:1,campaignId:id,assessmentRequired,attempts:[],processes:[],events:[],final:null,claimed:false},result:id};});
  }
  snapshot(id) {return this.transaction(id,s=>{assert.ok(s,'unknown campaign');return {state:s,result:s};});}
  beginAttempt(id, task) {
    valid(task);
    return this.transaction(id,s=>{
      assert.ok(s,'unknown campaign');active(s);
      const previous=s.attempts.filter(a=>a.task===task).at(-1);
      if(previous) {
        const process=s.processes.find(p=>p.attemptId===previous.id);
        assert.ok(process,'task reserved before process start');
        assert.ok(process.result,'task still running');
        assert.equal(process.stopped,true,'services not verified stopped');
        if(s.assessmentRequired)assert.equal(process.assessed,true,'assessment pending');
      }
      const a={id:randomUUID(),task,number:s.attempts.filter(a=>a.task===task).length+1};
      s.attempts.push(a);return {state:s,result:a.id};
    });
  }
  startProcess(id, attemptId, processId) {
    valid(processId);
    return this.transaction(id,s=>{
      active(s);const a=attemptFor(s,attemptId);
      assert.equal(s.attempts.filter(x=>x.task===a.task).at(-1).id,a.id,'obsolete attempt');
      assert.ok(!s.processes.some(p=>p.id===processId),'duplicate process');
      assert.ok(!s.processes.some(p=>p.attemptId===attemptId),'attempt already started');
      s.processes.push({id:processId,attemptId,task:a.task,pid:null,result:null,stopped:false});
      return {state:s,result:processId};
    });
  }
  recordPid(id, processId, pid) {return this.transaction(id,s=>{
    active(s);const p=s.processes.find(p=>p.id===processId);assert.ok(p&&!p.result,'process not running');
    assert.ok(Number.isInteger(pid)&&pid>0,'invalid pid');p.pid=pid;return {state:s,result:null};
  });}
  finishProcess(id,processId,result,stopped) {return this.transaction(id,s=>{
    active(s);const p=s.processes.find(p=>p.id===processId);assert.ok(p&&!p.result,'process not running');
    p.result=result;p.stopped=stopped;return {state:s,result:null};
  });}
  notification(id,event) {return this.transaction(id,s=>{
    assert.ok(s,'unknown campaign');valid(event.eventId);
    const p=s.processes.find(p=>p.id===event.processId&&p.attemptId===event.attemptId);
    let reason='internal-only';
    if(s.events.some(e=>e.eventId===event.eventId))return {state:s,result:{notify:false,reason:'duplicate'}};
    if(!p)reason='unknown-process';
    else if(s.final)reason='finalized';
    else if(s.attempts.filter(a=>a.task===p.task).at(-1).id!==p.attemptId)reason='obsolete-attempt';
    else if(p.result)reason='completed-process';
    s.events.push({...event,reason});return {state:s,result:{notify:false,reason}};
  });}
  assessProcess(id,processId,{ok,cleanup,suite=null}) {return this.transaction(id,s=>{
    active(s);const p=s.processes.find(p=>p.id===processId);assert.ok(p?.result,'process not finished');
    p.result.ok=ok;p.cleanup=cleanup;p.suite=suite;p.assessed=true;
    p.stopped=p.stopped&&cleanup.every(c=>c.stopped);
    return {state:s,result:null};
  });}
  finalize(id, {ok=true}={}) {return this.transaction(id,s=>{
    assert.ok(s,'unknown campaign');
    if(!s.final) {
      assert.ok(s.attempts.length,'empty campaign');
      assert.ok(s.attempts.every(a=>s.processes.some(p=>p.attemptId===a.id)),'attempt without process');
      assert.ok(s.processes.every(p=>p.result&&p.stopped),'services not verified stopped');
      if(s.assessmentRequired)assert.ok(s.processes.every(p=>p.assessed===true),'assessment pending');
      const latest=[...new Set(s.attempts.map(a=>a.task))].map(task=>s.attempts.filter(a=>a.task===task).at(-1));
      const passed=ok&&latest.every(a=>{const p=s.processes.find(p=>p.attemptId===a.id);return p&&p.result.code===0&&!p.result.signal&&!p.result.timedOut&&!p.result.overflow&&!p.result.error&&p.result.ok!==false;});
      s.final={campaignId:id,status:passed?'passed':'failed',attempts:structuredClone(s.attempts),processes:structuredClone(s.processes),servicesStopped:true};
    }
    return {state:s,result:s.final};
  });}
  // A durable local claim is at-most-once, NOT exactly-once delivery to a remote service.
  claimFinal(id) {return this.transaction(id,s=>{
    assert.ok(s?.final,'campaign not finalized');const result=s.claimed?null:s.final;s.claimed=true;return {state:s,result};
  });}
}

// Linux /proc verifies the owned process group, including children, excluding dead zombies.
export async function liveGroupMembers(pgid) {
  const members=[];
  for(const entry of await readdir('/proc')) {
    if(!/^\d+$/.test(entry))continue;
    try {
      const stat=await readFile(`/proc/${entry}/stat`,'utf8');
      const fields=stat.slice(stat.lastIndexOf(')')+2).split(' ');
      if(Number(fields[2])===pgid&&fields[0]!=='Z')members.push(Number(entry));
    } catch(e) {if(!['ENOENT','ESRCH'].includes(e.code))throw e;}
  }
  return members;
}

export async function runCampaignChild({store,campaignId,attemptId,processId,...options}) {
  await store.startProcess(campaignId,attemptId,processId);
  let pid;
  let result;
  try {
    result=await runChild({...options,onSpawn:async childPid=>{pid=childPid;await store.recordPid(campaignId,processId,pid);}});
  } catch(e) {result={code:null,error:e.message,timedOut:false,overflow:false};}
  let members=pid?await liveGroupMembers(pid):[];
  const deadline=Date.now()+1500;
  while(members.length&&Date.now()<deadline) {await delay(10);members=await liveGroupMembers(pid);}
  await store.finishProcess(campaignId,processId,result,members.length===0);
  return result;
}
