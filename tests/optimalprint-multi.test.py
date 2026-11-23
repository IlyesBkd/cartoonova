"""Staged agent only. Network and subprocess forbidden; no live state touched."""
import base64
import copy
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, '/home/hermes/.hermes/profiles/cartoonova/scripts')
BASE = Path(__file__).resolve().parents[1]/'ops/optimalprint-multi'
def load(name):
    spec=importlib.util.spec_from_file_location(name, BASE/(name+'.py'))
    mod=importlib.util.module_from_spec(spec);sys.modules[name]=mod;spec.loader.exec_module(mod);return mod
f=load('optimalprint_future_shipping')
a=load('optimalprint_agent')
def mail(mid='abc123',tracks=('DPD12345678','DPD87654321')):
    text='Your order has shipped\nOrder number: 12345678\nShipping address:\nAlice Martin\n1 rue Test\n75001 Paris\nCarrier: DPD\n'+'\n'.join('Tracking number: '+t for t in tracks)
    return dict(id=mid,internalDate=str(f.EFFECTIVE_MS+1000),labelIds=['INBOX'],payload=dict(mimeType='text/plain',headers=[{'name':'From','value':'shipping@optimalprint.com'},{'name':'Subject','value':'Your order has shipped'},{'name':'Authentication-Results','value':'mx.google.com; dmarc=pass header.from=optimalprint.com'}],body={'data':base64.urlsafe_b64encode(text.encode()).decode()}))
def orders(n=2):
    return [dict(id=f'0000000{i}-1111-4111-8111-111111111111',customer_name='Alice Martin',customer_address='1 rue Test',customer_email='alice@example.invalid',langue='fr',paid_at='2026-11-24',status='PAID',statut_force=None,poster_confirmation_status='confirmed',options={'printKey':'canvas','city':'Paris','postalCode':'75001','country':'FR'},fournisseur_ref='12345678',cout=str(i+1),cout_note='manual split',suivi_url=None,suivi_transporteur=None,expedie_le=None,expedition_email_envoye_le=None,shipping_details=None) for i in range(n)]
class Tests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']);self.root=Path(self.tmp.name);self.rows=orders();self.msg=mail();self.sends=0;owner=self
        class Admin:
            def group(self,p):
                owner.sends+=1
                for o in owner.rows:
                    o.update(shipping_details=f.shipping_details(p),suivi_url=f.shipping_details(p)['tracking'][0]['url'],expedie_le='2026-11-24',expedition_email_envoye_le='2026-11-24')
                return {'ok':True,'emailId':'synthetic'}
        self.Admin=Admin
        self.net=patch('socket.socket',side_effect=AssertionError('NETWORK FORBIDDEN'));self.proc=patch('subprocess.run',side_effect=AssertionError('PROCESS FORBIDDEN'));self.net.start();self.proc.start()
    def tearDown(self):
        self.net.stop();self.proc.stop();self.tmp.cleanup()
    def run_action(self,apply=True,admin=None):
        return f.execute(self.msg,lambda:copy.deepcopy(self.rows),self.root,a.save,apply,admin or self.Admin)
    def test_group_success_and_cross_id_duplicate(self):
        self.assertEqual(self.run_action()['status'],'verified');self.assertEqual(self.sends,1)
        self.msg['id']='abc124';self.assertEqual(self.run_action()['reason'],'duplicate_verified');self.assertEqual(self.sends,1)
        self.assertEqual(len(self.rows[0]['shipping_details']['tracking']),2)
    def test_group_one_parcel_and_single_multiple(self):
        for n,tracks in [(2,('DPD12345678',)),(1,('DPD12345678','DPD87654321'))]:
            with self.subTest(n=n):
                with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as root:
                    self.root=Path(root);self.rows=orders(n);self.msg=mail(tracks=tracks);self.assertEqual(self.run_action()['status'],'verified')
    def test_preview_no_mutation(self):
        before=copy.deepcopy(self.rows);self.assertTrue(self.run_action(False)['preview']);self.assertEqual(self.rows,before);self.assertEqual(self.sends,0);self.assertFalse(list(self.root.iterdir()))
    def test_changed_scope_alert(self):
        self.run_action();self.rows.append(orders(3)[2]);self.assertTrue(self.run_action()['notification']);self.assertEqual(self.sends,1)
    def test_changed_details_alert(self):
        self.run_action();self.rows[0]['shipping_details']['tracking'].pop();self.assertTrue(self.run_action()['notification']);self.assertEqual(self.sends,1)
    def test_timeout_never_retried(self):
        class Fail(self.Admin):
            def group(self,p):raise TimeoutError()
        self.assertEqual(self.run_action(admin=Fail)['reason'],'started_result_uncertain');self.assertEqual(self.run_action()['reason'],'started_result_uncertain');self.assertEqual(self.sends,0)
    def test_interruption_never_retried(self):
        class Crash(self.Admin):
            def group(self,p):super().group(p);raise KeyboardInterrupt()
        with self.assertRaises(KeyboardInterrupt):self.run_action(admin=Crash)
        self.assertEqual(self.run_action()['reason'],'started_result_uncertain');self.assertEqual(self.sends,1)
    def test_history_and_exclusions(self):
        for field,value in [('id','1a2080ce22beb9e7'),('internalDate',str(f.EFFECTIVE_MS))]:
            self.msg=mail();self.msg[field]=value;self.assertFalse(self.run_action()['allowed'])
        self.msg=mail();self.rows[0]['id']='b04b885f-1111-4111-8111-111111111111';self.assertFalse(self.run_action()['allowed']);self.assertEqual(self.sends,0)
    def test_auth_identity_and_validation(self):
        for field,value in [('customer_name','Wrong'),('customer_email','other@example.invalid'),('poster_confirmation_status',None)]:
            self.rows=orders();self.rows[0][field]=value;self.assertFalse(self.run_action()['allowed'])
        self.rows=orders();self.msg['payload']['headers'][-1]['value']='mx.google.com; dmarc=fail header.from=optimalprint.com';self.assertFalse(self.run_action()['allowed']);self.assertEqual(self.sends,0)
    def test_all_ten_site_languages_and_unknown_refusal(self):
        for lang in ('fr','en','de','es','it','nl','pl','sv','da','pt'):
            with self.subTest(lang=lang):
                self.rows=orders()
                for row in self.rows:row['langue']=lang
                p=f.plan(self.msg,self.rows)
                self.assertTrue(p['allowed']);self.assertEqual(p['email_template'],'site_group_shipping')
        self.rows[0]['langue']='xx';self.rows[1]['langue']='xx'
        self.assertEqual(f.plan(self.msg,self.rows)['reason'],'language_requires_review')
    def test_real_admin_adapter_json_contract(self):
        p=f.plan(self.msg,self.rows);instance=object.__new__(f.Admin);calls=[]
        class Support:
            def appel_admin(self,route,payload):
                calls.append((route,payload));return 200,{'ok':True,'emailId':'synthetic','details':f.shipping_details(p)}
        instance.support=Support();instance.group(p);self.assertEqual(calls,[('/api/orders/expedition',{'shippingGroup':f.shipping_details(p)})])
if __name__=='__main__':unittest.main()
