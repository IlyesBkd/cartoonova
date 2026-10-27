#!/usr/bin/env python3
"""No-agent entry point; secrets are inherited, never printed or persisted."""
import contextlib
import logging
import os
import pwd
import re
import signal
import stat
import subprocess
import sys

ROOT = '/home/hermes/projects/cartoonova'
PROFILE = '/home/hermes/.hermes/profiles/cartoonova'
DESTINATION = PROFILE + '/chat-notify-destination'


HERMES_SOURCE = '/home/hermes/.hermes/hermes-agent'


def telegram_token():
    token = os.environ.get('CHAT_NOTIFY_TELEGRAM_TOKEN')
    if token:
        return token
    # The loader modifies os.environ and may load unrelated secrets. Restore the
    # original environment even on failure; only return the selected token.
    original = os.environ.copy()
    logging_level = logging.root.manager.disable
    try:
        logging.disable(logging.CRITICAL)
        sys.path.insert(0, HERMES_SOURCE)
        with open(os.devnull, 'w') as sink, contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
            from hermes_cli.env_loader import load_hermes_dotenv
            load_hermes_dotenv(hermes_home=PROFILE)
        token = os.environ.get('TELEGRAM_BOT_TOKEN')
        if not token:
            raise ValueError('missing Telegram token')
        return token
    except Exception:
        raise ValueError('Telegram credential unavailable') from None
    finally:
        logging.disable(logging_level)
        os.environ.clear()
        os.environ.update(original)
        if sys.path and sys.path[0] == HERMES_SOURCE:
            del sys.path[0]


def destination(path=DESTINATION):
    # Reject symlinks, files owned by others, and files accessible by others.
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_uid != os.getuid() or stat.S_IMODE(st.st_mode) != 0o600:
            raise ValueError('unsafe destination file')
        value = os.read(fd, 128).decode('ascii').strip()
        if not re.fullmatch(r'[1-9][0-9]{0,19}', value):
            raise ValueError('invalid destination')
        return value
    finally:
        os.close(fd)


def run_worker(popen=subprocess.Popen, env=None):
    try:
        process = popen(['/usr/bin/node', ROOT + '/scripts/chat-telegram-worker.mjs', '--send'],
                        cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                        start_new_session=True)
        try:
            return 0 if process.wait(timeout=150) == 0 else 1
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()
            return 1
    except OSError:
        return 1


def main():
    try:
        if len(sys.argv) != 1 or os.getuid() != pwd.getpwnam('hermes').pw_uid:
            raise ValueError('invalid user or arguments')
        db = os.environ.get('CHAT_NOTIFY_DATABASE_URL') or os.environ.get('DATABASE_URL')
        if not db:
            raise ValueError('missing database')
        token = telegram_token()
        chat_id = destination()
        env = os.environ.copy()
        env.update(CHAT_NOTIFY_DATABASE_URL=db, CHAT_NOTIFY_TRANSPORT='telegram',
                   CHAT_NOTIFY_TELEGRAM_TOKEN=token,
                   CHAT_NOTIFY_TELEGRAM_CHAT_ID=chat_id,
                   CHAT_NOTIFY_TELEGRAM_CONFIRMED_CHAT_ID=chat_id, HERMES_HOME=PROFILE)
        if run_worker(env=env):
            raise ValueError('worker failed')
    except (OSError, ValueError, UnicodeError, KeyError):
        print('Chat notification cron failed: configuration, worker or timeout; investigate securely.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
