#!/usr/bin/env bash
# One-shot setup check for gold signals + ATAS + Telegram
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Signal Flag · Gold / ATAS setup ==="
echo ""

if [[ ! -f .env.local ]]; then
  echo "❌ .env.local missing — copy from .env.example"
  exit 1
fi

source_env() {
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    val="${val%\"}"; val="${val#\"}"
    export "$key=$val"
  done < .env.local
}
source_env

ok=0
warn=0

check() {
  if [[ -n "${!1:-}" ]]; then
    echo "✓ $2"
    ok=$((ok + 1))
  else
    echo "✗ $2 — set $1 in .env.local"
    warn=$((warn + 1))
  fi
}

check DEEPSEEK_API_KEY "DeepSeek（生成信号）"
check TELEGRAM_BOT_TOKEN "Telegram Bot"
check TELEGRAM_CHAT_ID "Telegram Chat ID"
check LOCAL_API_KEY "LOCAL_API_KEY（ATAS 桥接）"

echo ""
echo "--- 本机访问 ---"
echo "  黄金信号页:  http://localhost:3000/dashboard/gold-signals"
echo "  ATAS API:    http://localhost:3000/api/gold-signals/atas"
echo ""
echo "--- Mac 上（Telegram 已够）---"
echo "  打开网页 → 生成黄金信号 → 手机 Telegram 收提醒"
echo ""
echo "--- Windows + ATAS 侧栏脚本 ---"
echo '  $env:SIGNAL_FLAG_URL="http://<你的Mac局域网IP>:3000/api/gold-signals/atas"'
if [[ -n "${LOCAL_API_KEY:-}" ]]; then
  echo "  \$env:LOCAL_API_KEY=\"<见 .env.local>\""
fi
echo '  python atas-addon\gold_signal_bridge.py'
echo ""
echo "--- 命令行生成一条测试信号 ---"
echo "  npm run gold:signal"
echo ""

if [[ $warn -gt 0 ]]; then
  exit 1
fi
echo "All configured. Run: npm run gold:signal"
