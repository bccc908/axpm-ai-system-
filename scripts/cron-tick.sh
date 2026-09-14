#!/usr/bin/env bash
# Run all scheduled automation jobs once (digest, email, finance, social).
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

QS=""
if [[ -n "$SECRET" ]]; then
  QS="?secret=$SECRET"
fi

echo "Running automation at $BASE ..."

run() {
  local name="$1"
  local url="$2"
  local code
  code="$(curl -s -o /tmp/axpm-cron.json -w "%{http_code}" -X POST "$url" 2>/dev/null || echo 000)"
  if [[ "$code" == "200" || "$code" == "201" ]]; then
    echo "  ✓ $name"
  else
    echo "  ✗ $name (HTTP $code)"
  fi
}

run "Daily digest (Telegram)" "$BASE/api/digest/daily$QS"
run "Daily fortune (Telegram)" "$BASE/api/fortune/daily$QS"
run "Daily gold signal (Telegram)" "$BASE/api/gold-signals/daily$QS"
run "Daily BTC signal (Telegram)" "$BASE/api/btc-signals/daily$QS"
run "Daily ETH signal (Telegram)" "$BASE/api/eth-signals/daily$QS"
run "Daily XAUUSDT signal (Telegram)" "$BASE/api/xau-signals/daily$QS"
run "Email automation" "$BASE/api/email/automation$QS"
run "Finance automation" "$BASE/api/finance/automation$QS"
run "Social publish queue" "$BASE/api/social/publish$QS"
run "System backup" "$BASE/api/system/backup$QS"

echo "Done."
