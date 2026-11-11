#!/usr/bin/env bash
# One Groktagon autopilot scan (ETH first, capped KETT). Safe to call every 12 minutes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE="${AXPM_CRON_BASE:-http://127.0.0.1:3000}"
SECRET="${CRON_SECRET:-}"

if [[ -f .env.local ]]; then
  # shellcheck disable=SC1091
  set -a
  source <(grep -E '^(CRON_SECRET|AXPM_CRON_BASE)=' .env.local | sed 's/^/export /')
  set +a
  BASE="${AXPM_CRON_BASE:-$BASE}"
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
