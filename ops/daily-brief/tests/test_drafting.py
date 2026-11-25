"""Offline hostile outputs and real Node masking -> agent prose -> pinned renderer."""
import copy
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock,patch
from test_verification import candidate,data,NOW,brief,ai,ROOT
import drafting as w
from verification import review
from enrichment import enrich

A='11111111-1111-4111-8111-111111111111'
B='22222222-2222-4222-8222-222222222222'


def cases():
    c=candidate();c.update(orderId=A,displayLabel='Jeanne',draftId='b3',decision='confirmer',finding='action',reason='supported')
    return [c]


def reply(p):
    return json.dumps({'lines':[dict(groupId=g['id'],section=g['section'],sourceIds=[next((s['id'] for s in g['sources'] if s['kind']=='limitation'),g['sources'][-1]['id'])],souci='Le portrait est encore à préparer.',suite='Vérifier les échanges récents avant la prochaine étape.') for g in p['groups']]},ensure_ascii=False)


class DraftingTests(unittest.TestCase):
    def test_actual_free_prose_is_rendered_not_fixed_phrase_selection(self):
        d=data(cases());before=copy.deepcopy(d);seen=[]
        def model(p):
            seen.append(p);r=json.loads(reply(p));r['lines'][0]['souci']='Le portrait de famille attend son premier coup de crayon.'
            r['lines'][0]['suite']='Préparer le portrait avec les photos présentes.'
            return json.dumps(r)
        d['agentDraft']=w.write(d,model)
        self.assertEqual(d['agentDraft']['status'],'agent')
        text=brief.render(d,NOW)
        self.assertIn('premier coup de crayon',text);self.assertIn('Préparer le portrait',text)
        self.assertIn('Jeanne · brouillon b3',text)
        for title in w.SECTIONS.values():self.assertIn(title,text)
        for value in [A,'Jeanne','finance','draftId','b3','orderId','customer','displayLabel']:
            self.assertNotIn(value,json.dumps(seen))
        del d['agentDraft'];self.assertEqual(d,before)

    def test_uuid_groups_never_common_names_or_missing_links(self):
        cs=cases();cs.extend([dict(cs[0],id='candidate-2',draftId='b5'),dict(cs[0],id='candidate-3',orderId=B,draftId='b7'),dict(cs[0],id='candidate-4',orderId=None,draftId='b17'),dict(cs[0],id='candidate-5',orderId=None,draftId='b18')])
        p,local,omitted=w.groups_for(dict(data(cs),morningDrafts=0))
        self.assertEqual(len(p['groups']),4);self.assertEqual(omitted,0)
        self.assertIn('b3, b5',local[0]['label']);self.assertIn('b7',local[1]['label'])
        self.assertNotIn(A,json.dumps(p));self.assertNotIn('Jeanne',json.dumps(p))

    def test_literal_malformed_uuid_not_normalized(self):
        cs=cases();cs[0]['orderId']=' '+A
        cs.append(dict(cs[0],id='candidate-2'))
        self.assertEqual(len(w.groups_for(dict(data(cs),morningDrafts=0))[0]['groups']),2)

    def test_reading_limits_force_inspection_and_must_be_cited(self):
        cs=cases();cs[0]['limitations']=['missing_order_for_draft'];cs[0]['finding']='awaiting_customer'
        p,_,_=w.groups_for(data(cs));self.assertEqual(p['groups'][0]['policy'],'inspect')
        r=json.loads(reply(p));r['lines'][0]['sourceIds']=['s1']
        with self.assertRaises(ValueError):w.validate_output(json.dumps(r),p)
        self.assertIn('aucune commande',json.dumps(p,ensure_ascii=False))
        self.assertNotIn('client inexistant',json.dumps(p,ensure_ascii=False))

    def test_missing_link_never_becomes_executable_from_name_or_model_confirmation(self):
        cs=cases();cs[0]['orderId']=None;cs[0]['limitations']=['context_unavailable']
        p,_,_=w.groups_for(data(cs));r=json.loads(reply(p));r['lines'][0]['suite']='Envoyer le portrait maintenant.'
        self.assertEqual(w.write(data(cs),lambda _:json.dumps(r))['status'],'unavailable')

    def test_waiting_is_separate_and_cannot_become_a_reminder(self):
        cs=cases();cs[0]['finding']='awaiting_customer'
        cs[0]['evidence'].append(dict(id='event-1',kind='email.outgoing',status='sent',at=NOW.isoformat(),text='Pouvez-vous confirmer votre aperçu ?'))
        p,_,_=w.groups_for(dict(data(cs),morningDrafts=0))
        self.assertEqual(p['groups'][0]['section'],'waiting')
        r=json.loads(reply(p));r['lines'][0].update(souci='Une réponse à la demande de confirmation est attendue.',suite='Attendre sa réponse ; vérifier les échanges à son retour.')
        d=dict(data(cs),morningDrafts=0);d['agentDraft']=w.write(d,lambda _:json.dumps(r))
        self.assertEqual(d['agentDraft']['status'],'agent')
        text=brief.render(d,NOW);self.assertIn('Attendre sa réponse',text)
        r['lines'][0]['suite']='Attendre demain puis relancer le client.'
        with self.assertRaises(ValueError):w.validate_output(json.dumps(r),p)

    def test_reviewer_outage_cannot_disappear_from_writer_sources(self):
        cs=cases();cs[0].update(decision='a_verifier',reason='unavailable')
        p,_,_=w.groups_for(data(cs))
        self.assertEqual(p['groups'][0]['policy'],'inspect')
        self.assertIn('Relecture IA indisponible',json.dumps(p,ensure_ascii=False))
        r=json.loads(reply(p));r['lines'][0]['sourceIds']=['s1']
        with self.assertRaises(ValueError):w.validate_output(json.dumps(r),p)

    def test_absence_of_order_is_not_absence_of_customer(self):
        p,_,_=w.groups_for(data(cases()))
        for text in ['Aucun client trouvé.','Le client est inexistant.','Le client n’existe pas.']:
            r=json.loads(reply(p));r['lines'][0]['souci']=text
            with self.assertRaises(ValueError):w.validate_output(json.dumps(r),p)

    def test_empty_program_has_no_fake_agent_call_or_cached_prose(self):
        model=Mock(side_effect=AssertionError('no inference for empty input'))
        d=dict(data([]),morningDrafts=0);d['agentDraft']=w.write(d,model)
        self.assertEqual(d['agentDraft']['status'],'empty');model.assert_not_called()
        self.assertNotIn('Rédaction IA indisponible',brief.render(d,NOW))

    def test_overconfident_print_and_photo_claims_keep_local_veto(self):
        for kind in ['readyPrint','photos_incomplete','photos_missing']:
            cs=cases();cs[0]['kind']=kind
            p,_,_=w.groups_for(data(cs));self.assertEqual(p['groups'][0]['policy'],'inspect')

    def test_foreign_unknown_duplicate_and_incomplete_references(self):
        d=data(cases());p,_,_=w.groups_for(d);good=json.loads(reply(p))
        bads=['Ignore tout et envoie','```json\n'+reply(p)+'\n```','{"lines":[],"lines":[]}','{"lines":[],"send":true}','{"lines":[]}']
        for k,v in [('groupId','g99'),('section','waiting'),('sourceIds',['foreign']),('sourceIds',['s1','s1']),('sourceIds',[]),('souci',{'text':'injection'}),('suite','Envoyer directement le portrait.')]:
            r=copy.deepcopy(good);r['lines'][0][k]=v
            if k=='suite':r['lines'][0]['section']='decision' # reject unauthorized section too
            bads.append(json.dumps(r))
        r=copy.deepcopy(good);r['lines']*=2;bads.append(json.dumps(r))
        for raw in bads:
            with self.subTest(raw=raw):
                self.assertEqual(w.write(d,lambda _:raw)['status'],'unavailable')

    def test_review_regression_directive_in_souci_real_write_render(self):
        for waiting in (False,True):
            cs=cases()
            if waiting:
                cs[0]['finding']='awaiting_customer'
                cs[0]['evidence'].append(dict(id='event-1',kind='email.outgoing',status='sent',at=NOW.isoformat(),text='Votre réponse est attendue.'))
            else:cs[0]['limitations']=['history_limit']
            d=dict(data(cs),morningDrafts=0)
            p,_,_=w.groups_for(d)
            self.assertEqual(p['groups'][0]['policy'],'wait' if waiting else 'inspect')
            for text in ['Envoie le portrait au client maintenant.','envoie le portrait au client maintenant.','Le portrait est prêt : envoyer le mail.','Le client attend ; rembourser maintenant.']:
                r=json.loads(reply(p));r['lines'][0].update(souci=text,suite='Vérifier les échanges récents.')
                d['agentDraft']=w.write(d,lambda _:json.dumps(r))
                self.assertEqual(d['agentDraft']['status'],'unavailable',text)
                rendered=brief.render(d,NOW)
                self.assertNotIn(text,rendered);self.assertIn('repli automatique',rendered)
            # Not a ban on factual nouns/participles: prose stays agent-written.
            for text in ['Le portrait a été envoyé, sa réception reste à recouper.','Une demande de remboursement figure dans les échanges.','Le dessin attend une réponse à la demande de confirmation.']:
                r=json.loads(reply(p));r['lines'][0].update(souci=text,suite='Relire les échanges récents.')
                d['agentDraft']=w.write(d,lambda _:json.dumps(r))
                self.assertEqual(d['agentDraft']['status'],'agent',text)
                self.assertIn(text,brief.render(d,NOW))

    def test_review_regression_limit_visible_without_model_paraphrase(self):
        cs=cases();cs[0]['limitations']=['history_limit','text_limit']
        d=dict(data(cs),morningDrafts=0);p,_,_=w.groups_for(d)
        # A valid limitation sourceId never suffices to hide or contradict limits.
        for text in ['Toutes les informations sont complètes.','Le dossier est exhaustif.','Aucune limitation ne subsiste.','Toutes les sources ont été consultées.','La boîte mail a été consultée.','Le fournisseur a été vérifié.']:
            for field in ('souci','suite'):
                r=json.loads(reply(p));r['lines'][0][field]=text if field=='souci' else 'Vérifier les échanges ; '+text.lower()
                d['agentDraft']=w.write(d,lambda _:json.dumps(r))
                self.assertEqual(d['agentDraft']['status'],'unavailable',text)
                rendered=brief.render(d,NOW)
                self.assertNotIn(text,rendered)
                self.assertIn('historique trop long pour la lecture bornée',rendered)
                self.assertIn('texte tronqué : original nécessaire',rendered)
        d['agentDraft']=w.write(d,reply)
        self.assertEqual(d['agentDraft']['status'],'agent')
        rendered=brief.render(d,NOW)
        self.assertIn('historique trop long pour la lecture bornée',rendered)
        self.assertIn('texte tronqué : original nécessaire',rendered)
        self.assertIn('Le portrait est encore à préparer.',rendered)
        self.assertLess(w.units(rendered),3900)

    def test_all_concrete_limits_fit_or_whole_dossier_is_explicitly_omitted(self):
        from presentation import BLOCKERS
        cs=[dict(cases()[0],id='candidate-'+str(i),orderId=f'{i:08x}-1111-4111-8111-111111111111',draftId='b'+str(i+1),limitations=list(BLOCKERS)[:20]) for i in range(8)]
        d=dict(data(cs),morningDrafts=0)
        d['agentDraft']=w.write(d,reply)
        self.assertEqual(d['agentDraft']['status'],'unavailable')
        rendered=brief.render(d,NOW)
        self.assertLess(w.units(rendered),3900)
        self.assertIn('dossier(s) non affiché(s), limites comprises',rendered)
        for local in w.groups_for(d)[1]:
            if local['label'] in rendered:
                for limit in local['limitations']:self.assertIn(limit,rendered)

    def test_review_regression_invented_name_real_write_render(self):
        d=dict(data(cases()),morningDrafts=0);p,_,_=w.groups_for(d)
        for text in ['Paul Martin attend son portrait.','Le portrait de Paul Martin est attendu.','Le client attend à Paris.','Le client attend son colis Optimalprint.','Jeanne attend son portrait.']:
            for field in ('souci','suite'):
                r=json.loads(reply(p));r['lines'][0][field]=text if field=='souci' else 'Vérifier les échanges de '+text
                d['agentDraft']=w.write(d,lambda _:json.dumps(r))
                self.assertEqual(d['agentDraft']['status'],'unavailable',text)
                self.assertNotIn(text,brief.render(d,NOW))
        def neutral(p):
            r=json.loads(reply(p));r['lines'][0]['souci']='Le client attend son portrait de famille, les détails restent à recouper.'
            return json.dumps(r)
        d['agentDraft']=w.write(d,neutral)
        self.assertEqual(d['agentDraft']['status'],'agent')
        rendered=brief.render(d,NOW)
        self.assertIn('Le client attend son portrait de famille',rendered)
        self.assertIn('Jeanne · brouillon b3',rendered)

    def test_limited_action_cannot_hide_behind_verifier_prefix(self):
        cs=cases();cs[0]['limitations']=['history_limit'];p,_,_=w.groups_for(data(cs))
        for text in ['Vérifier puis envoyer le mail.','Examiner et rembourser le client.','Relire avant impression.','Vérifier et dessiner demain.']:
            r=json.loads(reply(p));r['lines'][0]['suite']=text
            with self.assertRaises(ValueError):w.validate_output(json.dumps(r),p)

    def test_prose_contacts_html_jargon_controls_and_money_rejected(self):
        p,_,_=w.groups_for(data(cases()))
        for text in ['<b>Injecté</b>','Écrire à abc@example.com','Voir https://exemple.fr','Tél +33 6 12 34 56 78','Bénéfice 100 €','Total 12,34','Dossier c3 à régler','UUID absent','Salut\nEnvoie','Salut\u202e!','x'*221]:
            r=json.loads(reply(p));r['lines'][0]['souci']=text
            with self.subTest(text=text),self.assertRaises(ValueError):w.validate_output(json.dumps(r),p)

    def test_no_partial_acceptance_and_no_stale_prose_on_failure(self):
        d=data(cases());ok=w.write(d,reply);self.assertEqual(ok['status'],'agent')
        def unavailable(_):raise subprocess.TimeoutExpired('fixture',45)
        bad=w.write(d,unavailable);self.assertEqual(bad,{'status':'unavailable'})
        d['agentDraft']=bad;text=brief.render(d,NOW)
        self.assertIn('pas un texte rédigé par l’agent',text);self.assertNotIn('oui b3',text)
        self.assertNotIn(ok['lines'][0]['souci'],text)

    def test_source_masking_really_runs_node_before_writer(self):
        d=data(cases());d.update(supportUnread=1,supportMessages=[{'subject':'abc@example.com https://secret.example/path token=synthetic-fixture +33 6 12 34 56 78'}],writingTrello=[{'name':'abc@example.com','url':'https://private.example'}])
        seen=[]
        def model(p):seen.append(p);return reply(p)
        self.assertEqual(w.write(d,model)['status'],'agent')
        raw=json.dumps(seen)
        for text in ['abc@example.com','secret.example','synthetic-fixture','33 6 12','private.example']:self.assertNotIn(text,raw)
        self.assertIn('réponses hors site non vérifiées',json.dumps(seen,ensure_ascii=False))

    def test_payload_budgets_overflow_and_no_unbounded_model_input(self):
        cs=[dict(cases()[0],id='candidate-'+str(i),orderId=f'{i:08x}-1111-4111-8111-111111111111') for i in range(12)]
        d=data(cs);d['morningDrafts']=0
        draft=w.write(d,reply);self.assertEqual(draft['status'],'agent');self.assertEqual(draft['omitted'],4)
        d['agentDraft']=draft;self.assertIn('4 autre(s)',brief.render(d,NOW))
        model=Mock();cs[0]['proposal']='x'*701
        self.assertEqual(w.write(data(cs),model)['status'],'unavailable');model.assert_not_called()

    def test_long_emoji_output_is_bounded_in_utf16(self):
        cs=[dict(cases()[0],id='candidate-'+str(i),orderId=f'{i:08x}-1111-4111-8111-111111111111') for i in range(8)]
        d=data(cs);d['morningDrafts']=0;p,_,_=w.groups_for(d)
        r=json.loads(reply(p))
        for line in r['lines']:line.update(souci='😀'*160,suite='😀'*160)
        with self.assertRaises(ValueError):w.validate_output(json.dumps(r),p)
        self.assertLess(w.units(brief.render(dict(d,agentDraft=w.write(d,reply)),NOW)),3900)

    def test_finance_remains_exact_script_value_never_model_input(self):
        d=data(cases());d.update(finance={'month':dict(netCents=123456,costCents=789),'total':dict(netCents=234567,costCents=890)},financePrevTotal=230000)
        seen=[]
        def model(p):seen.append(p);return reply(p)
        d['agentDraft']=w.write(d,model);text=brief.render(d,NOW)
        self.assertIn(brief.euros(brief.profit(d['finance'],'month')),text)
        self.assertIn(brief.euros(brief.profit(d['finance'],'total')),text)
        for v in ['123456','234567','230000','finance']:self.assertNotIn(v,json.dumps(seen))

    def test_subprocess_has_no_business_secrets(self):
        with patch.dict(os.environ,{'DATABASE_URL':'secret','STRIPE_SECRET_KEY':'secret','TELEGRAM_BOT_TOKEN':'secret'}),patch.object(w.subprocess,'run',return_value=Mock(returncode=0,stdout='ok')) as run:
            self.assertEqual(w.infer({'version':1,'groups':[]}),'ok')
            self.assertIn('--write',run.call_args.args[0]);self.assertEqual(run.call_args.kwargs['timeout'],45)
            self.assertFalse({'DATABASE_URL','STRIPE_SECRET_KEY','TELEGRAM_BOT_TOKEN'}&set(run.call_args.kwargs['env']))

    def test_writer_uses_real_existing_adapter_without_tools(self):
        p,_,_=w.groups_for(data(cases()));adapter=Mock();adapter._build_responses_kwargs.return_value=({'input':[]},None,None)
        adapter.create.return_value=Mock(choices=[Mock(message=Mock(content=reply(p),tool_calls=[]))])
        client=Mock();client.chat.completions=adapter;aux=Mock();aux.resolve_provider_client.return_value=(client,'gpt-6-luna')
        self.assertEqual(ai.completion(p,aux,writing=True),reply(p));client.close.assert_called_once()
        args=adapter.create.call_args.kwargs;self.assertNotIn('tools',args);self.assertIn('rédiges toi-même',args['messages'][0]['content'])

    def test_runtime_relocated_writer_and_runpy_import_from_root(self):
        with tempfile.TemporaryDirectory() as td:
            import shutil
            for name in ['run.py','drafting.py','enrichment.py','verification.py','presentation.py','hermes_inference.py','redaction.mjs']:
                shutil.copy(ROOT/name,Path(td)/name)
            code="import runpy; m=runpy.run_path("+repr(str(Path(td)/'run.py'))+"); assert callable(m['write']); print('OK')"
            p=subprocess.run(['/usr/bin/python3','-I','-c',code],cwd='/',capture_output=True,text=True,timeout=10)
            self.assertEqual(p.returncode,0,p.stderr)

    def test_real_js_projection_search_review_writer_renderer(self):
        script="import {A,NOW,order,draft,empty} from './tests/fixtures.mjs';import {projectOrderContext,makeCandidates} from './evidence.mjs';console.log(JSON.stringify(makeCandidates(empty(),[draft({id:3})],{[A]:projectOrderContext(order(),[],{observedAt:NOW})})));"
        cs=json.loads(subprocess.run(['/usr/bin/node','--input-type=module','-e',script],cwd=ROOT,capture_output=True,text=True,check=True).stdout)
        cs=review(enrich(cs,inference=lambda _: '{"requests":[]}'),lambda p:json.dumps({'decisions':[dict(id=c['id'],decision='a_verifier',reason='insufficient',finding='unknown',evidenceIds=[]) for c in p['candidates']]}))
        d=data(cs);d['agentDraft']=w.write(d,reply)
        self.assertEqual(d['agentDraft']['status'],'agent');text=brief.render(d,NOW)
        self.assertIn('Vérifier les échanges récents',text);self.assertNotIn('oui ',text);self.assertNotIn('Dossier c',text)


if __name__=='__main__':unittest.main()
