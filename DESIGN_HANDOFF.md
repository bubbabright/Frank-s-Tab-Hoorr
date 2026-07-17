# Tab Hoor — Design Handoff
**Codename:** frank  
**Handoff to:** Claude Design  
**From:** Daniel + Claude (Engineering)  
**Date:** 2026-05-17  
**Status:** v0.1 functional — ready for design pass

---

## What This Is

**Tab Hoor** is a Firefox browser extension that gamifies tab hoarding. It tracks how many browser tabs and windows you have open, assigns you a rank, and awards achievements — all locally, no data ever leaves the browser.

The tone is Danny DeVito's **Frank Reynolds** from *It's Always Sunny in Philadelphia*. Frank calls everyone a "hoor" (his pronunciation of "whore") with unfiltered, affectionate contempt. The extension leans into this — it's not shaming users, it's *celebrating* them. The deeper intent is that humor and solidarity reduce defensiveness, making users more open to tab management tools.

**The key emotional note:** a tab hoarder should open this popup and feel *seen and delighted*, not judged.

---

## Current State (v0.1)

The extension is fully functional. What exists today:

**Popup UI** (300px wide, opens on toolbar click):
- Live tab count (big number, color-coded)
- Current rank title + Frank quote
- All-time high + date set
- Achievement grid (8 achievements, locked/unlocked states)
- "Feeling overwhelmed?" harm-reduction footer with links to two tab management tools

**Background tracking:**
- Monitors tab + window counts across all events
- Persists state to `browser.storage.local`
- Badge on the toolbar icon shows live tab count

**Color system (current — designed for dark theme):**
- 1–15 tabs: green `#3db85a`
- 16–50 tabs: orange `#e07c35`
- 51–100 tabs: red `#e03535`
- 100+: purple `#9b5fe0`
- Gold `#FFD700` — primary accent, header, rank title

**Current aesthetic:** Dark (`#111111` bg), gold accents, Arial Black for headings. Described internally as "dive bar scoreboard." Functional but rough — this is the engineering prototype, not the finished product.

---

## Rank System

| Tabs | Rank Title | Frank Quote |
|------|-----------|-------------|
| 0–5 | Tab Teetotaler | *"You a hoor? ...No? Not even a little?"* |
| 6–15 | Tab Curious | *"You two aren't bangin' are ya?"* |
| 16–30 | Getting Around | *"Daaah yeah it is. Stay away from that, trust me."* |
| 31–50 | Certified Hoor | *"Now we're talking. Boiling denim territory."* |
| 51–75 | Tab Whore | *"Boiling denim and bangin hoors!"* |
| 76–100 | Dirty Hoor | *"Dennis, your mother is a dirty dirty houer."* |
| 101–150 | Filthy Hoor | *"He says he has sex with hundreds of... tabs."* |
| 151–200 | Legendary Hoor | *"It's a three-syllable word for a REASON."* |
| 201+ | Frank Reynolds Level | *"Bless this wonderful, wonderful hoor."* |

---

## Achievement System

| Icon | ID | Name | Trigger |
|------|----|------|---------|
| 🍀 | first_time | First Time | 1 tab |
| 🥐 | bakers_dozen | Baker's Dozen | 13 tabs |
| 💃 | dirty_thirty | The Dirty Thirty | 30 tabs |
| 🔥 | fifty_club | The Fifty Club | 50 tabs |
| 💯 | triple_digits | Triple Digits | 100 tabs |
| 🪟 | window_dressing | Window Dressing | 5+ windows |
| 🔄 | relapser | The Relapser | Went below ATH, then came back up |
| 👑 | frank_level | Frank Reynolds Level | 200 tabs |

Locked achievements display at 35% opacity with grayscale filter. Unlocked achievements show in a green-tinted card with the unlock date on hover.

---

## Requested Features (v0.2)

### 1. History Chart
A timeline view of tab count and window count over time. Requirements:
- No URLs or browsing data — counts only
- Sampling strategy TBD (every N minutes? on significant change?)
- Should show trends: "you're trending up this week"
- Display: probably a small sparkline or bar chart in the popup, with a "view full history" expanded view

### 2. [PENDING — Daniel to confirm]
Daniel started describing a second feature request and was cut off. **Confirm with Daniel before designing this section.**

---

## File Structure

```
frank/
  manifest.json          Firefox MV2 manifest
  background.js          Tab tracking, badge, storage, achievements
  popup/
    popup.html           Popup shell
    popup.js             Render logic (reads from background via message)
    popup.css            All styles
  icons/
    icon-{16,32,48,96}.png  Programmatically generated placeholder icons
  INSTALL.md             Developer install instructions
  DESIGN_HANDOFF.md      This file
```

---

## Design Constraints

- **Popup width is fixed at 300px** by Firefox convention. Height is flexible (scrolls if needed).
- **No external fonts** — must ship with the extension or use system fonts. Arial Black is currently used; a custom font needs to be bundled.
- **No CDN dependencies** in production — all assets must be local to the extension package.
- **Dark mode only** for v1. Light mode is a future consideration.
- **Icons** — current icons are programmatically generated placeholders (gold tab shape on dark bg). Need real icons at 16, 32, 48, 96px in PNG. SVG source is fine, we'll export.
- **Firefox Add-ons store** review is a future goal — avoid anything that would flag content policy (the name/tone is intentionally edgy but self-aware).

---

## Tone & Reference

- **Primary voice:** Frank Reynolds, Danny DeVito, *It's Always Sunny in Philadelphia*
- **Key phrases:** "hoor" (his pronunciation), "boiling denim and bangin hoors", "dirty dirty houer", turns "hoor" into a 3-syllable word
- **Feel:** Paddy's Pub at 2am. A dive bar scoreboard. Proud of its own grime.
- **NOT:** Shaming, mean-spirited, or punishing. The user is always the hero. Frank is their enthusiastic, unhinged hype man.
- **The footer** ("feeling overwhelmed? close dupes · merge windows") should feel like a warm afterthought from a friend, not a lecture.

---

## Open Questions for Design

1. **What does Daniel's second feature request complete to?** (Was cut off mid-sentence — "history of tab + window counts AND...")
2. Should the rank escalation feel more ceremonial? Any animation on rank-up?
3. History chart — sparkline in the popup, or a separate dedicated page (`history.html`)?
4. Should locked achievements show their unlock condition as a hint, or stay mysterious?
5. Is there a Frank Reynolds illustration / avatar we can commission or generate that works within Firefox store policy?
6. Any interest in a "share your rank" card image generator for social?

---

## Handoff Contacts

| Role | Person |
|------|--------|
| Product / PM | Daniel (danielhbright@gmail.com) |
| Engineering | Claude (this session) |
