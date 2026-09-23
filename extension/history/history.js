// Tab Hoor — history page
'use strict';

const api = globalThis.browser || globalThis.chrome;

// Small DOM builders so rendering never touches innerHTML with interpolated values.
function h(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else node.setAttribute(k, v);
  }
  (children || []).forEach(c => {
    if (c == null) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, children) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  (children || []).forEach(c => {
    if (c == null) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

function replaceContent(container, node) {
  container.textContent = '';
  container.appendChild(node);
}

function emptyState(container, text) {
  replaceContent(container, h('p', { class: 'chart-empty' }, [text]));
}

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

function formatXLabel(ts, range, includeTime) {
  const d = new Date(ts);
  if (range === '24h') {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (range === '7d') {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  // A wide range (e.g. 90d/all) whose actual samples only span a day or two would
  // otherwise repeat the same bare date across every tick — add the time so ticks differ.
  if (!includeTime) return date;
  return `${date}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function statBlock(k, v, s) {
  return h('div', { class: 'stat' }, [
    h('div', { class: 'stat-k' }, [k]),
    h('div', { class: 'stat-v' }, [String(v)]),
    h('div', { class: 'stat-s' }, [s])
  ]);
}

function renderStats(s) {
  const container = document.getElementById('stats');
  container.textContent = '';
  container.appendChild(statBlock('Now', NOW_T, `${NOW_W} windows`));
  container.appendChild(statBlock(`Avg (${RANGE})`, s.avg, `${s.n} samples`));
  container.appendChild(statBlock(`Peak (${RANGE})`, s.peak, `min ${s.min}`));
  container.appendChild(statBlock('All-time high', ATH || '—', ATH_DATE || ''));
}

function renderChart(samples) {
  const el = document.getElementById('chart');
  if (samples.length < 2) {
    emptyState(el, 'Not enough samples yet. Keep the browser open and tabs will be recorded.');
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
  const yTickNodes = [];
  yTicks.forEach(v => {
    const y = yAt(v);
    yTickNodes.push(svgEl('line', { x1: padL, y1: y.toFixed(1), x2: w - padR, y2: y.toFixed(1), stroke: '#2a2a2a' }));
    yTickNodes.push(svgEl('text', { x: padL - 6, y: (y + 4).toFixed(1), fill: '#888', 'font-size': 12, 'text-anchor': 'end' }, [String(v)]));
  });

  // X-axis labels — evenly spaced along time
  const tickCount = RANGE === '24h' ? 6 : (RANGE === '7d' ? 7 : 6);
  const nTicks = Math.min(tickCount, pts.length);
  const spanMs = samples[samples.length - 1].ts - samples[0].ts;
  const includeTime = RANGE !== '24h' && RANGE !== '7d' && spanMs < 3 * 86400000;
  const xTickNodes = [];
  for (let i = 0; i < nTicks; i++) {
    const idx = nTicks === 1 ? 0 : Math.round(i * (pts.length - 1) / (nTicks - 1));
    const p = pts[idx];
    const x = xAt(idx);
    const label = formatXLabel(p.ts, RANGE, includeTime);
    const anchor = i === 0 ? 'start' : (i === nTicks - 1 ? 'end' : 'middle');
    xTickNodes.push(svgEl('line', { x1: x.toFixed(1), y1: padT + plotH, x2: x.toFixed(1), y2: padT + plotH + 5, stroke: '#555' }));
    xTickNodes.push(svgEl('text', { x: x.toFixed(1), y: h - 12, fill: '#aaa', 'font-size': 12, 'text-anchor': anchor }, [label]));
  }

  const svgRoot = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: h, class: 'chart-svg' }, [
    ...yTickNodes,
    svgEl('line', { x1: padL, y1: padT, x2: padL, y2: padT + plotH, stroke: '#444' }),
    svgEl('line', { x1: padL, y1: padT + plotH, x2: w - padR, y2: padT + plotH, stroke: '#444' }),
    svgEl('path', { d: path, fill: 'none', stroke: '#ffd700', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    svgEl('circle', { cx: lx.toFixed(1), cy: ly.toFixed(1), r: 3.5, fill: '#ffd700' }),
    ...xTickNodes
  ]);
  replaceContent(el, svgRoot);
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

  // Never show a placeholder bar for a day with no recorded history.
  days = days.filter(d => d.max != null);

  if (titleEl) {
    titleEl.textContent = `Day breakdown · max tabs · ${rangeLabel(RANGE)}`;
  }

  const dayList = document.getElementById('dayList');
  if (!days.length) {
    emptyState(dayList, 'No day data yet.');
    return;
  }

  const maxBar = Math.max(1, ...days.map(d => d.max));
  const frag = document.createDocumentFragment();
  frag.appendChild(h('div', { class: 'day-head' }, [h('span', null, ['Day']), h('span', null, ['Max tabs'])]));
  days.forEach(row => {
    const pct = (row.max / maxBar) * 100;
    frag.appendChild(h('div', { class: 'day-row' }, [
      h('div', { class: 'day-label' }, [row.label]),
      h('div', { class: 'day-bar-bg' }, [h('div', { class: 'day-bar', style: `width:${pct}%` }, [])]),
      h('div', { class: 'day-val' }, [String(row.max)])
    ]));
  });
  dayList.textContent = '';
  dayList.appendChild(frag);
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
    emptyState(list, 'No actions recorded yet. Close Dupes, Close Old Tabs, Merge Windows and idle cleanup are logged here.');
    return;
  }

  const frag = document.createDocumentFragment();
  frag.appendChild(h('div', { class: 'act-head' }, [
    h('span', null, ['When']), h('span', null, ['Action']), h('span', null, ['Result'])
  ]));
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
    frag.appendChild(h('div', { class: 'act-row' }, [
      h('div', { class: 'act-when' }, [actionTime(a.ts)]),
      h('div', { class: 'act-kind' }, [h('span', { class: `act-tag ${k.auto ? 'auto' : 'manual'}` }, [k.label])]),
      h('div', { class: 'act-result' }, [result])
    ]));
  });
  list.textContent = '';
  list.appendChild(frag);
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
    api.runtime.sendMessage({ type: 'GET_HISTORY' }),
    api.tabs.query({}),
    api.windows.getAll({ windowTypes: ['normal'] })
  ]);
  ALL = (data && data.samples) || [];
  ALL_ACTIONS = (data && data.actions) || [];
  ATH = (data && data.ath) || 0;
  ATH_DATE = (data && data.athDate) || '';
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
    await api.runtime.sendMessage({ type: 'CLEAR_SAMPLES' });
    ALL = [];
    render();
  });
  document.getElementById('btnClearActions').addEventListener('click', async () => {
    if (!confirm('Clear the action log?')) return;
    await api.runtime.sendMessage({ type: 'CLEAR_ACTIONS' });
    ALL_ACTIONS = [];
    renderActions();
  });
});
