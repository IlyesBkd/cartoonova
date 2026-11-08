import importlib.util
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("storage_launcher", Path(__file__).with_name("run-from-vercel.py"))
assert SPEC is not None and SPEC.loader is not None
launcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(launcher)


class LauncherTests(unittest.TestCase):
    def test_only_dedicated_production_secret_queried_no_argv_secret(self):
        synthetic = "synthetic-test-value-" * 3
        replies = [
            subprocess.CompletedProcess([], 0, json.dumps({"envs": [
                {"key": "STORAGE_HMAC_SECRET", "id": "preview", "target": ["preview"]},
                {"key": "UNRELATED", "id": "other", "target": ["production"]},
                {"key": "STORAGE_HMAC_SECRET", "id": "chosen", "target": ["production"]},
            ]}), ""),
            subprocess.CompletedProcess([], 0, json.dumps({"value": synthetic}), ""),
        ]
        with patch.object(launcher.subprocess, "run", side_effect=replies) as run:
            self.assertEqual(launcher.load_secret(), synthetic)
        self.assertEqual(run.call_count, 2)
        self.assertIn("/env/chosen?", run.call_args_list[1].args[0][2])
        self.assertNotIn(synthetic, repr(run.call_args_list))

    def test_missing_or_ambiguous_secret_fails_closed(self):
        for envs in [[], [{"key": "STORAGE_HMAC_SECRET", "id": str(i), "target": ["production"]} for i in range(2)]]:
            with patch.object(launcher, "api", return_value={"envs": envs}):
                with self.assertRaises(RuntimeError):
                    launcher.load_secret()

    def test_provider_failure_never_reflects_provider_stderr(self):
        with patch.object(launcher.subprocess, "run", return_value=subprocess.CompletedProcess([], 1, "", "synthetic-private-error")):
            with self.assertRaisesRegex(RuntimeError, "^Vercel secret access unavailable$"):
                launcher.api("/ignored")

    def test_exec_injects_secret_only_in_child_environment(self):
        synthetic = "synthetic-runtime-value-" * 3
        with patch.object(launcher, "load_secret", return_value=synthetic), patch.dict(launcher.os.environ, {"STORAGE_ROOT": "/synthetic/private"}), patch.object(launcher.os, "execve") as execute:
            launcher.main()
        executable, argv, env = execute.call_args.args
        self.assertNotIn(synthetic, repr(argv))
        self.assertEqual(env["STORAGE_HMAC_SECRET"], synthetic)
        self.assertEqual(env["STORAGE_ROOT"], "/synthetic/private")
        self.assertNotIn("DATABASE_URL", env)


if __name__ == "__main__":
    unittest.main()
