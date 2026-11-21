import {spawn} from 'node:child_process';
const python='/home/hermes/.hermes/installs/019d0d114d22b7e6/environments/e8f66b1042a24ad5a6ebbb351208c462/venv/bin/python3';
const script='/home/hermes/.hermes/profiles/cartoonova/scripts/support_supplier_context.py';
const unavailable=()=>({status:'unavailable',evidence:[],limitations:['Emails fournisseur indisponibles ou délai dépassé ; suivi transporteur non vérifié.']});
export function supplierEvidence(order,{signal,command=python,args=[script],timeoutMs=12000}={}) {
  if(!order?.fournisseur_ref)return Promise.resolve({status:'not_applicable',evidence:[],limitations:['Référence fournisseur absente.']});
  return new Promise(resolve=>{
    let child, timer, bytes=0, chunks=[],failed=false;
    const killGroup=()=>{if(child?.pid){try{process.kill(-child.pid,'SIGKILL')}catch{}}};
    const kill=()=>{failed=true;killGroup();};
    try{child=spawn(command,args,{detached:true,env:{PATH:'/usr/bin:/bin',HOME:'/home/hermes',HERMES_HOME:'/home/hermes/.hermes/profiles/cartoonova',PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1'},stdio:['pipe','pipe','ignore']});}
    catch{return resolve(unavailable());}
    timer=setTimeout(kill,timeoutMs);
    if(signal?.aborted)kill();else signal?.addEventListener('abort',kill,{once:true});
    child.on('error',()=>{failed=true;});child.stdin.on('error',kill);
    child.stdout.on('data',c=>{bytes+=c.length;if(bytes>12000)kill();else chunks.push(c);});
    child.on('close',code=>{
      clearTimeout(timer);signal?.removeEventListener('abort',kill);killGroup();
      try{if(failed||code!==0)throw Error();const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(!['available','unavailable','not_applicable'].includes(data.status)||!Array.isArray(data.evidence)||data.evidence.length>3||!Array.isArray(data.limitations)||data.limitations.length>15)throw Error();
        const evidence=data.evidence.map(e=>{
          if(e.source!=='supplier_email'||typeof e.receivedAt!=='string'||!Number.isFinite(Date.parse(e.receivedAt))||!['unknown','production','shipped','delivered','incident'].includes(e.declaredStatus)||typeof e.shippingOrDeliveryNegated!=='boolean'||e.verifiedWithCarrier!==false||(e.carrier!==null&&(typeof e.carrier!=='string'||e.carrier.length>40)))throw Error();
          return {source:'supplier_email',receivedAt:new Date(e.receivedAt).toISOString(),declaredStatus:e.declaredStatus,shippingOrDeliveryNegated:e.shippingOrDeliveryNegated,carrier:e.carrier,verifiedWithCarrier:false};
        });
        if(data.limitations.some(x=>typeof x!=='string'||x.length>250))throw Error();
        resolve({status:data.status,evidence,limitations:data.limitations});
      }catch{resolve(unavailable());}
    });
    child.stdin.end(JSON.stringify({id:order.id,fournisseur_ref:order.fournisseur_ref,suivi_url:order.suivi_url,suivi_transporteur:order.suivi_transporteur}));
  });
}
