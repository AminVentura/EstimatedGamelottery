/**
 * Sports Intelligence Dashboard v3
 * Merged: multi-agent architecture (v2) + 4-factor probability engine +
 *         Standings view + Live/Sources view + native AES-256-GCM (PR)
 *
 * Agents:
 *   StorageAgent   — native Web Crypto AES-256-GCM, localStorage wrappers
 *   DataAgent      — The Odds API fetch with 30-min in-memory cache
 *   AnalysisAgent  — 4-factor probability, insights, money direction
 *   FeedbackAgent  — accuracy tracking, confidence tiers
 *   ParlayAgent    — leg management, combined prob, implied odds
 *   UIAgent        — all DOM rendering (Props, Live, Standings, Parlay)
 *   OrchestratorAgent — state, init, sport/view switching
 */
(function () {
  'use strict';

  // ── CONSTANTS ────────────────────────────────────────────────────────────
  var DK_LINK   = 'https://sportsbook.draftkings.com/r/sb/aminventura17/US-NY-SB/US-NY-SB';
  var CACHE_TTL = 30 * 60 * 1000;
  var SPORT_MARKETS = {
    NBA: [
      { key: 'nba_points', label: 'Puntos', unit: 'pts' },
      { key: 'nba_pra', label: 'Puntos + Rebotes + Asistencias', unit: 'PRA' },
      { key: 'nba_race_20', label: 'Carrera a 20 Puntos', unit: 'hit' }
    ],
    MLB: [
      { key: 'mlb_strikeouts', label: 'Ponches (K)', unit: 'K' },
      { key: 'mlb_earned_runs', label: 'Carreras Limpias Permitidas', unit: 'ER' },
      { key: 'mlb_hits', label: 'Hits Totales', unit: 'H' },
      { key: 'mlb_total_bases', label: 'Total de Bases', unit: 'TB' },
      { key: 'mlb_first_hr', label: 'Primer Home Run', unit: 'HR' },
      { key: 'mlb_first_inning_run', label: 'Carrera en 1er Inning', unit: 'R' },
      { key: 'mlb_run_line', label: 'Run Line (Hándicap)', unit: 'RL' },
      { key: 'mlb_total_runs', label: 'Total de Carreras', unit: 'R' }
    ],
    NFL: [
      { key: 'nfl_receiving_yards', label: 'Yardas Recepción', unit: 'yds' },
      { key: 'nfl_td_anytime', label: 'Touchdown en cualquier momento', unit: 'TD' },
      { key: 'nfl_touchdown_any_moment', label: 'Touchdown Any Moment', unit: 'TD' }
    ]
  };
  var MARKET_KEY_ALIASES = {
    nfl_td_any_moment: 'nfl_td_anytime',
    nfl_td_anytime: 'nfl_td_anytime'
  };

  // ── DEMO DATA ─────────────────────────────────────────────────────────────
  // Each player includes: avg, line, last5[], opponentRank, isHome, lineDelta, hot
  var SPORTS_DATA = {
    NBA: {
      icon: 'fas fa-basketball-ball', colorName: 'orange',
      metric: 'Puntos', unit: 'pts',
      players: [
        { id:'ld_pts', name:'Luka Dončić',           team:'DAL', avg:33.8, line:32.5, last5:[38,29,35,31,36], opponentRank:7,  isHome:false, lineDelta:+1.0, hot:true  },
        { id:'jt_pts', name:'Jayson Tatum',           team:'BOS', avg:28.5, line:26.5, last5:[31,29,30,27,33], opponentRank:18, isHome:true,  lineDelta:+0.5, hot:true  },
        { id:'ga_pts', name:'Giannis Antetokounmpo',  team:'MIL', avg:30.5, line:29.5, last5:[33,28,32,25,34], opponentRank:16, isHome:true,  lineDelta:+1.0, hot:false },
        { id:'sc_ast', name:'Stephen Curry',          team:'GSW', avg:28.1, line:27.5, last5:[31,24,29,33,23], opponentRank:12, isHome:false, lineDelta: 0,   hot:false },
        { id:'nj_reb', name:'Nikola Jokić',           team:'DEN', avg:26.4, line:25.0, last5:[30,27,24,31,20], opponentRank:22, isHome:true,  lineDelta: 0,   hot:false },
        { id:'lj_pts', name:'LeBron James',           team:'LAL', avg:25.3, line:24.5, last5:[28,22,31,19,26], opponentRank:18, isHome:true,  lineDelta:-0.5, hot:false },
      ]
    },
    MLB: {
      icon: 'fas fa-baseball-ball', colorName: 'blue',
      metric: 'Ponches (K)', unit: 'K',
      players: [
        { id:'ss_k',  name:'Spencer Strider', team:'ATL', avg:10.1, line:9.5,  last5:[11,9,12,8,10], opponentRank:21, isHome:false, lineDelta: 0,   hot:false },
        { id:'gc_k',  name:'Gerrit Cole',     team:'NYY', avg:9.2,  line:8.5,  last5:[10,8,11,9,7],  opponentRank:14, isHome:true,  lineDelta: 0,   hot:false },
        { id:'ms_k',  name:'Max Scherzer',    team:'TEX', avg:8.6,  line:7.5,  last5:[10,9,9,8,10],  opponentRank:8,  isHome:false, lineDelta:-0.5, hot:true  },
        { id:'zw_k',  name:'Zack Wheeler',    team:'PHI', avg:8.3,  line:7.5,  last5:[9,7,10,8,8],   opponentRank:6,  isHome:true,  lineDelta: 0,   hot:false },
        { id:'js_tb', name:'Juan Soto',       team:'NYY', avg:2.1,  line:1.5,  last5:[3,2,2,1,3],    opponentRank:19, isHome:true,  lineDelta:+0.5, hot:true  },
        { id:'ff_h',  name:'Freddie Freeman', team:'LAD', avg:1.3,  line:1.5,  last5:[1,2,1,1,2],    opponentRank:11, isHome:false, lineDelta: 0,   hot:false },
      ]
    },
    NFL: {
      icon: 'fas fa-football-ball', colorName: 'green',
      metric: 'Yardas Recepción', unit: 'yds',
      players: [
        { id:'jj_rec', name:'Justin Jefferson',   team:'MIN', avg:89.2,  line:82.5,  last5:[95,78,103,71,98],  opponentRank:8,  isHome:true,  lineDelta: 0,   hot:true  },
        { id:'th_yds', name:'Tyreek Hill',         team:'MIA', avg:74.3,  line:70.0,  last5:[82,68,91,55,75],   opponentRank:19, isHome:false, lineDelta:+3.5, hot:false },
        { id:'ja_yds', name:'Josh Allen',          team:'BUF', avg:285.3, line:275.5, last5:[302,269,291,258,306], opponentRank:14, isHome:true,lineDelta:-5.0, hot:false },
        { id:'cm_yds', name:'Christian McCaffrey', team:'SF',  avg:92.1,  line:85.5,  last5:[101,88,96,79,104], opponentRank:6,  isHome:false, lineDelta:+2.5, hot:true  },
        { id:'sd_rec', name:'Stefon Diggs',         team:'HOU', avg:71.4,  line:68.0,  last5:[77,64,82,58,76],   opponentRank:5,  isHome:true,  lineDelta: 0,   hot:false },
        { id:'da_yds', name:'Davante Adams',        team:'LVR', avg:68.5,  line:65.5,  last5:[73,61,79,58,71],   opponentRank:14, isHome:true,  lineDelta:-2.5, hot:false },
      ]
    }
  };

  var STANDINGS = {
    NBA: [
      { team:'Boston Celtics',          w:38, l:11, pct:'.776', gb:'—',  conf:'E1' },
      { team:'Oklahoma City Thunder',   w:35, l:14, pct:'.714', gb:'—',  conf:'W1' },
      { team:'Cleveland Cavaliers',     w:33, l:16, pct:'.673', gb:'5',  conf:'E2' },
      { team:'Denver Nuggets',          w:31, l:18, pct:'.633', gb:'4',  conf:'W2' },
      { team:'Minnesota Timberwolves',  w:29, l:20, pct:'.592', gb:'6',  conf:'W3' },
      { team:'New York Knicks',         w:28, l:21, pct:'.571', gb:'10', conf:'E3' },
    ],
    MLB: [
      { team:'Los Angeles Dodgers',   w:98, l:64, pct:'.605', gb:'—',  conf:'NL W' },
      { team:'New York Yankees',      w:92, l:70, pct:'.568', gb:'—',  conf:'AL E' },
      { team:'Baltimore Orioles',     w:91, l:71, pct:'.562', gb:'1',  conf:'AL E' },
      { team:'Atlanta Braves',        w:89, l:73, pct:'.549', gb:'9',  conf:'NL E' },
      { team:'Philadelphia Phillies', w:90, l:72, pct:'.556', gb:'8',  conf:'NL E' },
      { team:'Houston Astros',        w:87, l:75, pct:'.537', gb:'4',  conf:'AL W' },
    ],
    NFL: [
      { team:'Baltimore Ravens',      w:13, l:4, pct:'.765', gb:'—',  conf:'AFC N' },
      { team:'San Francisco 49ers',   w:12, l:5, pct:'.706', gb:'—',  conf:'NFC W' },
      { team:'Dallas Cowboys',        w:12, l:5, pct:'.706', gb:'—',  conf:'NFC E' },
      { team:'Kansas City Chiefs',    w:11, l:6, pct:'.647', gb:'2',  conf:'AFC W' },
      { team:'Philadelphia Eagles',   w:11, l:6, pct:'.647', gb:'1',  conf:'NFC E' },
      { team:'Miami Dolphins',        w:11, l:6, pct:'.647', gb:'2',  conf:'AFC E' },
    ],
  };

  var PARLAY_HUB_MOCK = {
    generatedAt: 'demo',
    parlays: [
      {
        id: 'duelo-de-ases',
        title: 'Duelo de Ases',
        sport: 'MLB',
        startsAt: Date.now() + (25 * 60 * 1000),
        popularity: 96,
        confidence: 74,
        tags: ['Popular', 'Pitcher Focus'],
        propsByCategory: {
          Pitcher: [
            { label: 'G. Cole O 7.5 K', edge: '+8.2%' },
            { label: 'S. Strider O 6.5 K', edge: '+7.5%' }
          ],
          Batter: [
            { label: 'J. Soto O 1.5 TB', edge: '+6.0%' }
          ],
          Game: [
            { label: 'NYY vs BOS O 8.0 Runs', edge: '+4.9%' }
          ]
        },
        javiStats: [
          'Últimas 10 aperturas: 7/10 por encima de la línea',
          'Bullpen rival top-10 en ERA permitió tráfico temprano',
          'Clima favorable al over (+8 mph hacia RF)'
        ]
      },
      {
        id: 'cruz-control',
        title: 'Cruz Control',
        sport: 'NFL',
        startsAt: Date.now() + (65 * 60 * 1000),
        popularity: 88,
        confidence: 69,
        tags: ['Next to start', 'QB + RB'],
        propsByCategory: {
          'NFL QB': [
            { label: 'J. Allen O 274.5 Pass Yds', edge: '+5.8%' }
          ],
          'NFL RB': [
            { label: 'C. McCaffrey O 84.5 Rush+Rec', edge: '+6.6%' }
          ],
          Game: [
            { label: 'BUF @ SF O 47.5', edge: '+4.1%' }
          ]
        },
        javiStats: [
          'Defensa rival permite 7.2 yds por intento en play-action',
          'RB con 78% de snaps en red zone en últimos 3 juegos',
          'Correlación histórica positiva entre ritmo y over total'
        ]
      }
    ]
  };

  /** Abbrev → substring match en filas de clasificación (Firestore o demo) */
  var TEAM_STANDINGS_HINTS = {
    NBA: { DAL: 'Dallas', BOS: 'Boston', MIL: 'Milwaukee', GSW: 'Golden', DEN: 'Denver', LAL: 'Lakers' },
    MLB: { ATL: 'Atlanta', NYY: 'Yankees', TEX: 'Texas', PHI: 'Philadelphia', LAD: 'Dodgers' },
    NFL: { MIN: 'Minnesota', MIA: 'Miami', BUF: 'Buffalo', SF: 'Francisco', HOU: 'Houston', LVR: 'Raiders' },
  };

  function parseStandingsPct(row) {
    var p = row.pct;
    if (p == null) return 0.52;
    if (typeof p === 'number') return p <= 1 ? p : p / 100;
    var s = String(p).replace(/[^0-9.]/g, '');
    if (s.charAt(0) === '.') s = '0' + s;
    var n = parseFloat(s);
    return isNaN(n) ? 0.52 : (n <= 1 ? n : n / 100);
  }

  function teamPctFromStandingsRows(abbr, sport, rows) {
    if (!rows || !rows.length) return 0.52;
    var hints = TEAM_STANDINGS_HINTS[sport] || {};
    var needle = String(hints[abbr] || abbr).toLowerCase();
    for (var i = 0; i < rows.length; i++) {
      var t = String(rows[i].team || '').toLowerCase();
      if (t.indexOf(needle) !== -1) return parseStandingsPct(rows[i]);
    }
    return 0.52;
  }

  function asParlayHubTimestamp(value, fallbackMs) {
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'string') {
      var parsed = Date.parse(value);
      if (!isNaN(parsed)) return parsed;
    }
    return Date.now() + (fallbackMs || 0);
  }

  function formatParlayHubStart(ts) {
    var date = new Date(ts);
    return date.toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' });
  }

  function minutesToStart(ts) {
    return Math.max(0, Math.round((ts - Date.now()) / 60000));
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function parseNumericSafe(value, fallback) {
    var n = Number(value);
    return isNaN(n) ? fallback : n;
  }

  function normalizeConfidence10(value) {
    var n = Number(value);
    if (!isFinite(n)) return 6;
    if (n > 10) n = n / 10;
    return Math.max(1, Math.min(10, Math.round(n)));
  }

  function buildAgentPlayFallbackFromParlay(parlay) {
    if (!parlay) {
      return {
        title: 'No hay jugada confirmada',
        explanation: 'Usando selección local mientras llega la predicción del agente.',
        confidence10: 6,
      };
    }
    var firstCat = Object.keys(parlay.propsByCategory || {})[0];
    var firstList = firstCat ? (parlay.propsByCategory[firstCat] || []) : [];
    var firstPick = firstList[0];
    var pickText = firstPick && (firstPick.label || firstPick) ? (firstPick.label || firstPick) : parlay.title;
    return {
      title: pickText,
      explanation: 'Selección destacada basada en el parlay con mayor tracción actual.',
      confidence10: normalizeConfidence10(parlay.confidence || 60),
    };
  }

  function inferDivisionRank(row) {
    if (!row) return null;
    if (row.divisionRank != null) return parseNumericSafe(row.divisionRank, null);
    if (row.divRank != null) return parseNumericSafe(row.divRank, null);
    if (row.rank != null) return parseNumericSafe(row.rank, null);
    if (row.conf != null) {
      var match = String(row.conf).match(/(\d+)/);
      if (match) return parseNumericSafe(match[1], null);
    }
    return null;
  }

  var PowerRankingUtils = {
    getPct: function (row) {
      var wins = parseNumericSafe(row && row.w, 0);
      var losses = parseNumericSafe(row && row.l, 0);
      var total = wins + losses;
      if (total > 0) return wins / total;
      return parseStandingsPct(row || {});
    },
    getMov: function (row) {
      var rawDiff = parseNumericSafe(
        row && (row.pointDifferential != null ? row.pointDifferential : row.pointDiff),
        0
      );
      return clamp01(rawDiff / 10);
    },
    getSos: function (row) {
      if (!row) return 0.45;
      if (row.sos != null) return clamp01(parseNumericSafe(row.sos, 0.45));
      var rank = inferDivisionRank(row);
      return rank != null ? (rank <= 2 ? 0.85 : 0.45) : 0.45;
    },
    getRating: function (row) {
      var pct = this.getPct(row);
      var sos = this.getSos(row);
      var mov = this.getMov(row);
      var powerScore = (pct * 0.5) + (sos * 0.3) + (mov * 0.2);
      return Math.max(1, Math.min(100, Math.round(powerScore * 100)));
    },
    getTierMeta: function (rating) {
      if (rating >= 90) return { label: 'Elite', cls: 'text-blue-400' };
      if (rating >= 75) return { label: 'Fuerte', cls: 'text-green-400' };
      if (rating >= 50) return { label: 'Promedio', cls: 'text-yellow-400' };
      return { label: 'Débil', cls: 'text-red-400' };
    },
  };

  function initialsFromName(name) {
    return String(name || '')
      .split(' ')
      .map(function (n) { return n ? n.charAt(0).toUpperCase() : ''; })
      .join('')
      .slice(0, 2) || 'PL';
  }

  function avatarGradientFromName(name) {
    var source = String(name || 'player');
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash + source.charCodeAt(i) * (i + 7)) % 360;
    var h2 = (hash + 42) % 360;
    return 'linear-gradient(135deg,hsl(' + hash + ',78%,52%),hsl(' + h2 + ',72%,44%))';
  }

  function buildAvatarUrl(player) {
    var name = encodeURIComponent(player.name || 'Player');
    return 'https://ui-avatars.com/api/?name=' + name + '&background=0f172a&color=f8fafc&size=96&rounded=true&bold=true&format=png';
  }

  function round1(v) { return Math.round(v * 10) / 10; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function seedFromText(text) {
    var s = String(text || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 3)) % 997;
    return h;
  }
  function normalizeMarketKey(sport, key) {
    var normalized = MARKET_KEY_ALIASES[key] || key;
    var catalog = SPORT_MARKETS[sport] || [];
    var exists = catalog.some(function (m) { return m.key === normalized; });
    return exists ? normalized : (catalog[0] ? catalog[0].key : normalized);
  }
  function getSelectedMarket(sport) {
    var selected = OrchestratorAgent.state.marketBySport[sport];
    var key = normalizeMarketKey(sport, selected);
    var catalog = SPORT_MARKETS[sport] || [];
    return catalog.find(function (m) { return m.key === key; }) || { key: key, label: SPORTS_DATA[sport].metric, unit: SPORTS_DATA[sport].unit };
  }
  function deriveLast10(last5, line, seed, binaryMode) {
    var src = Array.isArray(last5) && last5.length ? last5 : [line, line, line, line, line];
    var out = [];
    for (var i = 0; i < 10; i++) {
      var base = src[i % src.length];
      var wobble = ((seed + i * 17) % 5) - 2;
      var next = binaryMode ? (base > line ? 1 : (wobble > 0 ? 1 : 0)) : round1(Math.max(0, base + wobble * 0.35));
      out.push(next);
    }
    return out;
  }
  function transformPlayerForMarket(player, sport, market) {
    var seed = seedFromText(player.id + '_' + market.key);
    var p = Object.assign({}, player);
    var baseLast5 = Array.isArray(player.last5) && player.last5.length ? player.last5.slice() : [player.line || 0, player.line || 0, player.line || 0, player.line || 0, player.line || 0];
    if (market.key === 'nba_pra') {
      var add = 10 + (seed % 7);
      p.last5 = baseLast5.map(function (v) { return round1(v + add); });
      p.avg = round1(p.last5.reduce(function (a, b) { return a + b; }, 0) / p.last5.length);
      p.line = round1((player.line || p.avg) + add - 1.5);
    } else if (market.key === 'nba_race_20') {
      p.last5 = baseLast5.map(function (v) { return v >= 20 ? 1 : 0; });
      p.avg = round1(p.last5.reduce(function (a, b) { return a + b; }, 0) / p.last5.length);
      p.line = 0.5;
    } else if (market.key === 'mlb_total_bases') {
      p.last5 = baseLast5.map(function (v) { return round1(clamp((v / 3.8) + ((seed % 3) - 1) * 0.2, 0, 6)); });
      p.avg = round1(p.last5.reduce(function (a, b) { return a + b; }, 0) / p.last5.length);
      p.line = round1(clamp(p.avg - 0.3, 0.5, 4.5));
    } else if (market.key === 'mlb_first_hr') {
      p.last5 = baseLast5.map(function (v, i) { return (((seed + i * 13) % 100) < clamp(v * 8, 10, 45)) ? 1 : 0; });
      p.avg = round1(p.last5.reduce(function (a, b) { return a + b; }, 0) / p.last5.length);
      p.line = 0.5;
    } else if (market.key === 'nfl_td_anytime' || market.key === 'nfl_touchdown_any_moment') {
      p.last5 = baseLast5.map(function (v, i) { return (((seed + i * 19) % 100) < clamp(v * 0.65, 20, 80)) ? 1 : 0; });
      p.avg = round1(p.last5.reduce(function (a, b) { return a + b; }, 0) / p.last5.length);
      p.line = 0.5;
    }
    p.marketKey = market.key;
    p.marketLabel = market.label;
    p.marketUnit = market.unit;
    p.last10 = deriveLast10(p.last5, p.line, seed, p.line <= 1);
    return p;
  }

  function buildMlbPlayersFromEvents(events, market) {
    if (!Array.isArray(events) || events.length === 0) return [];
    var map = {
      mlb_strikeouts: { bucket: 'pitcherProps', market: 'strikeouts', unit: 'K' },
      mlb_earned_runs: { bucket: 'pitcherProps', market: 'earned_runs', unit: 'ER' },
      mlb_hits: { bucket: 'batterProps', market: 'hits', unit: 'H' },
      mlb_total_bases: { bucket: 'batterProps', market: 'total_bases', unit: 'TB' },
      mlb_first_inning_run: { bucket: 'gameProps', market: 'first_inning_run', unit: 'R' },
      mlb_run_line: { bucket: 'gameProps', market: 'run_line_home', unit: 'RL' },
      mlb_total_runs: { bucket: 'gameProps', market: 'total_runs', unit: 'R' },
    };
    var target = map[market.key];
    if (!target) return [];

    var rows = [];
    events.forEach(function (ev) {
      var props = Array.isArray(ev[target.bucket]) ? ev[target.bucket] : [];
      props.forEach(function (prop, idx) {
        if (prop.market !== target.market) return;
        var title = prop.player || (((ev.teams && ev.teams.away) || 'AWY') + ' vs ' + ((ev.teams && ev.teams.home) || 'HOME'));
        var line = Number(prop.line);
        var parsedLine = isNaN(line) ? 0.5 : line;
        var simulatedLast5 = [
          round1(Math.max(0, parsedLine - 1)),
          round1(Math.max(0, parsedLine + 0.5)),
          round1(Math.max(0, parsedLine + 1)),
          round1(Math.max(0, parsedLine - 0.5)),
          round1(Math.max(0, parsedLine + 0.2)),
        ];
        var avg = round1(simulatedLast5.reduce(function (a, b) { return a + b; }, 0) / simulatedLast5.length);
        rows.push({
          id: String(ev.eventId || ev.id || 'ev') + '_' + target.market + '_' + idx,
          name: title,
          team: (ev.teams && (ev.teams.home || ev.teams.away)) || 'MLB',
          avg: avg,
          line: parsedLine,
          last5: simulatedLast5,
          opponentRank: 15,
          isHome: true,
          lineDelta: 0,
          hot: avg > parsedLine,
          marketKey: market.key,
          marketLabel: market.label,
          marketUnit: target.unit,
        });
      });
    });
    return rows;
  }

  // ════════════════════════════════════════════════════════════════════════
  // STORAGE AGENT — native AES-256-GCM (Web Crypto API), no external deps
  // ════════════════════════════════════════════════════════════════════════
  var StorageAgent = {
    _getUserId: function () {
      var id = localStorage.getItem('sports_uid');
      if (!id) {
        id = 'u_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
        localStorage.setItem('sports_uid', id);
      }
      return id;
    },

    _deriveKey: async function () {
      var enc = new TextEncoder();
      var raw = await crypto.subtle.importKey('raw', enc.encode(this._getUserId()), 'PBKDF2', false, ['deriveKey']);
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode('sports-v3-salt'), iterations: 100000, hash: 'SHA-256' },
        raw,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    },

    encrypt: async function (obj) {
      try {
        var key = await this._deriveKey();
        var iv  = crypto.getRandomValues(new Uint8Array(12));
        var ct  = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: iv },
          key,
          new TextEncoder().encode(JSON.stringify(obj))
        );
        return JSON.stringify({ iv: Array.from(iv), d: Array.from(new Uint8Array(ct)) });
      } catch (e) { return JSON.stringify(obj); }
    },

    decrypt: async function (stored) {
      if (!stored) return null;
      try {
        var parsed = JSON.parse(stored);
        if (!parsed.iv) return parsed; // plain fallback
        var key  = await this._deriveKey();
        var pt   = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: new Uint8Array(parsed.iv) },
          key,
          new Uint8Array(parsed.d)
        );
        return JSON.parse(new TextDecoder().decode(pt));
      } catch (e) { return null; }
    },

    get: function (key, fallback) {
      try { var v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set: function (key, val) { localStorage.setItem(key, JSON.stringify(val)); },

    getEncrypted: async function (key) {
      var r = await this.decrypt(localStorage.getItem(key));
      return Array.isArray(r) ? r : [];
    },
    setEncrypted: async function (key, val) {
      localStorage.setItem(key, await this.encrypt(val));
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // DATA AGENT — routes through Cloud Function proxy (key never on client)
  // ════════════════════════════════════════════════════════════════════════
  var DataAgent = {
    _cache: {},
    _sessionMap: new Map(),

    _getCached: function (key) {
      var c = this._cache[key];
      if (!c || Date.now() - c.ts > CACHE_TTL) return null;
      return c.data;
    },
    _setCache: function (key, data) { this._cache[key] = { data: data, ts: Date.now() }; },
    _getSession: function (key) {
      var hit = this._sessionMap.get(key);
      if (!hit || Date.now() - hit.ts > CACHE_TTL) return null;
      return hit.data;
    },
    _setSession: function (key, data) {
      this._sessionMap.set(key, { data: data, ts: Date.now() });
    },

    waitFirebaseBridge: async function (maxWaitMs) {
      maxWaitMs = maxWaitMs || 12000;
      var ready = function () {
        return window.firebaseServices && (
          typeof window.firebaseServices.callSportsOdds === 'function' ||
          typeof window.firebaseServices.getSportsOdds === 'function'
        );
      };
      if (ready()) return;
      if (window.firebaseSportsBridgeReady) {
        await Promise.race([
          window.firebaseSportsBridgeReady,
          new Promise(function (r) { setTimeout(function () { r(false); }, maxWaitMs); }),
        ]);
      }
    },

    fetchOdds: async function (sport) {
      await this.waitFirebaseBridge();
      var ck = 'odds_' + sport;
      var cached = this._getSession(ck) || this._getCached(ck);
      if (cached) return cached;
      if (!window.firebaseServices) return null;
      var callFn = window.firebaseServices.getSportsOdds || window.firebaseServices.callSportsOdds;
      if (typeof callFn !== 'function') return null;
      var data = await callFn(sport);
      if (!data) return null;
      if (data.__rateLimited) return data; // pass error object up to renderProps
      this._setCache(ck, data);
      this._setSession(ck, data);
      return data;
    },

    fetchStandings: async function (sport) {
      await this.waitFirebaseBridge();
      var ck = 'standings_' + sport;
      var cached = this._getSession(ck);
      if (cached) return cached;
      if (!window.firebaseServices || typeof window.firebaseServices.getStandings !== 'function') {
        var fallback = { teams: STANDINGS[sport] || [], updatedAt: null, isDemo: true };
        this._setSession(ck, fallback);
        return fallback;
      }
      try {
        var live = await window.firebaseServices.getStandings(sport);
        var payload = (live && live.teams && live.teams.length)
          ? live
          : { teams: STANDINGS[sport] || [], updatedAt: null, isDemo: true };
        this._setSession(ck, payload);
        return payload;
      } catch (e) {
        var safe = { teams: STANDINGS[sport] || [], updatedAt: null, isDemo: true };
        this._setSession(ck, safe);
        return safe;
      }
    },
    fetchSportsEvents: async function (sport) {
      await this.waitFirebaseBridge();
      var ck = 'sports_events_' + sport;
      var cached = this._getSession(ck);
      if (cached) return cached;
      if (!window.firebaseServices || typeof window.firebaseServices.getSportsEvents !== 'function') {
        return { sport: sport, source: 'none', events: [] };
      }
      try {
        var payload = await window.firebaseServices.getSportsEvents(sport);
        this._setSession(ck, payload);
        return payload;
      } catch (_) {
        return { sport: sport, source: 'error', events: [] };
      }
    },
    fetchAgentPrediction: async function (payload) {
      await this.waitFirebaseBridge();
      var ck = 'agent_prediction_' + JSON.stringify(payload || {});
      var cached = this._getSession(ck);
      if (cached) return cached;
      var output = null;
      var requestedSport = String(payload && payload.sport ? payload.sport : '').toUpperCase();
      var isSupportedPredictionSport = requestedSport === 'MLB' || requestedSport === 'NFL';
      var mlbPlayerId = payload && payload.playerId != null ? String(payload.playerId).trim() : '';
      if (
        mlbPlayerId &&
        payload &&
        payload.source === 'parlayhub' &&
        requestedSport === 'MLB' &&
        window.firebaseServices &&
        typeof window.firebaseServices.getMlbAgentPrediction === 'function'
      ) {
        try {
          output = await window.firebaseServices.getMlbAgentPrediction(payload || {});
        } catch (_) {
          output = null;
        }
      }
      if (!output && isSupportedPredictionSport && window.firebaseServices && typeof window.firebaseServices.getAgentPrediction === 'function') {
        try {
          output = await window.firebaseServices.getAgentPrediction(payload || {});
        } catch (_) {
          output = null;
        }
      }
      var rawParlays = output && Array.isArray(output.parlays) ? output.parlays : [];
      var safeParlays = rawParlays.map(function (row, idx) {
        var startsAt = asParlayHubTimestamp(row.startsAt || row.startTime || row.kickoffAt, (idx + 1) * 45 * 60000);
        return {
          id: row.id || ('agent_' + idx),
          title: row.title || row.name || ('Parlay #' + (idx + 1)),
          sport: row.sport || 'MLB',
          startsAt: startsAt,
          popularity: parseNumericSafe(row.popularity, 70),
          confidence: parseNumericSafe(row.confidence, 60),
          tags: Array.isArray(row.tags) ? row.tags : [],
          propsByCategory: row.propsByCategory || row.props || {},
          javiStats: Array.isArray(row.javiStats) ? row.javiStats : [],
        };
      });
      var agentPlayFromBackend = null;
      if (output && output.prediction && typeof output.prediction === 'object') {
        var pred = output.prediction;
        var cRaw = pred.confidence;
        var c10 = typeof cRaw === 'number' && isFinite(cRaw)
          ? (cRaw <= 1 ? Math.round(cRaw * 10) : normalizeConfidence10(cRaw))
          : 6;
        c10 = Math.max(1, Math.min(10, c10));
        var titleParts = [];
        if (pred.sport) titleParts.push(String(pred.sport));
        if (pred.team) titleParts.push(String(pred.team));
        if (pred.signal) titleParts.push(String(pred.signal));
        agentPlayFromBackend = {
          title: titleParts.length ? titleParts.join(' · ') : 'Señal del agente',
          explanation: pred.gamesAnalyzed
            ? ('Modelo stats_history · ' + pred.gamesAnalyzed + ' partidos en la muestra.')
            : 'Predicción heurística desde stats_history + memoria del agente.',
          confidence10: c10,
        };
      }
      var normalized = {
        generatedAt: output && output.generatedAt ? output.generatedAt : 'live',
        parlays: safeParlays.length ? safeParlays : PARLAY_HUB_MOCK.parlays,
        agentPlay: output && output.agentPlay
          ? output.agentPlay
          : (output && output.topPlay ? output.topPlay : agentPlayFromBackend),
      };
      this._setSession(ck, normalized);
      return normalized;
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // ANALYSIS AGENT — 4-factor probability engine + insights
  // ════════════════════════════════════════════════════════════════════════
  var AnalysisAgent = {
    // Season avg edge + recent form + opponent rank + home advantage
    calculateProbability: function (player) {
      var avg = player.avg, line = player.line, last5 = player.last5;
      var opponentRank = player.opponentRank || 16;
      var isHome = player.isHome || false;

      var edgeNorm  = (avg - line) / (avg * 0.15);
      var baseProb  = 0.5 + Math.max(-0.22, Math.min(0.22, edgeNorm * 0.28));

      var aboveLine  = last5.filter(function (v) { return v > line; }).length;
      var trendBonus = (aboveLine / last5.length - 0.5) * 0.28;

      var oppBonus  = ((opponentRank - 16) / 32) * 0.14;
      var homeBonus = isHome ? 0.03 : -0.01;

      var lineDelta = player.lineDelta || 0;
      var lineSignal = 0;
      if (lineDelta > 0 && avg > line) lineSignal = 0.02;
      if (lineDelta < 0 && avg < line) lineSignal = 0.02;
      if (lineDelta > 0 && avg < line) lineSignal = -0.03;
      if (lineDelta < 0 && avg > line) lineSignal = -0.02;

      var prob = baseProb + trendBonus + oppBonus + homeBonus + lineSignal;
      return Math.round(Math.max(0.26, Math.min(0.82, prob)) * 100);
    },

    getProbabilityMeta: function (prob) {
      if (prob >= 68) return { label: 'Alta',        cls: 'prob-high',        icon: '🔥' };
      if (prob >= 55) return { label: 'Media-Alta',  cls: 'prob-medium-high', icon: '📈' };
      if (prob >= 45) return { label: 'Media',       cls: 'prob-medium',      icon: '⚖️'  };
      return                 { label: 'Baja',        cls: 'prob-low',         icon: '❄️'  };
    },

    getInsight: function (player, prob) {
      var delta = player.lineDelta || 0;
      var aboveLine = player.last5.filter(function (v) { return v > player.line; }).length;
      if (player.hot && prob >= 65) return { text: 'Racha caliente · favorece OVER',            color: 'text-orange-400' };
      if (delta > 1)                return { text: 'Línea +' + delta + ' · dinero hacia OVER',   color: 'text-green-400'  };
      if (delta < -1)               return { text: 'Línea ' + delta + ' · dinero hacia UNDER',   color: 'text-cyan-400'   };
      if (aboveLine >= 4)           return { text: aboveLine + '/5 últimas OVER la línea',        color: 'text-green-400'  };
      if (aboveLine <= 1)           return { text: aboveLine + '/5 últimas OVER · racha fría',    color: 'text-red-400'    };
      return                               { text: aboveLine + '/5 últimas sobre la línea',       color: 'text-gray-400'   };
    },

    moneyDirection: function (lineDelta) {
      if (lineDelta > 0.5)  return { label: 'Dinero: OVER',  icon: '▲', color: 'text-green-400' };
      if (lineDelta < -0.5) return { label: 'Dinero: UNDER', icon: '▼', color: 'text-cyan-400'  };
      return                       { label: 'Línea estable', icon: '—', color: 'text-gray-500'  };
    },

    /** % tickets (público, naranja) vs % volumen institucional (azul); modelo si la API no envía splits */
    sharpMoney: function (player) {
      var h = 0;
      for (var i = 0; i < player.id.length; i++) {
        h = (h + player.id.charCodeAt(i) * (i + 3)) % 151;
      }
      var ld = player.lineDelta || 0;
      var betPct = 44 + (h % 26);
      var tilt = ld > 0.5 ? 12 : ld < -0.5 ? -9 : (h % 10 - 5);
      var moneyPct = Math.max(38, Math.min(86, 52 + tilt + (h % 15)));
      if (moneyPct < betPct - 1) moneyPct = Math.min(88, betPct + 7 + (h % 6));
      return { betPct: betPct, moneyPct: moneyPct };
    },

    combinedParlayProb: function (players) {
      if (!players || !players.length) return 0;
      var self = this;
      return Math.round(players.reduce(function (acc, pl) {
        return acc * (self.calculateProbability(pl) / 100);
      }, 1) * 100);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // FEEDBACK AGENT — accuracy counters, confidence tiers
  // ════════════════════════════════════════════════════════════════════════
  var FeedbackAgent = {
    _data: null,
    getData: function () {
      if (!this._data) {
        this._data = StorageAgent.get('sports_accuracy',
          { NBA: { yes: 0, no: 0 }, MLB: { yes: 0, no: 0 }, NFL: { yes: 0, no: 0 } });
      }
      return this._data;
    },
    record: function (sport, playerId, isYes) {
      // Local counters (instant UI update)
      var d = this.getData();
      if (!d[sport]) d[sport] = { yes: 0, no: 0 };
      if (isYes) d[sport].yes++; else d[sport].no++;
      StorageAgent.set('sports_accuracy', d);
      // Persist to Firestore (duplicate prevention via doc ID in Cloud rules)
      if (window.firebaseServices && window.firebaseServices.saveSportsFeedback) {
        window.firebaseServices.saveSportsFeedback(
          playerId,
          sport,
          isYes ? 'yes' : 'no'
        );
      }
    },
    getPct: function (sport) {
      var d = this.getData()[sport] || { yes: 0, no: 0 };
      var total = d.yes + d.no;
      return total === 0 ? null : Math.round((d.yes / total) * 100);
    },
    getTotalVotes: function () {
      return Object.values(this.getData()).reduce(function (s, d) { return s + (d.yes || 0) + (d.no || 0); }, 0);
    },
    getConfidence: function (sport) {
      var d = this.getData()[sport] || { yes: 0, no: 0 };
      var total = d.yes + d.no;
      if (total < 5)  return 'Insuf.';
      if (total < 20) return 'Baja';
      if (total < 50) return 'Media';
      return 'Alta';
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // PARLAY AGENT — leg management, combined probability, implied odds
  // ════════════════════════════════════════════════════════════════════════
  var ParlayAgent = {
    legs: [],
    MAX: 6,

    toggle: function (player, sport) {
      var idx = this.legs.findIndex(function (l) { return l.id === player.id; });
      if (idx !== -1) {
        this.legs.splice(idx, 1);
      } else if (this.legs.length < this.MAX) {
        this.legs.push(Object.assign({}, player, { _sport: sport }));
      } else {
        UIAgent.flash('Máximo ' + this.MAX + ' legs en un parlay', 'warn');
        return;
      }
      UIAgent.refreshParlayBadges();
    },

    hasLeg: function (id) { return this.legs.some(function (l) { return l.id === id; }); },

    combinedProb: function () {
      if (this.legs.length === 0) return 0;
      return Math.round(
        this.legs.reduce(function (p, l) {
          return p * (AnalysisAgent.calculateProbability(l) / 100);
        }, 1) * 100
      );
    },

    impliedOdds: function () {
      var p = this.combinedProb();
      if (p <= 0 || p >= 100) return 'N/A';
      var am = p >= 50
        ? Math.round(-p / (1 - p / 100))
        : Math.round((100 / p - 1) * 100);
      return (am > 0 ? '+' : '') + am;
    },

    clear: function () {
      this.legs = [];
      UIAgent.refreshParlayBadges();
      if (OrchestratorAgent.state.view === 'parlay') UIAgent.renderView('parlay');
    },

    setLegs: function (playerSportPairs) {
      var self = this;
      this.legs = (playerSportPairs || []).slice(0, this.MAX).map(function (x) {
        return Object.assign({}, x.player, { _sport: x.sport });
      });
      UIAgent.refreshParlayBadges();
      if (OrchestratorAgent.state.view === 'parlay') self.renderParlayIfVisible();
    },

    renderParlayIfVisible: function () {
      if (OrchestratorAgent.state.view === 'parlay') UIAgent.renderParlay();
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // UI AGENT — all DOM rendering
  // ════════════════════════════════════════════════════════════════════════
  var UIAgent = {

    flash: function (text, type) {
      type = type || 'ok';
      var el = document.getElementById('sd_flash');
      if (!el) {
        el = document.createElement('div');
        el.id = 'sd_flash';
        el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;display:none;';
        document.body.appendChild(el);
      }
      var cls = type === 'ok'   ? 'background:#14532d;color:#86efac;border:1px solid #166534'
              : type === 'warn' ? 'background:#713f12;color:#fde68a;border:1px solid #92400e'
              : 'background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b';
      el.setAttribute('style', 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;' +
        'padding:8px 16px;border-radius:10px;font-size:0.75rem;font-weight:600;' + cls);
      el.textContent = text;
      el.style.display = 'block';
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.style.display = 'none'; }, 4000);
    },

    flashHtml: function (html, ms) {
      ms = ms || 5200;
      var el = document.getElementById('sd_flash');
      if (!el) {
        el = document.createElement('div');
        el.id = 'sd_flash';
        document.body.appendChild(el);
      }
      el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;' +
        'max-width:min(420px,92vw);padding:16px 20px;border-radius:14px;font-size:0.82rem;font-weight:600;' +
        'background:linear-gradient(135deg,#0c4a6e,#134e4a);color:#e0f2fe;border:1px solid rgba(52,211,153,0.45);' +
        'box-shadow:0 12px 40px rgba(0,0,0,0.55)';
      el.innerHTML = html;
      el.style.display = 'block';
      clearTimeout(el._t);
      el._t = setTimeout(function () {
        el.style.display = 'none';
        el.innerHTML = '';
      }, ms);
    },

    showRateLimitModal: function (message) {
      var existing = document.getElementById('sd_quota_modal');
      if (existing) { existing.style.display = 'flex'; return; }
      var modal = document.createElement('div');
      modal.id = 'sd_quota_modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;sm:align-items:center;justify-content:center;padding:0 0 0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px)';
      modal.innerHTML = [
        '<div style="background:#0f172a;border:1px solid rgba(234,179,8,0.4);border-radius:20px 20px 0 0;padding:28px 24px 32px;max-width:420px;width:100%;box-shadow:0 -20px 60px rgba(0,0,0,0.6)">',
        '  <div style="width:48px;height:4px;background:#374151;border-radius:2px;margin:0 auto 20px;"></div>',
        '  <div style="text-align:center;margin-bottom:20px">',
        '    <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,rgba(234,179,8,0.2),rgba(245,158,11,0.1));border:1px solid rgba(234,179,8,0.4);margin-bottom:14px">',
        '      <i class="fas fa-bolt" style="color:#fbbf24;font-size:1.5rem"></i>',
        '    </div>',
        '    <h3 style="color:white;font-size:1.1rem;font-weight:900;margin:0 0 8px">Límite de consultas gratuitas</h3>',
        '    <p style="color:#9ca3af;font-size:0.85rem;line-height:1.5;margin:0">' + (message || 'Has alcanzado tu límite gratuito. Actualiza a Pro para consultas ilimitadas.') + '</p>',
        '  </div>',
        '  <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">',
        '    <div style="display:flex;align-items:center;gap:10px;background:#1f2937;border-radius:12px;padding:12px;border:1px solid #374151">',
        '      <i class="fas fa-infinity" style="color:#fbbf24;flex-shrink:0"></i>',
        '      <div><p style="color:white;font-size:0.85rem;margin:0;font-weight:600">Pro: Consultas ilimitadas</p><p style="color:#6b7280;font-size:0.75rem;margin:0">Sin restricciones de cuota por hora</p></div>',
        '    </div>',
        '    <div style="display:flex;align-items:center;gap:10px;background:#1f2937;border-radius:12px;padding:12px;border:1px solid #374151">',
        '      <i class="fas fa-shield-alt" style="color:#818cf8;flex-shrink:0"></i>',
        '      <div><p style="color:white;font-size:0.85rem;margin:0;font-weight:600">Historial cifrado AES-256-GCM</p><p style="color:#6b7280;font-size:0.75rem;margin:0">Tus apuestas guardadas de forma segura</p></div>',
        '    </div>',
        '    <div style="display:flex;align-items:center;gap:10px;background:#1f2937;border-radius:12px;padding:12px;border:1px solid #374151">',
        '      <i class="fas fa-dollar-sign" style="color:#34d399;flex-shrink:0"></i>',
        '      <div><p style="color:white;font-size:0.85rem;margin:0;font-weight:600">Bono exclusivo en DraftKings</p><p style="color:#6b7280;font-size:0.75rem;margin:0">Hasta $1,000 en bono de bienvenida</p></div>',
        '    </div>',
        '  </div>',
        '  <button onclick="SportsDashboard.activatePremium()" style="width:100%;background:linear-gradient(90deg,#d97706,#b45309);color:white;font-weight:800;padding:14px;border-radius:12px;border:none;cursor:pointer;font-size:0.95rem;margin-bottom:10px">',
        '    <i class="fas fa-crown" style="margin-right:6px"></i>Activar Pro · $4.99/mes',
        '  </button>',
        '  <a href="' + DK_LINK + '" target="_blank" rel="noopener noreferrer sponsored"',
        '     style="display:flex;align-items:center;justify-content:center;gap:6px;width:100%;background:linear-gradient(90deg,#15803d,#16a34a);color:white;font-weight:700;padding:12px;border-radius:12px;border:none;cursor:pointer;font-size:0.85rem;text-decoration:none;margin-bottom:10px">',
        '    <i class="fas fa-dollar-sign"></i>Desbloquear bono en DraftKings<i class="fas fa-external-link-alt" style="font-size:0.65rem;margin-left:4px"></i>',
        '  </a>',
        '  <button onclick="document.getElementById(\'sd_quota_modal\').style.display=\'none\'" style="width:100%;background:transparent;color:#6b7280;border:none;cursor:pointer;padding:8px;font-size:0.85rem">',
        '    Continuar en modo gratuito (datos estadísticos)',
        '  </button>',
        '</div>',
      ].join('');
      modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.style.display = 'none';
      });
      document.body.appendChild(modal);
    },

    refreshParlayBadges: function () {
      var cnt = ParlayAgent.legs.length;
      document.querySelectorAll('[data-parlay-id]').forEach(function (btn) {
        var inP = ParlayAgent.hasLeg(btn.getAttribute('data-parlay-id'));
        btn.style.borderColor = inP ? 'rgba(99,102,241,0.8)' : '';
        btn.style.background  = inP ? 'rgba(99,102,241,0.25)' : '';
      });
      var viewTab = document.querySelector('[data-view="parlay"]');
      if (viewTab) {
        viewTab.textContent = cnt > 0 ? ('Parlay (' + cnt + ')') : 'Parlay Builder';
      }
    },

    refreshAccuracyRow: function () {
      ['NBA', 'MLB', 'NFL'].forEach(function (sport) {
        var pct = FeedbackAgent.getPct(sport);
        var el  = document.getElementById('sd_acc_' + sport);
        if (!el) return;
        if (pct === null)   { el.textContent = '— %'; el.className = 'text-sm font-black text-gray-500'; }
        else if (pct >= 65) { el.textContent = pct + '%'; el.className = 'text-sm font-black text-green-400'; }
        else if (pct >= 50) { el.textContent = pct + '%'; el.className = 'text-sm font-black text-yellow-400'; }
        else                { el.textContent = pct + '%'; el.className = 'text-sm font-black text-red-400'; }
      });
    },

    // ── Card rendering ──────────────────────────────────────────────────
    trendDots: function (last5, line) {
      return last5.map(function (v) {
        var over = v > line;
        return '<span class="trend-dot ' + (over ? 'over' : 'under') + '" title="' + v + ' ' + (over ? '▲' : '▼') + ' ' + line + '">' + (over ? '✓' : '✗') + '</span>';
      }).join('');
    },

    l5EmojiRow: function (last5, line) {
      return last5.map(function (v) {
        var over = v > line;
        return '<span title="' + (over ? 'Superó la línea' : 'No superó') + '">' + (over ? '🟢' : '🔴') + '</span>';
      }).join('');
    },
    miniTrendSvg: function (last5, line) {
      if (!Array.isArray(last5) || last5.length === 0 || line == null) {
        return '<div class="text-[10px] text-gray-600">Sin histórico suficiente</div>';
      }
      var points = last5.slice(0, 5);
      while (points.length < 5) points.push(line);
      var minV = Math.min.apply(null, points.concat([line]));
      var maxV = Math.max.apply(null, points.concat([line]));
      var range = Math.max(1, maxV - minV);
      var w = 160;
      var h = 48;
      var pad = 6;
      var plotW = w - pad * 2;
      var plotH = h - pad * 2;
      var coords = points.map(function (v, i) {
        var x = pad + (plotW / 4) * i;
        var y = pad + plotH - ((v - minV) / range) * plotH;
        return [round1(x), round1(y)];
      });
      var polyline = coords.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
      var lineY = round1(pad + plotH - ((line - minV) / range) * plotH);
      return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="w-full h-12" role="img" aria-label="Últimos 5 vs línea">' +
        '<line x1="' + pad + '" y1="' + lineY + '" x2="' + (w - pad) + '" y2="' + lineY + '" stroke="rgba(34,211,238,0.65)" stroke-dasharray="3 3" stroke-width="1.2"></line>' +
        '<polyline points="' + polyline + '" fill="none" stroke="rgba(167,139,250,0.95)" stroke-width="2"></polyline>' +
        coords.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.6" fill="#a78bfa"></circle>'; }).join('') +
        '</svg>';
    },
    recentStreakBars: function (series, line) {
      if (!Array.isArray(series) || series.length === 0) return '<div class="text-[10px] text-gray-600">Sin datos recientes</div>';
      var last10 = series.slice(-10);
      var maxV = Math.max.apply(null, last10.concat([line || 1, 1]));
      return '<div class="flex items-end gap-1 h-10">' + last10.map(function (v) {
        var over = v > line;
        var h = Math.max(14, Math.round((v / maxV) * 100));
        return '<span title="' + v + '" style="height:' + h + '%" class="flex-1 rounded-sm ' + (over ? 'bg-emerald-400/85' : 'bg-gray-600/90') + '"></span>';
      }).join('') + '</div>';
    },
    renderTeamRecentForm: function (rows) {
      if (!rows || rows.length === 0) return '';
      return [
        '<div class="mt-4 rounded-xl border border-gray-700/60 bg-gray-900/50 p-3">',
        '  <p class="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Racha Reciente</p>',
        rows.slice(0, 6).map(function (t) {
          var pct = parseStandingsPct(t);
          var form = [];
          for (var i = 0; i < 10; i++) {
            var pivot = ((seedFromText(t.team) + i * 11) % 100) / 100;
            form.push(pivot < pct ? 1 : 0);
          }
          var wins = form.reduce(function (a, b) { return a + b; }, 0);
          return '<div class="mb-2.5 last:mb-0">' +
            '<div class="flex items-center justify-between text-[11px] mb-1"><span class="text-gray-300 truncate pr-2">' + (t.team || 'Equipo') + '</span><span class="text-gray-500 font-mono">' + wins + '-'+ (10 - wins) + '</span></div>' +
            '<div class="flex gap-1">' + form.map(function (v) { return '<span class="h-2 flex-1 rounded-sm ' + (v ? 'bg-emerald-400/85' : 'bg-gray-700') + '"></span>'; }).join('') + '</div>' +
            '</div>';
        }).join(''),
        '</div>'
      ].join('');
    },

    hydrateLazyAvatars: function () {
      var cards = document.querySelectorAll('.sd-avatar-wrap');
      if (!cards || cards.length === 0) return;

      var applyFallback = function (wrap) {
        if (!wrap || wrap.getAttribute('data-avatar-ready') === '1') return;
        var initials = wrap.getAttribute('data-initials') || 'PL';
        var grad = wrap.getAttribute('data-gradient') || 'linear-gradient(135deg,#1d4ed8,#7c3aed)';
        wrap.setAttribute('data-avatar-ready', '1');
        wrap.style.background = grad;
        wrap.style.color = '#f8fafc';
        wrap.style.fontWeight = '900';
        wrap.style.fontSize = '0.72rem';
        wrap.style.display = 'grid';
        wrap.style.placeItems = 'center';
        wrap.textContent = initials;
      };

      var loadNow = function (wrap) {
        if (!wrap) return;
        var img = wrap.querySelector('img[data-src]');
        if (!img) { applyFallback(wrap); return; }
        var src = img.getAttribute('data-src');
        if (!src) { applyFallback(wrap); return; }
        img.onload = function () {
          wrap.setAttribute('data-avatar-ready', '1');
          wrap.textContent = '';
          img.style.opacity = '1';
        };
        img.onerror = function () { applyFallback(wrap); };
        img.src = src;
        img.removeAttribute('data-src');
      };

      var supportsIO = typeof window.IntersectionObserver === 'function';
      if (!supportsIO) {
        cards.forEach(loadNow);
        return;
      }

      if (this._avatarObserver) this._avatarObserver.disconnect();
      this._avatarObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          loadNow(entry.target);
          observer.unobserve(entry.target);
        });
      }, { rootMargin: '120px 0px', threshold: 0.01 });

      cards.forEach(function (w) { UIAgent._avatarObserver.observe(w); });
    },

    renderCard: function (player, sport) {
      var prob     = AnalysisAgent.calculateProbability(player);
      var meta     = AnalysisAgent.getProbabilityMeta(prob);
      var insight  = AnalysisAgent.getInsight(player, prob);
      var money    = AnalysisAgent.moneyDirection(player.lineDelta || 0);
      var data     = SPORTS_DATA[sport];
      var inParlay = ParlayAgent.hasLeg(player.id);
      var isPrem   = OrchestratorAgent.state.isPremium;

      var over     = player.avg >= player.line;
      var edgePct  = ((player.avg - player.line) / player.line * 100).toFixed(1);
      var last5avg = (player.last5.reduce(function (a, b) { return a + b; }, 0) / player.last5.length).toFixed(1);
      var initials = initialsFromName(player.name);
      var colorMap = { orange: 'bg-orange-600', blue: 'bg-blue-600', green: 'bg-green-600' };
      var avatarBg = colorMap[data.colorName] || 'bg-blue-600';
      var sm = AnalysisAgent.sharpMoney(player);
      var l5Over = player.last5.filter(function (v) { return v > player.line; }).length;
      var avatarGrad = avatarGradientFromName(player.name);
      var avatarSrc = buildAvatarUrl(player);
      var last10 = Array.isArray(player.last10) && player.last10.length ? player.last10 : deriveLast10(player.last5, player.line, seedFromText(player.id), player.line <= 1);

      var lineDeltaHtml = player.lineDelta
        ? ' <span style="font-size:0.7rem;font-weight:700;color:' + (player.lineDelta > 0 ? '#4ade80' : '#22d3ee') + '">' +
          (player.lineDelta > 0 ? '▲' : '▼') + Math.abs(player.lineDelta) + '</span>'
        : '';

      return [
        '<div class="player-prop-card" data-prop-id="' + player.id + '">',

        // top
        '  <div class="prop-card-top">',
        '    <div class="flex items-center gap-2.5 min-w-0">',
        '      <div class="player-avatar sd-avatar-wrap ' + avatarBg + '" data-initials="' + initials + '" data-gradient="' + avatarGrad + '" data-avatar-ready="0">',
        '        <img data-src="' + avatarSrc + '" alt="' + player.name + '" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:9999px;opacity:0;transition:opacity .2s ease" />',
        '      </div>',
        '      <div class="min-w-0">',
        '        <p class="text-white font-semibold text-sm truncate">' + player.name + (player.hot ? ' 🔥' : '') + '</p>',
        '        <p class="text-gray-500 text-xs">' + player.team + ' · ' + (player.isHome ? 'Local' : 'Visitante') + ' · Def. rk #' + player.opponentRank + '</p>',
        '      </div>',
        '    </div>',
        '    <div class="shrink-0 text-right">',
        '      <div class="probability-badge ' + meta.cls + '"><span>' + meta.icon + '</span><span class="font-black text-base">' + prob + '%</span></div>',
        '      <p class="text-gray-500 text-xs mt-0.5">' + meta.label + '</p>',
        '    </div>',
        '  </div>',

        // stats grid
        '  <div class="prop-stats-grid">',
        '    <div class="prop-stat-box"><p class="text-gray-500 text-xs">Prom. Temp.</p><p class="text-white font-bold">' + player.avg + ' <span class="text-gray-500 text-xs">' + data.unit + '</span></p></div>',
        '    <div class="prop-stat-box"><p class="text-gray-500 text-xs">Línea' + lineDeltaHtml + '</p><p class="text-cyan-400 font-bold">' + player.line + ' <span class="text-gray-500 text-xs">' + data.unit + '</span></p></div>',
        '    <div class="prop-stat-box"><p class="text-gray-500 text-xs">Últ.5 Prom.</p><p class="text-purple-400 font-bold">' + last5avg + ' <span class="text-gray-500 text-xs">' + data.unit + '</span></p></div>',
        '    <div class="prop-stat-box"><p class="text-gray-500 text-xs">Edge</p><p class="' + (over ? 'text-emerald-400' : 'text-red-400') + ' font-bold">' + (over ? '+' : '') + edgePct + '%</p></div>',
        '  </div>',

        // Sharp Money (naranja = público, azul = dinero pro)
        '  <div class="mb-3 rounded-xl p-2.5 border border-gray-700/90" style="background:linear-gradient(100deg,rgba(30,64,175,0.2),rgba(154,52,18,0.16))">',
        '    <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Sharp Money · tickets vs. volumen</p>',
        '    <div class="flex justify-between text-xs mb-1.5">',
        '      <span><span style="color:#fdba74;font-weight:800">Público</span> <span class="text-white font-black">' + sm.betPct + '%</span> <span class="text-gray-500">tickets</span></span>',
        '      <span><span style="color:#93c5fd;font-weight:800">Dinero Pro</span> <span class="text-white font-black">' + sm.moneyPct + '%</span></span>',
        '    </div>',
        '    <div class="space-y-1">',
        '      <div class="h-2 rounded bg-gray-800/90 overflow-hidden" title="Participación pública estimada">',
        '        <div class="h-2 rounded" style="width:' + sm.betPct + '%;background:linear-gradient(90deg,#c2410c,#fb923c)"></div>',
        '      </div>',
        '      <div class="h-2 rounded bg-gray-800/90 overflow-hidden" title="Volumen institucional estimado">',
        '        <div class="h-2 rounded" style="width:' + sm.moneyPct + '%;background:linear-gradient(90deg,#1e3a8a,#60a5fa)"></div>',
        '      </div>',
        '    </div>',
        '    <p class="text-[10px] text-gray-500 mt-1.5">Modelo editorial cuando el feed no publica splits oficiales.</p>',
        '  </div>',

        // L5 racha visual
        '  <div class="mb-3">',
        '    <p class="text-gray-500 text-xs mb-1.5 flex flex-wrap items-center gap-2">',
        '      <span class="font-black text-cyan-400/90 tracking-tight">L5</span>',
        '      <span class="text-lg leading-none tracking-tight" title="Últimos 5 juegos vs. línea">' + this.l5EmojiRow(player.last5, player.line) + '</span>',
        '      <span class="text-gray-600 font-mono text-[10px]">(' + l5Over + '/5 sobre línea)</span>',
        '    </p>',
        '    <div class="flex gap-1.5 opacity-80">' + this.trendDots(player.last5, player.line) + '</div>',
        '  </div>',
        '  <div class="mb-3 rounded-xl p-2.5 border border-gray-700/80 bg-gray-900/60">',
        '    <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Historial Visual · L5 vs Línea</p>',
        this.miniTrendSvg(player.last5, player.line),
        '  </div>',
        '  <div class="mb-3 rounded-xl p-2.5 border border-gray-700/80 bg-gray-900/60">',
        '    <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Racha Reciente</p>',
        this.recentStreakBars(last10, player.line),
        '  </div>',

        // insight + money
        '  <div class="flex items-center justify-between mb-3 text-xs">',
        '    <span class="' + insight.color + ' font-semibold truncate">' + insight.text + '</span>',
        '    <span class="' + money.color + ' font-bold shrink-0 ml-2">' + money.icon + ' ' + money.label + '</span>',
        '  </div>',

        // progress bar
        '  <div class="prob-bar-track mb-3"><div class="prob-bar-fill ' + meta.cls + '" style="width:' + prob + '%"></div></div>',

        // DK CTA
        '  <a href="' + DK_LINK + '" target="_blank" rel="noopener noreferrer sponsored"',
        '     class="w-full flex items-center justify-center gap-1.5 mb-2 text-white font-bold text-xs px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95"',
        '     style="background:linear-gradient(90deg,#15803d,#16a34a)">',
        '    <i class="fas fa-dollar-sign" style="font-size:0.65rem"></i>Apostar en DraftKings<i class="fas fa-external-link-alt" style="font-size:0.65rem;margin-left:2px"></i>',
        '  </a>',

        // feedback + save + parlay row
        '  <div class="fb-area flex gap-1 items-center">',
        '    <span class="text-xs text-gray-600 shrink-0">¿Acertó?</span>',
        '    <button onclick="SportsDashboard.feedback(\'' + sport + '\',\'' + player.id + '\',true)" class="flex-1 text-xs py-1 rounded-lg border hover:bg-green-900/40 text-green-400 transition-colors" style="border-color:rgba(22,163,74,0.4)">SÍ</button>',
        '    <button onclick="SportsDashboard.feedback(\'' + sport + '\',\'' + player.id + '\',false)" class="flex-1 text-xs py-1 rounded-lg border hover:bg-red-900/40 text-red-400 transition-colors" style="border-color:rgba(220,38,38,0.4)">NO</button>',
        '    <button onclick="SportsDashboard.saveBet(\'' + sport + '\',\'' + player.id + '\')" data-save-id="' + player.id + '" class="text-xs px-2 py-1 rounded-lg border hover:bg-purple-900/40 text-purple-400 transition-colors" style="border-color:rgba(124,58,237,0.4)" title="' + (isPrem ? 'Guardar apuesta' : 'Premium: Guardar apuesta') + '">',
        '      <i class="fas fa-bookmark" style="font-size:0.7rem"></i>' + (isPrem ? '' : '<i class="fas fa-lock" style="font-size:0.6rem;margin-left:2px"></i>'),
        '    </button>',
        '    <button onclick="SportsDashboard.toggleParlay(\'' + player.id + '\')" data-parlay-id="' + player.id + '" class="text-xs px-2 py-1 rounded-lg border text-blue-400 transition-colors" style="border-color:rgba(59,130,246,0.4)' + (inParlay ? ';background:rgba(99,102,241,0.25);border-color:rgba(99,102,241,0.8)' : '') + '" title="' + (inParlay ? 'Quitar de Parlay' : 'Agregar a Parlay') + '">',
        '      <i class="fas ' + (inParlay ? 'fa-check-circle text-indigo-400' : 'fa-plus-circle') + '" style="font-size:0.7rem"></i>',
        '    </button>',
        '  </div>',
        '</div>',
      ].join('');
    },

    // ── View: Player Props ──────────────────────────────────────────────
    renderProps: async function (sport) {
      var container = document.getElementById('sports-view-content');
      if (!container) return;
      var data    = SPORTS_DATA[sport];
      var market = getSelectedMarket(sport);
      var liveEvents = null;
      if (sport === 'MLB') {
        liveEvents = await DataAgent.fetchSportsEvents('MLB');
      }
      var sourcePlayers = (sport === 'MLB' && liveEvents && Array.isArray(liveEvents.events) && liveEvents.events.length)
        ? buildMlbPlayersFromEvents(liveEvents.events, market)
        : data.players;
      var players = sourcePlayers
        .map(function (p) { return transformPlayerForMarket(p, sport, market); })
        .map(function (p) { return Object.assign({}, p, { _prob: AnalysisAgent.calculateProbability(p) }); })
        .sort(function (a, b) { return b._prob - a._prob; });

      var odds = await DataAgent.fetchOdds(sport);
      var self = this;

      // Rate limit hit → show upgrade modal and proceed with static data
      if (odds && odds.__rateLimited) {
        UIAgent.showRateLimitModal(odds.message);
        odds = null;
      }

      var gameLinesHtml = '';
      if (odds && odds.length > 0) {
        gameLinesHtml = [
          '<div class="mb-4">',
          '  <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">',
          '    <span class="live-dot"></span>Game Lines — DraftKings &amp; FanDuel (live)',
          '  </h4>',
          '  <div class="space-y-1.5">',
          odds.slice(0, 3).map(function (g) {
            var dk  = (g.bookmakers || []).find(function (b) { return b.key === 'draftkings'; });
            var fn  = (g.bookmakers || []).find(function (b) { return b.key === 'fanduel'; });
            var dkM = dk ? (dk.markets || []).find(function (m) { return m.key === 'h2h'; }) : null;
            var fnM = fn ? (fn.markets || []).find(function (m) { return m.key === 'h2h'; }) : null;
            var dkH = dkM ? dkM.outcomes.find(function (o) { return o.name === g.home_team; }) : null;
            var dkA = dkM ? dkM.outcomes.find(function (o) { return o.name === g.away_team; }) : null;
            var fnH = fnM ? fnM.outcomes.find(function (o) { return o.name === g.home_team; }) : null;
            var fnA = fnM ? fnM.outcomes.find(function (o) { return o.name === g.away_team; }) : null;
            return '<div class="bg-gray-900/80 rounded-xl p-3 border border-gray-700/60 text-xs flex items-center justify-between gap-2">' +
              '<span class="text-white font-semibold truncate">' + g.away_team.split(' ').pop() + ' <span class="text-gray-500">vs</span> ' + g.home_team.split(' ').pop() + '</span>' +
              (dkM ? '<a href="' + DK_LINK + '" target="_blank" rel="noopener noreferrer sponsored" class="text-green-400 font-bold hover:underline shrink-0">DK: ' + (dkA ? dkA.price : '?') + '/' + (dkH ? dkH.price : '?') + '</a>' : '') +
              (fnM ? '<span class="text-blue-300 font-bold shrink-0">FD: ' + (fnA ? fnA.price : '?') + '/' + (fnH ? fnH.price : '?') + '</span>' : '') +
              '</div>';
          }).join(''),
          '  </div>',
          '</div>',
        ].join('');
      }

      var accuracyHtml = [
        '<div class="flex flex-wrap gap-2 mb-4">',
        ['NBA','MLB','NFL'].map(function (s) {
          return '<div class="bg-gray-900/80 rounded-xl px-3 py-2 border border-gray-700 text-center">' +
            '<div class="text-gray-500 text-xs uppercase tracking-widest mb-0.5">' + s + '</div>' +
            '<div id="sd_acc_' + s + '" class="text-sm font-black text-gray-500">— %</div>' +
            '<div class="text-xs text-gray-600">' + FeedbackAgent.getConfidence(s) + '</div>' +
            '</div>';
        }).join(''),
        '<div class="bg-gray-900/80 rounded-xl px-3 py-2 border border-gray-700 text-center">',
        '  <div class="text-gray-500 text-xs uppercase tracking-widest mb-0.5">Red Global</div>',
        '  <div class="text-sm font-black text-blue-400">' + FeedbackAgent.getTotalVotes() + '</div>',
        '  <div class="text-xs text-gray-600">votos</div>',
        '</div>',
        '</div>',
      ].join('');

      var remaining = window._sportsQuotaRemaining != null ? window._sportsQuotaRemaining : '?';
      var portalBtn = '';
      if (OrchestratorAgent.state.isPremium && OrchestratorAgent.state.canManageBilling) {
        portalBtn = '<button type="button" onclick="SportsDashboard.openCustomerPortal()" title="Facturas, método de pago y suscripción"' +
          ' class="text-xs font-bold text-cyan-200 bg-cyan-950/60 border border-cyan-600/50 rounded-lg px-2 py-1 hover:bg-cyan-900/70 transition-colors">' +
          '<i class="fas fa-file-invoice-dollar mr-1"></i>Facturación</button>';
      }
      container.innerHTML = [
        accuracyHtml,
        gameLinesHtml,
        '<div class="mb-4 flex flex-wrap items-start justify-between gap-3">',
        '  <div>',
        '    <h3 class="text-white font-bold text-base sm:text-lg"><i class="' + data.icon + ' mr-2 ' + (sport === 'NBA' ? 'text-orange-400' : sport === 'MLB' ? 'text-blue-400' : 'text-green-400') + '"></i>' + sport + ' — ' + market.label + ' Props</h3>',
        '    <p class="text-gray-500 text-xs mt-0.5">Probabilidad estadística vs. línea · Ordenado por probabilidad · Cuotas vía servidor seguro</p>',
        '    <div class="mt-2 inline-flex items-center gap-2 text-xs">',
        '      <span class="text-gray-500 uppercase tracking-wider">Mercado</span>',
        '      <select onchange="SportsDashboard.switchMarket(\'' + sport + '\', this.value)" class="bg-gray-900 text-gray-200 border border-gray-700 rounded-md px-2 py-1 text-xs">',
        (SPORT_MARKETS[sport] || []).map(function (m) {
          return '<option value="' + m.key + '"' + (m.key === market.key ? ' selected' : '') + '>' + m.label + '</option>';
        }).join(''),
        '      </select>',
        '    </div>',
        '  </div>',
        '  <div class="flex items-center gap-2">',
        '    <div class="api-status-badge"><span class="live-dot"></span>API Segura</div>',
        '    <div class="text-xs text-gray-500 bg-gray-900/80 rounded-lg px-2 py-1 border border-gray-700">',
        '      <i class="fas fa-bolt text-yellow-500 mr-1"></i>' + remaining + ' consultas restantes',
        '    </div>',
        portalBtn,
        '  </div>',
        '</div>',
        '<div class="space-y-3">' + players.map(function (p) { return self.renderCard(p, sport); }).join('') + '</div>',
        self.renderDkBanner(),
        '<div id="sd_flash"></div>',
      ].join('');

      this.refreshAccuracyRow();
      this.refreshParlayBadges();
      this.hydrateLazyAvatars();
    },

    // ── DK Banner ──────────────────────────────────────────────────────
    renderDkBanner: function () {
      return [
        '<div class="relative overflow-hidden rounded-2xl mt-5 border mb-1" style="border-color:rgba(34,197,94,0.4);background:linear-gradient(135deg,#0f1f0f,#0a2d0a,#0f1f0f)">',
        '  <div class="relative z-10 p-5">',
        '    <div class="flex items-center justify-between gap-4 mb-3">',
        '      <div class="flex items-center gap-3">',
        '        <div class="rounded-xl p-2.5" style="background:#22c55e;box-shadow:0 0 20px rgba(34,197,94,0.3)"><i class="fas fa-dollar-sign text-white text-lg"></i></div>',
        '        <div><p class="text-green-400 font-black text-base leading-tight">¡Apuesta en DraftKings!</p><p class="text-gray-400 text-xs mt-0.5">Mercado NY · Bono de bienvenida disponible</p></div>',
        '      </div>',
        '      <div class="shrink-0 text-center px-3 py-2 rounded-xl border" style="background:linear-gradient(135deg,#22c55e,#16a34a);border-color:rgba(34,197,94,0.5)"><p class="text-white font-black text-xl leading-none">BONO</p><p class="text-green-100 font-bold text-xs uppercase">bienvenida</p></div>',
        '    </div>',
        '    <a href="' + DK_LINK + '" target="_blank" rel="noopener noreferrer sponsored"',
        '       class="w-full flex items-center justify-center gap-2 text-white font-black text-sm px-6 py-3 rounded-xl transition-all hover:scale-105 active:scale-95"',
        '       style="background:linear-gradient(90deg,#22c55e,#16a34a);box-shadow:0 4px 20px rgba(34,197,94,0.3)">',
        '      <i class="fas fa-dollar-sign"></i>Reclamar Bono en DraftKings<i class="fas fa-arrow-right text-xs ml-1"></i>',
        '    </a>',
        '    <p class="text-gray-600 text-xs mt-2 text-center">Enlace de referido · Solo mayores de 21 años · NY · Juega con responsabilidad.</p>',
        '  </div>',
        '</div>',
      ].join('');
    },

    // ── View: Live / Sources ────────────────────────────────────────────
    renderLive: function () {
      var container = document.getElementById('sports-view-content');
      if (!container) return;
      container.innerHTML = [
        '<div class="text-center py-8">',
        '  <div class="text-5xl mb-4">📡</div>',
        '  <h3 class="text-white font-bold text-lg mb-2">Cuotas en Tiempo Real</h3>',
        '  <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-950/60 border border-green-700/50 text-green-300 text-sm font-semibold mb-4">',
        '    <span class="live-dot"></span>API Conectada — cuotas seguras vía servidor',
        '  </div>',
        '  <p class="text-gray-400 text-sm mb-5 max-w-sm mx-auto">Las cuotas de <strong class="text-yellow-400">DraftKings</strong> y <strong class="text-yellow-400">FanDuel</strong> se obtienen de forma segura desde nuestro servidor. Visita <strong class="text-cyan-400">Player Props</strong> para ver predicciones con cuotas en vivo.</p>',
        '  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md mx-auto">',
        '    <div class="live-source-card"><i class="fas fa-tv text-blue-400 text-lg mb-1.5 block"></i><p class="text-white font-semibold text-sm">ESPN</p><p class="text-gray-500 text-xs">Scores &amp; live stats</p></div>',
        '    <div class="live-source-card"><i class="fas fa-mobile-alt text-green-400 text-lg mb-1.5 block"></i><p class="text-white font-semibold text-sm">The Score</p><p class="text-gray-500 text-xs">Notificaciones push</p></div>',
        '    <div class="live-source-card"><i class="fas fa-chart-line text-purple-400 text-lg mb-1.5 block"></i><p class="text-white font-semibold text-sm">Action Network</p><p class="text-gray-500 text-xs">Tracking de dinero sharp</p></div>',
        '  </div>',
        '</div>',
      ].join('');
    },

    // ── View: Standings ─────────────────────────────────────────────────
    renderStandings: async function (sport) {
      var container = document.getElementById('sports-view-content');
      if (!container) return;

      await DataAgent.waitFirebaseBridge();

      // Loading skeleton
      container.innerHTML = '<div class="text-center py-10 text-gray-500">' +
        '<i class="fas fa-circle-notch fa-spin text-2xl mb-2 block text-emerald-500"></i>' +
        '<p class="text-sm">Cargando clasificación…</p></div>';

      // Try cached Firestore first (updated hourly by Cloud Function from ESPN)
      var live = await DataAgent.fetchStandings(sport);

      // Fall back to static seed data if Firestore has nothing yet
      var rows   = (!live.isDemo && live.teams && live.teams.length > 0) ? live.teams : (STANDINGS[sport] || []);
      var isLive = !live.isDemo && live.teams && live.teams.length > 0;

      var updatedLabel = isLive
        ? '<span class="text-emerald-500">ESPN · ' + (live.updatedAt ? new Date(live.updatedAt).toLocaleTimeString('es-US', {hour:'2-digit',minute:'2-digit'}) : 'recién actualizado') + '</span>'
        : '<span class="text-gray-500">Demo · <button onclick="window.seedStandings&&window.seedStandings().then(()=>SportsDashboard.switchView(\'standings\'))" class="underline hover:text-emerald-400 transition-colors">Cargar datos ESPN ahora</button></span>';
      var rankedRows = rows.slice().map(function (row) {
        var rating = PowerRankingUtils.getRating(row);
        return Object.assign({}, row, { _rating: rating, _tier: PowerRankingUtils.getTierMeta(rating) });
      }).sort(function (a, b) {
        return b._rating - a._rating;
      });

      container.innerHTML = [
        '<div class="flex items-center justify-between mb-3">',
        '  <h3 class="text-white font-bold text-base"><i class="fas fa-trophy mr-2 text-yellow-400"></i>Clasificación — ' + sport + '</h3>',
        '  <span class="text-xs ' + (isLive ? 'text-emerald-400' : 'text-gray-500') + '">' +
          (isLive ? '<span class="live-dot" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10b981;margin-right:4px"></span>En vivo' : 'Demo') +
        '</span>',
        '</div>',
        '<div class="overflow-x-auto rounded-xl border border-gray-700/60">',
        '  <table class="w-full text-sm">',
        '    <thead><tr class="bg-gray-900/80 text-gray-400 text-xs uppercase tracking-wide">',
        '      <th class="text-left px-4 py-3">#</th>',
        '      <th class="text-left px-4 py-3">Equipo</th>',
        '      <th class="px-4 py-3">W</th><th class="px-4 py-3">L</th>',
        '      <th class="px-4 py-3">PCT</th><th class="px-4 py-3">GB</th>',
        '      <th class="px-4 py-3">Div.</th><th class="px-4 py-3">Rating</th><th class="px-4 py-3">Estado</th>',
        '    </tr></thead>',
        '    <tbody class="divide-y divide-gray-700/40">',
        rankedRows.map(function (t, i) {
          return '<tr class="hover:bg-gray-800/50 transition-colors">' +
            '<td class="px-4 py-3 text-gray-500 font-mono text-xs">' + (i + 1) + '</td>' +
            '<td class="px-4 py-3 text-white font-medium">' + (t.team || '?') + '</td>' +
            '<td class="px-4 py-3 text-center text-emerald-400 font-bold">' + (t.w || 0) + '</td>' +
            '<td class="px-4 py-3 text-center text-red-400">' + (t.l || 0) + '</td>' +
            '<td class="px-4 py-3 text-center text-cyan-400 font-mono">' + (t.pct || '—') + '</td>' +
            '<td class="px-4 py-3 text-center text-gray-400">' + (t.gb || '—') + '</td>' +
            '<td class="px-4 py-3 text-center text-yellow-400 font-semibold text-xs">' + (t.conf || '—') + '</td>' +
            '<td class="px-4 py-3 text-center font-black text-white">' + t._rating + '</td>' +
            '<td class="px-4 py-3 text-center font-semibold text-xs ' + t._tier.cls + '">' + t._tier.label + '</td>' +
            '</tr>';
        }).join(''),
        '    </tbody>',
        '  </table>',
        '</div>',
        '<p class="text-xs mt-2 text-right"><i class="fas fa-satellite-dish mr-1"></i>' + updatedLabel + '</p>',
        this.renderTeamRecentForm(rows),
      ].join('');
    },

    // ── View: Parlay Builder ────────────────────────────────────────────
    renderParlay: function () {
      var container = document.getElementById('sports-view-content');
      if (!container) return;
      var legs  = ParlayAgent.legs;
      var prob  = ParlayAgent.combinedProb();
      var odds  = ParlayAgent.impliedOdds();
      var pCls  = prob >= 30 ? 'text-green-400' : prob >= 15 ? 'text-yellow-400' : 'text-red-400';

      if (legs.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-gray-500"><i class="fas fa-layer-group text-4xl mb-3 block opacity-30"></i><p class="font-semibold mb-1">Parlay Builder vacío</p><p class="text-xs">Presiona <i class="fas fa-plus-circle text-blue-400 mx-1"></i>en cualquier tarjeta de Player Props para agregar un leg.</p></div>';
        return;
      }

      container.innerHTML = [
        '<div class="flex flex-col gap-3 mb-4">',
        '  <div class="flex flex-wrap items-center justify-between gap-2">',
        '    <h3 class="text-white font-bold text-base"><i class="fas fa-layer-group mr-2 text-indigo-400"></i>Parlay Builder <span class="text-indigo-400">(' + legs.length + ' legs)</span></h3>',
        '    <div class="flex items-center gap-3">',
        '      <span class="' + pCls + ' font-black text-lg">' + prob + '% · ' + odds + '</span>',
        '      <button onclick="SportsDashboard.clearParlay()" class="text-xs text-gray-500 hover:text-red-400 transition-colors border border-gray-700 rounded-lg px-2 py-1">Limpiar</button>',
        '    </div>',
        '  </div>',
        '  <button type="button" onclick="SportsDashboard.suggestSafeParlay()"',
        '    class="w-full sm:w-auto text-left text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl border border-amber-500/50 text-amber-200 bg-amber-950/40 hover:bg-amber-900/50 transition-colors flex items-center justify-center gap-2">',
        '    <i class="fas fa-wand-magic-sparkles text-amber-400"></i>Smart Suggester — Ticket seguro (≥70% combinada)',
        '  </button>',
        '</div>',
        '<div class="space-y-2 mb-4">',
        legs.map(function (l) {
          var lp   = AnalysisAgent.calculateProbability(l);
          var lm   = AnalysisAgent.getProbabilityMeta(lp);
          var over = l.avg >= l.line;
          return '<div class="parlay-leg">' +
            '<div class="flex items-center gap-2 min-w-0">' +
            '  <span class="text-white font-semibold text-sm truncate">' + l.name + '</span>' +
            '  <span class="text-gray-500 text-xs shrink-0">' + SPORTS_DATA[l._sport].metric + ' ' + (over ? 'OVER' : 'UNDER') + ' ' + l.line + '</span>' +
            '</div>' +
            '<div class="flex items-center gap-2 shrink-0">' +
            '  <span class="' + lm.cls.replace('prob-', 'text-') + ' font-bold text-sm probability-badge ' + lm.cls + '">' + lm.icon + ' ' + lp + '%</span>' +
            '  <button onclick="SportsDashboard.toggleParlay(\'' + l.id + '\')" class="text-red-500 hover:text-red-300 text-xs"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '</div>';
        }).join(''),
        '</div>',
        legs.length >= 2 ? [
          '<button type="button" onclick="SportsDashboard.copyParlayToDraftKings()"',
          '  class="w-full flex items-center justify-center gap-2 text-white font-black text-sm py-3.5 rounded-xl transition-all hover:scale-[1.02] border-2 border-emerald-400/50 shadow-lg"',
          '  style="background:linear-gradient(90deg,#047857,#10b981)">',
          '  <i class="fas fa-copy"></i>Apostar este Parlay en DraftKings',
          '  <span class="text-emerald-100 font-mono text-xs opacity-90">(' + odds + ')</span>',
          '</button>',
        ].join('') : '<p class="text-center text-gray-600 text-xs">Agrega al menos 2 legs para armar el parlay.</p>',
        '<p class="text-gray-600 text-xs text-center mt-3">Las probabilidades combinadas son estimaciones estadísticas para entretenimiento.</p>',
      ].join('');
    },
    renderParlayHub: async function () {
      var container = document.getElementById('sports-view-content');
      if (!container) return;
      var activeSport = String(OrchestratorAgent.state.sport || '').toUpperCase();
      var predictionSport = (activeSport === 'MLB' || activeSport === 'NFL') ? activeSport : 'MLB';
      var payload = await DataAgent.fetchAgentPrediction({ sport: predictionSport, source: 'parlayhub' });
      var filter = OrchestratorAgent.state.parlayHubFilter || 'popular';
      var parlays = (payload && Array.isArray(payload.parlays) ? payload.parlays : PARLAY_HUB_MOCK.parlays).slice();
      parlays = parlays.map(function (p, idx) {
        return Object.assign({}, p, { startsAt: asParlayHubTimestamp(p.startsAt, (idx + 1) * 40 * 60000) });
      });
      if (filter === 'next') parlays.sort(function (a, b) { return a.startsAt - b.startsAt; });
      else parlays.sort(function (a, b) { return (b.popularity || 0) - (a.popularity || 0); });
      var agentPlayRaw = payload && payload.agentPlay ? payload.agentPlay : null;
      var fallbackAgentPlay = buildAgentPlayFallbackFromParlay(parlays[0]);
      var agentPlay = {
        title: (agentPlayRaw && (agentPlayRaw.title || agentPlayRaw.play || agentPlayRaw.pick || agentPlayRaw.jugada)) || fallbackAgentPlay.title,
        explanation: (agentPlayRaw && (agentPlayRaw.explanation || agentPlayRaw.reason || agentPlayRaw.summary || agentPlayRaw.wisdom)) || fallbackAgentPlay.explanation,
        confidence10: normalizeConfidence10(agentPlayRaw && (agentPlayRaw.confidence10 || agentPlayRaw.confidence || agentPlayRaw.score)),
      };

      var cards = parlays.map(function (parlay) {
        var cats = Object.keys(parlay.propsByCategory || {});
        var catHtml = cats.map(function (cat) {
          var rows = parlay.propsByCategory[cat] || [];
          return '<div class="rounded-lg border border-gray-700/70 bg-gray-950/65 p-2">' +
            '<p class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">' + cat + '</p>' +
            rows.slice(0, 3).map(function (r) {
              return '<div class="text-xs flex items-center justify-between gap-2 mb-1 last:mb-0">' +
                '<span class="text-gray-200 truncate">' + (r.label || r) + '</span>' +
                '<span class="text-emerald-300 font-bold shrink-0">' + (r.edge || '') + '</span>' +
              '</div>';
            }).join('') +
          '</div>';
        }).join('');
        var mins = minutesToStart(parlay.startsAt);
        return [
          '<article class="rounded-2xl border border-gray-700/70 bg-gray-900/80 p-4">',
          '  <div class="flex items-start justify-between gap-3 mb-3">',
          '    <div>',
          '      <p class="text-white font-black text-base">' + parlay.title + '</p>',
          '      <p class="text-xs text-gray-400 mt-0.5">' + parlay.sport + ' · Inicia ' + formatParlayHubStart(parlay.startsAt) + ' · ' + mins + ' min</p>',
          '    </div>',
          '    <div class="text-right">',
          '      <p class="text-xs text-gray-500 uppercase tracking-widest">Confianza</p>',
          '      <p class="text-sm font-black text-cyan-300">' + (parlay.confidence || 60) + '%</p>',
          '    </div>',
          '  </div>',
          '  <div class="flex flex-wrap gap-1.5 mb-3">' + (parlay.tags || []).map(function (t) { return '<span class="text-[10px] px-2 py-1 rounded-full border border-indigo-500/50 bg-indigo-500/10 text-indigo-200 font-semibold">' + t + '</span>'; }).join('') + '</div>',
          '  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">' + catHtml + '</div>',
          '  <div class="rounded-xl border border-cyan-600/30 bg-cyan-900/10 p-3">',
          '    <p class="text-[10px] font-black uppercase tracking-widest text-cyan-300 mb-1">Estadísticas de Javi</p>',
          '    <ul class="text-xs text-gray-300 space-y-1">' + (parlay.javiStats || []).slice(0, 3).map(function (it) { return '<li>• ' + it + '</li>'; }).join('') + '</ul>',
          '  </div>',
          '</article>'
        ].join('');
      }).join('');

      container.innerHTML = [
        '<div class="mb-4 flex flex-wrap items-center justify-between gap-2">',
        '  <h3 class="text-white font-bold text-base sm:text-lg"><i class="fas fa-fire mr-2 text-orange-400"></i>Parlay Hub de Javi</h3>',
        '  <div class="flex items-center gap-2">',
        '    <button class="sport-view-tab ' + (filter === 'popular' ? 'active' : '') + '" onclick="SportsDashboard.setParlayHubFilter(\'popular\')">Popular</button>',
        '    <button class="sport-view-tab ' + (filter === 'next' ? 'active' : '') + '" onclick="SportsDashboard.setParlayHubFilter(\'next\')">Next to start</button>',
        '  </div>',
        '</div>',
        '<p class="text-xs text-gray-500 mb-3">Selecciones temáticas con props por categoría y justificación estadística.</p>',
        '<article class="mb-3 rounded-2xl border border-emerald-500/40 bg-emerald-900/10 p-4">',
        '  <div class="flex items-start justify-between gap-3">',
        '    <div>',
        '      <p class="text-[11px] uppercase tracking-widest text-emerald-300 font-black">La Jugada del Agente</p>',
        '      <p class="text-white font-black text-sm sm:text-base mt-1">' + agentPlay.title + '</p>',
        '      <p class="text-xs text-gray-300 mt-1">' + agentPlay.explanation + '</p>',
        '    </div>',
        '    <div class="text-right shrink-0">',
        '      <p class="text-[10px] text-emerald-200/80 uppercase tracking-widest">Confianza</p>',
        '      <p class="text-lg font-black text-emerald-300">' + agentPlay.confidence10 + '/10</p>',
        '    </div>',
        '  </div>',
        '</article>',
        '<div class="space-y-3">' + cards + '</div>'
      ].join('');
    },

    // ── Main view dispatcher ────────────────────────────────────────────
    renderView: async function (view) {
      var sport = OrchestratorAgent.state.sport;
      if (view === 'props')      { await this.renderProps(sport); }
      else if (view === 'live')  { this.renderLive(); }
      else if (view === 'standings') { this.renderStandings(sport); }
      else if (view === 'parlay')    { this.renderParlay(); }
      else if (view === 'parlayhub') { await this.renderParlayHub(); }
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // ORCHESTRATOR AGENT — app state, init, sport/view switching
  // ════════════════════════════════════════════════════════════════════════
  var OrchestratorAgent = {
    state: {
      sport: 'NBA',
      view: 'props',
      isPremium: localStorage.getItem('sports_premium') === '1',
      canManageBilling: false,
      parlayHubFilter: 'popular',
      marketBySport: { NBA: 'nba_points', MLB: 'mlb_strikeouts', NFL: 'nfl_receiving_yards' },
    },

    init: function () {
      var tabsEl = document.getElementById('sport-tabs');
      if (tabsEl) {
        var sport = this.state.sport;
        tabsEl.innerHTML = Object.keys(SPORTS_DATA).map(function (s) {
          return '<button class="sport-tab' + (s === sport ? ' active' : '') + '" data-sport="' + s + '"' +
            ' onclick="SportsDashboard.switchSport(\'' + s + '\')">' +
            '<i class="' + SPORTS_DATA[s].icon + ' mr-1"></i>' + s +
            '</button>';
        }).join('');
      }

      UIAgent.renderView(this.state.view);
      this.syncPlanStatus();
    },

    syncPlanStatus: async function () {
      try {
        if (!window.firebaseServices || typeof window.firebaseServices.getUserPlan !== 'function') return;
        var plan = await window.firebaseServices.getUserPlan();
        var isPro = !!(plan && plan.planType === 'pro');
        this.state.isPremium = isPro;
        this.state.canManageBilling = !!(plan && plan.canManageBilling);
        if (isPro) localStorage.setItem('sports_premium', '1');
        else localStorage.removeItem('sports_premium');
        UIAgent.renderView(this.state.view);
      } catch (_) {
        // keep local fallback state
      }
    },

    switchSport: function (sport) {
      this.state.sport = sport;
      document.querySelectorAll('.sport-tab').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-sport') === sport);
      });
      UIAgent.renderView(this.state.view);
    },
    switchMarket: function (sport, marketKey) {
      this.state.marketBySport[sport] = normalizeMarketKey(sport, marketKey);
      if (this.state.sport === sport && this.state.view === 'props') {
        UIAgent.renderProps(sport);
      }
    },

    switchView: function (view) {
      this.state.view = view;
      document.querySelectorAll('.sport-view-tab').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-view') === view);
      });
      UIAgent.renderView(view);
    },

    showPremiumModal: function () {
      var self = this;
      var modal = document.getElementById('sd_premium_modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sd_premium_modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,0.8);backdrop-filter:blur(4px)';
        modal.innerHTML = [
          '<div style="background:linear-gradient(155deg,#060b16,#0b1324,#111827);border:1px solid rgba(234,179,8,0.45);border-radius:16px;padding:24px;max-width:360px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,0.5)">',
          '  <div style="text-align:center;margin-bottom:20px">',
          '    <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,rgba(234,179,8,0.28),rgba(59,130,246,0.2));border:1px solid rgba(234,179,8,0.55);margin-bottom:12px"><i class="fas fa-crown" style="color:#facc15;font-size:1.25rem"></i></div>',
          '    <h3 style="color:white;font-size:1.1rem;font-weight:900;margin:0 0 8px">Upgrade a Pro</h3>',
          '    <p style="color:#cbd5e1;font-size:0.85rem;line-height:1.5">Activa funciones premium y mejora tu ventaja estadística con Stripe Checkout seguro.</p>',
          '  </div>',
          '  <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">',
          '    <div style="display:flex;align-items:center;gap:10px;background:#111827;border-radius:10px;padding:10px;border:1px solid #334155"><i class="fas fa-chart-line" style="color:#facc15;flex-shrink:0"></i><span style="color:#d1d5db;font-size:0.85rem">Acceso al Sharp Money</span></div>',
          '    <div style="display:flex;align-items:center;gap:10px;background:#111827;border-radius:10px;padding:10px;border:1px solid #334155"><i class="fas fa-wand-magic-sparkles" style="color:#60a5fa;flex-shrink:0"></i><span style="color:#d1d5db;font-size:0.85rem">Smart Suggester de 70%+</span></div>',
          '    <div style="display:flex;align-items:center;gap:10px;background:#111827;border-radius:10px;padding:10px;border:1px solid #334155"><i class="fas fa-ban" style="color:#38bdf8;flex-shrink:0"></i><span style="color:#d1d5db;font-size:0.85rem">Cero Anuncios</span></div>',
          '  </div>',
          '  <button id="sd_start_checkout_btn" onclick="SportsDashboard.activatePremium()" style="width:100%;background:linear-gradient(90deg,#d97706,#2563eb);color:white;font-weight:700;padding:12px;border-radius:10px;border:none;cursor:pointer;font-size:0.9rem;margin-bottom:8px">Iniciar checkout Pro</button>',
          '  <p id="sd_checkout_error" style="display:none;color:#fca5a5;font-size:0.78rem;line-height:1.35;margin:0 0 8px"></p>',
          '  <button onclick="SportsDashboard.closePremiumModal()" style="width:100%;background:transparent;color:#94a3b8;border:none;cursor:pointer;padding:8px;font-size:0.85rem">Continuar en modo gratuito</button>',
          '</div>',
        ].join('');
        modal.addEventListener('click', function (e) { if (e.target === modal) self.closePremiumModal(); });
        document.body.appendChild(modal);
      }
      modal.style.display = 'flex';
    },

    closePremiumModal: function () {
      var m = document.getElementById('sd_premium_modal');
      if (m) m.style.display = 'none';
    },

    activatePremium: async function () {
      var btn = document.getElementById('sd_start_checkout_btn');
      var errEl = document.getElementById('sd_checkout_error');
      if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Procesando...';
        btn.style.opacity = '0.8';
      }
      try {
        if (!window.firebaseServices || typeof window.firebaseServices.createProCheckoutSession !== 'function') {
          throw new Error('El checkout no esta disponible en este momento.');
        }
        var checkout = await window.firebaseServices.createProCheckoutSession();
        if (!checkout || !checkout.url) throw new Error('No se recibio URL de checkout.');
        window.location.href = checkout.url;
      } catch (err) {
        var msg = (err && err.message) ? err.message : 'No se pudo iniciar el checkout.';
        if (errEl) {
          errEl.textContent = msg;
          errEl.style.display = 'block';
        }
        UIAgent.flash(msg, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Iniciar checkout Pro';
          btn.style.opacity = '1';
        }
      }
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // ACTION HANDLERS
  // ════════════════════════════════════════════════════════════════════════
  function recordFeedback(sport, playerId, isYes) {
    FeedbackAgent.record(sport, playerId, isYes);
    UIAgent.refreshAccuracyRow();
    var card = document.querySelector('[data-prop-id="' + playerId + '"]');
    if (card) {
      var fb = card.querySelector('.fb-area');
      if (fb) {
        fb.innerHTML = '<span class="text-xs font-bold px-2 py-1 rounded-lg w-full text-center" style="' +
          (isYes ? 'color:#4ade80;background:rgba(6,78,59,0.4);border:1px solid rgba(22,163,74,0.5)'
                 : 'color:#f87171;background:rgba(127,29,29,0.4);border:1px solid rgba(220,38,38,0.5)') +
          '">' + (isYes ? '✓ Acertado' : '✗ Fallado') + ' — registrado</span>';
      }
    }
  }

  function saveBet(sport, playerId) {
    if (!OrchestratorAgent.state.isPremium) { OrchestratorAgent.showPremiumModal(); return; }
    var data   = SPORTS_DATA[sport];
    var player = data ? data.players.find(function (p) { return p.id === playerId; }) : null;
    if (!player) return;
    var bet = Object.assign({}, player, { sport: sport, savedAt: new Date().toISOString() });
    StorageAgent.getEncrypted('sports_bets').then(function (bets) {
      bets.push(bet);
      StorageAgent.setEncrypted('sports_bets', bets).then(function () {
        UIAgent.flash('Guardado: ' + player.name + ' — ' + data.metric + ' ' + player.line, 'ok');
        var btn = document.querySelector('[data-save-id="' + playerId + '"]');
        if (btn) { btn.innerHTML = '<i class="fas fa-check" style="font-size:0.7rem"></i>'; btn.disabled = true; }
      });
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // PUBLIC API  (called by HTML onclick + switchAppMode())
  // ════════════════════════════════════════════════════════════════════════
  var SportsDashboard = {
    init:             function ()        { OrchestratorAgent.init(); },
    switchSport:      function (s)       { OrchestratorAgent.switchSport(s); },
    switchMarket:     function (s, m)    { OrchestratorAgent.switchMarket(s, m); },
    switchView:       function (v)       { OrchestratorAgent.switchView(v); },
    setParlayHubFilter: function (filter) {
      OrchestratorAgent.state.parlayHubFilter = filter === 'next' ? 'next' : 'popular';
      if (OrchestratorAgent.state.view === 'parlayhub') UIAgent.renderParlayHub();
    },
    openCustomerPortal: async function () {
      try {
        if (!window.firebaseServices || typeof window.firebaseServices.createCustomerPortalSession !== 'function') {
          UIAgent.flash('Portal de facturación no disponible.', 'error');
          return;
        }
        UIAgent.flash('Abriendo portal seguro de Stripe…', 'ok');
        var portal = await window.firebaseServices.createCustomerPortalSession();
        if (portal && portal.url) {
          window.location.href = portal.url;
          return;
        }
        UIAgent.flash('No se recibió enlace del portal.', 'error');
      } catch (err) {
        UIAgent.flash((err && err.message) ? err.message : 'No se pudo abrir el portal.', 'error');
      }
    },
    feedback:         recordFeedback,
    saveBet:          saveBet,
    toggleParlay:     function (id) {
      var sport  = OrchestratorAgent.state.sport;
      var player = (SPORTS_DATA[sport].players || []).find(function (p) { return p.id === id; });
      // Also search other sports if not found in current
      if (!player) {
        var sports = Object.keys(SPORTS_DATA);
        for (var i = 0; i < sports.length; i++) {
          player = SPORTS_DATA[sports[i]].players.find(function (p) { return p.id === id; });
          if (player) { sport = sports[i]; break; }
        }
      }
      if (player) ParlayAgent.toggle(player, sport);
      if (OrchestratorAgent.state.view === 'parlay') UIAgent.renderParlay();
    },
    clearParlay:      function ()        { ParlayAgent.clear(); },

    suggestSafeParlay: async function () {
      if (window.firebaseSportsBridgeReady) {
        await Promise.race([
          window.firebaseSportsBridgeReady,
          new Promise(function (r) { setTimeout(function () { r(false); }, 8000); }),
        ]);
      }
      var sport = OrchestratorAgent.state.sport;
      var playersList = (SPORTS_DATA[sport] && SPORTS_DATA[sport].players) || [];
      if (playersList.length < 2) {
        UIAgent.flash('No hay suficientes jugadores en este deporte.', 'warn');
        return;
      }
      var live = await DataAgent.fetchStandings(sport);
      var rows = (live && live.teams && live.teams.length) ? live.teams : (STANDINGS[sport] || []);
      var pool = SPORTS_DATA[sport].players.slice().map(function (p) {
        var tp = teamPctFromStandingsRows(p.team, sport, rows);
        return {
          player: p,
          score: AnalysisAgent.calculateProbability(p) * (0.42 + Math.min(0.52, tp)),
        };
      }).sort(function (a, b) { return b.score - a.score; });

      var chosen = [];
      var n;
      for (n = 2; n <= Math.min(6, pool.length); n++) {
        chosen = pool.slice(0, n).map(function (x) { return x.player; });
        if (AnalysisAgent.combinedParlayProb(chosen) >= 70) break;
      }
      if (AnalysisAgent.combinedParlayProb(chosen) < 70) {
        chosen = pool.slice(0, Math.min(4, pool.length)).map(function (x) { return x.player; });
      }
      ParlayAgent.setLegs(chosen.map(function (p) { return { player: p, sport: sport }; }));
      var cp = ParlayAgent.combinedProb();
      UIAgent.flash(
        cp >= 70
          ? 'Ticket Seguro sugerido · probabilidad combinada ~' + cp + '% (clasificación Firestore + modelo).'
          : 'Sugerencia aplicada (~' + cp + '%). Añade o quita legs para acercarte al 70%.',
        cp >= 70 ? 'ok' : 'warn'
      );
    },

    copyParlayToDraftKings: function () {
      var legs = ParlayAgent.legs;
      if (legs.length < 2) {
        UIAgent.flash('Agrega al menos 2 legs al parlay.', 'warn');
        return;
      }
      var sport = legs[0]._sport || 'NBA';
      var pct = ParlayAgent.combinedProb();
      var lines = legs.map(function (l) {
        var over = l.avg >= l.line;
        var m = SPORTS_DATA[l._sport].metric;
        return l.name + ' — ' + m + ' ' + (over ? 'OVER' : 'UNDER') + ' ' + l.line;
      });
      var summary = ['Parlay ' + sport + ' · PrediccionLoteria.com', 'Prob. combinada estimada: ~' + pct + '%', '---'].concat(lines).join('\n');

      var openDk = function () {
        var msg =
          '<div style="text-align:center;line-height:1.5">' +
          '<strong style="color:#86efac;font-size:1.05em">¡Jugada Copiada! 🎯</strong><br/>' +
          'Hemos preparado tu selección de <span style="color:#fde047;font-weight:800">' + sport + '</span> con un ' +
          '<span style="color:#67e8f9;font-weight:900">' + pct + '%</span> de probabilidad de éxito.<br/>' +
          'Te estamos redirigiendo a DraftKings para que asegures tu bono. ¡Buena suerte, CEO!</div>';
        UIAgent.flashHtml(msg, 5200);
        setTimeout(function () {
          window.open(DK_LINK, '_blank', 'noopener,noreferrer');
        }, 1600);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(summary).then(openDk).catch(openDk);
      } else {
        openDk();
      }
    },

    activatePremium:  function ()        { OrchestratorAgent.activatePremium(); },
    closePremiumModal:function ()        { OrchestratorAgent.closePremiumModal(); },
  };

  window.SportsDashboard = SportsDashboard;

})();
