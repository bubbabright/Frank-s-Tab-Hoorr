# Tab Hoor (codename: frank) — Install

Firefox + Chrome. Local only. No telemetry. Version: see `package.json`.

## One-shot install

```bash
cd /mnt/nas/projects/frank
./scripts/build.sh
./scripts/install-firefox.sh   # auto-loads every Firefox session
./scripts/install-chrome.sh    # permanent unpacked Chromium/Chrome
```

Then **fully quit** browsers and reopen them.

---

## Firefox

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

Stable extension id: see `extension/chrome-extension-id.txt`. Auto tab grouping is Firefox-only.

---

## Build outputs

| Path | Purpose |
|------|---------|
| `dist/firefox/` | Unpacked Firefox build |
| `dist/chrome/` | Unpacked Chrome build |
| `dist/tab-hoor-*-firefox.xpi` | XPI package |
| `dist/tab-hoor-*-chrome.zip` | Chrome zip |
| `~/.local/share/tab-hoor/` | Installed stable copies |
