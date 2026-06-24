#!/usr/bin/env bash
# Install Piper TTS binary + Chinese voice model into data/piper (self-hosted, no API fees).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIPER_DIR="$ROOT/data/piper"
mkdir -p "$PIPER_DIR"

ARCH="$(uname -m)"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"

if [[ "$OS" != "darwin" ]]; then
  echo "This script currently supports macOS. Set PIPER_BIN and PIPER_MODEL manually for Linux."
  exit 1
fi

if [[ "$ARCH" == "arm64" ]]; then
  PIPER_URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_aarch64.tar.gz"
elif [[ "$ARCH" == "x86_64" ]]; then
  PIPER_URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_x64.tar.gz"
else
  echo "Unsupported architecture: $ARCH"
  exit 1
fi

MODEL_BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/huayan/medium"
MODEL_ONNX="$PIPER_DIR/zh_CN-huayan-medium.onnx"
MODEL_JSON="$PIPER_DIR/zh_CN-huayan-medium.onnx.json"

echo "→ Downloading Piper binary..."
curl -fsSL "$PIPER_URL" | tar -xz -C "$PIPER_DIR"
chmod +x "$PIPER_DIR/piper" 2>/dev/null || chmod +x "$PIPER_DIR"/piper_* 2>/dev/null || true

# Normalize binary path
if [[ ! -x "$PIPER_DIR/piper" ]]; then
  BIN="$(find "$PIPER_DIR" -maxdepth 2 -name piper -type f | head -1)"
  if [[ -n "$BIN" ]]; then
    cp "$BIN" "$PIPER_DIR/piper"
    chmod +x "$PIPER_DIR/piper"
  fi
fi

echo "→ Downloading Chinese voice model (huayan medium)..."
curl -fsSL "$MODEL_BASE/zh_CN-huayan-medium.onnx" -o "$MODEL_ONNX"
curl -fsSL "$MODEL_BASE/zh_CN-huayan-medium.onnx.json" -o "$MODEL_JSON"

echo ""
echo "=== Piper installed ==="
echo "  Binary: $PIPER_DIR/piper"
echo "  Model:  $MODEL_ONNX"
echo ""
echo "Add to .env.local:"
echo "  SELF_HOSTED_MODE=true"
echo "  TTS_PRIORITY=piper"
echo "  PIPER_BIN=$PIPER_DIR/piper"
echo "  PIPER_MODEL=$MODEL_ONNX"
echo ""
echo "Test:"
echo "  echo '你好，这是自托管配音测试' | $PIPER_DIR/piper --model $MODEL_ONNX --output_file /tmp/test.wav"
echo ""
