#!/usr/bin/env bash
# Run Cloudflare Tunnel for talent.kaydenchiew.com → localhost:3000
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${CLOUDFLARE_TUNNEL_CONFIG:-$HOME/.cloudflared/config.yml}"
TUNNEL_NAME="${CLOUDFLARE_TUNNEL_NAME:-signalqi}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Install cloudflared first:"
  echo "  brew install cloudflare/cloudflare/cloudflared"
  exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "Missing $CONFIG"
  echo "Follow: scripts/cloudflare-tunnel-setup.md"
  exit 1
fi

CODE="$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:3000/ 2>/dev/null || echo 000)"
if [[ "$CODE" != "200" && "$CODE" != "307" ]]; then
  echo "Warning: localhost:3000 not responding ($CODE)."
  echo "Start the app first: npm run system"
  echo ""
fi

echo "Starting tunnel → https://talent.kaydenchiew.com → http://localhost:3000"
echo "Press Ctrl+C to stop."
exec cloudflared tunnel --config "$CONFIG" run "$TUNNEL_NAME"
