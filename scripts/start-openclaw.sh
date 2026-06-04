#!/usr/bin/env bash
# Start OpenClaw gateway (uses DeepSeek from ~/.openclaw/.env).
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
mkdir -p "$HOME/.openclaw"

if [[ ! -f "$HOME/.openclaw/.env" ]]; then
  echo "Missing ~/.openclaw/.env — run OpenClaw setup first (see README OpenClaw section)."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$HOME/.openclaw/.env"
set +a

if lsof -tiTCP:18789 >/dev/null 2>&1; then
  echo "OpenClaw gateway already running on port 18789"
  openclaw health 2>/dev/null || true
  exit 0
fi

echo "Starting OpenClaw gateway on http://127.0.0.1:18789 ..."
nohup openclaw gateway run >> "$HOME/.openclaw/gateway.log" 2>&1 &
echo $! > "$HOME/.openclaw/gateway.pid"

for i in {1..20}; do
  if curl -s -o /dev/null --connect-timeout 1 http://127.0.0.1:18789/ 2>/dev/null; then
    echo "OpenClaw gateway ready."
    openclaw health 2>/dev/null || true
    exit 0
  fi
  sleep 1
done

echo "Gateway slow to start — check $HOME/.openclaw/gateway.log"
exit 1
