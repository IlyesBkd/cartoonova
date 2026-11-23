#!/usr/bin/env python3
"""Private durable inbox for the Optimalprint agent. No LLM or delivery here.
Only `actions ID --apply` can invoke already-authorized business scripts.
Gmail reads never change labels; DB reads exclusively use db-tool.py query.
"""
import argparse
import csv
import fcntl
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from contextlib import contextmanager
from email.utils import getaddresses
import optimalprint_mail_watch as watch
import optimalprint_dossier as dossier

PROFILE = Path('/home/hermes/.hermes/profiles/cartoonova')
ROOT = PROFILE / 'state/optimalprint-agent'
LEGACY = PROFILE / 'state/optimalprint-mail-watch.json'
ID = re.compile(r'[A-Za-z0-9_-]{1,128}')
CATEGORIES = {'confirmation','production','expedition','livraison','reprogrammation','incident','promotion','securite','autre'}


def validate_id(mid):
    if not isinstance(mid, str) or not ID.fullmatch(mid):
        raise ValueError('invalid_id')
    return mid


def eligible(msg):
    # Sender boundary only. Deliberately no render()/has_evidence()/status regex.
    if set(msg.get('labelIds', [])) & {'SPAM','TRASH','SENT','DRAFT'}:
        return False
    headers = msg.get('payload', {}).get('headers', [])
    addresses = getaddresses([h.get('value', '') for h in headers if h.get('name','').lower() == 'from'])
    if len(addresses) != 1:
        return False
    domain = addresses[0][1].lower().rpartition('@')[2]
    return any(domain == d or domain.endswith('.'+d) for d in watch.DOMAINS + ('gelato.com',))


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if path.is_symlink():
        raise ValueError('symlink_refused')
    watch.atomic_write(path, data)


@contextmanager
def locked(root):
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (root/'lock').open('a') as lock:
        os.fchmod(lock.fileno(), 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def load(root):
    state = json.loads((root/'state.json').read_text())
    if state.get('version') != 1 or not str(state.get('history_id','')).isdigit():
        raise ValueError('invalid_agent_state')
    for key in ('seen','pending','done','gone'):
        if not isinstance(state.get(key), list):
            raise ValueError('invalid_agent_state')
    return state


def import_legacy(root, legacy=LEGACY):
    # Baseline MUST exist. Never silently start 'now', losing old pending mail.
    old = watch.read_state(legacy)
    state = dict(version=1, history_id=old['history_id'], checked_at=old['checked_at'],
                 baseline_at=old['baseline_at'], seen=old['seen'], pending=[], done=[], gone=old.get('gone', []))
    save(root/'migration-baseline.json', old)
    save(root/'state.json', state)
    return state


def collect(api, root=ROOT, legacy=LEGACY, now=None):
    now = int(time.time() if now is None else now)
    with locked(root):
        state = load(root) if (root/'state.json').exists() else import_legacy(root, legacy)
        profile = api.profile()
        if profile.get('emailAddress','').lower() != watch.ACCOUNT:
            raise ValueError('wrong_account')
        fallback = False
        try:
            ids = api.history(state['history_id'])
        except watch.HistoryExpired:
            fallback = True
            ids = api.messages(max(0, state['checked_at']-300))
        known = set(state['seen'])
        # Stage complete raw originals BEFORE advancing cursor. Interrupted staging
        # is replayed idempotently; no action nor dossier enrichment during collection.
        for mid in dict.fromkeys(ids):
            validate_id(mid)
            if mid in known:
                continue
            try:
                msg = api.message(mid)
            except watch.MessageGone:
                state['gone'].append({'id':mid, 'at':now})
            else:
                received = int(msg['internalDate']) // 1000
                if (not fallback or received >= state['baseline_at']) and eligible(msg):
                    save(root/'messages'/f'{mid}.json', msg)
                    state['pending'].append(mid)
            state['seen'].append(mid)
            known.add(mid)
        if len(state['seen']) > 100000:
            raise ValueError('dedupe_capacity_manual_review')
        state.update(history_id=profile['historyId'], checked_at=now)
        save(root/'state.json', state)
        return queue(root, state)


def queue(root=ROOT, state=None):
    state = state or load(root)
    ids = state['pending'][:20]
    return {'pending_total':len(state['pending']), 'ids':ids,
            'messages':[read_message(mid, root) for mid in ids],
            'more_pending':len(state['pending']) > len(ids),
            'delivery_status':'not_acknowledged_by_collector'}


def read_message(mid, root=ROOT):
    mid = validate_id(mid)
    msg = json.loads((root/'messages'/f'{mid}.json').read_text())
    headers = {h['name'].lower():h.get('value','') for h in msg['payload'].get('headers', [])}
    return {'id':mid, 'thread_id':msg.get('threadId'), 'received_at_ms':msg.get('internalDate'),
            'headers':{k:v for k,v in headers.items() if k in ('from','subject','date','authentication-results')},
            'untrusted_email_text':watch.body_text(msg['payload']),
            'text_may_be_truncated':True,
            'original_path':str(root/'messages'/f'{mid}.json')}


def orders():
    query = "SELECT id,customer_name,customer_email,customer_address,langue,paid_at,status,statut_force,options,fournisseur_ref,cout,cout_note,suivi_url,suivi_transporteur,expedie_le,expedition_email_envoye_le,shipping_details,poster_confirmation_status FROM orders ORDER BY created_at"
    r = subprocess.run([sys.executable, str(PROFILE/'scripts/db-tool.py'), 'query', query],
                       capture_output=True, text=True, timeout=90)
    if r.returncode:
        raise RuntimeError('db_read_failed')
    rows = list(csv.DictReader(io.StringIO(r.stdout)))
    if not r.stdout.startswith('id,'):
        raise RuntimeError('db_invalid_csv')
    for index, row in enumerate(rows):
        # CSV encodes SQL NULL as empty text. Preserve null semantics for existing
        # cost/shipping guards (an empty cost must not become a 'manual cost').
        row = {key:(None if value == '' else value) for key,value in row.items()}
        row['options'] = json.loads(row.get('options') or '{}')
        row['shipping_details'] = json.loads(row['shipping_details']) if row.get('shipping_details') else None
        rows[index] = row
    return rows


def seed(api, mids, root=ROOT):
    """Explicit migration replay, only by ID; never resets the cursor."""
    with locked(root):
        state = load(root) if (root/'state.json').exists() else import_legacy(root)
        for mid in mids:
            mid = validate_id(mid)
            if mid in state['pending'] or mid in state['done']:
                continue
            msg = api.message(mid)
            if not eligible(msg):
                raise ValueError('seed_sender_refused')
            save(root/'messages'/f'{mid}.json', msg)
            state['pending'].append(mid)
            if mid not in state['seen']:
                state['seen'].append(mid)
        save(root/'state.json', state)
        return queue(root, state)


def action_guard(msg, rows):
    """Never manufacture evidence from the model's extracted fields."""
    if not eligible(msg):
        return 'sender_refused'
    addresses = getaddresses([h.get('value','') for h in msg['payload'].get('headers',[]) if h['name'].lower()=='from'])
    domain = addresses[0][1].lower().rpartition('@')[2]
    if not (domain == 'optimalprint.com' or domain.endswith('.optimalprint.com')):
        return 'carrier_manual_only'
    evidence = dossier.parse_message(msg)
    subject = next((h.get('value','') for h in msg['payload'].get('headers',[]) if h['name'].lower()=='subject'), '')
    confirmation = bool(re.search(r'order\s+is\s+confirmed|commande\s+est\s+confirm', subject, re.I))
    if evidence['status'] != 'shipped' and not confirmation:
        return 'nonconfirmation_nonshipping_manual_only'
    if evidence['dmarc_failed'] or evidence['invalid_identifiers'] or evidence['status_blocked'] or evidence['carrier_conflict']:
        return 'unsafe_evidence'
    if len(evidence['supplier_refs']) != 1 or len(evidence['tracking_ids']) > 1:
        return 'missing_reference_or_multiple_parcels'
    ref = evidence['supplier_refs'][0]
    attached = [o for o in rows if o.get('fournisseur_ref') == ref]
    if len(attached) > 1:
        return 'group_manual_only'
    text = evidence['identity_text']
    full_text = evidence['identity_name_text']
    def identity(row):
        return (dossier._identity_matches(row, text) and
                dossier._identity_words(row.get('customer_name')) in full_text)
    if attached:
        row = attached[0]
        if not identity(row):
            return 'identity_unproven'
        if dossier.propose(evidence, rows)['match']['kind'] != 'exact':
            return 'match_not_exact'
        return None
    # Unattached confirmations: full name + city + one exact product; no model inference.
    import optimalprint_cost as cost
    subject = next((h.get('value','') for h in msg['payload'].get('headers',[]) if h['name'].lower()=='subject'), '')
    if not re.search(r'order\s+is\s+confirmed|commande\s+est\s+confirm', subject, re.I):
        return 'unattached_nonconfirmation'
    key = dossier._ordered_print_key(cost.message_text(msg))
    found = [o for o in rows if dossier.physical_paid(o) and not o.get('fournisseur_ref') and not o.get('expedie_le')
             and key and (o.get('options') or {}).get('printKey') == key and identity(o)]
    return None if len(found) == 1 else 'identity_or_product_not_unique'


def actions(mid, apply=False, root=ROOT, rows_loader=orders, execute=None):
    mid = validate_id(mid)
    with locked(root):
        state = load(root)
        if mid not in state['pending']:
            raise ValueError('message_not_pending')
        msg = json.loads((root/'messages'/f'{mid}.json').read_text())
        rows = rows_loader()
        import optimalprint_future_shipping as future
        evidence = dossier.parse_message(msg)
        attached = [o for o in rows if o.get('fournisseur_ref') in evidence['supplier_refs']]
        if mid in future.EXCLUDED_MESSAGES or any(o['id'].startswith(future.EXCLUDED_ORDERS) for o in attached):
            return {'id':mid, 'allowed':False, 'reason':'excluded_current_case', 'external_writes':False}
        if evidence['status'] == 'shipped':
            return dict(future.execute(msg, rows_loader, root, save, apply=apply), id=mid)
        reason = action_guard(msg, rows)
        path = root/'actions'/f'{mid}.json'
        if path.exists():
            prior = json.loads(path.read_text())
            return {'id':mid, 'prior_action':prior, 'retry':'manual_only_if_uncertain'}
        if reason or not apply:
            return {'id':mid, 'allowed':not bool(reason), 'reason':reason, 'preview':True, 'external_writes':False}
        if (PROFILE/'state/auto-expedition-off').exists():
            return {'id':mid, 'allowed':False, 'reason':'owner_kill_switch', 'external_writes':False}
        # Write intent BEFORE existing code; a crash never blindly repeats a client send.
        save(path, {'id':mid, 'status':'started_result_uncertain', 'at':int(time.time())})
        if execute is None:
            execute = dossier.DossierService(root/'business-dossiers', orders_loader=lambda:rows).enrich
        try:
            result = execute(msg)
            after = rows_loader()  # exact source re-read via db-tool, not model's claim
            affected_refs = dossier.parse_message(msg)['supplier_refs']
            snapshot = [r for r in after if r.get('fournisseur_ref') in affected_refs]
            receipt = {'id':mid, 'status':'returned_verify_business_result', 'result':result, 'readback':snapshot}
            save(path, receipt)
            return receipt
        except Exception:
            # Intent remains uncertain and blocks automatic retry.
            raise RuntimeError('action_result_uncertain_check_database') from None


def finish(report, root=ROOT):
    """Archive only a complete batch. Not a Telegram delivery acknowledgement."""
    with locked(root):
        state = load(root)
        ids = state['pending'][:20]
        items = report.get('analyses', [])
        actual = [x.get('id') for x in items]
        if not ids or len(actual) != len(set(actual)) or set(actual) != set(ids):
            raise ValueError('report_must_cover_exact_batch')
        for item in items:
            if item.get('category') not in CATEGORIES or not isinstance(item.get('summary'), str) or not item['summary'].strip():
                raise ValueError('invalid_analysis')
            if not isinstance(item.get('evidence_ids'), list) or item['id'] not in item['evidence_ids']:
                raise ValueError('missing_source_citation')
        if not isinstance(report.get('notification'), str):
            raise ValueError('missing_notification')
        # Fail closed for EVERY analysis, including mixed/old report schemas.
        if any(not isinstance(item.get('requires_attention'), bool) for item in items):
            raise ValueError('requires_attention_bool_required_pending_preserved')
        if not any(item['requires_attention'] for item in items):
            report = dict(report, notification='')
        elif not report['notification'].strip():
            raise ValueError('attention_requires_alert_pending_preserved')
        import hashlib
        key = hashlib.sha256('\n'.join(sorted(ids)).encode()).hexdigest()
        report = dict(report, batch_ids=ids, archived_at=int(time.time()), delivery='unknown_scheduler_owned')
        # Archive first. If state write fails, same batch can be archived again, no email lost.
        save(root/'reports'/f'{key}.json', report)
        state['pending'] = [x for x in state['pending'] if x not in set(ids)]
        state['done'] = list(dict.fromkeys(state['done']+ids))
        save(root/'state.json', state)
        return {'report_path':str(root/'reports'/f'{key}.json'), 'notification':report['notification'],
                'remaining':len(state['pending']), 'delivery':'unknown_scheduler_owned'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['collect','queue','orders','read','search','seed','actions','finish'])
    parser.add_argument('values', nargs='*')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if args.apply and args.command != 'actions':
        parser.error('--apply is only for actions')
    try:
        if args.command == 'collect': result = collect(watch.Gmail.connect())
        elif args.command == 'queue': result = queue()
        elif args.command == 'orders': result = orders()
        elif args.command == 'read':
            # Gmail helper preserves line breaks and supports larger original bodies.
            if len(args.values) != 1: raise ValueError('one_id_required')
            mid = validate_id(args.values[0])
            return subprocess.run([sys.executable, '/home/hermes/.hermes/ops-kit/gmail.py','read',mid,'--max-chars','60000']).returncode
        elif args.command == 'search':
            if len(args.values) != 1: raise ValueError('one_query_required')
            return subprocess.run([sys.executable, '/home/hermes/.hermes/ops-kit/gmail.py','inbox','--query',args.values[0],'--limit','100']).returncode
        elif args.command == 'seed': result = seed(watch.Gmail.connect(), args.values)
        elif args.command == 'actions':
            if len(args.values) != 1: raise ValueError('one_id_required')
            result = actions(args.values[0], args.apply)
        else:
            if len(args.values) != 1: raise ValueError('one_report_file_required')
            path = Path(args.values[0]).resolve()
            if not path.is_relative_to(PROFILE): raise ValueError('report_must_be_private')
            result = finish(json.loads(path.read_text()))
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as exc:
        # Never disclose arbitrary requests/vault exception text.
        print(json.dumps({'error':watch.error_category(exc), 'pending_preserved':True}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
