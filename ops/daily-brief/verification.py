"""Fail-closed, bounded second opinion. No transport, DB or state writes."""
import datetime
import json
import os
import pathlib
import subprocess
import sys

MAX_CANDIDATES=40
MAX_PAYLOAD=60000
MAX_OUTPUT=20000
DECISIONS={'confirmer','retirer','a_verifier'}
REASONS={'supported','superseded','duplicate','contradiction','insufficient','unavailable'}
FINDINGS={'action','awaiting_customer','draft_superseded','draft_update','refund_requested','unknown'}
SENT_PORTRAIT={'delivery.final_image','order.final_image','delivery.preview','delivery.poster_confirmation'}

def confirmation_compatible(candidate):
    """Local vetoes: a model cannot reinterpret a structured contradiction.

    Free prose is never sufficient to prove a missing photo. No structured
    missing-photo attestation exists in this projection yet, so always review.
    """
    if candidate.get('limitations') or candidate['kind']=='photos_incomplete':return False
    states=[e for e in candidate['evidence'] if e['kind']=='current_state']
    if len(states)!=1:return False
    try:
        state=json.loads(states[0]['text'])
        if not isinstance(state,dict):return False
    except (ValueError,TypeError):return False
    kind=candidate['kind']
    if kind in {'pending','preview_overdue','preview_unknown'}:
        if state.get('photosPresent') is not True:return False
        if state.get('finalImageSentAt') or state.get('shippedAt'):return False
        if state.get('previewStatus') in {'confirmed','changes_requested','retouch','retouch_requested','revision_requested'}:return False
        if any(e['status']=='sent' and e['kind'] in SENT_PORTRAIT for e in candidate['evidence']):return False
    if kind in {'readyPrint','print_order'}:
        if state.get('previewStatus')!='confirmed' or state.get('supplierReferencePresent') is not False:return False
    if kind=='photos_missing' and state.get('photosPresent') is not False:return False
    return True

def timestamp(value):
    if not isinstance(value,str) or len(value)>40:raise ValueError('date')
    at=datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
    if at.tzinfo is None:raise ValueError('timezone')
    return at

def payload_for(candidates):
    if not isinstance(candidates,list) or len(candidates)>MAX_CANDIDATES:raise ValueError('candidate budget')
    result=[];ids=set()
    for c in candidates:
        cid=c['id']
        if not isinstance(cid,str) or not cid.startswith('candidate-') or len(cid)>30 or cid in ids:raise ValueError('id')
        ids.add(cid)
        evidence=[];refs=set()
        if len(c['evidence'])>25 or len(c['limitations'])>20:raise ValueError('evidence budget')
        for e in c['evidence']:
            if set(e)!={'id','at','kind','status','text'}:raise ValueError('fields')
            if e['id'] in refs or not isinstance(e['id'],str) or len(e['id'])>30:raise ValueError('ref')
            refs.add(e['id']);timestamp(e['at'])
            for k,maximum in [('kind',80),('status',30),('text',6000)]:
                if not isinstance(e[k],str) or len(e[k])>maximum:raise ValueError('evidence text')
            evidence.append(e)
        if c.get('at'):timestamp(c['at'])
        if c.get('proposal') is not None and (not isinstance(c['proposal'],str) or len(c['proposal'])>700):raise ValueError('proposal')
        # Deliberately omit names, raw order IDs, draft IDs and all financial data.
        item={k:c.get(k) for k in ('id','kind','at','proposal','limitations')}|{'evidence':evidence}
        if 'relatedDrafts' in c:
            drafts=c['relatedDrafts']
            if not isinstance(drafts,list) or len(drafts)>20:raise ValueError('draft budget')
            for d in drafts:
                if set(d)!={'at','text','limitations'} or not isinstance(d['text'],str) or len(d['text'])>700 or not isinstance(d['limitations'],list):raise ValueError('draft schema')
                if d['at']:timestamp(d['at'])
            item['relatedDrafts']=drafts
        result.append(item)
    payload={'version':1,'candidates':result}
    if len(json.dumps(payload,ensure_ascii=False).encode())>MAX_PAYLOAD:raise ValueError('payload budget')
    return payload

def validate_output(raw,payload):
    if not isinstance(raw,str) or len(raw.encode())>MAX_OUTPUT:raise ValueError('output budget')
    def unique_pairs(pairs):
        out={}
        for k,v in pairs:
            if k in out:raise ValueError('duplicate JSON key')
            out[k]=v
        return out
    parsed=json.loads(raw,object_pairs_hook=unique_pairs)
    if not isinstance(parsed,dict) or set(parsed)!={'decisions'} or not isinstance(parsed['decisions'],list):raise ValueError('schema')
    expected={c['id']:c for c in payload['candidates']};result={}
    for r in parsed['decisions']:
        if not isinstance(r,dict) or set(r) not in ({'id','decision','reason','evidenceIds'},{'id','decision','reason','evidenceIds','finding'}):raise ValueError('decision schema')
        if r.get('finding','unknown') not in FINDINGS:raise ValueError('finding')
        cid=r['id']
        if not isinstance(cid,str) or cid not in expected or cid in result:raise ValueError('unknown/duplicate candidate')
        if r['decision'] not in DECISIONS or r['reason'] not in REASONS:raise ValueError('enum')
        refs=r['evidenceIds']
        if not isinstance(refs,list) or len(refs)>4 or any(not isinstance(x,str) for x in refs) or len(set(refs))!=len(refs):raise ValueError('refs')
        valid={e['id']:e for e in expected[cid]['evidence']}
        if any(x not in valid for x in refs):raise ValueError('foreign evidence')
        finding=r.get('finding','unknown')
        proof=[valid[x] for x in refs if valid[x]['kind']!='current_state']
        usable=not expected[cid].get('limitations') and bool(proof)
        if finding=='refund_requested':usable=usable and any(x['kind']=='email.incoming' for x in proof)
        if finding=='draft_superseded':usable=usable and bool(expected[cid].get('at')) and any(x['status']=='sent' and timestamp(x['at'])>=timestamp(expected[cid]['at']) for x in proof)
        if finding=='awaiting_customer':
            outgoing=[x for x in proof if x['kind']=='email.outgoing' and x['status']=='sent']
            usable=usable and bool(outgoing) and not any(x['kind'] in {'email.incoming','retouch.request'} and timestamp(x['at'])>max(timestamp(y['at']) for y in outgoing) for x in valid.values())
        if not usable and 'finding' in r:r=dict(r,finding='unknown')
        if r['decision']!='a_verifier' and not refs:raise ValueError('missing proof')
        if r['decision']=='confirmer' and r['reason']!='supported':raise ValueError('unsafe confirmation')
        if r['decision']=='retirer' and r['reason'] not in {'superseded','duplicate'}:raise ValueError('unsafe removal')
        # No semantic deletion by the model. Exact duplicates / terminal states
        # are already handled locally. State-only, prose and limited histories
        # cannot establish that a still-visible action has become obsolete.
        if r['decision']=='retirer' or (r['decision']=='confirmer' and not confirmation_compatible(expected[cid])):
            r=dict(r,decision='a_verifier',reason='insufficient')
        result[cid]=r
    if set(result)!=set(expected):raise ValueError('incomplete decisions')
    return result

def infer(payload):
    env={k:os.environ[k] for k in ('PATH','HOME','TMPDIR','VIRTUAL_ENV','HERMES_HOME','HERMES_PROFILE') if k in os.environ}
    env['HERMES_HOME']='/home/hermes/.hermes/profiles/cartoonova'
    proc=subprocess.run([sys.executable,str(pathlib.Path(__file__).with_name('hermes_inference.py'))],input=json.dumps(payload,ensure_ascii=False),text=True,capture_output=True,timeout=45,env=env)
    if proc.returncode:raise RuntimeError('review unavailable')
    return proc.stdout

def review(candidates,inference=infer):
    # Deterministic rejections never enter the model and cannot be rehabilitated.
    result=[dict(c,decision='retirer' if c.get('blocked') else 'a_verifier',reason=c.get('blocked') or 'unavailable',evidenceIds=[]) for c in candidates]
    active=[c for c in result if not c.get('blocked')]
    if not active:return result
    try:
        payload=payload_for(active)
        decisions=validate_output(inference(payload),payload)
        for c in result:
            if not c.get('blocked'):c.update(decisions[c['id']])
    except Exception:
        # Never leak model text/errors; no partial acceptance on malformed output/timeout.
        pass
    return result
