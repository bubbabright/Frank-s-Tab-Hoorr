/* Tab Hoor — History page JS */
'use strict';

// ─── Color tokens ─────────────────────────────────────────────────────────────
var C = {
  bg: '#1a1410', ink: '#f3e8d0', inkDim: 'rgba(243,232,208,0.62)',
  inkFaint: 'rgba(243,232,208,0.38)', rule: 'rgba(214,168,72,0.28)',
  gold: '#d6a848', green: '#7fb069', amber: '#e0a23a', red: '#c8453a', purple: '#9b6dd1'
};
var TONE_COLORS = { green: C.green, amber: C.amber, red: C.red, purple: C.purple };

// ─── State ────────────────────────────────────────────────────────────────────
var RANGE = '30d';
var ALL_SAMPLES = [];
var ATH = 0;
var ATH_DATE = '';
var ACHIEVEMENTS = {};
var NOW_TABS = 0;
var NOW_WINDOWS = 0;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  Promise.all([
    browser.storage.local.get(['samples', 'ath', 'athDate', 'achievements']),
    browser.tabs.query({}),
    browser.windows.getAll()
  ]).then(function (results) {
    var data = results[0];
    var tabs = results[1];
    var wins = results[2];

    ALL_SAMPLES = data.samples || [];
    ATH = data.ath || 0;
    ATH_DATE = data.athDate || '';
    ACHIEVEMENTS = data.achievements || {};
    NOW_TABS = tabs.length;
    NOW_WINDOWS = wins.length;

    render();
  });
});

// ─── Main render ──────────────────────────────────────────────────────────────
function render() {
  var samples = filterByRange(ALL_SAMPLES, RANGE);
  document.getElementById('root').innerHTML = buildPage(samples);
  bindPage();
}

function buildPage(samples) {
  var stats = computeStats(samples);
  return `
    <div class="hist-hdr">
      <div class="set-hdr-mark">
        <span class="set-hdr-glyph">⌬</span>
        <span class="set-hdr-text">TAB&nbsp;HOOR</span>
        <span class="set-hdr-sub">/ history</span>
      </div>
      <div class="hist-range">
        ${['24h','7d','30d','90d','all'].map(function (r) {
          return `<button class="hist-rangebtn ${RANGE === r ? 'on' : ''}" data-range="${r}">${r}</button>`;
        }).join('')}
      </div>
    </div>

    ${buildStats(stats)}

    <div class="hist-chart-card">
      <div class="hist-chart-hdr">
        <div class="hist-chart-title">Open tabs · ${rangeLabel()}</div>
        <div class="hist-chart-legend">
          <span><span class="hist-leg-sw" style="background:${C.gold}"></span> tabs</span>
          <span><span class="hist-leg-sw" style="background:${C.green};opacity:.7"></span> windows ×18</span>
          <span><span class="hist-leg-sw" style="background:${C.red};height:10px;width:2px"></span> rank-up</span>
        </div>
      </div>
      ${buildBigChart(samples)}
      ${buildRankTimeline(samples)}
    </div>

    <div class="hist-grid">
      <div class="hist-card">
        <div class="hist-card-title">Hour-of-day pattern</div>
        ${buildHeatmap(samples)}
      </div>
      <div class="hist-card">
        <div class="hist-card-title">Day breakdown · last 14 days</div>
        ${buildDayList()}
      </div>
    </div>

    <div class="hist-foot">
      <span>All data stored locally. No URLs collected. Counts only.</span>
      <button class="hist-foot-btn" id="btn-export-csv">⬇ Export CSV</button>
      <button class="hist-foot-btn danger" id="btn-clear">🗑 Clear history</button>
    </div>
  `;
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
function computeStats(samples) {
  var avg30 = 0;
  var samples30 = filterByRange(ALL_SAMPLES, '30d');
  if (samples30.length) {
    avg30 = Math.round(samples30.reduce(function (s, x) { return s + x.t; }, 0) / samples30.length);
  }

  var daysTracked = 0;
  if (ALL_SAMPLES.length) {
    var first = ALL_SAMPLES[0].ts;
    daysTracked = Math.max(1, Math.round((Date.now() - first) / 86400000));
  }

  var rankUps = countRankUps(samples);

  return {
    nowTabs: NOW_TABS,
    nowWindows: NOW_WINDOWS,
    ath: ATH,
    athDate: ATH_DATE,
    avg30: avg30,
    daysTracked: daysTracked,
    rankUps: rankUps
  };
}

function buildStats(s) {
  return `<div class="hist-stats">
    ${stat('RIGHT NOW', String(s.nowTabs), 'across ' + s.nowWindows + ' window' + (s.nowWindows !== 1 ? 's' : ''), C.red)}
    ${stat('ALL-TIME HIGH', String(s.ath || '—'), s.athDate || 'no data yet', C.gold)}
    ${stat('30-DAY AVG', s.avg30 ? String(s.avg30) : '—', 'tabs per sample', C.ink)}
    ${stat('DAYS TRACKED', String(s.daysTracked), 'since first sample', C.ink)}
    ${stat('RANK-UPS', pad2(s.rankUps), 'in selected range', C.ink)}
  </div>`;
}

function stat(label, value, sub, accent) {
  var shadow = (accent === C.ink) ? 'none' : '0 0 14px ' + accent + '66';
  return `<div class="hist-stat">
    <div class="hist-stat-k">${label}</div>
    <div class="hist-stat-v" style="color:${accent};text-shadow:${shadow}">${value}</div>
    <div class="hist-stat-s">${sub}</div>
  </div>`;
}

// ─── Big area chart ───────────────────────────────────────────────────────────
function buildBigChart(samples) {
  if (samples.length < 2) {
    return '<div class="hist-empty">No data for this range yet.</div>';
  }

  var W = 920, H = 260, pL = 36, pR = 12, pT = 14, pB = 26;
  var maxT = Math.max(150, Math.max.apply(null, samples.map(function (s) { return s.t; })));

  var xs = samples.map(function (_, i) {
    return pL + (i / (samples.length - 1)) * (W - pL - pR);
  });
  var ys = samples.map(function (s) {
    return pT + (1 - s.t / maxT) * (H - pT - pB);
  });
  var wys = samples.map(function (s) {
    return pT + (1 - (s.w * 18) / maxT) * (H - pT - pB);
  });

  var tabPath = xs.map(function (x, i) {
    return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + ys[i].toFixed(1);
  }).join(' ');
  var tabArea = tabPath +
    ' L' + xs[xs.length-1].toFixed(1) + ' ' + (H - pB) +
    ' L' + xs[0].toFixed(1) + ' ' + (H - pB) + ' Z';
  var winPath = xs.map(function (x, i) {
    return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + wys[i].toFixed(1);
  }).join(' ');

  // rank-up markers
  var thresholds = TH_RANKS.map(function (r) { return r.min; }).filter(function (m) { return m > 0; });
  var markers = [];
  for (var i = 1; i < samples.length; i++) {
    thresholds.forEach(function (t) {
      if (samples[i].t >= t && samples[i-1].t < t) {
        markers.push({ x: xs[i], y: ys[i] });
      }
    });
  }

  // Y grid
  var gridVals = [0];
  for (var v = 50; v <= maxT; v += 50) gridVals.push(v);
  var yGrid = gridVals.map(function (v) {
    var y = pT + (1 - v / maxT) * (H - pT - pB);
    return `<g>
      <line x1="${pL}" y1="${y.toFixed(1)}" x2="${W - pR}" y2="${y.toFixed(1)}" stroke="${C.rule}" stroke-dasharray="2 4"/>
      <text x="${pL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-family="JetBrains Mono" font-size="10" fill="${C.inkFaint}">${v}</text>
    </g>`;
  }).join('');

  // tone zones
  var zones = [
    { tone: 'green', min: 0, max: 15 },
    { tone: 'amber', min: 16, max: 50 },
    { tone: 'red',   min: 51, max: maxT },
  ];
  var zoneRects = zones.map(function (z) {
    var yTop = pT + (1 - Math.min(z.max, maxT) / maxT) * (H - pT - pB);
    var yBot = pT + (1 - z.min / maxT) * (H - pT - pB);
    return `<rect x="${pL}" y="${yTop.toFixed(1)}" width="${W - pL - pR}" height="${(yBot - yTop).toFixed(1)}" fill="${TONE_COLORS[z.tone]}" opacity="0.04"/>`;
  }).join('');

  // x-axis labels
  var startDate = new Date(samples[0].ts);
  var endDate = new Date(samples[samples.length-1].ts);
  var midDate = new Date((samples[0].ts + samples[samples.length-1].ts) / 2);
  function fmtDate(d) { return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }); }

  var markerEls = markers.map(function (m) {
    return `<g>
      <line x1="${m.x.toFixed(1)}" y1="${pT}" x2="${m.x.toFixed(1)}" y2="${H - pB}" stroke="${C.red}" stroke-width="1" stroke-dasharray="2 3" opacity="0.55"/>
      <circle cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="3.5" fill="${C.red}" stroke="${C.bg}" stroke-width="1.5"/>
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="hist-bigchart">
    <defs>
      <linearGradient id="histFill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${C.gold}" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="${C.gold}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${yGrid}
    ${zoneRects}
    <path d="${tabArea}" fill="url(#histFill)"/>
    <path d="${tabPath}" fill="none" stroke="${C.gold}" stroke-width="2" stroke-linecap="round"/>
    <path d="${winPath}" fill="none" stroke="${C.green}" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.65"/>
    ${markerEls}
    <circle cx="${xs[xs.length-1].toFixed(1)}" cy="${ys[ys.length-1].toFixed(1)}" r="4" fill="${C.gold}"/>
    <text x="${pL}" y="${H - 8}" font-family="JetBrains Mono" font-size="10" fill="${C.inkFaint}">${fmtDate(startDate)}</text>
    <text x="${(W/2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="${C.inkFaint}">${fmtDate(midDate)}</text>
    <text x="${W - pR}" y="${H - 8}" text-anchor="end" font-family="JetBrains Mono" font-size="10" fill="${C.inkFaint}">${fmtDate(endDate)}</text>
  </svg>`;
}

// ─── Rank-up timeline ─────────────────────────────────────────────────────────
function buildRankTimeline(samples) {
  var events = [];
  var thresholds = TH_RANKS.map(function (r) { return r.min; }).filter(function (m) { return m > 0; });

  for (var i = 1; i < samples.length; i++) {
    thresholds.forEach(function (t) {
      if (samples[i].t >= t && samples[i-1].t < t) {
        var r = thRankFor(t);
        events.push({
          d: new Date(samples[i].ts).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
          t: r.title,
          n: samples[i].t
        });
      }
    });
  }

  if (!events.length) {
    return '<div class="hist-rankup"><div class="hist-rankup-k">RANK PROGRESSION</div><div style="font-size:12px;opacity:.4;padding:8px 0">No rank-ups recorded in this range.</div></div>';
  }

  return `<div class="hist-rankup">
    <div class="hist-rankup-k">RANK PROGRESSION</div>
    <div class="hist-rankup-row">
      ${events.map(function (e, i) {
        return `<div class="hist-rankup-node">
          <div class="hist-rankup-dot"></div>
          <div class="hist-rankup-meta">
            <div class="hist-rankup-d">${e.d}</div>
            <div class="hist-rankup-t">${escHtml(e.t)}</div>
            <div class="hist-rankup-n">@ ${e.n} tabs</div>
          </div>
          ${i < events.length - 1 ? '<div class="hist-rankup-arm"></div>' : ''}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ─── Heatmap (hour × day-of-week) ─────────────────────────────────────────────
function buildHeatmap(samples) {
  // aggregate: for each (dow, hour) slot, collect all tab counts
  var grid = [];
  for (var d = 0; d < 7; d++) {
    grid.push([]);
    for (var h = 0; h < 24; h++) grid[d].push([]);
  }

  samples.forEach(function (s) {
    var date = new Date(s.ts);
    var dow = (date.getDay() + 6) % 7; // Mon=0 … Sun=6
    var hr = date.getHours();
    grid[dow][hr].push(s.t);
  });

  var maxVal = 1;
  grid.forEach(function (row) {
    row.forEach(function (cell) {
      if (cell.length) {
        var avg = cell.reduce(function (a, b) { return a + b; }, 0) / cell.length;
        if (avg > maxVal) maxVal = avg;
      }
    });
  });

  var days = ['M','T','W','T','F','S','S'];
  var hours = [];
  for (var i = 0; i < 24; i++) hours.push(i);

  var rows = days.map(function (dl, d) {
    var cells = hours.map(function (h) {
      var vals = grid[d][h];
      if (!vals.length) {
        return `<div class="hist-heat-cell" style="background:rgba(214,168,72,0.05)"></div>`;
      }
      var avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      var intensity = avg / maxVal;
      var opacity = (0.12 + intensity * 0.85).toFixed(2);
      return `<div class="hist-heat-cell" style="background:rgba(214,168,72,${opacity})"></div>`;
    }).join('');
    return `<div class="hist-heat-row">
      <div class="hist-heat-d">${dl}</div>
      ${cells}
    </div>`;
  }).join('');

  var axRow = `<div class="hist-heat-row hist-heat-ax">
    <div class="hist-heat-d"></div>
    ${hours.map(function (h) {
      return h % 6 === 0
        ? `<div class="hist-heat-cell hist-heat-label">${h}</div>`
        : `<div class="hist-heat-cell"></div>`;
    }).join('')}
  </div>`;

  var legBar = [0.1,0.3,0.5,0.7,0.9].map(function (v) {
    return `<span style="background:rgba(214,168,72,${v})"></span>`;
  }).join('');

  return `<div class="hist-heat">
    <div class="hist-heat-grid">
      ${rows}
      ${axRow}
    </div>
    <div class="hist-heat-legend">
      <span>less</span>
      <div class="hist-heat-leg-bar">${legBar}</div>
      <span>more</span>
    </div>
  </div>`;
}

// ─── Day list (last 14 days) ──────────────────────────────────────────────────
function buildDayList() {
  var days = getLast14Days(ALL_SAMPLES);
  if (!days.length) {
    return '<div style="opacity:.4;font-style:italic;font-size:13px">No data yet.</div>';
  }

  var max = Math.max.apply(null, days.map(function (d) { return d.t; }));

  return `<div class="hist-days">
    ${days.slice().reverse().map(function (d) {
      var rank = thRankFor(d.t);
      var col = TONE_COLORS[rank.tone] || C.gold;
      var pct = max > 0 ? Math.round((d.t / max) * 100) : 0;
      return `<div class="hist-day">
        <div class="hist-day-d">${d.label}</div>
        <div class="hist-day-bar"><div style="width:${pct}%;background:${col}"></div></div>
        <div class="hist-day-n">${d.t}</div>
        <div class="hist-day-w">${d.w}w</div>
      </div>`;
    }).join('')}
  </div>`;
}

// ─── Event binding ────────────────────────────────────────────────────────────
function bindPage() {
  document.querySelectorAll('[data-range]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      RANGE = btn.dataset.range;
      render();
    });
  });

  var exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) exportBtn.addEventListener('click', exportCsv);

  var clearBtn = document.getElementById('btn-clear');
  if (clearBtn) clearBtn.addEventListener('click', clearHistory);
}

// ─── Export CSV ───────────────────────────────────────────────────────────────
function exportCsv() {
  var lines = ['timestamp,tabs,windows,date'];
  ALL_SAMPLES.forEach(function (s) {
    var d = new Date(s.ts).toISOString();
    lines.push([s.ts, s.t, s.w, d].join(','));
  });
  var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'tab-hoor-history.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Clear history ────────────────────────────────────────────────────────────
function clearHistory() {
  if (!confirm('Delete all history samples? This cannot be undone.')) return;
  browser.storage.local.set({ samples: [], ath: 0, athDate: '' }).then(function () {
    ALL_SAMPLES = [];
    ATH = 0;
    ATH_DATE = '';
    render();
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function filterByRange(samples, range) {
  if (range === 'all') return samples;
  var ms = { '24h': 86400000, '7d': 604800000, '30d': 2592000000, '90d': 7776000000 }[range];
  if (!ms) return samples;
  var cutoff = Date.now() - ms;
  return samples.filter(function (s) { return s.ts >= cutoff; });
}

function rangeLabel() {
  return { '24h': 'last 24 hours', '7d': 'last 7 days', '30d': 'last 30 days', '90d': 'last 90 days', 'all': 'all time' }[RANGE] || RANGE;
}

function countRankUps(samples) {
  var count = 0;
  var thresholds = TH_RANKS.map(function (r) { return r.min; }).filter(function (m) { return m > 0; });
  for (var i = 1; i < samples.length; i++) {
    thresholds.forEach(function (t) {
      if (samples[i].t >= t && samples[i-1].t < t) count++;
    });
  }
  return count;
}

function getLast14Days(samples) {
  var days = {};
  var now = Date.now();
  for (var i = 0; i < 14; i++) {
    var d = new Date(now - i * 86400000);
    var key = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    days[key] = { label: key, t: 0, w: 0, count: 0 };
  }
  samples.forEach(function (s) {
    var d = new Date(s.ts);
    var key = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    if (days[key]) {
      days[key].t = Math.max(days[key].t, s.t);
      days[key].w = Math.max(days[key].w, s.w || 0);
      days[key].count++;
    }
  });
  return Object.values(days).filter(function (d) { return d.count > 0; });
}

function thRankFor(n) {
  for (var i = 0; i < TH_RANKS.length; i++) {
    var r = TH_RANKS[i];
    if (n >= r.min && n <= r.max) return r;
  }
  return TH_RANKS[0];
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
