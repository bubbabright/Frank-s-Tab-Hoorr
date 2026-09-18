// Tab Hoor — popup.js
// data.js is loaded first (provides TH_RANKS, TH_ACHIEVEMENTS, thRankFor, thRankIndex, thFormatDate)

'use strict';

var VIEW = 'home';
var APP = {};

// ─── Accent colors per theme ──────────────────────────────────────────────────

var ACCENT_A = { green: '#7fb069', amber: '#e0a23a', red: '#c8453a', purple: '#9b6dd1' };
var ACCENT_B = { green: '#3f6b3a', amber: '#c47a1f', red: '#a83a2f', purple: '#5a3e7a' };
var ACCENT_C = { green: '#7fff7f', amber: '#ffd34e', red: '#ff4561', purple: '#c66dff' };

// ─── Data helpers ─────────────────────────────────────────────────────────────

function getLast14Days(samples) {
  var now = Date.now();
  var dayMs = 86400000;
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Build day buckets: key = daysAgo (0 = today)
  var byDay = {};
  (samples || []).forEach(function(s) {
    var daysAgo = Math.floor((now - s.ts) / dayMs);
    if (daysAgo >= 0 && daysAgo < 14) {
      if (!byDay[daysAgo] || s.ts > byDay[daysAgo].ts) byDay[daysAgo] = s;
    }
  });

  var result = [];
  for (var i = 13; i >= 0; i--) {
    var d = new Date(now - i * dayMs);
    var label = months[d.getMonth()] + ' ' + String(d.getDate()).padStart(2, '0');
    var s = byDay[i];
    result.push({ label: label, t: s ? s.t : 0, w: s ? s.w : 0 });
  }
  return result;
}

function getRecentlyUnlocked(achievements, limit) {
  limit = limit || 3;
  var achs = TH_ACHIEVEMENTS.filter(function(a) {
    return achievements[a.id] && achievements[a.id].unlocked;
  }).map(function(a) {
    return Object.assign({}, a, { date: achievements[a.id].date });
  });
  // Return last N (most recently added = last in TH_ACHIEVEMENTS order that are unlocked)
  return achs.slice(-limit).reverse();
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function sparklineSVG(data, accent, w, h) {
  w = w || 132; h = h || 28;
  var nonZero = data.filter(function(d) { return d.t > 0; });
  if (nonZero.length < 2) {
    return '<svg width="' + w + '" height="' + h + '" class="a-spark"><text x="4" y="18" font-size="10" fill="rgba(243,232,208,0.2)" font-family="monospace">no data yet</text></svg>';
  }
  var pad = 2;
  var max = Math.max.apply(null, data.map(function(d) { return d.t; }));
  var min = Math.min.apply(null, data.map(function(d) { return d.t; }));
  var range = max - min || 1;

  var pts = data.map(function(d, i) {
    var x = (pad + (i / (data.length - 1)) * (w - pad * 2)).toFixed(1);
    var y = (pad + (1 - (d.t - min) / range) * (h - pad * 2)).toFixed(1);
    return [x, y];
  });

  var path = pts.map(function(p, i) { return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' ');
  var last = pts[pts.length - 1];
  var area = path + ' L' + last[0] + ' ' + (h - pad) + ' L' + pts[0][0] + ' ' + (h - pad) + ' Z';
  var gid = 'sg' + Math.random().toString(36).slice(2, 6);

  return '<svg width="' + w + '" height="' + h + '" class="a-spark">'
    + '<defs><linearGradient id="' + gid + '" x1="0" x2="0" y1="0" y2="1">'
    + '<stop offset="0%" stop-color="' + accent + '" stop-opacity="0.35"/>'
    + '<stop offset="100%" stop-color="' + accent + '" stop-opacity="0"/>'
    + '</linearGradient></defs>'
    + '<path d="' + area + '" fill="url(#' + gid + ')"/>'
    + '<path d="' + path + '" fill="none" stroke="' + accent + '" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2" fill="' + accent + '"/>'
    + '</svg>';
}

function tallyMarkSVG(n, max) {
  max = max || 75;
  var display = Math.min(n, max);
  var groups = Math.floor(display / 5);
  var rem = display % 5;
  var svgs = '';
  var mk = '#1a1410';

  for (var i = 0; i < groups; i++) {
    svgs += '<svg viewBox="0 0 28 22" width="28" height="22" class="b-tally-grp">'
      + '<line x1="3" y1="2" x2="3" y2="20" stroke="' + mk + '" stroke-width="2" stroke-linecap="round"/>'
      + '<line x1="8" y1="2" x2="8" y2="20" stroke="' + mk + '" stroke-width="2" stroke-linecap="round"/>'
      + '<line x1="13" y1="2" x2="13" y2="20" stroke="' + mk + '" stroke-width="2" stroke-linecap="round"/>'
      + '<line x1="18" y1="2" x2="18" y2="20" stroke="' + mk + '" stroke-width="2" stroke-linecap="round"/>'
      + '<line x1="1" y1="18" x2="25" y2="4" stroke="' + mk + '" stroke-width="2" stroke-linecap="round"/>'
      + '</svg>';
  }
  if (rem > 0) {
    var remLines = '';
    for (var j = 0; j < rem; j++) {
      var x = 3 + j * 5;
      remLines += '<line x1="' + x + '" y1="2" x2="' + x + '" y2="20" stroke="' + mk + '" stroke-width="2" stroke-linecap="round"/>';
    }
    svgs += '<svg viewBox="0 0 28 22" width="28" height="22" class="b-tally-grp">' + remLines + '</svg>';
  }
  var plus = n > max ? '<span class="b-tally-plus">+' + (n - max) + '</span>' : '';
  return '<div class="b-tally">' + svgs + plus + '</div>';
}

function padScore(n, digits) {
  digits = digits || 4;
  return String(n).padStart(digits, '0');
}

// ─── Theme A renderers ────────────────────────────────────────────────────────

function headerA() {
  return '<div class="a-hdr">'
    + '<div class="a-mark"><span class="a-mark-glyph">⌬</span><span class="a-mark-text">TAB HOOR</span></div>'
    + '<div class="a-hdr-icons">'
    + '<button class="a-icon" id="btn-history" title="History">'
    + '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8a5 5 0 1 0 1.46-3.54M3 8V4m0 4h4M8 5v3l2 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    + '</button>'
    + '<button class="a-icon" id="btn-settings" title="Settings">'
    + '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8 3.4 3.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
    + '</button>'
    + '</div></div>';
}

function footerA() {
  return '<div class="a-foot">'
    + '<div class="a-foot-rule"></div>'
    + '<div class="a-foot-tabs">'
    + '<button class="a-tab' + (VIEW === 'home' ? ' on' : '') + '" data-tab="home">Home</button>'
    + '<button class="a-tab' + (VIEW === 'stats' ? ' on' : '') + '" data-tab="stats">Stats</button>'
    + '<button class="a-tab' + (VIEW === 'ach' ? ' on' : '') + '" data-tab="ach">Achievements</button>'
    + '</div>'
    + '<div class="a-foot-hr">Feelin\' overwhelmed? <a href="#" id="lnk-dupes">close dupes</a> · <a href="#" id="lnk-merge">merge windows</a></div>'
    + '</div>';
}

function achievementsGridA() {
  var html = '<div class="a-ach-grid">';
  TH_ACHIEVEMENTS.forEach(function(a) {
    var stored = APP.achievements[a.id] || {};
    var on = stored.unlocked;
    var title = on ? ('Unlocked ' + stored.date) : a.hint;
    html += '<div class="a-ach ' + (on ? 'on' : 'off') + '" title="' + title + '">'
      + '<div class="a-ach-icon">' + (on ? a.icon : '?') + '</div>'
      + '<div class="a-ach-name">' + (on ? a.name : '??? ???') + '</div>'
      + '</div>';
  });
  return html + '</div>';
}

function homeViewA() {
  var rank = APP.rank;
  var accent = ACCENT_A[rank.tone];
  var rankIdx = APP.rankIdx;
  var nextRank = TH_RANKS[rankIdx + 1];
  var progress = nextRank ? (APP.tabCount - rank.min) / (nextRank.min - rank.min) : 1;
  var hist14 = getLast14Days(APP.samples);
  var maxT = Math.max.apply(null, hist14.map(function(d) { return d.t; }));
  if (maxT === 0) maxT = 1;
  var unlocked = Object.keys(APP.achievements).filter(function(id) { return APP.achievements[id].unlocked; }).length;

  var html = '<div class="a-hero">'
    + '<div class="a-hero-label">TABS · OPEN · NOW</div>'
    + '<div class="a-count" style="color:' + accent + '">'
    + '<span class="a-count-num">' + APP.tabCount + '</span>'
    + '<span class="a-count-w">/ ' + APP.windowCount + 'w</span>'
    + '</div>'
    + '<div class="a-rank">'
    + '<div class="a-rank-title">' + rank.title + '</div>'
    + '<div class="a-rank-quote">&ldquo;' + rank.quote + '&rdquo;</div>'
    + '</div>';

  if (nextRank) {
    html += '<div class="a-prog">'
      + '<div class="a-prog-bar"><div class="a-prog-fill" style="width:' + Math.min(100, progress * 100).toFixed(1) + '%;background:' + accent + '"></div></div>'
      + '<div class="a-prog-meta">'
      + '<span>' + rank.min + '</span>'
      + '<span class="a-prog-next">' + (nextRank.min - APP.tabCount) + ' to <b>' + nextRank.title + '</b></span>'
      + '<span>' + nextRank.min + '</span>'
      + '</div></div>';
  }

  html += '</div>';

  // ATH + sparkline
  html += '<div class="a-row">'
    + '<div class="a-stat">'
    + '<div class="a-stat-k">ALL-TIME HIGH</div>'
    + '<div class="a-stat-v">' + APP.ath + '</div>'
    + '<div class="a-stat-sub">' + APP.athDate + '</div>'
    + '</div>'
    + '<div class="a-stat a-stat-spark">'
    + '<div class="a-stat-k">14-DAY TREND</div>'
    + sparklineSVG(hist14, accent)
    + '<div class="a-stat-sub a-stat-sub-down">▼ ' + Math.round((1 - APP.tabCount / (APP.ath || 1)) * 100) + '% off peak</div>'
    + '</div></div>';

  // Achievements
  html += '<div class="a-sec-hdr"><span>ACHIEVEMENTS</span><span class="a-sec-count">' + unlocked + ' / ' + TH_ACHIEVEMENTS.length + '</span></div>';
  html += achievementsGridA();

  return html;
}

function statsViewA() {
  var rank = APP.rank;
  var accent = ACCENT_A[rank.tone];
  var hist14 = getLast14Days(APP.samples);
  var maxT = Math.max.apply(null, hist14.map(function(d) { return d.t; }));
  if (maxT === 0) maxT = 1;
  var recent = getRecentlyUnlocked(APP.achievements, 3);

  var weekData = hist14.slice(-7);
  var weekAvg = weekData.length > 0
    ? Math.round(weekData.reduce(function(s, d) { return s + d.t; }, 0) / weekData.length)
    : 0;
  var prevWeekData = hist14.slice(0, 7);
  var prevAvg = prevWeekData.length > 0
    ? Math.round(prevWeekData.reduce(function(s, d) { return s + d.t; }, 0) / prevWeekData.length)
    : 0;
  var weekDelta = prevAvg > 0 ? Math.round((weekAvg / prevAvg - 1) * 100) : 0;
  var weekDeltaStr = (weekDelta >= 0 ? '↗ +' : '↘ ') + weekDelta + '% vs. last';

  var html = '<div class="a-hero a-hero-stats">'
    + '<div class="a-hero-label">TABS · OPEN · NOW</div>'
    + '<div class="a-count a-count-sm" style="color:' + accent + '">'
    + '<span class="a-count-num">' + APP.tabCount + '</span>'
    + '<span class="a-count-w">/ ' + APP.windowCount + 'w</span>'
    + '</div></div>';

  html += '<div class="a-sec-hdr"><span>14 DAYS · TABS</span><a href="#" class="a-link" id="lnk-history">full history →</a></div>';

  // Bar chart
  html += '<div class="a-bars">';
  hist14.forEach(function(d, i) {
    var barH = ((d.t / maxT) * 100).toFixed(1);
    var isLast = i === hist14.length - 1;
    var bg = isLast ? accent : 'rgba(214,168,72,0.55)';
    html += '<div class="a-bar-col" title="' + d.label + ': ' + d.t + '">'
      + '<div class="a-bar" style="height:' + barH + '%;background:' + bg + '"></div>'
      + '</div>';
  });
  html += '</div>';
  html += '<div class="a-bar-axis"><span>' + (hist14[0] ? hist14[0].label : '') + '</span><span>' + (hist14[hist14.length-1] ? hist14[hist14.length-1].label : '') + '</span></div>';

  html += '<div class="a-row">'
    + '<div class="a-stat"><div class="a-stat-k">WEEK AVG</div><div class="a-stat-v">' + weekAvg + '</div><div class="a-stat-sub">' + weekDeltaStr + '</div></div>'
    + '<div class="a-stat"><div class="a-stat-k">PEAK (ALL TIME)</div><div class="a-stat-v">' + APP.ath + '</div><div class="a-stat-sub">' + APP.athDate + '</div></div>'
    + '</div>';

  html += '<div class="a-sec-hdr"><span>RECENTLY UNLOCKED</span></div><div class="a-recent">';
  if (recent.length === 0) {
    html += '<div class="a-recent-row"><span class="a-recent-name" style="color:rgba(243,232,208,0.38)">none yet — keep hoarding</span></div>';
  } else {
    recent.forEach(function(a) {
      html += '<div class="a-recent-row">'
        + '<span class="a-recent-icon">' + a.icon + '</span>'
        + '<span class="a-recent-name">' + a.name + '</span>'
        + '<span class="a-recent-date">' + a.date + '</span>'
        + '</div>';
    });
  }
  html += '</div>';

  return html;
}

function achViewA() {
  var unlocked = 0;
  var html = '<div style="padding:0 12px 12px">';

  html += '<div class="a-ach-grid" style="margin-bottom:0">';
  TH_ACHIEVEMENTS.forEach(function(a) {
    var stored = APP.achievements[a.id] || {};
    var on = stored.unlocked;
    if (on) unlocked++;
    var title = on ? ('Unlocked ' + stored.date) : a.hint;
    html += '<div class="a-ach ' + (on ? 'on' : 'off') + '" title="' + title + '" style="aspect-ratio:auto;padding:10px 6px">'
      + '<div class="a-ach-icon" style="font-size:22px">' + (on ? a.icon : '?') + '</div>'
      + '<div class="a-ach-name" style="margin-top:4px;font-size:8px">' + (on ? a.name : '??? ???') + '</div>'
      + (on ? '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7px;color:rgba(214,168,72,0.7);margin-top:2px">' + stored.date + '</div>' : '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7px;color:rgba(243,232,208,0.25);margin-top:2px">' + a.hint + '</div>')
      + '</div>';
  });
  html += '</div></div>';

  return html;
}

function buildPopupA() {
  var homeHidden = VIEW !== 'home' ? ' hidden' : '';
  var statsHidden = VIEW !== 'stats' ? ' hidden' : '';
  var achHidden = VIEW !== 'ach' ? ' hidden' : '';

  return headerA()
    + '<div id="view-home" class="' + homeHidden.trim() + '">' + homeViewA() + '</div>'
    + '<div id="view-stats" class="' + statsHidden.trim() + '">' + statsViewA() + '</div>'
    + '<div id="view-ach" class="' + achHidden.trim() + '">' + achViewA() + '</div>'
    + footerA();
}

// ─── Theme B renderers ────────────────────────────────────────────────────────

function buildPopupB() {
  var rank = APP.rank;
  var accent = ACCENT_B[rank.tone];
  var rankIdx = APP.rankIdx;
  var nextRank = TH_RANKS[rankIdx + 1];
  var hist14 = getLast14Days(APP.samples);
  var maxT = Math.max.apply(null, hist14.map(function(d) { return d.t; }));
  if (maxT === 0) maxT = 1;
  var unlocked = Object.keys(APP.achievements).filter(function(id) { return APP.achievements[id].unlocked; }).length;
  var recent = getRecentlyUnlocked(APP.achievements, 3);

  var homeHidden = VIEW !== 'home' ? ' hidden' : '';
  var statsHidden = VIEW !== 'stats' ? ' hidden' : '';
  var achHidden = VIEW !== 'ach' ? ' hidden' : '';

  // Header
  var html = '<div class="b-cork"></div>'
    + '<div class="b-hdr">'
    + '<div class="b-tape b-tape-l"></div><div class="b-tape b-tape-r"></div>'
    + '<div class="b-wordmark"><span class="b-wordmark-tab">TAB</span><span class="b-wordmark-hoor">HOOR</span></div>'
    + '<div class="b-stamp">EST.<br>\'26</div>'
    + '</div>';

  // Home view
  html += '<div id="view-home"' + (VIEW !== 'home' ? ' class="hidden"' : '') + '>';

  // Tally card
  html += '<div class="b-card b-card-main">'
    + '<div class="b-card-eyelet b-eyelet-l"></div><div class="b-card-eyelet b-eyelet-r"></div>'
    + '<div class="b-card-label">tabs open · right now</div>'
    + tallyMarkSVG(APP.tabCount)
    + '<div class="b-card-numread">that\'s <b>' + APP.tabCount + '</b> · across ' + APP.windowCount + ' windows</div>'
    + '</div>';

  // Rank
  html += '<div class="b-rank">'
    + '<div class="b-rank-frame" style="border-color:' + accent + '">'
    + '<div class="b-rank-tier" style="color:' + accent + '">TIER ' + (rankIdx + 1) + ' / 9</div>'
    + '<div class="b-rank-title" style="color:' + accent + '">' + rank.title + '</div>'
    + '<div class="b-rank-quote">&ldquo;' + rank.quote + '&rdquo;</div>'
    + '</div>';
  if (nextRank) {
    html += '<div class="b-rank-next">'
      + '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5h6m-2-3 3 3-3 3" stroke="#e8dcc4" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>'
      + (nextRank.min - APP.tabCount) + ' more for <b>' + nextRank.title + '</b></div>';
  }
  html += '</div>';

  // ATH note
  html += '<div class="b-note">'
    + '<div class="b-pin"></div>'
    + '<div class="b-note-row"><span class="b-note-k">PERSONAL BEST</span><span class="b-note-v">' + APP.ath + '</span></div>'
    + '<div class="b-note-sub">' + APP.athDate + ' · ▼ ' + Math.round((1 - APP.tabCount / (APP.ath || 1)) * 100) + '% off peak</div>'
    + '</div>';

  // Stickers
  html += '<div class="b-sec-hdr"><span>STICKERS COLLECTED</span><span class="b-sec-count">' + unlocked + ' / ' + TH_ACHIEVEMENTS.length + '</span></div>';
  html += '<div class="b-stickers">';
  TH_ACHIEVEMENTS.forEach(function(a, i) {
    var stored = APP.achievements[a.id] || {};
    var on = stored.unlocked;
    var rot = ((i * 73) % 11 - 5);
    var title = on ? ('Stamped ' + stored.date) : a.hint;
    html += '<div class="b-sticker ' + (on ? 'on' : 'off') + '" style="transform:rotate(' + rot + 'deg)" title="' + title + '">'
      + '<div class="b-sticker-icon">' + (on ? a.icon : '?') + '</div>'
      + '<div class="b-sticker-name">' + (on ? a.name : '???') + '</div>'
      + '</div>';
  });
  html += '</div>';

  html += '</div>'; // /view-home

  // Stats view
  html += '<div id="view-stats"' + (VIEW !== 'stats' ? ' class="hidden"' : '') + '>';
  html += '<div class="b-card b-card-main b-card-tight">'
    + '<div class="b-card-eyelet b-eyelet-l"></div><div class="b-card-eyelet b-eyelet-r"></div>'
    + '<div class="b-card-label">today\'s count</div>'
    + '<div class="b-big-num" style="color:#1a1410">' + APP.tabCount + '</div>'
    + '<div class="b-card-numread">across ' + APP.windowCount + ' windows</div>'
    + '</div>';

  html += '<div class="b-sec-hdr"><span>2 WEEKS · MARKER CHART</span><a class="b-link" href="#" id="lnk-history">full history →</a></div>';
  html += '<div class="b-chart">';
  hist14.forEach(function(d, i) {
    var barH = ((d.t / maxT) * 100).toFixed(1);
    var isLast = i === hist14.length - 1;
    html += '<div class="b-chart-col"><div class="b-chart-bar" style="height:' + barH + '%;background:' + (isLast ? accent : '#e8dcc4') + '"></div></div>';
  });
  html += '</div>';
  html += '<div class="b-chart-axis"><span>' + (hist14[0] ? hist14[0].label : '') + '</span><span>' + (hist14[hist14.length-1] ? hist14[hist14.length-1].label : '') + '</span></div>';

  html += '<div class="b-sec-hdr"><span>FRESH STAMPS</span></div><div class="b-recent">';
  if (recent.length === 0) {
    html += '<div class="b-recent-row"><span class="b-recent-name">none yet — keep hoarding</span></div>';
  } else {
    recent.forEach(function(a) {
      html += '<div class="b-recent-row"><span>' + a.icon + '</span><span class="b-recent-name">' + a.name + '</span><span class="b-recent-date">' + a.date + '</span></div>';
    });
  }
  html += '</div></div>'; // /view-stats

  // Achievements view
  html += '<div id="view-ach"' + (VIEW !== 'ach' ? ' class="hidden"' : '') + '>';
  html += '<div class="b-sec-hdr" style="padding-top:12px"><span>STICKER COLLECTION</span><span class="b-sec-count">' + unlocked + ' / ' + TH_ACHIEVEMENTS.length + '</span></div>';
  html += '<div class="b-stickers" style="padding-bottom:14px">';
  TH_ACHIEVEMENTS.forEach(function(a, i) {
    var stored = APP.achievements[a.id] || {};
    var on = stored.unlocked;
    var rot = ((i * 73) % 11 - 5);
    html += '<div class="b-sticker ' + (on ? 'on' : 'off') + '" style="transform:rotate(' + rot + 'deg);aspect-ratio:auto;border-radius:6px;padding:8px 4px;gap:4px" title="' + (on ? stored.date : a.hint) + '">'
      + '<div class="b-sticker-icon" style="font-size:22px">' + (on ? a.icon : '?') + '</div>'
      + '<div class="b-sticker-name" style="font-size:8px">' + (on ? a.name : '???') + '</div>'
      + (on ? '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7px;color:rgba(26,20,16,0.5);margin-top:2px">' + stored.date + '</div>' : '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7px;color:rgba(26,20,16,0.35);margin-top:2px">' + a.hint + '</div>')
      + '</div>';
  });
  html += '</div></div>'; // /view-ach

  // Footer
  html += '<div class="b-foot">'
    + '<div class="b-foot-tabs">'
    + '<button class="b-tab' + (VIEW === 'home' ? ' on' : '') + '" data-tab="home">Home</button>'
    + '<button class="b-tab' + (VIEW === 'stats' ? ' on' : '') + '" data-tab="stats">Stats</button>'
    + '<button class="b-tab' + (VIEW === 'ach' ? ' on' : '') + '" data-tab="ach">Stickers</button>'
    + '</div>'
    + '<div class="b-foot-hr">feelin\' overwhelmed? <a href="#" id="lnk-dupes">close dupes</a> · <a href="#" id="lnk-merge">merge windows</a></div>'
    + '</div>';

  return html;
}

// ─── Theme C renderers ────────────────────────────────────────────────────────

function buildPopupC() {
  var rank = APP.rank;
  var accent = ACCENT_C[rank.tone];
  var rankIdx = APP.rankIdx;
  var nextRank = TH_RANKS[rankIdx + 1];
  var hist14 = getLast14Days(APP.samples);
  var maxT = Math.max.apply(null, hist14.map(function(d) { return d.t; }));
  if (maxT === 0) maxT = 1;
  var unlocked = Object.keys(APP.achievements).filter(function(id) { return APP.achievements[id].unlocked; }).length;
  var recent = getRecentlyUnlocked(APP.achievements, 2);
  var padded = padScore(APP.tabCount, 4);

  var C = { cyan: '#3ef6ff', pink: '#ff2e88', yellow: '#ffd34e', inkDim: 'rgba(232,216,255,0.55)', inkFaint: 'rgba(232,216,255,0.3)' };

  // Header
  var html = '<div class="c-scan"></div><div class="c-vignette"></div>';
  html += '<div class="c-hdr">'
    + '<div class="c-credits">CR. 01</div>'
    + '<div class="c-wordmark">'
    + '<span style="color:' + C.cyan + '">T</span><span style="color:' + C.pink + '">A</span>'
    + '<span style="color:' + C.yellow + '">B</span><span>·</span>'
    + '<span style="color:' + C.pink + '">H</span><span style="color:' + C.yellow + '">O</span>'
    + '<span style="color:' + C.cyan + '">O</span><span style="color:' + C.pink + '">R</span>'
    + '</div>'
    + '<div class="c-blink">1P</div>'
    + '</div>';

  // Home view
  html += '<div id="view-home"' + (VIEW !== 'home' ? ' class="hidden"' : '') + '>';

  // Score
  var paddedChars = padded.split('').map(function(d, i) {
    var isLeadZero = d === '0' && i < padded.length - String(APP.tabCount).length;
    return '<span' + (isLeadZero ? ' class="c-hi-pad"' : '') + '>' + d + '</span>';
  }).join('');

  html += '<div class="c-hi">'
    + '<div class="c-hi-label">— HI · SCORE —</div>'
    + '<div class="c-hi-num" style="color:' + accent + ';text-shadow:0 0 8px ' + accent + ',0 0 18px ' + accent + '88">' + paddedChars + '</div>'
    + '<div class="c-hi-sub">'
    + '<span><span style="color:' + C.cyan + '">WIN</span> ' + padScore(APP.windowCount, 2) + '</span>'
    + '<span><span style="color:' + C.pink + '">ATH</span> ' + padScore(APP.ath, 4) + '</span>'
    + '<span><span style="color:' + C.yellow + '">RNK</span> ' + padScore(rankIdx + 1, 2) + '/09</span>'
    + '</div></div>';

  // Rank
  html += '<div class="c-rank">'
    + '<div class="c-rank-bracket c-rank-bracket-l" style="color:' + accent + '">◄</div>'
    + '<div class="c-rank-mid">'
    + '<div class="c-rank-tier">RANK ' + padScore(rankIdx + 1, 2) + '</div>'
    + '<div class="c-rank-title" style="color:' + accent + '">' + rank.title.toUpperCase() + '</div>'
    + '<div class="c-rank-quote">&ldquo;' + rank.quote + '&rdquo;</div>'
    + '</div>'
    + '<div class="c-rank-bracket c-rank-bracket-r" style="color:' + accent + '">►</div>'
    + '</div>';

  // Progress
  if (nextRank) {
    var progFill = Math.round(((APP.tabCount - rank.min) / (nextRank.min - rank.min)) * 20);
    html += '<div class="c-next">'
      + '<div class="c-next-row"><span>NEXT</span><span class="c-next-name">' + nextRank.title.toUpperCase() + '</span><span>' + (nextRank.min - APP.tabCount) + '</span></div>'
      + '<div class="c-next-bar">';
    for (var ci = 0; ci < 20; ci++) {
      var filled = ci < progFill;
      html += '<span class="c-next-cell' + (filled ? ' on' : '') + '" style="background:' + (filled ? accent : 'transparent') + ';box-shadow:' + (filled ? '0 0 6px ' + accent : 'none') + '"></span>';
    }
    html += '</div></div>';
  }

  // Achievements
  html += '<div class="c-sec-hdr"><span>BONUS · COLLECTED ' + padScore(unlocked, 2) + '/08</span></div>';
  html += '<div class="c-ach-grid">';
  TH_ACHIEVEMENTS.forEach(function(a) {
    var stored = APP.achievements[a.id] || {};
    var on = stored.unlocked;
    var title = on ? ('Unlocked ' + stored.date) : a.hint;
    html += '<div class="c-ach ' + (on ? 'on' : 'off') + '" title="' + title + '">'
      + '<div class="c-ach-icon">' + (on ? a.icon : '?') + '</div>'
      + '<div class="c-ach-name">' + (on ? a.name.toUpperCase() : '???') + '</div>'
      + '</div>';
  });
  html += '</div>';
  html += '<div class="c-pulse">▸ INSERT TAB TO CONTINUE</div>';
  html += '</div>'; // /view-home

  // Stats view
  html += '<div id="view-stats"' + (VIEW !== 'stats' ? ' class="hidden"' : '') + '>';
  html += '<div class="c-hi c-hi-mini">'
    + '<div class="c-hi-label">— CURRENT —</div>'
    + '<div class="c-hi-num c-hi-num-sm" style="color:' + accent + '">' + padded + '</div>'
    + '</div>';

  html += '<div class="c-sec-hdr"><span>14 D · TAB LOG</span><a href="#" class="c-link" id="lnk-history">FULL LOG ►</a></div>';
  html += '<div class="c-chart">';
  hist14.forEach(function(d, i) {
    var barH = ((d.t / maxT) * 100).toFixed(1);
    var isLast = i === hist14.length - 1;
    var barColor = isLast ? accent : C.pink;
    var glow = isLast ? '0 0 8px ' + accent : '0 0 4px ' + C.pink + '66';
    html += '<div class="c-chart-col">'
      + '<div class="c-chart-val" style="color:' + (isLast ? accent : C.inkFaint) + '">' + d.t + '</div>'
      + '<div class="c-chart-bar-wrap"><div class="c-chart-bar" style="height:' + barH + '%;background:linear-gradient(0deg,' + barColor + ',' + (isLast ? accent : '#c66dff') + ');box-shadow:' + glow + '"></div></div>'
      + '</div>';
  });
  html += '</div>';
  html += '<div class="c-chart-axis"><span>' + (hist14[0] ? hist14[0].label.replace(' ', '/') : '') + '</span><span>' + (hist14[hist14.length-1] ? hist14[hist14.length-1].label.replace(' ', '/') : '') + '</span></div>';

  var weekData = hist14.slice(-7);
  var weekAvg = weekData.length > 0 ? Math.round(weekData.reduce(function(s, d) { return s + d.t; }, 0) / weekData.length) : 0;
  var prevAvg = hist14.slice(0, 7).reduce(function(s, d) { return s + d.t; }, 0) / 7;
  var delta = prevAvg > 0 ? Math.round((weekAvg / prevAvg - 1) * 100) : 0;

  html += '<div class="c-stats-row">'
    + '<div class="c-stat-cell"><div class="c-stat-k">7D AVG</div><div class="c-stat-v" style="color:' + C.cyan + '">' + padScore(weekAvg, 4) + '</div></div>'
    + '<div class="c-stat-cell"><div class="c-stat-k">ATH</div><div class="c-stat-v" style="color:' + C.yellow + '">' + padScore(APP.ath, 4) + '</div></div>'
    + '<div class="c-stat-cell"><div class="c-stat-k">DELTA</div><div class="c-stat-v" style="color:' + (delta >= 0 ? C.pink : '#7fff7f') + '">' + (delta >= 0 ? '+' : '') + delta + '%</div></div>'
    + '</div>';

  html += '<div class="c-sec-hdr"><span>RECENT BONUS</span></div><div class="c-recent">';
  if (recent.length === 0) {
    html += '<div class="c-recent-row"><span class="c-recent-name">NONE YET</span></div>';
  } else {
    recent.forEach(function(a) {
      html += '<div class="c-recent-row"><span>' + a.icon + '</span><span class="c-recent-name">' + a.name.toUpperCase() + '</span><span class="c-recent-date">' + a.date + '</span></div>';
    });
  }
  html += '</div></div>'; // /view-stats

  // Achievements view
  html += '<div id="view-ach"' + (VIEW !== 'ach' ? ' class="hidden"' : '') + '>';
  html += '<div class="c-sec-hdr" style="padding-top:12px"><span>BONUS COLLECTION ' + padScore(unlocked, 2) + '/08</span></div>';
  html += '<div class="c-ach-grid" style="grid-template-columns:repeat(4,1fr);padding-bottom:14px">';
  TH_ACHIEVEMENTS.forEach(function(a) {
    var stored = APP.achievements[a.id] || {};
    var on = stored.unlocked;
    html += '<div class="c-ach ' + (on ? 'on' : 'off') + '" style="aspect-ratio:auto;padding:10px 4px;gap:4px" title="' + (on ? stored.date : a.hint) + '">'
      + '<div class="c-ach-icon" style="font-size:18px">' + (on ? a.icon : '?') + '</div>'
      + '<div class="c-ach-name">' + (on ? a.name.toUpperCase() : '???') + '</div>'
      + (on ? '<div style="font-family:\'Silkscreen\',monospace;font-size:6px;color:' + C.cyan + ';margin-top:2px">' + stored.date + '</div>' : '')
      + '</div>';
  });
  html += '</div></div>'; // /view-ach

  // Footer
  html += '<div class="c-foot">'
    + '<div class="c-foot-tabs">'
    + '<button class="c-tab' + (VIEW === 'home' ? ' on' : '') + '" data-tab="home">' + (VIEW === 'home' ? '► ' : '  ') + '1P</button>'
    + '<button class="c-tab' + (VIEW === 'stats' ? ' on' : '') + '" data-tab="stats">' + (VIEW === 'stats' ? '► ' : '  ') + 'LOG</button>'
    + '<button class="c-tab' + (VIEW === 'ach' ? ' on' : '') + '" data-tab="ach">' + (VIEW === 'ach' ? '► ' : '  ') + 'BNS</button>'
    + '</div>'
    + '<div class="c-foot-hr">TILT? <a href="#" id="lnk-dupes">CLOSE.DUPES</a> · <a href="#" id="lnk-merge">MERGE.WIN</a></div>'
    + '</div>';

  return html;
}

// ─── Main render ──────────────────────────────────────────────────────────────

function render() {
  var theme = (APP.settings && APP.settings.theme) || 'a';
  var root = document.getElementById('root');

  var html;
  if (theme === 'b') html = buildPopupB();
  else if (theme === 'c') html = buildPopupC();
  else html = buildPopupA();

  root.innerHTML = html;
  bindEvents();
}

function bindEvents() {
  // Tab navigation
  document.querySelectorAll('[data-tab]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      VIEW = btn.dataset.tab;
      render();
    });
  });

  // Header: history
  var btnHistory = document.getElementById('btn-history');
  if (btnHistory) {
    btnHistory.addEventListener('click', function() {
      browser.tabs.create({ url: browser.runtime.getURL('history/history.html') });
      window.close();
    });
  }

  // Link to history in stats view
  var lnkHistory = document.getElementById('lnk-history');
  if (lnkHistory) {
    lnkHistory.addEventListener('click', function(e) {
      e.preventDefault();
      browser.tabs.create({ url: browser.runtime.getURL('history/history.html') });
      window.close();
    });
  }

  // Header: settings
  var btnSettings = document.getElementById('btn-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', function() {
      browser.runtime.openOptionsPage();
      window.close();
    });
  }

  // Harm reduction links (no-op for now — could open browser.tabs with search)
  ['lnk-dupes', 'lnk-merge'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function(e) { e.preventDefault(); });
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  browser.storage.local.get(null, function(data) {
    data = data || {};
    var settings = data.settings || {};

    // Apply theme immediately
    var theme = settings.theme || 'a';
    document.body.className = 'theme-' + theme;

    // Query live counts
    browser.tabs.query({}, function(tabs) {
      var tabCount = tabs ? tabs.length : 0;
      browser.windows.getAll({}, function(wins) {
        var windowCount = wins ? wins.length : 0;
        var rank = thRankFor(tabCount);
        var rankIdx = thRankIndex(tabCount);

        APP = {
          tabCount: tabCount,
          windowCount: windowCount,
          rank: rank,
          rankIdx: rankIdx,
          ath: data.ath || tabCount,
          athDate: data.athDate || thFormatDate(Date.now()),
          achievements: data.achievements || {},
          samples: data.samples || [],
          settings: settings,
        };

        render();
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
