#!/usr/bin/env bash
set -euo pipefail
EXT_ID="tab-hoor@frank"
STAGE="${XDG_DATA_HOME:-$HOME/.local/share}/tab-hoor"
BIN_DIR="${HOME}/.local/bin"

# Remove PATH wrapper if it points at our script
for f in "$BIN_DIR/firefox" "$BIN_DIR/firefox-tabhoor"; do
  if [[ -L "$f" ]] || [[ -f "$f" ]]; then
    if grep -q 'tab-hoor\|TABHOOR\|firefox-tabhoor-wrap' "$f" 2>/dev/null || \
       [[ "$(readlink -f "$f" 2>/dev/null)" == *tabhoor* ]]; then
      rm -f "$f"
      echo "removed $f"
    fi
  fi
done

# Desktop entries
for d in "$HOME/.local/share/applications/firefox.desktop" \
         "$HOME/.local/share/applications/firefox-tabhoor.desktop"; do
  if [[ -f "$d" ]] && grep -q 'X-TabHoor-Wrapped\|firefox-tabhoor' "$d" 2>/dev/null; then
    rm -f "$d"
    echo "removed $d"
  fi
done
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

# System policies if we wrote them
for f in \
  /etc/firefox/policies/policies.json \
  /etc/firefox-esr/policies/policies.json \
  /usr/lib/firefox/distribution/policies.json \
  /usr/lib/firefox-esr/distribution/policies.json
do
  if [[ -f "$f" ]] && grep -q "$EXT_ID" "$f" 2>/dev/null; then
    echo "Removing policy file $f (contained $EXT_ID)"
    if [[ -w "$f" ]]; then rm -f "$f"; else sudo rm -f "$f"; fi
  fi
done

rm -rf "$STAGE"
echo "Quit and restart Firefox. Tab Hoor policy/wrapper removed."
