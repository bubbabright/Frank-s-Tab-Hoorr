/* Tab Hoor — Options page JS */
'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
var SETTINGS = {
  theme: 'a', badgeMode: 'count', ceremony: 'toast',
  confetti: true, sound: false, sampling: '5m', retention: '90d'
};
var CUSTOM_RANKS = null;
var CUSTOM_ACHIEVEMENTS = null;
var STORAGE_BYTES = 0;

var ACTIVE_TAB = 'general';
var AI_STEP = 1;
var AI_VIBE = 'Frank Reynolds (dive-bar, unhinged, affectionate)';
var AI_INTENSITY = 80;
var AI_RANKS_COUNT = 9;
var AI_ACHS_COUNT = 8;
var AI_PASTED_YAML = '';
var AI_YAML_VALID = false;
var AI_PARSED = null;

var SAMPLE_YAML = `# tab-hoor config.yml — generated ${new Date().toISOString().slice(0,10)}
voice: "tab-goblin / lord-of-the-rings creep"
intensity: 70

ranks:
  - { min: 0,   max: 5,   title: "Tab Hobbit",     tone: green,  quote: "Just a few precious tabses." }
  - { min: 6,   max: 15,  title: "Tab Stoor",      tone: green,  quote: "Curious little fingers." }
  - { min: 16,  max: 30,  title: "Smegol",         tone: amber,  quote: "We finds them, we keeps them." }
  - { min: 31,  max: 50,  title: "Gollum",         tone: amber,  quote: "MY precious tabses!" }
  - { min: 51,  max: 75,  title: "Tab Goblin",     tone: red,    quote: "Precious tabses. We keeps them all, yes." }
  - { min: 76,  max: 100, title: "Cave Troll",     tone: red,    quote: "Boom. Boom. BOOM." }
  - { min: 101, max: 150, title: "Mountain Hoor",  tone: red,    quote: "A mountain made of tabs." }
  - { min: 151, max: 200, title: "Balrog of Tabs", tone: purple, quote: "YOU SHALL NOT CLOSE." }
  - { min: 201, max: inf, title: "One Ring",       tone: purple, quote: "One tab to rule them all." }

achievements:
  - { id: first_time,    icon: "🍀", name: "First Time",       trigger: "tabs >= 1" }
  - { id: fellowship,    icon: "💍", name: "Fellowship of 9",  trigger: "tabs >= 9" }
  - { id: dozen,         icon: "🧮", name: "Dirty Dozen",      trigger: "tabs >= 12" }
  - { id: score,         icon: "🎯", name: "Threescore",       trigger: "tabs >= 60" }
  - { id: century,       icon: "💯", name: "Tab Century",      trigger: "tabs >= 100" }
  - { id: multiwin,      icon: "🪟", name: "Many Doored",      trigger: "windows >= 3" }
  - { id: relapser,      icon: "🔄", name: "Tab Relapser",     trigger: "relapsed" }
  - { id: summit,        icon: "🏔", name: "Peak Hoarder",     trigger: "ath >= 200" }
`;

// ─── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  browser.storage.local.get(null).then(function (data) {
    if (data.settings) Object.assign(SETTINGS, data.settings);
    if (data.customRanks) CUSTOM_RANKS = data.customRanks;
    if (data.customAchievements) CUSTOM_ACHIEVEMENTS = data.customAchievements;
    // estimate storage size
    STORAGE_BYTES = JSON.stringify(data).length;
    renderPage();
  });
});

// ─── Top-level render ────────────────────────────────────────────────────────
function renderPage() {
  document.getElementById('root').innerHTML = buildPage();
  bindPage();
}

function buildPage() {
  return `
    <div class="set-hdr">
      <div class="set-hdr-mark">
        <span class="set-hdr-glyph">⌬</span>
        <span class="set-hdr-text">TAB&nbsp;HOOR</span>
        <span class="set-hdr-sub">/ settings</span>
      </div>
      <div class="set-hdr-meta">
        <span class="set-hdr-pill"><span class="set-hdr-dot"></span> v0.2 · local only</span>
        <button class="set-hdr-btn" id="btn-export">Export config</button>
        <button class="set-hdr-btn" id="btn-import">Import config</button>
      </div>
    </div>
    <div class="set-body">
      ${buildNav()}
      <div class="set-main">
        ${buildActiveTab()}
      </div>
    </div>
  `;
}

function buildNav() {
  var items = [
    ['general', '⚙', 'General'],
    ['ranks',   '◈', 'Ranks &amp; ladder'],
    ['ach',     '★', 'Achievements'],
    ['icons',   '◆', 'Toolbar icon'],
    ['ai',      '✦', 'AI customizer'],
  ];
  var kb = Math.round(STORAGE_BYTES / 1024 * 10) / 10;
  var pct = Math.min(100, Math.round(STORAGE_BYTES / (5 * 1024 * 1024) * 100));
  return `
    <nav class="set-nav">
      <div class="set-nav-k">CONFIG</div>
      ${items.map(function (item) {
        var k = item[0], g = item[1], label = item[2];
        return `<button class="set-nav-i ${ACTIVE_TAB === k ? 'on' : ''}" data-tab="${k}">
          <span class="set-nav-g">${g}</span>${label}
        </button>`;
      }).join('')}
      <div class="set-nav-spacer"></div>
      <div class="set-nav-foot">
        <div>storage</div>
        <div class="set-nav-bar"><div style="width:${pct}%"></div></div>
        <div class="set-nav-meta">${kb} kb / 5 mb · all local</div>
      </div>
    </nav>
  `;
}

function buildActiveTab() {
  if (ACTIVE_TAB === 'general')  return buildGeneral();
  if (ACTIVE_TAB === 'ranks')    return buildRanks();
  if (ACTIVE_TAB === 'ach')      return buildAchievements();
  if (ACTIVE_TAB === 'icons')    return buildIcons();
  if (ACTIVE_TAB === 'ai')       return buildAI();
  return '';
}

// ─── Tab: General ────────────────────────────────────────────────────────────
function buildGeneral() {
  return `
    ${secTitle('General', 'Day-to-day behavior')}
    <div class="set-card">
      ${field('Rank-up ceremony', 'Played when you cross a rank threshold.',
        seg('ceremony', SETTINGS.ceremony, [
          {v:'silent',label:'Silent'},{v:'glow',label:'Glow'},
          {v:'toast',label:'Toast'},{v:'big',label:'Takeover'}
        ])
      )}
      <div class="set-row">
        ${toggle('confetti', 'Confetti on rank-up', SETTINGS.confetti)}
      </div>
      <div class="set-row">
        ${toggle('sound', 'Sound effects', SETTINGS.sound, 'Mutable. Off by default.')}
      </div>
      <div class="set-row">
        ${buildCeremonyPreview()}
      </div>
    </div>

    <div class="set-card">
      ${field('Toolbar badge', 'What the little number on the icon shows.',
        seg('badgeMode', SETTINGS.badgeMode, [
          {v:'count',label:'Tab count'},{v:'rank',label:'Rank #'},{v:'none',label:'Hidden'}
        ])
      )}
      ${field('Popup theme', 'Choose one of the three design directions.',
        seg('theme', SETTINGS.theme, [
          {v:'a',label:'Polished'},{v:'b',label:'Lived-in'},{v:'c',label:'Arcade'}
        ])
      )}
    </div>

    <div class="set-card">
      ${field('History sampling', 'How often we record a count snapshot. Counts only — no URLs.',
        seg('sampling', SETTINGS.sampling, [
          {v:'1m',label:'Every minute'},{v:'5m',label:'Every 5 min'},
          {v:'15m',label:'Every 15 min'},{v:'evt',label:'On change'}
        ])
      )}
      ${field('Retention', 'Older samples are downsampled.',
        seg('retention', SETTINGS.retention, [
          {v:'14d',label:'14 days'},{v:'30d',label:'30 days'},
          {v:'90d',label:'90 days'},{v:'all',label:'Forever'}
        ])
      )}
    </div>
  `;
}

function buildCeremonyPreview() {
  var m = SETTINGS.ceremony;
  var stage = '';
  if (m === 'silent') {
    stage = '<div class="set-cer-silent">— no animation —</div>';
  } else if (m === 'glow') {
    stage = '<div class="set-cer-glow">Tab Whore</div>';
  } else if (m === 'toast') {
    stage = `<div class="set-cer-toast">
      <div class="set-cer-toast-k">RANK UP!</div>
      <div class="set-cer-toast-v">Tab Whore</div>
      <div class="set-cer-toast-q">&ldquo;Yeah you ARE. Bless ya.&rdquo;</div>
    </div>`;
  } else if (m === 'big') {
    var confettiDots = '';
    if (SETTINGS.confetti) {
      var colors = ['#d6a848','#c8453a','#7fb069','#9b6dd1','#3ef6ff'];
      for (var i = 0; i < 14; i++) {
        confettiDots += `<span class="set-cer-confetti-dot" style="left:${(i*7+5)%100}%;background:${colors[i%5]};animation-delay:${((i*0.07)%1).toFixed(2)}s"></span>`;
      }
    }
    stage = `<div class="set-cer-big">
      <div class="set-cer-big-k">★ RANK UP ★</div>
      <div class="set-cer-big-v">TAB WHORE</div>
      <div class="set-cer-big-q">&ldquo;Yeah you ARE. Bless ya for it.&rdquo;</div>
      ${SETTINGS.confetti ? `<div class="set-cer-confetti">${confettiDots}</div>` : ''}
    </div>`;
  }
  return `<div class="set-cer">
    <div class="set-cer-label">PREVIEW · ${m.toUpperCase()}</div>
    <div class="set-cer-stage">${stage}</div>
  </div>`;
}

// ─── Tab: Ranks ──────────────────────────────────────────────────────────────
function buildRanks() {
  var ranks = CUSTOM_RANKS || TH_RANKS;
  return `
    ${secTitle('Ranks &amp; ladder', 'Edit titles, thresholds, and quotes. Or generate the whole ladder via the AI customizer.')}
    <div class="set-ladder-hdr">
      <span>RANGE</span><span>TITLE</span><span>QUOTE</span><span>TONE</span>
    </div>
    ${ranks.map(function (r, i) {
      var maxVal = (r.max === Infinity || r.max === 'inf') ? '∞' : r.max;
      return `<div class="set-ladder-row" data-rank-idx="${i}">
        <div class="set-ladder-range">
          <input class="set-ladder-min" data-idx="${i}" value="${r.min}" type="number" min="0" />
          –
          <input class="set-ladder-max" data-idx="${i}" value="${maxVal}" />
        </div>
        <input class="set-ladder-title" data-idx="${i}" value="${escHtml(r.title)}" />
        <input class="set-ladder-quote" data-idx="${i}" value="${escHtml(r.quote)}" />
        <div class="set-ladder-tone">
          <span class="set-tone-swatch t-${r.tone}"></span>${r.tone}
        </div>
      </div>`;
    }).join('')}
    <button class="set-ladder-add" id="btn-add-rank">+ Add another rank</button>
    <div style="margin-top:12px">
      <button class="set-cta set-cta-primary" id="btn-save-ranks">Save ranks</button>
    </div>
  `;
}

// ─── Tab: Achievements ───────────────────────────────────────────────────────
function buildAchievements() {
  var achs = CUSTOM_ACHIEVEMENTS || TH_ACHIEVEMENTS;
  return `
    ${secTitle('Achievements', 'Locked-state visibility is configurable per achievement — show full hint, cryptic, or fully hidden.')}
    <div class="set-card">
      ${field('Default locked visibility',
        null,
        seg('achVisibility', 'cryptic', [
          {v:'full',label:'Show condition'},
          {v:'cryptic',label:'Cryptic hint'},
          {v:'hidden',label:'Hidden'}
        ])
      )}
    </div>
    <div class="set-ach-grid">
      ${achs.map(function (a) {
        return `<div class="set-ach-card">
          <div class="set-ach-icon">${a.icon}</div>
          <div class="set-ach-meta">
            <input value="${escHtml(a.name)}" class="set-ach-name" data-ach="${a.id}" />
            <input value="${escHtml(a.desc || a.trigger || '')}" class="set-ach-desc" data-ach="${a.id}" />
            <div class="set-ach-pills">
              <select class="set-ach-pill" data-ach="${a.id}">
                <option value="full">show condition</option>
                <option value="cryptic" selected>cryptic</option>
                <option value="hidden">hidden</option>
              </select>
              <span class="set-ach-pill ${a.unlocked ? 'on' : ''}">
                ${a.unlocked ? `✓ ${a.date || ''}` : 'locked'}
              </span>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

// ─── Tab: Icons ───────────────────────────────────────────────────────────────
function buildIcons() {
  var picked = SETTINGS.icon || 'crown';
  var iconSets = [
    { id: 'classic', name: 'Classic tab',  svg: iconClassic() },
    { id: 'mono',    name: 'Monogram H',   svg: iconMono() },
    { id: 'crown',   name: 'Crown',        svg: iconCrown() },
    { id: 'pixel',   name: 'Pixel',        svg: iconPixel() },
  ];
  return `
    ${secTitle('Toolbar icon', 'Pick a shipped set, or drop your own PNGs / SVG via the config file.')}
    <div class="set-icon-grid">
      ${iconSets.map(function (o) {
        return `<button class="set-icon-card ${picked === o.id ? 'on' : ''}" data-icon="${o.id}">
          ${o.svg}
          <div class="set-icon-name">${o.name}</div>
        </button>`;
      }).join('')}
    </div>
    <div class="set-card" style="margin-top:20px">
      ${field('Custom icon set (config.yml)', 'Paste a base64 PNG or a file path the extension can load locally.',
        `<pre class="set-code">icon:
  16: "./icons/custom-16.png"
  32: "./icons/custom-32.png"
  48: "./icons/custom-48.png"
  96: "./icons/custom-96.png"</pre>`
      )}
    </div>
  `;
}

function iconClassic() {
  return `<svg width="28" height="28" viewBox="0 0 32 32"><rect x="3" y="9" width="26" height="20" rx="2" fill="#1a1410"/><path d="M3 9 L9 4 L17 4 L17 9 Z" fill="#d6a848"/><text x="16" y="24" text-anchor="middle" font-size="10" font-weight="900" fill="#d6a848" font-family="Anton">67</text></svg>`;
}
function iconMono() {
  return `<svg width="28" height="28" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#1a1410" stroke="#d6a848" stroke-width="1.5"/><text x="16" y="22" text-anchor="middle" font-size="18" font-weight="900" fill="#d6a848" font-family="Anton">H</text></svg>`;
}
function iconCrown() {
  return `<svg width="28" height="28" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1a1410"/><path d="M6 20 L8 10 L14 14 L16 8 L18 14 L24 10 L26 20 Z M6 22 H26 V25 H6 Z" fill="#d6a848"/></svg>`;
}
function iconPixel() {
  var cells = [[8,10],[12,10],[16,10],[20,10],[8,14],[8,18],[8,22],[12,18],[16,18],[20,14],[20,18],[20,22],[12,22],[16,22]];
  var rects = cells.map(function (xy, i) {
    return `<rect x="${xy[0]}" y="${xy[1]}" width="4" height="4" fill="${i%3?'#ff2e88':'#ffd34e'}"/>`;
  }).join('');
  return `<svg width="28" height="28" viewBox="0 0 32 32" shape-rendering="crispEdges"><rect width="32" height="32" fill="#0a0612"/>${rects}</svg>`;
}

// ─── Tab: AI Customizer ───────────────────────────────────────────────────────
function buildAI() {
  var steps = ['Pick a vibe', 'Generate prompt', "Paste your LLM's YAML", 'Apply'];
  var stepper = steps.map(function (label, i) {
    var n = i + 1;
    var cls = AI_STEP === n ? 'on' : (AI_STEP > n ? 'done' : '');
    return `<div class="set-step ${cls}"><span class="set-step-n">${AI_STEP > n ? '✓' : n}</span>${label}</div>`;
  }).join('');

  var prompt = buildPrompt();

  var yamlStatus = '';
  if (AI_PASTED_YAML.trim()) {
    if (AI_YAML_VALID && AI_PARSED) {
      var rc = (AI_PARSED.ranks||[]).length;
      var ac = (AI_PARSED.achievements||[]).length;
      yamlStatus = `<span class="set-yaml-ok">✓ Valid</span> · ${rc} ranks · ${ac} achievements`;
    } else {
      yamlStatus = `<span class="set-yaml-err">✗ Invalid YAML — check formatting</span>`;
    }
  } else {
    yamlStatus = '<span style="opacity:.5">Paste the output from your LLM above</span>';
  }

  var previewCurrent = thRankFor(67);
  var previewAfter = AI_PARSED && AI_PARSED.ranks ? parseRankFor(AI_PARSED.ranks, 67) : null;

  return `
    ${secTitle('AI customizer', 'Generate a config.yml for any vibe. Build a prompt, paste it into your LLM of choice, paste the YAML back. No keys, no API calls — your data stays here.')}

    <div class="set-stepper">${stepper}</div>

    <div class="set-card">
      <div class="set-card-title">1 · DEFINE THE VIBE</div>
      ${field('Voice &amp; character', null,
        `<input class="set-input" id="ai-vibe" value="${escHtml(AI_VIBE)}" />`
      )}
      ${field(`Tone intensity · <span id="ai-intensity-val">${AI_INTENSITY}</span>`, '0 = polite, 100 = max unhinged.',
        `<input type="range" min="0" max="100" value="${AI_INTENSITY}" class="set-range" id="ai-intensity" />`
      )}
      <div class="set-grid2">
        ${field('Rank count', null, `<input type="number" id="ai-ranks" value="${AI_RANKS_COUNT}" class="set-input" min="3" max="20" />`)}
        ${field('Achievement count', null, `<input type="number" id="ai-achs" value="${AI_ACHS_COUNT}" class="set-input" min="3" max="40" />`)}
      </div>
    </div>

    <div class="set-card">
      <div class="set-card-title">2 · GENERATED PROMPT</div>
      <div class="set-prompt-box">
        <pre class="set-prompt" id="ai-prompt-text">${escHtml(prompt)}</pre>
        <div class="set-prompt-tools">
          <button class="set-cta" id="btn-copy-prompt">⧉ Copy prompt</button>
          <div class="set-prompt-meta">${prompt.length} chars · works with any LLM</div>
        </div>
      </div>
      <div class="set-llm-row">
        <span>Quick-open in:</span>
        <a class="set-llm-pill" href="https://claude.ai" target="_blank">Claude</a>
        <a class="set-llm-pill" href="https://chatgpt.com" target="_blank">ChatGPT</a>
        <a class="set-llm-pill" href="https://gemini.google.com" target="_blank">Gemini</a>
      </div>
    </div>

    <div class="set-card">
      <div class="set-card-title">3 · PASTE THE YAML IT RETURNED</div>
      <textarea class="set-yaml" id="ai-yaml" rows="14" spellcheck="false">${escHtml(AI_PASTED_YAML || SAMPLE_YAML)}</textarea>
      <div class="set-yaml-foot">
        <div class="set-yaml-status">${yamlStatus}</div>
        <button class="set-cta set-cta-primary" id="btn-apply-yaml">Apply config →</button>
      </div>
    </div>

    <div class="set-card muted">
      <div class="set-card-title">4 · PREVIEW BEFORE APPLYING</div>
      <div class="set-preview-row">
        <div class="set-preview-col">
          <div class="set-preview-k">CURRENT</div>
          <div class="set-preview-v">${escHtml(previewCurrent.title)}</div>
          <div class="set-preview-q">&ldquo;${escHtml(previewCurrent.quote)}&rdquo;</div>
        </div>
        <div class="set-preview-arrow">→</div>
        <div class="set-preview-col ${previewAfter ? 'on' : ''}">
          <div class="set-preview-k">AFTER APPLY</div>
          ${previewAfter
            ? `<div class="set-preview-v">${escHtml(previewAfter.title)}</div>
               <div class="set-preview-q">&ldquo;${escHtml(previewAfter.quote)}&rdquo;</div>`
            : `<div class="set-preview-v" style="opacity:.4">—</div>
               <div class="set-preview-q" style="opacity:.4">Paste YAML above to preview</div>`
          }
        </div>
      </div>
    </div>
  `;
}

function buildPrompt() {
  return `You are configuring a Firefox extension called Tab Hoor, which gamifies how
many browser tabs the user keeps open. Your job is to produce a config.yml.

VOICE / CHARACTER: ${AI_VIBE}
INTENSITY: ${AI_INTENSITY}/100  (0 = polite, 100 = maximally unhinged)
RANKS: produce exactly ${AI_RANKS_COUNT} rank tiers
ACHIEVEMENTS: produce exactly ${AI_ACHS_COUNT}

Constraints:
- Each rank needs: min, max, title, tone (green|amber|red|purple), quote (<=14 words).
- Tones must climb: green -> amber -> red -> purple as tabs increase.
- The first rank starts at 0; the last rank ends at "inf".
- Achievements need: id, icon (1 emoji), name (<=4 words), trigger expression.
- The tone must NEVER shame or scold the user. It celebrates them. Even at the
  highest tier the user is the hero -- the voice is their unhinged hype-friend.
- The "feeling overwhelmed" harm-reduction footer copy should feel like a warm
  afterthought from a friend, not a lecture.

Return ONLY valid YAML, starting with "# tab-hoor config.yml". No prose,
no explanation. Begin now.`;
}

// ─── Simple YAML parser ──────────────────────────────────────────────────────
function parseTabHoorYaml(yaml) {
  try {
    var ranks = [];
    var achievements = [];

    // extract ranks block
    var ranksMatch = yaml.match(/^ranks:\s*\n((?:[ \t]+-[^\n]*\n?)+)/m);
    if (ranksMatch) {
      var rankLines = ranksMatch[1].split('\n').filter(function (l) { return l.trim().startsWith('-'); });
      rankLines.forEach(function (line) {
        var obj = parseInlineYamlObj(line.replace(/^\s*-\s*/, ''));
        if (obj && obj.title) {
          ranks.push({
            min: parseInt(obj.min) || 0,
            max: (obj.max === 'inf' || obj.max === '∞' || obj.max === Infinity) ? Infinity : parseInt(obj.max),
            title: obj.title,
            tone: obj.tone || 'green',
            quote: obj.quote || ''
          });
        }
      });
    }

    // extract achievements block
    var achsMatch = yaml.match(/^achievements:\s*\n((?:[ \t]+-[^\n]*\n?)+)/m);
    if (achsMatch) {
      var achLines = achsMatch[1].split('\n').filter(function (l) { return l.trim().startsWith('-'); });
      achLines.forEach(function (line) {
        var obj = parseInlineYamlObj(line.replace(/^\s*-\s*/, ''));
        if (obj && obj.name) {
          achievements.push({
            id: obj.id || ('ach_' + achievements.length),
            icon: obj.icon || '⭐',
            name: obj.name,
            desc: obj.trigger || '',
            unlocked: false
          });
        }
      });
    }

    if (ranks.length < 1) return null;
    return { ranks: ranks, achievements: achievements };
  } catch (e) {
    return null;
  }
}

function parseInlineYamlObj(str) {
  // handles: { key: val, key: "val", key: 'val' }
  str = str.trim();
  if (str.startsWith('{')) str = str.slice(1);
  if (str.endsWith('}')) str = str.slice(0, -1);

  var obj = {};
  // split on commas not inside quotes
  var parts = str.match(/(?:[^,"']|"[^"]*"|'[^']*')+/g) || [];
  parts.forEach(function (part) {
    var colonIdx = part.indexOf(':');
    if (colonIdx < 0) return;
    var k = part.slice(0, colonIdx).trim();
    var v = part.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (k) obj[k] = v;
  });
  return obj;
}

function parseRankFor(ranks, n) {
  for (var i = 0; i < ranks.length; i++) {
    var r = ranks[i];
    var max = (r.max === Infinity || r.max === 'inf') ? Infinity : Number(r.max);
    if (n >= Number(r.min) && n <= max) return r;
  }
  return ranks[ranks.length - 1] || null;
}

// ─── Event binding ────────────────────────────────────────────────────────────
function bindPage() {
  // nav tabs
  document.querySelectorAll('[data-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ACTIVE_TAB = btn.dataset.tab;
      renderPage();
    });
  });

  // export / import
  var exportBtn = document.getElementById('btn-export');
  if (exportBtn) exportBtn.addEventListener('click', exportConfig);
  var importBtn = document.getElementById('btn-import');
  if (importBtn) importBtn.addEventListener('click', importConfig);

  bindTabSpecific();
}

function bindTabSpecific() {
  if (ACTIVE_TAB === 'general') bindGeneral();
  if (ACTIVE_TAB === 'ranks')   bindRanks();
  if (ACTIVE_TAB === 'icons')   bindIcons();
  if (ACTIVE_TAB === 'ai')      bindAI();
}

function bindGeneral() {
  // segmented controls
  document.querySelectorAll('[data-seg]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.dataset.seg;
      var val = btn.dataset.val;
      SETTINGS[key] = val;
      saveSettings();
      renderPage();
    });
  });

  // toggles
  document.querySelectorAll('[data-toggle]').forEach(function (el) {
    el.addEventListener('click', function () {
      var key = el.dataset.toggle;
      SETTINGS[key] = !SETTINGS[key];
      saveSettings();
      renderPage();
    });
  });
}

function bindRanks() {
  // save ranks button
  var saveBtn = document.getElementById('btn-save-ranks');
  if (saveBtn) saveBtn.addEventListener('click', saveRanksFromForm);

  // add rank
  var addBtn = document.getElementById('btn-add-rank');
  if (addBtn) addBtn.addEventListener('click', function () {
    if (!CUSTOM_RANKS) CUSTOM_RANKS = TH_RANKS.slice();
    CUSTOM_RANKS.push({ min: 999, max: Infinity, title: 'New Rank', tone: 'purple', quote: 'You did it.' });
    renderPage();
  });
}

function saveRanksFromForm() {
  var rows = document.querySelectorAll('[data-rank-idx]');
  var ranks = [];
  rows.forEach(function (row) {
    var i = row.dataset.rankIdx;
    var minEl = row.querySelector('.set-ladder-min');
    var maxEl = row.querySelector('.set-ladder-max');
    var titleEl = row.querySelector('.set-ladder-title');
    var quoteEl = row.querySelector('.set-ladder-quote');
    if (!titleEl) return;
    var maxVal = maxEl.value.trim();
    ranks.push({
      min: parseInt(minEl.value) || 0,
      max: (maxVal === '∞' || maxVal === 'inf') ? Infinity : parseInt(maxVal),
      title: titleEl.value,
      quote: quoteEl.value,
      tone: (CUSTOM_RANKS || TH_RANKS)[i] ? (CUSTOM_RANKS || TH_RANKS)[i].tone : 'green'
    });
  });
  CUSTOM_RANKS = ranks;
  browser.storage.local.set({ customRanks: ranks });
  // flash save button
  var btn = document.getElementById('btn-save-ranks');
  if (btn) { btn.textContent = '✓ Saved'; setTimeout(function () { btn.textContent = 'Save ranks'; }, 1400); }
}

function bindIcons() {
  document.querySelectorAll('[data-icon]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      SETTINGS.icon = btn.dataset.icon;
      saveSettings();
      renderPage();
    });
  });
}

function bindAI() {
  var vibeEl = document.getElementById('ai-vibe');
  var intensityEl = document.getElementById('ai-intensity');
  var intensityValEl = document.getElementById('ai-intensity-val');
  var ranksEl = document.getElementById('ai-ranks');
  var achsEl = document.getElementById('ai-achs');
  var yamlEl = document.getElementById('ai-yaml');

  if (vibeEl) vibeEl.addEventListener('input', function () {
    AI_VIBE = vibeEl.value;
    refreshPrompt();
  });

  if (intensityEl) intensityEl.addEventListener('input', function () {
    AI_INTENSITY = parseInt(intensityEl.value);
    if (intensityValEl) intensityValEl.textContent = AI_INTENSITY;
    refreshPrompt();
  });

  if (ranksEl) ranksEl.addEventListener('change', function () {
    AI_RANKS_COUNT = parseInt(ranksEl.value) || 9;
    refreshPrompt();
  });

  if (achsEl) achsEl.addEventListener('change', function () {
    AI_ACHS_COUNT = parseInt(achsEl.value) || 8;
    refreshPrompt();
  });

  if (yamlEl) {
    // pre-populate & parse sample on first load
    if (!AI_PASTED_YAML) {
      AI_PASTED_YAML = yamlEl.value;
      var parsed = parseTabHoorYaml(AI_PASTED_YAML);
      AI_YAML_VALID = !!parsed;
      AI_PARSED = parsed;
    }
    yamlEl.addEventListener('input', function () {
      AI_PASTED_YAML = yamlEl.value;
      var parsed = parseTabHoorYaml(AI_PASTED_YAML);
      AI_YAML_VALID = !!parsed;
      AI_PARSED = parsed;
      updateYamlStatus();
      updatePreview();
    });
  }

  var copyBtn = document.getElementById('btn-copy-prompt');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var prompt = buildPrompt();
    navigator.clipboard.writeText(prompt).then(function () {
      copyBtn.textContent = '✓ Copied';
      setTimeout(function () { copyBtn.textContent = '⧉ Copy prompt'; }, 1400);
    });
  });

  var applyBtn = document.getElementById('btn-apply-yaml');
  if (applyBtn) applyBtn.addEventListener('click', applyYaml);
}

function refreshPrompt() {
  var el = document.getElementById('ai-prompt-text');
  if (!el) return;
  var p = buildPrompt();
  el.textContent = p;
  var meta = el.closest('.set-card').querySelector('.set-prompt-meta');
  if (meta) meta.textContent = p.length + ' chars · works with any LLM';
}

function updateYamlStatus() {
  var statusEl = document.querySelector('.set-yaml-status');
  if (!statusEl) return;
  if (AI_PASTED_YAML.trim()) {
    if (AI_YAML_VALID && AI_PARSED) {
      var rc = (AI_PARSED.ranks||[]).length;
      var ac = (AI_PARSED.achievements||[]).length;
      statusEl.innerHTML = `<span class="set-yaml-ok">✓ Valid</span> · ${rc} ranks · ${ac} achievements`;
    } else {
      statusEl.innerHTML = `<span class="set-yaml-err">✗ Invalid YAML — check formatting</span>`;
    }
  }
}

function updatePreview() {
  var afterCol = document.querySelector('.set-preview-col.on, .set-preview-col:last-of-type');
  if (!afterCol) return;
  if (AI_PARSED && AI_PARSED.ranks) {
    var r = parseRankFor(AI_PARSED.ranks, 67);
    if (r) {
      afterCol.classList.add('on');
      afterCol.innerHTML = `<div class="set-preview-k">AFTER APPLY</div>
        <div class="set-preview-v">${escHtml(r.title)}</div>
        <div class="set-preview-q">&ldquo;${escHtml(r.quote)}&rdquo;</div>`;
    }
  }
}

function applyYaml() {
  if (!AI_YAML_VALID || !AI_PARSED) return;
  var updates = {};
  if (AI_PARSED.ranks && AI_PARSED.ranks.length) updates.customRanks = AI_PARSED.ranks;
  if (AI_PARSED.achievements && AI_PARSED.achievements.length) updates.customAchievements = AI_PARSED.achievements;
  browser.storage.local.set(updates).then(function () {
    CUSTOM_RANKS = updates.customRanks || CUSTOM_RANKS;
    CUSTOM_ACHIEVEMENTS = updates.customAchievements || CUSTOM_ACHIEVEMENTS;
    var btn = document.getElementById('btn-apply-yaml');
    if (btn) { btn.textContent = '✓ Applied!'; setTimeout(function () { btn.textContent = 'Apply config →'; }, 2000); }
  });
}

// ─── Export / Import ──────────────────────────────────────────────────────────
function exportConfig() {
  browser.storage.local.get(null).then(function (data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'tab-hoor-config.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function importConfig() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', function () {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        browser.storage.local.set(data).then(function () {
          if (data.settings) Object.assign(SETTINGS, data.settings);
          if (data.customRanks) CUSTOM_RANKS = data.customRanks;
          if (data.customAchievements) CUSTOM_ACHIEVEMENTS = data.customAchievements;
          renderPage();
        });
      } catch (err) {
        alert('Invalid config file.');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function saveSettings() {
  browser.storage.local.set({ settings: SETTINGS });
}

function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function secTitle(h, sub) {
  return `<div class="set-sectitle">
    <div class="set-sectitle-h">${h}</div>
    <div class="set-sectitle-sub">${sub}</div>
  </div>`;
}

function field(label, hint, ctrl) {
  return `<div class="set-field">
    <div class="set-field-label">${label}</div>
    ${hint ? `<div class="set-field-hint">${hint}</div>` : ''}
    <div class="set-field-ctrl">${ctrl}</div>
  </div>`;
}

function seg(key, current, options) {
  return `<div class="set-seg">
    ${options.map(function (o) {
      return `<button class="set-seg-i ${current === o.v ? 'on' : ''}" data-seg="${key}" data-val="${o.v}">${o.label}</button>`;
    }).join('')}
  </div>`;
}

function toggle(key, label, value, hint) {
  return `<label class="set-toggle">
    <span>
      <div class="set-toggle-lbl">${label}</div>
      ${hint ? `<div class="set-field-hint">${hint}</div>` : ''}
    </span>
    <span class="set-switch ${value ? 'on' : ''}" data-toggle="${key}">
      <span class="set-switch-dot"></span>
    </span>
  </label>`;
}

// thRankFor is defined in ../data.js as TH_RANKS array helper
function thRankFor(n) {
  for (var i = 0; i < TH_RANKS.length; i++) {
    var r = TH_RANKS[i];
    if (n >= r.min && n <= r.max) return r;
  }
  return TH_RANKS[0];
}
