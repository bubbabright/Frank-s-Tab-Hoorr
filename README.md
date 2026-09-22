# Tab Hoor

Firefox + Chrome extension that keeps your tabs under control. Local only: no telemetry, no URLs stored.

## What it does

- **Live tab count** drawn large on the toolbar icon, coloured by size (green to purple). The plain logo shows when the count is turned off in settings.
- **Popup actions**, each showing how many tabs or windows it will touch and disabling at zero: **Close Dupes**, **Merge Windows**, and a select-plus-**Close Old Tabs** row.
- **Idle cleanup** (optional): closes idle tabs, unloads idle pinned ones. Active and audio-playing tabs are always skipped.
- **Auto tab grouping** (optional, Firefox only): group by hostname rule or by domain.
- **History**: 14-day trend in the popup; a full history page with count over time, per-day breakdown, action log and CSV export.

## Action log

The history page lists what Tab Hoor did, newest first, so tab-count drops have a cause:

- Automatic idle cleanup and anything you trigger from the popup (dedupe, old tabs, merge).
- Each entry shows when it ran, whether it was automatic or manual, and the result — for example `closed 3, unloaded 2` or `merged 4 tabs from 2 windows`.
- Capped at 500 entries and pruned on the same retention setting as history samples. Clearable from the history page, and included in options export/import.

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
