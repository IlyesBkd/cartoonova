#!/usr/bin/env python3
"""Launch the Cartoonova listener with existing in-memory configuration only."""
import contextlib
import logging
import os
import sys

PROFILE = '/home/hermes/.hermes/profiles/cartoonova'
ROOT = '/home/hermes/projects/cartoonova'


def main():
    try:
        if len(sys.argv) != 1:
            raise ValueError('Unexpected arguments')
        logging.disable(logging.CRITICAL)
        sys.path.insert(0, '/home/hermes/.hermes/hermes-agent')
        with open(os.devnull, 'w') as sink, contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
            from hermes_cli.env_loader import load_hermes_dotenv
            load_hermes_dotenv(hermes_home=PROFILE)
        database = os.environ.get('CHAT_NOTIFY_DATABASE_URL') or os.environ.get('DATABASE_URL')
        token = os.environ.get('CHAT_NOTIFY_TELEGRAM_TOKEN') or os.environ.get('TELEGRAM_BOT_TOKEN')
        if not database or not token:
            raise ValueError('Missing relay configuration')
        env = {'PATH': '/usr/bin:/bin', 'HOME': os.path.expanduser('~'), 'HERMES_HOME': PROFILE,
               'CHAT_NOTIFY_DATABASE_URL': database, 'CHAT_NOTIFY_TELEGRAM_TOKEN': token, 'NODE_NO_WARNINGS': '1',
               'TMPDIR': PROFILE + '/cache/scratch'}
        os.chdir(ROOT)
        os.execve('/usr/bin/node', ['/usr/bin/node', ROOT + '/scripts/support-telegram-listener.mjs'], env)
    except Exception:
        print('Support listener configuration failed; cron fallback remains active.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
