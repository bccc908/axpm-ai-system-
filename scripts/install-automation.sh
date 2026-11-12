#!/usr/bin/env bash
# Install daily automation on macOS (launchd) or Linux (crontab).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LABEL="com.axpm.automation"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
CRON_CMD="cd \"$ROOT\" && /usr/bin/env bash scripts/cron-tick.sh >> .run/cron.log 2>&1"
APPROVALS_CMD="cd \"$ROOT\" && /usr/bin/env bash scripts/approvals-tick.sh >> .run/approvals.log 2>&1"
UPGRADE_CMD="cd \"$ROOT\" && /usr/bin/env bash scripts/upgrade-system.sh >> .run/upgrade.log 2>&1"

mkdir -p "$ROOT/.run"

if [[ "$(uname)" == "Darwin" ]]; then
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>${CRON_CMD}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${ROOT}/.run/launchd-out.log</string>
  <key>StandardErrorPath</key>
  <string>${ROOT}/.run/launchd-err.log</string>
</dict>
</plist>
EOF
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST"
  echo "Installed macOS daily automation (9:00 AM) → scripts/cron-tick.sh"
echo "  Includes: digest, fortune, gold signals, email, finance, social, auto-backup"
  echo "Plist: $PLIST"
  echo ""
  echo "Weekly auto-upgrade (optional, run manually once to add):"
  echo "  crontab -l 2>/dev/null; echo '0 3 * * 0 ${UPGRADE_CMD}'"
else
  (crontab -l 2>/dev/null | grep -v "axpm-ai-system" || true
   echo "0 9 * * * ${CRON_CMD}"
   echo "* * * * * ${APPROVALS_CMD}"
   echo "0 3 * * 0 ${UPGRADE_CMD}") | crontab -
  echo "Installed crontab: daily 9:00 automation, weekly Sunday 3:00 upgrade"
fi

echo ""
echo "Make sure the server is running: npm run system"
