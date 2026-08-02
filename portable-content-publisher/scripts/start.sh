#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env || ! -f config/project.json ]]; then
  printf 'Run ./scripts/install.sh first.\n' >&2
  exit 1
fi

set -a
source .env
set +a

pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
