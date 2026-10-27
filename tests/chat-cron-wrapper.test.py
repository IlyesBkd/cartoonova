import importlib.util
import sys
import types
import io
import contextlib
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'scripts/chat-telegram-cron.py'
spec = importlib.util.spec_from_file_location('chat_cron', PATH)
wrapper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wrapper)

class WrapperTests(unittest.TestCase):
    def test_subprocess_contract_and_timeout(self):
        calls = []
        class Proc:
            pid = 123456
            def __init__(self, timeout=False, code=0): self.timeout, self.code = timeout, code
            def wait(self, timeout=None):
                if timeout and self.timeout: raise subprocess.TimeoutExpired('node', timeout)
                return self.code
        def popen(*args, **kwargs):
            calls.append((args, kwargs)); return Proc()
        self.assertEqual(wrapper.run_worker(popen, {'DATABASE_URL':'fake'}), 0)
        self.assertEqual(calls[0][0][0], ['/usr/bin/node', str(Path(wrapper.ROOT) / 'scripts/chat-telegram-worker.mjs'), '--send'])
        self.assertEqual(calls[0][1]['stdout'], subprocess.DEVNULL)
        self.assertTrue(calls[0][1]['start_new_session'])
        self.assertEqual(wrapper.run_worker(lambda *a, **k: Proc(code=1)), 1)
        with patch.object(wrapper.os, 'killpg') as kill:
            self.assertEqual(wrapper.run_worker(lambda *a, **k: Proc(timeout=True)), 1)
            kill.assert_called_once()

    def test_vault_fallback_isolation_and_errors(self):
        module = types.ModuleType('hermes_cli.env_loader')
        package = types.ModuleType('hermes_cli'); package.__path__ = []
        def loader(*, hermes_home):
            self.assertEqual(hermes_home, wrapper.PROFILE)
            os.environ['TELEGRAM_BOT_TOKEN'] = 'synthetic-vault-token'
            os.environ['UNRELATED_VAULT_SECRET'] = 'synthetic-other'
            os.environ['DATABASE_URL'] = 'overwritten'
            print('synthetic-noise')
        module.load_hermes_dotenv = loader
        with patch.dict(sys.modules, {'hermes_cli': package, 'hermes_cli.env_loader': module}), \
             patch.dict(os.environ, {'DATABASE_URL':'original'}, clear=True), \
             patch.object(wrapper, 'destination', return_value='123'), \
             patch.object(wrapper, 'run_worker', return_value=0) as run, \
             patch.object(wrapper.sys, 'argv', ['wrapper']):
            out, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                self.assertEqual(wrapper.main(), 0)
            env = run.call_args.kwargs['env']
            self.assertEqual(env['CHAT_NOTIFY_TELEGRAM_TOKEN'], 'synthetic-vault-token')
            self.assertEqual(env['CHAT_NOTIFY_DATABASE_URL'], 'original')
            self.assertNotIn('UNRELATED_VAULT_SECRET', env)
            self.assertNotIn('TELEGRAM_BOT_TOKEN', env)
            self.assertEqual(dict(os.environ), {'DATABASE_URL':'original'})
            self.assertEqual(out.getvalue() + err.getvalue(), '')
            def fail(**kwargs):
                os.environ['UNRELATED_VAULT_SECRET'] = 'synthetic-other'
                raise RuntimeError('synthetic-sensitive-error')
            module.load_hermes_dotenv = fail
            with contextlib.redirect_stderr(err):
                self.assertEqual(wrapper.main(), 1)
            self.assertNotIn('synthetic', err.getvalue())
            self.assertEqual(dict(os.environ), {'DATABASE_URL':'original'})
            self.assertEqual(run.call_count, 1)
            module.load_hermes_dotenv = lambda **kw: None
            with contextlib.redirect_stderr(err):
                self.assertEqual(wrapper.main(), 1)
            self.assertEqual(run.call_count, 1)

    def test_explicit_token_wins_without_loader(self):
        with patch.dict(os.environ, {'CHAT_NOTIFY_TELEGRAM_TOKEN':'explicit'}, clear=True), \
             patch.object(wrapper, 'HERMES_SOURCE', '/nonexistent'):
            self.assertEqual(wrapper.telegram_token(), 'explicit')

    def test_destination_file(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)/'destination'; p.write_text('123\n'); p.chmod(0o600)
            self.assertEqual(wrapper.destination(str(p)), '123')
            p.chmod(0o644)
            with self.assertRaises(ValueError): wrapper.destination(str(p))
            p.chmod(0o600); p.write_text('-123')
            with self.assertRaises(ValueError): wrapper.destination(str(p))
            link = Path(d)/'link'; link.symlink_to(p)
            with self.assertRaises(OSError): wrapper.destination(str(link))

    def test_mapping_and_failure_silent(self):
        with patch.dict(os.environ, {'DATABASE_URL':'synthetic-db', 'CHAT_NOTIFY_TELEGRAM_TOKEN':'synthetic-token'}, clear=True), \
             patch.object(wrapper, 'destination', return_value='123'), \
             patch.object(wrapper, 'run_worker', return_value=0) as run, \
             patch.object(wrapper.sys, 'argv', ['wrapper']):
            self.assertEqual(wrapper.main(), 0)
            env=run.call_args.kwargs['env']
            self.assertEqual(env['CHAT_NOTIFY_DATABASE_URL'], 'synthetic-db')
            self.assertEqual(env['CHAT_NOTIFY_TRANSPORT'], 'telegram')
            self.assertEqual(env['CHAT_NOTIFY_TELEGRAM_CHAT_ID'], env['CHAT_NOTIFY_TELEGRAM_CONFIRMED_CHAT_ID'])
        result = subprocess.run(['/usr/bin/python3', str(PATH)], cwd='/',
                                env={'PATH':'/usr/bin', 'HOME':os.environ['HOME']}, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, '')
        self.assertNotIn('synthetic-db', result.stderr)

if __name__ == '__main__': unittest.main()
