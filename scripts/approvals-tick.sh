#!/usr/bin/env bash
# Record Kayden's Approve / Reject taps on pending signals (Telegram getUpdates polling).
# Run every minute from cron. Sends no new Telegram messages.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE="${AXPM_CRON_BASE:-http://127.0.0.1:3000}"
SECRET="${CRON_SECRET:-}"
if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^(CRON_SECRET|AXPM_CRON_BASE)=' .env.local | sed 's/^/export /')
  set +a
  BASE="${AXPM_CRON_BASE:-$BASE}"
  SECRET="${CRON_SECRET:-$SECRET}"
fi

if [[ -z "$SECRET" ]]; then
  echo "$(date -Is) approvals-tick: CRON_SECRET not set; skipping" >&2
  exit 1
fi

code="$(curl -s -o /tmp/axpm-approvals.json -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $SECRET" "$BASE/api/signals/approvals/poll" || echo 000)"
if [[ "$code" != "200" ]]; then
  echo "$(date -Is) approvals-tick: HTTP $code" >&2
  exit 1
fi
# Log only when a tap was processed.
if grep -q '"handled":true' /tmp/axpm-approvals.json; then
  echo "$(date -Is) approvals-tick: $(cat /tmp/axpm-approvals.json)"
fi
