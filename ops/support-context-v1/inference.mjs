import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const python='/home/hermes/.hermes/installs/019d0d114d22b7e6/environments/e8f66b1042a24ad5a6ebbb351208c462/venv/bin/python3';
const script=fileURLToPath(new URL('./hermes_inference.py',import.meta.url));
export function runInference(input,{command=python,args=[script],timeoutMs=45000,signal}={}) {
  return new Promise((resolve,reject)=>{
    let data; try { data=JSON.stringify(input); if(Buffer.byteLength(data)>1048576) throw Error(); } catch {reject(Error('Inference input invalid'));return;}
    let p; try {p=spawn(command,args,{env:{PATH:'/usr/bin:/bin',HOME:'/home/hermes',HERMES_HOME:'/home/hermes/.hermes/profiles/cartoonova',PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1'},stdio:['pipe','pipe','ignore']});} catch {reject(Error('Inference unavailable'));return;}
    let chunks=[],size=0,failed=false,done=false;
    const fail=()=>{failed=true;try{p.kill('SIGKILL')}catch{}};
    const timer=setTimeout(fail,timeoutMs);
    if(signal?.aborted) fail(); else signal?.addEventListener('abort',fail,{once:true});
    p.stdout.on('data',c=>{size+=c.length;if(size>1048576) fail();else chunks.push(c)});
    p.stdin.on('error',fail);p.on('error',fail);
    p.on('close',code=>{if(done)return;done=true;clearTimeout(timer);const text=Buffer.concat(chunks).toString('utf8').trim();if(failed||code!==0||!text)reject(Error('Inference unavailable'));else resolve(text)});
    p.stdin.end(data);
  });
}
