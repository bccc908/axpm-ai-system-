#!/usr/bin/env bash
# One command: start 信号旗 app + Cloudflare tunnel for talent.kaydenchiew.com
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$HOME/bin:$PATH"

if [[ ! -x "$HOME/bin/cloudflared" ]]; then
  echo "Installing cloudflared..."
  mkdir -p "$HOME/bin"
  curl -L --connect-timeout 60 --max-time 300 \
    -o /tmp/cloudflared.tgz \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz"
  tar -xzf /tmp/cloudflared.tgz -C "$HOME/bin"
  chmod +x "$HOME/bin/cloudflared"
fi

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local"
  exit 1
fi

TOKEN="$(grep -E '^CLOUDFLARE_TUNNEL_TOKEN=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d ' ' || true)"
if [[ -z "$TOKEN" || "$TOKEN" == PASTE_EYJ_TOKEN_HERE* || ! "$TOKEN" =~ ^eyJ || ${#TOKEN} -lt 100 ]]; then
  echo ""
  echo "Invalid or missing Cloudflare token in .env.local"
  echo ""
  echo "Easy fix — run this instead (no token needed):"
  echo "  npm run go-live-quick"
  echo ""
  echo "For talent.kaydenchiew.com later: paste eyJ... token on CLOUDFLARE_TUNNEL_TOKEN= line"
  echo ""
  exit 1
fi

CODE="$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:3000/ 2>/dev/null || echo 000)"
if [[ "$CODE" != "200" && "$CODE" != "307" ]]; then
  echo "Starting app (npm run system)..."
  npm run system
  sleep 3
fi

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"

echo ""
echo "=== 信号旗 is live ==="
echo "  Same Wi-Fi:  http://${LAN_IP:-192.168.x.x}:3000/dashboard"
echo "  Public:      https://talent.kaydenchiew.com/dashboard"
echo ""
echo "Keep this window open. Ctrl+C stops the tunnel."
echo ""

exec cloudflared tunnel run --token "$TOKEN"
