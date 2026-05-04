// sports-dashboard.js v2.0 — Sports Intelligence Platform
// 1. The Odds API (DraftKings + FanDuel)   2. DK Referral System
// 3. Algorithm Accuracy Tracker            4. Premium Tier + AES-256
// 5. FanDuel/DraftKings-style UI

const SportsDashboard = (() => {

  // ─── Config ────────────────────────────────────────────────────────────────
  const DK_REFERRAL = 'https://sportsbook.draftkings.com/r/sb/aminventura17/US-NY-SB/US-NY';

  const ODDS_SPORT_KEY = {
    NBA: 'basketball_nba',
    MLB: 'baseball_mlb',
    NFL: 'americanfootball_nfl',
  };

  const ODDS_MARKET_KEY = {
    NBA: 'player_points',
    MLB: 'player_strikeouts',
    NFL: 'player_reception_yds',
  };

  // ─── Seed / fallback data ──────────────────────────────────────────────────
  const SPORTS_DATA = {
    NBA: {
      icon: 'fas fa-basketball-ball', colorName: 'orange',
      metric: 'Puntos', unit: 'pts',
      players: [
        { name: 'Luka Doncic',           team: 'DAL', avg: 33.8, line: 32.5, last5: [38,29,35,31,36], opponentRank: 7,  isHome: false },
        { name: 'Joel Embiid',           team: 'PHI', avg: 33.1, line: 31.5, last5: [35,29,37,28,36], opponentRank: 9,  isHome: false },
        { name: 'Giannis Antetokounmpo', team: 'MIL', avg: 30.5, line: 29.5, last5: [33,28,32,25,34], opponentRank: 16, isHome: true  },
        { name: 'Stephen Curry',         team: 'GSW', avg: 28.1, line: 27.5, last5: [31,24,29,33,23], opponentRank: 12, isHome: false },
        { name: 'Nikola Jokic',          team: 'DEN', avg: 26.4, line: 25.0, last5: [30,27,24,31,20], opponentRank: 22, isHome: true  },
        { name: 'LeBron James',          team: 'LAL', avg: 25.3, line: 24.5, last5: [28,22,31,19,26], opponentRank: 18, isHome: true  },
      ],
    },
    MLB: {
      icon: 'fas fa-baseball-ball', colorName: 'blue',
      metric: 'Ponches (K)', unit: 'K',
      players: [
        { name: 'Spencer Strider', team: 'ATL', avg: 10.1, line: 9.5,  last5: [11,9,12,8,10], opponentRank: 21, isHome: false },
        { name: 'Dylan Cease',     team: 'SDP', avg: 9.5,  line: 9.0,  last5: [10,9,11,8,10], opponentRank: 11, isHome: true  },
        { name: 'Gerrit Cole',     team: 'NYY', avg: 9.2,  line: 8.5,  last5: [10,8,11,9,7],  opponentRank: 14, isHome: true  },
        { name: 'Zack Wheeler',    team: 'PHI', avg: 8.3,  line: 7.5,  last5: [9,7,10,8,8],   opponentRank: 6,  isHome: true  },
        { name: 'Kevin Gausman',   team: 'TOR', avg: 7.8,  line: 7.5,  last5: [8,7,9,6,9],    opponentRank: 18, isHome: false },
        { name: 'Pablo Lopez',     team: 'MIN', avg: 7.2,  line: 7.0,  last5: [8,6,8,7,7],    opponentRank: 25, isHome: false },
      ],
    },
    NFL: {
      icon: 'fas fa-football-ball', colorName: 'green',
      metric: 'Yardas Recepción', unit: 'yds',
      players: [
        { name: 'Justin Jefferson', team: 'MIN', avg: 89.2, line: 82.5, last5: [95,78,103,71,98], opponentRank: 8,  isHome: true  },
        { name: 'Cooper Kupp',      team: 'LAR', avg: 76.8, line: 72.5, last5: [85,69,88,62,80],  opponentRank: 23, isHome: false },
        { name: 'Tyreek Hill',      team: 'MIA', avg: 74.3, line: 70.0, last5: [82,68,91,55,75],  opponentRank: 19, isHome: false },
        { name: 'Stefon Diggs',     team: 'BUF', avg: 71.4, line: 68.0, last5: [77,64,82,58,76],  opponentRank: 5,  isHome: true  },
        { name: 'Davante Adams',    team: 'LVR', avg: 68.5, line: 65.5, last5: [73,61,79,58,71],  opponentRank: 14, isHome: true  },
        { name: 'Travis Kelce',     team: 'KCH', avg: 65.2, line: 62.5, last5: [70,58,75,52,71],  opponentRank: 17, isHome: false },
      ],
    },
  };

  const STANDINGS_MAP = {
    NBA: [
      { team: 'Boston Celtics',         w: 38, l: 11, pct: '.776', gb: '—',  conf: 'E1' },
      { team: 'Cleveland Cavaliers',    w: 33, l: 16, pct: '.673', gb: '5',  conf: 'E2' },
      { team: 'Oklahoma City Thunder',  w: 35, l: 14, pct: '.714', gb: '—',  conf: 'W1' },
      { team: 'Denver Nuggets',         w: 31, l: 18, pct: '.633', gb: '4',  conf: 'W2' },
      { team: 'Minnesota Timberwolves', w: 29, l: 20, pct: '.592', gb: '6',  conf: 'W3' },
      { team: 'New York Knicks',        w: 28, l: 21, pct: '.571', gb: '10', conf: 'E3' },
    ],
    MLB: [
      { team: 'Los Angeles Dodgers',   w: 98, l: 64, pct: '.605', gb: '—', conf: 'NL W' },
      { team: 'New York Yankees',      w: 92, l: 70, pct: '.568', gb: '—', conf: 'AL E' },
      { team: 'Baltimore Orioles',     w: 91, l: 71, pct: '.562', gb: '1', conf: 'AL E' },
      { team: 'Atlanta Braves',        w: 89, l: 73, pct: '.549', gb: '9', conf: 'NL E' },
      { team: 'Houston Astros',        w: 87, l: 75, pct: '.537', gb: '5', conf: 'AL W' },
      { team: 'Philadelphia Phillies', w: 90, l: 72, pct: '.556', gb: '8', conf: 'NL E' },
    ],
    NFL: [
      { team: 'Baltimore Ravens',    w: 13, l: 4, pct: '.765', gb: '—', conf: 'AFC N' },
      { team: 'San Francisco 49ers', w: 12, l: 5, pct: '.706', gb: '—', conf: 'NFC W' },
      { team: 'Dallas Cowboys',      w: 12, l: 5, pct: '.706', gb: '—', conf: 'NFC E' },
      { team: 'Kansas City Chiefs',  w: 11, l: 6, pct: '.647', gb: '2', conf: 'AFC W' },
      { team: 'Philadelphia Eagles', w: 11, l: 6, pct: '.647', gb: '1', conf: 'NFC E' },
      { team: 'Miami Dolphins',      w: 11, l: 6, pct: '.647', gb: '2', conf: 'AFC E' },
    ],
  };

  // ─── Module state ──────────────────────────────────────────────────────────
  let currentSport    = 'NBA';
  let currentView     = 'props';
  let liveOddsCache   = {};   // { NBA: { 'Player Name': { dk, fu, isLive, game } } }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. THE ODDS API INTEGRATION
  // ══════════════════════════════════════════════════════════════════════════

  async function fetchLiveOdds(sport) {
    const apiKey = window.ODDS_API_KEY || localStorage.getItem('odds_api_key');
    if (!apiKey) return null;

    const sportKey = ODDS_SPORT_KEY[sport];
    const market   = ODDS_MARKET_KEY[sport];
    // NY market: regions=us targets DraftKings & FanDuel NY books
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/`
              + `?apiKey=${encodeURIComponent(apiKey)}`
              + `&regions=us&markets=${market}&oddsFormat=american`
              + `&bookmakers=draftkings,fanduel`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.warn('[SportsDB] Odds API', res.status, body.message || '');
        return null;
      }
      const events = await res.json();
      return _parseOddsResponse(events, market);
    } catch (err) {
      console.warn('[SportsDB] Odds API fetch error:', err.message);
      return null;
    }
  }

  function _parseOddsResponse(events, market) {
    const out = {};
    const now = new Date();
    events.forEach(ev => {
      const isLive = !ev.completed && new Date(ev.commence_time) <= now;
      const game   = `${ev.away_team} @ ${ev.home_team}`;
      (ev.bookmakers || []).forEach(bm => {
        (bm.markets || []).forEach(mkt => {
          if (mkt.key !== market) return;
          (mkt.outcomes || []).forEach(oc => {
            if (oc.name !== 'Over') return;
            const key = (oc.description || '').trim();
            if (!key) return;
            if (!out[key]) out[key] = { game, isLive, dk: null, fu: null };
            const chip = { price: oc.price, point: oc.point };
            if (bm.key === 'draftkings') out[key].dk = chip;
            if (bm.key === 'fanduel')    out[key].fu = chip;
          });
        });
      });
    });
    return out;
  }

  // Fuzzy lookup: exact name → last-name fallback
  function _getOdds(sport, playerName) {
    const cache = liveOddsCache[sport];
    if (!cache) return null;
    if (cache[playerName]) return cache[playerName];
    const last = playerName.split(' ').pop().toLowerCase();
    const hit  = Object.keys(cache).find(k => k.toLowerCase().includes(last));
    return hit ? cache[hit] : null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROBABILITY ENGINE  (mirrors lottery hot/cold weighted algorithm)
  // ══════════════════════════════════════════════════════════════════════════

  function calcProb(player) {
    const { avg, line, last5, opponentRank, isHome } = player;
    const edgeNorm   = (avg - line) / (avg * 0.15);
    const baseProb   = 0.5 + Math.max(-0.22, Math.min(0.22, edgeNorm * 0.28));
    const aboveLine  = last5.filter(v => v > line).length;
    const trend      = (aboveLine / last5.length - 0.5) * 0.28;
    const opp        = ((opponentRank - 16) / 32) * 0.14;
    const home       = isHome ? 0.03 : -0.01;
    return Math.round(Math.max(0.26, Math.min(0.80, baseProb + trend + opp + home)) * 100);
  }

  function probMeta(p) {
    if (p >= 68) return { label: 'Alta',       cls: 'prob-high',        icon: '🔥' };
    if (p >= 55) return { label: 'Media-Alta', cls: 'prob-medium-high', icon: '📈' };
    if (p >= 45) return { label: 'Media',      cls: 'prob-medium',      icon: '⚖️' };
    return           { label: 'Baja',       cls: 'prob-low',         icon: '❄️' };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AES-256-GCM  (Web Crypto API — no external library)
  // ══════════════════════════════════════════════════════════════════════════

  async function _deriveKey(userId) {
    const enc = new TextEncoder();
    const raw = await crypto.subtle.importKey(
      'raw', enc.encode(userId), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode('sports-v2-salt-2026'), iterations: 100000, hash: 'SHA-256' },
      raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  }

  async function encryptBet(data, userId) {
    const key = await _deriveKey(userId);
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const ct  = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data))
    );
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(ct)) };
  }

  async function decryptBet(enc, userId) {
    const key = await _deriveKey(userId);
    const pt  = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(enc.iv) }, key, new Uint8Array(enc.data)
    );
    return JSON.parse(new TextDecoder().decode(pt));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. ALGORITHM ACCURACY TRACKER
  // ══════════════════════════════════════════════════════════════════════════

  function _getAcc() {
    try { return JSON.parse(localStorage.getItem('sports_accuracy') || '{}'); }
    catch { return {}; }
  }

  function _saveAcc(d) { localStorage.setItem('sports_accuracy', JSON.stringify(d)); }

  function recordFeedback(sport, pKey, hit) {
    const d = _getAcc();
    if (!d[sport]) d[sport] = { hits: 0, total: 0, records: {} };
    if (pKey in d[sport].records) return;   // already voted
    d[sport].records[pKey] = hit ? 1 : 0;
    d[sport].total++;
    if (hit) d[sport].hits++;
    _saveAcc(d);
    _renderAccRow();
    // Replace the feedback row in this card
    const row = document.querySelector(`[data-fkey="${pKey}"]`);
    if (row) row.innerHTML = `<span class="fb-confirmed"><i class="fas fa-check-circle mr-1"></i>¡Reportado! Tu voto mejora el algoritmo.</span>`;
    // Persist to Firebase for premium users
    if (isPremium() && window._sportsDb && window._sportsUserId) _fbFeedback(sport, pKey, hit);
  }

  function _accPct(sport) {
    const d = _getAcc()[sport];
    if (!d || d.total < 1) return null;
    return { pct: Math.round((d.hits / d.total) * 100), total: d.total };
  }

  function _renderAccRow() {
    const el = document.getElementById('algo-accuracy-row');
    if (!el) return;
    el.innerHTML = ['NBA', 'MLB', 'NFL'].map(s => {
      const r = _accPct(s);
      if (!r) return `<div class="acc-chip acc-empty"><span class="acc-sport">${s}</span><span class="acc-nd">Sin datos</span></div>`;
      const cls = r.pct >= 65 ? 'acc-high' : r.pct >= 50 ? 'acc-mid' : 'acc-low';
      return `<div class="acc-chip ${cls}"><span class="acc-sport">${s}</span><span class="acc-pct">${r.pct}%</span><span class="acc-n">${r.total} votos</span></div>`;
    }).join('');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. PREMIUM TIER
  // ══════════════════════════════════════════════════════════════════════════

  function isPremium() { return localStorage.getItem('sports_premium') === '1'; }

  function showPremiumModal() {
    const m = document.getElementById('sports-premium-modal');
    if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
  }

  function hidePremiumModal() {
    const m = document.getElementById('sports-premium-modal');
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
  }

  function activatePremium() {
    const inp = document.getElementById('premium-code-input');
    const msg = document.getElementById('premium-code-msg');
    const code = (inp ? inp.value : '').trim().toUpperCase();
    const VALID = ['JAVI2024', 'SPORTS-PRO', 'PREMIUM1', 'AMINVENTURA', 'PREDICCION'];
    if (VALID.includes(code)) {
      localStorage.setItem('sports_premium', '1');
      hidePremiumModal();
      renderCurrentView();
    } else {
      if (msg) { msg.textContent = 'Código inválido. Intenta de nuevo.'; msg.className = 'text-red-400 text-xs mt-1.5'; }
    }
  }

  async function savePick(btn) {
    if (!isPremium()) { showPremiumModal(); return; }
    const pick = {
      player: btn.dataset.pName, team: btn.dataset.pTeam, sport: btn.dataset.pSport,
      line: parseFloat(btn.dataset.pLine), probability: parseInt(btn.dataset.pProb, 10),
      savedAt: new Date().toISOString(),
    };
    const userId = window._sportsUserId || localStorage.getItem('friendlyUserId') || 'anon';
    const encrypted = await encryptBet(pick, userId);

    if (window._sportsDb && window._sportsUserId) {
      _fbSavePick(encrypted);
    } else {
      const arr = JSON.parse(localStorage.getItem('sports_picks') || '[]');
      arr.unshift({ ...pick, encrypted });
      arr.length = Math.min(arr.length, 50);
      localStorage.setItem('sports_picks', JSON.stringify(arr));
    }
    btn.innerHTML = '<i class="fas fa-check mr-1"></i>Guardado';
    btn.disabled = true;
  }

  // Firebase write helpers (fire-and-forget; only run when wired by app.js)
  function _fbFeedback(sport, key, hit) {
    try {
      const { addDoc, collection } = window._firestoreHelpers || {};
      if (!addDoc) return;
      addDoc(collection(window._sportsDb,
        `artifacts/${window._appId}/public/data/sports_feedback`),
        { sport, key, hit, userId: window._sportsUserId, ts: new Date() });
    } catch(e) { console.warn('[SportsDB] fb feedback:', e); }
  }

  function _fbSavePick(enc) {
    try {
      const { addDoc, collection } = window._firestoreHelpers || {};
      if (!addDoc) return;
      addDoc(collection(window._sportsDb,
        `artifacts/${window._appId}/users/${window._sportsUserId}/sports_picks`),
        { enc, ts: new Date() });
    } catch(e) { console.warn('[SportsDB] fb pick:', e); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. RENDERING — DraftKings/FanDuel-style UI
  // ══════════════════════════════════════════════════════════════════════════

  function _fmtOdds(price) {
    if (price === null || price === undefined) return '—';
    return price > 0 ? `+${price}` : `${price}`;
  }

  function _colorBg(c)   { return { orange: 'bg-orange-600', blue: 'bg-blue-600', green: 'bg-green-600' }[c] || 'bg-blue-600'; }
  function _colorText(c) { return { orange: 'text-orange-400', blue: 'text-blue-400', green: 'text-green-400' }[c] || 'text-blue-400'; }

  function _trendDots(last5, line, unit) {
    return last5.map(v => {
      const over = v > line;
      return `<span class="trend-dot ${over ? 'over' : 'under'}" title="${v}${unit} vs línea ${line}${unit}">${over ? '✓' : '✗'}</span>`;
    }).join('');
  }

  // ── Individual Player Card ─────────────────────────────────────────────────
  function _renderCard(player, data, sport) {
    const prob    = calcProb(player);
    const meta    = probMeta(prob);
    const odds    = _getOdds(sport, player.name);
    const dkLine  = odds && odds.dk ? odds.dk.point : null;
    const dispLine = dkLine !== null ? dkLine : player.line;
    const isLive  = !!(odds && odds.isLive);
    const hasDK   = odds && odds.dk;
    const hasFU   = odds && odds.fu;
    const hasOdds = hasDK || hasFU;
    const edgePct = ((player.avg - dispLine) / dispLine * 100).toFixed(1);
    const positive = player.avg >= dispLine;
    const last5avg = (player.last5.reduce((a, b) => a + b, 0) / player.last5.length).toFixed(1);
    const initials = player.name.split(' ').map(n => n[0]).join('').slice(0, 2);
    const pKey    = `${sport}_${player.name.replace(/\s+/g, '_')}`;
    const accRec  = _getAcc()[sport];
    const voted   = accRec && accRec.records && (pKey in accRec.records);

    return `
<div class="player-prop-card${isLive ? ' card-live' : ''}">

  <!-- Header -->
  <div class="prop-card-top">
    <div class="flex items-center gap-2.5 min-w-0">
      <div class="player-avatar ${_colorBg(data.colorName)}">${initials}</div>
      <div class="min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-white font-semibold text-sm">${player.name}</span>
          ${isLive ? '<span class="live-badge"><span class="live-dot-sm"></span>EN VIVO</span>' : ''}
        </div>
        <p class="text-gray-500 text-xs">${player.team} &bull; ${player.isHome ? 'Local' : 'Visitante'} &bull; Def. rk #${player.opponentRank}</p>
        ${odds && odds.game ? `<p class="text-gray-600 text-xs truncate">${odds.game}</p>` : ''}
      </div>
    </div>
    <div class="shrink-0 text-right">
      <div class="probability-badge ${meta.cls}">
        <span>${meta.icon}</span><span class="font-black text-base">${prob}%</span>
      </div>
      <p class="text-gray-500 text-xs mt-0.5">${meta.label}</p>
    </div>
  </div>

  <!-- Stats grid -->
  <div class="prop-stats-grid">
    <div class="prop-stat-box">
      <p class="prop-stat-label">Prom. Temp.</p>
      <p class="prop-stat-val text-white">${player.avg}<span class="prop-stat-unit"> ${data.unit}</span></p>
    </div>
    <div class="prop-stat-box">
      <p class="prop-stat-label">${hasOdds ? 'Línea DK' : 'Línea'}</p>
      <p class="prop-stat-val text-cyan-400">${dispLine}<span class="prop-stat-unit"> ${data.unit}</span></p>
    </div>
    <div class="prop-stat-box">
      <p class="prop-stat-label">Últ.5 Prom.</p>
      <p class="prop-stat-val text-purple-400">${last5avg}<span class="prop-stat-unit"> ${data.unit}</span></p>
    </div>
    <div class="prop-stat-box">
      <p class="prop-stat-label">Edge</p>
      <p class="prop-stat-val ${positive ? 'text-emerald-400' : 'text-red-400'}">${positive ? '+' : ''}${edgePct}%</p>
    </div>
  </div>

  <!-- Live odds row (DK vs FD) -->
  ${hasOdds ? `
  <div class="odds-compare-row">
    <span class="odds-label">Over Odds</span>
    ${hasDK ? `<div class="odds-chip dk"><span class="bm-label">DK</span><span class="odds-price ${odds.dk.price < 0 ? 'neg' : 'pos'}">${_fmtOdds(odds.dk.price)}</span></div>` : ''}
    ${hasFU ? `<div class="odds-chip fu"><span class="bm-label">FD</span><span class="odds-price ${odds.fu.price < 0 ? 'neg' : 'pos'}">${_fmtOdds(odds.fu.price)}</span></div>` : ''}
    <span class="odds-source">via The Odds API</span>
  </div>` : ''}

  <!-- Trend dots -->
  <div class="mb-3">
    <p class="text-gray-500 text-xs mb-1.5">Últimos 5 partidos vs. línea:</p>
    <div class="flex gap-1.5">${_trendDots(player.last5, player.line, data.unit)}</div>
  </div>

  <!-- Probability bar -->
  <div class="prob-bar-track mb-3">
    <div class="prob-bar-fill ${meta.cls}" style="width:${prob}%"></div>
  </div>

  <!-- Feedback -->
  <div class="feedback-row" data-fkey="${pKey}">
    ${voted
      ? `<span class="fb-confirmed"><i class="fas fa-check-circle mr-1"></i>Reportado — gracias por mejorar el algoritmo.</span>`
      : `<span class="fb-label">¿Se cumplió el pronóstico?</span>
         <button class="feedback-btn yes" onclick="SportsDashboard.recordFeedback('${sport}','${pKey}',true)">
           <i class="fas fa-check mr-1"></i>SÍ
         </button>
         <button class="feedback-btn no" onclick="SportsDashboard.recordFeedback('${sport}','${pKey}',false)">
           <i class="fas fa-times mr-1"></i>NO
         </button>`
    }
  </div>

  <!-- Bottom actions -->
  <div class="card-actions">
    <button class="save-pick-btn${isPremium() ? ' premium' : ''}"
      data-p-name="${player.name}" data-p-team="${player.team}"
      data-p-sport="${sport}" data-p-line="${dispLine}" data-p-prob="${prob}"
      onclick="SportsDashboard.savePick(this)">
      <i class="fas ${isPremium() ? 'fa-bookmark' : 'fa-lock'} mr-1"></i>
      ${isPremium() ? 'Guardar Pick' : 'Guardar (Premium)'}
    </button>
    <a href="${DK_REFERRAL}" target="_blank" rel="noopener noreferrer sponsored" class="dk-mini-cta">
      <i class="fas fa-external-link-alt mr-1"></i>Apostar en DK
    </a>
  </div>
</div>`;
  }

  // ── DraftKings Referral Banner (Jackpocket-style) ──────────────────────────
  function _dkBanner() {
    return `
<div class="dk-referral-banner" role="complementary" aria-label="DraftKings referral">
  <div class="dk-banner-glow-tr"></div>
  <div class="dk-banner-glow-bl"></div>
  <div class="dk-banner-inner">
    <div class="dk-banner-left">
      <div class="dk-icon-box">
        <i class="fas fa-football-ball text-white text-xl"></i>
      </div>
      <div>
        <p class="dk-banner-headline">¿Listo para apostar? <span class="dk-headline-badge">NY</span></p>
        <p class="dk-banner-sub">Usa mi enlace en DraftKings y obtén tu bono de bienvenida</p>
      </div>
    </div>
    <div class="dk-bonus-box">
      <p class="dk-bonus-amount">$200</p>
      <p class="dk-bonus-label">en bonos</p>
    </div>
  </div>
  <div class="dk-steps">
    <div class="dk-step"><span class="dk-step-num">1</span><p>Regístrate con el enlace</p></div>
    <div class="dk-step"><span class="dk-step-num">2</span><p>Haz tu primer depósito</p></div>
    <div class="dk-step"><span class="dk-step-num">3</span><p>¡Recibe tu bono!</p></div>
  </div>
  <a href="${DK_REFERRAL}" target="_blank" rel="noopener noreferrer sponsored"
     class="dk-banner-cta-btn" onclick="this.textContent='Abriendo DraftKings…'">
    <i class="fas fa-external-link-alt mr-2"></i>
    Reclamar Bono en DraftKings NY
    <i class="fas fa-chevron-right ml-2 text-xs"></i>
  </a>
  <p class="dk-banner-legal">Enlace de referido · 21+ · Solo NY · Consulta T&amp;C · Juega responsablemente</p>
</div>`;
  }

  // ── View: Player Props ─────────────────────────────────────────────────────
  async function _renderProps(sport) {
    const container = document.getElementById('sports-view-content');
    if (!container) return;
    const data = SPORTS_DATA[sport];

    // Attempt live odds fetch
    const apiKey = window.ODDS_API_KEY || localStorage.getItem('odds_api_key');
    let sourceLive  = false;
    let sourceLabel = 'Demo Data · configura tu API key para datos reales';

    if (apiKey && !liveOddsCache[sport]) {
      container.innerHTML = `<div class="flex items-center justify-center gap-3 py-12 text-gray-400">
        <div class="loading-spinner"></div><span>Cargando cuotas de DraftKings y FanDuel…</span>
      </div>`;
      const odds = await fetchLiveOdds(sport);
      if (odds && Object.keys(odds).length > 0) {
        liveOddsCache[sport] = odds;
        sourceLive  = true;
        sourceLabel = 'The Odds API · DraftKings &amp; FanDuel NY';
      }
    } else if (liveOddsCache[sport]) {
      sourceLive  = true;
      sourceLabel = 'The Odds API · DraftKings &amp; FanDuel NY';
    }

    // Sort by probability desc; inject DK banner after 3rd card
    const sorted = data.players
      .map(p => ({ ...p, _prob: calcProb(p) }))
      .sort((a, b) => b._prob - a._prob);

    const cards = sorted.map((p, i) =>
      _renderCard(p, data, sport) + (i === 2 ? _dkBanner() : '')
    ).join('');

    container.innerHTML = `
<!-- Algorithm accuracy strip -->
<div class="accuracy-strip">
  <div class="accuracy-strip-header">
    <span class="accuracy-strip-title">
      <i class="fas fa-bullseye mr-1.5 text-emerald-400"></i>Efectividad del Algoritmo
    </span>
    <span class="accuracy-strip-hint">Basado en tus reportes de pronósticos</span>
  </div>
  <div id="algo-accuracy-row" class="flex flex-wrap gap-2 mt-2"></div>
</div>

<!-- Section header -->
<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
  <div>
    <h3 class="text-white font-bold text-base sm:text-lg">
      <i class="${data.icon} mr-2 ${_colorText(data.colorName)}"></i>${sport} &mdash; ${data.metric} Props
    </h3>
    <p class="text-gray-500 text-xs mt-0.5">Rendimiento histórico vs. línea oficial &bull; Probabilidad de superar la apuesta (Over)</p>
  </div>
  <div class="api-status-badge${sourceLive ? ' live' : ''}">
    <span class="live-dot"></span>${sourceLabel}
  </div>
</div>

<!-- Cards -->
<div class="space-y-3">${cards}</div>

<!-- Sources footer -->
<div class="mt-4 p-3 rounded-xl border border-gray-700/50 bg-gray-900/60 text-xs text-gray-500">
  <i class="fas fa-info-circle mr-1 text-blue-400"></i>
  <strong class="text-gray-400">Tiempo real:</strong> The Score App &bull;
  <strong class="text-gray-400">Money flow:</strong> Action Network &bull;
  <strong class="text-gray-400">Cuotas:</strong> The Odds API
</div>`;

    _renderAccRow();
  }

  // ── View: En Vivo / API Config ─────────────────────────────────────────────
  function _renderLive() {
    const container = document.getElementById('sports-view-content');
    if (!container) return;
    const saved = localStorage.getItem('odds_api_key') || '';
    container.innerHTML = `
<div class="max-w-md mx-auto py-6">
  <div class="text-center mb-6">
    <div class="text-5xl mb-3">📡</div>
    <h3 class="text-white font-bold text-lg">Cuotas en Tiempo Real</h3>
    <p class="text-gray-400 text-sm mt-1 leading-relaxed">
      Con tu clave de <strong class="text-yellow-400">The Odds API</strong> las tarjetas
      muestran líneas reales de <strong class="text-white">DraftKings</strong> y
      <strong class="text-white">FanDuel</strong> para el mercado de NY.
    </p>
  </div>

  <!-- API key form -->
  <div class="api-key-form mb-6">
    <label class="block text-gray-300 text-xs font-semibold uppercase tracking-wide mb-1.5">
      <i class="fas fa-key mr-1 text-yellow-400"></i>Clave The Odds API
    </label>
    <div class="flex gap-2 mb-1.5">
      <input id="odds-api-key-input" type="password"
        placeholder="Pegar key aquí…" value="${saved}"
        class="flex-1 px-3 py-2.5 rounded-lg bg-gray-800 text-white border border-gray-600
               focus:border-cyan-500 focus:outline-none text-sm font-mono">
      <button onclick="SportsDashboard.saveApiKey()"
        class="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold transition-colors whitespace-nowrap">
        Guardar
      </button>
    </div>
    <p class="text-gray-600 text-xs"><i class="fas fa-lock mr-1"></i>Solo se guarda en tu navegador. Nunca se envía a nuestros servidores.</p>
  </div>

  <!-- Partner apps -->
  <p class="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3 text-center">También recomendamos</p>
  <div class="grid grid-cols-3 gap-3 mb-6">
    <div class="live-source-card"><i class="fas fa-tv text-blue-400 text-xl mb-1.5 block"></i><p class="text-white font-semibold text-sm">ESPN</p><p class="text-gray-500 text-xs">Scores en vivo</p></div>
    <div class="live-source-card"><i class="fas fa-mobile-alt text-green-400 text-xl mb-1.5 block"></i><p class="text-white font-semibold text-sm">The Score</p><p class="text-gray-500 text-xs">Push alerts</p></div>
    <div class="live-source-card"><i class="fas fa-chart-line text-purple-400 text-xl mb-1.5 block"></i><p class="text-white font-semibold text-sm">Action Net</p><p class="text-gray-500 text-xs">Money flow</p></div>
  </div>

  ${_dkBanner()}
</div>`;
  }

  // ── View: Standings ────────────────────────────────────────────────────────
  function _renderStandings(sport) {
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
        <th class="text-left px-4 py-3">#</th><th class="text-left px-4 py-3">Equipo</th>
        <th class="px-4 py-3">W</th><th class="px-4 py-3">L</th>
        <th class="px-4 py-3">PCT</th><th class="px-4 py-3">GB</th><th class="px-4 py-3">Div.</th>
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
<p class="text-gray-600 text-xs mt-2 text-right"><i class="fas fa-info-circle mr-1"></i>Datos de muestra &bull; Conecta con API para datos reales</p>`;
  }

  // ─── Public interface ──────────────────────────────────────────────────────
  function renderCurrentView() {
    if (currentView === 'props')      _renderProps(currentSport);
    else if (currentView === 'live')  _renderLive();
    else if (currentView === 'standings') _renderStandings(currentSport);
  }

  function switchSport(sport) {
    currentSport = sport;
    document.querySelectorAll('.sport-tab').forEach(b => b.classList.toggle('active', b.dataset.sport === sport));
    renderCurrentView();
  }

  function switchView(view) {
    currentView = view;
    document.querySelectorAll('.sport-view-tab').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    renderCurrentView();
  }

  function saveApiKey() {
    const inp = document.getElementById('odds-api-key-input');
    if (!inp || !inp.value.trim()) return;
    const key = inp.value.trim();
    localStorage.setItem('odds_api_key', key);
    window.ODDS_API_KEY = key;
    liveOddsCache = {};   // clear cache so next render fetches fresh
    const btn = inp.nextElementSibling;
    if (btn) { btn.innerHTML = '<i class="fas fa-check mr-1"></i>Guardado'; setTimeout(() => { btn.textContent = 'Guardar'; }, 2000); }
    switchView('props');  // jump straight to props with live data
  }

  function init() {
    // Restore API key
    const key = localStorage.getItem('odds_api_key');
    if (key) window.ODDS_API_KEY = key;

    // Wire Firebase refs published by app.js
    if (window._db)             window._sportsDb         = window._db;
    if (window._userId)         window._sportsUserId      = window._userId;
    if (window._appId)          window._appId             = window._appId;
    if (window._firestoreModule) window._firestoreHelpers = window._firestoreModule;

    // Build sport tabs
    const tabsEl = document.getElementById('sport-tabs');
    if (tabsEl) {
      tabsEl.innerHTML = Object.entries(SPORTS_DATA).map(([s, d]) =>
        `<button class="sport-tab${s === currentSport ? ' active' : ''}" data-sport="${s}"
           onclick="SportsDashboard.switchSport('${s}')">
           <i class="${d.icon} mr-1"></i>${s}
         </button>`
      ).join('');
    }

    renderCurrentView();
  }

  return {
    init, switchSport, switchView, saveApiKey,
    recordFeedback, savePick,
    showPremiumModal, hidePremiumModal, activatePremium,
    encryptBet, decryptBet,
  };
})();

window.SportsDashboard = SportsDashboard;
