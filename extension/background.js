// Tab Hoor — MV3 background (Chrome service worker / Firefox event page)
'use strict';

// Chrome service worker loads this file alone — pull in shared data.
// Firefox lists data.js before this file in background.scripts.
if (typeof importScripts === 'function' && typeof TH_RANKS === 'undefined') {
  importScripts('data.js');
}

const api = globalThis.browser || globalThis.chrome;
const ALARM_SAMPLE = 'th-sample';

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

// ── badge ────────────────────────────────────────────────────────────────────

function updateBadge(count, settings) {
  settings = settings || {};
  const rank = thRankFor(count);
  const color = TH_BADGE_COLORS[rank.tone] || '#3db85a';
  const mode = settings.badgeMode || 'count';
  let text = '';
  if (!countsReady) {
    // Avoid flashing "0" while the worker is still querying after a wake.
    text = '';
  } else if (mode === 'count') {
    text = count > 999 ? '999+' : String(count);
  } else if (mode === 'rank') {
    text = String(thRankIndex(count) + 1);
  }
  // mode === 'off' → empty
  return Promise.all([
    api.action.setBadgeText({ text }),
    api.action.setBadgeBackgroundColor({ color })
  ]);
}

// ── achievements ─────────────────────────────────────────────────────────────

function checkAchievements(tCount, wCount, data) {
  const stored = data.achievements || {};
  const updated = Object.assign({}, stored);
  let changed = false;
  const now = Date.now();

  function unlock(id) {
    if (!updated[id] || !updated[id].unlocked) {
      updated[id] = { unlocked: true, date: thFormatDate(now), ts: now };
      changed = true;
    }
  }

  for (const ach of TH_ACHIEVEMENTS) {
    if (ach.type === 'tabs' && tCount >= ach.threshold) unlock(ach.id);
    if (ach.type === 'windows' && wCount >= ach.threshold) unlock(ach.id);
  }

  const ath = data.ath || 0;
  const below = !!data._belowAth;
  if (tCount < ath && ath > 0) {
    if (!below) setPartial({ _belowAth: true });
  } else if (below && tCount >= ath && ath > 0) {
    unlock('relapser');
    setPartial({ _belowAth: false });
  }

  if (changed) return setPartial({ achievements: updated });
  return Promise.resolve();
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
  await checkAchievements(tabCount, windowCount, Object.assign({}, data, { ath }));
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
        const rank = thRankFor(tabCount);
        sendResponse({
          tabCount,
          windowCount,
          rank,
          rankIdx: thRankIndex(tabCount),
          ath: data.ath || 0,
          athDate: data.athDate || '',
          achievements: data.achievements || {},
          samples: data.samples || [],
          settings,
          definitions: TH_ACHIEVEMENTS,
          ranks: TH_RANKS
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
});

// ── events ───────────────────────────────────────────────────────────────────

api.tabs.onCreated.addListener(() => { refreshCounts(); });
api.tabs.onRemoved.addListener(() => { refreshCounts(); });
api.tabs.onReplaced.addListener(() => { refreshCounts(); });
api.windows.onCreated.addListener(() => { refreshCounts(); });
api.windows.onRemoved.addListener(() => { refreshCounts(); });

api.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_SAMPLE) {
    // Re-query first so a slept worker doesn't record t:0.
    queryTabs().then(() => recordSample());
  }
});

api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) {
    const s = Object.assign({}, TH_DEFAULT_SETTINGS, changes.settings.newValue || {});
    ensureSamplingAlarm(s);
    // Never badge from stale in-memory count (was painting "0" on settings save).
    refreshCounts();
  }
});

api.runtime.onInstalled.addListener(async () => {
  const data = await getAll();
  if (!data.settings) await setPartial({ settings: TH_DEFAULT_SETTINGS });
  if (!data.installedDate) await setPartial({ installedDate: new Date().toISOString() });
  await ensureSamplingAlarm(Object.assign({}, TH_DEFAULT_SETTINGS, data.settings || {}));
  await refreshCounts();
  setTimeout(() => recordSample(), 1500);
});

api.runtime.onStartup.addListener(async () => {
  const data = await getAll();
  await ensureSamplingAlarm(Object.assign({}, TH_DEFAULT_SETTINGS, data.settings || {}));
  await refreshCounts();
  setTimeout(() => recordSample(), 1500);
});

// Cold start (service worker wake)
getAll().then(data => {
  ensureSamplingAlarm(Object.assign({}, TH_DEFAULT_SETTINGS, data.settings || {}));
  refreshCounts();
});
