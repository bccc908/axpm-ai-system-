#!/usr/bin/env bash
# Paste Cloudflare token in Terminal — writes .env.local for you
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env.local"
  exit 1
fi

echo ""
echo "1. Open: https://one.dash.cloudflare.com → Networks → Connectors → signalqi"
echo "2. Copy ONLY the long token after:  cloudflared tunnel run --token"
echo "   (starts with eyJ, one long line)"
echo ""
echo "Paste token here, then press Enter:"
read -r TOKEN

TOKEN="$(echo "$TOKEN" | tr -d ' "' | sed 's/^cloudflaredtunnelrun--token//')"

if [[ ! "$TOKEN" =~ ^eyJ ]] || [[ ${#TOKEN} -lt 100 ]]; then
  echo ""
  echo "That doesn't look like a valid token."
  echo "It must start with eyJ and be very long."
  echo "Try again: npm run set-tunnel-token"
  exit 1
fi

python3 - "$ENV_FILE" "$TOKEN" << 'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
token = sys.argv[2]
lines = path.read_text().splitlines()
out = []
found = False
for line in lines:
    if line.startswith("CLOUDFLARE_TUNNEL_TOKEN="):
        out.append(f"CLOUDFLARE_TUNNEL_TOKEN={token}")
        found = True
    else:
        out.append(line)
if not found:
    out.append(f"CLOUDFLARE_TUNNEL_TOKEN={token}")
path.write_text("\n".join(out) + "\n")
PY

echo ""
echo "Token saved. Now run:"
echo "  npm run go-live"
