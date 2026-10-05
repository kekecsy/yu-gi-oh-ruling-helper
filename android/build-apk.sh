#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
SDK_DIR="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
BUILD_TOOLS="$SDK_DIR/build-tools/36.0.0"
PLATFORM_JAR="$SDK_DIR/platforms/android-37.0/android.jar"
JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
JAVA_BIN="$JAVA_HOME/bin/java"
JAVAC_BIN="$JAVA_HOME/bin/javac"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

APP_ID="com.kekecsy.ygoruling"
OUT_DIR="$ANDROID_DIR/build"
GEN_DIR="$OUT_DIR/gen"
OBJ_DIR="$OUT_DIR/obj"
DEX_DIR="$OUT_DIR/dex"
KEYSTORE="$OUT_DIR/debug.keystore"

rm -rf "$GEN_DIR" "$OBJ_DIR" "$DEX_DIR"
mkdir -p "$GEN_DIR" "$OBJ_DIR" "$DEX_DIR"

ASSETS_DIR="$ANDROID_DIR/app/src/main/assets"
mkdir -p "$ASSETS_DIR" "$ASSETS_DIR/data" "$ASSETS_DIR/icons"
cp "$ROOT_DIR/index.html" "$ROOT_DIR/styles.css" "$ROOT_DIR/app.js" "$ROOT_DIR/manifest.webmanifest" "$ROOT_DIR/sw.js" "$ASSETS_DIR/"
cp "$ROOT_DIR/data/cards.json" "$ANDROID_DIR/app/src/main/assets/data/cards.json"
cp "$ROOT_DIR/icons/app-icon.svg" "$ANDROID_DIR/app/src/main/assets/icons/app-icon.svg"

"$BUILD_TOOLS/aapt2" compile --dir "$ANDROID_DIR/app/src/main/res" -o "$OUT_DIR/compiled.zip"
"$BUILD_TOOLS/aapt2" link \
  -o "$OUT_DIR/app-unsigned.apk" \
  -I "$PLATFORM_JAR" \
  -A "$ANDROID_DIR/app/src/main/assets" \
  --min-sdk-version 23 \
  --target-sdk-version 37 \
  --version-code 1 \
  --version-name 0.1.0 \
  --manifest "$ANDROID_DIR/app/src/main/AndroidManifest.xml" \
  --java "$GEN_DIR" \
  "$OUT_DIR/compiled.zip" \
  --auto-add-overlay

"$JAVAC_BIN" -encoding UTF-8 -source 8 -target 8 \
  -bootclasspath "$PLATFORM_JAR" \
  -d "$OBJ_DIR" \
  $(find "$ANDROID_DIR/app/src/main/java" "$GEN_DIR" -name '*.java')

"$BUILD_TOOLS/d8" --lib "$PLATFORM_JAR" --output "$DEX_DIR" $(find "$OBJ_DIR" -name '*.class')
cd "$DEX_DIR"
zip -q "$OUT_DIR/app-unsigned.apk" classes.dex
cd "$ROOT_DIR"

if [[ ! -f "$KEYSTORE" ]]; then
  "$JAVA_HOME/bin/keytool" -genkeypair -v \
    -keystore "$KEYSTORE" \
    -storepass android \
    -keypass android \
    -alias androiddebugkey \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US"
fi

"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out "$OUT_DIR/ygo-ruling-helper.apk" \
  "$OUT_DIR/app-unsigned.apk"

"$BUILD_TOOLS/apksigner" verify "$OUT_DIR/ygo-ruling-helper.apk"
echo "$OUT_DIR/ygo-ruling-helper.apk"
