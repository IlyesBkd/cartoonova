#!/usr/bin/env python3
"""Future-only guarded shipping, including supplier groups and multiple parcels.
Staged for activation only after migration and verified site deployment.
No per-product parcel attribution and no SQL writes. Imported by guarded actions.
"""
import csv
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import subprocess
import sys
from email.utils import getaddresses
import optimalprint_dossier as dossier

PROFILE = Path('/home/hermes/.hermes/profiles/cartoonova')
EFFECTIVE_MS = 1795464172000  # 2026-11-23T20:02:52Z; verified in tests
EXCLUDED_MESSAGES = {'1a2080ce22beb9e7', '1a209ae4fb8ee44f'}
EXCLUDED_ORDERS = ('b04b885f', 'e742b4db')


def read_sql(sql):
    p = subprocess.run([sys.executable, str(PROFILE/'scripts/db-tool.py'), 'query', sql],
                       capture_output=True, text=True, timeout=90)
    if p.returncode:
        raise RuntimeError('readback_failed')
    return list(csv.DictReader(io.StringIO(p.stdout)))


def authenticated(msg):
    headers = msg.get('payload', {}).get('headers', [])
    senders = getaddresses([h.get('value', '') for h in headers if h.get('name', '').lower() == 'from'])
    if len(senders) != 1:
        return False
    domain = senders[0][1].lower().rpartition('@')[2]
    if not (domain == 'optimalprint.com' or domain.endswith('.optimalprint.com')):
        return False
    auths = [h.get('value','') for h in headers if h.get('name','').lower() == 'authentication-results']
    trusted = [a for a in auths if re.match(r'^\s*mx\.google\.com\s*;', a, re.I)]
    # Ambiguous duplicate authentication headers fail closed, not substring evidence.
    if len(trusted) != 1:
        return False
    return bool(re.search(r'\bdmarc=pass\b[^;]*\bheader\.from='+re.escape(domain)+r'(?:\s|;|$)', trusted[0], re.I))


def plan(msg, rows):
    def deny(reason):
        return {'allowed':False, 'reason':reason, 'external_writes':False}
    if msg.get('id') in EXCLUDED_MESSAGES or int(msg.get('internalDate', 0)) <= EFFECTIVE_MS:
        return deny('historical_or_excluded')
    if set(msg.get('labelIds', [])) & {'SPAM','TRASH','SENT','DRAFT'} or not authenticated(msg):
        return deny('sender_authentication_unproven')
    e = dossier.parse_message(msg)
    if e['status'] != 'shipped' or any(e[k] for k in ('dmarc_failed','invalid_identifiers','status_blocked','carrier_conflict')):
        return deny('shipping_evidence_unsafe')
    if len(e['supplier_refs']) != 1 or not e['tracking_ids']:
        return deny('missing_reference_or_tracking')
    ref = e['supplier_refs'][0]
    if not re.fullmatch(r'\d{6,10}', ref) or any(not re.fullmatch(r'[A-Za-z0-9]{6,40}', t) for t in e['tracking_ids']):
        return deny('invalid_identifier')
    attached = sorted([o for o in rows if o.get('fournisseur_ref') == ref], key=lambda o:o['id'])
    if not attached:
        return deny('reference_not_attached')
    attached_ids = {o['id'] for o in attached}
    expected_tracks = {dossier.normalized(t) for t in e['tracking_ids']}
    if any(o['id'] not in attached_ids and dossier.tracking_values(o) & expected_tracks for o in rows):
        return deny('tracking_attached_outside_group')
    if any(o['id'].startswith(EXCLUDED_ORDERS) for o in attached):
        return deny('excluded_current_case')
    recipient = e.get('recipient')
    if not recipient:
        return deny('supplier_recipient_incomplete')
    def norm(v): return dossier._norm_identity(v)
    identities = set()
    for o in attached:
        opt = o.get('options') or {}
        ident = (norm(o.get('customer_name')), norm(o.get('customer_address')),
                 norm(opt.get('postalCode')), norm(opt.get('city')), norm(opt.get('country')),
                 (o.get('customer_email') or '').strip().lower(), o.get('langue') or 'fr')
        identities.add(ident)
        if not all(ident[:4]) or any(norm(recipient.get(k)) != ident[i] for i,k in enumerate(('name','street','postal_code','city'))):
            return deny('supplier_identity_conflict')
        if not dossier.physical_paid(o) or o.get('statut_force') or o.get('status') in ('REFUNDED','CANCELLED','CANCELED','DEMO') or o.get('poster_confirmation_status') != 'confirmed':
            return deny('order_not_eligible')
        if o.get('shipping_details') or o.get('suivi_url') or o.get('expedie_le') or o.get('expedition_email_envoye_le'):
            return deny('existing_shipping_requires_review')
        if o.get('suivi_transporteur') and dossier.normalized(o['suivi_transporteur']) != dossier.normalized(e.get('carrier')):
            return deny('carrier_contradiction')
    if len(identities) != 1:
        return deny('group_identity_conflict')
    ident = next(iter(identities))
    if not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', ident[5]):
        return deny('recipient_email_invalid')
    tracks = sorted({t.upper() for t in e['tracking_ids']})
    # Never assign a parcel to a product: the scope is explicitly the whole group.
    if ident[6] not in ('fr', 'en', 'de', 'es', 'it', 'nl', 'pl', 'sv', 'da', 'pt'):
        return deny('language_requires_review')
    order_ids = [o['id'] for o in attached]
    key = hashlib.sha256(json.dumps([ref,ident[5],tracks],ensure_ascii=True).encode()).hexdigest()
    return dict(allowed=True, reason=None, key=key, ref=ref, tracking_ids=tracks, order_ids=order_ids,
                to=ident[5], language=ident[6], carrier=e.get('carrier'), email_template='site_group_shipping',
                scope='single_order_one_parcel' if len(order_ids) == len(tracks) == 1 else 'supplier_group_no_parcel_product_mapping',
                persistence='orders_shipping_details_and_group_email')


class Admin:
    def __init__(self):
        spec = importlib.util.spec_from_file_location('existing_support_api', '/home/hermes/hermes-ops/ops/clients/support.py')
        self.support = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.support)
        self.support.connexion_admin()

    def group(self, p):
        payload = {'shippingGroup': shipping_details(p)}
        status, data = self.support.appel_admin('/api/orders/expedition', payload)
        if status != 200 or not data.get('ok') or data.get('details') != shipping_details(p) or not data.get('emailId'):
            raise RuntimeError('group_shipping_failed_or_uncertain')
        return data


def refusal(reason, **extra):
    message = ('Groupe ou multi-colis : traitement manuel, stockage site non résolu ; aucun email tenté.'
               if reason == 'group_or_multiple_parcels_manual_storage_unresolved'
               else reason+' ; vérifier à la main, aucun envoi automatique.')
    return dict(allowed=False, reason=reason, external_writes=False,
                notification='⚠️ Expédition : '+message, **extra)


def shipping_details(p):
    return dict(supplierRef=p['ref'], orderIds=sorted(p['order_ids']),
                tracking=[dict(number=t.upper(), url='https://t.17track.net/fr#nums='+t.upper(), carrier=p.get('carrier') or None)
                          for t in sorted(p['tracking_ids'])], scope='supplier_group_no_parcel_product_mapping')


def manual_scope(p):
    return len(p['order_ids']) != 1 or len(p['tracking_ids']) != 1


def duplicate_result(prior, candidate, rows):
    # The key deliberately excludes order IDs: compare the ENTIRE current
    # reference scope and exact after snapshot before calling anything verified.
    if prior.get('status') != 'verified':
        return refusal('started_result_uncertain', prior=prior)
    selected = sorted([o for o in rows if o.get('fournisseur_ref') == candidate['ref']], key=lambda o:o['id'])
    expected_ids = sorted(prior.get('plan', {}).get('order_ids', []))
    after = sorted(prior.get('after', []), key=lambda o:o['id'])
    if (not expected_ids or sorted(candidate['order_ids']) != expected_ids
            or [o['id'] for o in selected] != expected_ids or selected != after):
        return refusal('duplicate_readback_changed_requires_review')
    return dict(allowed=False, reason='duplicate_verified', prior=prior, notification='', external_writes=False)


def execute(msg, rows_loader, root, save, apply=False, admin_factory=Admin):
    """Caller holds the global action lock. Persist intent before any remote write."""
    rows = rows_loader()
    p = plan(msg, rows)
    if not p['allowed']:
        if p['reason'] == 'existing_shipping_requires_review':
            # Reconstruct a candidate ONLY to identify an existing receipt, never to act.
            clean = [dict(o, shipping_details=None, suivi_url=None, expedie_le=None, expedition_email_envoye_le=None) for o in rows]
            candidate = plan(msg, clean)
            if candidate['allowed']:
                old = root/'shipping'/f"{candidate['key']}.json"
                if old.exists():
                    prior = json.loads(old.read_text())
                    return duplicate_result(prior, candidate, rows)
        return refusal(p['reason'])
    target = root/'shipping'/f"{p['key']}.json"
    if target.exists():
        prior = json.loads(target.read_text())
        return duplicate_result(prior, p, rows)
    # All future scopes use the guarded site route, never a support-email bypass.
    # Same group, another parcel set: review instead of assuming full/partial shipment.
    for existing in (root/'shipping').glob('*.json') if (root/'shipping').exists() else []:
        prior = json.loads(existing.read_text())
        if prior.get('plan',{}).get('ref') == p['ref']:
            return refusal('different_parcel_set_requires_review')
        if set(prior.get('plan',{}).get('tracking_ids',[])) & set(p['tracking_ids']):
            return refusal('tracking_in_another_group_receipt')
    if not apply:
        return dict(p, preview=True, external_writes=False)
    if (PROFILE/'state/auto-expedition-off').exists():
        return refusal('owner_kill_switch')
    receipt = dict(status='started_result_uncertain', source_id=msg['id'], plan=p, before=[o for o in rows if o['id'] in p['order_ids']])
    save(target, receipt)
    try:
        admin = admin_factory()
        receipt['group_result'] = admin.group(p)
        after = sorted([o for o in rows_loader() if o.get('fournisseur_ref') == p['ref']], key=lambda o:o['id'])
        if [o['id'] for o in after] != p['order_ids']:
            raise RuntimeError('group_scope_readback_changed')
        before = {o['id']:o for o in receipt['before']}
        for o in after:
            if not o.get('expedition_email_envoye_le') or not o.get('expedie_le') or o.get('shipping_details') != shipping_details(p) or o.get('suivi_url') != shipping_details(p)['tracking'][0]['url']:
                raise RuntimeError('group_readback_unverified')
            for field in ('fournisseur_ref','cout','cout_note'):
                if o.get(field) != before[o['id']].get(field):
                    raise RuntimeError('group_preservation_failed')
        receipt.update(status='verified', after=after, notification='')
        save(target, receipt)
        return dict(allowed=True, status='verified', receipt_path=str(target), notification='', persistence='orders_shipping_and_site_email')
    except Exception:
        # Intent stays uncertain; failure cannot trigger an automatic resend.
        return dict(allowed=False, reason='started_result_uncertain', receipt_path=str(target), notification='⚠️ Expédition : échec ou résultat incertain, vérifier sans renvoi.')
