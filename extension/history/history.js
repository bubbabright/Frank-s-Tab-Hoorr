// Tab Hoor — history page
'use strict';

const api = globalThis.browser || globalThis.chrome;

let RANGE = '7d';
let ALL = [];
let ALL_ACTIONS = [];
let ATH = 0;
let ATH_DATE = '';
let NOW_T = 0;
let NOW_W = 0;

function rangeMs(r) {
  return {
    '24h': 86400000,
    '7d': 7 * 86400000,
    '30d': 30 * 86400000,
    '90d': 90 * 86400000,
    'all': Infinity
  }[r] || 7 * 86400000;
}

/** How many day rows to show for the selected range button. */
function rangeDayCount(r) {
  return {
    '24h': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
    'all': null // computed from data
  }[r];
}

function rangeLabel(r) {
  return {
    '24h': 'last 24 hours',
    '7d': 'last 7 days',
    '30d': 'last 30 days',
    '90d': 'last 90 days',
    'all': 'all time'
  }[r] || r;
}

function filterSamples(samples) {
  if (RANGE === 'all') return samples.slice();
  const cutoff = Date.now() - rangeMs(RANGE);
  return samples.filter(s => s.ts >= cutoff);
}

function stats(samples) {
  if (!samples.length) {
    return { avg: 0, peak: 0, min: 0, n: 0, last: 0 };
  }
  const vals = samples.map(s => s.t);
  return {
    avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    peak: Math.max(...vals),
    min: Math.min(...vals),
    n: samples.length,
    last: samples[samples.length - 1].t
  };
}

function formatXLabel(ts, range) {
  const d = new Date(ts);
  if (range === '24h') {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (range === '7d') {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function renderStats(s) {
  document.getElementById('stats').innerHTML = `
    <div class="stat"><div class="stat-k">Now</div><div class="stat-v">${NOW_T}</div><div class="stat-s">${NOW_W} windows</div></div>
    <div class="stat"><div class="stat-k">Avg (${RANGE})</div><div class="stat-v">${s.avg}</div><div class="stat-s">${s.n} samples</div></div>
    <div class="stat"><div class="stat-k">Peak (${RANGE})</div><div class="stat-v">${s.peak}</div><div class="stat-s">min ${s.min}</div></div>
    <div class="stat"><div class="stat-k">All-time high</div><div class="stat-v">${ATH || '—'}</div><div class="stat-s">${ATH_DATE || ''}</div></div>
  `;
}

function renderChart(samples) {
  const el = document.getElementById('chart');
  if (samples.length < 2) {
    el.innerHTML = '<p class="chart-empty">Not enough samples yet. Keep the browser open and tabs will be recorded.</p>';
    return;
  }

  // downsample to ~120 points for SVG
  const maxPts = 120;
  let pts = samples;
  if (pts.length > maxPts) {
    const step = pts.length / maxPts;
    const down = [];
    for (let i = 0; i < maxPts; i++) down.push(pts[Math.floor(i * step)]);
    // always include last sample
    if (down[down.length - 1] !== samples[samples.length - 1]) {
      down[down.length - 1] = samples[samples.length - 1];
    }
    pts = down;
  }

  const w = 840;
  const h = 220;
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 42; // room for x-axis labels
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const vals = pts.map(p => p.t);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals);
  const yRange = max - min || 1;

  const xAt = i => padL + (i / (pts.length - 1)) * plotW;
  const yAt = t => padT + (1 - (t - min) / yRange) * plotH;

  const path = pts.map((p, i) => {
    return `${i ? 'L' : 'M'}${xAt(i).toFixed(1)} ${yAt(p.t).toFixed(1)}`;
  }).join(' ');

  const last = pts[pts.length - 1];
  const lx = xAt(pts.length - 1);
  const ly = yAt(last.t);

  // Y-axis ticks (3)
  const yTicks = [max, Math.round((max + min) / 2), min];
  let yTickSvg = '';
  yTicks.forEach(v => {
    const y = yAt(v);
    yTickSvg += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" stroke="#2a2a2a"/>`;
    yTickSvg += `<text x="${padL - 6}" y="${(y + 4).toFixed(1)}" fill="#888" font-size="12" text-anchor="end">${v}</text>`;
  });

  // X-axis labels — evenly spaced along time
  const tickCount = RANGE === '24h' ? 6 : (RANGE === '7d' ? 7 : 6);
  const nTicks = Math.min(tickCount, pts.length);
  let xTickSvg = '';
  for (let i = 0; i < nTicks; i++) {
    const idx = nTicks === 1 ? 0 : Math.round(i * (pts.length - 1) / (nTicks - 1));
    const p = pts[idx];
    const x = xAt(idx);
    const label = formatXLabel(p.ts, RANGE);
    const anchor = i === 0 ? 'start' : (i === nTicks - 1 ? 'end' : 'middle');
    xTickSvg += `<line x1="${x.toFixed(1)}" y1="${padT + plotH}" x2="${x.toFixed(1)}" y2="${padT + plotH + 5}" stroke="#555"/>`;
    xTickSvg += `<text x="${x.toFixed(1)}" y="${h - 12}" fill="#aaa" font-size="12" text-anchor="${anchor}">${label}</text>`;
  }

  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" class="chart-svg">
    ${yTickSvg}
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#444"/>
    <line x1="${padL}" y1="${padT + plotH}" x2="${w - padR}" y2="${padT + plotH}" stroke="#444"/>
    <path d="${path}" fill="none" stroke="#ffd700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.5" fill="#ffd700"/>
    ${xTickSvg}
  </svg>`;
}

/**
 * Day breakdown: one row per calendar day in the selected range.
 * Value = max open tabs observed that day.
 */
function renderDays() {
  const now = Date.now();
  const dayMs = 86400000;
  const titleEl = document.getElementById('dayTitle');

  // Bucket ALL samples by local calendar day key (YYYY-MM-DD), track max
  const byKey = {};
  ALL.forEach(s => {
    const d = new Date(s.ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!byKey[key] || s.t > byKey[key].max) {
      byKey[key] = { max: s.t, ts: s.ts };
    } else if (s.ts > byKey[key].ts) {
      byKey[key].ts = s.ts;
    }
  });

  // Build ordered list of days for the selected range (newest first)
  let days = [];
  const fixed = rangeDayCount(RANGE);
  if (fixed != null) {
    for (let i = 0; i < fixed; i++) {
      const d = new Date(now - i * dayMs);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        key,
        label: d.toLocaleDateString(undefined, {
          weekday: RANGE === '24h' || RANGE === '7d' ? 'short' : undefined,
          month: 'short',
          day: 'numeric'
        }),
        max: byKey[key] ? byKey[key].max : null
      });
    }
  } else {
    // all: every day that has data, newest first
    days = Object.keys(byKey)
      .sort()
      .reverse()
      .map(key => {
        const [y, m, dd] = key.split('-').map(Number);
        const d = new Date(y, m - 1, dd);
        return {
          key,
          label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }),
          max: byKey[key].max
        };
      });
  }

  if (titleEl) {
    titleEl.textContent = `Day breakdown · max tabs · ${rangeLabel(RANGE)}`;
  }

  if (!days.length) {
    document.getElementById('dayList').innerHTML =
      '<p class="chart-empty">No day data yet.</p>';
    return;
  }

  const maxBar = Math.max(1, ...days.map(d => d.max || 0));
  let html = '<div class="day-head"><span>Day</span><span>Max tabs</span></div>';
  days.forEach(row => {
    const v = row.max;
    const pct = v == null ? 0 : (v / maxBar) * 100;
    html += `<div class="day-row">
      <div class="day-label">${row.label}</div>
      <div class="day-bar-bg"><div class="day-bar" style="width:${pct}%"></div></div>
      <div class="day-val">${v == null ? '—' : v}</div>
    </div>`;
  });
  document.getElementById('dayList').innerHTML = html;
}

function actionTime(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

/**
 * Action log: what Tab Hoor did on its own (idle cleanup) or on request
 * (dedupe, close old tabs, merge), and how many tabs each one removed.
 */
function renderActions() {
  const titleEl = document.getElementById('actionTitle');
  const cutoff = RANGE === 'all' ? 0 : Date.now() - rangeMs(RANGE);
  const rows = ALL_ACTIONS.filter(a => a.ts >= cutoff).slice().reverse();
  const removed = rows.reduce((n, a) => n + thActionTabs(a), 0);

  if (titleEl) {
    titleEl.textContent = `Actions · ${rangeLabel(RANGE)} · ${removed} tab${removed === 1 ? '' : 's'} removed`;
  }

  const list = document.getElementById('actionList');
  if (!rows.length) {
    list.innerHTML = '<p class="chart-empty">No actions recorded yet. Close Dupes, Close Old Tabs, Merge Windows and idle cleanup are logged here.</p>';
    return;
  }

  let html = '<div class="act-head"><span>When</span><span>Action</span><span>Result</span></div>';
  rows.forEach(a => {
    const k = TH_ACTION_KINDS[a.kind] || { label: a.kind, auto: false };
    let result;
    if (a.kind === 'merge') {
      result = `merged ${a.tabs} tab${a.tabs === 1 ? '' : 's'} from ${a.windows} window${a.windows === 1 ? '' : 's'}`;
    } else {
      const parts = [];
      if (a.closed) parts.push(`closed ${a.closed}`);
      if (a.discarded) parts.push(`unloaded ${a.discarded}`);
      result = parts.join(', ') || '—';
    }
    html += `<div class="act-row">
      <div class="act-when">${actionTime(a.ts)}</div>
      <div class="act-kind"><span class="act-tag ${k.auto ? 'auto' : 'manual'}">${k.label}</span></div>
      <div class="act-result">${result}</div>
    </div>`;
  });
  list.innerHTML = html;
}

function render() {
  document.querySelectorAll('#ranges button').forEach(b => {
    b.classList.toggle('on', b.dataset.range === RANGE);
  });
  const samples = filterSamples(ALL);
  const s = stats(samples);
  renderStats(s);
  renderChart(samples);
  renderDays();
  renderActions();
}

async function boot() {
  const [data, tabs, wins] = await Promise.all([
    api.storage.local.get(['samples', 'ath', 'athDate', 'actions']),
    api.tabs.query({}),
    api.windows.getAll({ windowTypes: ['normal'] })
  ]);
  ALL = data.samples || [];
  ALL_ACTIONS = data.actions || [];
  ATH = data.ath || 0;
  ATH_DATE = data.athDate || '';
  NOW_T = tabs.length;
  NOW_W = wins.length;
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  boot();
  document.getElementById('ranges').addEventListener('click', e => {
    const btn = e.target.closest('button[data-range]');
    if (!btn) return;
    RANGE = btn.dataset.range;
    render();
  });
  document.getElementById('btnCsv').addEventListener('click', () => {
    const lines = ['timestamp_iso,tabs,windows'];
    filterSamples(ALL).forEach(s => {
      lines.push(`${new Date(s.ts).toISOString()},${s.t},${s.w}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tab-hoor-history-${RANGE}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById('btnClear').addEventListener('click', async () => {
    if (!confirm('Clear all history samples?')) return;
    await api.storage.local.set({ samples: [] });
    ALL = [];
    render();
  });
  document.getElementById('btnClearActions').addEventListener('click', async () => {
    if (!confirm('Clear the action log?')) return;
    await api.storage.local.set({ actions: [] });
    ALL_ACTIONS = [];
    renderActions();
  });
});
