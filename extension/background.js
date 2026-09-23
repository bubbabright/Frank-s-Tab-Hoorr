// Tab Hoor — MV3 background (Chrome service worker / Firefox event page)
'use strict';

// Chrome service worker loads this file alone — pull in shared data + the
// sqlite history store. Firefox lists them before this file in background.scripts.
if (typeof importScripts === 'function' && typeof TH_DEFAULT_SETTINGS === 'undefined') {
  importScripts('data.js', 'lib/sql-wasm.js', 'db.js');
}

const api = globalThis.browser || globalThis.chrome;
const ALARM_SAMPLE = 'th-sample';
const ALARM_IDLE = 'th-idle';
const IDLE_CHECK_MINUTES = 5; // how often we scan for idle tabs, independent of idleMinutes threshold

// In-memory counts. SW/event-page restarts reset these to 0 — never paint the
// badge from them until queryTabs() has run at least once this lifetime.
let tabCount = 0;
let windowCount = 0;
let countsReady = false;
let refreshChain = Promise.resolve();

// ── storage ──────────────────────────────────────────────────────────────────

function getAll() {
  return api.storage.local.get(null).then(d => d || {});
}

function setPartial(patch) {
  return api.storage.local.set(patch);
}

/** Settings-only read — avoids pulling the (potentially 50k-entry) samples blob. */
function getSettings() {
  return api.storage.local.get('settings').then(d =>
    Object.assign({}, TH_DEFAULT_SETTINGS, (d && d.settings) || {})
  );
}

/** Append one entry to the action log, pruned by the current retention setting. */
async function logAction(entry) {
  const settings = await getSettings();
  const full = Object.assign({ ts: Date.now() }, entry);
  const maxAge = thRetentionMs(settings.retention);
  if (settings.historyBackend === 'legacy') {
    const data = await getAll();
    let actions = (data.actions || []).slice();
    actions.push(full);
    if (maxAge !== Infinity) {
      const cutoff = Date.now() - maxAge;
      actions = actions.filter(a => a.ts >= cutoff);
    }
    if (actions.length > 500) actions = actions.slice(-500);
    await setPartial({ actions });
    return;
  }
  await thDbInsertAction(full);
  // No row cap when retention is 'all' — that's the whole point of the sqlite backend.
  await thDbPruneActions(maxAge !== Infinity ? Date.now() - maxAge : null, maxAge !== Infinity ? 500 : null);
}

// ── toolbar icon ─────────────────────────────────────────────────────────────

const ICON_SIZES = [16, 32];
const DEFAULT_ICON = {
  16: 'icons/icon-16.png',
  32: 'icons/icon-32.png',
  48: 'icons/icon-48.png',
  96: 'icons/icon-96.png',
  128: 'icons/icon-128.png'
};

// What is currently painted, so we don't redraw on every refresh.
let paintedIcon = null;

function makeCanvas(size) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(size, size);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Big centred tab count on the dark tile. The browser badge font is fixed and
// tiny, so the number is drawn into the icon instead of the badge.
function drawCountIcon(size, count, color) {
  const ctx = makeCanvas(size).getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#111111';
  roundRect(ctx, 0.5, 0.5, size - 1, size - 1, Math.max(2, size * 0.18));
  ctx.fill();

  const text = count > 999 ? '1k' : String(count);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fs = size * 0.92;
  while (fs > 4) {
    ctx.font = `bold ${fs}px Arial, sans-serif`;
    if (ctx.measureText(text).width <= size * 0.86) break;
    fs -= 1;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, size / 2, size / 2 + size * 0.04);
  return ctx.getImageData(0, 0, size, size);
}

async function paintCount(count) {
  const tone = thTone(count);
  const color = TH_BADGE_COLORS[tone] || '#ffd700';
  const key = `count:${count}`;
  if (paintedIcon === key) return;
  const imageData = {};
  for (const size of ICON_SIZES) imageData[size] = drawCountIcon(size, count, color);
  await api.action.setIcon({ imageData });
  paintedIcon = key;
}

async function paintDefaultIcon() {
  if (paintedIcon === 'default') return;
  await api.action.setIcon({ path: DEFAULT_ICON });
  paintedIcon = 'default';
}

function updateBadge(count, settings) {
  settings = settings || {};
  // The count lives in the icon now, so the browser badge square is never used.
  const clear = api.action.setBadgeText({ text: '' });
  const off = !countsReady || settings.badgeMode === 'off';
  return Promise.all([clear, off ? paintDefaultIcon() : paintCount(count)]);
}

// ── counts ───────────────────────────────────────────────────────────────────

async function queryTabs() {
  const [tabs, wins] = await Promise.all([
    api.tabs.query({}),
    api.windows.getAll({ windowTypes: ['normal'] })
  ]);
  tabCount = tabs ? tabs.length : 0;
  windowCount = wins ? wins.length : 0;
  countsReady = true;
  return { tabCount, windowCount };
}

/** Serialize refreshes so a stale storage listener can't paint badge=0 after a good query. */
function refreshCounts() {
  refreshChain = refreshChain.then(doRefreshCounts).catch(err => {
    console.error('Tab Hoor refreshCounts', err);
  });
  return refreshChain;
}

async function doRefreshCounts() {
  await queryTabs();
  await onCountUpdate();
}

async function getAthState(settings) {
  if (settings.historyBackend === 'legacy') {
    const data = await getAll();
    return { ath: data.ath || 0, athDate: data.athDate || '' };
  }
  return {
    ath: parseInt(await thDbGetMeta('ath'), 10) || 0,
    athDate: (await thDbGetMeta('athDate')) || ''
  };
}

async function setAthState(settings, ath, athDate) {
  if (settings.historyBackend === 'legacy') {
    await setPartial({ ath, athDate });
  } else {
    await thDbSetMeta('ath', ath);
    await thDbSetMeta('athDate', athDate);
  }
}

async function onCountUpdate() {
  const settings = await getSettings();
  const { ath } = await getAthState(settings);
  if (tabCount > ath) {
    await setAthState(settings, tabCount, thFormatDate(Date.now()));
  }
  await updateBadge(tabCount, settings);
  if (settings.sampling === 'evt') await recordSample();
}

// ── history samples ──────────────────────────────────────────────────────────

async function recordSample() {
  const settings = await getSettings();
  const maxAge = thRetentionMs(settings.retention);
  if (settings.historyBackend === 'legacy') {
    const data = await getAll();
    let samples = data.samples || [];
    samples.push({ ts: Date.now(), t: tabCount, w: windowCount });
    if (maxAge !== Infinity) {
      const cutoff = Date.now() - maxAge;
      samples = samples.filter(s => s.ts >= cutoff);
    }
    if (samples.length > 50000) samples = samples.slice(-50000);
    await setPartial({ samples });
    return;
  }
  await thDbInsertSample(Date.now(), tabCount, windowCount);
  // No row cap when retention is 'all' — that's the whole point of the sqlite backend
  // (storage.local's array approach is what needed the ~50k/~90d safety net).
  await thDbPruneSamples(maxAge !== Infinity ? Date.now() - maxAge : null, maxAge !== Infinity ? 50000 : null);
}

async function ensureSamplingAlarm(settings) {
  settings = settings || TH_DEFAULT_SETTINGS;
  await api.alarms.clear(ALARM_SAMPLE);
  const mins = thSamplingMinutes(settings.sampling);
  if (mins) {
    await api.alarms.create(ALARM_SAMPLE, { periodInMinutes: mins });
  }
}

// ── duplicate tabs (ported from duplicate-tabs-closer, minimal: exact URL match) ──────────────

async function dedupeTabs() {
  const closeIds = await findDupeIds();
  if (closeIds.length) {
    await api.tabs.remove(closeIds);
    await logAction({ kind: 'dedupe', closed: closeIds.length });
  }
  return closeIds.length;
}

async function findDupeIds() {
  const settings = await getSettings();
  const tabs = await api.tabs.query({});
  const seen = new Map(); // normalized url -> tab to keep
  const closeIds = [];
  // Prefer keeping a pinned tab, then the active tab, then the oldest tab id.
  const sorted = tabs.slice().sort((a, b) => {
    if (settings.dedupeKeepPinned && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (settings.dedupeKeepActive && a.active !== b.active) return a.active ? -1 : 1;
    return (a.id || 0) - (b.id || 0);
  });
  for (const tab of sorted) {
    if (!tab.url) continue;
    const key = thNormalizeUrl(tab.url, settings);
    if (seen.has(key)) {
      closeIds.push(tab.id);
    } else {
      seen.set(key, tab);
    }
  }
  return closeIds;
}

// ── idle tab cleanup (ported from FFTabClose: close idle tabs, discard idle pinned tabs) ──────

// Tabs that a threshold would catch: idle normal tabs (close) and idle pinned
// tabs (discard/unload). Active and audio-playing tabs are always safe.
async function idleCandidates(thresholdMs) {
  const now = Date.now();
  const tabs = await api.tabs.query({});
  const closeIds = [];
  const discardIds = [];
  for (const tab of tabs) {
    if (tab.active || tab.audible) continue;
    if (tab.discarded) continue;
    const lastAccessed = tab.lastAccessed || 0;
    if (now - lastAccessed < thresholdMs) continue;
    if (tab.pinned) discardIds.push(tab.id);
    else closeIds.push(tab.id);
  }
  return { closeIds, discardIds };
}

// Shared by the automatic idle-cleanup alarm and the popup's manual button —
// same sweep, different threshold source and action-log kind.
async function sweepIdleTabs(thresholdMs, kind) {
  const { closeIds, discardIds } = await idleCandidates(thresholdMs);
  if (closeIds.length) await api.tabs.remove(closeIds);
  for (const id of discardIds) {
    try { await api.tabs.discard(id); } catch (err) { console.error('Tab Hoor discard', err); }
  }
  if (closeIds.length || discardIds.length) {
    await logAction({ kind, closed: closeIds.length, discarded: discardIds.length });
  }
  return { closed: closeIds.length, discarded: discardIds.length };
}

async function checkIdleTabs() {
  const settings = await getSettings();
  if (!settings.idleEnabled) return { closed: 0, discarded: 0 };
  return sweepIdleTabs((settings.idleMinutes || 30) * 60000, 'idle');
}

async function ensureIdleAlarm(settings) {
  settings = settings || TH_DEFAULT_SETTINGS;
  await api.alarms.clear(ALARM_IDLE);
  if (settings.idleEnabled) {
    await api.alarms.create(ALARM_IDLE, { periodInMinutes: IDLE_CHECK_MINUTES });
  }
}

// ── auto tab grouping (ported from firefox-auto-tab-grouping, Firefox-only tabGroups API) ─────

// tabGroups.TAB_GROUP_ID_NONE is -1; a real group id can be 0, which `groupId && ...`
// would wrongly treat as falsy/ungrouped, so check the type instead of truthiness.
function thIsGrouped(t) {
  return typeof t.groupId === 'number' && t.groupId !== -1;
}

async function groupTabIfMatch(tab) {
  if (!api.tabGroups || !tab || !tab.url) return;
  const settings = await getSettings();
  if (!settings.groupingEnabled) return;
  // Pinned tabs can't be grouped; tab already in a group? Leave it alone rather than re-shuffling.
  if (tab.pinned || thIsGrouped(tab)) return;

  // Auto tab grouping is domain-only — named after the tab's registrable domain,
  // and only once groupingAutoMinTabs tabs share it (default 2, so lone tabs
  // don't each get their own group unless the user lowers the threshold to 1).
  const name = thDomainOf(tab.url);
  if (!name) return;

  try {
    // Don't trust the API's own title filter — some tabGroups implementations
    // ignore it and return every group in the window, which would dump this
    // tab into an unrelated existing group. Filter client-side to be sure.
    const groups = (await api.tabGroups.query({ windowId: tab.windowId }) || [])
      .filter(g => g.title === name);
    if (groups.length) {
      await api.tabs.group({ tabIds: [tab.id], groupId: groups[0].id });
      return;
    }
    const all = await api.tabs.query({ windowId: tab.windowId });
    const siblings = all.filter(t =>
      t.id !== tab.id && !t.pinned && !thIsGrouped(t) && thDomainOf(t.url) === name);
    const minTabs = settings.groupingAutoMinTabs || 2;
    if (1 + siblings.length < minTabs) return;
    const tabIds = [tab.id].concat(siblings.map(t => t.id));
    const groupId = await api.tabs.group({ tabIds });
    await api.tabGroups.update(groupId, { title: name });
  } catch (err) {
    console.error('Tab Hoor groupTabIfMatch', err);
  }
}

// Serialize so two events for one tab can't both create a same-named group.
let groupChain = Promise.resolve();
function queueGroup(tab) {
  groupChain = groupChain
    .then(() => groupTabIfMatch(tab))
    .catch(err => console.error('Tab Hoor queueGroup', err));
  return groupChain;
}

async function groupExistingTabs() {
  if (!api.tabGroups) return;
  const tabs = await api.tabs.query({});
  for (const tab of tabs) await queueGroup(tab);
}

// Tabs in a window eligible for manual grouping: not pinned, not already grouped, resolvable domain.
async function ungroupedEligibleTabs(windowId) {
  const tabs = await api.tabs.query({ windowId });
  return tabs
    .filter(t => !t.pinned && !thIsGrouped(t))
    .map(t => ({ tab: t, name: t.url ? thDomainOf(t.url) : null }))
    .filter(x => x.name);
}

// Buckets eligible tabs by domain, dropping buckets that don't meet groupingAutoMinTabs.
async function groupableBuckets(windowId) {
  const settings = await getSettings();
  const minTabs = settings.groupingAutoMinTabs || 2;
  const eligible = await ungroupedEligibleTabs(windowId);
  const buckets = new Map();
  for (const { tab, name } of eligible) {
    if (!buckets.has(name)) buckets.set(name, { tabIds: [] });
    buckets.get(name).tabIds.push(tab.id);
  }
  for (const [name, b] of buckets) {
    if (b.tabIds.length < minTabs) buckets.delete(name);
  }
  return buckets;
}

// Manual "Group" action: buckets every ungrouped tab in the window by domain,
// respecting groupingAutoMinTabs.
async function groupWindowNow(windowId) {
  if (!api.tabGroups) return 0;
  const buckets = await groupableBuckets(windowId);
  let grouped = 0;
  for (const [name, { tabIds }] of buckets) {
    // Same client-side title filter as groupTabIfMatch — see comment there.
    const groups = (await api.tabGroups.query({ windowId }) || []).filter(g => g.title === name);
    if (groups.length) {
      await api.tabs.group({ tabIds, groupId: groups[0].id });
    } else {
      const groupId = await api.tabs.group({ tabIds });
      await api.tabGroups.update(groupId, { title: name });
    }
    grouped += tabIds.length;
  }
  return grouped;
}

// Manual "Ungroup" action: dissolves every tab group in the window.
async function ungroupWindowNow(windowId) {
  if (!api.tabGroups) return 0;
  const tabs = await api.tabs.query({ windowId });
  const groupedIds = tabs.filter(thIsGrouped).map(t => t.id);
  if (!groupedIds.length) return 0;
  try {
    await api.tabs.ungroup(groupedIds);
    return groupedIds.length;
  } catch (err) {
    // Some tabGroups implementations don't accept a bulk array — retry one at a time
    // so a single bad id doesn't sink the whole action.
    console.error('Tab Hoor ungroup (bulk) — retrying individually', err);
    let ok = 0;
    for (const id of groupedIds) {
      try { await api.tabs.ungroup(id); ok++; }
      catch (e) { console.error('Tab Hoor ungroup', id, e); }
    }
    return ok;
  }
}

async function focusedWindowId() {
  const win = await api.windows.getLastFocused({ windowTypes: ['normal'] });
  return win && win.id;
}

// ── merge windows ────────────────────────────────────────────────────────────

// Tabs outside the focused window; the set mergeAllWindows would move into it.
async function findMergeTabs() {
  const activeWindow = await api.windows.getLastFocused({ windowTypes: ['normal'] });
  if (!activeWindow) return { activeWindow: null, otherTabs: [] };
  const allTabs = await api.tabs.query({});
  return { activeWindow, otherTabs: allTabs.filter(t => t.windowId !== activeWindow.id) };
}

async function mergeAllWindows() {
  const { activeWindow, otherTabs } = await findMergeTabs();
  if (!activeWindow || !otherTabs.length) return { merged: 0, closed: 0 };

  // tabs.move does not preserve pinned status — record and re-pin afterward.
  const pinnedIds = new Set(otherTabs.filter(t => t.pinned).map(t => t.id));

  const tabIds = otherTabs.map(t => t.id);
  await api.tabs.move(tabIds, { windowId: activeWindow.id, index: -1 });

  for (const id of pinnedIds) {
    try { await api.tabs.update(id, { pinned: true }); }
    catch (err) { console.error('Tab Hoor merge pin', err); }
  }

  // Close windows that are now empty. Browsers typically auto-close a window
  // once its last tab is moved out, so query/remove throwing "no such window"
  // means it's already gone — that still counts as closed.
  const otherWindowIds = [...new Set(otherTabs.map(t => t.windowId))];
  let closed = 0;
  for (const wid of otherWindowIds) {
    try {
      const remaining = await api.tabs.query({ windowId: wid });
      if (remaining.length === 0) await api.windows.remove(wid);
    } catch (err) {
      // Already auto-closed by the browser.
    }
    closed++;
  }

  return { merged: otherTabs.length, closed };
}

// ── messaging ────────────────────────────────────────────────────────────────

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'GET_STATE') {
    // Always re-query — cached tabCount is 0 after every SW/event-page restart.
    queryTabs()
      .then(() => getSettings())
      .then(async settings => {
        // Keep badge in sync while we're here (options/popup open often wake the worker).
        updateBadge(tabCount, settings);
        const { ath, athDate } = await getAthState(settings);
        const cutoff = Date.now() - 14 * 86400000;
        const samples = settings.historyBackend === 'legacy'
          ? (await getAll()).samples || []
          : await thDbGetSamples(cutoff);
        const trendSamples = settings.historyBackend === 'legacy'
          ? samples.filter(s => s.ts >= cutoff)
          : samples;
        sendResponse({
          tabCount,
          windowCount,
          tone: thTone(tabCount),
          ath,
          athDate,
          trend: thTrend14(trendSamples)
        });
      })
      .catch(err => {
        console.error('Tab Hoor GET_STATE', err);
        sendResponse(null);
      });
    return true;
  }
  if (msg && msg.type === 'GET_HISTORY') {
    getSettings().then(async settings => {
      if (settings.historyBackend === 'legacy') {
        const data = await getAll();
        return sendResponse({
          samples: data.samples || [], actions: data.actions || [],
          ath: data.ath || 0, athDate: data.athDate || ''
        });
      }
      const [samples, actions, ath, athDate] = await Promise.all([
        thDbGetSamples(null), thDbGetActions(null), thDbGetMeta('ath'), thDbGetMeta('athDate')
      ]);
      sendResponse({ samples, actions, ath: parseInt(ath, 10) || 0, athDate: athDate || '' });
    }).catch(err => {
      console.error('Tab Hoor GET_HISTORY', err);
      sendResponse(null);
    });
    return true;
  }
  if (msg && msg.type === 'CLEAR_SAMPLES') {
    getSettings()
      .then(s => s.historyBackend === 'legacy' ? setPartial({ samples: [] }) : thDbClearSamples())
      .then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg && msg.type === 'CLEAR_ACTIONS') {
    getSettings()
      .then(s => s.historyBackend === 'legacy' ? setPartial({ actions: [] }) : thDbClearActions())
      .then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg && msg.type === 'RECORD_SAMPLE') {
    queryTabs()
      .then(() => recordSample())
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg && msg.type === 'REFRESH') {
    refreshCounts().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg && msg.type === 'DEDUPE_TABS') {
    if (msg.dryRun) {
      findDupeIds()
        .then(ids => sendResponse({ count: ids.length }))
        .catch(() => sendResponse({ count: 0 }));
      return true;
    }
    dedupeTabs()
      .then(count => sendResponse({ closed: count }))
      .catch(() => sendResponse({ closed: 0 }));
    return true;
  }
  if (msg && msg.type === 'CLOSE_OLD_TABS') {
    const cutoff = Date.now() - msg.maxAge;
    api.tabs.query({}).then(tabs => {
      const closeIds = [];
      const discardIds = [];
      for (const t of tabs) {
        if (t.active || t.audible || t.discarded) continue;
        if (t.lastAccessed < cutoff) {
          if (t.pinned) discardIds.push(t.id);
          else closeIds.push(t.id);
        }
      }
      if (msg.dryRun) return sendResponse({ closed: closeIds.length, discarded: discardIds.length });
      
      return Promise.all([
        closeIds.length ? api.tabs.remove(closeIds) : Promise.resolve(),
        ...discardIds.map(id => api.tabs.discard(id).catch(() => {}))
      ]).then(() => {
        if (!closeIds.length && !discardIds.length) return;
        return logAction({ kind: 'old', closed: closeIds.length, discarded: discardIds.length });
      }).then(() => {
        sendResponse({ closed: closeIds.length, discarded: discardIds.length });
      });
    }).catch(err => {
      console.error('Tab Hoor CLOSE_OLD_TABS', err);
      sendResponse(msg.dryRun ? { closed: 0, discarded: 0 } : { closed: 0, discarded: 0 });
    });
    return true;
  }
  if (msg && msg.type === 'IDLE_CLEANUP_NOW') {
    if (msg.dryRun) {
      idleCandidates(msg.maxAge)
        .then(({ closeIds, discardIds }) => sendResponse({ closed: closeIds.length, discarded: discardIds.length }))
        .catch(() => sendResponse({ closed: 0, discarded: 0 }));
      return true;
    }
    sweepIdleTabs(msg.maxAge, 'idleManual')
      .then(result => sendResponse(result))
      .catch(err => {
        console.error('Tab Hoor IDLE_CLEANUP_NOW', err);
        sendResponse({ closed: 0, discarded: 0 });
      });
    return true;
  }
  if (msg && msg.type === 'GROUP_TABS') {
    focusedWindowId().then(async windowId => {
      if (!windowId) return sendResponse(msg.dryRun ? { count: 0 } : { grouped: 0 });
      if (msg.dryRun) {
        const buckets = await groupableBuckets(windowId);
        let count = 0;
        for (const { tabIds } of buckets.values()) count += tabIds.length;
        return sendResponse({ count });
      }
      const grouped = await groupWindowNow(windowId);
      sendResponse({ grouped });
    }).catch(err => {
      console.error('Tab Hoor GROUP_TABS', err);
      sendResponse(msg.dryRun ? { count: 0 } : { grouped: 0 });
    });
    return true;
  }
  if (msg && msg.type === 'UNGROUP_TABS') {
    focusedWindowId().then(async windowId => {
      if (!windowId) return sendResponse(msg.dryRun ? { count: 0 } : { ungrouped: 0 });
      if (msg.dryRun) {
        const tabs = await api.tabs.query({ windowId });
        const count = tabs.filter(thIsGrouped).length;
        return sendResponse({ count });
      }
      const ungrouped = await ungroupWindowNow(windowId);
      sendResponse({ ungrouped });
    }).catch(err => {
      console.error('Tab Hoor UNGROUP_TABS', err);
      sendResponse(msg.dryRun ? { count: 0 } : { ungrouped: 0 });
    });
    return true;
  }
  if (msg && msg.type === 'MERGE_WINDOWS') {
    if (msg.dryRun) {
      findMergeTabs()
        .then(({ otherTabs }) => sendResponse({
          windows: new Set(otherTabs.map(t => t.windowId)).size,
          tabs: otherTabs.length
        }))
        .catch(() => sendResponse({ windows: 0, tabs: 0 }));
      return true;
    }
    mergeAllWindows().then(async result => {
      if (result.merged) await logAction({ kind: 'merge', tabs: result.merged, windows: result.closed });
      sendResponse({ merged: result.merged, closed: result.closed });
    }).catch(err => {
      console.error('Tab Hoor merge windows', err);
      sendResponse({ merged: 0, closed: 0 });
    });
    return true;
  }
});

// ── events ───────────────────────────────────────────────────────────────────

api.tabs.onCreated.addListener(tab => { refreshCounts(); queueGroup(tab); });
api.tabs.onRemoved.addListener(() => { refreshCounts(); });
api.tabs.onReplaced.addListener(() => { refreshCounts(); });
api.windows.onCreated.addListener(() => { refreshCounts(); });
api.windows.onRemoved.addListener(() => { refreshCounts(); });

// status 'complete' also covers reloads and same-URL navigations, which never report changeInfo.url.
api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') queueGroup(tab);
});

api.tabs.onActivated.addListener(({ tabId }) => {
  api.tabs.get(tabId).then(queueGroup).catch(() => {});
});

api.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_SAMPLE) {
    // Re-query first so a slept worker doesn't record t:0.
    queryTabs().then(() => recordSample());
  }
  if (alarm.name === ALARM_IDLE) {
    checkIdleTabs().catch(err => console.error('Tab Hoor checkIdleTabs', err));
  }
});

api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) {
    const s = Object.assign({}, TH_DEFAULT_SETTINGS, changes.settings.newValue || {});
    ensureSamplingAlarm(s);
    ensureIdleAlarm(s);
    // Never badge from stale in-memory count (was painting "0" on settings save).
    refreshCounts();
    const old = changes.settings.oldValue || {};
    if (s.groupingEnabled && (!old.groupingEnabled || old.groupingAutoMinTabs !== s.groupingAutoMinTabs)) {
      groupExistingTabs().catch(err => console.error('Tab Hoor groupExistingTabs', err));
    }
    const oldBackend = old.historyBackend || TH_DEFAULT_SETTINGS.historyBackend;
    if (s.historyBackend !== oldBackend) {
      switchHistoryBackend(s.historyBackend).catch(err => console.error('Tab Hoor switchHistoryBackend', err));
    }
  }
});

// Best-effort sync so switching backends doesn't strand data on the side you're leaving.
async function switchHistoryBackend(newBackend) {
  if (newBackend === 'sqlite') {
    const data = await getAll();
    await thDbImportFromLocal(data.samples || [], data.actions || [], data.ath || 0, data.athDate || '');
  } else {
    const [samples, actions, ath, athDate] = await Promise.all([
      thDbGetSamples(null), thDbGetActions(null), thDbGetMeta('ath'), thDbGetMeta('athDate')
    ]);
    // Legacy storage.local has no db behind it — cap to the same safety nets recordSample/logAction use.
    await setPartial({
      samples: samples.length > 50000 ? samples.slice(-50000) : samples,
      actions: actions.length > 500 ? actions.slice(-500) : actions,
      ath: parseInt(ath, 10) || 0,
      athDate: athDate || ''
    });
  }
}

api.runtime.onInstalled.addListener(async () => {
  const data = await getAll();
  if (!data.settings) await setPartial({ settings: TH_DEFAULT_SETTINGS });
  if (!data.installedDate) await setPartial({ installedDate: new Date().toISOString() });
  await ensureSamplingAlarm(Object.assign({}, TH_DEFAULT_SETTINGS, data.settings || {}));
  await ensureIdleAlarm(Object.assign({}, TH_DEFAULT_SETTINGS, data.settings || {}));
  await refreshCounts();
  setTimeout(() => recordSample(), 1500);
  groupExistingTabs().catch(err => console.error('Tab Hoor groupExistingTabs', err));
});

api.runtime.onStartup.addListener(async () => {
  const data = await getAll();
  await ensureSamplingAlarm(Object.assign({}, TH_DEFAULT_SETTINGS, data.settings || {}));
  await ensureIdleAlarm(Object.assign({}, TH_DEFAULT_SETTINGS, data.settings || {}));
  await refreshCounts();
  setTimeout(() => recordSample(), 1500);
  groupExistingTabs().catch(err => console.error('Tab Hoor groupExistingTabs', err));
});

// Drop stored state from removed features (achievements, ranks). Idempotent.
function migrateLegacy(data) {
  const jobs = [];
  const stale = ['achievements', '_belowAth'].filter(k => k in data);
  if (stale.length) jobs.push(api.storage.local.remove(stale));
  const s = data.settings;
  if (s && ('showHints' in s || s.badgeMode === 'rank')) {
    const settings = Object.assign({}, s);
    delete settings.showHints;
    if (settings.badgeMode === 'rank') settings.badgeMode = 'count';
    jobs.push(setPartial({ settings }));
  }
  return Promise.all(jobs);
}

// Cold start (service worker wake)
getAll().then(data => {
  migrateLegacy(data).catch(err => console.error('Tab Hoor migrateLegacy', err));
  ensureSamplingAlarm(Object.assign({}, TH_DEFAULT_SETTINGS, data.settings || {}));
  ensureIdleAlarm(Object.assign({}, TH_DEFAULT_SETTINGS, data.settings || {}));
  refreshCounts();
});
