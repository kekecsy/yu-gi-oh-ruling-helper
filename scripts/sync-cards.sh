#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT_DIR/data"
TMP_DIR="$(mktemp -d)"

mkdir -p "$DATA_DIR"
curl -L "https://ygocdb.com/api/v0/cards.zip" -o "$TMP_DIR/cards.zip"
unzip -p "$TMP_DIR/cards.zip" cards.json > "$DATA_DIR/cards.json"

COUNT="$(node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('$DATA_DIR/cards.json','utf8')); const cards=Array.isArray(data)?data:(Array.isArray(data.result)?data.result:(Array.isArray(data.cards)?data.cards:Object.values(data||{}))); console.log(cards.length)")"
echo "已同步 $COUNT 张卡到 $DATA_DIR/cards.json"
