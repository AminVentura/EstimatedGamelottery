'use strict';

function getCurrentYear(date = new Date()) {
  return date.getUTCFullYear();
}

function monthDay(date) {
  return ((date.getUTCMonth() + 1) * 100) + date.getUTCDate();
}

function getSeasonPhase(sport, date = new Date()) {
  const normalizedSport = String(sport || '').toUpperCase();
  const md = monthDay(date);

  if (normalizedSport === 'MLB') {
    if (md >= 215 && md < 328) return 'preseason';
    if (md >= 328 && md < 1001) return 'regular';
    if (md >= 1001 && md < 1105) return 'playoffs';
    return 'offseason';
  }

  if (normalizedSport === 'NFL') {
    if (md >= 801 && md < 901) return 'preseason';
    if (md >= 901 || md < 115) return 'regular';
    if (md >= 115 && md < 220) return 'playoffs';
    return 'offseason';
  }

  return 'offseason';
}

function buildSeasonContext(sport, date = new Date()) {
  const normalizedSport = String(sport || '').toUpperCase();
  const currentYear = getCurrentYear(date);
  const seasonPhase = getSeasonPhase(normalizedSport, date);

  return {
    sport: normalizedSport,
    currentYear,
    seasonPhase,
    seasonKey: normalizedSport + '_' + currentYear,
    dateISO: date.toISOString(),
  };
}

function normalizeMlbGame(game, context) {
  const home = game.teams && game.teams.home && game.teams.home.team
    ? game.teams.home.team.name
    : null;
  const away = game.teams && game.teams.away && game.teams.away.team
    ? game.teams.away.team.name
    : null;
  const gamePk = String(game.gamePk || '');

  return {
    gameId: gamePk,
    sport: 'MLB',
    year: context.currentYear,
    seasonPhase: context.seasonPhase,
    status: game.status && game.status.detailedState ? game.status.detailedState : 'Unknown',
    gameDate: game.gameDate || null,
    homeTeam: home,
    awayTeam: away,
    homeScore: game.teams && game.teams.home ? Number(game.teams.home.score || 0) : null,
    awayScore: game.teams && game.teams.away ? Number(game.teams.away.score || 0) : null,
    source: 'statsapi.mlb.com',
    updatedAtISO: new Date().toISOString(),
  };
}

async function fetchMlbGamesForDate(date = new Date()) {
  const dateStr = date.toISOString().slice(0, 10);
  const url = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=' + dateStr;
  const res = await fetch(url);
  if (!res.ok) throw new Error('MLB schedule fetch failed with status ' + res.status);
  const json = await res.json();
  const dates = Array.isArray(json.dates) ? json.dates : [];
  if (!dates.length) return [];
  return Array.isArray(dates[0].games) ? dates[0].games : [];
}

function buildMockNflGames(context) {
  // TODO: Replace mock NFL data with a stable low-cost source when selected.
  return [
    {
      gameId: 'nfl_mock_' + context.currentYear + '_001',
      sport: 'NFL',
      year: context.currentYear,
      seasonPhase: context.seasonPhase,
      status: context.seasonPhase === 'offseason' ? 'Offseason' : 'Scheduled',
      gameDate: context.dateISO,
      homeTeam: 'Kansas City Chiefs',
      awayTeam: 'Buffalo Bills',
      homeScore: null,
      awayScore: null,
      source: 'mock_nfl_fallback',
      updatedAtISO: new Date().toISOString(),
    },
  ];
}

function getUniversalSeasonRefs(db, sport, year) {
  const normalizedSport = String(sport || '').toLowerCase();
  const normalizedYear = String(year || getCurrentYear());
  const seasonRef = db.doc('sports_data/' + normalizedSport + '/seasons/' + normalizedYear);
  return {
    sport: normalizedSport,
    year: normalizedYear,
    seasonRef,
    dailyStatsCollection: seasonRef.collection('daily_stats'),
    playerAveragesCollection: seasonRef.collection('player_averages'),
  };
}

function formatDateUtc(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getYesterdayUtc(baseDate = new Date()) {
  const copy = new Date(baseDate.getTime());
  copy.setUTCDate(copy.getUTCDate() - 1);
  return copy;
}

async function fetchMlbBoxscore(gamePk) {
  const url = 'https://statsapi.mlb.com/api/v1/game/' + gamePk + '/boxscore';
  const res = await fetch(url);
  if (!res.ok) throw new Error('MLB boxscore fetch failed (' + gamePk + ') status ' + res.status);
  return res.json();
}

function toNumberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildBatterStatLine(playerStats) {
  const batting = playerStats && playerStats.batting ? playerStats.batting : {};
  const hits = toNumberOrZero(batting.hits);
  const doubles = toNumberOrZero(batting.doubles);
  const triples = toNumberOrZero(batting.triples);
  const homeRuns = toNumberOrZero(batting.homeRuns);
  const stolenBases = toNumberOrZero(batting.stolenBases);
  const totalBasesApprox = Math.max(0, hits + doubles + (2 * triples) + (3 * homeRuns));
  return {
    hits,
    total_bases: totalBasesApprox,
    stolen_bases: stolenBases,
    strikeouts: 0,
    earned_runs: 0,
  };
}

function buildPitcherStatLine(playerStats) {
  const pitching = playerStats && playerStats.pitching ? playerStats.pitching : {};
  return {
    hits: 0,
    total_bases: 0,
    stolen_bases: 0,
    strikeouts: toNumberOrZero(pitching.strikeOuts),
    earned_runs: toNumberOrZero(pitching.earnedRuns),
  };
}

function mapMlbBoxscoreToPlayerLines(gamePk, gameDate, boxscore, scheduleGame) {
  const teams = boxscore && boxscore.teams ? boxscore.teams : {};
  const home = teams.home || {};
  const away = teams.away || {};
  const allSides = [home, away];
  const lines = [];

  allSides.forEach((side) => {
    const playersObj = side.players || {};
    Object.keys(playersObj).forEach((key) => {
      const playerRow = playersObj[key] || {};
      const person = playerRow.person || {};
      const playerId = String(person.id || '').trim();
      if (!playerId) return;
      const playerName = person.fullName || person.lastFirstName || 'Unknown';
      const positionCode = playerRow.position && playerRow.position.code ? String(playerRow.position.code) : '';
      const statSource = playerRow.stats || {};
      const batterLine = buildBatterStatLine(statSource);
      const pitcherLine = buildPitcherStatLine(statSource);
      const combined = {
        hits: batterLine.hits,
        total_bases: batterLine.total_bases,
        stolen_bases: batterLine.stolen_bases,
        strikeouts: pitcherLine.strikeouts,
        earned_runs: pitcherLine.earned_runs,
      };
      const played = Object.values(combined).some((v) => toNumberOrZero(v) > 0)
        || !!(statSource && (statSource.batting || statSource.pitching));
      if (!played) return;
      lines.push({
        playerId,
        playerName,
        teamId: String(side.team && side.team.id ? side.team.id : ''),
        teamName: side.team && side.team.name ? side.team.name : '',
        gamePk: String(gamePk),
        gameDate,
        opponent: null,
        positionCode,
        metrics: combined,
      });
    });
  });

  const homeTeamName = scheduleGame && scheduleGame.teams && scheduleGame.teams.home && scheduleGame.teams.home.team
    ? String(scheduleGame.teams.home.team.name || '')
    : '';
  const awayTeamName = scheduleGame && scheduleGame.teams && scheduleGame.teams.away && scheduleGame.teams.away.team
    ? String(scheduleGame.teams.away.team.name || '')
    : '';
  return lines.map((line) => {
    const isHome = line.teamName.toLowerCase() === homeTeamName.toLowerCase();
    return {
      ...line,
      opponent: isHome ? awayTeamName : homeTeamName,
    };
  });
}

async function collectMlbDailyPlayerStats(targetDate = new Date()) {
  const games = await fetchMlbGamesForDate(targetDate);
  const dateISO = formatDateUtc(targetDate);
  const completed = games.filter((g) => {
    const state = g && g.status && g.status.detailedState ? String(g.status.detailedState).toLowerCase() : '';
    return state.includes('final');
  });
  const gameSummaries = [];
  const playerLines = [];

  for (const game of completed) {
    const gamePk = String(game.gamePk || '');
    if (!gamePk) continue;
    try {
      const box = await fetchMlbBoxscore(gamePk);
      const rows = mapMlbBoxscoreToPlayerLines(gamePk, dateISO, box, game);
      const homeScore = game.teams && game.teams.home ? toNumberOrZero(game.teams.home.score) : null;
      const awayScore = game.teams && game.teams.away ? toNumberOrZero(game.teams.away.score) : null;
      playerLines.push(...rows);
      gameSummaries.push({
        gamePk,
        gameDate: game.gameDate || null,
        status: game.status && game.status.detailedState ? game.status.detailedState : 'Unknown',
        homeTeam: game.teams && game.teams.home && game.teams.home.team ? game.teams.home.team.name : '',
        awayTeam: game.teams && game.teams.away && game.teams.away.team ? game.teams.away.team.name : '',
        homeScore,
        awayScore,
        playerStatCount: rows.length,
      });
    } catch (err) {
      gameSummaries.push({
        gamePk,
        gameDate: game.gameDate || null,
        status: 'error',
        error: err.message,
      });
    }
  }

  return { dateISO, games: gameSummaries, playerLines };
}

function sortHistoryByDate(history) {
  return history
    .filter((h) => h && h.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function buildTrendFromHistory(history, metric) {
  if (!Array.isArray(history) || history.length < 2) {
    return { state: 'warm', score: 50, recentAvg: 0, seasonAvg: 0 };
  }
  const sorted = sortHistoryByDate(history);
  const values = sorted.map((h) => toNumberOrZero(h.metrics && h.metrics[metric]));
  const seasonAvg = values.reduce((sum, v) => sum + v, 0) / Math.max(values.length, 1);
  const recentWindow = values.slice(Math.max(values.length - 7, 0));
  const recentAvg = recentWindow.reduce((sum, v) => sum + v, 0) / Math.max(recentWindow.length, 1);
  const ratio = seasonAvg <= 0 ? (recentAvg > 0 ? 2 : 1) : (recentAvg / seasonAvg);
  let state = 'warm';
  if (ratio >= 1.2) state = 'hot';
  else if (ratio <= 0.85) state = 'cold';
  const normalized = Math.max(0, Math.min(100, Math.round(50 + ((ratio - 1) * 60))));
  return { state, score: normalized, recentAvg, seasonAvg };
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values, avg) {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, v) => sum + ((v - avg) ** 2), 0) / values.length;
  return Math.sqrt(Math.max(variance, 0));
}

function approxNormalCdf(z) {
  const t = 1 / (1 + (0.2316419 * Math.abs(z)));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const poly = 0.3193815
    + (t * -0.3565638)
    + ((t ** 2) * 1.781478)
    + ((t ** 3) * -1.821256)
    + ((t ** 4) * 1.330274);
  const prob = d * t * poly;
  return z > 0 ? 1 - prob : prob;
}

function estimateOverProbability(values, line) {
  if (!values.length) return 0.5;
  const avg = mean(values);
  const sd = stdDev(values, avg);
  if (sd <= 0.001) {
    return avg > line ? 0.78 : (avg < line ? 0.22 : 0.5);
  }
  const z = (line - avg) / sd;
  const under = approxNormalCdf(z);
  return Math.max(0.01, Math.min(0.99, 1 - under));
}

function buildConfidenceScore(sampleSize, volatility, trendScore) {
  const sizeScore = Math.min(4, Math.max(1, Math.round(sampleSize / 2.5)));
  const stabilityScore = Math.min(4, Math.max(1, Math.round((1 / Math.max(volatility, 0.2)))));
  const trendBonus = trendScore >= 65 || trendScore <= 35 ? 2 : 1;
  return Math.max(1, Math.min(10, sizeScore + stabilityScore + trendBonus));
}

// ── ESPN Hidden API — NBA player gamelog (last N games) ───────────────────────
// Returns array of { gameId, date, pts, reb, ast, pra } for the specified athlete.
// ESPN athlete IDs: Luka=3945274, Tatum=4065648, Giannis=3032977, Curry=3975, Jokic=3112335, LeBron=1966
async function fetchNbaPlayerGamelog(espnAthleteId, lastN = 10) {
  const url = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/' +
    encodeURIComponent(String(espnAthleteId)) + '/gamelog?limit=' + lastN;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('ESPN NBA gamelog fetch failed, status=' + res.status);
  const json = await res.json();

  const categories = (json.categories || []);
  const events     = (json.events && json.events.items) ? json.events.items : [];
  const statLabels = categories.length ? (categories[0].labels || []) : [];

  const ptsIdx = statLabels.findIndex((l) => l === 'PTS');
  const rebIdx = statLabels.findIndex((l) => l === 'REB');
  const astIdx = statLabels.findIndex((l) => l === 'AST');

  return events.slice(0, lastN).map((ev) => {
    const stats = Array.isArray(ev.stats) ? ev.stats : [];
    const pts = ptsIdx >= 0 ? toNumberOrZero(stats[ptsIdx]) : 0;
    const reb = rebIdx >= 0 ? toNumberOrZero(stats[rebIdx]) : 0;
    const ast = astIdx >= 0 ? toNumberOrZero(stats[astIdx]) : 0;
    return {
      gameId: ev.eventId || ev.id || null,
      date:   ev.atVs   || null,
      pts,
      reb,
      ast,
      pra: pts + reb + ast,
    };
  });
}

// ── MLB Stats API — player season stats (batting or pitching) ─────────────────
// Returns seasonAvg and last5 array for the given metric from the MLB Stats API.
async function fetchMlbPlayerSeasonStats(mlbPlayerId, metric = 'strikeouts', season) {
  const yr = season || getCurrentYear();
  const group = (['strikeouts','earned_runs'].includes(metric)) ? 'pitching' : 'hitting';
  const url = 'https://statsapi.mlb.com/api/v1/people/' + encodeURIComponent(String(mlbPlayerId)) +
    '?hydrate=stats(group=' + group + ',type=gameLog,season=' + yr + ')';
  const res = await fetch(url);
  if (!res.ok) throw new Error('MLB stats fetch failed, status=' + res.status);
  const json = await res.json();

  const person  = (json.people || [])[0];
  const statsArr = person && person.stats ? person.stats : [];
  const gamelog = statsArr.find((s) => s.type && s.type.displayName === 'Game Log');
  const splits  = gamelog ? (gamelog.splits || []) : [];

  // MLB API field names
  const fieldMap = {
    strikeouts:   (s) => toNumberOrZero(s.stat && s.stat.strikeOuts),
    earned_runs:  (s) => toNumberOrZero(s.stat && s.stat.earnedRuns),
    hits:         (s) => toNumberOrZero(s.stat && s.stat.hits),
    total_bases:  (s) => toNumberOrZero(s.stat && s.stat.totalBases),
    stolen_bases: (s) => toNumberOrZero(s.stat && s.stat.stolenBases),
  };
  const getter = fieldMap[metric] || ((s) => 0);
  const values = splits.slice(-10).map(getter);
  const avg    = values.length ? mean(values) : 0;
  return { last10: values, last5: values.slice(-5), seasonAvg: Number(avg.toFixed(2)) };
}

module.exports = {
  getCurrentYear,
  getSeasonPhase,
  buildSeasonContext,
  fetchMlbGamesForDate,
  normalizeMlbGame,
  buildMockNflGames,
  getUniversalSeasonRefs,
  formatDateUtc,
  getYesterdayUtc,
  collectMlbDailyPlayerStats,
  buildTrendFromHistory,
  estimateOverProbability,
  buildConfidenceScore,
  mean,
  stdDev,
  fetchNbaPlayerGamelog,
  fetchMlbPlayerSeasonStats,
};
