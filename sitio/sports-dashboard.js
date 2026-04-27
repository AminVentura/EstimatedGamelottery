// sports-dashboard.js — Sports Betting Analysis Dashboard
// Player Props analysis for NBA, MLB, NFL with probability scoring
// Mirrors the lottery prediction engine's statistical approach

const SportsDashboard = (() => {

  // ─── Demo data ─────────────────────────────────────────────────────────────
  // Replace with live fetch from The Odds API once you set window.ODDS_API_KEY
  const SPORTS_DATA = {
    NBA: {
      icon: 'fas fa-basketball-ball',
      colorName: 'orange',
      metric: 'Puntos',
      unit: 'pts',
      players: [
        { name: 'Luka Doncic',              team: 'DAL', avg: 33.8, line: 32.5, last5: [38, 29, 35, 31, 36], opponentRank: 7,  isHome: false },
        { name: 'Joel Embiid',              team: 'PHI', avg: 33.1, line: 31.5, last5: [35, 29, 37, 28, 36], opponentRank: 9,  isHome: false },
        { name: 'Giannis Antetokounmpo',    team: 'MIL', avg: 30.5, line: 29.5, last5: [33, 28, 32, 25, 34], opponentRank: 16, isHome: true  },
        { name: 'Stephen Curry',            team: 'GSW', avg: 28.1, line: 27.5, last5: [31, 24, 29, 33, 23], opponentRank: 12, isHome: false },
        { name: 'Nikola Jokic',             team: 'DEN', avg: 26.4, line: 25.0, last5: [30, 27, 24, 31, 20], opponentRank: 22, isHome: true  },
        { name: 'LeBron James',             team: 'LAL', avg: 25.3, line: 24.5, last5: [28, 22, 31, 19, 26], opponentRank: 18, isHome: true  },
      ]
    },
    MLB: {
      icon: 'fas fa-baseball-ball',
      colorName: 'blue',
      metric: 'Ponches (K)',
      unit: 'K',
      players: [
        { name: 'Spencer Strider',  team: 'ATL', avg: 10.1, line: 9.5,  last5: [11, 9, 12, 8, 10], opponentRank: 21, isHome: false },
        { name: 'Dylan Cease',      team: 'SDP', avg: 9.5,  line: 9.0,  last5: [10, 9, 11, 8, 10], opponentRank: 11, isHome: true  },
        { name: 'Gerrit Cole',      team: 'NYY', avg: 9.2,  line: 8.5,  last5: [10, 8, 11, 9, 7],  opponentRank: 14, isHome: true  },
        { name: 'Zack Wheeler',     team: 'PHI', avg: 8.3,  line: 7.5,  last5: [9, 7, 10, 8, 8],   opponentRank: 6,  isHome: true  },
        { name: 'Kevin Gausman',    team: 'TOR', avg: 7.8,  line: 7.5,  last5: [8, 7, 9, 6, 9],    opponentRank: 18, isHome: false },
        { name: 'Pablo Lopez',      team: 'MIN', avg: 7.2,  line: 7.0,  last5: [8, 6, 8, 7, 7],    opponentRank: 25, isHome: false },
      ]
    },
    NFL: {
      icon: 'fas fa-football-ball',
      colorName: 'green',
      metric: 'Yardas Recepción',
      unit: 'yds',
      players: [
        { name: 'Justin Jefferson',  team: 'MIN', avg: 89.2, line: 82.5, last5: [95, 78, 103, 71, 98], opponentRank: 8,  isHome: true  },
        { name: 'Cooper Kupp',       team: 'LAR', avg: 76.8, line: 72.5, last5: [85, 69, 88, 62, 80],  opponentRank: 23, isHome: false },
        { name: 'Tyreek Hill',       team: 'MIA', avg: 74.3, line: 70.0, last5: [82, 68, 91, 55, 75],  opponentRank: 19, isHome: false },
        { name: 'Stefon Diggs',      team: 'BUF', avg: 71.4, line: 68.0, last5: [77, 64, 82, 58, 76],  opponentRank: 5,  isHome: true  },
        { name: 'Davante Adams',     team: 'LVR', avg: 68.5, line: 65.5, last5: [73, 61, 79, 58, 71],  opponentRank: 14, isHome: true  },
        { name: 'Travis Kelce',      team: 'KCH', avg: 65.2, line: 62.5, last5: [70, 58, 75, 52, 71],  opponentRank: 17, isHome: false },
      ]
    }
  };

  const NBA_STANDINGS = [
    { team: 'Boston Celtics',           w: 38, l: 11, pct: '.776', gb: '—',  conf: 'E1' },
    { team: 'Cleveland Cavaliers',      w: 33, l: 16, pct: '.673', gb: '5',  conf: 'E2' },
    { team: 'Oklahoma City Thunder',    w: 35, l: 14, pct: '.714', gb: '—',  conf: 'W1' },
    { team: 'Denver Nuggets',           w: 31, l: 18, pct: '.633', gb: '4',  conf: 'W2' },
    { team: 'Minnesota Timberwolves',   w: 29, l: 20, pct: '.592', gb: '6',  conf: 'W3' },
    { team: 'New York Knicks',          w: 28, l: 21, pct: '.571', gb: '10', conf: 'E3' },
  ];

  const MLB_STANDINGS = [
    { team: 'Los Angeles Dodgers',  w: 98, l: 64, pct: '.605', gb: '—',  conf: 'NL W' },
    { team: 'Atlanta Braves',       w: 89, l: 73, pct: '.549', gb: '9',  conf: 'NL E' },
    { team: 'Baltimore Orioles',    w: 91, l: 71, pct: '.562', gb: '—',  conf: 'AL E' },
    { team: 'New York Yankees',     w: 92, l: 70, pct: '.568', gb: '—',  conf: 'AL E' },
    { team: 'Houston Astros',       w: 87, l: 75, pct: '.537', gb: '4',  conf: 'AL W' },
    { team: 'Philadelphia Phillies',w: 90, l: 72, pct: '.556', gb: '8',  conf: 'NL E' },
  ];

  const NFL_STANDINGS = [
    { team: 'Baltimore Ravens',       w: 13, l: 4, pct: '.765', gb: '—',  conf: 'AFC N' },
    { team: 'San Francisco 49ers',    w: 12, l: 5, pct: '.706', gb: '—',  conf: 'NFC W' },
    { team: 'Dallas Cowboys',         w: 12, l: 5, pct: '.706', gb: '—',  conf: 'NFC E' },
    { team: 'Kansas City Chiefs',     w: 11, l: 6, pct: '.647', gb: '2',  conf: 'AFC W' },
    { team: 'Philadelphia Eagles',    w: 11, l: 6, pct: '.647', gb: '1',  conf: 'NFC E' },
    { team: 'Miami Dolphins',         w: 11, l: 6, pct: '.647', gb: '2',  conf: 'AFC E' },
  ];

  const STANDINGS_MAP = { NBA: NBA_STANDINGS, MLB: MLB_STANDINGS, NFL: NFL_STANDINGS };

  // ─── State ──────────────────────────────────────────────────────────────────
  let currentSport = 'NBA';
  let currentView  = 'props';

  // ─── Probability Engine ────────────────────────────────────────────────────
  // Weighted statistical score mirroring the lottery hot/cold analysis:
  // season edge + recent trend + opponent strength + home advantage
  function calculateProbability(player) {
    const { avg, line, last5, opponentRank, isHome } = player;

    // 1. Season-average edge (normalized)
    const edgeNorm  = (avg - line) / (avg * 0.15);
    const baseProb  = 0.5 + Math.max(-0.22, Math.min(0.22, edgeNorm * 0.28));

    // 2. Recent form — fraction of last-5 games above the line
    const aboveLine  = last5.filter(v => v > line).length;
    const trendBonus = (aboveLine / last5.length - 0.5) * 0.28;

    // 3. Opponent defensive rank (1 = toughest, 32 = weakest) — weak D helps
    const oppBonus = ((opponentRank - 16) / 32) * 0.14;

    // 4. Home-court / home-field edge
    const homeBonus = isHome ? 0.03 : -0.01;

    const prob = baseProb + trendBonus + oppBonus + homeBonus;
    return Math.round(Math.max(0.26, Math.min(0.80, prob)) * 100);
  }

  function getProbabilityMeta(prob) {
    if (prob >= 68) return { label: 'Alta',        cls: 'prob-high',        icon: '🔥' };
    if (prob >= 55) return { label: 'Media-Alta',  cls: 'prob-medium-high', icon: '📈' };
    if (prob >= 45) return { label: 'Media',       cls: 'prob-medium',      icon: '⚖️' };
    return           { label: 'Baja',        cls: 'prob-low',         icon: '❄️' };
  }

  // ─── AES-256-GCM via Web Crypto API ────────────────────────────────────────
  async function deriveKey(userId) {
    const enc  = new TextEncoder();
    const raw  = await crypto.subtle.importKey('raw', enc.encode(userId), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode('sports-v1-salt'), iterations: 100000, hash: 'SHA-256' },
      raw,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptBet(data, userId) {
    const key        = await deriveKey(userId);
    const iv         = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify(data))
    );
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(ciphertext)) };
  }

  async function decryptBet(encrypted, userId) {
    const key       = await deriveKey(userId);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encrypted.iv) },
      key,
      new Uint8Array(encrypted.data)
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  // ─── Rendering helpers ─────────────────────────────────────────────────────
  function sportColorClass(colorName, variant) {
    // Returns safe Tailwind class strings
    const map = {
      orange: { text: 'text-orange-400', border: 'border-orange-700', bg: 'bg-orange-600', bgDark: 'bg-orange-900' },
      blue:   { text: 'text-blue-400',   border: 'border-blue-700',   bg: 'bg-blue-600',   bgDark: 'bg-blue-900'   },
      green:  { text: 'text-green-400',  border: 'border-green-700',  bg: 'bg-green-600',  bgDark: 'bg-green-900'  },
    };
    return (map[colorName] || map.blue)[variant] || '';
  }

  function trendDots(last5, line) {
    return last5.map(v => {
      const over = v > line;
      return `<span class="trend-dot ${over ? 'over' : 'under'}" title="${v} ${over ? '▲' : '▼'} ${line}">
        ${over ? '✓' : '✗'}
      </span>`;
    }).join('');
  }

  function renderPlayerCard(player, data) {
    const prob      = calculateProbability(player);
    const meta      = getProbabilityMeta(prob);
    const color     = data.colorName;
    const edgePct   = ((player.avg - player.line) / player.line * 100).toFixed(1);
    const positive  = player.avg >= player.line;
    const last5avg  = (player.last5.reduce((a, b) => a + b, 0) / player.last5.length).toFixed(1);
    const initials  = player.name.split(' ').map(n => n[0]).join('').slice(0, 2);

    return `
<div class="player-prop-card">
  <div class="prop-card-top">
    <div class="flex items-center gap-2.5 min-w-0">
      <div class="player-avatar ${sportColorClass(color, 'bg')}">${initials}</div>
      <div class="min-w-0">
        <p class="text-white font-semibold text-sm truncate">${player.name}</p>
        <p class="text-gray-500 text-xs">${player.team} &bull; ${player.isHome ? 'Local' : 'Visitante'} &bull; Def. rk #${player.opponentRank}</p>
      </div>
    </div>
    <div class="shrink-0 text-right">
      <div class="probability-badge ${meta.cls}">
        <span>${meta.icon}</span><span class="font-black text-base">${prob}%</span>
      </div>
      <p class="text-gray-500 text-xs mt-0.5">${meta.label}</p>
    </div>
  </div>

  <div class="prop-stats-grid">
    <div class="prop-stat-box">
      <p class="text-gray-500 text-xs">Prom. Temp.</p>
      <p class="text-white font-bold">${player.avg} <span class="text-gray-500 text-xs font-normal">${data.unit}</span></p>
    </div>
    <div class="prop-stat-box">
      <p class="text-gray-500 text-xs">Línea</p>
      <p class="text-cyan-400 font-bold">${player.line} <span class="text-gray-500 text-xs font-normal">${data.unit}</span></p>
    </div>
    <div class="prop-stat-box">
      <p class="text-gray-500 text-xs">Últ.5 Prom.</p>
      <p class="text-purple-400 font-bold">${last5avg} <span class="text-gray-500 text-xs font-normal">${data.unit}</span></p>
    </div>
    <div class="prop-stat-box">
      <p class="text-gray-500 text-xs">Edge</p>
      <p class="${positive ? 'text-emerald-400' : 'text-red-400'} font-bold">${positive ? '+' : ''}${edgePct}%</p>
    </div>
  </div>

  <div class="mb-3">
    <p class="text-gray-500 text-xs mb-1.5">Últimos 5 partidos vs. línea:</p>
    <div class="flex gap-1.5">${trendDots(player.last5, player.line)}</div>
  </div>

  <div class="prob-bar-track">
    <div class="prob-bar-fill ${meta.cls}" style="width:${prob}%"></div>
  </div>
</div>`;
  }

  // ─── View renderers ────────────────────────────────────────────────────────
  function renderPlayerProps(sport) {
    const container = document.getElementById('sports-view-content');
    if (!container) return;
    const data    = SPORTS_DATA[sport];
    const players = data.players
      .map(p => ({ ...p, _prob: calculateProbability(p) }))
      .sort((a, b) => b._prob - a._prob);

    container.innerHTML = `
<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
  <div>
    <h3 class="text-white font-bold text-base sm:text-lg">
      <i class="${data.icon} mr-2 ${sportColorClass(data.colorName, 'text')}"></i>${sport} &mdash; ${data.metric} Props
    </h3>
    <p class="text-gray-500 text-xs mt-0.5">Rendimiento histórico vs. línea &bull; Probabilidad de superar la apuesta</p>
  </div>
  <div class="api-status-badge">
    <span class="live-dot"></span>Demo Data
    <span class="text-gray-600 ml-1">&bull; conecta The Odds API para datos reales</span>
  </div>
</div>
<div class="space-y-3">${players.map(p => renderPlayerCard(p, data)).join('')}</div>
<div class="mt-4 p-3 rounded-xl border border-gray-700/50 bg-gray-900/60 text-xs text-gray-500">
  <i class="fas fa-info-circle mr-1 text-blue-400"></i>
  <strong class="text-gray-400">Fuentes recomendadas:</strong>
  Tiempo real → <span class="text-cyan-400">The Score App</span> &bull;
  Seguimiento de dinero → <span class="text-green-400">Action Network</span> &bull;
  Cuotas en vivo → <span class="text-yellow-400">The Odds API</span>
</div>`;
  }

  function renderLiveResults() {
    const container = document.getElementById('sports-view-content');
    if (!container) return;
    container.innerHTML = `
<div class="text-center py-10">
  <div class="text-5xl mb-4">📡</div>
  <h3 class="text-white font-bold text-lg mb-2">Resultados en Vivo</h3>
  <p class="text-gray-400 text-sm mb-5 max-w-sm mx-auto">
    Para scores en tiempo real, conecta con alguna de estas plataformas oficiales.
    Tu clave de <strong class="text-yellow-400">The Odds API</strong> habilita también cuotas en vivo.
  </p>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md mx-auto mb-6">
    <div class="live-source-card">
      <i class="fas fa-tv text-blue-400 text-lg mb-1.5 block"></i>
      <p class="text-white font-semibold text-sm">ESPN</p>
      <p class="text-gray-500 text-xs">Scores &amp; live stats</p>
    </div>
    <div class="live-source-card">
      <i class="fas fa-mobile-alt text-green-400 text-lg mb-1.5 block"></i>
      <p class="text-white font-semibold text-sm">The Score</p>
      <p class="text-gray-500 text-xs">Notificaciones push</p>
    </div>
    <div class="live-source-card">
      <i class="fas fa-chart-line text-purple-400 text-lg mb-1.5 block"></i>
      <p class="text-white font-semibold text-sm">Action Network</p>
      <p class="text-gray-500 text-xs">Seguimiento de dinero</p>
    </div>
  </div>
  <div class="api-key-form max-w-sm mx-auto">
    <label class="block text-gray-400 text-xs mb-1.5 text-left">Tu clave The Odds API (opcional, se guarda localmente):</label>
    <div class="flex gap-2">
      <input id="odds-api-key-input" type="password" placeholder="Pegar API key aquí…"
        class="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-600 focus:border-cyan-500 focus:outline-none text-sm font-mono">
      <button onclick="SportsDashboard.saveApiKey()" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold transition-colors">Guardar</button>
    </div>
    <p class="text-gray-600 text-xs mt-1.5 text-left"><i class="fas fa-lock mr-1"></i>Se almacena solo en localStorage, nunca se envía a nuestros servidores.</p>
  </div>
</div>`;
    const saved = localStorage.getItem('odds_api_key');
    if (saved) {
      const input = document.getElementById('odds-api-key-input');
      if (input) input.value = saved;
    }
  }

  function renderStandings(sport) {
    const container = document.getElementById('sports-view-content');
    if (!container) return;
    const rows = STANDINGS_MAP[sport] || [];
    container.innerHTML = `
<h3 class="text-white font-bold text-base mb-3">
  <i class="fas fa-trophy mr-2 text-yellow-400"></i>Clasificación &mdash; ${sport}
</h3>
<div class="overflow-x-auto rounded-xl border border-gray-700/60">
  <table class="w-full text-sm">
    <thead>
      <tr class="bg-gray-900/80 text-gray-400 text-xs uppercase tracking-wide">
        <th class="text-left px-4 py-3">#</th>
        <th class="text-left px-4 py-3">Equipo</th>
        <th class="px-4 py-3">W</th>
        <th class="px-4 py-3">L</th>
        <th class="px-4 py-3">PCT</th>
        <th class="px-4 py-3">GB</th>
        <th class="px-4 py-3">Div.</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-700/40">
      ${rows.map((t, i) => `
      <tr class="hover:bg-gray-800/50 transition-colors">
        <td class="px-4 py-3 text-gray-500 font-mono text-xs">${i + 1}</td>
        <td class="px-4 py-3 text-white font-medium">${t.team}</td>
        <td class="px-4 py-3 text-center text-emerald-400 font-bold">${t.w}</td>
        <td class="px-4 py-3 text-center text-red-400">${t.l}</td>
        <td class="px-4 py-3 text-center text-cyan-400 font-mono">${t.pct}</td>
        <td class="px-4 py-3 text-center text-gray-400">${t.gb}</td>
        <td class="px-4 py-3 text-center text-yellow-400 font-semibold text-xs">${t.conf}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>
<p class="text-gray-600 text-xs mt-2 text-right">
  <i class="fas fa-info-circle mr-1"></i>Datos de muestra &bull; Conecta con API para datos reales
</p>`;
  }

  // ─── Public methods ─────────────────────────────────────────────────────────
  function switchSport(sport) {
    currentSport = sport;
    document.querySelectorAll('.sport-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sport === sport);
    });
    renderCurrentView();
  }

  function switchView(view) {
    currentView = view;
    document.querySelectorAll('.sport-view-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderCurrentView();
  }

  function renderCurrentView() {
    if (currentView === 'props')      renderPlayerProps(currentSport);
    else if (currentView === 'live')  renderLiveResults();
    else if (currentView === 'standings') renderStandings(currentSport);
  }

  function saveApiKey() {
    const input = document.getElementById('odds-api-key-input');
    if (!input || !input.value.trim()) return;
    localStorage.setItem('odds_api_key', input.value.trim());
    window.ODDS_API_KEY = input.value.trim();
    const btn = input.nextElementSibling;
    if (btn) { btn.textContent = '✓ Guardado'; setTimeout(() => { btn.textContent = 'Guardar'; }, 2000); }
  }

  function init() {
    // Restore saved API key
    const savedKey = localStorage.getItem('odds_api_key');
    if (savedKey) window.ODDS_API_KEY = savedKey;

    // Build sport tabs
    const tabsEl = document.getElementById('sport-tabs');
    if (tabsEl) {
      tabsEl.innerHTML = Object.entries(SPORTS_DATA).map(([sport, data]) => `
        <button class="sport-tab${sport === currentSport ? ' active' : ''}" data-sport="${sport}"
          onclick="SportsDashboard.switchSport('${sport}')">
          <i class="${data.icon} mr-1"></i>${sport}
        </button>`).join('');
    }

    renderCurrentView();
  }

  // Expose AES helpers for future Firebase integration (encrypted bet saving)
  return { init, switchSport, switchView, saveApiKey, encryptBet, decryptBet };
})();

window.SportsDashboard = SportsDashboard;
