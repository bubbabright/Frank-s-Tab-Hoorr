// Tab Hoor — background service
// data.js is loaded first via manifest background.scripts.

'use strict';

var _tabCount = 0;
var _windowCount = 0;
var _samplingTimer = null;

// ─── Storage helpers ─────────────────────────────────────────────────────────

function loadState(cb) {
  browser.storage.local.get(null, function(data) { cb(data || {}); });
}

function savePartial(patch) {
  browser.storage.local.set(patch);
}

// ─── Badge ───────────────────────────────────────────────────────────────────

function updateBadge(tabCount, settings) {
  settings = settings || {};
  var rank = thRankFor(tabCount);
  var color = TH_BADGE_COLORS[rank.tone] || '#3db85a';
  var mode = settings.badgeMode || 'count';
  var text = '';
  if (mode === 'count') {
    text = tabCount > 999 ? '999+' : String(tabCount);
  } else if (mode === 'rank') {
    text = String(thRankIndex(tabCount) + 1);
  }
  browser.browserAction.setBadgeText({ text: text });
  browser.browserAction.setBadgeBackgroundColor({ color: color });
}

// ─── Achievements ─────────────────────────────────────────────────────────────

function checkAchievements(tabCount, windowCount, data) {
  var stored = data.achievements || {};
  var updated = Object.assign({}, stored);
  var changed = false;
  var now = Date.now();

  function unlock(id) {
    if (!updated[id] || !updated[id].unlocked) {
      updated[id] = { unlocked: true, date: thFormatDate(now) };
      changed = true;
    }
  }

  if (tabCount >= 1)   unlock('first_time');
  if (tabCount >= 13)  unlock('bakers_dozen');
  if (tabCount >= 30)  unlock('dirty_thirty');
  if (tabCount >= 50)  unlock('fifty_club');
  if (tabCount >= 100) unlock('triple_digits');
  if (windowCount >= 5) unlock('window_dressing');
  if (tabCount >= 200) unlock('frank_level');

  // Relapser: went below ATH, then came back up past it
  var ath = data.ath || 0;
  var prevWasBelow = data._belowAth || false;
  if (tabCount < ath) {
    if (!prevWasBelow) savePartial({ _belowAth: true });
  } else if (prevWasBelow && tabCount >= ath) {
    unlock('relapser');
    savePartial({ _belowAth: false });
  }

  if (changed) savePartial({ achievements: updated });
}

// ─── Tab/window counting ──────────────────────────────────────────────────────

function refreshCounts() {
  browser.tabs.query({}, function(tabs) {
    _tabCount = tabs ? tabs.length : 0;
    browser.windows.getAll({}, function(wins) {
      _windowCount = wins ? wins.length : 0;
      onCountUpdate();
    });
  });
}

function onCountUpdate() {
  loadState(function(data) {
    var settings = data.settings || {};

    // Update ATH
    var ath = data.ath || 0;
    var athDate = data.athDate || '';
    if (_tabCount > ath) {
      ath = _tabCount;
      athDate = thFormatDate(Date.now());
      savePartial({ ath: ath, athDate: athDate });
    }

    updateBadge(_tabCount, settings);
    checkAchievements(_tabCount, _windowCount, Object.assign({}, data, { ath: ath }));
  });
}

// ─── History sampling ─────────────────────────────────────────────────────────

function recordSample() {
  loadState(function(data) {
    var settings = data.settings || {};
    var samples = data.samples || [];
    var retention = settings.retention || '90d';

    // Push new sample
    samples.push({ ts: Date.now(), t: _tabCount, w: _windowCount });

    // Trim by retention
    var maxAgeMs = {
      '14d': 14 * 86400000,
      '30d': 30 * 86400000,
      '90d': 90 * 86400000,
      'all': Infinity,
    }[retention] || (90 * 86400000);

    var cutoff = Date.now() - maxAgeMs;
    samples = samples.filter(function(s) { return s.ts >= cutoff; });

    savePartial({ samples: samples });
  });
}

function startSamplingTimer(settings) {
  if (_samplingTimer) clearInterval(_samplingTimer);
  settings = settings || {};
  var intervalMs = {
    '1m':  60000,
    '5m':  300000,
    '15m': 900000,
    'evt': null,
  }[settings.sampling || '5m'];

  if (intervalMs) {
    _samplingTimer = setInterval(recordSample, intervalMs);
  }
}

// ─── Storage change listener (settings updates from options page) ─────────────

browser.storage.onChanged.addListener(function(changes) {
  if (changes.settings) {
    var newSettings = changes.settings.newValue || {};
    updateBadge(_tabCount, newSettings);
    startSamplingTimer(newSettings);
  }
});

// ─── Tab event listeners ──────────────────────────────────────────────────────

browser.tabs.onCreated.addListener(refreshCounts);
browser.tabs.onRemoved.addListener(refreshCounts);
browser.tabs.onReplaced.addListener(refreshCounts);

// ─── Window event listeners ───────────────────────────────────────────────────

browser.windows.onCreated.addListener(refreshCounts);
browser.windows.onRemoved.addListener(refreshCounts);

// ─── Init ─────────────────────────────────────────────────────────────────────

loadState(function(data) {
  startSamplingTimer(data.settings);
  refreshCounts();
  // Record an initial sample on startup
  setTimeout(recordSample, 2000);
});
