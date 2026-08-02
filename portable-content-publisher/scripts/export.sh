#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="${1:-portable-content-publisher-export.tgz}"
if [[ "$NAME" = /* ]]; then
  OUTPUT="$NAME"
else
  OUTPUT="$ROOT/$NAME"
fi
TEMP_OUTPUT="$(dirname "$ROOT")/.portable-content-publisher-export.$$.tgz"
tar \
  --exclude=node_modules \
  --exclude=.env \
  --exclude=data \
  --exclude=.state \
  --exclude=.tmp \
  --exclude=logs \
  --exclude='*.tgz' \
  -C "$(dirname "$ROOT")" \
  -czf "$TEMP_OUTPUT" \
  "$(basename "$ROOT")"
mv "$TEMP_OUTPUT" "$OUTPUT"
printf '%s\n' "$OUTPUT"
