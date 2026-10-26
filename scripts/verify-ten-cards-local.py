"""Isolated local Next verification. Never loads Hermes secrets or production DB."""
from pathlib import Path
import os,subprocess,socket,tempfile,json,time,urllib.request,gzip,zlib
root=Path(__file__).resolve().parents[1]
# Fail closed before touching artifacts, starting services, or letting Next load files.
if any(root.glob('.env*')):
 raise SystemExit('Refusing isolated build: .env* entries present')
tsconfig_before=(root/'tsconfig.json').read_bytes()
out=Path(tempfile.mkdtemp(prefix='next-ten-review-',dir='/home/hermes/.hermes/profiles/cartoonova/cache'))
run=Path(tempfile.mkdtemp(prefix='ten-build-',dir=os.environ['TMPDIR']))
env={k:os.environ[k] for k in ('PATH','HOME','TMPDIR','LANG','PLAYWRIGHT_BROWSERS_PATH') if k in os.environ}
pg=Path('/usr/lib/postgresql/18/bin')
def call(args,**kw):
 r=subprocess.run([str(x) for x in args],env=kw.pop('env',env),capture_output=True,text=True,timeout=120,**kw)
 if r.returncode: print(r.stdout[-3000:]+r.stderr[-3000:],flush=True)
 r.check_returncode();return r

def port():
 with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
p=port();assert p!=5432
started=False;server=None;results={}
try:
 call([pg/'initdb','-D',run/'pg','-U','cartoonova_build','--auth=trust','--no-locale','--encoding=UTF8'])
 call([pg/'pg_ctl','-D',run/'pg','-l',run/'pg.log','-o',f'-h 127.0.0.1 -p {p} -k {run}','-w','start']);started=True
 pe={**env,'PGHOST':'127.0.0.1','PGPORT':str(p),'PGDATABASE':'postgres','PGUSER':'cartoonova_build'}
 schema=Path('/home/hermes/.hermes/profiles/cartoonova/cache/e2e-purchase-2026-10-25/schema-only.sql').read_text().replace('CREATE SCHEMA public;','-- existing schema')
 call([pg/'psql','-X','-v','ON_ERROR_STOP=1'],env=pe,input=schema)
 migrations=['2026-10-email-outbox.sql','20261025_upload_quotas.sql','20261025_promo_reservations.sql','2026-10-resend-webhook.sql','20261025_admin_sessions.sql','20261025_order_notification_versions.sql','20261026_order_delivery_effects.sql','20261026_gift_language.sql']
 for f in migrations:call([pg/'psql','-X','-v','ON_ERROR_STOP=1','-f',root/'migrations'/f],env=pe)
 be={**env,'DATABASE_URL':f'postgresql://cartoonova_build@127.0.0.1:{p}/postgres','STRIPE_SECRET_KEY':'sk_test_synthetic_build_only_not_valid','RESEND_API_KEY':'re_synthetic_build_only','NEXT_PUBLIC_POSTHOG_KEY':'phc_synthetic_local_only','NEXT_TELEMETRY_DISABLED':'1','FINAL_IMAGE_STORAGE_ORIGIN':'https://synthetic.public.blob.vercel-storage.com','CARTOONOVA_BUILD_DIR':'.next-ten-local'}
 for name,args in [('lint',['npm','run','lint']),('build',['npm','run','build'])]:
  with (out/(name+'.log')).open('w') as log:r=subprocess.run(args,cwd=root,env=be if name=='build' else env,stdout=log,stderr=subprocess.STDOUT,text=True,timeout=240)
  results[name+'Exit']=r.returncode;print(json.dumps(results),flush=True);r.check_returncode()
 # Exact synthetic sensitive-value scan, including compressed bundles. No values or matching bytes in report.
 needles=[be[k].encode() for k in ['STRIPE_SECRET_KEY','RESEND_API_KEY']];leaks=[];scanned=0
 for f in (root/'.next-ten-local').rglob('*'):
  if not f.is_file():continue
  data=f.read_bytes();scanned+=1
  if f.suffix=='.gz':data=gzip.decompress(data)
  elif f.suffix=='.br':
   try:
    import brotli;data=brotli.decompress(data)
   except ImportError:raise RuntimeError('brotli decoder required')
  if any(n in data for n in needles):leaks.append(str(f.relative_to(root)))
 results['secretScan']={'files':scanned,'leakedPaths':leaks,'exactSyntheticValues':True};assert not leaks
 sp=port()
 with (out/'server.log').open('w') as log:
  server=subprocess.Popen(['node','node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',str(sp)],cwd=root,env=be,stdout=log,stderr=subprocess.STDOUT)
  for _ in range(100):
   try:
    with socket.create_connection(('127.0.0.1',sp),timeout=.2):break
   except OSError:time.sleep(.1)
  origin=f'http://127.0.0.1:{sp}';checks=[]
  for lang in ['fr','en','de','es','it','nl','pl','sv','da','pt']:
   for suffix in ['collections','cadeau']:
    with urllib.request.urlopen(origin+f'/{lang}/{suffix}',timeout=20) as response:
     body=response.read();assert response.status==200;assert b'consentement-titre' not in body;assert response.headers.get('Content-Security-Policy');checks.append({'path':f'/{lang}/{suffix}','status':response.status})
  for _ in range(2):
   with urllib.request.urlopen(origin+'/sitemap.xml',timeout=20) as response:
    body=response.read();assert b'<lastmod>' not in body
  results['http']=checks;results['stableStaticLastmodOmitted']=True
  browser=call(['node','scripts/verify-ten-cards-browser.mjs'],cwd=root,env={**env,'ORIGIN':origin,'OUT':str(out)})
  (out/'browser.log').write_text(browser.stdout);print(browser.stdout,flush=True);results['browserExit']=0
finally:
 (root/'tsconfig.json').write_bytes(tsconfig_before)
 if server:
  server.terminate()
  try:server.wait(timeout=10)
  except subprocess.TimeoutExpired:server.kill();server.wait()
 if started:call([pg/'pg_ctl','-D',run/'pg','-m','fast','-w','stop'])
 results['disposableDatabaseStopped']=True;results['serverStopped']=server is None or server.poll() is not None
 (out/'build-verification.json').write_text(json.dumps(results,indent=2))
 print(json.dumps(results),flush=True)
