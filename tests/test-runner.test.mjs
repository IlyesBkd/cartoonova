import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync, readFileSync, rmSync, mkdirSync, copyFileSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('child runner clears secrets and Node injection, bounds logs, timeouts and exit failures', async () => {
  const {runChild} = await import('../scripts/test-runner.mjs');
  const dir = mkdtempSync(path.join(tmpdir(),'runner-'));
  const secret = process.env.RUNNER_SYNTHETIC_SECRET;
  process.env.RUNNER_SYNTHETIC_SECRET='must-not-be-inherited';
  try {
    const run = (source, options={})=>runChild({args:['-e',source], cwd:process.cwd(), log:path.join(dir,'child.log'), env:{PATH:'/usr/bin:/bin',HOME:dir,TMPDIR:dir}, timeoutMs:3000, maxBytes:4096,...options});
    assert.equal((await run('if(process.env.RUNNER_SYNTHETIC_SECRET || process.env.NODE_OPTIONS) process.exit(1)')).code,0);
    assert.equal((await run('process.exit(7)')).code,7);
    assert.equal((await run('setInterval(()=>{},100)',{timeoutMs:100})).timedOut,true);
    assert.equal((await run('process.stdout.write("x".repeat(100000))')).overflow,true);
    assert.ok(Buffer.byteLength(readFileSync(path.join(dir,'child.log')))<=4096);
  } finally {
    if(secret===undefined)delete process.env.RUNNER_SYNTHETIC_SECRET;else process.env.RUNNER_SYNTHETIC_SECRET=secret;
    rmSync(dir,{recursive:true,force:true});
  }
});

test('network guard blocks external Node sockets and fetch before transport', async () => {
  const {runChild} = await import('../scripts/test-runner.mjs');
  const dir=mkdtempSync(path.join(tmpdir(),'runner-'));
  try {
    const result=await runChild({cwd:process.cwd(),log:path.join(dir,'guard.log'),env:{PATH:'/usr/bin:/bin',HOME:dir,TMPDIR:dir},args:['--import','./scripts/test-network.mjs','--input-type=module','-e',`
      import net from 'node:net';
      import assert from 'node:assert/strict';
      assert.throws(()=>net.connect(443,'api.resend.com'),/TEST_NETWORK_BLOCKED/);
      await assert.rejects(fetch('https://api.resend.com'),/fetch failed|TEST_NETWORK_BLOCKED/);
    `]});
    assert.equal(result.code,0,readFileSync(path.join(dir,'guard.log'),'utf8'));
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('browser guard preserves route mocks and refuses unmatched provider traffic', async () => {
  const {runChild} = await import('../scripts/test-runner.mjs');
  const dir=mkdtempSync(path.join(tmpdir(),'runner-'));
  try {
    const result=await runChild({cwd:process.cwd(),log:path.join(dir,'browser.log'),timeoutMs:15000,
      env:{PATH:'/usr/bin:/bin',HOME:dir,TMPDIR:dir,PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.HOME,'.cache/ms-playwright')},
      args:['--import','./scripts/test-network.mjs','--input-type=module','-e',`
        import {chromium} from 'playwright';import assert from 'node:assert/strict';
        const browser=await chromium.launch({headless:true});
        try {const page=await browser.newPage();
          await page.route('https://synthetic.invalid/**',r=>r.fulfill({body:'mock works'}));
          await page.goto('https://synthetic.invalid/');assert.match(await page.content(),/mock works/);
          await assert.rejects(page.goto('https://api.resend.com',{timeout:3000}),/ERR_PROXY_CONNECTION_FAILED|ERR_TUNNEL_CONNECTION_FAILED/);
        } finally {await browser.close();}
      `]});
    assert.equal(result.code,0,readFileSync(path.join(dir,'browser.log'),'utf8'));
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('real CLI aggregates a dynamic manifest and exits nonzero for skipped and failed tests', async () => {
  const {runChild}=await import('../scripts/test-runner.mjs');
  const dir=mkdtempSync(path.join(tmpdir(),'runner-cli-'));
  try {
    mkdirSync(path.join(dir,'scripts'));mkdirSync(path.join(dir,'tests'));
    for(const file of ['test.mjs','test-runner.mjs','test-network.mjs','operations-campaign.mjs'])copyFileSync(path.join(process.cwd(),'scripts',file),path.join(dir,'scripts',file));
    symlinkSync(path.join(process.cwd(),'node_modules'),path.join(dir,'node_modules'));
    const file=path.join(dir,'tests','synthetic.test.mjs');
    const campaigns=new Set();const evidence=[];
    const postgresBody=`test('leaves a real disposable PostgreSQL daemon',async()=>{
      const {mkdirSync}=await import('node:fs');const {spawnSync}=await import('node:child_process');
      const {join}=await import('node:path');
      const fixture=join(process.env.TMPDIR,'orphan-pg');mkdirSync(fixture);
      const data=join(fixture,'pg');
      for(const [binary,args] of [['initdb',['-D',data,'-A','trust','--no-locale']],['pg_ctl',['-D',data,'-l',join(fixture,'pg.log'),'-o','-h "" -k '+fixture,'-w','start']]]){
        const result=spawnSync(join(process.env.TEST_PG_BIN,binary),args,{encoding:'utf8',timeout:10000});
        if(result.status!==0)throw new Error(result.stderr||result.error?.message);
      }
    })`;
    const stalePidBody=`test('leaves an unverifiable stale PID fixture',async()=>{
      const {mkdirSync,writeFileSync}=await import('node:fs');const {join}=await import('node:path');
      const data=join(process.env.TMPDIR,'stale','pg');mkdirSync(data,{recursive:true});
      writeFileSync(join(data,'PG_VERSION'),'18');writeFileSync(join(data,'postmaster.pid'),String(process.pid)+'\\n');
    })`;
    for(const [body,expected] of [["test('works',()=>{})",0],["test.skip('skipped',()=>{})",1],["test('fails',()=>{throw new Error('expected fixture failure')})",1],[postgresBody,0],[stalePidBody,1]]) {
      writeFileSync(file,"import {test} from 'node:test';"+body);
      const log=path.join(dir,'cli.log');
      const execution=await runChild({cwd:dir,args:['scripts/test.mjs'],log,timeoutMs:15000,
        env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME,TMPDIR:tmpdir(),PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.HOME,'.cache/ms-playwright')}});
      assert.equal(execution.code,expected,readFileSync(log,'utf8'));
      const output=readFileSync(log,'utf8');const artifacts=output.match(/Test artifacts: (.+)/)[1];
      const summary=JSON.parse(readFileSync(path.join(artifacts,'summary.json')));
      assert.equal(summary.complete,true);assert.equal(summary.executedFiles,1);assert.equal(summary.ok,expected===0);
      assert.ok(summary.campaignId);assert.equal(campaigns.has(summary.campaignId),false);campaigns.add(summary.campaignId);
      const manifest=JSON.parse(readFileSync(path.join(artifacts,'manifest.json')));
      assert.equal(manifest.campaignId,summary.campaignId);
      const {CampaignStore}=await import('../scripts/operations-campaign.mjs');
      const store=new CampaignStore(path.join(artifacts,'campaign'));
      const state=await store.snapshot(summary.campaignId);
      assert.equal(state.assessmentRequired,true);
      assert.equal(state.processes[0].assessed,true);
      assert.equal(state.attempts.length,1);assert.equal(state.processes.length,1);
      const blocked=body===stalePidBody;
      const localFinal=JSON.parse(readFileSync(path.join(artifacts,'campaign-final.json')));
      if(blocked){
        assert.equal(state.final,null);assert.equal(state.claimed,false);
        assert.equal(localFinal.status,'blocked');assert.equal(localFinal.servicesStopped,false);
        await assert.rejects(store.claimFinal(summary.campaignId),/not finalized/);
      } else {
        assert.equal(state.final.status,expected===0?'passed':'failed');
        assert.equal(state.claimed,true);assert.equal(await store.claimFinal(summary.campaignId),null);
        assert.deepEqual(localFinal,state.final);
      }
      assert.equal(state.events.length,1);assert.equal(state.events[0].reason,'completed-process');
      assert.equal(state.processes[0].stopped,!blocked);
      if(body===postgresBody){
        const [cleanup]=state.processes[0].cleanup;
        assert.equal(cleanup.stop.code,0);assert.equal(cleanup.verification.code,3);assert.equal(cleanup.stopped,true);
        const {existsSync}=await import('node:fs');assert.equal(existsSync(cleanup.fixture),false);
      } else if(blocked){
        const [cleanup]=state.processes[0].cleanup;
        assert.notEqual(cleanup.stop.code,0);assert.equal(cleanup.stopped,false);
        assert.equal(summary.results[0].cleanupFailed,true);assert.equal(summary.results[0].tap.ok,true);
        // This fixture never started PostgreSQL; only the exited test PID was recorded.
        rmSync(path.dirname(cleanup.fixture),{recursive:true,force:true});
      } else assert.deepEqual(state.processes[0].cleanup,[]);
      assert.equal(state.processes[0].suite.file,'synthetic.test.mjs');
      evidence.push({scenario:blocked?'real-cli-cleanup-blocked':body===postgresBody?'real-cli-postgresql-cleanup':`real-cli-exit-${expected}-${summary.totals.skipped}`,execution,summary,manifest,state,localFinal});
      rmSync(artifacts,{recursive:true,force:true});
    }
    if(process.env.OPS_RUNNER_REPORT_PATH)writeFileSync(process.env.OPS_RUNNER_REPORT_PATH,JSON.stringify(evidence,null,2));
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('TAP accounting rejects failure, skip, todo, cancellation, missing or inconsistent totals', async () => {
  const {summarizeTap} = await import('../scripts/test-runner.mjs');
  const tap = '# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  assert.equal(summarizeTap(tap).ok, true);
  for (const kind of ['fail','cancelled','skipped','todo']) {
    assert.equal(summarizeTap(tap.replace('# pass 2','# pass 1').replace(`# ${kind} 0`, `# ${kind} 1`)).ok, false);
  }
  assert.equal(summarizeTap('').ok, false);
  assert.equal(summarizeTap(tap.replace('# tests 2','# tests 3')).ok, false);
  assert.equal(summarizeTap(tap.replace('# tests 2','# tests 0').replace('# pass 2','# pass 0')).ok, false);
});

// Import only inside tests so the RED phase reports a missing runner clearly.
test('inventory partitions every file exactly once and gives tsx only to privacy', async () => {
  const {partition} = await import('../scripts/test-runner.mjs');
  const files = ['delivery-promise.test.mjs','privacy.test.mjs','privacy-browser.test.mjs','new-business.test.mjs','navbar-browser.test.mjs'];
  const groups = partition(files);
  assert.deepEqual(groups.flatMap(g=>g.files).sort(), [...files].sort());
  assert.equal(new Set(groups.flatMap(g=>g.files)).size, files.length);
  for (const group of groups) for (const file of group.files) {
    assert.equal(group.tsx, file.startsWith('privacy'));
    assert.equal(group.browser, file.includes('browser'));
  }
  assert.throws(()=>partition(['a.test.mjs','a.test.mjs']), /duplicate/i);
});
