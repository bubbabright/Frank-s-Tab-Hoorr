#!/usr/bin/env bash
# Permanent (auto) Firefox install for Tab Hoor — no daily about:debugging.
#
# Installs a user PATH wrapper that starts Firefox with a local debugger port
# and loads Tab Hoor automatically every session.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/build.sh"

STAGE="${XDG_DATA_HOME:-$HOME/.local/share}/tab-hoor"
BIN_DIR="${HOME}/.local/bin"
WRAP_DST="$BIN_DIR/firefox-tabhoor"

mkdir -p "$BIN_DIR"
cp -f "$ROOT/scripts/firefox-tabhoor-wrap.sh" "$WRAP_DST"
chmod +x "$WRAP_DST" "$STAGE/ff-install-temp.py"

# PATH wrapper named firefox (safe)
if [[ -e "$BIN_DIR/firefox" && ! -L "$BIN_DIR/firefox" ]]; then
  if ! grep -q 'TABHOOR\|tabhoor\|Tab Hoor' "$BIN_DIR/firefox" 2>/dev/null; then
    echo "Note: $BIN_DIR/firefox exists — install as firefox-tabhoor only"
  else
    ln -sfn "$WRAP_DST" "$BIN_DIR/firefox"
  fi
else
  ln -sfn "$WRAP_DST" "$BIN_DIR/firefox"
fi

# Ensure ~/.local/bin early on PATH
for rc in "$HOME/.bashrc" "$HOME/.profile"; do
  [[ -f "$rc" ]] || continue
  if ! grep -qF '.local/bin' "$rc" 2>/dev/null; then
    printf '\n# user bins (Tab Hoor firefox wrapper)\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$rc"
    echo "  PATH note added to $rc"
  fi
done
export PATH="$BIN_DIR:$PATH"

# Seed RDP-friendly prefs into default profile (no prompt on debugger connect)
seed_profile_prefs() {
  local dir userjs pref key
  for dir in "$HOME"/.mozilla/firefox/*/; do
    [[ -d "$dir" ]] || continue
    case "$(basename "$dir")" in Crash*|Pending*|Profile*) continue ;; esac
    [[ -f "${dir}prefs.js" || -f "${dir}times.json" || -d "${dir}extensions" ]] || continue
    userjs="${dir}user.js"
    touch "$userjs"
    for pref in \
      'user_pref("devtools.chrome.enabled", true);' \
      'user_pref("devtools.debugger.remote-enabled", true);' \
      'user_pref("devtools.debugger.prompt-connection", false);' \
      'user_pref("devtools.debugger.force-local", true);'
    do
      key=$(echo "$pref" | sed -n 's/.*user_pref("\([^"]*\)".*/\1/p')
      if ! grep -qF "$key" "$userjs" 2>/dev/null; then
        echo "$pref" >> "$userjs"
      fi
    done
    echo "  prefs seeded: $userjs"
  done
}
seed_profile_prefs

# Desktop entry override
apps="$HOME/.local/share/applications"
mkdir -p "$apps"
if [[ -f /usr/share/applications/firefox.desktop ]]; then
  sed -E "s|^Exec=firefox|Exec=$WRAP_DST|; s|^Exec=/usr/bin/firefox|Exec=$WRAP_DST|" \
    /usr/share/applications/firefox.desktop > "$apps/firefox.desktop"
  echo "X-TabHoor-Wrapped=true" >> "$apps/firefox.desktop"
  update-desktop-database "$apps" 2>/dev/null || true
  echo "  desktop: $apps/firefox.desktop"
fi

echo ""
echo "Tab Hoor Firefox install complete."
echo "  Extension : $STAGE/firefox"
echo "  Wrapper   : $WRAP_DST"
echo ""
echo "Next steps:"
echo "  1. Fully quit Firefox (all windows)."
echo "  2. Start Firefox from the menu or:  firefox"
echo "  3. Tab Hoor loads automatically every session — no about:debugging."
echo ""
echo "Update after code changes:  $ROOT/scripts/build.sh && restart Firefox"
echo "Uninstall:                  $ROOT/scripts/uninstall-firefox.sh"
