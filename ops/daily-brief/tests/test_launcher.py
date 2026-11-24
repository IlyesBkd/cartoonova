import pathlib,subprocess,os,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class LauncherTests(unittest.TestCase):
    def test_runpy_from_scheduled_launcher_without_source_on_path(self):
        code='import runpy; m=runpy.run_path('+repr(str(ROOT/'run.py'))+'); assert callable(m["collect"]) and callable(m["review"]); print("OK")'
        env={k:os.environ[k] for k in ('PATH','HOME','TMPDIR') if k in os.environ}
        p=subprocess.run(['/usr/bin/python3','-I','-c',code],cwd='/',env=env,capture_output=True,text=True,timeout=10)
        self.assertEqual(p.returncode,0,p.stderr)
        self.assertEqual(p.stdout.strip(),'OK')
if __name__=='__main__':unittest.main()
