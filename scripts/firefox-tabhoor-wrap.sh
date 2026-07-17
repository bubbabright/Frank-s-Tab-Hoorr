#!/usr/bin/env bash
# Launch Firefox and auto-load Tab Hoor every session (no about:debugging).
set -euo pipefail

STAGE="${XDG_DATA_HOME:-$HOME/.local/share}/tab-hoor"
EXT_DIR="$STAGE/firefox"
INSTALLER="$STAGE/ff-install-temp.py"
RDP_PORT="${TABHOOR_RDP_PORT:-6000}"

# Resolve real Firefox (never recurse into this wrapper)
REAL_FIREFOX="${TABHOOR_FIREFOX:-}"
if [[ -z "$REAL_FIREFOX" ]]; then
  if [[ -x /usr/bin/firefox.real ]]; then
    REAL_FIREFOX=/usr/bin/firefox.real
  elif [[ -x /usr/lib/firefox/firefox ]]; then
    REAL_FIREFOX=/usr/lib/firefox/firefox
  else
    while read -r p; do
      case "$p" in
        *local/bin/firefox*|*tabhoor*|*firefox-tabhoor*) continue ;;
      esac
      if [[ -x "$p" ]]; then REAL_FIREFOX="$p"; break; fi
    done < <(command -v -a firefox 2>/dev/null || true)
  fi
fi

if [[ -z "${REAL_FIREFOX:-}" || ! -x "$REAL_FIREFOX" ]]; then
  echo "Tab Hoor: could not find real Firefox binary" >&2
  exit 1
fi

if [[ ! -f "$EXT_DIR/manifest.json" ]]; then
  echo "Tab Hoor: missing $EXT_DIR — run scripts/build.sh / install-firefox.sh" >&2
  exit 1
fi

# Background installer (waits for RDP then loads the extension)
auto_install() {
  if [[ ! -f "$INSTALLER" ]]; then
    echo "Tab Hoor: missing $INSTALLER" >&2
    return 1
  fi
  for _ in $(seq 1 50); do
    if python3 "$INSTALLER" --path "$EXT_DIR" --port "$RDP_PORT" --timeout 2 2>/tmp/tabhoor-rdp.err; then
      return 0
    fi
    sleep 0.35
  done
  echo "Tab Hoor: auto-install failed — see /tmp/tabhoor-rdp.err" >&2
  return 1
}

# If Firefox already running: try attach, else open new window without reinstall
if pgrep -x firefox >/dev/null 2>&1 || pgrep -x firefox-bin >/dev/null 2>&1 || pgrep -x firefox.real >/dev/null 2>&1; then
  if python3 "$INSTALLER" --path "$EXT_DIR" --port "$RDP_PORT" --timeout 2 2>/dev/null; then
    :
  fi
  exec "$REAL_FIREFOX" "$@"
fi

# Fresh launch with remote debugger so we can install without about:debugging
auto_install &
exec "$REAL_FIREFOX" -start-debugger-server "$RDP_PORT" "$@"
