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
  idleEnabled: false,   // auto-close/discard idle tabs (ported from FFTabClose)
  idleMinutes: 30,
  groupingEnabled: false, // auto tab grouping by hostname rule, Firefox only (ported from firefox-auto-tab-grouping)
  groupingRules: '',      // newline-separated "pattern => Group Name"
  groupingAuto: false,    // also group any 2+ tabs sharing a domain, named after the domain
  dedupeIgnoreHash: true,   // treat http://x.com/ and http://x.com/#foo as the same tab
  dedupeIgnoreQuery: false, // treat http://x.com/?a=1 and http://x.com/?a=2 as the same tab
  dedupeIgnoreWww: false,   // treat http://www.x.com and http://x.com as the same tab
  dedupeCaseInsensitive: false,
  dedupeKeepPinned: true,   // prefer keeping a pinned tab over a non-pinned duplicate
  dedupeKeepActive: true    // prefer keeping the active tab over a background duplicate
};

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

// "example.com => Group Name" per line, blank lines / lines without "=>" ignored.
function thParseGroupingRules(text) {
  return (text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const i = line.indexOf('=>');
      if (i === -1) return null;
      const pattern = line.slice(0, i).trim().toLowerCase();
      const name = line.slice(i + 2).trim();
      if (!pattern || !name) return null;
      return { pattern, name };
    })
    .filter(Boolean);
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
  const keep = TH_TWO_LEVEL_SUFFIXES.has(labels.slice(-2).join('.')) ? 3 : 2;
  return labels.slice(-keep).join('.');
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

// Export for service worker (importScripts) and pages
if (typeof globalThis !== 'undefined') {
  globalThis.TH_BADGE_COLORS = TH_BADGE_COLORS;
  globalThis.TH_DEFAULT_SETTINGS = TH_DEFAULT_SETTINGS;
  globalThis.thTone = thTone;
  globalThis.thFormatDate = thFormatDate;
  globalThis.thRetentionMs = thRetentionMs;
  globalThis.thSamplingMinutes = thSamplingMinutes;
  globalThis.thParseGroupingRules = thParseGroupingRules;
  globalThis.thNormalizeUrl = thNormalizeUrl;
  globalThis.thDomainOf = thDomainOf;
  globalThis.thTrend14 = thTrend14;
}
