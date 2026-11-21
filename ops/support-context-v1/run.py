#!/usr/bin/env python3
"""Contextual support relay; existing dedup state, no customer email sender."""
import importlib.util
import contextlib
import os
import pwd
import signal
import subprocess
import sys
import time
import fcntl

ROOT = '/home/hermes/.hermes/profiles/cartoonova/artifacts/support-context-v1'
STATE_ROOT = '/home/hermes/.hermes/profiles/cartoonova/artifacts/support-email-local-v2'

def load_chat():
    spec = importlib.util.spec_from_file_location('chat_cron', '/home/hermes/projects/cartoonova/scripts/chat-telegram-cron.py')
    if spec is None or spec.loader is None:
        raise RuntimeError('chat wrapper unavailable')
    chat = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(chat)
    return chat

def launch(env):
    process = subprocess.Popen(['/usr/bin/node', ROOT + '/worker.mjs', '--send'], cwd='/home/hermes/projects/cartoonova', env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    try:
        return process.wait(timeout=150)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait()
        return 1

def uncertain_alert():
    fd = os.open(STATE_ROOT + '/uncertain-alert', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'r+') as file:
        fcntl.flock(file, fcntl.LOCK_EX)
        try:
            previous = float(file.read() or 0)
        except ValueError:
            previous = 0
        now = time.time()
        if now < previous or now - previous >= 21600:
            print('Support notification needs secure reconciliation.', file=sys.stderr)
            file.seek(0); file.truncate(); file.write(str(now)); file.flush(); os.fsync(file.fileno())

def main():
    try:
        with open(os.devnull, 'w') as sink, contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
            chat = load_chat()
        if sys.argv[1:] != ['--send'] or os.getuid() != pwd.getpwnam('hermes').pw_uid:
            raise ValueError('invalid invocation')
        database = os.environ.get('CHAT_NOTIFY_DATABASE_URL') or os.environ.get('DATABASE_URL')
        if not database:
            raise ValueError('missing database')
        destination = chat.destination()
        env = {'PATH': '/usr/bin:/bin', 'HOME': os.path.expanduser('~'),
               'CHAT_NOTIFY_DATABASE_URL': database,
               'CHAT_NOTIFY_TELEGRAM_TOKEN': chat.telegram_token(),
               'CHAT_NOTIFY_TELEGRAM_CHAT_ID': destination,
               'CHAT_NOTIFY_TELEGRAM_CONFIRMED_CHAT_ID': destination,
               'SUPPORT_NOTIFY_STATE': STATE_ROOT + '/state.sqlite3', 'NODE_NO_WARNINGS':'1',
               'TELEGRAM_RECEIVE_ONLY': '1' if os.environ.get('TELEGRAM_RECEIVE_ONLY') == '1' else '0'}
        code = launch(env)
        if code == 2:
            uncertain_alert()
            return 1
        if code != 0:
            raise RuntimeError('worker failure')
        return 0
    except Exception:
        print('Support notification wrapper failed; investigate securely.', file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
