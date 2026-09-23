#!/usr/bin/env bash
# Build deterministic Firefox release artifacts into dist/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/extension"
DIST="$ROOT/dist"
VER="$(python3 -c "import json; print(json.load(open('$SRC/manifest.firefox.json'))['version'])")"

BUILD="$DIST/firefox"
rm -rf "$BUILD"
mkdir -p "$BUILD"
cp -a "$SRC/." "$BUILD/"
mv "$BUILD/manifest.firefox.json" "$BUILD/manifest.json"
XPI="$DIST/tab-hoor-${VER}-firefox.xpi"
python3 - "$BUILD" "$XPI" <<'PY'
import pathlib
import sys
import zipfile

source, output = map(pathlib.Path, sys.argv[1:])
with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in sorted(source.rglob("*")):
        if file.is_file() and file.name != ".DS_Store":
            info = zipfile.ZipInfo(file.relative_to(source).as_posix(), (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, file.read_bytes())
PY

SOURCE_ARCHIVE="$DIST/tab-hoor-${VER}-source.tar.gz"
SOURCE_TAR="${SOURCE_ARCHIVE%.gz}"
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner \
  --exclude='./.git' --exclude='./dist' --exclude='./node_modules' \
  -cf "$SOURCE_TAR" -C "$ROOT" .
gzip -n -f "$SOURCE_TAR"

(cd "$DIST" && sha256sum "$(basename "$XPI")" "$(basename "$SOURCE_ARCHIVE")" \
  > "tab-hoor-${VER}-SHA256SUMS")

echo "Built Tab Hoor v${VER}"
echo "  Firefox dir : $BUILD"
echo "  Firefox XPI : $XPI"
echo "  Source      : $SOURCE_ARCHIVE"
echo "  Checksums   : $DIST/tab-hoor-${VER}-SHA256SUMS"
