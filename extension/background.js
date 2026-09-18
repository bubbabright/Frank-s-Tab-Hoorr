// Tab Hoor — MV3 background (Chrome service worker / Firefox event page)
'use strict';

// Chrome service worker loads this file alone — pull in shared data.
// Firefox lists data.js before this file in background.scripts.
if (typeof importScripts === 'function' && typeof TH_DEFAULT_SETTINGS === 'undefined') {
  importScripts('data.js');
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

// ── badge ────────────────────────────────────────────────────────────────────

function updateBadge(count, settings) {
  settings = settings || {};
  const color = TH_BADGE_COLORS[thTone(count)] || '#3db85a';
  // Avoid flashing "0" while the worker is still querying after a wake; mode 'off' → empty.
  let text = '';
  if (countsReady && settings.badgeMode !== 'off') {
    text = count > 999 ? '999+' : String(count);
  }
  return Promise.all([
    api.action.setBadgeText({ text }),
    api.action.setBadgeBackgroundColor({ color })
  ]);
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

async function onCountUpdate() {
  const data = await getAll();
  const settings = Object.assign({}, TH_DEFAULT_SETTINGS, data.settings || {});
  let ath = data.ath || 0;
  let athDate = data.athDate || '';
  if (tabCount > ath) {
    ath = tabCount;
    athDate = thFormatDate(Date.now());
    await setPartial({ ath, athDate });
  }
  await updateBadge(tabCount, settings);
  if (settings.sampling === 'evt') await recordSample();
}

// ── history samples ──────────────────────────────────────────────────────────

async function recordSample() {
  const data = await getAll();
  const settings = Object.assign({}, TH_DEFAULT_SETTINGS, data.settings || {});
  let samples = data.samples || [];
  samples.push({ ts: Date.now(), t: tabCount, w: windowCount });
  const maxAge = thRetentionMs(settings.retention);
  if (maxAge !== Infinity) {
    const cutoff = Date.now() - maxAge;
    samples = samples.filter(s => s.ts >= cutoff);
  }
  // Cap length as a safety net (~90d @ 1m ≈ 130k samples; keep ≤ 50k)
  if (samples.length > 50000) samples = samples.slice(-50000);
  await setPartial({ samples });
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
  if (closeIds.length) await api.tabs.remove(closeIds);
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

async function checkIdleTabs() {
  const settings = await getSettings();
  if (!settings.idleEnabled) return { closed: 0, discarded: 0 };

  const thresholdMs = (settings.idleMinutes || 30) * 60000;
  const now = Date.now();
  const tabs = await api.tabs.query({});
  const closeIds = [];
  const discardIds = [];

  for (const tab of tabs) {
    if (tab.active || tab.audible) continue;
    if (tab.discarded) continue;
    const lastAccessed = tab.lastAccessed || 0;
    if (now - lastAccessed < thresholdMs) continue;
    if (tab.pinned) {
      discardIds.push(tab.id);
    } else {
      closeIds.push(tab.id);
    }
  }

  if (closeIds.length) await api.tabs.remove(closeIds);
  for (const id of discardIds) {
    try { await api.tabs.discard(id); } catch (err) { console.error('Tab Hoor discard', err); }
  }
  return { closed: closeIds.length, discarded: discardIds.length };
}

async function ensureIdleAlarm(settings) {
  settings = settings || TH_DEFAULT_SETTINGS;
  await api.alarms.clear(ALARM_IDLE);
  if (settings.idleEnabled) {
    await api.alarms.create(ALARM_IDLE, { periodInMinutes: IDLE_CHECK_MINUTES });
  }
}

// ── auto tab grouping (ported from firefox-auto-tab-grouping, Firefox-only tabGroups API) ─────

async function groupTabIfMatch(tab) {
  if (!api.tabGroups || !tab || !tab.url) return;
  const settings = await getSettings();
  if (!settings.groupingEnabled) return;
  // Pinned tabs can't be grouped; tab already in a group? Leave it alone rather than re-shuffling.
  if (tab.pinned || (tab.groupId && tab.groupId !== -1)) return;

  let hostname;
  try { hostname = new URL(tab.url).hostname.toLowerCase(); } catch (_) { return; }
  const rule = thParseGroupingRules(settings.groupingRules).find(r => hostname.includes(r.pattern));

  // Explicit rules win; otherwise auto mode names the group after the domain,
  // but only once 2+ tabs share it so lone tabs don't each get their own group.
  let name = rule && rule.name;
  let auto = false;
  if (!name && settings.groupingAuto) {
    name = thDomainOf(tab.url);
    auto = true;
  }
  if (!name) return;

  try {
    const groups = await api.tabGroups.query({ windowId: tab.windowId, title: name });
    if (groups && groups.length) {
      await api.tabs.group({ tabIds: [tab.id], groupId: groups[0].id });
      return;
    }
    let tabIds = [tab.id];
    if (auto) {
      const all = await api.tabs.query({ windowId: tab.windowId });
      const siblings = all.filter(t =>
        t.id !== tab.id && !t.pinned && (!t.groupId || t.groupId === -1) && thDomainOf(t.url) === name);
      if (!siblings.length) return;
      tabIds = tabIds.concat(siblings.map(t => t.id));
    }
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
      .then(() => getAll())
      .then(data => {
        const settings = Object.assign({}, TH_DEFAULT_SETTINGS, data.settings || {});
        // Keep badge in sync while we're here (options/popup open often wake the worker).
        updateBadge(tabCount, settings);
        sendResponse({
          tabCount,
          windowCount,
          tone: thTone(tabCount),
          ath: data.ath || 0,
          athDate: data.athDate || '',
          trend: thTrend14(data.samples)
        });
      })
      .catch(err => {
        console.error('Tab Hoor GET_STATE', err);
        sendResponse(null);
      });
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
      const ids = tabs
        .filter(t => !t.active && !t.pinned && t.lastAccessed < cutoff)
        .map(t => t.id);
      if (msg.dryRun) return sendResponse({ count: ids.length });
      return api.tabs.remove(ids).then(() => {
        sendResponse({ closed: ids.length });
      });
    }).catch(() => {
      sendResponse(msg.dryRun ? { count: 0 } : { closed: 0 });
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
    mergeAllWindows().then(result => {
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
    if (s.groupingEnabled && (!old.groupingEnabled || old.groupingRules !== s.groupingRules ||
        old.groupingAuto !== s.groupingAuto)) {
      groupExistingTabs().catch(err => console.error('Tab Hoor groupExistingTabs', err));
    }
  }
});

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
