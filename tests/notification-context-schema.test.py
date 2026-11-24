#!/usr/bin/env python3
"""Pure schema/prompt tests. No Hermes provider import, secrets or network."""
from typing import Any
import runpy
import unittest
from pathlib import Path
m=runpy.run_path(str(Path(__file__).resolve().parents[1]/'ops/support-context-v1/hermes_inference.py'))
validate=m['validate_payload']
class Schema(unittest.TestCase):
    def context(self) -> dict[str, Any]:
        return dict(version=2,observedAt='2026-11-24T10:00:00Z',messageAt='2026-11-23T10:00:00.000050Z',linkage='none',identity='exact_email',selectedOrder=None,orders=[],history=[dict(role='customer',at='2026-11-23T10:00:00.000049Z',text='Texte non fiable')],events=[],supplier=dict(status='not_applicable',evidence=[],limitations=[]),limitations=[])
    def payload(self,c):return dict(subject='Subject',bodyText='Dove è il ritratto?',context=c)
    def test_without_context(self):validate(dict(subject='Subject',bodyText='Hello'))
    def test_v1_backward_compatibility(self):
        c=dict(version=1,observedAt='2026-11-24T10:00:00Z',messageAt='2026-11-23T10:00:00Z',linkage='none',language=None,order=None,history=[],supplier=dict(status='unavailable',evidence=[],limitations=[]),limitations=[])
        validate(self.payload(c));c['history']=[dict(role='customer',at='2026-11-22T10:00:00Z',text='legacy unverified')]
        with self.assertRaises(ValueError):validate(self.payload(c))
    def test_same_email_without_order_and_ambiguous(self):
        c=self.context();validate(self.payload(c));c['linkage']='ambiguous';validate(self.payload(c))
    def test_strict_prior_and_date_types(self):
        for stamp in ['2026-11-23T10:00:00.000050Z','2026-11-23T10:00:00.000051Z',None,'2026-11-22T10:00:00']:
            c=self.context();c['history'][0]['at']=stamp
            with self.assertRaises(ValueError):validate(self.payload(c))
    def test_unknown_contradiction_unavailable(self):
        for field,value in [('identity','unknown'),('linkage','contradiction'),('linkage','unavailable')]:
            c=self.context();c[field]=value
            with self.assertRaises(ValueError):validate(self.payload(c))
    def test_bounds_unknown_fields_and_selection(self):
        for key,value in [('extra','secret'),('history',self.context()['history']*13),('selectedOrder','commande-9'),('version',True),('version',2.0)]:
            c=self.context();c[key]=value
            with self.assertRaises(ValueError):validate(self.payload(c))
    def test_observed_current_not_prior_history(self):
        c=self.context();c['events']=[dict(kind='delivery.final_image',title='Portrait envoyé',at='2026-11-24T09:00:00Z',status='sent',orders=[],temporal='observed',text=None)]
        validate(self.payload(c));c['events'][0]['at']='2026-11-25T00:00:00Z'
        with self.assertRaises(ValueError):validate(self.payload(c))
    def test_states_are_distinct(self):
        c=self.context()
        for status in ['recorded','scheduled','sent','failed','uncertain']:
            c['events']=[dict(kind='email',title='Email',at=None,status=status,orders=[],temporal='observed',text=None)]
            validate(self.payload(c))
        c['events'][0]['status']='delivered'
        with self.assertRaises(ValueError):validate(self.payload(c))
    def test_supplier_strict_cutoff(self):
        c=self.context();c['supplier']['evidence']=[dict(at=c['messageAt'],text='Shipment declaration',source='supplier')]
        with self.assertRaises(ValueError):validate(self.payload(c))
    def test_prompt_language_and_business_guards(self):
        prompt=m['SYSTEM_PROMPT']
        for clause in ['NOUVEAU message','bodyText','identity=exact_email','selectedOrder','pas un numéro de version','ne devine jamais','recorded','scheduled','failed','uncertain','non fiables','vouvoiement','aucune décision commerciale']:
            self.assertIn(clause.lower(),prompt.lower())
if __name__=='__main__':unittest.main()
