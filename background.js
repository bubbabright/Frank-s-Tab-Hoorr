// Tab Hoor — background.js (codename: frank)
// Tracks tabs, updates badge, persists stats, unlocks achievements.

const STORAGE_KEY = 'frankState';

const RANKS = [
  { min: 0,   max: 5,        title: 'Tab Teetotaler',       quote: "You a hoor? ...No? Not even a little?" },
  { min: 6,   max: 15,       title: 'Tab Curious',           quote: "You two aren't bangin' are ya?" },
  { min: 16,  max: 30,       title: 'Getting Around',        quote: "Daaah yeah it is. Stay away from that, trust me." },
  { min: 31,  max: 50,       title: 'Certified Hoor',        quote: "Now we're talking. Boiling denim territory." },
  { min: 51,  max: 75,       title: 'Tab Whore',             quote: "Boiling denim and bangin hoors!" },
  { min: 76,  max: 100,      title: 'Dirty Hoor',            quote: "Dennis, your mother is a dirty dirty houer." },
  { min: 101, max: 150,      title: 'Filthy Hoor',           quote: "He says he has sex with hundreds of... tabs." },
  { min: 151, max: 200,      title: 'Legendary Hoor',        quote: "It's a three-syllable word for a REASON." },
  { min: 201, max: Infinity, title: 'Frank Reynolds Level',  quote: "Bless this wonderful, wonderful hoor." }
];

const ACHIEVEMENTS = [
  { id: 'first_time',      name: 'First Time',         desc: "Everyone starts somewhere, ya hoor.",                    icon: '🍀', threshold: 1,   type: 'tabs' },
  { id: 'bakers_dozen',    name: "Baker's Dozen",       desc: "13 tabs. Unlucky for some. Not for you.",               icon: '🥐', threshold: 13,  type: 'tabs' },
  { id: 'dirty_thirty',    name: 'The Dirty Thirty',    desc: "30 tabs. Daaah yeah it is.",                            icon: '💃', threshold: 30,  type: 'tabs' },
  { id: 'fifty_club',      name: 'The Fifty Club',      desc: "50 tabs. We're boiling denim now.",                     icon: '🔥', threshold: 50,  type: 'tabs' },
  { id: 'triple_digits',   name: 'Triple Digits',       desc: "A HUNDRED tabs. You sick, beautiful hoor.",             icon: '💯', threshold: 100, type: 'tabs' },
  { id: 'window_dressing', name: 'Window Dressing',     desc: "Spreading yourself across 5+ windows. Typical.",        icon: '🪟', threshold: 5,   type: 'windows' },
  { id: 'relapser',        name: 'The Relapser',        desc: "You closed some tabs, then came right back. They always come back.", icon: '🔄', threshold: null, type: 'special' },
  { id: 'frank_level',     name: 'Frank Reynolds Level',desc: "200 tabs. Bless this wonderful creature.",              icon: '👑', threshold: 200, type: 'tabs' }
];

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

browser.storage.local.get(STORAGE_KEY).then(data => {
  if (data[STORAGE_KEY]) state = Object.assign(defaultState(), data[STORAGE_KEY]);
  refreshAll();
});

function saveState() {
  browser.storage.local.set({ [STORAGE_KEY]: state });
}

async function refreshAll() {
  const [tabs, windows] = await Promise.all([
    browser.tabs.query({}),
    browser.windows.getAll({ windowTypes: ['normal'] })
  ]);
  const tabCount    = tabs.length;
  const windowCount = windows.length;
  updateBadge(tabCount);
  updateStats(tabCount);
  checkAchievements(tabCount, windowCount);
}

function updateBadge(count) {
  const text  = count > 999 ? '999+' : String(count);
  const color = badgeColor(count);
  browser.browserAction.setBadgeText({ text });
  browser.browserAction.setBadgeBackgroundColor({ color });
}

function badgeColor(count) {
  if (count <= 15)  return '#4CAF50';
  if (count <= 50)  return '#FF9800';
  if (count <= 100) return '#F44336';
  return '#9C27B0';
}

function updateStats(tabCount) {
  if (tabCount > state.allTimeHigh) {
    state.allTimeHigh       = tabCount;
    state.allTimeHighDate   = new Date().toISOString();
    state.hasDippedBelowHigh = false;
    saveState();
  } else if (tabCount < state.allTimeHigh) {
    state.hasDippedBelowHigh = true;
    saveState();
  }
}

function checkAchievements(tabCount, windowCount) {
  let changed = false;
  for (const ach of ACHIEVEMENTS) {
    if (state.achievements[ach.id]) continue;
    if (ach.type === 'tabs'    && tabCount    >= ach.threshold) { state.achievements[ach.id] = new Date().toISOString(); changed = true; }
    if (ach.type === 'windows' && windowCount >= ach.threshold) { state.achievements[ach.id] = new Date().toISOString(); changed = true; }
    if (ach.type === 'special' && ach.id === 'relapser') {
      if (state.hasDippedBelowHigh && tabCount >= state.allTimeHigh && state.allTimeHigh > 0) {
        state.achievements[ach.id] = new Date().toISOString(); changed = true;
      }
    }
  }
  if (changed) saveState();
}

function getRank(count) {
  return RANKS.find(r => count >= r.min && count <= r.max) || RANKS[RANKS.length - 1];
}

browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_STATE') {
    Promise.all([
      browser.tabs.query({}),
      browser.windows.getAll({ windowTypes: ['normal'] })
    ]).then(([tabs, windows]) => {
      sendResponse({
        tabCount:    tabs.length,
        windowCount: windows.length,
        rank:        getRank(tabs.length),
        state,
        achievements: ACHIEVEMENTS
      });
    });
    return true;
  }

  if (msg.type === 'CLOSE_OLD_TABS') {
    const cutoff = Date.now() - msg.maxAge;
    browser.tabs.query({}).then(tabs => {
      const oldTabs = tabs.filter(t => t.lastAccessed < cutoff);
      const ids = oldTabs.map(t => t.id);
      browser.tabs.remove(ids).then(() => {
        sendResponse({ closed: ids.length });
      });
    });
    return true;
  }
});

browser.tabs.onCreated.addListener(refreshAll);
browser.tabs.onRemoved.addListener(refreshAll);
browser.tabs.onReplaced.addListener(refreshAll);
browser.windows.onCreated.addListener(refreshAll);
browser.windows.onRemoved.addListener(refreshAll);
