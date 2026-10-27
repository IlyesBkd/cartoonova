// Reproduce OPS-04 locally; writes evidence only, never sends a message.
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {runChild, summarizeTap} from './test-runner.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const scratch=await mkdtemp(join(tmpdir(),'ops-report-'));
try {
  const observations=join(scratch,'observations.json');
  const runnerObservations=join(scratch,'runner-observations.json');
  const log=join(scratch,'operations.tap');
  const result=await runChild({args:['--test','tests/operations-campaign.test.mjs','tests/test-runner.test.mjs'],cwd:repo,log,
    env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:tmpdir(),OPS_REPORT_PATH:observations,OPS_RUNNER_REPORT_PATH:runnerObservations,PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH??join(process.env.HOME,'.cache/ms-playwright')},timeoutMs:30000});
  const lintLog=join(scratch,'lint.log');
  const lint=await runChild({args:['node_modules/eslint/bin/eslint.js','scripts/operations-campaign.mjs','scripts/operations-report.mjs','scripts/test-runner.mjs','scripts/test.mjs','tests/operations-campaign.test.mjs','tests/test-runner.test.mjs'],cwd:repo,log:lintLog,env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:tmpdir()},timeoutMs:30000});
  const tap=await readFile(log,'utf8');
  const counts=summarizeTap(tap);
  const sources={};
  for(const path of ['scripts/operations-campaign.mjs','scripts/operations-report.mjs','scripts/test-runner.mjs','scripts/test.mjs','tests/operations-campaign.test.mjs','tests/test-runner.test.mjs']) {
    sources[path]=createHash('sha256').update(await readFile(join(repo,path))).digest('hex');
  }
  let scenarios=[];
  try {scenarios=JSON.parse(await readFile(observations,'utf8'));} catch(e) {if(e.code!=='ENOENT')throw e;}
  try {scenarios.push(...JSON.parse(await readFile(runnerObservations,'utf8')));} catch(e) {if(e.code!=='ENOENT')throw e;}
  const passed=result.code===0&&!result.error&&!result.timedOut&&!result.overflow&&counts.ok&&lint.code===0&&!lint.error&&!lint.timedOut;
  const report={ticket:'OPS-04',scope:'npm test real orchestrator campaign integration, no Hermes gateway modification',generatedAt:new Date().toISOString(),passed,runner:result,counts,sources,scenarios,tap,lint:{...lint,output:await readFile(lintLog,'utf8')},
    reviewResolution:{
      'OPS-REVIEW-01':{status:'fixed',contract:'beginAttempt exclusively reserves the task before startProcess; no second reservation until the previous attempt completes.',scenarios:['exclusive-pre-start-reservation']},
      'OPS-REVIEW-02':{status:'fixed',contract:'Retries require a result, stopped true, and completed assessment when required.',scenarios:['retry-refused-unverified-stop','retry-assessment-gate']},
      'OPS-REVIEW-A1':{status:'fixed',contract:'Persisted assessmentRequired:true blocks concurrent finalize until every process is assessed; the real CLI enables it.',scenarios:['final-assessment-gate-tap','final-assessment-gate-cleanup','real-cli-exit-0-0','real-cli-cleanup-blocked']}
    },
    externalEffects:{telegramMessages:0,gatewayChanges:false,cronChanges:false,push:false,trelloWrites:false},
    limitations:['At-most-once local final claim is not remote exactly-once delivery. A consumer crash after claim requires manual reconciliation.','A crashed lock owner fails closed; inspect and manually recover the campaign-local lock.','Service verification covers Linux owned process groups, not processes deliberately escaping with setsid.','Atomic local state survives process restart; no claim of power-loss fsync durability.','A reservation whose owner crashes before startProcess remains fail-closed and requires manual inspection.','Raw-command campaigns default to assessmentRequired:false; suite consumers must explicitly enable the persisted contract.','OPS-REVIEW-A2 concerns the gift guide browser test and is outside this OPS-only change scope.']};
  const output=resolve(process.argv[2]??join(repo,'tests/priority-ten-operations-report.json'));
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  process.stdout.write(JSON.stringify({output,passed,counts})+'\n');
  if(!passed)process.exitCode=1;
} finally {await rm(scratch,{recursive:true,force:true});}
