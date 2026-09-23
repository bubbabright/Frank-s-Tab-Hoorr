// Tab Hoor — dev-only seed script. NOT shipped in the build (scripts/ isn't
// copied by build.sh). Populates storage.local's legacy samples/actions/ath
// arrays with 90 days of synthetic data, so you can flip the "Storage engine"
// setting from legacy -> sqlite in options and confirm switchHistoryBackend()
// actually migrates it (background.js's storage.onChanged listener calls
// thDbImportFromLocal on that transition).
//
// How to run: open any Tab Hoor extension page (options page is easiest —
// popup -> gear icon), open its devtools console, paste this whole script,
// press enter. Then go to Settings -> History sampling -> Storage engine and
// switch it to SQLite (or toggle legacy -> sqlite -> legacy if it's already
// sqlite) to trigger the migration, then check the history page.
(async () => {
  const api = globalThis.browser || globalThis.chrome;
  const DAYS = 90;
  const STEP_MIN = 15; // one sample every 15 minutes
  const now = Date.now();
  const stepMs = STEP_MIN * 60000;
  const totalSteps = Math.floor((DAYS * 86400000) / stepMs);

  const samples = [];
  let t = 8; // tab count random walk
  for (let i = totalSteps; i >= 0; i--) {
    const ts = now - i * stepMs;
    t = Math.max(2, Math.min(60, t + Math.round((Math.random() - 0.5) * 6)));
    const w = Math.max(1, Math.min(5, Math.round(t / 15) + (Math.random() < 0.3 ? 1 : 0)));
    samples.push({ ts, t, w });
  }

  const kinds = ['dedupe', 'old', 'merge', 'idle'];
  const actions = [];
  for (let i = 0; i < 120; i++) {
    const ts = now - Math.floor(Math.random() * DAYS * 86400000);
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const entry = { ts, kind };
    if (kind === 'merge') {
      entry.tabs = 1 + Math.floor(Math.random() * 8);
      entry.windows = 1 + Math.floor(Math.random() * 3);
    } else {
      entry.closed = Math.floor(Math.random() * 6);
      entry.discarded = Math.floor(Math.random() * 3);
    }
    actions.push(entry);
  }
  actions.sort((a, b) => a.ts - b.ts);

  const ath = samples.reduce((m, s) => Math.max(m, s.t), 0);
  const athSample = samples.find(s => s.t === ath);
  const athDate = new Date(athSample.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });

  await api.storage.local.set({ samples, actions, ath, athDate });
  console.log(`Tab Hoor dev seed: ${samples.length} samples, ${actions.length} actions, ath=${ath} (${athDate}) written to storage.local.`);
})();
