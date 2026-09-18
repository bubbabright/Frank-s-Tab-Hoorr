// Tab Hoor — options
'use strict';

const api = globalThis.browser || globalThis.chrome;

function setStatus(msg) {
  document.getElementById('status').textContent = msg || '';
}

async function load() {
  const data = await api.storage.local.get(null);
  const s = Object.assign({}, TH_DEFAULT_SETTINGS, data.settings || {});
  document.getElementById('badgeMode').value = s.badgeMode;
  document.getElementById('sampling').value = s.sampling;
  document.getElementById('retention').value = s.retention;
  document.getElementById('showHints').checked = s.showHints !== false;
  document.getElementById('idleEnabled').checked = !!s.idleEnabled;
  document.getElementById('idleMinutes').value = String(s.idleMinutes || 30);
  document.getElementById('groupingEnabled').checked = !!s.groupingEnabled;
  document.getElementById('groupingRules').value = s.groupingRules || '';
  const bytes = JSON.stringify(data).length;
  document.getElementById('storageMeta').textContent =
    `local only · v0.4.0 · ~${(bytes / 1024).toFixed(1)} KB used`;
}

async function saveFromUI() {
  const settings = {
    badgeMode: document.getElementById('badgeMode').value,
    sampling: document.getElementById('sampling').value,
    retention: document.getElementById('retention').value,
    showHints: document.getElementById('showHints').checked,
    idleEnabled: document.getElementById('idleEnabled').checked,
    idleMinutes: parseInt(document.getElementById('idleMinutes').value, 10) || 30,
    groupingEnabled: document.getElementById('groupingEnabled').checked,
    groupingRules: document.getElementById('groupingRules').value
  };
  await api.storage.local.set({ settings });
  setStatus('Saved.');
  // nudge badge refresh
  try { await api.runtime.sendMessage({ type: 'REFRESH' }); } catch (_) {}
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  if (!api.tabGroups) {
    const card = document.getElementById('groupingCard');
    if (card) card.hidden = true;
  }
  [
    'badgeMode', 'sampling', 'retention', 'showHints',
    'idleEnabled', 'idleMinutes', 'groupingEnabled', 'groupingRules'
  ].forEach(id => {
    document.getElementById(id).addEventListener('change', saveFromUI);
  });

  document.getElementById('btnExport').addEventListener('click', async () => {
    const data = await api.storage.local.get(null);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tab-hoor-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Exported.');
  });

  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.storage.local.set(data);
      await load();
      try { await api.runtime.sendMessage({ type: 'REFRESH' }); } catch (_) {}
      setStatus('Imported.');
    } catch (err) {
      setStatus('Import failed: ' + err.message);
    }
    e.target.value = '';
  });

  document.getElementById('btnClearHistory').addEventListener('click', async () => {
    if (!confirm('Clear all history samples? Ranks and achievements stay.')) return;
    await api.storage.local.set({ samples: [] });
    setStatus('History cleared.');
    await load();
  });
});
