// Tab Hoor — shared ranks & achievements (codename: frank)
'use strict';

const TH_RANKS = [
  { min: 0,   max: 5,        title: 'Tab Teetotaler',       quote: "You a hoor? ...No? Not even a little?", tone: 'green' },
  { min: 6,   max: 15,       title: 'Tab Curious',          quote: "You two aren't bangin' are ya?", tone: 'green' },
  { min: 16,  max: 30,       title: 'Getting Around',       quote: "Daaah yeah it is. Stay away from that, trust me.", tone: 'amber' },
  { min: 31,  max: 50,       title: 'Certified Hoor',       quote: "Now we're talking. Boiling denim territory.", tone: 'amber' },
  { min: 51,  max: 75,       title: 'Tab Whore',            quote: "Boiling denim and bangin hoors!", tone: 'red' },
  { min: 76,  max: 100,      title: 'Dirty Hoor',           quote: "Dennis, your mother is a dirty dirty houer.", tone: 'red' },
  { min: 101, max: 150,      title: 'Filthy Hoor',          quote: "He says he has sex with hundreds of... tabs.", tone: 'red' },
  { min: 151, max: 200,      title: 'Legendary Hoor',       quote: "It's a three-syllable word for a REASON.", tone: 'purple' },
  { min: 201, max: Infinity, title: 'Frank Reynolds Level', quote: "Bless this wonderful, wonderful hoor.", tone: 'purple' }
];

const TH_ACHIEVEMENTS = [
  { id: 'first_time',      icon: '🍀', name: 'First Time',          desc: "Everyone starts somewhere, ya hoor.", hint: 'Open 1 tab', type: 'tabs', threshold: 1 },
  { id: 'bakers_dozen',    icon: '🥐', name: "Baker's Dozen",       desc: "13 tabs. Unlucky for some. Not for you.", hint: 'Reach 13 tabs', type: 'tabs', threshold: 13 },
  { id: 'dirty_thirty',    icon: '💃', name: 'The Dirty Thirty',    desc: "30 tabs. Daaah yeah it is.", hint: 'Reach 30 tabs', type: 'tabs', threshold: 30 },
  { id: 'fifty_club',      icon: '🔥', name: 'The Fifty Club',      desc: "50 tabs. We're boiling denim now.", hint: 'Reach 50 tabs', type: 'tabs', threshold: 50 },
  { id: 'triple_digits',   icon: '💯', name: 'Triple Digits',       desc: "A HUNDRED tabs. You sick, beautiful hoor.", hint: 'Reach 100 tabs', type: 'tabs', threshold: 100 },
  { id: 'window_dressing', icon: '🪟', name: 'Window Dressing',     desc: "Spreading yourself across 5+ windows.", hint: 'Open 5+ windows', type: 'windows', threshold: 5 },
  { id: 'relapser',        icon: '🔄', name: 'The Relapser',        desc: "You closed some tabs, then came right back.", hint: '???', type: 'special', threshold: null },
  { id: 'frank_level',     icon: '👑', name: 'Frank Reynolds Level', desc: "200 tabs. Bless this wonderful creature.", hint: 'Reach 200 tabs', type: 'tabs', threshold: 200 }
];

const TH_BADGE_COLORS = {
  green:  '#3db85a',
  amber:  '#e07c35',
  red:    '#e03535',
  purple: '#9b5fe0'
};

const TH_DEFAULT_SETTINGS = {
  badgeMode: 'count',   // count | rank | off
  sampling: '5m',       // 1m | 5m | 15m | evt
  retention: '90d',     // 14d | 30d | 90d | all
  showHints: true,
  idleEnabled: false,   // auto-close/discard idle tabs (ported from FFTabClose)
  idleMinutes: 30,
  groupingEnabled: false, // auto tab grouping by hostname rule, Firefox only (ported from firefox-auto-tab-grouping)
  groupingRules: ''       // newline-separated "pattern => Group Name"
};

function thRankFor(n) {
  return TH_RANKS.find(r => n >= r.min && n <= r.max) || TH_RANKS[TH_RANKS.length - 1];
}

function thRankIndex(n) {
  const i = TH_RANKS.findIndex(r => n >= r.min && n <= r.max);
  return i < 0 ? TH_RANKS.length - 1 : i;
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

// Strip hash + trailing slash so http://x.com/ and http://x.com/#foo count as the same tab.
function thNormalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    let s = u.toString();
    if (s.endsWith('/') && u.pathname === '/') s = s.slice(0, -1);
    return s;
  } catch (_) {
    return url;
  }
}

// Export for service worker (importScripts) and pages
if (typeof globalThis !== 'undefined') {
  globalThis.TH_RANKS = TH_RANKS;
  globalThis.TH_ACHIEVEMENTS = TH_ACHIEVEMENTS;
  globalThis.TH_BADGE_COLORS = TH_BADGE_COLORS;
  globalThis.TH_DEFAULT_SETTINGS = TH_DEFAULT_SETTINGS;
  globalThis.thRankFor = thRankFor;
  globalThis.thRankIndex = thRankIndex;
  globalThis.thFormatDate = thFormatDate;
  globalThis.thRetentionMs = thRetentionMs;
  globalThis.thSamplingMinutes = thSamplingMinutes;
  globalThis.thParseGroupingRules = thParseGroupingRules;
  globalThis.thNormalizeUrl = thNormalizeUrl;
}
