"use client";
import { useState } from "react";
import type { DbOrder } from "@/lib/db";

export default function ShippingGroupPanel({order,orders,request,onSaved}:{order:DbOrder;orders:DbOrder[];request:(url:string,init:RequestInit)=>Promise<Response>;onSaved:()=>void}) {
  const details=order.shipping_details;
  const members=details?.orderIds || orders.filter(o=>o.fournisseur_ref===order.fournisseur_ref).map(o=>o.id).sort();
  const [numbers,setNumbers]=useState(details?.tracking.map(t=>t.number).join('\n') || '');
  const [carrier,setCarrier]=useState(details?.tracking[0]?.carrier || order.suivi_transporteur || '');
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const sent=!!order.expedition_email_envoye_le;
  async function save(method:'PATCH'|'POST') {
    setBusy(true);setMessage('');
    try {
      const r=await request('/api/orders/expedition',{method,headers:{'content-type':'application/json'},body:JSON.stringify({shippingGroup:{supplierRef:order.fournisseur_ref,orderIds:members,tracking:numbers.split(/\r?\n/).filter(Boolean).map(number=>({number,carrier}))}})});
      const result=await r.json();
      if(!r.ok)throw Error(result.error || 'Opération refusée.');
      setMessage(result.duplicate?'Déjà envoyé, aucun nouvel e-mail.':method==='POST'?'Client prévenu pour tout le groupe.':'Tous les suivis sont enregistrés, aucun e-mail envoyé.');onSaved();
    }catch(e){setMessage(e instanceof Error?e.message:'Erreur réseau, vérifier avant de réessayer.');}finally{setBusy(false);}
  }
  return <section className="border border-indigo-200 rounded-lg p-3 space-y-3 bg-white" aria-label="Expédition multi-suivis">
    <h3 className="text-sm font-bold">Expédition multi-suivis</h3>
    <p className="text-xs">Commandes liées : {members.map(id=>id.slice(0,8)).join(' · ')}</p>
    <p className="text-xs text-gray-600">Tous les colis concernent ce groupe. Leur contenu n’est pas attribué à un portrait.</p>
    <label className="block text-xs">Numéros de suivi (un par ligne)<textarea className="block w-full border rounded p-2 mt-1" rows={3} value={numbers} disabled={sent||busy} onChange={e=>setNumbers(e.target.value)}/></label>
    <label className="block text-xs">Transporteur<input className="block w-full border rounded p-2 mt-1" value={carrier} disabled={sent||busy} onChange={e=>setCarrier(e.target.value)}/></label>
    {details?.tracking.map(t=><a key={t.number} href={t.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-700 underline">{t.carrier} · {t.number}</a>)}
    {sent?<p className="text-xs text-green-700">Client prévenu pour l’ensemble du groupe. Aucun renvoi automatique.</p>:<div className="flex gap-2"><button className="border rounded px-2 py-2 text-xs" disabled={busy||!numbers} onClick={()=>save('PATCH')}>Enregistrer tous les suivis</button><button className="bg-indigo-600 text-white rounded px-2 py-2 text-xs" disabled={busy||!numbers} onClick={()=>save('POST')}>Prévenir une fois pour le groupe</button></div>}
    {message&&<p role="status" className="text-xs">{message}</p>}
  </section>;
}
