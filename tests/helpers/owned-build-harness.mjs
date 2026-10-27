import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, realpathSync, lstatSync, readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
export const pgCtl = '/usr/lib/postgresql/18/bin/pg_ctl';
export const minimalBuildEnv = () => Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
export async function runOwnedBuild({root,timeoutMs=60000,graceMs=3000,hold=false,onReady}={}) {
 const env=minimalBuildEnv();
 const runtime=mkdtempSync(path.join(realpathSync(env.TMPDIR),'ten-build-'));
 const token=randomUUID();writeFileSync(path.join(runtime,'.build-owner'),token,{mode:0o600});
 const child=spawn('python3',['scripts/verify-ten-cards-local.py','--fixture-only','--runtime-dir',runtime,'--owner-token',token,...(hold?['--fixture-hold']:[])],{cwd:root,env,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='',timedOut=false,escalation;
 const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');escalation=setTimeout(()=>child.kill('SIGKILL'),graceMs);},timeoutMs);
 child.stdout.on('data',b=>{stdout+=b;if(onReady && stdout.includes('"fixtureReady": true')){const callback=onReady;onReady=null;callback(child,runtime);}});
 child.stderr.on('data',b=>stderr+=b);
 let result,cleanup;
 try {
  result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(status,signal)=>resolve({status,signal}));});
 } finally {
  clearTimeout(timer);clearTimeout(escalation);
  cleanup=stopOwnedDatabase(runtime,token,env);
 }
 return {...result,stdout,stderr,timedOut,runtime,cleanup};
}

export function stopOwnedDatabase(runtime,token,env=minimalBuildEnv()) {
 const info=lstatSync(runtime);
 const marker=path.join(runtime,'.build-owner');
 if(!info.isDirectory() || info.isSymbolicLink() || info.uid!==process.getuid() || (info.mode&0o777)!==0o700 ||
    path.dirname(runtime)!==realpathSync(env.TMPDIR) || !path.basename(runtime).startsWith('ten-build-') ||
    lstatSync(marker).isSymbolicLink() || readFileSync(marker,'utf8')!==token)throw new Error('Refusing unowned runtime cleanup');
 const database=path.join(runtime,'pg');
 if(!existsSync(database))return {stopped:true,initialized:false,parentStoppedDatabase:false};
 if(lstatSync(database).isSymbolicLink() || realpathSync(database)!==database)throw new Error('Refusing redirected database cleanup');
 if(!existsSync(path.join(database,'PG_VERSION')))return {stopped:true,initialized:false,parentStoppedDatabase:false};
 const status=()=>spawnSync(pgCtl,['-D',database,'status'],{env,encoding:'utf8',timeout:10000});
 let before=status();
 let parentStoppedDatabase=false;
 if(before.status===0 || existsSync(path.join(database,'postmaster.pid'))) {
  const pidFile=path.join(database,'postmaster.pid');
  if(lstatSync(pidFile).isSymbolicLink() || readFileSync(pidFile,'utf8').split('\n')[1]!==database)throw new Error('Refusing foreign postmaster cleanup');
  const stop=spawnSync(pgCtl,['-D',database,'-m','fast','-w','-t','10','stop'],{env,encoding:'utf8',timeout:12000});
  if(stop.status!==0)throw new Error('Owned database stop failed: '+stop.stdout+stop.stderr);
  parentStoppedDatabase=true;
 }
 const after=status();
 if(after.status!==3 || existsSync(path.join(database,'postmaster.pid')))throw new Error('Owned database stop not verified: '+after.stdout+after.stderr);
 return {stopped:true,initialized:true,parentStoppedDatabase,statusAfter:after.status};
}
