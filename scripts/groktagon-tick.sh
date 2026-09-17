#!/usr/bin/env bash
# One Groktagon autopilot scan (ETH first, capped KETT). Safe to call every 12 minutes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
SECRET="${CRON_SECRET:-}"

if [[ -f .env.local ]]; then
  # shellcheck disable=SC1091
  set -a
  source <(grep -E '^(CRON_SECRET|NEXT_PUBLIC_APP_URL)=' .env.local | sed 's/^/export /')
  set +a
  BASE="${NEXT_PUBLIC_APP_URL:-$BASE}"
  SECRET="${CRON_SECRET:-$SECRET}"
fi

QS="tick=1"
if [[ -n "$SECRET" ]]; then
  QS="${QS}&secret=${SECRET}"
fi

mkdir -p "$ROOT/.run"
curl -sS -X POST "$BASE/api/groktagon/autopilot?${QS}" \
  -o "$ROOT/.run/groktagon-tick.json" \
  -w "%{http_code}" > "$ROOT/.run/groktagon-tick.status" || true

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) HTTP $(cat "$ROOT/.run/groktagon-tick.status") $(tr '\n' ' ' < "$ROOT/.run/groktagon-tick.json" | head -c 240)" >> "$ROOT/.run/groktagon-tick.log"
