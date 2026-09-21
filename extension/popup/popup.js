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
  const { tabCount, windowCount, tone, ath, athDate, trend } = data;

  const el = document.getElementById('tabCount');
  el.textContent = tabCount;
  el.className = 'tab-count ' + toneClass(tone);

  document.getElementById('windowCount').textContent =
    windowCount === 1 ? 'across 1 window' : `across ${windowCount} windows`;

  document.getElementById('allTimeHigh').textContent = ath > 0 ? ath : '—';
  document.getElementById('allTimeHighDate').textContent = athDate || '—';

  const color = TH_BADGE_COLORS[tone] || '#ffd700';
  document.getElementById('sparkline').innerHTML = sparklineSVG(trend || [], color);
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

// Each action button shows how many tabs/windows it would touch, so nothing runs blind.
const COUNT_BUTTONS = [
  {
    id: 'closeOldTabs',
    fallback: 'Close Old Tabs',
    query: () => ({ type: 'CLOSE_OLD_TABS', maxAge: parseInt(document.getElementById('ageThreshold').value, 10), dryRun: true }),
    count: r => (r.closed || 0) + (r.discarded || 0),
    label: n => (n ? `Close ${n} Old` : 'No Old Tabs')
  },
  {
    id: 'lnkDupes',
    fallback: 'Close Dupes',
    query: () => ({ type: 'DEDUPE_TABS', dryRun: true }),
    count: r => r.count,
    label: n => (n ? `Close ${n} ${n === 1 ? 'Dupe' : 'Dupes'}` : 'No Dupes')
  },
  {
    id: 'btnMerge',
    fallback: 'Merge Windows',
    query: () => ({ type: 'MERGE_WINDOWS', dryRun: true }),
    count: r => r.windows,
    label: n => (n ? `Merge ${n} ${n === 1 ? 'Window' : 'Windows'}` : 'One Window'),
    title: r => `${r.tabs} tabs from ${r.windows} other windows`
  }
];

let countSeq = 0;
function updateCounts() {
  const seq = ++countSeq;
  return Promise.all(COUNT_BUTTONS.map(async b => {
    const btn = document.getElementById(b.id);
    let r = null;
    try { r = await api.runtime.sendMessage(b.query()); } catch (_) {}
    if (seq !== countSeq) return;
    if (!r) {
      btn.textContent = b.fallback;
      btn.disabled = false;
      return;
    }
    const n = b.count(r) || 0;
    btn.textContent = b.label(n);
    btn.disabled = n === 0;
    btn.title = b.title && n ? b.title(r) : '';
  }));
}

// Busy label -> send -> result label -> refresh stats -> restore live counts after 2s.
async function runAction(btn, message, busy, doneLabel) {
  btn.disabled = true;
  btn.textContent = busy;
  try {
    btn.textContent = doneLabel(await api.runtime.sendMessage(message));
  } catch (err) {
    console.error(err);
    btn.textContent = 'Failed';
  }
  await refresh();
  setTimeout(updateCounts, 2000);
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('version').textContent = 'v' + api.runtime.getManifest().version;
  
  const { settings } = await api.storage.local.get('settings');
  if (settings && settings.popupAgeThreshold) {
    document.getElementById('ageThreshold').value = String(settings.popupAgeThreshold);
  }

  refresh();
  updateCounts();

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

  document.getElementById('ageThreshold').addEventListener('change', async (e) => {
    const ms = parseInt(e.target.value, 10);
    const { settings } = await api.storage.local.get('settings');
    const next = Object.assign({}, settings || {});
    next.popupAgeThreshold = ms;
    await api.storage.local.set({ settings: next });
    updateCounts();
  });

  document.getElementById('closeOldTabs').addEventListener('click', e => {
    const maxAge = parseInt(document.getElementById('ageThreshold').value, 10);
    runAction(e.currentTarget, { type: 'CLOSE_OLD_TABS', maxAge }, 'Closing…',
      r => {
        if (!r) return 'None Found';
        const closed = r.closed || 0, discarded = r.discarded || 0;
        if (!closed && !discarded) return 'None Found';
        return discarded ? `Closed ${closed}, unloaded ${discarded}` : `Closed ${closed}`;
      });
  });
});
