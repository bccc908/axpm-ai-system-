#!/usr/bin/env bash
# Install macOS launchd jobs: start AXPM on login + optional Cloudflare tunnel.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "install-boot.sh is for macOS only. On Linux use: npm run automation:install"
  exit 1
fi

mkdir -p "$ROOT/.run" "$HOME/Library/LaunchAgents"

SYSTEM_LABEL="com.axpm.system"
TUNNEL_LABEL="com.axpm.tunnel"
SYSTEM_PLIST="$HOME/Library/LaunchAgents/${SYSTEM_LABEL}.plist"
TUNNEL_PLIST="$HOME/Library/LaunchAgents/${TUNNEL_LABEL}.plist"

SYSTEM_CMD="cd \"$ROOT\" && /usr/bin/env bash scripts/run-system.sh >> .run/boot-system.log 2>&1"

cat > "$SYSTEM_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SYSTEM_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>${SYSTEM_CMD}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${ROOT}/.run/launchd-system-out.log</string>
  <key>StandardErrorPath</key>
  <string>${ROOT}/.run/launchd-system-err.log</string>
</dict>
</plist>
EOF

launchctl unload "$SYSTEM_PLIST" 2>/dev/null || true
launchctl load "$SYSTEM_PLIST"
echo "✓ Boot agent installed: AXPM system starts on login"
echo "  Plist: $SYSTEM_PLIST"

TOKEN=""
if [[ -f .env.local ]]; then
  TOKEN="$(grep -E '^CLOUDFLARE_TUNNEL_TOKEN=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d ' ' || true)"
fi

if [[ -n "$TOKEN" && "$TOKEN" =~ ^eyJ && ${#TOKEN} -ge 100 ]]; then
  export PATH="$HOME/bin:$PATH"
  TUNNEL_CMD="cd \"$ROOT\" && export PATH=\"\$HOME/bin:\$PATH\" && /usr/bin/env bash scripts/go-live.sh >> .run/boot-tunnel.log 2>&1"
  cat > "$TUNNEL_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${TUNNEL_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>${TUNNEL_CMD}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${ROOT}/.run/launchd-tunnel-out.log</string>
  <key>StandardErrorPath</key>
  <string>${ROOT}/.run/launchd-tunnel-err.log</string>
</dict>
</plist>
EOF
  launchctl unload "$TUNNEL_PLIST" 2>/dev/null || true
  launchctl load "$TUNNEL_PLIST"
  echo "✓ Tunnel agent installed: talent.kaydenchiew.com on login"
  echo "  Plist: $TUNNEL_PLIST"
else
  echo "○ Skipped tunnel agent (no valid CLOUDFLARE_TUNNEL_TOKEN in .env.local)"
  echo "  Run manually: npm run go-live"
fi

echo ""
echo "Also install daily automation (digest + backup): npm run automation:install"
echo "Logs: $ROOT/.run/"
