// Tab Hoor — popup
'use strict';

const api = globalThis.browser || globalThis.chrome;

function toneClass(tone) {
  if (tone === 'green') return 'green';
  if (tone === 'amber') return 'orange';
  if (tone === 'red') return 'red';
  return 'purple';
}

function sparklineSVG(data, color) {
  const w = 132, h = 28, pad = 2;
  const nonZero = data.filter(d => d.t > 0);
  if (nonZero.length < 2) {
    return `<svg width="${w}" height="${h}"><text x="4" y="18" font-size="10" fill="#555">no data yet</text></svg>`;
  }
  const vals = data.map(d => d.t);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (d.t - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const area = `${path} L${last[0].toFixed(1)} ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`;
  return `<svg width="${w}" height="${h}">
    <path d="${area}" fill="${color}" opacity="0.25"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.2" fill="${color}"/>
  </svg>`;
}

function render(data) {
  if (!data) return;
  const {
    tabCount, windowCount, rank, rankIdx, ath, athDate,
    achievements, trend, definitions, ranks, settings
  } = data;

  const el = document.getElementById('tabCount');
  el.textContent = tabCount;
  el.className = 'tab-count ' + toneClass(rank.tone);

  document.getElementById('windowCount').textContent =
    windowCount === 1 ? 'across 1 window' : `across ${windowCount} windows`;

  document.getElementById('rankTitle').textContent = rank.title;
  document.getElementById('rankQuote').textContent = `"${rank.quote}"`;

  const next = ranks[rankIdx + 1];
  const prog = document.getElementById('rankProg');
  if (next) {
    prog.hidden = false;
    const pct = Math.min(100, ((tabCount - rank.min) / (next.min - rank.min)) * 100);
    const fill = document.getElementById('progFill');
    fill.style.width = pct.toFixed(1) + '%';
    fill.style.background = TH_BADGE_COLORS[rank.tone] || '#ffd700';
    document.getElementById('progMeta').innerHTML =
      `<span>${rank.min}</span><span>${Math.max(0, next.min - tabCount)} to <b>${next.title}</b></span><span>${next.min}</span>`;
  } else {
    prog.hidden = true;
  }

  document.getElementById('allTimeHigh').textContent = ath > 0 ? ath : '—';
  document.getElementById('allTimeHighDate').textContent = athDate || '—';

  const color = TH_BADGE_COLORS[rank.tone] || '#ffd700';
  document.getElementById('sparkline').innerHTML = sparklineSVG(trend || [], color);

  const defs = definitions || TH_ACHIEVEMENTS;
  const unlocked = defs.filter(a => achievements[a.id] && achievements[a.id].unlocked).length;
  document.getElementById('achCount').textContent = `${unlocked} / ${defs.length}`;

  const grid = document.getElementById('achievementsGrid');
  grid.innerHTML = '';
  const showHints = settings ? settings.showHints !== false : true;
  for (const ach of defs) {
    const on = achievements[ach.id] && achievements[ach.id].unlocked;
    const card = document.createElement('div');
    card.className = 'achievement ' + (on ? 'unlocked' : 'locked');
    const date = on ? achievements[ach.id].date : '';
    const tip = on
      ? `<strong>${ach.icon} ${ach.name}</strong>${ach.desc}<span class="tip-date">${date}</span>`
      : `<strong>${ach.name}</strong>${showHints ? ach.hint : ach.desc}`;
    card.innerHTML = `
      <div class="achievement-icon">${on ? ach.icon : '?'}</div>
      <div class="achievement-tooltip">${tip}</div>`;
    grid.appendChild(card);
  }
}

function refresh() {
  return api.runtime.sendMessage({ type: 'GET_STATE' }).then(data => {
    document.getElementById('loadError').hidden = !!data;
    render(data);
  }).catch(err => {
    console.error(err);
    document.getElementById('loadError').hidden = false;
  });
}

// Live count on the destructive button so it never closes tabs blind.
let oldSeq = 0;
function updateOldCount() {
  const btn = document.getElementById('closeOldTabs');
  const maxAge = parseInt(document.getElementById('ageThreshold').value, 10);
  const seq = ++oldSeq;
  return api.runtime.sendMessage({ type: 'CLOSE_OLD_TABS', maxAge, dryRun: true }).then(r => {
    if (seq !== oldSeq) return;
    const n = (r && r.count) || 0;
    btn.textContent = n ? `Close ${n} Old` : 'No Old Tabs';
    btn.disabled = n === 0;
  }).catch(() => {
    if (seq !== oldSeq) return;
    btn.textContent = 'Close Old Tabs';
    btn.disabled = false;
  });
}

// Busy label -> send -> result label -> refresh counts -> restore after 2s.
async function runAction(btn, message, busy, doneLabel, reset) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = busy;
  let label = original;
  try {
    label = doneLabel(await api.runtime.sendMessage(message));
  } catch (err) {
    console.error(err);
  }
  btn.textContent = label;
  await refresh();
  setTimeout(reset || (() => { btn.textContent = original; btn.disabled = false; }), 2000);
}

document.addEventListener('DOMContentLoaded', () => {
  refresh();
  updateOldCount();

  document.getElementById('btnHistory').addEventListener('click', () => {
    api.tabs.create({ url: api.runtime.getURL('history/history.html') });
  });
  document.getElementById('btnOptions').addEventListener('click', () => {
    if (api.runtime.openOptionsPage) api.runtime.openOptionsPage();
    else api.tabs.create({ url: api.runtime.getURL('options/options.html') });
  });

  document.getElementById('lnkDupes').addEventListener('click', e => {
    runAction(e.currentTarget, { type: 'DEDUPE_TABS' }, 'Closing…',
      r => (r && r.closed) ? `Closed ${r.closed}` : 'No Dupes');
  });

  document.getElementById('btnMerge').addEventListener('click', e => {
    runAction(e.currentTarget, { type: 'MERGE_WINDOWS' }, 'Merging…',
      r => (r && r.merged) ? `Merged ${r.merged}` : 'None Found');
  });

  document.getElementById('ageThreshold').addEventListener('change', updateOldCount);

  document.getElementById('closeOldTabs').addEventListener('click', e => {
    const maxAge = parseInt(document.getElementById('ageThreshold').value, 10);
    runAction(e.currentTarget, { type: 'CLOSE_OLD_TABS', maxAge }, 'Closing…',
      r => (r && r.closed) ? `Closed ${r.closed}` : 'None Found', updateOldCount);
  });
});
