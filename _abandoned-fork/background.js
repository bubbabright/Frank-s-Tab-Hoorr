// Tab Hoor — background.js (codename: frank)
// Tracks tabs, updates badge, persists stats, unlocks achievements.

const STORAGE_KEY = 'frankState';

// Rank definitions — Frank Reynolds voice required
const RANKS = [
  {
    min: 0, max: 5,
    title: 'Tab Teetotaler',
    quote: "You a hoor? ...No? Not even a little?"
  },
  {
    min: 6, max: 15,
    title: 'Tab Curious',
    quote: "You two aren't bangin' are ya?"
  },
  {
    min: 16, max: 30,
    title: 'Getting Around',
    quote: "Daaah yeah it is. Stay away from that, trust me."
  },
  {
    min: 31, max: 50,
    title: 'Certified Hoor',
    quote: "Now we're talking. Boiling denim territory."
  },
  {
    min: 51, max: 75,
    title: 'Tab Whore',
    quote: "Boiling denim and bangin hoors!"
  },
  {
    min: 76, max: 100,
    title: 'Dirty Hoor',
    quote: "Dennis, your mother is a dirty dirty houer."
  },
  {
    min: 101, max: 150,
    title: 'Filthy Hoor',
    quote: "He says he has sex with hundreds of... tabs."
  },
  {
    min: 151, max: 200,
    title: 'Legendary Hoor',
    quote: "It's a three-syllable word for a REASON."
  },
  {
    min: 201, max: Infinity,
    title: 'Frank Reynolds Level',
    quote: "Bless this wonderful, wonderful hoor."
  }
];

// Achievement definitions
const ACHIEVEMENTS = [
  {
    id: 'first_time',
    name: 'First Time',
    desc: "Everyone starts somewhere, ya hoor.",
    icon: '🍀',
    threshold: 1,
    type: 'tabs'
  },
  {
    id: 'bakers_dozen',
    name: "Baker's Dozen",
    desc: "13 tabs. Unlucky for some. Not for you.",
    icon: '🥐',
    threshold: 13,
    type: 'tabs'
  },
  {
    id: 'dirty_thirty',
    name: 'The Dirty Thirty',
    desc: "30 tabs. Daaah yeah it is.",
    icon: '💃',
    threshold: 30,
    type: 'tabs'
  },
  {
    id: 'fifty_club',
    name: 'The Fifty Club',
    desc: "50 tabs. We're boiling denim now.",
    icon: '🔥',
    threshold: 50,
    type: 'tabs'
  },
  {
    id: 'triple_digits',
    name: 'Triple Digits',
    desc: "A HUNDRED tabs. You sick, beautiful hoor.",
    icon: '💯',
    threshold: 100,
    type: 'tabs'
  },
  {
    id: 'window_dressing',
    name: 'Window Dressing',
    desc: "Spreading yourself across 5+ windows. Typical.",
    icon: '🪟',
    threshold: 5,
    type: 'windows'
  },
  {
    id: 'relapser',
    name: 'The Relapser',
    desc: "You closed some tabs, then came right back. They always come back.",
    icon: '🔄',
    threshold: null,
    type: 'special'
  },
  {
    id: 'frank_level',
    name: 'Frank Reynolds Level',
    desc: "200 tabs. Bless this wonderful creature.",
    icon: '👑',
    threshold: 200,
    type: 'tabs'
  }
];

// Default state shape
function defaultState() {
  return {
    allTimeHigh: 0,
    allTimeHighDate: null,
    hasDippedBelowHigh: false,
    achievements: {},
    installedDate: new Date().toISOString()
  };
}

let state = defaultState();

// Load persisted state, then initialise badge
browser.storage.local.get(STORAGE_KEY).then(data => {
  if (data[STORAGE_KEY]) {
    state = Object.assign(defaultState(), data[STORAGE_KEY]);
  }
  refreshAll();
});

function saveState() {
  browser.storage.local.set({ [STORAGE_KEY]: state });
}

// ── Core refresh ────────────────────────────────────────────────────────────

async function refreshAll() {
  const [tabs, windows] = await Promise.all([
    browser.tabs.query({}),
    browser.windows.getAll({ windowTypes: ['normal'] })
  ]);

  const tabCount = tabs.length;
  const windowCount = windows.length;

  updateBadge(tabCount);
  updateStats(tabCount);
  checkAchievements(tabCount, windowCount);
}

// ── Badge ────────────────────────────────────────────────────────────────────

function updateBadge(count) {
  const text = count > 999 ? '999+' : String(count);
  const color = badgeColor(count);
  browser.browserAction.setBadgeText({ text });
  browser.browserAction.setBadgeBackgroundColor({ color });
}

function badgeColor(count) {
  if (count <= 15)  return '#4CAF50'; // green  — curious
  if (count <= 50)  return '#FF9800'; // orange — getting around
  if (count <= 100) return '#F44336'; // red    — certified hoor
  return '#9C27B0';                   // purple — legendary
}

// ── Stats ────────────────────────────────────────────────────────────────────

function updateStats(tabCount) {
  if (tabCount > state.allTimeHigh) {
    state.allTimeHigh = tabCount;
    state.allTimeHighDate = new Date().toISOString();
    state.hasDippedBelowHigh = false;
    saveState();
  } else if (tabCount < state.allTimeHigh) {
    state.hasDippedBelowHigh = true;
    saveState();
  }
}

// ── Achievements ─────────────────────────────────────────────────────────────

function checkAchievements(tabCount, windowCount) {
  let changed = false;

  for (const ach of ACHIEVEMENTS) {
    if (state.achievements[ach.id]) continue; // already unlocked

    if (ach.type === 'tabs' && tabCount >= ach.threshold) {
      state.achievements[ach.id] = new Date().toISOString();
      changed = true;
    }
    if (ach.type === 'windows' && windowCount >= ach.threshold) {
      state.achievements[ach.id] = new Date().toISOString();
      changed = true;
    }
    if (ach.type === 'special' && ach.id === 'relapser') {
      // Relapser: dipped below high AND now back at or above it
      if (state.hasDippedBelowHigh && tabCount >= state.allTimeHigh && state.allTimeHigh > 0) {
        state.achievements[ach.id] = new Date().toISOString();
        changed = true;
      }
    }
  }

  if (changed) saveState();
}

// ── Rank helper (exported via message for popup) ─────────────────────────────

function getRank(count) {
  return RANKS.find(r => count >= r.min && count <= r.max) || RANKS[RANKS.length - 1];
}

// ── Message bridge (popup asks background for fresh data) ────────────────────

browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_STATE') {
    Promise.all([
      browser.tabs.query({}),
      browser.windows.getAll({ windowTypes: ['normal'] })
    ]).then(([tabs, windows]) => {
      const tabCount = tabs.length;
      const windowCount = windows.length;
      sendResponse({
        tabCount,
        windowCount,
        rank: getRank(tabCount),
        state,
        achievements: ACHIEVEMENTS
      });
    });
    return true; // async response
  }
});

// ── Tab event listeners ───────────────────────────────────────────────────────

browser.tabs.onCreated.addListener(refreshAll);
browser.tabs.onRemoved.addListener(refreshAll);
browser.tabs.onReplaced.addListener(refreshAll);
browser.windows.onCreated.addListener(refreshAll);
browser.windows.onRemoved.addListener(refreshAll);
