#!/usr/bin/env bash
# Pull latest code, install deps, rebuild, restart production server.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG="$ROOT/.run/upgrade.log"
mkdir -p "$ROOT/.run"

{
  echo "=== AXPM upgrade $(date -Iseconds) ==="

  if [[ -d .git ]]; then
    echo "Pulling latest code..."
    git pull --rebase --autostash 2>/dev/null || git pull || true
  else
    echo "Not a git repo — skipping git pull."
  fi

  echo "Installing dependencies..."
  npm install

  echo "Restarting system..."
  bash "$ROOT/scripts/run-system.sh"

  echo "Running automation tick..."
  bash "$ROOT/scripts/cron-tick.sh" || true

  echo "=== Upgrade complete ==="
} 2>&1 | tee -a "$LOG"
