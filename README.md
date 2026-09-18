# Tab Hoor

Firefox + Chrome extension that keeps your tabs under control. Local only: no telemetry, no URLs stored.

- Live tab and window count on the toolbar badge (colour shifts as the count grows)
- Popup actions that show how many tabs they will touch: **Close Dupes**, **Merge Windows**, **Close Old Tabs**
- Optional idle-tab cleanup
- Optional auto tab grouping by rule or by domain (Firefox only)
- Tab-count history: 14-day trend in the popup, full history page with CSV export

## Install

```bash
./scripts/build.sh
./scripts/install-firefox.sh   # loads Tab Hoor in every Firefox session
./scripts/install-chrome.sh    # permanent unpacked Chrome/Chromium
```

Fully quit and reopen the browser. Details: [INSTALL.md](INSTALL.md).

## Develop

Source lives in `extension/` (`background.js`, `data.js`, `popup/`, `options/`, `history/`, one manifest per browser). `scripts/build.sh` packages it into `dist/` and the stable install copy in `~/.local/share/tab-hoor/`.

After a change: rebuild, then reload the extension (Firefox `about:debugging` > Reload, Chrome `chrome://extensions` > Reload). Open extension pages need a refresh.

Releasing: bump `version` in `package.json` and both `extension/manifest.*.json`.

`function-repos/` (gitignored) is a local scratch folder of upstream extensions that some features were ported from (reference only, not built).
