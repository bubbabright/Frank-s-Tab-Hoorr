// Tab Hoor — popup.js (codename: frank)

document.addEventListener('DOMContentLoaded', () => {
  // Ask background for everything in one shot
  browser.runtime.sendMessage({ type: 'GET_STATE' }).then(renderAll);
});

function renderAll(data) {
  if (!data) return;

  const { tabCount, windowCount, rank, state, achievements } = data;

  renderScore(tabCount, windowCount);
  renderRank(rank);
  renderStats(state);
  renderAchievements(achievements, state.achievements);
}

// ── Score ─────────────────────────────────────────────────────────────────────

function renderScore(tabCount, windowCount) {
  const el = document.getElementById('tabCount');
  el.textContent = tabCount;

  // Match badge color logic
  el.className = 'tab-count';
  if (tabCount <= 15)       el.classList.add('green');
  else if (tabCount <= 50)  el.classList.add('orange');
  else if (tabCount <= 100) el.classList.add('red');
  else                      el.classList.add('purple');

  const winEl = document.getElementById('windowCount');
  winEl.textContent = windowCount === 1
    ? 'across 1 window'
    : `across ${windowCount} windows`;
}

// ── Rank ──────────────────────────────────────────────────────────────────────

function renderRank(rank) {
  document.getElementById('rankTitle').textContent = rank.title;
  document.getElementById('rankQuote').textContent = `"${rank.quote}"`;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function renderStats(state) {
  document.getElementById('allTimeHigh').textContent =
    state.allTimeHigh > 0 ? state.allTimeHigh : '—';

  document.getElementById('allTimeHighDate').textContent =
    state.allTimeHighDate ? formatDate(state.allTimeHighDate) : '—';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

// ── Achievements ──────────────────────────────────────────────────────────────

function renderAchievements(definitions, unlocked) {
  const grid = document.getElementById('achievementsGrid');
  grid.innerHTML = '';

  for (const ach of definitions) {
    const isUnlocked = !!unlocked[ach.id];
    const card = document.createElement('div');
    card.className = `achievement ${isUnlocked ? 'unlocked' : 'locked'}`;

    const unlockedDate = isUnlocked
      ? `<br><span style="color:#555;font-size:8px">${formatDate(unlocked[ach.id])}</span>`
      : '';

    card.innerHTML = `
      <div class="achievement-icon">${ach.icon}</div>
      <div class="achievement-name">${ach.name}</div>
      <div class="achievement-tooltip">
        <strong>${ach.icon} ${ach.name}</strong>
        ${ach.desc}${unlockedDate}
      </div>
    `;

    grid.appendChild(card);
  }
}
