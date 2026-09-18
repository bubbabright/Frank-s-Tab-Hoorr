# Tab Hoor (codename: frank) — Install

**v0.3.0** — Firefox + Chrome. Local only. No telemetry.

## One-shot install

```bash
cd /sync/projects/frank
./scripts/build.sh
./scripts/install-firefox.sh   # auto-loads every Firefox session
./scripts/install-chrome.sh    # permanent unpacked Chromium/Chrome
```

Then **fully quit** browsers and reopen them.

---

## Firefox (no more about:debugging)

`install-firefox.sh` puts a wrapper on `~/.local/bin/firefox` that:

1. Starts Firefox with a local debugger port
2. Installs Tab Hoor automatically via Remote Debugging Protocol

You do **not** need to open `about:debugging` each session.

| Action | Command |
|--------|---------|
| Install / refresh | `./scripts/install-firefox.sh` |
| Update code | `./scripts/build.sh` then restart Firefox |
| Uninstall | `./scripts/uninstall-firefox.sh` |

Optional true system policy (needs sudo once):

```bash
TABHOOR_USE_SYSTEM_POLICY=1 ./scripts/install-firefox.sh
```

---

## Chrome / Chromium (permanent)

Unpacked extensions **persist across restarts** once loaded.

```bash
./scripts/install-chrome.sh
```

Or manually: `chrome://extensions` → Developer mode → Load unpacked →

```
~/.local/share/tab-hoor/chrome
```

Stable extension id: see `extension/chrome-extension-id.txt`.

---

## Build outputs

| Path | Purpose |
|------|---------|
| `dist/firefox/` | Unpacked Firefox build |
| `dist/chrome/` | Unpacked Chrome build |
| `dist/tab-hoor-*-firefox.xpi` | XPI package |
| `dist/tab-hoor-*-chrome.zip` | Chrome zip |
| `~/.local/share/tab-hoor/` | Installed stable copies |

---

## Features (v0.6)

- Live tab / window counts + toolbar badge (colour shifts as the count grows)
- Popup actions with live counts: Close Dupes, Merge Windows, Close Old Tabs
- Idle-tab cleanup and Firefox auto tab grouping (rules + optional group-by-domain)
- All-time high
- History sampling (alarms) + 14-day sparkline
- Full history page (ranges, chart, CSV export)
- Options: badge mode, sample interval, retention, dedupe rules, idle cleanup, grouping
- All data local — counts only, no URLs
