#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/.run/system.pid"
PORT="${PORT:-3000}"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    echo "Stopped server (pid $PID)"
  fi
  rm -f "$PID_FILE"
fi

lsof -tiTCP:"$PORT" | xargs kill -9 2>/dev/null || true
echo "Port $PORT is free."
