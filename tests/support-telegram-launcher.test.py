import contextlib
import importlib.util
import io
import logging
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('relay_launcher', ROOT / 'scripts/support-telegram-listener.py')
if spec is None or spec.loader is None:
    raise RuntimeError('Test launcher module missing')
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class LauncherTests(unittest.TestCase):
    def run_main(self, values, args=None):
        module = types.ModuleType('hermes_cli.env_loader')
        setattr(module, 'load_hermes_dotenv', lambda **kwargs: os.environ.update(values))
        original_path = sys.path[:]
        original_logging = logging.root.manager.disable
        stderr = io.StringIO()
        try:
            with patch.dict(os.environ, {'HOME': '/home/hermes'}, clear=True), \
                    patch.dict(sys.modules, {'hermes_cli.env_loader': module}), \
                    patch.object(sys, 'argv', args or ['launcher']), \
                    patch.object(os, 'execve') as execute, patch.object(os, 'chdir'), \
                    contextlib.redirect_stderr(stderr):
                result = launcher.main()
            return result, execute, stderr.getvalue()
        finally:
            sys.path[:] = original_path
            logging.disable(original_logging)

    def test_only_selected_configuration_reaches_process_in_memory(self):
        result, execute, error = self.run_main({'DATABASE_URL': 'synthetic-database', 'TELEGRAM_BOT_TOKEN': 'synthetic-token', 'UNRELATED_SECRET': 'never-forwarded'})
        self.assertIsNone(result)
        command, args, env = execute.call_args.args
        self.assertEqual(command, '/usr/bin/node')
        self.assertEqual(env['CHAT_NOTIFY_DATABASE_URL'], 'synthetic-database')
        self.assertEqual(env['CHAT_NOTIFY_TELEGRAM_TOKEN'], 'synthetic-token')
        self.assertNotIn('UNRELATED_SECRET', env)
        self.assertEqual(error, '')

    def test_missing_configuration_stays_generic(self):
        result, execute, error = self.run_main({'UNRELATED_SECRET': 'private-value'})
        self.assertEqual(result, 1)
        execute.assert_not_called()
        self.assertNotIn('private-value', error)

    def test_unit_uses_hermes_environment_for_dotenv_dependency(self):
        unit = (ROOT / 'ops/cartoonova-telegram-listener.service').read_text()
        self.assertNotIn('ExecStart=/usr/bin/python3 ', unit)
        self.assertIn('/venv/bin/python3 ', unit)
        self.assertNotIn('EnvironmentFile=', unit)


if __name__ == '__main__':
    unittest.main()
