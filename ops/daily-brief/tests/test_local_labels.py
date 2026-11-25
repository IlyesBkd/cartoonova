"""Real JS projection through planning/review payloads and private rendering."""
import json
import subprocess
import unittest
from test_verification import ROOT, NOW, brief, data, decisions
from enrichment import enrich
from verification import review


class LocalLabelsTests(unittest.TestCase):
    def project(self, name, client='arbitrary identity', draft_id: int | str=17, linked=True):
        script = """
import {A,NOW,order,draft,empty} from './tests/fixtures.mjs';
import {projectOrderContext,makeCandidates} from './evidence.mjs';
const [name,client,id,linked]=JSON.parse(process.argv[1]);
const ctx=projectOrderContext({...order(),customer_name:name},[],{observedAt:NOW});
console.log(JSON.stringify(makeCandidates(empty(),[draft({id,client,commande:linked?A:null})],{[A]:ctx})));
"""
        return json.loads(subprocess.run(['/usr/bin/node', '--input-type=module', '-e', script,
            json.dumps([name, client, draft_id, linked])], cwd=ROOT, capture_output=True, text=True, check=True).stdout)

    def test_names_render_but_never_reach_planning_or_review(self):
        for name in ['Kerly', 'Tanguy', 'Jeanne', 'Élodie O’Neill', 'Anne-Marie', '李 明']:
            with self.subTest(name=name):
                cs=self.project(name)
                payloads=[]
                def plan(p):
                    payloads.append(p)
                    return '{"requests":[]}'
                def model(p):
                    payloads.append(p)
                    return decisions(p)
                text=brief.render(data(review(enrich(cs,inference=plan),model)),NOW)
                self.assertIn(name,text)
                self.assertIn('CE QU’IL RESTE À FAIRE',text)
                self.assertIn('dossier non consulté',text)
                for p in payloads:
                    raw=json.dumps(p,ensure_ascii=False)
                    for forbidden in [name,'displayLabel','localDisplayName',cs[0]['orderId'],'arbitrary identity','b17']:
                        self.assertNotIn(forbidden,raw)
                self.assertEqual(len(payloads),2)

    def test_contact_and_arbitrary_identities_rejected(self):
        for name in ['abc@example.com','+33 6 12 34 56 78','12 rue Exemple','rue Exemple',
                     '<b>Jeanne</b>','Jeanne\nSecret','x'*81, {'name':'Jeanne'}, None]:
            with self.subTest(name=name):
                cs=self.project(name,client='abc@example.com')
                text=brief.render(data(review(cs,decisions)),NOW)
                self.assertEqual(cs[0]['displayLabel'],'Dossier b17')
                self.assertIn('Dossier b17',text)
                for raw in ['abc@example.com','33 6 12','rue Exemple','[email masqué]','[nom masqué]']:
                    self.assertNotIn(raw,text)
        # Even a syntactically valid draft client is not a structured order name.
        cs=self.project(None,client='Jeanne')
        self.assertEqual(cs[0]['displayLabel'],'Dossier b17')
        cs=self.project('Jeanne',client='Kerly',linked=False)
        self.assertEqual(cs[0]['displayLabel'],'Dossier b17')
        self.assertIn('context_unavailable',cs[0]['limitations'])

    def test_unsafe_draft_id_not_used_as_display_label(self):
        for did in ['abc@example.com','+33612345678','11111111-1111-4111-8111-111111111111']:
            self.assertEqual(self.project(None,draft_id=did)[0]['displayLabel'],'Dossier c1')

    def test_attribution_blockers_kept_with_named_label(self):
        cs=self.project('Kerly')
        cs[0]['limitations']=['unassigned_multi_order_exchange']
        text=brief.render(data(review(cs,decisions)),NOW)
        self.assertIn('Kerly',text)
        self.assertIn('plusieurs commandes existent',text)
        self.assertNotIn('oui 17',text)


if __name__=='__main__':unittest.main()
