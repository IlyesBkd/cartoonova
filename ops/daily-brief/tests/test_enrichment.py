import copy
import csv
import io
import itertools
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock,patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import enrichment as e
import verification as v
import presentation as p
from test_verification import candidate,decisions
A='11111111-1111-4111-8111-111111111111'
B='22222222-2222-4222-8222-222222222222'

def request(payload):return json.dumps({'requests':[{'tool':'inspect_dossier','candidateId':c['id']} for c in payload['candidates'][:8]]})
def c(n=1,oid: str | None=A):
    x=candidate(n);x['orderId']=oid;return x

def projected():return {'context':{'evidence':c()['evidence'],'limitations':[]},'drafts':[]}

class AgentTests(unittest.TestCase):
    def test_existing_outbox_proof_preserved_and_ids_remapped_without_mutation(self):
        x=c();x['evidence'].append(dict(id='event-1',at='2026-11-22T09:00:00Z',kind='email.outbox',status='sent',text='Réponse acceptée'))
        before=copy.deepcopy(x)
        out=e.enrich([x],request,lambda _:projected())
        self.assertEqual(x,before)
        self.assertTrue(any(ev['kind']=='email.outbox' for ev in out[0]['evidence']))
        self.assertEqual(len({ev['id'] for ev in out[0]['evidence']}),len(out[0]['evidence']))
    def test_semantic_findings_need_exchange_proof_and_never_authorize_sending(self):
        x=c();x['kind']='draft';x['draftId']='b8'
        x['evidence'].append(dict(id='event-1',at='2026-11-23T09:00:00Z',kind='email.incoming',status='recorded',text='Je souhaite un remboursement.'))
        def model(payload):
            raw=json.loads(decisions(payload,'a_verifier','insufficient',['event-1']))
            raw['decisions'][0]['finding']='refund_requested'
            return json.dumps(raw)
        out=v.review([x],model);text=' '.join(p.action_lines(out))
        self.assertIn('décision humaine',text);self.assertNotIn('oui b8',text)
        x['limitations']=['text_limit']
        self.assertEqual(v.review([x],model)[0]['finding'],'unknown')
        x['limitations']=[];x['evidence'][1]['kind']='email.outgoing'
        self.assertEqual(v.review([x],model)[0]['finding'],'unknown')
    def test_missing_link_searches_exact_original_draft_not_model_identity(self):
        with tempfile.TemporaryDirectory() as td:
            home=Path(td);(home/'state').mkdir()
            path=home/'state/brouillons-en-attente.json'
            path.write_text(json.dumps({'brouillons':[{'id':'b17','commande':None,'client':'fixture@example.org','statut':'en_attente'}]}))
            before=path.read_bytes()
            for csv_text,reason in [('id\n','missing_order_for_draft'),('id\n'+A+'\n'+B+'\n','ambiguous_order_for_draft')]:
                runner=Mock(return_value=Mock(returncode=0,stdout=csv_text))
                with self.assertRaisesRegex(ValueError,reason):e.resolve_order_id(dict(c(oid=None),draftId='b17'),home=home,runner=runner)
                self.assertIn("lower('fixture@example.org')",runner.call_args.args[0][-1])
                self.assertLessEqual(runner.call_args.kwargs['timeout'],15)
                self.assertEqual(path.read_bytes(),before)
    def test_real_node_emoji_draft_truncation_survives_history_enrichment(self):
        script="""
import {A,NOW,order,draft,empty} from './tests/fixtures.mjs';
import {projectOrderContext,makeCandidates} from './evidence.mjs';
const context=projectOrderContext(order(A),[],{observedAt:NOW});
console.log(JSON.stringify(makeCandidates(empty(),[
 draft({id:17,objet:'',texte:'😀'.repeat(400)}),
 draft({id:18,objet:'',texte:'x'.repeat(700)})
],{[A]:context})));
"""
        proc=subprocess.run(['/usr/bin/node','--input-type=module','-e',script],cwd=e.SOURCE,text=True,capture_output=True,check=True,env={'PATH':'/usr/bin:/bin'})
        cs=json.loads(proc.stdout)
        self.assertLess(len(cs[0]['proposal']),700)
        self.assertTrue(cs[0]['proposal'].endswith('…'))
        self.assertIn('draft_text_limit',cs[0]['limitations'])
        self.assertNotIn('draft_text_limit',cs[1]['limitations'])
        enriched=e.enrich(cs,request,lambda _:projected())
        self.assertIn('draft_text_limit',enriched[0]['limitations'])
        confident=Mock(side_effect=decisions)
        reviewed=v.review(enriched,confident)
        confident.assert_called_once()
        self.assertEqual(reviewed[0]['decision'],'a_verifier')
        self.assertEqual(reviewed[1]['decision'],'confirmer')
        text=' '.join(p.action_lines(reviewed))
        self.assertIn('brouillon tronqué',text)
        self.assertNotIn('oui 17',text)
        self.assertIn('oui 18',text)

    def test_resolved_uuid_dedupes_same_round_and_next_round_requests(self):
        for batch in (True,False):
            with self.subTest(same_round=batch):
                cs=[c(1,None),c(2),c(3,B)]
                cs[0].update(kind='draft',draftId=17,limitations=['context_unavailable'])
                before=copy.deepcopy(cs)
                def planner(payload):
                    items=payload['candidates'] if batch else payload['candidates'][:1]
                    return json.dumps({'requests':[{'tool':'inspect_dossier','candidateId':x['id']} for x in items]})
                def lookup(candidate):
                    return dict(projected(),resolvedOrderId=candidate.get('orderId') or A)
                tool=Mock(side_effect=lookup)
                out=e.enrich(cs,planner,tool,resolver=lambda _:A)
                self.assertEqual(tool.call_count,2)
                self.assertEqual([call.args[0]['id'] for call in tool.call_args_list],['candidate-1','candidate-3'])
                self.assertEqual([x['orderId'] for x in out],[A,A,B])
                self.assertTrue(all(x['lookupStatus']=='inspected' for x in out))
                self.assertNotIn('context_unavailable',out[0]['limitations'])
                self.assertEqual(cs,before)

    def test_all_identity_permutations_use_real_resolution_and_one_dossier_per_uuid(self):
        # Each run uses actual subprocess CSV and Node projection, no lookup mock.
        for links in ((A,None,B),(None,None,B),(None,A,B)):
            for order in itertools.permutations(range(3)):
                for split in (False,True):
                    with self.subTest(links=links,order=order,split=split),tempfile.TemporaryDirectory() as td:
                        home=Path(td);(home/'scripts').mkdir();(home/'state').mkdir()
                        log=home/'queries.jsonl'
                        drafts=[dict(id=n+17,commande=None,client='fixture@example.org',statut='en_attente') for n in range(3) if links[n] is None]
                        path=home/'state/brouillons-en-attente.json'
                        path.write_text(json.dumps({'brouillons':drafts}));before_bytes=path.read_bytes()
                        script='''import csv,io,json,pathlib,sys
q=sys.argv[2]
log=pathlib.Path(__file__).resolve().parents[1]/'queries.jsonl'
with log.open('a') as f:f.write(json.dumps(q)+'\\n')
a='11111111-1111-4111-8111-111111111111'
b='22222222-2222-4222-8222-222222222222'
w=csv.writer(sys.stdout)
if q.startswith('SELECT id::text FROM orders WHERE '):
    assert q=="SELECT id::text FROM orders WHERE lower(btrim(customer_email))=lower('fixture@example.org') LIMIT 2"
    w.writerow(['id']);w.writerow([a])
else:
    assert q.startswith('WITH o AS ')
    oid=a if "id='"+a+"'::uuid" in q else b
    w.writerow(['dossier']);w.writerow([json.dumps({'order':{'id':oid,'status':'PAID','photo_urls':['group'],'own_count':1},'events':[]})])
'''
                        (home/'scripts/db-tool.py').write_text(script)
                        cs=[c(n+1,links[n]) for n in order]
                        for x in cs:
                            if x['orderId'] is None:x.update(kind='draft',draftId=int(x['id'].split('-')[-1])+16,limitations=['context_unavailable','draft_text_limit'])
                        before=copy.deepcopy(cs)
                        def planner(payload):
                            items=payload['candidates'][:2] if split else payload['candidates']
                            return json.dumps({'requests':[{'tool':'inspect_dossier','candidateId':x['id']} for x in items]})
                        out=e.enrich(cs,planner,lambda x:e.inspect_dossier(x,home=home),resolver=lambda x:e.resolve_order_id(x,home=home))
                        queries=[json.loads(line) for line in log.read_text().splitlines()]
                        reads=[q for q in queries if q.startswith('WITH o AS ')]
                        self.assertEqual(len(reads),2)
                        for oid in (A,B):self.assertEqual(sum("id='"+oid+"'::uuid" in q for q in reads),1)
                        self.assertEqual(len(queries)-len(reads),links.count(None))
                        for x in out:
                            self.assertEqual(x['orderId'],B if x['id']=='candidate-3' else A)
                            self.assertEqual(x['lookupStatus'],'inspected')
                            if x['kind']=='draft':self.assertIn('draft_text_limit',x['limitations'])
                        self.assertEqual(cs,before);self.assertEqual(path.read_bytes(),before_bytes)
                        payload=v.payload_for(out)
                        self.assertNotIn(A,json.dumps(payload));self.assertNotIn(B,json.dumps(payload))
                        self.assertNotIn('fixture@example.org',json.dumps(payload))

    def test_uuid_cache_is_per_enrichment_and_caches_failures(self):
        for failing in (False,True):
            tool=Mock(side_effect=TimeoutError() if failing else lambda _:projected())
            cs=[c(1),c(2,None),c(3,None),c(4,B)]
            for _ in range(2):
                out=e.enrich(cs,request,tool,resolver=lambda _:A)
                self.assertTrue(all(x['lookupStatus']==('unavailable' if failing else 'inspected') for x in out))
            self.assertEqual([call.args[0]['orderId'] for call in tool.call_args_list],[A,B,A,B])

    def test_dossier_subprocesses_share_remaining_tool_budget(self):
        raw={'order':{'id':A},'events':[]}
        buf=io.StringIO();w=csv.writer(buf);w.writerow(['dossier']);w.writerow([json.dumps(raw)])
        runner=Mock(side_effect=[Mock(returncode=0,stdout=buf.getvalue()),Mock(returncode=0,stdout=json.dumps(projected()))])
        with tempfile.TemporaryDirectory() as td,patch.object(e.time,'monotonic',side_effect=[0,0,3]):
            e.inspect_dossier(c(),home=Path(td),runner=runner,budget=4)
        self.assertEqual([call.kwargs['timeout'] for call in runner.call_args_list],[4,1])

    def test_resolution_rejects_malformed_database_uuid_before_dossier_read(self):
        with tempfile.TemporaryDirectory() as td:
            home=Path(td);(home/'state').mkdir()
            (home/'state/brouillons-en-attente.json').write_text(json.dumps({'brouillons':[dict(id=17,client='fixture@example.org',statut='en_attente')]}))
            runner=Mock(return_value=Mock(returncode=0,stdout='id\nnot-a-uuid\n'))
            with self.assertRaisesRegex(ValueError,'invalid_order_link'):
                e.resolve_order_id(dict(c(oid=None),draftId=17),home=home,runner=runner)
            runner.assert_called_once()

    def test_fresh_delivery_vetoes_draft_and_long_draft_stays_truncated(self):
        x=c();x['kind']='draft';x['proposal']='x'*699+'…';x['limitations']=['text_limit','draft_text_limit']
        out=projected();out['context']['evidence']=out['context']['evidence']+[dict(id='event-1',at='2026-11-24T09:00:00Z',kind='delivery.final_image',status='sent',text='Envoyé')]
        cs=e.enrich([x],request,lambda _:out)
        self.assertIn('draft_semantics_unproven',cs[0]['limitations']);self.assertIn('draft_text_limit',cs[0]['limitations'])
        self.assertEqual(v.review(cs,decisions)[0]['decision'],'a_verifier')
    def test_planner_adapter_executes_only_valid_protocol_and_closes(self):
        import hermes_inference as ai
        raw=request(v.payload_for([c()]))
        message=Mock(content=raw,tool_calls=[]);adapter=Mock()
        adapter._build_responses_kwargs.return_value=({'input':[]},None,None)
        adapter.create.return_value=Mock(choices=[Mock(message=message)])
        client=Mock();client.chat.completions=adapter;aux=Mock();aux.resolve_provider_client.return_value=(client,'gpt-6-luna')
        self.assertEqual(ai.completion(v.payload_for([c()]),aux,planning=True),raw)
        self.assertIn('inspect_dossier',adapter.create.call_args.kwargs['messages'][0]['content'])
        client.close.assert_called_once()
        message.content='{"requests":[{"tool":"refund","candidateId":"candidate-1"}]}'
        with self.assertRaises(ValueError):ai.completion(v.payload_for([c()]),aux,planning=True)
    def test_real_tool_subprocess_and_actual_masked_projection(self):
        with tempfile.TemporaryDirectory() as td:
            home=Path(td);(home/'scripts').mkdir();(home/'state').mkdir()
            raw={'order':{'id':A,'status':'PAID','photo_urls':['group'],'own_count':1},'events':[{'at':'2026-11-23T09:00:00.123456Z','kind':'email.incoming','status':'recorded','body':'Contact secret@example.org +33 6 12 34 56 78 https://example.org/private'+' histoire.'*120,'orderIds':[A]}]}
            buf=io.StringIO();w=csv.writer(buf);w.writerow(['dossier']);w.writerow([json.dumps(raw)])
            code='import sys\nassert sys.argv[1]=="query"\nassert "SELECT" in sys.argv[2]\nsys.stdout.write('+repr(buf.getvalue())+')\n'
            (home/'scripts/db-tool.py').write_text(code)
            draft_path=home/'state/brouillons-en-attente.json'
            draft_path.write_text(json.dumps({'brouillons':[dict(id=8,commande=A,statut='en_attente',texte='Merci secret@example.org',cree_le='2026-11-20T09:00:00Z')]}))
            before=draft_path.read_bytes()
            out=e.inspect_dossier(c(),home=home)
            self.assertEqual(draft_path.read_bytes(),before)
            data=json.dumps(out)
            for secret in ['secret@example.org','https://example.org/private','+33 6 12 34 56 78']:self.assertNotIn(secret,data)
            self.assertEqual(out['context']['limitations'],[])
            self.assertEqual(len(out['drafts']),1)
            self.assertGreater(len(out['context']['evidence'][1]['text']),700)
            original=c();original['limitations']=['text_limit']
            enriched=e.enrich([original],request,lambda _:out)
            self.assertNotIn('text_limit',enriched[0]['limitations'])
            self.assertEqual(enriched[0]['lookupStatus'],'inspected')
            payload=v.payload_for(enriched)
            self.assertIn('relatedDrafts',payload['candidates'][0])
            self.assertNotIn(A,json.dumps(payload))
            self.assertEqual(v.review(enriched,decisions)[0]['decision'],'confirmer')
    def test_one_lookup_per_uuid_preserves_multiple_orders_same_person(self):
        cs=[c(1),c(2),c(3,B)];before=copy.deepcopy(cs)
        for x in cs:x['customer']='Tanguy fictif'
        lookup=Mock(return_value=projected());out=e.enrich(cs,request,lookup)
        self.assertEqual(lookup.call_count,2)
        self.assertEqual(len(out),3);self.assertEqual(len(p.action_lines(v.review(out,decisions))),2)
        self.assertEqual(before[0]['evidence'],cs[0]['evidence'])
    def test_forbidden_injected_tool_and_foreign_id_never_execute(self):
        bads=[{'requests':[{'tool':'send','candidateId':'candidate-1'}]}, {'requests':[{'tool':'inspect_dossier','candidateId':'candidate-999'}]}, {'requests':[{'tool':'inspect_dossier','candidateId':'candidate-1','sql':'DELETE'}]}]
        for bad in bads:
            lookup=Mock(side_effect=AssertionError())
            out=e.enrich([c()],lambda _:json.dumps(bad),lookup)
            lookup.assert_not_called();self.assertIn('lookup_agent_unavailable',out[0]['limitations'])
            self.assertEqual(v.review(out,decisions)[0]['decision'],'a_verifier')
        for raw in ['{"requests":[],"requests":[]}',json.dumps({'requests':[{'tool':'inspect_dossier','candidateId':'candidate-1'}]*9})]:
            with self.assertRaises(ValueError):e.validate_requests(raw,{'candidate-1'})
    def test_source_errors_are_concrete_not_generic_and_never_confirm(self):
        out=e.enrich([c()],request,Mock(side_effect=TimeoutError('secret')))
        reviewed=v.review(out,decisions)
        self.assertEqual(reviewed[0]['decision'],'a_verifier')
        text=' '.join(p.action_lines(reviewed))
        self.assertIn('lecture du dossier indisponible',text);self.assertNotIn('secret',text)
    def test_missing_uuid_and_sql_injection_rejected_before_process(self):
        runner=Mock(side_effect=AssertionError())
        for oid in [None,'abc',A+"';DELETE FROM orders;--"]:
            with self.assertRaises(ValueError):e.inspect_dossier(c(oid=oid),runner=runner)
        runner.assert_not_called()
    def test_round_budget_and_uninspected_blocked(self):
        cs=[c(i+1,f'{i+1:08x}-1111-4111-8111-111111111111') for i in range(20)]
        lookup=Mock(return_value=projected());planner=Mock(side_effect=request)
        out=e.enrich(cs,planner,lookup)
        self.assertEqual(planner.call_count,2);self.assertEqual(lookup.call_count,16)
        self.assertEqual(sum('lookup_not_requested' in x['limitations'] for x in out),4)
    def test_deadline_avoids_starting_a_lookup(self):
        ticks=iter([0,0,149]);lookup=Mock()
        out=e.enrich([c()],request,lookup,clock=lambda:next(ticks))
        lookup.assert_not_called();self.assertEqual(out[0]['lookupStatus'],'unavailable')
    def test_limitations_and_semantic_vetoes_preserved(self):
        x=c();x['limitations']=['text_limit','unassigned_multi_order_exchange','draft_semantics_unproven']
        out=e.enrich([x],request,lambda _:projected())
        self.assertEqual(v.review(out,decisions)[0]['decision'],'a_verifier')
        self.assertIn('plusieurs commandes',' '.join(p.action_lines(v.review(out,decisions))))
    def test_fictive_named_cases_show_wait_action_or_specific_blocker(self):
        cs=[c(i+1,f'{i+1:08x}-1111-4111-8111-111111111111') for i in range(4)]
        for x,name in zip(cs,['Kerly fictive','Tiffany fictive','Tanguy fictif','Nils fictif']):x['customer']=name
        cs[0]['evidence'][0]['text']=json.dumps({'previewStatus':'pending'})
        cs[0]['evidence'].append(dict(id='event-1',at='2026-11-23T09:00:00Z',kind='delivery.preview',status='sent',text='Aperçu envoyé'))
        cs[1]['limitations']=['draft_semantics_unproven'];cs[1]['kind']='draft'
        cs[3]['limitations']=['unassigned_multi_order_exchange']
        text=' '.join(p.action_lines(v.review(cs,decisions)))
        self.assertIn('Attente client',text);self.assertIn('portrait déjà envoyé',text)
        self.assertIn('Dessiner le portrait',text);self.assertIn('plusieurs commandes',text)
    def test_planner_subprocess_environment_has_no_business_secrets(self):
        with patch.dict(os.environ,{'DATABASE_URL':'secret','STRIPE_SECRET_KEY':'secret','TELEGRAM_BOT_TOKEN':'secret'}),patch.object(e.subprocess,'run',return_value=Mock(returncode=0,stdout='{}')) as run:
            e.plan(v.payload_for([c()]))
            self.assertFalse({'DATABASE_URL','STRIPE_SECRET_KEY','TELEGRAM_BOT_TOKEN'}&set(run.call_args.kwargs['env']))

if __name__=='__main__':unittest.main()
