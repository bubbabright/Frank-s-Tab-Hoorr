// Tab Hoor — options
'use strict';

const api = globalThis.browser;
const IMPORT_KEYS = ['settings', 'samples', 'actions', 'ath', 'athDate', 'installedDate', '_belowAth'];

const fields = () => Array.from(document.querySelectorAll('[data-setting]'));
const isPlainObject = v => !!v && typeof v === 'object' && !Array.isArray(v);

let toastTimer;
function toast(msg, ms = 1500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function renderDiagnostics(rows) {
  const container = document.getElementById('diagnostics');
  container.hidden = false;
  container.textContent = '';
  if (!rows.length) {
    container.textContent = 'No stored errors.';
    return;
  }
  for (const row of rows) {
    const item = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `${new Date(row.ts).toLocaleString()} · ${row.context}`;
    const message = document.createElement('pre');
    message.textContent = row.message + (row.stack ? `\n\n${row.stack}` : '');
    item.append(summary, message);
    container.appendChild(item);
  }
}

async function loadDiagnostics() {
  const result = await api.runtime.sendMessage({ type: 'GET_DIAGNOSTICS' });
  if (result && result.error) throw new Error(result.error);
  renderDiagnostics((result && result.rows) || []);
}

function readField(el) {
  const def = TH_DEFAULT_SETTINGS[el.dataset.setting];
  if (el.type === 'checkbox') return el.checked;
  if (typeof def === 'number') return parseInt(el.value, 10) || def;
  return el.value;
}

function writeField(el, value) {
  if (el.type === 'checkbox') el.checked = !!value;
  else el.value = String(value);
}

// Controls that only matter while their master toggle is on.
function applyDependents() {
  for (const el of document.querySelectorAll('[data-requires]')) {
    const master = document.querySelector(`[data-setting="${el.dataset.requires}"]`);
    const off = !(master && master.checked);
    el.disabled = off;
    const label = el.closest('label');
    if (label) label.classList.toggle('dimmed', off);
  }
}

async function load() {
  const { settings } = await api.storage.local.get('settings');
  const s = Object.assign({}, TH_DEFAULT_SETTINGS, settings || {});
  fields().forEach(el => writeField(el, s[el.dataset.setting]));
  applyDependents();
  let meta = `local only · v${api.runtime.getManifest().version}`;
  if (api.storage.local.getBytesInUse) {
    try { meta += ` · ~${((await api.storage.local.getBytesInUse(null)) / 1024).toFixed(1)} KB used`; } catch (_) {}
  }
  document.getElementById('storageMeta').textContent = meta;
}

async function saveFromUI() {
  const { settings } = await api.storage.local.get('settings');
  const next = Object.assign({}, settings || {});
  fields().forEach(el => { next[el.dataset.setting] = readField(el); });
  await api.storage.local.set({ settings: next });
  toast('Saved');
  try { await api.runtime.sendMessage({ type: 'REFRESH' }); } catch (_) {}
}

function sanitizeImport(data) {
  const source = thValidateBackup(data);
  if (!isPlainObject(source)) throw new Error('not a Tab Hoor export');
  const out = {};
  for (const k of IMPORT_KEYS) if (k in source) out[k] = source[k];
  if ('settings' in out) {
    if (!isPlainObject(out.settings)) throw new Error('settings must be an object');
    const src = out.settings;
    out.settings = {};
    for (const [k, def] of Object.entries(TH_DEFAULT_SETTINGS)) {
      out.settings[k] = typeof src[k] === typeof def ? src[k] : def;
    }
    if (out.settings.badgeMode !== 'off') out.settings.badgeMode = 'count'; // legacy 'rank' -> count
  }
  if (!Object.keys(out).length) throw new Error('nothing to import');
  return out;
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  if (!api.tabGroups) {
    const card = document.getElementById('groupingCard');
    if (card) card.hidden = true;
  }

  fields().forEach(el => el.addEventListener('change', () => {
    applyDependents();
    saveFromUI();
  }));

  document.getElementById('btnExport').addEventListener('click', async () => {
    try {
      const exportData = await api.runtime.sendMessage({ type: 'GET_BACKUP' });
      if (!exportData) throw new Error('backup could not be created');
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tab-hoor-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Exported');
    } catch (err) {
      toast('Export failed: ' + err.message, 4000);
    }
  });

  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('backup is too large');
      const data = sanitizeImport(JSON.parse(await file.text()));
      if (!confirm('Replace current data with this file?')) return;
      const result = await api.runtime.sendMessage({ type: 'RESTORE_BACKUP', backup: data });
      if (!result || !result.ok) throw new Error(result && result.error || 'restore failed');
      await load();
      try { await api.runtime.sendMessage({ type: 'REFRESH' }); } catch (_) {}
      toast('Imported');
    } catch (err) {
      toast('Import failed: ' + err.message, 4000);
    }
  });

  document.getElementById('btnClearHistory').addEventListener('click', async () => {
    if (!confirm('Clear all history samples? All-time high stays.')) return;
    await api.runtime.sendMessage({ type: 'CLEAR_SAMPLES' });
    await load();
    toast('History cleared');
  });

  document.getElementById('btnShowDiagnostics').addEventListener('click', async () => {
    try {
      await loadDiagnostics();
    } catch (err) {
      toast('Could not load errors: ' + err.message, 4000);
    }
  });

  document.getElementById('btnClearDiagnostics').addEventListener('click', async () => {
    if (!confirm('Clear all stored diagnostics?')) return;
    const result = await api.runtime.sendMessage({ type: 'CLEAR_DIAGNOSTICS' });
    if (!result || !result.ok) {
      toast('Could not clear errors', 4000);
      return;
    }
    renderDiagnostics([]);
    toast('Errors cleared');
  });
});
