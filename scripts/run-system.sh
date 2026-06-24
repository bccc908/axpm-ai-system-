#!/usr/bin/env bash
# Start AXPM AI System in production mode (stable — keeps running after terminal closes).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PID_FILE="$ROOT/.run/system.pid"
LOG_FILE="$ROOT/.run/system.log"
PORT="${PORT:-3000}"

mkdir -p "$ROOT/.run"

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local — copy from .env.example and add your API keys."
  exit 1
fi

# Stop previous instance
if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping previous server (pid $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
fi
lsof -tiTCP:"$PORT" | xargs kill -9 2>/dev/null || true

echo "Building production app..."
npm run build

echo "Starting server (all network interfaces, port $PORT) ..."
nohup npx next start -H 0.0.0.0 -p "$PORT" >> "$LOG_FILE" 2>&1 &
sleep 2
SERVER_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1)"
if [[ -z "$SERVER_PID" ]]; then
  echo "Server failed to bind on port $PORT — check $LOG_FILE"
  exit 1
fi
echo "$SERVER_PID" > "$PID_FILE"

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)"

for i in {1..30}; do
  CODE="$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://localhost:$PORT/" 2>/dev/null || echo 000)"
  if [[ "$CODE" == "200" || "$CODE" == "307" ]]; then
    break
  fi
  sleep 1
done

echo ""
echo "=== 信号旗 is running ==="
echo "  This Mac:   http://localhost:$PORT"
if [[ -n "$LAN_IP" ]]; then
  echo "  Staff LAN:  http://$LAN_IP:$PORT  (same Wi‑Fi / office network)"
fi
echo "  Log:    $LOG_FILE"
echo "  PID:    $(cat "$PID_FILE")"
echo ""
echo "Quick links:"
echo "  Dashboard:  http://localhost:$PORT/dashboard"
echo "  Inbox:      http://localhost:$PORT/dashboard/conversations"
echo "  CRM:        http://localhost:$PORT/dashboard/crm"
echo "  Settings:   http://localhost:$PORT/dashboard/settings"
echo ""
echo "Run automation now:  npm run cron:tick"
echo "Stop server:         npm run system:stop"
echo ""

# Health check
curl -s "http://localhost:$PORT/api/ai/status" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  ok = d.get('ready')
  label = d.get('providerLabel', 'AI')
  print(f'AI ({label}):', 'connected' if ok else 'not ready')
except Exception:
  print('AI status: check log')
" 2>/dev/null || true
