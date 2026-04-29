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
  var DK_LINK       = 'https://sportsbook.draftkings.com/r/sb/aminventura17/US-NY-SB/US-NY';
  var ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
  var CACHE_TTL     = 30 * 60 * 1000;

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
  // DATA AGENT — The Odds API with 30-min cache
  // ════════════════════════════════════════════════════════════════════════
  var DataAgent = {
    _cache: {},
    _map: { NBA: 'basketball_nba', MLB: 'baseball_mlb', NFL: 'americanfootball_nfl' },

    _getCached: function (key) {
      var c = this._cache[key];
      if (!c || Date.now() - c.ts > CACHE_TTL) return null;
      return c.data;
    },
    _setCache: function (key, data) { this._cache[key] = { data: data, ts: Date.now() }; },

    fetchOdds: async function (sport) {
      var apiKey = window.ODDS_API_KEY || localStorage.getItem('odds_api_key');
      if (!apiKey) return null;
      var ck = 'odds_' + sport;
      var cached = this._getCached(ck);
      if (cached) return cached;
      try {
        var url = ODDS_API_BASE + '/sports/' + this._map[sport] +
          '/odds/?apiKey=' + apiKey +
          '&regions=us&markets=h2h,spreads&bookmakers=draftkings,fanduel&oddsFormat=american';
        var res = await fetch(url);
        if (!res.ok) return null;
        var data = await res.json();
        this._setCache(ck, data);
        return data;
      } catch (e) { return null; }
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
    record: function (sport, isYes) {
      var d = this.getData();
      if (!d[sport]) d[sport] = { yes: 0, no: 0 };
      if (isYes) d[sport].yes++; else d[sport].no++;
      StorageAgent.set('sports_accuracy', d);
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
      var initials = player.name.split(' ').map(function (n) { return n[0]; }).join('').slice(0, 2);
      var colorMap = { orange: 'bg-orange-600', blue: 'bg-blue-600', green: 'bg-green-600' };
      var avatarBg = colorMap[data.colorName] || 'bg-blue-600';

      var lineDeltaHtml = player.lineDelta
        ? ' <span style="font-size:0.7rem;font-weight:700;color:' + (player.lineDelta > 0 ? '#4ade80' : '#22d3ee') + '">' +
          (player.lineDelta > 0 ? '▲' : '▼') + Math.abs(player.lineDelta) + '</span>'
        : '';

      return [
        '<div class="player-prop-card" data-prop-id="' + player.id + '">',

        // top
        '  <div class="prop-card-top">',
        '    <div class="flex items-center gap-2.5 min-w-0">',
        '      <div class="player-avatar ' + avatarBg + '">' + initials + '</div>',
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

        // trend dots
        '  <div class="mb-3">',
        '    <p class="text-gray-500 text-xs mb-1.5">Últimos 5 vs. línea:</p>',
        '    <div class="flex gap-1.5">' + this.trendDots(player.last5, player.line) + '</div>',
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
      var players = data.players
        .map(function (p) { return Object.assign({}, p, { _prob: AnalysisAgent.calculateProbability(p) }); })
        .sort(function (a, b) { return b._prob - a._prob; });

      var odds = await DataAgent.fetchOdds(sport);
      var self = this;

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

      container.innerHTML = [
        accuracyHtml,
        gameLinesHtml,
        '<div class="mb-4 flex flex-wrap items-start justify-between gap-3">',
        '  <div>',
        '    <h3 class="text-white font-bold text-base sm:text-lg"><i class="' + data.icon + ' mr-2 ' + (sport === 'NBA' ? 'text-orange-400' : sport === 'MLB' ? 'text-blue-400' : 'text-green-400') + '"></i>' + sport + ' — ' + data.metric + ' Props</h3>',
        '    <p class="text-gray-500 text-xs mt-0.5">Rendimiento histórico vs. línea · Probabilidad de superar la apuesta · Ordenado por probabilidad</p>',
        '  </div>',
        '  <div class="api-status-badge"><span class="live-dot"></span>' + (window.ODDS_API_KEY || localStorage.getItem('odds_api_key') ? 'Live Data' : 'Demo Data') + '</div>',
        '</div>',
        '<div class="space-y-3">' + players.map(function (p) { return self.renderCard(p, sport); }).join('') + '</div>',
        self.renderDkBanner(),
        '<div id="sd_flash"></div>',
      ].join('');

      this.refreshAccuracyRow();
      this.refreshParlayBadges();
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
      var savedKey = localStorage.getItem('odds_api_key') || '';
      container.innerHTML = [
        '<div class="text-center py-8">',
        '  <div class="text-5xl mb-4">📡</div>',
        '  <h3 class="text-white font-bold text-lg mb-2">Resultados en Vivo</h3>',
        '  <p class="text-gray-400 text-sm mb-5 max-w-sm mx-auto">Para scores en tiempo real, conecta con estas plataformas. Tu clave de <strong class="text-yellow-400">The Odds API</strong> habilita cuotas en vivo.</p>',
        '  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md mx-auto mb-6">',
        '    <div class="live-source-card"><i class="fas fa-tv text-blue-400 text-lg mb-1.5 block"></i><p class="text-white font-semibold text-sm">ESPN</p><p class="text-gray-500 text-xs">Scores &amp; live stats</p></div>',
        '    <div class="live-source-card"><i class="fas fa-mobile-alt text-green-400 text-lg mb-1.5 block"></i><p class="text-white font-semibold text-sm">The Score</p><p class="text-gray-500 text-xs">Notificaciones push</p></div>',
        '    <div class="live-source-card"><i class="fas fa-chart-line text-purple-400 text-lg mb-1.5 block"></i><p class="text-white font-semibold text-sm">Action Network</p><p class="text-gray-500 text-xs">Tracking de dinero sharp</p></div>',
        '  </div>',
        '  <div class="api-key-form max-w-sm mx-auto text-left">',
        '    <label class="block text-gray-400 text-xs mb-1.5">Tu clave The Odds API (se guarda localmente):</label>',
        '    <div class="flex gap-2">',
        '      <input id="odds-api-key-input" type="password" placeholder="Pegar API key aquí…"',
        '        class="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-600 focus:border-cyan-500 focus:outline-none text-sm font-mono"',
        '        value="' + savedKey.replace(/"/g, '') + '">',
        '      <button onclick="SportsDashboard.saveApiKey()" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold transition-colors">Guardar</button>',
        '    </div>',
        '    <p class="text-gray-600 text-xs mt-1.5"><i class="fas fa-lock mr-1"></i>Solo en localStorage, nunca se envía a nuestros servidores.</p>',
        '  </div>',
        '</div>',
      ].join('');
    },

    // ── View: Standings ─────────────────────────────────────────────────
    renderStandings: function (sport) {
      var container = document.getElementById('sports-view-content');
      if (!container) return;
      var rows = STANDINGS[sport] || [];
      container.innerHTML = [
        '<h3 class="text-white font-bold text-base mb-3"><i class="fas fa-trophy mr-2 text-yellow-400"></i>Clasificación — ' + sport + '</h3>',
        '<div class="overflow-x-auto rounded-xl border border-gray-700/60">',
        '  <table class="w-full text-sm">',
        '    <thead><tr class="bg-gray-900/80 text-gray-400 text-xs uppercase tracking-wide">',
        '      <th class="text-left px-4 py-3">#</th>',
        '      <th class="text-left px-4 py-3">Equipo</th>',
        '      <th class="px-4 py-3">W</th><th class="px-4 py-3">L</th>',
        '      <th class="px-4 py-3">PCT</th><th class="px-4 py-3">GB</th>',
        '      <th class="px-4 py-3">Div.</th>',
        '    </tr></thead>',
        '    <tbody class="divide-y divide-gray-700/40">',
        rows.map(function (t, i) {
          return '<tr class="hover:bg-gray-800/50 transition-colors">' +
            '<td class="px-4 py-3 text-gray-500 font-mono text-xs">' + (i + 1) + '</td>' +
            '<td class="px-4 py-3 text-white font-medium">' + t.team + '</td>' +
            '<td class="px-4 py-3 text-center text-emerald-400 font-bold">' + t.w + '</td>' +
            '<td class="px-4 py-3 text-center text-red-400">' + t.l + '</td>' +
            '<td class="px-4 py-3 text-center text-cyan-400 font-mono">' + t.pct + '</td>' +
            '<td class="px-4 py-3 text-center text-gray-400">' + t.gb + '</td>' +
            '<td class="px-4 py-3 text-center text-yellow-400 font-semibold text-xs">' + t.conf + '</td>' +
            '</tr>';
        }).join(''),
        '    </tbody>',
        '  </table>',
        '</div>',
        '<p class="text-gray-600 text-xs mt-2 text-right"><i class="fas fa-info-circle mr-1"></i>Datos de muestra · Conecta API para datos reales</p>',
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
        '<div class="flex items-center justify-between mb-4">',
        '  <h3 class="text-white font-bold text-base"><i class="fas fa-layer-group mr-2 text-indigo-400"></i>Parlay Builder <span class="text-indigo-400">(' + legs.length + ' legs)</span></h3>',
        '  <div class="flex items-center gap-3">',
        '    <span class="' + pCls + ' font-black text-lg">' + prob + '% · ' + odds + '</span>',
        '    <button onclick="SportsDashboard.clearParlay()" class="text-xs text-gray-500 hover:text-red-400 transition-colors border border-gray-700 rounded-lg px-2 py-1">Limpiar</button>',
        '  </div>',
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
          '<a href="' + DK_LINK + '" target="_blank" rel="noopener noreferrer sponsored"',
          '   class="w-full flex items-center justify-center gap-2 text-white font-bold text-sm py-3 rounded-xl transition-all hover:scale-105"',
          '   style="background:linear-gradient(90deg,#7c3aed,#6d28d9)">',
          '  <i class="fas fa-layer-group text-xs"></i>Jugar Parlay en DraftKings (' + odds + ')',
          '</a>',
        ].join('') : '<p class="text-center text-gray-600 text-xs">Agrega al menos 2 legs para armar el parlay.</p>',
        '<p class="text-gray-600 text-xs text-center mt-3">Las probabilidades combinadas son estimaciones estadísticas para entretenimiento.</p>',
      ].join('');
    },

    // ── Main view dispatcher ────────────────────────────────────────────
    renderView: async function (view) {
      var sport = OrchestratorAgent.state.sport;
      if (view === 'props')      { await this.renderProps(sport); }
      else if (view === 'live')  { this.renderLive(); }
      else if (view === 'standings') { this.renderStandings(sport); }
      else if (view === 'parlay')    { this.renderParlay(); }
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
    },

    init: function () {
      var savedKey = localStorage.getItem('odds_api_key');
      if (savedKey) window.ODDS_API_KEY = savedKey;

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
    },

    switchSport: function (sport) {
      this.state.sport = sport;
      document.querySelectorAll('.sport-tab').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-sport') === sport);
      });
      UIAgent.renderView(this.state.view);
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
          '<div style="background:#111827;border:1px solid rgba(124,58,237,0.5);border-radius:16px;padding:24px;max-width:360px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,0.5)">',
          '  <div style="text-align:center;margin-bottom:20px">',
          '    <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:12px;background:rgba(124,58,237,0.2);border:1px solid rgba(124,58,237,0.5);margin-bottom:12px"><i class="fas fa-shield-alt" style="color:#a78bfa;font-size:1.25rem"></i></div>',
          '    <h3 style="color:white;font-size:1.1rem;font-weight:900;margin:0 0 8px">Sports Premium</h3>',
          '    <p style="color:#9ca3af;font-size:0.85rem;line-height:1.5">Guarda apuestas con AES-256-GCM, Parlay Builder ilimitado y alimenta la red global.</p>',
          '  </div>',
          '  <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">',
          '    <div style="display:flex;align-items:center;gap:10px;background:#1f2937;border-radius:10px;padding:10px;border:1px solid #374151"><i class="fas fa-lock" style="color:#a78bfa;flex-shrink:0"></i><span style="color:#d1d5db;font-size:0.85rem">Historial cifrado AES-256-GCM</span></div>',
          '    <div style="display:flex;align-items:center;gap:10px;background:#1f2937;border-radius:10px;padding:10px;border:1px solid #374151"><i class="fas fa-layer-group" style="color:#60a5fa;flex-shrink:0"></i><span style="color:#d1d5db;font-size:0.85rem">Parlay Builder (hasta 6 legs)</span></div>',
          '    <div style="display:flex;align-items:center;gap:10px;background:#1f2937;border-radius:10px;padding:10px;border:1px solid #374151"><i class="fas fa-chart-line" style="color:#34d399;flex-shrink:0"></i><span style="color:#d1d5db;font-size:0.85rem">Alimenta la red global de datos</span></div>',
          '  </div>',
          '  <button onclick="SportsDashboard.activatePremium()" style="width:100%;background:linear-gradient(90deg,#7c3aed,#6d28d9);color:white;font-weight:700;padding:12px;border-radius:10px;border:none;cursor:pointer;font-size:0.9rem;margin-bottom:8px">Activar Premium · $4.99/mes</button>',
          '  <button onclick="SportsDashboard.closePremiumModal()" style="width:100%;background:transparent;color:#6b7280;border:none;cursor:pointer;padding:8px;font-size:0.85rem">Continuar sin Premium</button>',
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

    activatePremium: function () {
      this.state.isPremium = true;
      localStorage.setItem('sports_premium', '1');
      this.closePremiumModal();
      UIAgent.flash('¡Premium activado! Apuestas cifradas con AES-256-GCM.', 'ok');
      UIAgent.renderView(this.state.view);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // ACTION HANDLERS
  // ════════════════════════════════════════════════════════════════════════
  function recordFeedback(sport, playerId, isYes) {
    FeedbackAgent.record(sport, isYes);
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
    switchView:       function (v)       { OrchestratorAgent.switchView(v); },
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
    saveApiKey:       function () {
      var input = document.getElementById('odds-api-key-input');
      if (!input || !input.value.trim()) return;
      localStorage.setItem('odds_api_key', input.value.trim());
      window.ODDS_API_KEY = input.value.trim();
      var btn = input.nextElementSibling;
      if (btn) { btn.textContent = '✓ Guardado'; setTimeout(function () { btn.textContent = 'Guardar'; }, 2000); }
    },
    activatePremium:  function ()        { OrchestratorAgent.activatePremium(); },
    closePremiumModal:function ()        { OrchestratorAgent.closePremiumModal(); },
  };

  window.SportsDashboard = SportsDashboard;

})();
