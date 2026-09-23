// Tab Hoor — sqlite-backed history store (sql.js WASM, blob persisted to IndexedDB)
'use strict';

const TH_DB_NAME = 'th_sqlite';
const TH_DB_STORE = 'kv';
const TH_DB_KEY = 'blob';

function thIdbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(TH_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(TH_DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function thIdbGetBlob() {
  const idb = await thIdbOpen();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(TH_DB_STORE, 'readonly');
    const req = tx.objectStore(TH_DB_STORE).get(TH_DB_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function thIdbSetBlob(bytes) {
  const idb = await thIdbOpen();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(TH_DB_STORE, 'readwrite');
    tx.objectStore(TH_DB_STORE).put(bytes, TH_DB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const TH_SCHEMA = `
  CREATE TABLE IF NOT EXISTS samples (ts INTEGER PRIMARY KEY, t INTEGER NOT NULL, w INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS actions (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, kind TEXT NOT NULL, closed INTEGER DEFAULT 0, discarded INTEGER DEFAULT 0, tabs INTEGER, windows INTEGER, import_key TEXT);
  CREATE TABLE IF NOT EXISTS diagnostics (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, level TEXT NOT NULL, context TEXT NOT NULL, message TEXT NOT NULL, stack TEXT);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`;

let thDbPromise = null;
let thSaveChain = Promise.resolve();

function thRuntime() {
  return globalThis.browser;
}

async function thGetDb() {
  if (!thDbPromise) {
    thDbPromise = thOpenDb().catch(err => {
      thDbPromise = null;
      throw err;
    });
  }
  return thDbPromise;
}

async function thOpenDb() {
  const SQL = await initSqlJs({ locateFile: file => thRuntime().runtime.getURL('lib/' + file) });
  const blob = await thIdbGetBlob();
  const db = blob ? new SQL.Database(blob) : new SQL.Database();
  db.run(TH_SCHEMA);
  const columns = thRowsToObjects(db, 'PRAGMA table_info(actions)');
  if (!columns.some(c => c.name === 'import_key')) db.run('ALTER TABLE actions ADD COLUMN import_key TEXT');
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS actions_import_key ON actions(import_key) WHERE import_key IS NOT NULL');
  if (!blob) await thMigrateLegacy(db);
  return db;
}

// Merges storage.local-shaped rows into an open db. Shared by the one-time
// migration below and the explicit legacy->sqlite backend switch.
function thImportRows(db, samples, actions, ath, athDate, inTransaction = false) {
  if (samples.length) {
    if (!inTransaction) db.run('BEGIN');
    const stmt = db.prepare('INSERT OR IGNORE INTO samples (ts, t, w) VALUES (?, ?, ?)');
    samples.forEach(s => stmt.run([s.ts, s.t, s.w || 0]));
    stmt.free();
    if (!inTransaction) db.run('COMMIT');
  }
  if (actions.length) {
    if (!inTransaction) db.run('BEGIN');
    const stmt = db.prepare('INSERT OR IGNORE INTO actions (ts, kind, closed, discarded, tabs, windows, import_key) VALUES (?, ?, ?, ?, ?, ?, ?)');
    actions.forEach(a => {
      const key = JSON.stringify([a.ts, a.kind, a.closed || 0, a.discarded || 0, a.tabs || 0, a.windows || 0]);
      stmt.run([a.ts, a.kind, a.closed || 0, a.discarded || 0, a.tabs || 0, a.windows || 0, key]);
    });
    stmt.free();
    if (!inTransaction) db.run('COMMIT');
  }
  if (ath) db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['ath', String(ath)]);
  if (athDate) db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['athDate', athDate]);
}

// One-time import of the pre-sqlite storage.local arrays (samples/actions/ath/athDate),
// so history recorded before this feature shipped isn't lost when the schema switches over.
async function thMigrateLegacy(db) {
  const rt = thRuntime();
  const data = await rt.storage.local.get(['samples', 'actions', 'ath', 'athDate']);
  const samples = data.samples || [];
  const actions = data.actions || [];
  thImportRows(db, samples, actions, data.ath || 0, data.athDate || '');
  if (samples.length || actions.length || data.ath || data.athDate) {
    await rt.storage.local.remove(['samples', 'actions', 'ath', 'athDate']);
  }
  await thPersist(db);
}

// Explicit legacy->sqlite backend switch: merges current storage.local arrays into
// the db WITHOUT deleting them, so switching back to legacy still has that data.
async function thDbImportFromLocal(samples, actions, ath, athDate) {
  const db = await thGetDb();
  thImportRows(db, samples || [], actions || [], ath || 0, athDate || '');
  await thPersist(db);
}

async function thDbReplaceHistory(samples, actions, ath, athDate) {
  const db = await thGetDb();
  db.run('BEGIN');
  try {
    db.run('DELETE FROM samples');
    db.run('DELETE FROM actions');
    thImportRows(db, samples || [], actions || [], ath || 0, athDate || '', true);
    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
  await thPersist(db);
}

// Debounced-by-chaining export+save so concurrent writes serialize instead of racing.
function thPersist(db) {
  thSaveChain = thSaveChain
    .catch(err => {
      console.error('Tab Hoor SQLite save queue', err);
    })
    .then(() => thIdbSetBlob(db.export()));
  return thSaveChain;
}

function thRowsToObjects(db, sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const out = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

async function thDbInsertSample(ts, t, w) {
  const db = await thGetDb();
  db.run('INSERT OR REPLACE INTO samples (ts, t, w) VALUES (?, ?, ?)', [ts, t, w]);
  await thPersist(db);
}

async function thDbPruneSamples(cutoffTs, maxRows) {
  const db = await thGetDb();
  if (cutoffTs != null) db.run('DELETE FROM samples WHERE ts < ?', [cutoffTs]);
  if (maxRows != null) {
    db.run('DELETE FROM samples WHERE ts NOT IN (SELECT ts FROM samples ORDER BY ts DESC LIMIT ?)', [maxRows]);
  }
  await thPersist(db);
}

async function thDbGetSamples(sinceTs) {
  const db = await thGetDb();
  return sinceTs != null
    ? thRowsToObjects(db, 'SELECT ts, t, w FROM samples WHERE ts >= ? ORDER BY ts ASC', [sinceTs])
    : thRowsToObjects(db, 'SELECT ts, t, w FROM samples ORDER BY ts ASC');
}

async function thDbInsertAction(entry) {
  const db = await thGetDb();
  db.run(
    'INSERT OR IGNORE INTO actions (ts, kind, closed, discarded, tabs, windows, import_key) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [entry.ts, entry.kind, entry.closed || 0, entry.discarded || 0, entry.tabs || 0, entry.windows || 0,
      entry.eventId || null]
  );
  await thPersist(db);
}

async function thDbPruneActions(cutoffTs, maxRows) {
  const db = await thGetDb();
  if (cutoffTs != null) db.run('DELETE FROM actions WHERE ts < ?', [cutoffTs]);
  if (maxRows != null) {
    db.run('DELETE FROM actions WHERE id NOT IN (SELECT id FROM actions ORDER BY ts DESC LIMIT ?)', [maxRows]);
  }
  await thPersist(db);
}

async function thDbGetActions(sinceTs) {
  const db = await thGetDb();
  return sinceTs != null
    ? thRowsToObjects(db, 'SELECT * FROM actions WHERE ts >= ? ORDER BY ts ASC', [sinceTs])
    : thRowsToObjects(db, 'SELECT * FROM actions ORDER BY ts ASC');
}

async function thDbInsertDiagnostic(entry) {
  const db = await thGetDb();
  db.run(
    'INSERT INTO diagnostics (ts, level, context, message, stack) VALUES (?, ?, ?, ?, ?)',
    [entry.ts, entry.level, entry.context, entry.message, entry.stack || null]
  );
  await thPersist(db);
  db.run('DELETE FROM diagnostics WHERE id NOT IN (SELECT id FROM diagnostics ORDER BY ts DESC, id DESC LIMIT 200)');
  await thPersist(db);
}

async function thDbGetDiagnostics(limit = 200) {
  const db = await thGetDb();
  return thRowsToObjects(db,
    'SELECT id, ts, level, context, message, stack FROM diagnostics ORDER BY ts DESC, id DESC LIMIT ?',
    [limit]
  );
}

async function thDbClearDiagnostics() {
  const db = await thGetDb();
  db.run('DELETE FROM diagnostics');
  await thPersist(db);
}

async function thDbClearSamples() {
  const db = await thGetDb();
  db.run('DELETE FROM samples');
  await thPersist(db);
}

async function thDbClearActions() {
  const db = await thGetDb();
  db.run('DELETE FROM actions');
  await thPersist(db);
}

async function thDbGetMeta(key) {
  const db = await thGetDb();
  const rows = thRowsToObjects(db, 'SELECT value FROM meta WHERE key = ?', [key]);
  return rows.length ? rows[0].value : null;
}

async function thDbSetMeta(key, value) {
  const db = await thGetDb();
  db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, String(value)]);
  await thPersist(db);
}

if (typeof globalThis !== 'undefined') {
  globalThis.thDbInsertSample = thDbInsertSample;
  globalThis.thDbPruneSamples = thDbPruneSamples;
  globalThis.thDbGetSamples = thDbGetSamples;
  globalThis.thDbInsertAction = thDbInsertAction;
  globalThis.thDbGetActions = thDbGetActions;
  globalThis.thDbInsertDiagnostic = thDbInsertDiagnostic;
  globalThis.thDbGetDiagnostics = thDbGetDiagnostics;
  globalThis.thDbClearDiagnostics = thDbClearDiagnostics;
  globalThis.thDbPruneActions = thDbPruneActions;
  globalThis.thDbClearSamples = thDbClearSamples;
  globalThis.thDbClearActions = thDbClearActions;
  globalThis.thDbGetMeta = thDbGetMeta;
  globalThis.thDbSetMeta = thDbSetMeta;
  globalThis.thDbImportFromLocal = thDbImportFromLocal;
  globalThis.thDbReplaceHistory = thDbReplaceHistory;
}
