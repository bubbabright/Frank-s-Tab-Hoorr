// Tab Hoor — popup
'use strict';

const api = globalThis.browser || globalThis.chrome;

function toneClass(tone) {
  if (tone === 'green') return 'green';
  if (tone === 'amber') return 'orange';
  if (tone === 'red') return 'red';
  return 'purple';
}

function last14Days(samples) {
  const now = Date.now();
  const dayMs = 86400000;
  const byDay = {};
  (samples || []).forEach(s => {
    const daysAgo = Math.floor((now - s.ts) / dayMs);
    if (daysAgo >= 0 && daysAgo < 14) {
      if (!byDay[daysAgo] || s.ts > byDay[daysAgo].ts) byDay[daysAgo] = s;
    }
  });
  const out = [];
  for (let i = 13; i >= 0; i--) {
    const s = byDay[i];
    out.push({ t: s ? s.t : 0 });
  }
  return out;
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
    achievements, samples, definitions, ranks, settings
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
  document.getElementById('sparkline').innerHTML = sparklineSVG(last14Days(samples), color);

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
      ? `<strong>${ach.icon} ${ach.name}</strong>${ach.desc}<br><span style="color:#555;font-size:8px">${date}</span>`
      : `<strong>${ach.name}</strong>${showHints ? ach.hint : ach.desc}`;
    card.innerHTML = `
      <div class="achievement-icon">${on ? ach.icon : '?'}</div>
      <div class="achievement-name">${on ? ach.name : '???'}</div>
      <div class="achievement-tooltip">${tip}</div>`;
    grid.appendChild(card);
  }
}

function browserLinks() {
  const isChrome = !/firefox/i.test(navigator.userAgent);
  return {
    dupes: isChrome
      ? 'https://chromewebstore.google.com/detail/duplicate-tab-helper/ojkcdipcgfaekbeaelaapakgnjflfglf'
      : 'https://addons.mozilla.org/firefox/addon/duplicate-tabs-closer/',
    merge: isChrome
      ? 'https://chromewebstore.google.com/detail/tab-manager-plus-for-chro/cnkdjjdmfiffagllbiiilooaoofcoeff'
      : 'https://addons.mozilla.org/firefox/addon/merge/'
  };
}

document.addEventListener('DOMContentLoaded', () => {
  api.runtime.sendMessage({ type: 'GET_STATE' }).then(render).catch(console.error);

  document.getElementById('btnHistory').addEventListener('click', () => {
    api.tabs.create({ url: api.runtime.getURL('history/history.html') });
  });
  document.getElementById('btnOptions').addEventListener('click', () => {
    if (api.runtime.openOptionsPage) api.runtime.openOptionsPage();
    else api.tabs.create({ url: api.runtime.getURL('options/options.html') });
  });

  const links = browserLinks();
  document.getElementById('lnkDupes').addEventListener('click', e => {
    e.preventDefault();
    api.tabs.create({ url: links.dupes });
  });
  document.getElementById('lnkMerge').addEventListener('click', e => {
    e.preventDefault();
    api.tabs.create({ url: links.merge });
  });
});
