// Tab Hoor — shared constants and helpers (codename: frank)
'use strict';

const TH_BADGE_COLORS = {
  green:  '#3db85a',
  amber:  '#e07c35',
  red:    '#e03535',
  purple: '#9b5fe0'
};

const TH_DEFAULT_SETTINGS = {
  badgeMode: 'count',   // count | off
  sampling: '5m',       // 1m | 5m | 15m | evt
  retention: '90d',     // 14d | 30d | 90d | all
  historyBackend: 'sqlite', // sqlite (years, wasm-backed) | legacy (storage.local arrays, capped ~6mo)
  idleEnabled: false,   // auto-close/discard idle tabs (ported from FFTabClose)
  idleMinutes: 30,
  idleTimestamps: {},
  groupingEnabled: false, // auto tab grouping by domain, Firefox only (ported from firefox-auto-tab-grouping)
  groupingAutoMinTabs: 2, // minimum same-domain tabs before auto mode groups them
  groupingUngroupedPosition: 'leave', // leave | start | end
  dedupeIgnoreHash: true,   // treat http://x.com/ and http://x.com/#foo as the same tab
  dedupeIgnoreQuery: false, // treat http://x.com/?a=1 and http://x.com/?a=2 as the same tab
  dedupeIgnoreWww: false,   // treat http://www.x.com and http://x.com as the same tab
  dedupeCaseInsensitive: false,
  dedupeKeepPinned: true,   // prefer keeping a pinned tab over a non-pinned duplicate
  dedupeKeepActive: true,    // prefer keeping the active tab over a background duplicate
};

const TH_BACKUP_VERSION = 1;
const TH_MAX_BACKUP_ROWS = 100000;

function thIsFinitePositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function thValidateHistoryRows(samples, actions) {
  if (!Array.isArray(samples) || !Array.isArray(actions)) throw new Error('history rows must be lists');
  if (samples.length > TH_MAX_BACKUP_ROWS || actions.length > TH_MAX_BACKUP_ROWS) {
    throw new Error('backup contains too many history rows');
  }
  for (const row of samples) {
    if (!row || Object.keys(row).some(key => !['ts', 't', 'w'].includes(key)) ||
        !Number.isSafeInteger(row.ts) || row.ts <= 0 ||
        !Number.isSafeInteger(row.t) || row.t < 0 ||
        !Number.isSafeInteger(row.w) || row.w < 0) {
      throw new Error('invalid sample row');
    }
  }
  for (const row of actions) {
    if (!row || Object.keys(row).some(key => !['ts', 'kind', 'closed', 'discarded', 'tabs', 'windows'].includes(key)) ||
        !Number.isSafeInteger(row.ts) || row.ts <= 0 ||
        typeof row.kind !== 'string' || row.kind.length === 0 || row.kind.length > 64 ||
        !Number.isSafeInteger(row.closed || 0) || row.closed < 0 ||
        !Number.isSafeInteger(row.discarded || 0) || row.discarded < 0 ||
        !Number.isSafeInteger(row.tabs || 0) || row.tabs < 0 ||
        !Number.isSafeInteger(row.windows || 0) || row.windows < 0) {
      throw new Error('invalid action row');
    }
  }
}

function thValidateBackup(payload) {
  if (!payload || payload.formatVersion !== TH_BACKUP_VERSION ||
      !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    throw new Error('unsupported backup format');
  }
  const data = payload.data;
  thValidateHistoryRows(data.samples || [], data.actions || []);
  if ('ath' in data && (!Number.isSafeInteger(data.ath) || data.ath < 0)) {
    throw new Error('invalid all-time high');
  }
  if ('athDate' in data && typeof data.athDate !== 'string') throw new Error('invalid all-time high date');
  if ('settings' in data && (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings))) {
    throw new Error('invalid settings');
  }
  return data;
}

// Colour tone for a tab count (drives badge, popup count and sparkline colour).
function thTone(n) {
  if (n <= 15) return 'green';
  if (n <= 50) return 'amber';
  if (n <= 150) return 'red';
  return 'purple';
}

function thFormatDate(ts) {
  const d = new Date(ts || Date.now());
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

function thRetentionMs(key) {
  return {
    '14d': 14 * 86400000,
    '30d': 30 * 86400000,
    '90d': 90 * 86400000,
    'all': Infinity
  }[key] || 90 * 86400000;
}

function thSamplingMinutes(key) {
  return { '1m': 1, '5m': 5, '15m': 15, 'evt': null }[key] ?? 5;
}

// Last sample per day for the past 14 days, oldest first: [{t}] x14 (t = 0 when a day has no sample).
function thTrend14(samples) {
  const now = Date.now();
  const dayMs = 86400000;
  const byDay = {};
  (samples || []).forEach(s => {
    const daysAgo = Math.floor((now - s.ts) / dayMs);
    if (daysAgo >= 0 && daysAgo < 14 && (!byDay[daysAgo] || s.ts > byDay[daysAgo].ts)) byDay[daysAgo] = s;
  });
  const out = [];
  for (let i = 13; i >= 0; i--) out.push({ t: byDay[i] ? byDay[i].t : 0 });
  return out;
}

// Registrable-ish domain of an http(s) URL, e.g. manifest.hoboguppy.com -> hoboguppy.com. null otherwise.
// No public-suffix list: a small set of common two-level suffixes keeps co.uk-style domains sane.
const TH_TWO_LEVEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au',
  'co.nz', 'co.jp', 'co.in', 'com.br', 'co.za', 'com.mx', 'com.cn'
]);
function thDomainOf(url) {
  let u;
  try { u = new URL(url); } catch (_) { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  if (!host || !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':')) return host || null;
  const labels = host.split('.');
  if (labels.length < 2) return host || null;
  const s2 = labels.slice(-2).join('.');
  const keep = TH_TWO_LEVEL_SUFFIXES.has(s2) ? 3 : 2;
  return labels.length >= keep ? labels.slice(-keep).join('.') : host;
}

// Builds a dedupe match key for a tab URL per the dedupe* settings toggles.
// Trailing slash on a bare path is always stripped; hash is stripped by default.
function thNormalizeUrl(url, settings) {
  settings = settings || {};
  try {
    const u = new URL(url);
    if (settings.dedupeIgnoreHash !== false) u.hash = '';
    if (settings.dedupeIgnoreQuery) u.search = '';
    if (settings.dedupeIgnoreWww) u.hostname = u.hostname.replace(/^www\./, '');
    let s = u.toString();
    if (s.endsWith('/') && u.pathname === '/') s = s.slice(0, -1);
    if (settings.dedupeCaseInsensitive) s = s.toLowerCase();
    return s;
  } catch (_) {
    return url;
  }
}

// Action log: what Tab Hoor did on its own or on request, and how much it reduced.
// kind is the stored key; auto marks actions the extension took without the user.
const TH_ACTION_KINDS = {
  idle:       { label: 'Idle cleanup',        auto: true },
  idleManual: { label: 'Idle cleanup',        auto: false },
  dedupe:     { label: 'Duplicates closed',   auto: false },
  merge:      { label: 'Windows merged',      auto: false }
};

// Parses "30m", "1h", "90m", "1d", "2h30m" etc into milliseconds. null if unparseable.
const TH_DURATION_UNITS = { m: 60000, h: 3600000, d: 86400000 };
function thParseDuration(text) {
  const s = (text || '').trim().toLowerCase();
  if (!s) return null;
  const re = /(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)/g;
  let ms = 0;
  let matched = false;
  let m;
  while ((m = re.exec(s))) {
    matched = true;
    const n = parseFloat(m[1]);
    const unit = m[2][0]; // first letter: m/h/d
    ms += n * TH_DURATION_UNITS[unit];
  }
  if (!matched) return null;
  return ms > 0 ? ms : null;
}

// Total tabs removed by an action entry (merge moves tabs, so it counts 0).
function thActionTabs(entry) {
  if (!entry || entry.kind === 'merge') return 0;
  return (entry.closed || 0) + (entry.discarded || 0);
}

// Export for service worker (importScripts) and pages
if (typeof globalThis !== 'undefined') {
  globalThis.TH_BADGE_COLORS = TH_BADGE_COLORS;
  globalThis.TH_ACTION_KINDS = TH_ACTION_KINDS;
  globalThis.thParseDuration = thParseDuration;
  globalThis.TH_DEFAULT_SETTINGS = TH_DEFAULT_SETTINGS;
  globalThis.TH_BACKUP_VERSION = TH_BACKUP_VERSION;
  globalThis.thValidateBackup = thValidateBackup;
  globalThis.thTone = thTone;
  globalThis.thFormatDate = thFormatDate;
  globalThis.thRetentionMs = thRetentionMs;
  globalThis.thSamplingMinutes = thSamplingMinutes;
  globalThis.thNormalizeUrl = thNormalizeUrl;
  globalThis.thDomainOf = thDomainOf;
  globalThis.thTrend14 = thTrend14;
  globalThis.thActionTabs = thActionTabs;
}
