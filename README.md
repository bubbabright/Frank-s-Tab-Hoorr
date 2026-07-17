# Tab Hoor (frank)

Gamify your tab hoarding. Ranks, achievements, history — all local. Firefox + Chrome.

## Install

```bash
./scripts/build.sh
./scripts/install-firefox.sh   # auto-loads each Firefox session
./scripts/install-chrome.sh    # permanent Chromium/Chrome
```

Fully quit browsers, reopen. Details: [INSTALL.md](INSTALL.md).

## Layout

```
extension/          # shared source (edit here)
  manifest.firefox.json
  manifest.chrome.json
  background.js / data.js
  popup/ options/ history/ icons/
scripts/
  build.sh
  install-firefox.sh / install-chrome.sh
  firefox-tabhoor-wrap.sh / ff-install-temp.py
dist/               # build output
```

## Dev reload

```bash
./scripts/build.sh
# Firefox: restart browser (wrapper reloads extension)
# Chrome: chrome://extensions → Reload on Tab Hoor
```
