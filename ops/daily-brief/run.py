#!/usr/bin/env python3
"""Daily private briefing. Read-only business sources, user-only Telegram."""
import contextlib,datetime,fcntl,html,json,os,pathlib,subprocess,sys,urllib.request,urllib.parse
from zoneinfo import ZoneInfo
SOURCE=pathlib.Path(__file__).resolve().parent
# Scheduled launchers use runpy.run_path; their sys.path is not this directory.
if str(SOURCE) not in sys.path:sys.path.insert(0,str(SOURCE))
from verification import review
from enrichment import enrich
HOME=pathlib.Path('/home/hermes/.hermes/profiles/cartoonova')
HERE=HOME/'artifacts/daily-brief'
CHAT='5303154438'; BOARD='6ab6fd8ae6f060ac44bc93cc'; TODO='6ade22e9e6aee27e48668dc1'
PARIS=ZoneInfo('Europe/Paris')
def due(now): return now.astimezone(PARIS).hour==10 and now.astimezone(PARIS).minute<10
def clean(value,n=95): return html.escape(' '.join(str(value or '').split())[:n])
def secrets():
 with open(os.devnull,'w') as sink,contextlib.redirect_stdout(sink),contextlib.redirect_stderr(sink):
  from hermes_cli.env_loader import load_hermes_dotenv
  load_hermes_dotenv(hermes_home=str(HOME))
 for key in ['DATABASE_URL','TELEGRAM_BOT_TOKEN','TRELLO_API_KEY','TRELLO_TOKEN']:
  if not os.getenv(key):raise RuntimeError('Configuration manquante: '+key)
def request(url,data=None):
 req=urllib.request.Request(url,data=None if data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json'},method='GET' if data is None else 'POST')
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return json.load(r)
 except Exception:raise RuntimeError('Requête distante échouée; vérifier sans renvoi aveugle') from None
def tg(method,data):
 r=request('https://api.telegram.org/bot'+os.environ['TELEGRAM_BOT_TOKEN']+'/'+method,data)
 if not r.get('ok'):raise RuntimeError('Telegram a refusé '+method)
 return r['result']
def trello(path):
 q=urllib.parse.urlencode({'key':os.environ['TRELLO_API_KEY'],'token':os.environ['TRELLO_TOKEN']})
 return request('https://api.trello.com/1/'+path+'?'+q)
def apply_resolutions(data,resolutions):
 resolved={(r['orderId'],r['type']) for r in resolutions}
 data['alerts']=[a for a in data['alerts'] if (a['orderId'],a['type']) not in resolved]
 if 'reviewCandidates' in data:data['reviewCandidates']=[c for c in data['reviewCandidates'] if (c['orderId'],c['kind']) not in resolved]
 return data

def apply_support_exclusions(data,exclusions):
 excluded={str(r['messageId']) for r in exclusions}
 data['supportMessages']=[message for message in data['supportMessages'] if str(message['id']) not in excluded]
 data['supportUnread']=len(data['supportMessages'])
 return data

def collect(finance=True):
 env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR','DATABASE_URL'] if k in os.environ}
 drafts_path=HOME/'state/brouillons-en-attente.json'
 drafts=[{k:b.get(k) for k in ('id','client','langue','objet','commande','canal','texte','cree_le')} for b in (json.loads(drafts_path.read_text())['brouillons'] if drafts_path.exists() else []) if b.get('statut')=='en_attente']
 p=subprocess.run(['/usr/bin/node',str(SOURCE/'collect.mjs')],input=json.dumps({'drafts':drafts}),env=env,capture_output=True,text=True,timeout=60,cwd='/home/hermes/projects/cartoonova')
 if p.returncode:raise RuntimeError('Lecture commandes/support échouée')
 data=json.loads(p.stdout)
 resolutions=HERE/'resolved-alerts.json'
 if resolutions.exists():apply_resolutions(data,json.loads(resolutions.read_text()))
 exclusions=HERE/'excluded-support.json'
 if exclusions.exists():apply_support_exclusions(data,json.loads(exclusions.read_text()))
 finance_env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR','DATABASE_URL','STRIPE_SECRET_KEY'] if k in os.environ}
 if not finance:data['finance']=None
 else:
  try:
   f=subprocess.run(['/usr/bin/node',str(SOURCE/'finance.mjs')],env=finance_env,capture_output=True,text=True,timeout=150,cwd='/home/hermes/projects/cartoonova')
   data['finance']=json.loads(f.stdout) if f.returncode==0 else None
  except (subprocess.TimeoutExpired,ValueError):data['finance']=None
 # Review text is redacted by the shared JS projection; source drafts stay untouched.
 data['verifiedCandidates']=review(enrich(data.get('reviewCandidates',[])))
 morning=HOME/'state/support-drafts.json'
 try:
  md=json.loads(morning.read_text()) if morning.exists() else {}
  today=datetime.datetime.now(PARIS).date().isoformat()
  data['morningDrafts']=len([b for b in md.get('brouillons',[]) if b.get('statut')=='à valider']) if md.get('date')==today else 0
 except ValueError:data['morningDrafts']=0
 board=trello('boards/'+BOARD)
 if board['prefs']['permissionLevel']!='private':raise RuntimeError('Tableau non privé')
 lists=trello('boards/'+BOARD+'/lists')
 if not any(l['id']==TODO and l['name']=='Cartoonova — À faire' for l in lists):raise RuntimeError('Liste inconnue')
 cards=trello('boards/'+BOARD+'/cards/all')
 cards=[c for c in cards if not c['closed'] and c['idList']==TODO]
 def rank(c):
  import re
  m=re.search(r'\[P([0-9])\]',c['name']);return (int(m[1]) if m else 9,c['pos'])
 data['trello']=sorted(cards,key=rank)
 return data
LANGS={'fr':'français','en':'anglais','it':'italien','es':'espagnol','de':'allemand','pt':'portugais','nl':'néerlandais','pl':'polonais','sv':'suédois','da':'danois'}
def euros(cents):
 from decimal import Decimal
 return format(Decimal(cents)/100,',.2f').replace(',',' ').replace('.',',')+' €'
def profit(finance,key):
 b=finance[key];return b['netCents']+b.get('fallbackRevenueCents',0)-b['costCents']
def render(d,now,test=False):
 import re
 local=now.astimezone(PARIS)
 label=local.strftime('%d/%m')
 lines=['<b>☀️ TON PROGRAMME · '+label+'</b>'+(' <i>· test</i>' if test else ''),'']
 lines+=['<b>💰 BÉNÉFICE ESTIMÉ</b>']
 finance=d.get('finance')
 if finance:
  for key,title in [('month','Ce mois'),('total','Total')]:lines+=['• '+title+' : <b>'+euros(profit(finance,key))+'</b>']
  prev=d.get('financePrevTotal')
  if prev is not None:
   delta=profit(finance,'total')-prev
   lines+=['• Depuis hier : '+('+' if delta>=0 else '')+euros(delta)]
 else:lines+=['• Ce mois : <b>indisponible</b>','• Total : <b>indisponible</b>']
 lines+=['']
 lines+=['<b>🔎 CE QU’IL RESTE À FAIRE</b>']
 verified=d.get('verifiedCandidates')
 if verified is None:
  # No legacy path can quietly expose an unchecked action as ready to send.
  lines+=['• À vérifier — relecture indisponible ; consulter les commandes et brouillons.']
 else:
  from presentation import action_lines
  lines+=action_lines(verified)
 if d.get('morningDrafts'):lines+=['','✉️ <b>Brouillons du matin</b> : '+str(d['morningDrafts'])+' non vérifiés — relire l’historique avant validation.']
 if d['supportUnread']:
  lines+=['','<b>💬 MESSAGES À TRIER · '+str(d['supportUnread'])+'</b>','<i>Non lus sur le site ; réponses hors site non vérifiées.</i>']
  messages=d.get('supportMessages',[])
  for message in messages[:10]:
   date=datetime.datetime.fromisoformat(message['received_at'].replace('Z','+00:00')).astimezone(PARIS).strftime('%d/%m %H:%M')
   subject=re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '[email masqué]',message.get('subject') or 'Sans objet')
   lines+=['• #'+str(message['id'])+' · '+date+' — '+clean(subject,100)]
  if len(messages)>10:lines+=['• +'+str(len(messages)-10)+' autres messages dans l’admin.']
 if d['trello'] and (local.weekday()==0 or test):  # 14/11: Trello once a week (Monday)
  lines+=['','<b>📌 CETTE SEMAINE · TRELLO</b>']
  for c in d['trello'][:3]:
   title=re.sub(r'\[[^\]]+\]\s*','',c['name']).strip()
   lines+=['• <a href="'+html.escape(c['url'],quote=True)+'">'+clean(title,95)+'</a>']
 result='\n'.join(lines)
 if len(result.encode('utf-16-le'))//2>3900:raise RuntimeError('Récap trop long')
 return result
def save(state):
 tmp=HERE/'state.new';tmp.write_text(json.dumps(state));tmp.chmod(0o600);tmp.replace(HERE/'state.json')
def publish(text,key,state,api=tg,persist=save):
 entry=state.setdefault('runs',{}).get(key)
 if entry and entry['status']=='done':return {'duplicate':True,'message_id':entry['message_id']}
 if entry and not entry.get('message_id'):raise RuntimeError('Envoi incertain : pas de réessai automatique')
 if not entry:
  entry={'status':'sending'};state['runs'][key]=entry;persist(state)
  sent=api('sendMessage',{'chat_id':CHAT,'text':text,'parse_mode':'HTML','disable_web_page_preview':True,'protect_content':False,'disable_notification':False})
  if str(sent['chat']['id'])!=CHAT:raise RuntimeError('Destination non concordante')
  entry.update(message_id=sent['message_id'],status='sent');persist(state)
 mid=entry['message_id']
 api('pinChatMessage',{'chat_id':CHAT,'message_id':mid,'disable_notification':True})
 check=api('getChat',{'chat_id':CHAT})
 if check.get('pinned_message',{}).get('message_id')!=mid:raise RuntimeError('Épinglage non vérifié')
 previous=state.get('pinned_message_id')
 if previous and previous!=mid:
  api('unpinChatMessage',{'chat_id':CHAT,'message_id':previous})
  check=api('getChat',{'chat_id':CHAT})
  if check.get('pinned_message',{}).get('message_id')!=mid:raise RuntimeError('Nouvelle épingle non vérifiée')
 state['pinned_message_id']=mid;entry.update(status='done',digest=digest(text));persist(state)
 return {'verified':True,'message_id':mid,'pinned':True}
def digest(text):
 import hashlib
 return hashlib.sha256(text.encode()).hexdigest()
def refresh(text,key,state,now,api=tg,persist=save):
 # Edits today's pinned brief in place, silently, when the day's events changed it.
 entry=state.get('runs',{}).get(key)
 if not entry or entry.get('status')!='done' or state.get('pinned_message_id')!=entry.get('message_id'):return {'skipped':'pas de récap épinglé aujourd’hui'}
 if entry.get('digest')==digest(text):return {'unchanged':True}
 stamped=text+'\n\n<i>🔄 Mis à jour à '+now.astimezone(PARIS).strftime('%H:%M')+'</i>'
 api('editMessageText',{'chat_id':CHAT,'message_id':entry['message_id'],'text':stamped,'parse_mode':'HTML','link_preview_options':{'is_disabled':True}})
 check=api('getChat',{'chat_id':CHAT})
 if check.get('pinned_message',{}).get('message_id')!=entry['message_id']:raise RuntimeError('Épinglage non vérifié')
 entry['digest']=digest(text);entry['refreshed_at']=now.isoformat();persist(state)
 return {'updated':True,'message_id':entry['message_id']}
def main(force=False,preview=False,update=False):
 os.umask(0o077);now=datetime.datetime.now(datetime.timezone.utc)
 if not force and not preview and not update and not due(now):return
 HERE.mkdir(parents=True,exist_ok=True)
 with open(HERE/'lock','a') as lock:
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:
   if update:return  # the 10h brief is being sent; the next refresh will catch up
   raise
  secrets()
  path=HERE/'state.json';state=json.loads(path.read_text()) if path.exists() else {}
  key=('test-' if force else '')+now.astimezone(PARIS).date().isoformat()
  # Stripe is read once, for the 10h brief; refreshes reuse that figure.
  cached=state.get('finance',{}).get(key) if update else None
  data=collect(finance=cached is None)
  if cached is not None:data['finance']=cached
  day=now.astimezone(PARIS).date()
  totals=state.get('finance_totals',{})
  data['financePrevTotal']=totals.get((day-datetime.timedelta(days=1)).isoformat())
  text=render(data,now,force)
  if preview:print(text);return
  if cached is None and data['finance'] is not None:
   state['finance']={key:data['finance']}
   if not force:
    totals[day.isoformat()]=profit(data['finance'],'total')
    state['finance_totals']={k:v for k,v in sorted(totals.items())[-14:]}
   save(state)
  result=refresh(text,key,state,now) if update else publish(text,key,state)
  print(json.dumps(result))
if __name__=='__main__':
 try:main(force='--test' in sys.argv,preview='--preview' in sys.argv,update='--refresh' in sys.argv)
 except Exception as e:
  print('Daily brief failed: '+type(e).__name__,file=sys.stderr);sys.exit(1)
