// Tab Hoor — shared data
// Loaded by background.js (as background script) and HTML pages (via <script> tag).

'use strict';

var TH_RANKS = [
  { min: 0,   max: 5,        title: 'Tab Teetotaler',       quote: "Lookin' clean. I don't trust it.",       tone: 'green'  },
  { min: 6,   max: 15,       title: 'Tab Curious',          quote: "Just dippin' a toe. We see ya.",          tone: 'green'  },
  { min: 16,  max: 30,       title: 'Getting Around',       quote: "Now you're cookin' with grease.",         tone: 'amber'  },
  { min: 31,  max: 50,       title: 'Certified Hoor',       quote: "Boiling-denim territory, pal.",           tone: 'amber'  },
  { min: 51,  max: 75,       title: 'Tab Whore',            quote: "Yeah you ARE. Bless ya for it.",          tone: 'red'    },
  { min: 76,  max: 100,      title: 'Dirty Hoor',           quote: "Dirty. Filthy. Glorious.",                tone: 'red'    },
  { min: 101, max: 150,      title: 'Filthy Hoor',          quote: "Triple digits, you beautiful animal.",    tone: 'red'    },
  { min: 151, max: 200,      title: 'Legendary Hoor',       quote: "Three syllables, baby. Earned.",          tone: 'purple' },
  { min: 201, max: Infinity, title: 'Frank Reynolds Level', quote: "An unholy monument. Hang the portrait.",  tone: 'purple' },
];

var TH_ACHIEVEMENTS = [
  { id: 'first_time',      icon: '🍀', name: "First Time",          desc: 'Open your first tab',                  hint: 'Open 1 tab'       },
  { id: 'bakers_dozen',    icon: '🥐', name: "Baker's Dozen",       desc: "Round up a baker's dozen",             hint: 'Reach 13 tabs'    },
  { id: 'dirty_thirty',    icon: '💃', name: "The Dirty Thirty",    desc: 'Hit thirty open tabs',                 hint: 'Reach 30 tabs'    },
  { id: 'fifty_club',      icon: '🔥', name: "The Fifty Club",      desc: 'Welcome to the Fifty Club',            hint: 'Reach 50 tabs'    },
  { id: 'triple_digits',   icon: '💯', name: "Triple Digits",       desc: 'Crack the hundred mark',               hint: 'Reach 100 tabs'   },
  { id: 'window_dressing', icon: '🪟', name: "Window Dressing",     desc: 'Five windows at once',                 hint: 'Open 5+ windows'  },
  { id: 'relapser',        icon: '🔄', name: "The Relapser",        desc: 'Dip below your ATH, then climb back', hint: '??? ???'          },
  { id: 'frank_level',     icon: '👑', name: "Frank Reynolds Level", desc: 'Reach the mountaintop',               hint: 'Reach 200 tabs'   },
];

function thRankFor(n) {
  return TH_RANKS.find(function(r) { return n >= r.min && n <= r.max; }) || TH_RANKS[0];
}

function thRankIndex(n) {
  return TH_RANKS.findIndex(function(r) { return n >= r.min && n <= r.max; });
}

var TH_BADGE_COLORS = {
  green:  '#3db85a',
  amber:  '#e07c35',
  red:    '#e03535',
  purple: '#9b5fe0',
};

// Short date string: "May 03 '26"
function thFormatDate(ts) {
  var d = new Date(ts || Date.now());
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var yr = String(d.getFullYear()).slice(2);
  var day = String(d.getDate()).padStart(2, '0');
  return months[d.getMonth()] + ' ' + day + " '" + yr;
}
