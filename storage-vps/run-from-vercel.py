#!/usr/bin/env python3
"""Load the storage signing secret in memory using the existing Vercel login.

Run as hermes. No secret is printed, passed on argv or written to a file.
Only the Cartoonova project and the dedicated storage variable are queried.
"""
import json
import os
from pathlib import Path
import subprocess
import sys

PROJECT = "prj_OItbZywQrhwg8mMJ3F4fD5CLbaPa"
TEAM = "team_GocTCkQ7A12gkTJxTkyfE0qD"
VERCEL = "/home/hermes/.local/bin/vercel"
SCRIPT = Path(__file__).resolve().with_name("server.py")


def api(endpoint):
    result = subprocess.run([VERCEL, "api", endpoint, "--raw"], capture_output=True, text=True, timeout=40)
    if result.returncode:
        raise RuntimeError("Vercel secret access unavailable")
    try:
        return json.loads(result.stdout)
    except (ValueError, TypeError):
        raise RuntimeError("Invalid secret provider response") from None


def load_secret():
    data = api(f"/v10/projects/{PROJECT}/env?teamId={TEAM}")
    candidates = [item for item in data.get("envs", []) if item.get("key") == "STORAGE_HMAC_SECRET" and "production" in item.get("target", [])]
    if len(candidates) != 1:
        raise RuntimeError("Dedicated storage secret not provisioned")
    item = api(f"/v1/projects/{PROJECT}/env/{candidates[0]['id']}?teamId={TEAM}")
    value = item.get("value")
    if not isinstance(value, str) or len(value.encode()) < 32:
        raise RuntimeError("Dedicated storage secret unavailable")
    return value


def main():
    try:
        secret = load_secret()
        env = {
            "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
            "HOME": "/home/hermes",
            "STORAGE_HMAC_SECRET": secret,
            "STORAGE_ROOT": os.environ["STORAGE_ROOT"],
            "STORAGE_PORT": os.environ.get("STORAGE_PORT", "8765"),
            "STORAGE_CORS_ORIGINS": "https://www.cartoonova.com,https://cartoonova.com",
            "PYTHONDONTWRITEBYTECODE": "1",
        }
        os.execve(sys.executable, [sys.executable, "-B", str(SCRIPT)], env)
    except Exception:
        print("Cartoonova storage startup refused: configuration or secret provider unavailable.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
