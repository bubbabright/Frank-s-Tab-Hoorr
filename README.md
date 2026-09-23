# Frank's Tab Hoor

**Frank's Tab Hoor** is a local tab management tool for people who hoard tabs, built for Firefox. Named after a certain Always Sunny character's pronunciation of "whore," this extension helps you face your problem, track your habits, and clean up your browser without sacrificing your privacy.

## 📊 Track Your Habit
*   **Tab Count:** The toolbar badge shows your current tab count at a glance.
*   **Visual History:** View a 14-day sparkline and a full history page with 24h, 7d, 30d, 90d, and all-time charts.
*   **Storage Engine:** Choose SQLite (WASM-backed, years of history with no row cap) or Legacy (`storage.local` arrays, capped ~6 months). Switching engines migrates your existing history automatically.

## 🧹 Clean Up Your Mess
*   **Close Duplicates:** Clean up your window with one click. Customize rules to ignore `#fragments`, query strings (`?a=1`), leading "www.", or case sensitivity. Prefer keeping pinned or active tabs.
*   **Merge Windows:** Combine other windows into the current one to reduce desktop clutter.
*   **Group / Ungroup Tabs:** Manually group every eligible tab by domain, or dissolve all groups in the window, on demand.
*   **Idle Cleanup:** Unload idle normal tabs while keeping pinned, active, and audio-playing tabs safe — either automatically (Settings) or on demand from the popup with a free-text duration (`30m`, `1h`, `90m`, `1d`).

## 📂 Auto Tab Grouping
*   Automatically groups tabs by domain as you browse.
*   Set a minimum tab threshold (e.g., only group a site once you have 3+ tabs of it; set to 1 to group every domain immediately).
*   Uses Firefox's native `tabGroups` API.

## 🔒 Privacy & Data
*   **Counts only. No URLs. All local.** We do not store what sites you visit, and no data ever leaves your browser.
*   **Full Control:** Export your settings as JSON to back them up, or import them later. Clear your history at any time.
*   **Custom Polling:** Choose how often tab counts are sampled, from "every tab change" (heavy use) to "every 15 minutes" (light use) to keep storage usage low.

## ⚙️ How to Test

To load synthetic history for testing, open the extension's options page,
open its Firefox Developer Tools console, paste the contents of
`scripts/dev-seed-history.js`, and press Enter. The script writes 90 days of
counts and current-format action records to local storage. Switch the History
storage engine from Legacy to SQLite afterward if you want to test migration.
