// Tab Hoor — options
'use strict';

const api = globalThis.browser || globalThis.chrome;
const IMPORT_KEYS = ['settings', 'samples', 'ath', 'athDate', 'installedDate', '_belowAth'];

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

function updateRulesInfo() {
  const text = document.getElementById('groupingRules').value;
  const lines = text.split('\n').filter(l => l.trim()).length;
  const rules = thParseGroupingRules(text).length;
  const bad = lines - rules;
  document.getElementById('rulesInfo').textContent =
    `${rules} ${rules === 1 ? 'rule' : 'rules'}` +
    (bad ? ` · ${bad} ${bad === 1 ? 'line' : 'lines'} ignored (need "pattern => Group Name")` : '');
}

async function load() {
  const { settings } = await api.storage.local.get('settings');
  const s = Object.assign({}, TH_DEFAULT_SETTINGS, settings || {});
  fields().forEach(el => writeField(el, s[el.dataset.setting]));
  applyDependents();
  updateRulesInfo();
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
  if (!isPlainObject(data)) throw new Error('not a Tab Hoor export');
  const out = {};
  for (const k of IMPORT_KEYS) if (k in data) out[k] = data[k];
  if ('samples' in out && !Array.isArray(out.samples)) throw new Error('samples must be a list');
  if ('ath' in out && typeof out.ath !== 'number') throw new Error('ath must be a number');
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
    updateRulesInfo();
    saveFromUI();
  }));

  // Save while typing so a rule isn't lost if the tab is closed before blur.
  let rulesTimer;
  document.getElementById('groupingRules').addEventListener('input', () => {
    updateRulesInfo();
    clearTimeout(rulesTimer);
    rulesTimer = setTimeout(saveFromUI, 500);
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
    toast('Exported');
  });

  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = sanitizeImport(JSON.parse(await file.text()));
      if (!confirm('Replace current data with this file?')) return;
      await api.storage.local.set(data);
      await load();
      try { await api.runtime.sendMessage({ type: 'REFRESH' }); } catch (_) {}
      toast('Imported');
    } catch (err) {
      toast('Import failed: ' + err.message, 4000);
    }
  });

  document.getElementById('btnClearHistory').addEventListener('click', async () => {
    if (!confirm('Clear all history samples? All-time high stays.')) return;
    await api.storage.local.set({ samples: [] });
    await load();
    toast('History cleared');
  });
});
