> **Status: DONE (shipped in v0.4.0).** Kept for reference. Since then the popup wiring changed: the trigger is the `#btnMerge` button, and `MERGE_WINDOWS` also accepts `dryRun` to return `{windows, tabs}` for the live button label. Finished plans move to the Obsidian vault (`07-projects/`) per the projects convention.

# Plan: Add merge windows to Tab Hoor

## Goal
Replace external merge extension link with built-in window merging.

## Changes

### 1. `extension/background.js`
- Add `mergeAllWindows()` function:
  - Get active window via `api.windows.getLastFocused({ windowTypes: ['normal'] })`
  - Query all tabs, filter out tabs already in active window
  - Bulk move remaining tabs to active window with `api.tabs.move()`
  - Re-pin any tabs that were pinned (pins don't survive `tabs.move`)
  - Close now-empty source windows
  - Return `{ merged, closed }` count
- Add `MERGE_WINDOWS` case to `api.runtime.onMessage` listener
- Return `{ merged, closed }` response

### 2. `extension/popup/popup.js`
- Change `lnkMerge` click handler to send `MERGE_WINDOWS` message instead of opening external URL
- Show "merging…" → "merged N tabs" feedback (same pattern as dedupe)
- Trigger `REFRESH` after merge so badge updates
- Remove unused `browserLinks()` function

### 3. `extension/popup/popup.html`
- No change needed. Existing `lnkMerge` anchor works as action link.

### 4. Permissions
- No manifest changes. `tabs` permission already covers `windows.getAll`, `tabs.query`, `tabs.move`, `windows.remove`.

## Files touched
- `extension/background.js`
- `extension/popup/popup.js`

## Verification
- Run `npm run build` to confirm build passes
- Check `dist/` output