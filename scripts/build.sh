#!/usr/bin/env bash
# Build Firefox + Chrome packages into dist/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/extension"
DIST="$ROOT/dist"
VER="$(python3 -c "import json; print(json.load(open('$SRC/manifest.firefox.json'))['version'])")"

rm -rf "$DIST/firefox" "$DIST/chrome"
mkdir -p "$DIST/firefox" "$DIST/chrome"

# Shared payload
copy_shared() {
  local dest="$1"
  mkdir -p "$dest"/{popup,options,history,icons,lib}
  cp "$SRC/data.js" "$SRC/background.js" "$dest/"
  cp "$SRC/popup/"* "$dest/popup/"
  cp "$SRC/options/"* "$dest/options/"
  cp "$SRC/history/"* "$dest/history/"
  cp "$SRC/icons/"* "$dest/icons/"
  cp "$SRC/lib/"* "$dest/lib/"
}

copy_shared "$DIST/firefox"
cp "$SRC/manifest.firefox.json" "$DIST/firefox/manifest.json"

copy_shared "$DIST/chrome"
cp "$SRC/manifest.chrome.json" "$DIST/chrome/manifest.json"

# Firefox XPI (zip)
XPI="$DIST/tab-hoor-${VER}-firefox.xpi"
(
  cd "$DIST/firefox"
  zip -qr "$XPI" . -x '*.DS_Store'
)

# Chrome zip for store / sideload
CHROME_ZIP="$DIST/tab-hoor-${VER}-chrome.zip"
(
  cd "$DIST/chrome"
  zip -qr "$CHROME_ZIP" . -x '*.DS_Store'
)

# Stable copies used by install wrappers / Chrome unpacked path
STABLE_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/tab-hoor"
mkdir -p "$STABLE_DIR/firefox" "$STABLE_DIR/chrome"
cp "$XPI" "$STABLE_DIR/tab-hoor.xpi"
cp -a "$DIST/firefox/." "$STABLE_DIR/firefox/"
cp -a "$DIST/chrome/." "$STABLE_DIR/chrome/"
cp -f "$ROOT/scripts/ff-install-temp.py" "$STABLE_DIR/ff-install-temp.py"
cp -f "$ROOT/scripts/firefox-tabhoor-wrap.sh" "$STABLE_DIR/firefox-tabhoor-wrap.sh"
chmod +x "$STABLE_DIR/ff-install-temp.py" "$STABLE_DIR/firefox-tabhoor-wrap.sh"
echo "$VER" > "$STABLE_DIR/version"

echo "Built Tab Hoor v${VER}"
echo "  Firefox dir : $DIST/firefox"
echo "  Chrome  dir : $DIST/chrome"
echo "  Firefox XPI : $XPI"
echo "  Chrome  zip : $CHROME_ZIP"
echo "  Stable root : $STABLE_DIR"
