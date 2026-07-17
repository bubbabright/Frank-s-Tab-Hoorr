#!/usr/bin/env bash
# Permanent Chromium/Chrome install (unpacked) — survives restarts.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/build.sh"

STAGE="${XDG_DATA_HOME:-$HOME/.local/share}/tab-hoor/chrome"
EXT_ID="$(cat "$ROOT/extension/chrome-extension-id.txt" | tr -d '[:space:]')"

python3 - "$STAGE" "$EXT_ID" <<'PY'
import json, os, sys, time, shutil
from pathlib import Path

ext_path, ext_id = sys.argv[1], sys.argv[2]
now = str(int(time.time() * 1_000_000))
manifest = json.loads((Path(ext_path) / "manifest.json").read_text())

entry = {
    "active_permissions": {
        "api": ["alarms", "storage", "tabs"],
        "explicit_host": [],
        "manifest_permissions": [],
        "scriptable_host": [],
    },
    "commands": {},
    "content_settings": [],
    "creation_flags": 1,
    "from_webstore": False,
    "granted_permissions": {
        "api": ["alarms", "storage", "tabs"],
        "explicit_host": [],
        "manifest_permissions": [],
        "scriptable_host": [],
    },
    "incognito_content_settings": [],
    "incognito_preferences": {},
    "location": 4,  # unpacked
    "manifest": manifest,
    "path": ext_path,
    "preferences": {},
    "was_installed_by_default": False,
    "was_installed_by_oem": False,
    "withholding_permissions": False,
    "state": 1,
    "last_update_time": now,
    "first_install_time": now,
}

bases = [
    Path.home() / ".config" / "chromium",
    Path.home() / ".config" / "google-chrome",
    Path.home() / ".config" / "BraveSoftware" / "Brave-Browser",
]
written = 0
for base in bases:
    if not base.is_dir():
        continue
    for prefs_path in base.glob("*/Preferences"):
        singleton = prefs_path.parent.parent / "SingletonLock"
        if singleton.exists():
            print(f"  skip (browser running): {prefs_path}")
            print("  → Quit Chromium/Chrome fully, then re-run install-chrome.sh")
            continue
        data = json.loads(prefs_path.read_text(encoding="utf-8"))
        settings = data.setdefault("extensions", {}).setdefault("settings", {})
        # preserve first_install_time if reinstalling
        if ext_id in settings and settings[ext_id].get("first_install_time"):
            entry = dict(entry)
            entry["first_install_time"] = settings[ext_id]["first_install_time"]
        settings[ext_id] = entry
        data.setdefault("extensions", {}).setdefault("ui", {})["developer_mode"] = True
        pin = data.setdefault("extensions", {}).setdefault("pinned_extensions", [])
        if ext_id not in pin:
            pin.append(ext_id)
        bak = prefs_path.with_suffix(".bak-tabhoor")
        if not bak.exists():
            shutil.copy2(prefs_path, bak)
        tmp = prefs_path.with_suffix(".tmp-tabhoor")
        tmp.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
        tmp.replace(prefs_path)
        print(f"  installed into {prefs_path}")
        written += 1

if written == 0:
    print("No browser profile Preferences updated.")
    print("Load unpacked manually:")
    print(f"  1. chrome://extensions → Developer mode")
    print(f"  2. Load unpacked → {ext_path}")
else:
    print(f"Done. Extension id: {ext_id}")
    print("Start Chromium/Chrome — Tab Hoor is permanent (unpacked).")
PY

echo ""
echo "Folder: $STAGE"
echo "Id:     $EXT_ID"
