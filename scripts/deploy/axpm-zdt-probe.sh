#!/usr/bin/env bash
# Log HTTP status of the public login page and local :3000 every second.
# Usage: axpm-zdt-probe.sh [log-path]
set -euo pipefail
LOG="${1:-/tmp/axpm-zdt-probe.log}"
PUBLIC="${AXPM_PUBLIC_URL:-http://157.230.253.45}/login"
LOCAL="${AXPM_LOCAL_URL:-http://127.0.0.1:3000}/login"
code() {
  local out
  out="$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 2 --max-time 3 "$1" || true)"
  [[ "$out" =~ ^[0-9]{3}$ ]] || out="000"
  printf '%s' "$out"
}
echo "# probe start $(date -Iseconds) public=${PUBLIC} local=${LOCAL}" >> "$LOG"
while true; do
  ts="$(date -Iseconds)"
  pub="$(code "$PUBLIC")"
  loc="$(code "$LOCAL")"
  echo "$ts public=$pub local=$loc" >> "$LOG"
  sleep 1
done
