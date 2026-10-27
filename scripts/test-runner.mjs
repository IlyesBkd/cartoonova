import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {openSync, writeSync, closeSync} from 'node:fs';

export function runChild({args, cwd, log, env, timeoutMs=180000, maxBytes=8*1024*1024, onSpawn}) {
  return new Promise(resolve => {
    const fd = openSync(log, 'w', 0o600);
    // env -i is intentional: not even NODE_OPTIONS or npm's environment survives.
    const child = spawn('/usr/bin/env', ['-i', ...Object.entries(env).map(([k,v])=>`${k}=${v}`), process.execPath, ...args],
      {cwd, env:{}, detached:true, stdio:['ignore','pipe','pipe']});
    let bytes=0, timedOut=false, overflow=false, error=null, killTimer;
    const kill = signal => {try {process.kill(-child.pid,signal);} catch { /* already exited */ }};
    const stop = () => {kill('SIGTERM');killTimer ??= setTimeout(()=>kill('SIGKILL'),1000);};
    const timer = setTimeout(()=>{timedOut=true;stop();},timeoutMs);
    const onSignal = ()=>{error='interrupted';stop();};
    const registration = Promise.resolve().then(() => onSpawn?.(child.pid)).catch(e => {error=`registration: ${e.message}`;stop();});
    process.once('SIGTERM',onSignal);process.once('SIGINT',onSignal);
    const capture = chunk => {
      const remaining = Math.max(0,maxBytes-bytes);
      if(remaining) writeSync(fd,chunk.subarray(0,remaining));
      bytes+=chunk.length;
      if(bytes>maxBytes){overflow=true;stop();}
    };
    child.stdout.on('data',capture);child.stderr.on('data',capture);
    child.on('error',e=>{error=e.message;});
    child.on('close',(code,signal)=>{
      clearTimeout(timer);clearTimeout(killTimer);
      // Reap descendants (e.g. a hung browser) even after a successful parent exit.
      kill('SIGKILL');
      process.removeListener('SIGTERM',onSignal);process.removeListener('SIGINT',onSignal);
      closeSync(fd);registration.then(() => resolve({code,signal,timedOut,overflow,error,bytes:Math.min(bytes,maxBytes)}));
    });
  });
}

export function summarizeTap(text) {
  const counts = {};
  for (const key of ['tests','suites','pass','fail','cancelled','skipped','todo']) {
    const matches = [...text.matchAll(new RegExp(`^# ${key} (\\d+)$`, 'gm'))];
    if (matches.length !== 1) return {ok:false, reason:`missing/duplicate TAP ${key}`};
    counts[key] = Number(matches[0][1]);
  }
  return {...counts, ok: counts.tests > 0 && counts.pass === counts.tests &&
    ['fail','cancelled','skipped','todo'].every(key=>counts[key]===0)};
}

export function partition(files) {
  assert.equal(new Set(files).size, files.length, 'duplicate test file');
  return [false, true].flatMap(browser => [false, true].map(tsx => ({
    browser, tsx,
    files: files.filter(file => file.includes('browser') === browser && file.startsWith('privacy') === tsx).sort(),
  }))).filter(group => group.files.length);
}
