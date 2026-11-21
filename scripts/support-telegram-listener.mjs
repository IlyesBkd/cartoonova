#!/usr/bin/env node
// PostgreSQL notifications are hints, not the queue. Cron remains the fallback.
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const CHANNEL='cartoonova_support_incoming';
const ROOT='/home/hermes/projects/cartoonova';
const PROFILE='/home/hermes/.hermes/profiles/cartoonova';
const WRAPPERS={chat:ROOT+'/scripts/chat-telegram-cron.py',email:PROFILE+'/scripts/support-email-notify.py'};

// Independent receive/enrich lanes keep a slow inference from delaying originals.
export function createDispatcher({receive,enrich,onError=()=>{}}) {
  const lanes=new Map();let closed=false;
  for(const kind of ['chat','email']) for(const phase of ['receive','enrich']) lanes.set(kind+':'+phase,{dirty:false,running:null});
  function queue(kind,phase) {
    if(closed)return;
    const lane=lanes.get(kind+':'+phase);lane.dirty=true;
    if(lane.running)return;
    lane.running=(async()=>{
      while(lane.dirty&&!closed) {
        lane.dirty=false;
        try {await (phase==='receive'?receive:enrich)(kind);}catch {onError(kind,phase);}
        if(phase==='receive'&&!closed)queue(kind,'enrich');
      }
    })().finally(()=>{lane.running=null;});
  }
  return {
    notify(kind){if(Object.hasOwn(WRAPPERS,kind))queue(kind,'receive');},
    reconnect(){for(const kind of ['chat','email'])queue(kind,'receive');},
    async idle(){while([...lanes.values()].some(l=>l.running))await Promise.all([...lanes.values()].flatMap(l=>l.running?[l.running]:[]));},
    async close(){closed=true;await this.idle();}
  };
}

export function runWrapper(kind,{receiveOnly=false,env=process.env,spawnImpl=spawn}={}) {
  if(!Object.hasOwn(WRAPPERS,kind))throw Error('Invalid support channel');
  return new Promise((resolve,reject)=>{
    const childEnv={...env};
    if(receiveOnly)childEnv.TELEGRAM_RECEIVE_ONLY='1';else delete childEnv.TELEGRAM_RECEIVE_ONLY;
    const child=spawnImpl('/usr/bin/python3',[WRAPPERS[kind]],{cwd:ROOT,env:childEnv,stdio:'ignore'});
    let finished=false;
    const timer=setTimeout(()=>{child.kill('SIGTERM');finish(Error('Support relay timeout'));},165000);
    function finish(error){if(finished)return;finished=true;clearTimeout(timer);if(error)reject(error);else resolve();}
    child.once('error',()=>finish(Error('Support relay launch failed')));
    child.once('exit',code=>finish(code===0?null:Error('Support relay failed')));
  });
}

async function main() {
  if(process.argv.length!==2)throw Error('Unexpected arguments');
  const database=process.env.CHAT_NOTIFY_DATABASE_URL||process.env.DATABASE_URL;
  if(!database)throw Error('Missing database configuration');
  const {default:postgres}=await import('postgres');
  const db=postgres(database,{max:1,onnotice(){},connection:{application_name:'cartoonova-telegram-listener'}});
  const dispatcher=createDispatcher({
    receive:kind=>runWrapper(kind,{receiveOnly:true}),
    enrich:kind=>runWrapper(kind),
    onError:(kind,phase)=>console.error('Support relay deferred to cron:',kind,phase)
  });
  let stopping=false;
  const stop=async()=>{
    if(stopping)return;stopping=true;
    await db.end({timeout:5});await dispatcher.close();
  };
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
  await db.listen(CHANNEL,payload=>dispatcher.notify(payload),()=>{
    console.log('Support listener connected; queues checked.');dispatcher.reconnect();
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{
  console.error('Support listener failed; cron fallback remains active.');process.exitCode=1;
});
