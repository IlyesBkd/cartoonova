#!/usr/bin/env node
/** Scans tracked/staged blobs, never prints matching secret values. */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const staged=process.argv.includes('--staged');
const files=execFileSync('git',staged?['diff','--cached','--name-only','--diff-filter=ACMR','-z']:['ls-files','-z']).toString().split('\0').filter(Boolean);
const forbidden=/^(?:cache\/|artifacts\/|\.next(?:-|\/)|\.secrets\/)|(?:^|\/)(?:\.env(?!\.example$)|[^/]*(?:service-account|credentials)[^/]*\.json$)/i;
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\b(?:sk|rk)_live_[A-Za-z0-9]{16,}/,/\bgh[pousr]_[A-Za-z0-9]{30,}/,/\bAKIA[0-9A-Z]{16}\b/,/"private_key"\s*:\s*"-----BEGIN/];
const failures=[];
for(const file of files){
 // Legacy tracked evidence is still signature-scanned; adding/changing evidence is blocked at staging.
 if(forbidden.test(file)||(staged&&/^tests\/[^/]*-evidence\//.test(file))){failures.push({file,reason:'forbidden artifact path'});continue;}
 let data;try{data=staged?execFileSync('git',['show',`:${file}`],{maxBuffer:32*1024*1024,stdio:['ignore','pipe','ignore']}).toString():readFileSync(file,'utf8');}catch{failures.push({file,reason:'unreadable blob'});continue;}
 if(patterns.some(p=>p.test(data)))failures.push({file,reason:'secret signature'});
}
console.log(JSON.stringify({mode:staged?'staged':'tracked',filesScanned:files.length,failures},null,2));
if(failures.length)process.exitCode=1;
