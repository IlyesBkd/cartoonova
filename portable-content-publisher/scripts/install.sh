#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  printf 'Created %s/.env; review it before enabling real adapters.\n' "$ROOT"
fi

if [[ ! -f config/project.json ]]; then
  cp config/project.example.json config/project.json
  printf 'Created %s/config/project.json; replace the example identity and policy.\n' "$ROOT"
fi

npm install
npm run migrate
npm run check
npm run verify
