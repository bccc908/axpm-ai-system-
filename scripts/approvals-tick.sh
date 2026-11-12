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

OUT="$(mktemp "${TMPDIR:-/tmp}/axpm-approvals.XXXXXX")"
trap 'rm -f "$OUT"' EXIT

# --max-time > the app's 10s Telegram timeout + one retry, so curl does not give up first.
code="$(curl -s --max-time 30 -o "$OUT" -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $SECRET" "$BASE/api/signals/approvals/poll" || true)"
[[ "$code" =~ ^[0-9]{3}$ ]] || code=000
if [[ "$code" != "200" ]]; then
  echo "$(date -Is) approvals-tick: HTTP $code" >&2
  # One line, bot token redacted, ~500 chars: enough to tell a 409 conflict from a Telegram/network 5xx.
  body="$(tr '\r\n\t' '   ' < "$OUT" 2>/dev/null \
    | sed -E 's/bot[0-9]+:[A-Za-z0-9_-]+/bot<redacted>/g; s/[0-9]{6,}:[A-Za-z0-9_-]{30,}/<redacted>/g' \
    | cut -c1-500 || true)"
  echo "$(date -Is) approvals-tick: body ${body:-<empty>}" >&2
  exit 1
fi
# Log only when a tap was processed.
if grep -q '"handled":true' "$OUT"; then
  echo "$(date -Is) approvals-tick: $(cat "$OUT")"
fi
