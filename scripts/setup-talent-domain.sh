#!/usr/bin/env bash
# Switch public URL from ops.kaydenchiew.com → talent.kaydenchiew.com
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TUNNEL_ID="${CLOUDFLARE_TUNNEL_ID:-4fbb1a8e-7bd5-4734-833e-053705202ca5}"
TUNNEL_NAME="${CLOUDFLARE_TUNNEL_NAME:-signalqi}"
NEW_HOST="talent.kaydenchiew.com"
OLD_HOST="ops.kaydenchiew.com"

echo ""
echo "=== Switch public domain to $NEW_HOST ==="
echo ""

# Update .env.local
python3 << 'PY'
from pathlib import Path
path = Path(".env.local")
if not path.exists():
    raise SystemExit("Missing .env.local")
lines = path.read_text().splitlines()
out = []
for line in lines:
    if line.startswith("NEXT_PUBLIC_APP_URL="):
        out.append("NEXT_PUBLIC_APP_URL=https://talent.kaydenchiew.com")
    elif line.startswith("WIDGET_ALLOWED_ORIGINS="):
        val = line.split("=", 1)[1]
        val = val.replace("https://ops.kaydenchiew.com", "https://talent.kaydenchiew.com")
        if "https://talent.kaydenchiew.com" not in val:
            val = "https://talent.kaydenchiew.com," + val.lstrip()
        out.append("WIDGET_ALLOWED_ORIGINS=" + val)
    else:
        out.append(line)
path.write_text("\n".join(out) + "\n")
print("Updated .env.local")
PY

echo ""
echo "Cloudflare (one-time — do in browser if talent is not live yet):"
echo ""
echo "  A) DNS — kaydenchiew.com → DNS → Add record:"
echo "       Type: CNAME | Name: talent | Target: ${TUNNEL_ID}.cfargotunnel.com | Proxied"
echo ""
echo "  B) Tunnel hostname — Zero Trust → Networks → Connectors → ${TUNNEL_NAME}"
echo "       → Public Hostname → Add (or edit ops → talent):"
echo "       Subdomain: talent | Domain: kaydenchiew.com | URL: http://localhost:3000"
echo ""
echo "  Direct link: https://one.dash.cloudflare.com"
echo ""

if command -v cloudflared >/dev/null 2>&1; then
  if cloudflared tunnel route dns "$TUNNEL_NAME" "$NEW_HOST" 2>/dev/null; then
    echo "DNS route added via cloudflared."
  else
    echo "cloudflared DNS route skipped (run 'cloudflared tunnel login' once, then retry)."
  fi
fi

echo ""
echo "Restart app + tunnel:"
echo "  npm run system"
echo "  npm run go-live"
echo ""
echo "Open: https://${NEW_HOST}/dashboard"
echo ""
