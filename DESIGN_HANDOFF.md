# Tab Hoor — Design Notes

Current UI reference (v0.6). The original v0.1 handoff, with the rank/achievement/Frank Reynolds design, is in git history.

## Surfaces

- **Toolbar icon:** live tab count drawn large into the icon itself, coloured by size (or the plain logo, see badge mode). No browser badge square is used.
- **Popup** (340px wide, dark): header with version, action buttons, tab count with window count, all-time high and 14-day trend.
  - Actions: Close Dupes, Merge Windows (row 1); a minimum-idle-age select plus Close Old Tabs (row 2). Each label shows how many tabs/windows it would act on and disables at zero.
- **Options page** (opens in a tab): auto tab grouping, close-duplicates rules, idle cleanup, badge mode, history sampling/retention, data export/import. Changes save immediately with a toast.
- **History page:** count over time with ranges, chart, per-day list, action log (what Tab Hoor closed/discarded/merged, auto or manual) and CSV export.

## Look

- Dark only. Background `#111111`, sections `#1c1c1c`, cards `#242424`, borders `#333333`.
- Accent gold `#ffd700` (header rule, buttons); dim gold `#997f00` for borders.
- Headings and buttons in Arial Black, body in Arial. No external fonts or CDNs; everything ships in the package.
- Count colour and badge colour follow tab count: green up to 15, orange up to 50, red up to 150, purple above (`thTone` in `extension/data.js`).

## Constraints

- Counts only: no URLs or page content are stored or sent anywhere.
- Popup must fit without scrolling (cap 560px).
- Icons: PNG at 16/32/48/96/128 in `extension/icons/`.
- Auto tab grouping needs Firefox's `tabGroups` API; the options card hides itself elsewhere.

## Tone

Plain and functional. The only leftover from the original joke tone is the popup's "FEELING OVERWHELMED?" actions title.
