#!/usr/bin/env bash
# Create a handover package (code + data, no .env secrets).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
STAMP="$(date +%Y%m%d-%H%M)"
OUT="$ROOT/axpm-handover-$STAMP.tar.gz"

echo "Creating handover package (without .env.local secrets)..."

tar -czf "$OUT" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.run' \
  --exclude='.env.local' \
  --exclude='.env' \
  --exclude='axpm-handover-*.tar.gz' \
  -C "$ROOT" \
  . 2>/dev/null || {
  tar -czf "$OUT" \
    --exclude node_modules \
    --exclude .next \
    --exclude .run \
    --exclude .env.local \
    --exclude .env \
    --exclude 'axpm-handover-*.tar.gz' \
    .
}

echo ""
echo "Package: $OUT"
echo ""
echo "IMPORTANT — send separately (secure, not in this file):"
echo "  1. .env.local  (API keys)"
echo "  2. Tell them to run: npm install && cp .env.example .env.local && npm run system"
echo ""
