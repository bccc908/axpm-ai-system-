#!/usr/bin/env bash
# Public URL in ~10 seconds — no Cloudflare token needed (random *.trycloudflare.com URL)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$HOME/bin:$PATH"

if [[ ! -x "$HOME/bin/cloudflared" ]]; then
  mkdir -p "$HOME/bin"
  curl -L --connect-timeout 60 --max-time 300 \
    -o /tmp/cloudflared.tgz \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz"
  tar -xzf /tmp/cloudflared.tgz -C "$HOME/bin"
  chmod +x "$HOME/bin/cloudflared"
fi

CODE="$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:3000/ 2>/dev/null || echo 000)"
if [[ "$CODE" != "200" && "$CODE" != "307" ]]; then
  echo "Starting app..."
  npm run system
  sleep 3
fi

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"

echo ""
echo "=== 信号旗 quick public link ==="
echo "  Same Wi-Fi:  http://${LAN_IP:-192.168.x.x}:3000/dashboard"
echo ""
echo "Starting temporary Cloudflare link (no token needed)..."
echo "Look for a line like: https://xxxx.trycloudflare.com"
echo "Then open: https://xxxx.trycloudflare.com/dashboard"
echo ""
echo "Keep this window open. Ctrl+C stops the public link."
echo ""

exec cloudflared tunnel --url http://localhost:3000
