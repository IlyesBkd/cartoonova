"""Bounded read-only agent tools. No business mutations or model-authored SQL."""
import csv
import datetime
import io
import json
import os
import pathlib
import re
import subprocess
import sys
import time
from verification import payload_for,SENT_PORTRAIT,timestamp

SOURCE=pathlib.Path(__file__).resolve().parent
HOME=pathlib.Path('/home/hermes/.hermes/profiles/cartoonova')
UUID=re.compile(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\Z')
MAX_ROUNDS=2
MAX_REQUESTS=8
DEADLINE=150

def query_for(order_id):
    if not isinstance(order_id,str) or not UUID.fullmatch(order_id):raise ValueError('invalid_order_link')
    # Exact UUID links only. Unassigned mail is usable only for one exact-email order.
    return f"""WITH o AS (SELECT *, (SELECT count(*) FROM orders x WHERE lower(btrim(x.customer_email))=lower(btrim(orders.customer_email))) AS own_count FROM orders WHERE id='{order_id}'::uuid),
    incoming AS (SELECT json_build_object('at',m.received_at,'kind','email.incoming','status','recorded','subject',m.subject,'body',m.body_text,'orderIds',CASE WHEN m.order_id IS NULL THEN '[]'::json ELSE json_build_array(m.order_id) END,'exactEmail',m.order_id IS NULL AND o.own_count=1) AS e FROM support_messages m,o WHERE m.order_id=o.id OR (m.order_id IS NULL AND lower(btrim(m.from_email))=lower(btrim(o.customer_email))) ORDER BY m.received_at DESC LIMIT 25),
    outgoing AS (SELECT json_build_object('at',r.sent_at,'kind','email.outgoing','status','sent','subject',r.subject,'body',r.body_text,'orderIds',CASE WHEN r.order_id IS NULL THEN '[]'::json ELSE json_build_array(r.order_id) END,'exactEmail',r.order_id IS NULL AND o.own_count=1) AS e FROM support_replies r,o WHERE r.order_id=o.id OR (r.order_id IS NULL AND lower(btrim(r.to_email))=lower(btrim(o.customer_email))) ORDER BY r.sent_at DESC LIMIT 25),
    deliveries AS (SELECT json_build_object('at',d.updated_at,'kind','delivery.'||d.kind,'status',d.status,'title','Livraison enregistrée','orderIds',json_build_array(d.order_id)) AS e FROM order_delivery_effects d,o WHERE d.order_id=o.id ORDER BY d.updated_at DESC LIMIT 25),
    retouch AS (SELECT json_build_object('at',r.demandee_le,'kind','retouch.request','status','recorded','body',r.note,'orderIds',json_build_array(r.order_id)) AS e FROM retouches r,o WHERE r.order_id=o.id ORDER BY r.demandee_le DESC LIMIT 25),
    prepared AS (SELECT json_build_object('at',coalesce(to_jsonb(p)->>'provider_sent_at',to_jsonb(p)->>'approved_at',to_jsonb(p)->>'created_at'),'kind','draft.prepared','status','recorded','subject',p.subject,'body',p.body_text,'orderIds',json_build_array(o.id)) AS e FROM support_prepared_replies p,o WHERE (p.target_type='order' AND p.target_id::text=o.id::text) OR to_jsonb(p)->>'frozen_order_id'=o.id::text ORDER BY to_jsonb(p)->>'created_at' DESC LIMIT 25)
    SELECT json_build_object('order',(SELECT json_build_object('id',id,'status',status,'statut_force',statut_force,'photo_urls',photo_urls,'poster_confirmation_sent_at',poster_confirmation_sent_at,'poster_confirmation_status',poster_confirmation_status,'final_image_sent_at',final_image_sent_at,'expedie_le',expedie_le,'fournisseur_ref',fournisseur_ref,'own_count',own_count) FROM o),'events',coalesce((SELECT json_agg(e) FROM (SELECT e FROM incoming UNION ALL SELECT e FROM outgoing UNION ALL SELECT e FROM deliveries UNION ALL SELECT e FROM retouch UNION ALL SELECT e FROM prepared) q),'[]'::json)) AS dossier"""

def local_drafts(home):
    path=home/'state/brouillons-en-attente.json'
    if path.exists() and path.stat().st_size>1048576:raise ValueError('draft_budget')
    drafts=json.loads(path.read_text()).get('brouillons',[]) if path.exists() else []
    if not isinstance(drafts,list) or len(drafts)>200:raise ValueError('draft_budget')
    return drafts

def source_env(home):
    env={k:os.environ[k] for k in ('PATH','HOME','TMPDIR','VIRTUAL_ENV') if k in os.environ}
    env['HERMES_HOME']=str(home)
    return env

def resolve_order_id(candidate,home=HOME,runner=subprocess.run,timeout=15):
    """Resolve identity only: never read a dossier or accept model coordinates."""
    oid=candidate.get('orderId')
    if oid is not None:
        if not isinstance(oid,str) or not UUID.fullmatch(oid):raise ValueError('invalid_order_link')
        return oid
    linked=[d for d in local_drafts(home) if d.get('id')==candidate.get('draftId') and d.get('statut')=='en_attente']
    address=linked[0].get('client') if len(linked)==1 else None
    if not isinstance(address,str) or not re.fullmatch(r"[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",address):raise ValueError('invalid_order_link')
    literal=address.replace("'","''")
    query=f"SELECT id::text FROM orders WHERE lower(btrim(customer_email))=lower('{literal}') LIMIT 2"
    found=runner([sys.executable,str(home/'scripts/db-tool.py'),'query',query],env=source_env(home),text=True,capture_output=True,timeout=timeout)
    if found.returncode or len(found.stdout)>1000:raise ValueError('source_unavailable')
    identities=list(csv.DictReader(io.StringIO(found.stdout)))
    if not identities:raise ValueError('missing_order_for_draft')
    if len(identities)!=1 or set(identities[0])!={'id'}:raise ValueError('ambiguous_order_for_draft')
    oid=identities[0]['id']
    if not isinstance(oid,str) or not UUID.fullmatch(oid):raise ValueError('invalid_order_link')
    return oid

def inspect_dossier(candidate,home=HOME,runner=subprocess.run,timeout=15,budget=20):
    # Identity must already be resolved before entering the dossier cache.
    oid=candidate.get('orderId')
    query=query_for(oid)
    started=time.monotonic()
    execute=runner
    def bounded_run(args,**kwargs):
        remaining=budget-(time.monotonic()-started)
        if remaining<=0:raise TimeoutError()
        kwargs['timeout']=min(kwargs.get('timeout',timeout),remaining)
        return execute(args,**kwargs)
    env=source_env(home)
    all_drafts=local_drafts(home)
    proc=bounded_run([sys.executable,str(home/'scripts/db-tool.py'),'query',query],env=env,text=True,capture_output=True,timeout=timeout)
    if proc.returncode or len(proc.stdout.encode())>262144:raise RuntimeError('source_unavailable')
    rows=list(csv.DictReader(io.StringIO(proc.stdout)))
    if len(rows)!=1 or set(rows[0])!={'dossier'}:raise ValueError('lookup_schema')
    raw=json.loads(rows[0]['dossier'])
    if not raw.get('order'):raise ValueError('order_unavailable')
    drafts=all_drafts
    drafts=[{k:d.get(k) for k in ('id','commande','objet','texte','langue','canal','cree_le')} for d in drafts if d.get('statut')=='en_attente' and d.get('commande')==oid]
    raw.update(id=oid,drafts=drafts,now=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds'),limited=any(sum(e['kind']==k for e in raw['events'])>=25 for k in {e['kind'] for e in raw['events']}))
    out=bounded_run(['/usr/bin/node',str(SOURCE/'lookup.mjs')],input=json.dumps(raw),text=True,capture_output=True,env=env,timeout=5)
    if out.returncode or len(out.stdout.encode())>60000:raise ValueError('projection_unavailable')
    projected=json.loads(out.stdout)
    projected['resolvedOrderId']=oid
    # Fingerprints are local exact-match helpers, never evidence sent to inference.
    for e in projected['context']['evidence']:e.pop('bodyFingerprint',None)
    return projected

def plan(payload):
    env={k:os.environ[k] for k in ('PATH','HOME','TMPDIR','VIRTUAL_ENV','HERMES_HOME','HERMES_PROFILE') if k in os.environ}
    env['HERMES_HOME']=str(HOME)
    p=subprocess.run([sys.executable,str(SOURCE/'hermes_inference.py'),'--plan'],input=json.dumps(payload),env=env,text=True,capture_output=True,timeout=45)
    if p.returncode:raise RuntimeError('agent_unavailable')
    return p.stdout

def validate_requests(raw,allowed):
    if not isinstance(raw,str) or len(raw.encode())>4000:raise ValueError('request_budget')
    def unique(pairs):
        d={}
        for k,v in pairs:
            if k in d:raise ValueError('duplicate_key')
            d[k]=v
        return d
    p=json.loads(raw,object_pairs_hook=unique)
    if not isinstance(p,dict) or set(p)!={'requests'} or not isinstance(p['requests'],list) or len(p['requests'])>MAX_REQUESTS:raise ValueError('request_schema')
    ids=[]
    for r in p['requests']:
        if not isinstance(r,dict) or set(r)!={'tool','candidateId'} or r['tool']!='inspect_dossier' or r['candidateId'] not in allowed or r['candidateId'] in ids:raise ValueError('forbidden_tool')
        ids.append(r['candidateId'])
    return ids

def enrich(candidates,inference=plan,lookup=inspect_dossier,clock=time.monotonic,resolver=resolve_order_id):
    result=[dict(c) for c in candidates]
    start=clock();seen=set();dossiers={}
    # Every visible item must carry a concrete coverage result, even on agent failure.
    for c in result:
        if not c.get('blocked'):c['lookupStatus']='not_requested'
    try:
        payload_for([c for c in result if not c.get('blocked')])
        for _ in range(MAX_ROUNDS):
            eligible={c['id']:c for c in result if not c.get('blocked') and c['id'] not in seen}
            if not eligible or clock()-start>DEADLINE-45:break
            payload=payload_for(list(eligible.values()))
            requests=validate_requests(inference(payload),eligible)
            if not requests:break
            for cid in requests:
                c=eligible[cid]
                if c['id'] in seen:continue
                seen.add(c['id'])
                matching=[c]
                try:
                    if clock()-start>DEADLINE-20:raise TimeoutError()
                    tool_start=time.monotonic()
                    # Resolve FIRST, then consult the per-enrichment UUID cache.
                    # Unlinked drafts can resolve repeatedly without rereading A.
                    resolved=resolve_order_id(c) if c.get('orderId') is not None else resolver(c)
                    if not isinstance(resolved,str) or not UUID.fullmatch(resolved):raise ValueError('invalid_order_link')
                    c['orderId']=resolved
                    matching=[x for x in result if not x.get('blocked') and x.get('orderId')==resolved and (x is c or x['id'] not in seen)]
                    seen.update(x['id'] for x in matching)
                    if resolved not in dossiers:
                        try:
                            remaining=20-(time.monotonic()-tool_start)
                            if remaining<=0:raise TimeoutError()
                            dossiers[resolved]=lookup(dict(c),budget=remaining) if lookup is inspect_dossier else lookup(dict(c))
                        except Exception as error:
                            dossiers[resolved]=error
                    projected=dossiers[resolved]
                    if isinstance(projected,Exception):raise projected
                    context=projected['context']
                    for x in matching:
                        # Preserve draft_text_limit from JS (UTF-16), independently
                        # of history text_limit; len(proposal) cannot recover it.
                        old=[l for l in x['limitations'] if l not in {'context_unavailable','history_unavailable','text_limit'}]
                        # Supplement, never discard proofs from the existing history
                        # aggregator (outbox, legacy deliveries, shipping, etc.).
                        fresh=[ev for ev in context['evidence'] if ev['kind']!='current_state']
                        for ev in x['evidence']:
                            if ev['kind']=='current_state':continue
                            covered=any(all(ev[k]==n[k] for k in ('kind','at','status')) and (ev['text']==n['text'] or ev['text'].endswith('…') and n['text'].startswith(ev['text'][:-1])) for n in fresh)
                            if not covered:
                                fresh.append(ev)
                                if ev['text'].endswith('…'):old.append('text_limit')
                        fresh.sort(key=lambda ev:timestamp(ev['at']),reverse=True)
                        if len(fresh)>24:old.append('event_limit')
                        x['evidence']=[dict(ev) for ev in context['evidence'] if ev['kind']=='current_state']+[dict(ev,id='event-'+str(i+1)) for i,ev in enumerate(fresh[:24])]
                        x['limitations']=list(dict.fromkeys(old+context['limitations']))
                        sent=[ev for ev in x['evidence'] if ev['status']=='sent' and ev['kind'] in SENT_PORTRAIT and (not x.get('at') or timestamp(ev['at'])>=timestamp(x['at']))]
                        if sent and x['kind']=='draft':x['limitations'].append('draft_semantics_unproven')
                        if sent and x['kind'] in {'photos_missing','photos_incomplete'}:x['limitations'].append('photo_request_semantics_unproven')
                        x['lookupStatus']='inspected'
                        # Other drafts are model-visible proposals, not delivery proof.
                        x['relatedDrafts']=projected['drafts']
                        if context.get('terminal'):x['blocked']='completed'
                except Exception as error:
                    code=str(error) if isinstance(error,ValueError) and str(error) in {'invalid_order_link','missing_order_for_draft','ambiguous_order_for_draft','order_unavailable','draft_budget'} else 'lookup_unavailable'
                    for x in matching:x['lookupStatus']='unavailable';x['limitations']=list(dict.fromkeys(x['limitations']+[code]))
    except Exception:
        for c in result:
            if c.get('lookupStatus')=='not_requested':c['lookupStatus']='agent_unavailable'
    for c in result:
        if not c.get('blocked') and c.get('lookupStatus')!='inspected':c['limitations']=list(dict.fromkeys(c['limitations']+['lookup_'+c['lookupStatus']]))
    return result
