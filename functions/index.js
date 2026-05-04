'use strict';
// Stripe: prefer Secret Manager (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_PRICE_ID).
// Legacy: functions.config().stripe.* and env vars still supported as fallback.

const { onCall, HttpsError }       = require('firebase-functions/v2/https');
const { onRequest }                = require('firebase-functions/v2/https');
const { onDocumentCreated }        = require('firebase-functions/v2/firestore');
const { onSchedule }               = require('firebase-functions/v2/scheduler');
const { defineSecret }             = require('firebase-functions/params');
const { initializeApp, getApps }   = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const Stripe                       = require('stripe');
const {
  getCurrentYear,
  buildSeasonContext,
  fetchMlbGamesForDate,
  normalizeMlbGame,
  buildMockNflGames,
  getUniversalSeasonRefs,
  getYesterdayUtc,
  collectMlbDailyPlayerStats,
  buildTrendFromHistory,
  estimateOverProbability,
  buildConfidenceScore,
  mean,
  stdDev,
} = require('./sports-eternal');

// Guard: only initialize once (safe across hot-reloads & multi-file setups)
if (!getApps().length) initializeApp();

// ── Secrets ───────────────────────────────────────────────────────────────────
// Set with: firebase functions:secrets:set ODDS_API_KEY
const ODDS_API_KEY = defineSecret('ODDS_API_KEY');
// Set with: firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
// Set with: firebase functions:secrets:set STRIPE_SECRET_KEY
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
// Set with: firebase functions:secrets:set STRIPE_PRO_PRICE_ID
const STRIPE_PRO_PRICE_ID = defineSecret('STRIPE_PRO_PRICE_ID');

// ── Constants ─────────────────────────────────────────────────────────────────
const SPORT_MAP = {
  NBA: 'basketball_nba',
  MLB: 'baseball_mlb',
  NFL: 'americanfootball_nfl',
};

const ESPN_URLS = {
  NBA: 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings',
  MLB: 'https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings',
  NFL: 'https://site.api.espn.com/apis/v2/sports/football/nfl/standings',
};

const ALLOWED_ORIGINS = [
  'https://www.prediccionloteria.com',
  'https://prediccionloteria.com',
  'https://game-lottery-b0e90.web.app',
];

const CACHE_TTL_MS = 10 * 60 * 1000; // 10-min odds cache
const FREE_LIMIT   = 5;               // requests per hour (free)
const PRO_LIMIT    = 200;             // requests per hour (pro)
const WINDOW_MS    = 60 * 60 * 1000; // 1-hour sliding window
const PRO_SUCCESS_URL = 'https://www.prediccionloteria.com/success';
const PRO_CANCEL_URL  = 'https://www.prediccionloteria.com/pro';
/** Stripe Customer Portal return URL (billing, invoices, payment method, cancel). */
const STRIPE_PORTAL_RETURN_URL = PRO_CANCEL_URL;
const SPORTS_EVENTS_COLLECTION = 'sports_events';
const DYNAMIC_SPORTS = ['MLB', 'NFL'];
const MLB_PROP_METRICS = ['strikeouts', 'earned_runs', 'total_bases', 'stolen_bases'];

const MLB_PROPS_MOCK = [
  {
    eventId: 'mlb_nyy_bos_2026-05-01',
    sport: 'MLB',
    startsAt: '2026-05-01T23:10:00.000Z',
    status: 'scheduled',
    teams: { home: 'NYY', away: 'BOS' },
    pitcherProps: [
      { player: 'Gerrit Cole', market: 'strikeouts', line: 8.5, overOdds: -120, underOdds: 100 },
      { player: 'Gerrit Cole', market: 'earned_runs', line: 2.5, overOdds: 110, underOdds: -135 },
    ],
    batterProps: [
      { player: 'Juan Soto', market: 'total_bases', line: 1.5, overOdds: 105, underOdds: -125 },
      { player: 'Aaron Judge', market: 'hits', line: 1.5, overOdds: 120, underOdds: -145 },
    ],
    gameProps: [
      { market: 'first_inning_run', line: 0.5, overOdds: -110, underOdds: -110 },
      { market: 'run_line_home', line: -1.5, odds: 130 },
      { market: 'total_runs', line: 8.5, overOdds: -105, underOdds: -115 },
    ],
  },
  {
    eventId: 'mlb_lad_sdp_2026-05-01',
    sport: 'MLB',
    startsAt: '2026-05-02T01:40:00.000Z',
    status: 'scheduled',
    teams: { home: 'LAD', away: 'SDP' },
    pitcherProps: [
      { player: 'Yoshinobu Yamamoto', market: 'strikeouts', line: 6.5, overOdds: -105, underOdds: -115 },
      { player: 'Yoshinobu Yamamoto', market: 'earned_runs', line: 2.5, overOdds: 115, underOdds: -140 },
    ],
    batterProps: [
      { player: 'Mookie Betts', market: 'hits', line: 1.5, overOdds: 125, underOdds: -150 },
      { player: 'Freddie Freeman', market: 'total_bases', line: 1.5, overOdds: 110, underOdds: -130 },
    ],
    gameProps: [
      { market: 'first_inning_run', line: 0.5, overOdds: -120, underOdds: 100 },
      { market: 'run_line_home', line: -1.5, odds: 145 },
      { market: 'total_runs', line: 7.5, overOdds: -110, underOdds: -110 },
    ],
  },
];

function getRequestIdentity(request) {
  if (request && request.auth && request.auth.uid) {
    return { uid: request.auth.uid, isGuest: false };
  }
  // Temporary auth propagation gaps can happen right after anonymous sign-in.
  // Allow a guest identity only when App Check is present (enforced at runtime).
  if (!request || !request.app) {
    throw new HttpsError('unauthenticated', 'Debes estar autenticado.');
  }
  // Use the real socket IP (set by Google's load balancer) as authoritative source.
  // x-forwarded-for is user-controllable; we only use it as a fallback and validate format.
  const realIp = request && request.rawRequest ? String(request.rawRequest.ip || '') : '';
  const fwd = request && request.rawRequest && request.rawRequest.headers
    ? String(request.rawRequest.headers['x-forwarded-for'] || '')
    : '';
  const fwdFirst = fwd.split(',')[0].trim();
  const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const IPV6 = /^[a-f0-9:]{2,39}$/i;
  const candidate = realIp || (IPV4.test(fwdFirst) || IPV6.test(fwdFirst) ? fwdFirst : '');
  const safeIp = (candidate.replace(/[^0-9a-fA-F\.:]/g, '').slice(0, 45)) || 'unknown';
  return { uid: 'guest_' + safeIp, isGuest: true };
}

function getRuntimeStripeConfig() {
  try {
    const raw = process.env.CLOUD_RUNTIME_CONFIG ? JSON.parse(process.env.CLOUD_RUNTIME_CONFIG) : null;
    return (raw && raw.stripe) ? raw.stripe : {};
  } catch (_) {
    return {};
  }
}

function getStripeSecretKeyLegacy() {
  const runtimeStripe = getRuntimeStripeConfig();
  const runtimeConfigSecret = runtimeStripe.secret ? String(runtimeStripe.secret) : '';
  const cfgSecret = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || runtimeConfigSecret || '';
  const legacyCfg = process.env.STRIPE_CONFIG_SECRET || '';
  return String(cfgSecret || legacyCfg).trim();
}

/** Prefer Secret Manager when param is bound to the function. */
function resolveStripeApiKey(stripeSecretKeyParam) {
  if (stripeSecretKeyParam) {
    const v = String(stripeSecretKeyParam.value() || '').trim();
    if (v) return v;
  }
  return getStripeSecretKeyLegacy();
}

/** Legacy fallback: env or functions.config() stripe.webhook_secret (prefer Secret Manager). */
function getStripeWebhookSecretLegacy() {
  const runtimeStripe = getRuntimeStripeConfig();
  return String(process.env.STRIPE_WEBHOOK_SECRET || runtimeStripe.webhook_secret || '').trim();
}

function getProPriceId() {
  const runtimeStripe = getRuntimeStripeConfig();
  const priceId = String(
    process.env.STRIPE_PRO_PRICE_ID
    || process.env.STRIPE_PRICE_ID
    || runtimeStripe.pro_price_id
    || runtimeStripe.price_id
    || ''
  ).trim();
  return priceId;
}

function getProProductId() {
  const runtimeStripe = getRuntimeStripeConfig();
  return String(process.env.STRIPE_PRO_PRODUCT_ID || runtimeStripe.pro_product_id || '').trim();
}

async function resolveProPriceId(stripe, stripeProPriceIdParam) {
  const fromSecret = stripeProPriceIdParam ? String(stripeProPriceIdParam.value() || '').trim() : '';
  const explicitPriceId = fromSecret || getProPriceId();
  if (explicitPriceId) return explicitPriceId;

  const productId = getProProductId();
  if (!productId) {
    throw new HttpsError(
      'failed-precondition',
      'Stripe Price ID/Product ID missing. Set STRIPE_PRO_PRICE_ID or STRIPE_PRO_PRODUCT_ID.'
    );
  }

  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    type: 'recurring',
    limit: 25,
  });
  const selected = (prices.data || [])[0];
  if (!selected || !selected.id) {
    throw new HttpsError('failed-precondition', 'No active recurring price found for configured Stripe product.');
  }
  return selected.id;
}

function createStripeClient(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) {
    throw new HttpsError(
      'failed-precondition',
      'Stripe secret key missing. Set Secret STRIPE_SECRET_KEY or functions config "stripe.secret".'
    );
  }
  return new Stripe(key);
}

async function upsertUserProPlan(uid, subscription) {
  if (!uid) return;
  const db = getFirestore();
  const periodEndSec = Number(subscription && subscription.current_period_end) || 0;
  const expiresAt = periodEndSec > 0
    ? Timestamp.fromMillis(periodEndSec * 1000)
    : Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

  await db.doc('users/' + uid).set({
    isPro: true,
    planType: 'pro',
    expiresAt,
    stripeCustomerId: subscription.customer || null,
    stripeSubscriptionId: subscription.id || null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function markUserPlanInactiveByUid(uid) {
  if (!uid) return;
  const db = getFirestore();
  await db.doc('users/' + uid).set({
    isPro: false,
    planType: 'free',
    expiresAt: FieldValue.delete(),
    stripeSubscriptionId: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function markUserPlanInactiveBySubscriptionId(subscriptionId) {
  if (!subscriptionId) return;
  const db = getFirestore();
  const matches = await db.collection('users')
    .where('stripeSubscriptionId', '==', subscriptionId)
    .limit(1)
    .get();
  if (matches.empty) return;
  const userDoc = matches.docs[0];
  await userDoc.ref.set({
    isPro: false,
    planType: 'free',
    expiresAt: FieldValue.delete(),
    stripeSubscriptionId: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

// ── ESPN Parser ───────────────────────────────────────────────────────────────
// Verified against live ESPN API on 2026-04-29:
//   NBA → East/West (15 teams each)
//   MLB → AL/NL (15 teams each)
//   NFL → AFC/NFC (16 teams each)
//   All share: j.children[i].standings.entries[j]
//   Stat names: wins, losses, winPercent, gamesBehind, playoffSeed, streak
function parseEspnStandings(json, sport) {
  const teams    = [];
  const children = json.children || [];
  console.log(`[parseEspnStandings] ${sport}: ${children.length} groups`);

  for (const conf of children) {
    const confLabel = (conf.abbreviation || conf.name || '').slice(0, 6);
    const entries   = (conf.standings && conf.standings.entries) || [];
    console.log(`  conf="${confLabel}" entries=${entries.length}`);

    for (const entry of entries) {
      try {
        const t   = entry.team || {};
        // Build a quick-lookup index from stat name → { value, displayValue }
        const idx = {};
        for (const s of (entry.stats || [])) {
          idx[s.name] = { v: s.value, d: s.displayValue || String(s.value || '') };
        }
        const w      = Math.round(idx.wins   ? idx.wins.v   : 0);
        const l      = Math.round(idx.losses ? idx.losses.v : 0);
        const pct    = idx.winPercent   ? idx.winPercent.d   : ((w / Math.max(w + l, 1)).toFixed(3).replace('0.', '.'));
        const gbRaw  = idx.gamesBehind  ? idx.gamesBehind.d  : '—';
        const gb     = (gbRaw === '-' || gbRaw === '0' || gbRaw === '0.0') ? '—' : gbRaw;
        const seed   = Math.round(idx.playoffSeed ? idx.playoffSeed.v : 0);
        const streak = idx.streak ? idx.streak.d : '';

        teams.push({
          team:   t.displayName || t.name || '?',
          abbr:   t.abbreviation || '?',
          w, l, pct, gb,
          conf:   confLabel,
          seed,
          streak,
        });
      } catch (rowErr) {
        console.warn(`  [parseEspnStandings] skipped entry:`, rowErr.message);
      }
    }
  }
  return teams;
}

// ── Shared ESPN fetch helper ──────────────────────────────────────────────────
async function fetchEspnStandings(sport) {
  const url = ESPN_URLS[sport];
  if (!url) throw new Error('No ESPN URL for sport: ' + sport);
  console.log(`[fetchEspnStandings] GET ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN responded ${res.status} for ${sport}`);
  const json  = await res.json();
  const teams = parseEspnStandings(json, sport);
  console.log(`[fetchEspnStandings] parsed ${teams.length} teams for ${sport}`);
  return teams;
}

// ── Helper: serialize Firestore doc safely for callable return ────────────────
function serializeSnap(snap) {
  if (!snap.exists) {
    console.log('[serializeSnap] document does not exist → returning empty');
    return { teams: [], updatedAt: null, source: 'empty', isDemo: true };
  }
  const d = snap.data();
  console.log('[serializeSnap] doc exists, teams:', (d.teams || []).length);
  return {
    teams:     d.teams     || [],
    // Convert Timestamp → ISO string to avoid callable serialization errors
    updatedAt: d.updatedAt ? d.updatedAt.toDate().toISOString() : null,
    source:    'firestore',
    isDemo:    false,
  };
}

function getSeasonDocRefs(db, sport, year) {
  const key = sport + '_' + year;
  return {
    key,
    statsHistoryRef: db.doc('stats_history/' + key),
    sportsBufferRef: db.doc('sports_buffer/' + key),
    agentMemoryRef: db.doc('agent_memory/' + key),
    gamesCollection: db.collection('stats_history/' + key + '/games'),
  };
}

function buildPredictionFromGames(games, team) {
  if (!Array.isArray(games) || !games.length) {
    return { confidence: 0.5, signal: 'insufficient_data' };
  }

  const completed = games.filter((game) =>
    Number.isFinite(game.homeScore) &&
    Number.isFinite(game.awayScore) &&
    game.homeScore !== null &&
    game.awayScore !== null
  );

  if (!completed.length) return { confidence: 0.5, signal: 'no_completed_games' };

  if (team) {
    let wins = 0;
    let played = 0;
    completed.forEach((game) => {
      const home = String(game.homeTeam || '');
      const away = String(game.awayTeam || '');
      const normalizedTeam = String(team);
      const isHome = home.toLowerCase() === normalizedTeam.toLowerCase();
      const isAway = away.toLowerCase() === normalizedTeam.toLowerCase();
      if (!isHome && !isAway) return;

      played += 1;
      const isWin = (isHome && game.homeScore > game.awayScore)
        || (isAway && game.awayScore > game.homeScore);
      if (isWin) wins += 1;
    });

    if (!played) return { confidence: 0.5, signal: 'team_not_found' };
    const ratio = wins / played;
    return {
      confidence: Number(ratio.toFixed(3)),
      signal: ratio >= 0.55 ? 'team_positive_trend' : 'team_volatile_trend',
      gamesAnalyzed: played,
    };
  }

  const margins = completed.map((game) => Math.abs(Number(game.homeScore) - Number(game.awayScore)));
  const avgMargin = margins.reduce((sum, margin) => sum + margin, 0) / margins.length;
  const confidence = Math.max(0.5, Math.min(0.9, 0.5 + (avgMargin / 20)));
  return {
    confidence: Number(confidence.toFixed(3)),
    signal: 'league_margin_heuristic',
    gamesAnalyzed: completed.length,
  };
}

async function refreshSportBuffer(db, sport, now = new Date()) {
  const context = buildSeasonContext(sport, now);
  const refs = getSeasonDocRefs(db, sport, context.currentYear);

  let games = [];
  let source = 'unknown';
  if (sport === 'MLB') {
    const rawGames = await fetchMlbGamesForDate(now);
    games = rawGames.map((game) => normalizeMlbGame(game, context)).filter((game) => !!game.gameId);
    source = 'statsapi.mlb.com';
  } else if (sport === 'NFL') {
    games = buildMockNflGames(context);
    source = 'mock_nfl_fallback';
  }

  const uniqueById = new Map();
  games.forEach((game) => {
    uniqueById.set(String(game.gameId), game);
  });
  const dedupedGames = Array.from(uniqueById.values());

  if (dedupedGames.length) {
    const batch = db.batch();
    dedupedGames.forEach((game) => {
      batch.set(refs.gamesCollection.doc(String(game.gameId)), {
        ...game,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
  }

  await refs.statsHistoryRef.set({
    sport,
    year: context.currentYear,
    seasonPhase: context.seasonPhase,
    source,
    gameCount: dedupedGames.length,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await refs.sportsBufferRef.set({
    sport,
    year: context.currentYear,
    seasonPhase: context.seasonPhase,
    source,
    games: dedupedGames,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await refs.agentMemoryRef.set({
    sport,
    year: context.currentYear,
    seasonPhase: context.seasonPhase,
    source,
    lastBufferRefreshAt: FieldValue.serverTimestamp(),
    lastGameCount: dedupedGames.length,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    sport,
    year: context.currentYear,
    seasonPhase: context.seasonPhase,
    source,
    gameCount: dedupedGames.length,
  };
}

async function ensureUniversalSportsSchema(db, year) {
  const mlbRefs = getUniversalSeasonRefs(db, 'mlb', year);
  const nflRefs = getUniversalSeasonRefs(db, 'nfl', year);
  const ts = FieldValue.serverTimestamp();

  await Promise.all([
    mlbRefs.seasonRef.set({
      sport: 'mlb',
      year: String(year),
      schemaVersion: 1,
      features: ['daily_stats', 'player_averages', 'prop_predictions'],
      updatedAt: ts,
    }, { merge: true }),
    nflRefs.seasonRef.set({
      sport: 'nfl',
      year: String(year),
      schemaVersion: 1,
      features: ['daily_stats', 'player_averages', 'prop_predictions'],
      statFields: ['passing_yards', 'rushing_yards', 'touchdowns', 'spreads'],
      updatedAt: ts,
    }, { merge: true }),
  ]);
}

function aggregatePlayerLinesByDay(playerLines, dateISO) {
  const grouped = new Map();
  playerLines.forEach((line) => {
    const key = String(line.playerId || '');
    if (!key) return;
    const existing = grouped.get(key) || {
      playerId: key,
      playerName: line.playerName || 'Unknown',
      teamName: line.teamName || '',
      date: dateISO,
      gamesCount: 0,
      metrics: { hits: 0, total_bases: 0, strikeouts: 0, earned_runs: 0, stolen_bases: 0 },
    };
    existing.gamesCount += 1;
    existing.metrics.hits += Number(line.metrics && line.metrics.hits ? line.metrics.hits : 0);
    existing.metrics.total_bases += Number(line.metrics && line.metrics.total_bases ? line.metrics.total_bases : 0);
    existing.metrics.strikeouts += Number(line.metrics && line.metrics.strikeouts ? line.metrics.strikeouts : 0);
    existing.metrics.earned_runs += Number(line.metrics && line.metrics.earned_runs ? line.metrics.earned_runs : 0);
    existing.metrics.stolen_bases += Number(line.metrics && line.metrics.stolen_bases ? line.metrics.stolen_bases : 0);
    grouped.set(key, existing);
  });
  return Array.from(grouped.values());
}

function computeMlbPlayerCompositeForm(history) {
  const metricTrends = {
    strikeouts: buildTrendFromHistory(history, 'strikeouts'),
    earned_runs: buildTrendFromHistory(history, 'earned_runs'),
    total_bases: buildTrendFromHistory(history, 'total_bases'),
    stolen_bases: buildTrendFromHistory(history, 'stolen_bases'),
  };
  const rawScore = (
    metricTrends.strikeouts.score
    + metricTrends.total_bases.score
    + metricTrends.stolen_bases.score
    + (100 - metricTrends.earned_runs.score)
  ) / 4;
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));
  const state = score >= 67 ? 'hot' : (score <= 40 ? 'cold' : 'warm');
  return { state, score, metricTrends };
}

async function upsertMlbPlayerAverages(db, year, dateISO, playerLines) {
  const refs = getUniversalSeasonRefs(db, 'mlb', year);
  const dayRows = aggregatePlayerLinesByDay(playerLines, dateISO);
  if (!dayRows.length) return { playerCount: 0 };

  const docRefs = dayRows.map((row) => refs.playerAveragesCollection.doc(row.playerId));
  const snapshots = await db.getAll(...docRefs);
  const existingById = new Map();
  snapshots.forEach((snap) => {
    if (snap.exists) existingById.set(snap.id, snap.data());
  });

  const batch = db.batch();
  dayRows.forEach((row) => {
    const prev = existingById.get(row.playerId) || {};
    const prevTotals = prev.totals || {};
    const prevGames = Number(prev.gamesCount || 0);
    const nextGames = prevGames + row.gamesCount;
    const totals = {
      hits: Number(prevTotals.hits || 0) + row.metrics.hits,
      total_bases: Number(prevTotals.total_bases || 0) + row.metrics.total_bases,
      strikeouts: Number(prevTotals.strikeouts || 0) + row.metrics.strikeouts,
      earned_runs: Number(prevTotals.earned_runs || 0) + row.metrics.earned_runs,
      stolen_bases: Number(prevTotals.stolen_bases || 0) + row.metrics.stolen_bases,
    };
    const seasonAverages = {
      hits: Number((totals.hits / Math.max(nextGames, 1)).toFixed(3)),
      total_bases: Number((totals.total_bases / Math.max(nextGames, 1)).toFixed(3)),
      strikeouts: Number((totals.strikeouts / Math.max(nextGames, 1)).toFixed(3)),
      earned_runs: Number((totals.earned_runs / Math.max(nextGames, 1)).toFixed(3)),
      stolen_bases: Number((totals.stolen_bases / Math.max(nextGames, 1)).toFixed(3)),
    };
    const prevHistory = Array.isArray(prev.rollingHistory) ? prev.rollingHistory : [];
    const filtered = prevHistory.filter((h) => String(h.date || '') !== dateISO);
    const nextHistory = [...filtered, { date: dateISO, metrics: row.metrics }]
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(-30);
    const form = computeMlbPlayerCompositeForm(nextHistory);
    batch.set(refs.playerAveragesCollection.doc(row.playerId), {
      playerId: row.playerId,
      playerName: row.playerName,
      teamName: row.teamName,
      sport: 'mlb',
      season: String(year),
      gamesCount: nextGames,
      totals,
      seasonAverages,
      rollingHistory: nextHistory,
      form,
      lastUpdatedDate: dateISO,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();
  return { playerCount: dayRows.length };
}

async function ingestMlbYesterdayData(db, year) {
  const targetDate = getYesterdayUtc(new Date());
  const { dateISO, games, playerLines } = await collectMlbDailyPlayerStats(targetDate);
  const refs = getUniversalSeasonRefs(db, 'mlb', year);
  const byGame = new Map();
  playerLines.forEach((line) => {
    const key = String(line.gamePk || '');
    if (!key) return;
    const rows = byGame.get(key) || [];
    rows.push(line);
    byGame.set(key, rows);
  });

  const batch = db.batch();
  games.forEach((game) => {
    const gamePk = String(game.gamePk || '');
    if (!gamePk) return;
    batch.set(refs.dailyStatsCollection.doc(gamePk), {
      sport: 'mlb',
      season: String(year),
      date: dateISO,
      gamePk,
      summary: game,
      playerStats: byGame.get(gamePk) || [],
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  batch.set(refs.dailyStatsCollection.doc(dateISO + '_summary'), {
    sport: 'mlb',
    season: String(year),
    date: dateISO,
    type: 'daily_summary',
    gameCount: games.length,
    playerStatRows: playerLines.length,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  const avgResult = await upsertMlbPlayerAverages(db, year, dateISO, playerLines);
  return { dateISO, gameCount: games.length, playerStatRows: playerLines.length, ...avgResult };
}

async function refreshMlbPlayerTrendScores(db, year) {
  const refs = getUniversalSeasonRefs(db, 'mlb', year);
  const snap = await refs.playerAveragesCollection.limit(500).get();
  if (snap.empty) return { updatedPlayers: 0 };
  const batch = db.batch();
  snap.docs.forEach((doc) => {
    const data = doc.data();
    const history = Array.isArray(data.rollingHistory) ? data.rollingHistory : [];
    const form = computeMlbPlayerCompositeForm(history);
    batch.set(doc.ref, {
      form,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();
  return { updatedPlayers: snap.size };
}

// ════════════════════════════════════════════════════════════════════════════
// getSeasonContext — dynamic snapshot for current season/year
// ════════════════════════════════════════════════════════════════════════════
exports.getSeasonContext = onCall(
  { region: 'us-central1', cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');
    const sport = String((request.data && request.data.sport) || 'MLB').toUpperCase();
    if (!DYNAMIC_SPORTS.includes(sport)) {
      throw new HttpsError('invalid-argument', 'Deporte no soportado para contexto dinámico: ' + sport);
    }

    const db = getFirestore();
    const currentYear = getCurrentYear(new Date());
    const refs = getSeasonDocRefs(db, sport, currentYear);
    const [bufferSnap, memorySnap] = await Promise.all([
      refs.sportsBufferRef.get(),
      refs.agentMemoryRef.get(),
    ]);

    return {
      season: buildSeasonContext(sport, new Date()),
      snapshot: bufferSnap.exists ? bufferSnap.data() : null,
      agentMemory: memorySnap.exists ? memorySnap.data() : null,
    };
  }
);

// ════════════════════════════════════════════════════════════════════════════
// getAgentPrediction — initial heuristic based on stats_history + memory
// ════════════════════════════════════════════════════════════════════════════
exports.getAgentPrediction = onCall(
  { region: 'us-central1', cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');
    const sport = String((request.data && request.data.sport) || 'MLB').toUpperCase();
    if (!DYNAMIC_SPORTS.includes(sport)) {
      throw new HttpsError('invalid-argument', 'Deporte no soportado para predicción: ' + sport);
    }
    const team = request.data && request.data.team ? String(request.data.team) : null;

    const db = getFirestore();
    const context = buildSeasonContext(sport, new Date());
    const refs = getSeasonDocRefs(db, sport, context.currentYear);
    const [gamesSnap, memorySnap] = await Promise.all([
      refs.gamesCollection.limit(300).get(),
      refs.agentMemoryRef.get(),
    ]);
    const games = gamesSnap.docs.map((doc) => doc.data());
    const heuristic = buildPredictionFromGames(games, team);

    await refs.agentMemoryRef.set({
      lastPredictionAt: FieldValue.serverTimestamp(),
      lastPredictionSport: sport,
      lastPredictionTeam: team || null,
      lastPredictionConfidence: heuristic.confidence,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      season: context,
      prediction: {
        sport,
        team,
        confidence: heuristic.confidence,
        signal: heuristic.signal,
        gamesAnalyzed: heuristic.gamesAnalyzed || 0,
      },
      memory: memorySnap.exists ? memorySnap.data() : null,
    };
  }
);

// ════════════════════════════════════════════════════════════════════════════
// refreshSportsBufferDaily — daily low-cost refresh for MLB/NFL
// ════════════════════════════════════════════════════════════════════════════
exports.refreshSportsBufferDaily = onSchedule(
  { schedule: '0 4 * * *', region: 'us-central1', timeoutSeconds: 120 },
  async () => {
    const db = getFirestore();
    const now = new Date();
    const results = [];

    for (const sport of DYNAMIC_SPORTS) {
      try {
        const result = await refreshSportBuffer(db, sport, now);
        results.push({ ...result, ok: true });
      } catch (err) {
        console.error('[refreshSportsBufferDaily] ' + sport + ' FAILED:', err.message);
        results.push({ sport, ok: false, error: err.message });
      }
    }

    console.log('[refreshSportsBufferDaily] completed', JSON.stringify(results));
    return null;
  }
);

// ════════════════════════════════════════════════════════════════════════════
// ingestMlbDailyAt4am — MLB ingest + universal schema refresh
// ════════════════════════════════════════════════════════════════════════════
exports.ingestMlbDailyAt4am = onSchedule(
  { schedule: '0 4 * * *', timeZone: 'America/New_York', region: 'us-central1', timeoutSeconds: 540 },
  async () => {
    const db = getFirestore();
    const year = getCurrentYear(new Date());
    await ensureUniversalSportsSchema(db, year);
    const ingestion = await ingestMlbYesterdayData(db, year);
    const trends = await refreshMlbPlayerTrendScores(db, year);
    console.log('[ingestMlbDailyAt4am] done', JSON.stringify({ ingestion, trends }));
    return null;
  }
);

exports.initializeUniversalSportsSchema = onCall(
  { region: 'us-central1', cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');
    const year = Number((request.data && request.data.year) || getCurrentYear(new Date()));
    const db = getFirestore();
    await ensureUniversalSportsSchema(db, year);
    return { ok: true, year };
  }
);

exports.analyzeMlbPlayerTrends = onCall(
  { region: 'us-central1', cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');
    const year = Number((request.data && request.data.year) || getCurrentYear(new Date()));
    const db = getFirestore();
    const result = await refreshMlbPlayerTrendScores(db, year);
    return { ok: true, year, ...result };
  }
);

async function runMlbPropPrediction(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');
  const year = Number((request.data && request.data.year) || getCurrentYear(new Date()));
  const playerId = String((request.data && request.data.playerId) || '').trim();
  if (!playerId) throw new HttpsError('invalid-argument', 'playerId es requerido.');
  const customLines = request.data && request.data.lines && typeof request.data.lines === 'object'
    ? request.data.lines
    : {};
  const db = getFirestore();
  const refs = getUniversalSeasonRefs(db, 'mlb', year);
  const snap = await refs.playerAveragesCollection.doc(playerId).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'No hay datos MLB para playerId=' + playerId);
  }
  const data = snap.data();
  const history = Array.isArray(data.rollingHistory) ? data.rollingHistory.slice(-10) : [];
  if (!history.length) {
    throw new HttpsError('failed-precondition', 'El jugador no tiene historial suficiente.');
  }
  const predictions = {};
  MLB_PROP_METRICS.forEach((metric) => {
    const values = history.map((h) => Number(h.metrics && h.metrics[metric] ? h.metrics[metric] : 0));
    const avg = mean(values);
    const sd = stdDev(values, avg);
    const fallbackLine = Number(data.seasonAverages && data.seasonAverages[metric] ? data.seasonAverages[metric] : avg);
    const line = Number(customLines[metric] != null ? customLines[metric] : fallbackLine);
    const overProbability = estimateOverProbability(values, line);
    predictions[metric] = {
      line: Number(line.toFixed(2)),
      overProbability: Number(overProbability.toFixed(3)),
      underProbability: Number((1 - overProbability).toFixed(3)),
      sampleAvg: Number(avg.toFixed(3)),
      sampleStdDev: Number(sd.toFixed(3)),
    };
  });
  const formScore = Number(data.form && Number.isFinite(data.form.score) ? data.form.score : 50);
  const volatility = Math.max(
    predictions.strikeouts.sampleStdDev,
    predictions.earned_runs.sampleStdDev,
    predictions.total_bases.sampleStdDev,
    predictions.stolen_bases.sampleStdDev
  );
  const confidenceScore = buildConfidenceScore(history.length, volatility, formScore);
  return {
    sport: 'mlb',
    season: String(year),
    playerId,
    playerName: data.playerName || null,
    recentGamesUsed: history.length,
    form: data.form || null,
    predictions,
    confidenceScore,
    generatedAt: new Date().toISOString(),
  };
}

exports.getMlbPropPredictions = onCall(
  { region: 'us-central1', cors: ALLOWED_ORIGINS },
  async (request) => runMlbPropPrediction(request)
);

// Compatibility aliases for frontend bridge naming variants.
// Same handler: app.js calls getMlbAgentPrediction first, then getMLBAgentPrediction (capital MLB).
const _getMlbAgentPredictionCallable = onCall(
  { region: 'us-central1', cors: ALLOWED_ORIGINS },
  async (request) => runMlbPropPrediction(request)
);
exports.getMlbAgentPrediction = _getMlbAgentPredictionCallable;
exports.getMLBAgentPrediction = _getMlbAgentPredictionCallable;

// ════════════════════════════════════════════════════════════════════════════
// getSportsOdds — secure proxy with cache + rate limiting
// ════════════════════════════════════════════════════════════════════════════
exports.getSportsOdds = onCall(
  {
    region: 'us-central1',
    secrets: [ODDS_API_KEY],
    cors: ALLOWED_ORIGINS,
    // App Check remains enabled in frontend when configured, but this endpoint
    // does not hard-require it while production site key is pending.
    enforceAppCheck: false,
  },
  async (request) => {
    const sport    = (request.data && request.data.sport) || 'NBA';
    const sportKey = SPORT_MAP[sport];
    if (!sportKey) throw new HttpsError('invalid-argument', 'Deporte no válido: ' + sport);

    const identity = getRequestIdentity(request);
    const uid = identity.uid;
    const db  = getFirestore();
    console.log(`[getSportsOdds] uid=${uid} sport=${sport} guest=${identity.isGuest}`);

    // ── Rate Limit (Firestore transaction) ────────────────────────────────
    const userRef = db.doc('users/' + uid);
    const allowed = await db.runTransaction(async (txn) => {
      const snap   = await txn.get(userRef);
      const data   = snap.exists ? snap.data() : {};
      const isPro  = !identity.isGuest && data.planType === 'pro';
      const limit  = isPro ? PRO_LIMIT : FREE_LIMIT;
      const now    = Date.now();
      const winTS  = data.hourlyRequests && data.hourlyRequests.windowStart
                     ? data.hourlyRequests.windowStart.toMillis() : 0;
      const inWin  = (now - winTS) < WINDOW_MS;
      const count  = inWin ? (data.hourlyRequests && data.hourlyRequests.count || 0) : 0;

      if (count >= limit) return { ok: false, isPro, count, limit };

      const newStart = inWin && data.hourlyRequests && data.hourlyRequests.windowStart
                       ? data.hourlyRequests.windowStart : new Date(now);
      txn.set(userRef, {
        hourlyRequests: { count: count + 1, windowStart: newStart },
        planType: data.planType || 'free',
      }, { merge: true });

      return { ok: true, isPro, count: count + 1, limit };
    });

    if (!allowed.ok) {
      const msg = allowed.isPro
        ? 'Límite de seguridad alcanzado. Inténtalo en unos minutos.'
        : `¡Has usado tus ${allowed.limit} consultas gratis esta hora! Actualiza a Pro para consultas ilimitadas.`;
      const cacheRefLimit = db.doc('cache_odds/' + sport);
      const cacheSnapLimit = await cacheRefLimit.get();
      let cachedOdds = [];
      let staleMs = null;
      if (cacheSnapLimit.exists) {
        const c = cacheSnapLimit.data();
        const cachedAtMs = c.cachedAt ? c.cachedAt.toMillis() : 0;
        if (Array.isArray(c.data) && c.data.length > 0) {
          cachedOdds = c.data;
          staleMs = cachedAtMs ? (Date.now() - cachedAtMs) : null;
        }
      }
      // Return 200 to avoid noisy 429 client console errors.
      return {
        odds: cachedOdds,
        cached: cachedOdds.length > 0,
        stale: staleMs != null ? staleMs > CACHE_TTL_MS : false,
        staleMs,
        rateLimited: true,
        message: msg,
        remaining: 0,
        retryAfterSec: 60,
      };
    }
    console.log(`[getSportsOdds] rate ok: ${allowed.count}/${allowed.limit}`);

    // ── Firestore Cache (10-min TTL) ──────────────────────────────────────
    const cacheRef  = db.doc('cache_odds/' + sport);
    const cacheSnap = await cacheRef.get();
    if (cacheSnap.exists) {
      const c   = cacheSnap.data();
      const age = Date.now() - (c.cachedAt ? c.cachedAt.toMillis() : 0);
      if (age < CACHE_TTL_MS && Array.isArray(c.data) && c.data.length > 0) {
        console.log(`[getSportsOdds] serving from cache (age=${Math.round(age/1000)}s)`);
        return { odds: c.data, cached: true, remaining: allowed.limit - allowed.count };
      }
    }

    // ── Live Fetch ────────────────────────────────────────────────────────
    const apiKey = ODDS_API_KEY.value();
    const url    = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads&bookmakers=draftkings,fanduel&oddsFormat=american`;
    console.log(`[getSportsOdds] fetching live odds for ${sport}`);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new HttpsError('unavailable', `Odds API error ${res.status}`);
      const data = await res.json();
      cacheRef.set({ data, cachedAt: FieldValue.serverTimestamp() }).catch(() => {});
      return { odds: data, cached: false, remaining: allowed.limit - allowed.count };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', 'Error de red: ' + err.message);
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// getSportsEvents — MLB mock feed backed by Firestore sports_events
// ════════════════════════════════════════════════════════════════════════════
exports.getSportsEvents = onCall(
  { region: 'us-central1', cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');
    const sport = ((request.data && request.data.sport) || 'MLB').toUpperCase();
    if (sport !== 'MLB') {
      return { sport, source: 'unsupported', events: [] };
    }

    const db = getFirestore();
    const col = db.collection(SPORTS_EVENTS_COLLECTION);
    const existing = await col.where('sport', '==', sport).limit(10).get();

    if (existing.empty) {
      const batch = db.batch();
      MLB_PROPS_MOCK.forEach((event) => {
        const ref = col.doc(event.eventId);
        batch.set(ref, {
          ...event,
          updatedAt: FieldValue.serverTimestamp(),
          source: 'mock',
        });
      });
      await batch.commit();
    }

    const snap = await col
      .where('sport', '==', sport)
      .orderBy('startsAt', 'asc')
      .limit(10)
      .get();

    const events = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        eventId: data.eventId || doc.id,
        sport: data.sport || sport,
        startsAt: data.startsAt || null,
        status: data.status || 'scheduled',
        teams: data.teams || {},
        pitcherProps: Array.isArray(data.pitcherProps) ? data.pitcherProps : [],
        batterProps: Array.isArray(data.batterProps) ? data.batterProps : [],
        gameProps: Array.isArray(data.gameProps) ? data.gameProps : [],
        source: data.source || 'mock',
      };
    });

    return { sport, source: 'firestore', events };
  }
);

// ════════════════════════════════════════════════════════════════════════════
// getStandings — serves Firestore cache; graceful fail if empty
// ════════════════════════════════════════════════════════════════════════════
exports.getStandings = onCall(
  { region: 'us-central1', cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');

    const sport = ((request.data && request.data.sport) || 'NBA').toUpperCase();
    console.log(`[getStandings] sport=${sport} uid=${request.auth.uid}`);

    if (!SPORT_MAP[sport]) {
      throw new HttpsError('invalid-argument', 'Deporte no válido: ' + sport);
    }

    try {
      const db   = getFirestore();
      const snap = await db.doc('standings/' + sport).get();
      const result = serializeSnap(snap);
      console.log(`[getStandings] returning source=${result.source} teams=${result.teams.length}`);
      return result;
    } catch (err) {
      // Never return 500 — graceful degradation
      console.error('[getStandings] ERROR:', err.message, err.stack);
      return { teams: [], updatedAt: null, source: 'error', isDemo: true, error: err.message };
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// seedStandings — ONE-TIME callable to populate Firestore from ESPN right now.
// Call from browser console: firebase.functions().httpsCallable('seedStandings')({})
// Or call from the SDK in the browser once Firebase is initialized.
// ════════════════════════════════════════════════════════════════════════════
exports.seedStandings = onCall(
  { region: 'us-central1', cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');
    console.log('[seedStandings] called by uid=' + request.auth.uid);

    const db      = getFirestore();
    const results = {};

    await Promise.all(
      Object.keys(ESPN_URLS).map(async (sport) => {
        try {
          const teams = await fetchEspnStandings(sport);
          if (teams.length > 0) {
            await db.doc('standings/' + sport).set({
              teams,
              updatedAt: FieldValue.serverTimestamp(),
            });
            results[sport] = { ok: true, teams: teams.length };
            console.log(`[seedStandings] ${sport} → ${teams.length} teams written`);
          } else {
            results[sport] = { ok: false, reason: 'empty parse result' };
            console.warn(`[seedStandings] ${sport} → no teams parsed`);
          }
        } catch (err) {
          results[sport] = { ok: false, reason: err.message };
          console.error(`[seedStandings] ${sport} error:`, err.message);
        }
      })
    );

    return { results, seededAt: new Date().toISOString() };
  }
);

// ════════════════════════════════════════════════════════════════════════════
// getUserPlan — returns planType + remaining requests for the current user
// ════════════════════════════════════════════════════════════════════════════
exports.getUserPlan = onCall(
  { region: 'us-central1', cors: ALLOWED_ORIGINS, enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');

    try {
      const db   = getFirestore();
      const snap = await db.doc('users/' + request.auth.uid).get();
      if (!snap.exists) return { planType: 'free', remaining: FREE_LIMIT, canManageBilling: false };

      const d     = snap.data();
      const isPro = d.planType === 'pro';
      const limit = isPro ? PRO_LIMIT : FREE_LIMIT;
      const now   = Date.now();
      const winMS = d.hourlyRequests && d.hourlyRequests.windowStart
                    ? d.hourlyRequests.windowStart.toMillis() : 0;
      const inWin = (now - winMS) < WINDOW_MS;
      const used  = inWin ? (d.hourlyRequests && d.hourlyRequests.count || 0) : 0;

      return {
        planType: d.planType || 'free',
        remaining: Math.max(0, limit - used),
        canManageBilling: !!(d.stripeCustomerId && String(d.stripeCustomerId).trim()),
      };
    } catch (err) {
      console.error('[getUserPlan] ERROR:', err.message);
      return { planType: 'free', remaining: FREE_LIMIT, canManageBilling: false };
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// createCheckoutSession — Stripe Checkout for Pro subscription
// ════════════════════════════════════════════════════════════════════════════
exports.createCheckoutSession = onCall(
  {
    region: 'us-central1',
    cors: ALLOWED_ORIGINS,
    enforceAppCheck: true,
    secrets: [STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');

    const uid = request.auth.uid;
    const stripe = createStripeClient(resolveStripeApiKey(STRIPE_SECRET_KEY));
    const priceId = await resolveProPriceId(stripe, STRIPE_PRO_PRICE_ID);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: PRO_SUCCESS_URL,
      cancel_url: PRO_CANCEL_URL,
      client_reference_id: uid,
      metadata: { uid, planType: 'pro' },
      subscription_data: { metadata: { uid, planType: 'pro' } },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      // Wallets like Apple Pay / Google Pay are surfaced by Checkout when available.
      // Cash App Pay can also be offered by Checkout with automatic payment methods.
      automatic_payment_methods: { enabled: true },
    });

    if (!session.url) {
      throw new HttpsError('internal', 'Stripe did not return a checkout URL.');
    }
    return { sessionId: session.id, url: session.url };
  }
);

// ════════════════════════════════════════════════════════════════════════════
// createCustomerPortalSession — Stripe Billing Portal (invoices, PM, cancel)
// Requires Customer Portal enabled in Stripe Dashboard → Settings → Billing → Customer portal.
// ════════════════════════════════════════════════════════════════════════════
exports.createCustomerPortalSession = onCall(
  {
    region: 'us-central1',
    cors: ALLOWED_ORIGINS,
    enforceAppCheck: true,
    secrets: [STRIPE_SECRET_KEY],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');

    const uid = request.auth.uid;
    const db = getFirestore();
    const snap = await db.doc('users/' + uid).get();
    if (!snap.exists) {
      throw new HttpsError('failed-precondition', 'No hay cuenta de facturación. Completa una suscripción Pro primero.');
    }
    const customerId = snap.data().stripeCustomerId;
    if (!customerId || !String(customerId).trim()) {
      throw new HttpsError(
        'failed-precondition',
        'No hay cliente de Stripe vinculado. Si acabas de pagar, espera unos segundos o contacta soporte.'
      );
    }

    const stripe = createStripeClient(resolveStripeApiKey(STRIPE_SECRET_KEY));
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: String(customerId).trim(),
      return_url: STRIPE_PORTAL_RETURN_URL,
    });

    if (!portalSession.url) {
      throw new HttpsError('internal', 'Stripe no devolvió URL del portal.');
    }
    return { url: portalSession.url };
  }
);

// ════════════════════════════════════════════════════════════════════════════
// stripeWebhook — validates Stripe signature and upgrades users to Pro
// ════════════════════════════════════════════════════════════════════════════
exports.stripeWebhook = onRequest(
  {
    region: 'us-central1',
    cors: false,
    secrets: [STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    let event = req.body;
    const webhookSecret = String(STRIPE_WEBHOOK_SECRET.value() || '').trim() || getStripeWebhookSecretLegacy();
    const stripe = createStripeClient(resolveStripeApiKey(STRIPE_SECRET_KEY));

    if (!webhookSecret) {
      console.error('[stripeWebhook] STRIPE_WEBHOOK_SECRET missing. Rejecting unsigned webhook.');
      res.status(500).send('Webhook secret not configured.');
      return;
    }

    const signature = req.headers['stripe-signature'];
    if (!signature) {
      res.status(400).send('Missing Stripe signature.');
      return;
    }
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    } catch (err) {
      console.error('[stripeWebhook] signature verification failed:', err.message);
      res.status(400).send('Invalid Stripe webhook signature.');
      return;
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data && event.data.object ? event.data.object : {};
        const uid = (session.metadata && session.metadata.uid)
          || session.client_reference_id
          || null;
        const subscriptionId = session.subscription || null;
        if (uid && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertUserProPlan(uid, subscription);
        }
      }

      if (event.type === 'invoice.paid') {
        const invoice = event.data && event.data.object ? event.data.object : {};
        const subscriptionId = invoice.subscription || null;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const uid = (subscription.metadata && subscription.metadata.uid) || null;
          if (uid) await upsertUserProPlan(uid, subscription);
        }
      }

      if (event.type === 'invoice.payment_failed') {
        const invoice = event.data && event.data.object ? event.data.object : {};
        const subscriptionId = invoice.subscription || null;
        const uid = (invoice.metadata && invoice.metadata.uid) || null;
        if (uid) {
          await markUserPlanInactiveByUid(uid);
        } else if (subscriptionId) {
          await markUserPlanInactiveBySubscriptionId(subscriptionId);
        }
      }

      if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
        const subscription = event.data && event.data.object ? event.data.object : {};
        const status = subscription.status;
        const uid = (subscription.metadata && subscription.metadata.uid) || null;
        if (uid && (status === 'active' || status === 'trialing')) {
          await upsertUserProPlan(uid, subscription);
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data && event.data.object ? event.data.object : {};
        const uid = (subscription.metadata && subscription.metadata.uid) || null;
        if (uid) {
          await markUserPlanInactiveByUid(uid);
        } else {
          await markUserPlanInactiveBySubscriptionId(subscription.id || null);
        }
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error('[stripeWebhook] handler error:', err.message);
      res.status(500).send('Webhook handler error.');
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// onVoteCreated — Firestore trigger: updates global accuracy counter server-side
// ════════════════════════════════════════════════════════════════════════════
exports.onVoteCreated = onDocumentCreated(
  { document: 'sportsVotes/{voteId}', region: 'us-central1' },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data) return;
    console.log('[onVoteCreated] vote=' + data.vote + ' sport=' + data.sport);
    const db    = getFirestore();
    const field = data.vote === 'yes' ? 'yes' : 'no';
    await db.doc('sportsAccuracy/global').set(
      { [field]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
);

// ════════════════════════════════════════════════════════════════════════════
// updateStandings — Scheduled: runs every 2h, fetches ESPN (free, no key)
// ════════════════════════════════════════════════════════════════════════════
exports.updateStandings = onSchedule(
  { schedule: 'every 2 hours', region: 'us-central1', timeoutSeconds: 60 },
  async () => {
    console.log('[updateStandings] starting scheduled run');
    const db = getFirestore();

    await Promise.all(
      Object.keys(ESPN_URLS).map(async (sport) => {
        try {
          const teams = await fetchEspnStandings(sport);
          if (teams.length === 0) {
            console.warn(`[updateStandings] ${sport} returned 0 teams — skipping write`);
            return;
          }
          await db.doc('standings/' + sport).set({
            teams,
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log(`[updateStandings] ${sport} updated: ${teams.length} teams`);
        } catch (err) {
          console.error(`[updateStandings] ${sport} FAILED:`, err.message);
        }
      })
    );

    console.log('[updateStandings] done');
  }
);

// ════════════════════════════════════════════════════════════════════════════
// Lottery Agent Brain — adaptive training + ingestion + insights
// ════════════════════════════════════════════════════════════════════════════
const LOTTERY_GAMES = {
  powerball: { mainPool: 69, mainCount: 5, bonusPool: 26, bonusField: 'powerball' },
  megamillions: { mainPool: 70, mainCount: 5, bonusPool: 25, bonusField: 'megaBall' },
};
const LOTTERY_WINDOWS = [100, 500, 1000];
const LOTTERY_MIN_BACKTEST_DRAWS = 40;

function normalizeGameType(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  if (key === 'powerball') return 'powerball';
  if (key === 'megamillions') return 'megamillions';
  return null;
}

function parseGameTypeFromHistoryDoc(historyDocId) {
  const raw = String(historyDocId || '');
  const idx = raw.lastIndexOf('_');
  const gamePart = idx > 0 ? raw.slice(0, idx) : raw;
  return normalizeGameType(gamePart);
}

function parseYearFromHistoryDoc(historyDocId, fallbackDate) {
  const raw = String(historyDocId || '');
  const idx = raw.lastIndexOf('_');
  const yearCandidate = idx > 0 ? Number(raw.slice(idx + 1)) : NaN;
  if (Number.isInteger(yearCandidate) && yearCandidate >= 2000 && yearCandidate <= 2100) {
    return yearCandidate;
  }
  return fallbackDate.getUTCFullYear();
}

function normalizeDraw(rawDraw, gameType, now = new Date()) {
  const cfg = LOTTERY_GAMES[gameType];
  if (!cfg) return null;

  const drawDateRaw = rawDraw.drawDate || rawDraw.date || rawDraw.drawingDate || now.toISOString();
  const drawDate = new Date(drawDateRaw);
  if (Number.isNaN(drawDate.getTime())) return null;

  const mainNumbersRaw = Array.isArray(rawDraw.mainNumbers) ? rawDraw.mainNumbers : rawDraw.numbers;
  const mainNumbers = (mainNumbersRaw || [])
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= cfg.mainPool)
    .sort((a, b) => a - b);
  if (mainNumbers.length !== cfg.mainCount) return null;

  const bonusNumber = Number(rawDraw.bonusNumber || rawDraw[cfg.bonusField]);
  if (!Number.isInteger(bonusNumber) || bonusNumber < 1 || bonusNumber > cfg.bonusPool) return null;

  return {
    gameType,
    drawDateIso: drawDate.toISOString(),
    drawId: String(rawDraw.drawId || drawDate.toISOString().slice(0, 10)),
    mainNumbers,
    bonusNumber,
    source: String(rawDraw.source || 'unknown'),
  };
}

function extractNumbersFromText(text) {
  return String(text || '')
    .split(/[^0-9]+/)
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function parseNumbersFromOfficialItem(item, gameType) {
  const cfg = LOTTERY_GAMES[gameType];
  if (!cfg || !item) return null;

  const winningText = item.field_winning_numbers || item.winningNumbers || item.winning_numbers || '';
  const parsed = extractNumbersFromText(winningText);
  if (!parsed.length && Array.isArray(item.numbers)) {
    parsed.push(...item.numbers.map((v) => Number(v)));
  }
  if (parsed.length < cfg.mainCount + 1) return null;

  const mainNumbers = parsed
    .slice(0, cfg.mainCount)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= cfg.mainPool)
    .sort((a, b) => a - b);
  const bonusNumber = Number(parsed[cfg.mainCount]);
  if (mainNumbers.length !== cfg.mainCount || !Number.isInteger(bonusNumber)) return null;

  const drawDateRaw = item.field_draw_date || item.drawDate || item.date || item.drawingDate;
  return normalizeDraw({
    drawDate: drawDateRaw,
    mainNumbers,
    bonusNumber,
    source: 'official_api',
    drawId: drawDateRaw ? String(drawDateRaw).slice(0, 10) : undefined,
  }, gameType);
}

function buildMockDraw(gameType, when = new Date()) {
  const cfg = LOTTERY_GAMES[gameType];
  if (!cfg) return null;
  const seed = Number(String(when.toISOString().slice(0, 10)).replace(/-/g, ''));
  let state = seed;
  const next = (mod) => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return (state % mod) + 1;
  };
  const used = new Set();
  const mainNumbers = [];
  while (mainNumbers.length < cfg.mainCount) {
    const n = next(cfg.mainPool);
    if (used.has(n)) continue;
    used.add(n);
    mainNumbers.push(n);
  }
  mainNumbers.sort((a, b) => a - b);
  return normalizeDraw({
    drawDate: when.toISOString(),
    mainNumbers,
    bonusNumber: next(cfg.bonusPool),
    source: 'mock_fallback',
    drawId: when.toISOString().slice(0, 10),
  }, gameType, when);
}

async function fetchOfficialDrawsForGame(gameType) {
  const endpointByGame = {
    powerball: 'https://www.powerball.com/api/v1/numbers/powerball/recent10?_format=json',
    megamillions: 'https://www.powerball.com/api/v1/numbers/mega-millions/recent10?_format=json',
  };
  const url = endpointByGame[gameType];
  if (!url) return [];

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('status_' + res.status);
    const body = await res.json();
    const arr = Array.isArray(body) ? body : [];
    return arr
      .map((item) => parseNumbersFromOfficialItem(item, gameType))
      .filter((draw) => !!draw);
  } catch (err) {
    // TODO: Reemplazar fallback mock por proveedor oficial secundario cuando se valide un endpoint estable.
    console.warn('[fetchOfficialDrawsForGame] fallback mock for ' + gameType + ':', err.message);
    const mock = buildMockDraw(gameType, new Date());
    return mock ? [mock] : [];
  }
}

function createFrequencyMap(maxNumber) {
  const out = {};
  for (let i = 1; i <= maxNumber; i += 1) out[String(i)] = 0;
  return out;
}

function getRecentDraws(draws, limit) {
  if (!draws.length) return [];
  if (draws.length <= limit) return draws;
  return draws.slice(draws.length - limit);
}

function computeWindowFrequency(draws, maxNumber) {
  const freq = createFrequencyMap(maxNumber);
  draws.forEach((draw) => {
    (draw.mainNumbers || []).forEach((n) => {
      const key = String(n);
      if (key in freq) freq[key] += 1;
    });
  });
  return freq;
}

function computeGapAverages(draws, maxNumber) {
  const stats = {};
  for (let i = 1; i <= maxNumber; i += 1) {
    stats[String(i)] = { lastSeen: null, sumGap: 0, countGap: 0, averageGap: null, currentGap: draws.length };
  }
  draws.forEach((draw, idx) => {
    const present = new Set((draw.mainNumbers || []).map((n) => String(n)));
    Object.keys(stats).forEach((key) => {
      const item = stats[key];
      if (!present.has(key)) return;
      if (item.lastSeen !== null) {
        item.sumGap += (idx - item.lastSeen);
        item.countGap += 1;
      }
      item.lastSeen = idx;
      item.currentGap = draws.length - idx - 1;
    });
  });
  Object.keys(stats).forEach((key) => {
    const item = stats[key];
    item.averageGap = item.countGap > 0 ? Number((item.sumGap / item.countGap).toFixed(3)) : null;
    delete item.lastSeen;
    delete item.sumGap;
    delete item.countGap;
  });
  return stats;
}

function computeTrendStats(draws) {
  if (!draws.length) {
    return { avgEven: 0, avgOdd: 0, avgSum: 0, minSum: 0, maxSum: 0 };
  }
  let totalEven = 0;
  let totalOdd = 0;
  let totalSum = 0;
  let minSum = Number.POSITIVE_INFINITY;
  let maxSum = Number.NEGATIVE_INFINITY;
  draws.forEach((draw) => {
    const nums = draw.mainNumbers || [];
    const sum = nums.reduce((acc, n) => acc + n, 0);
    const even = nums.filter((n) => n % 2 === 0).length;
    const odd = nums.length - even;
    totalEven += even;
    totalOdd += odd;
    totalSum += sum;
    minSum = Math.min(minSum, sum);
    maxSum = Math.max(maxSum, sum);
  });
  return {
    avgEven: Number((totalEven / draws.length).toFixed(3)),
    avgOdd: Number((totalOdd / draws.length).toFixed(3)),
    avgSum: Number((totalSum / draws.length).toFixed(3)),
    minSum: Number.isFinite(minSum) ? minSum : 0,
    maxSum: Number.isFinite(maxSum) ? maxSum : 0,
  };
}

function predictCandidateFromHistory(historyDraws, gameType, weights) {
  const cfg = LOTTERY_GAMES[gameType];
  if (!cfg) return null;
  const freq100 = computeWindowFrequency(getRecentDraws(historyDraws, 100), cfg.mainPool);
  const freq500 = computeWindowFrequency(getRecentDraws(historyDraws, 500), cfg.mainPool);
  const gaps = computeGapAverages(historyDraws, cfg.mainPool);
  const trend = computeTrendStats(historyDraws);
  const w = {
    hot100: Number(weights && weights.hot100) || 1,
    warm500: Number(weights && weights.warm500) || 0.6,
    gapPressure: Number(weights && weights.gapPressure) || 0.9,
  };

  const candidates = [];
  for (let i = 1; i <= cfg.mainPool; i += 1) {
    const key = String(i);
    const gapData = gaps[key] || {};
    const avgGap = Number(gapData.averageGap || 0);
    const currentGap = Number(gapData.currentGap || 0);
    const gapPressure = avgGap > 0 ? Math.min(2, currentGap / avgGap) : 0;
    const score = (freq100[key] * w.hot100) + (freq500[key] * w.warm500) + (gapPressure * w.gapPressure);
    candidates.push({ number: i, score });
  }
  candidates.sort((a, b) => b.score - a.score || a.number - b.number);

  const mainNumbers = candidates.slice(0, cfg.mainCount).map((item) => item.number).sort((a, b) => a - b);
  const bonusNumber = ((mainNumbers.reduce((acc, n) => acc + n, 0) % cfg.bonusPool) || 1);
  return { mainNumbers, bonusNumber, trend };
}

function computeAccuracy(predictions, actualDraws, mainCount) {
  if (!predictions.length || !actualDraws.length) return 0;
  let score = 0;
  const size = Math.min(predictions.length, actualDraws.length);
  for (let i = 0; i < size; i += 1) {
    const p = new Set(predictions[i].mainNumbers || []);
    const a = new Set(actualDraws[i].mainNumbers || []);
    let hits = 0;
    p.forEach((n) => {
      if (a.has(n)) hits += 1;
    });
    score += hits / mainCount;
  }
  return Number((score / size).toFixed(4));
}

function tuneWeights(backtestSummary) {
  const base = { hot100: 1, warm500: 0.6, gapPressure: 0.9 };
  const accuracy = Number(backtestSummary && backtestSummary.accuracy) || 0;
  if (accuracy >= 0.45) return { ...base };
  if (accuracy >= 0.35) return { hot100: 1.1, warm500: 0.55, gapPressure: 1.0 };
  return { hot100: 1.2, warm500: 0.45, gapPressure: 1.15 };
}

async function runBacktesting(draws, gameType, existingWeights) {
  const cfg = LOTTERY_GAMES[gameType];
  if (!cfg || draws.length < LOTTERY_MIN_BACKTEST_DRAWS) {
    return {
      method: 'rolling_frequency_gap_v1',
      drawsEvaluated: 0,
      accuracy: 0,
      weightsUsed: existingWeights || { hot100: 1, warm500: 0.6, gapPressure: 0.9 },
      tunedWeights: existingWeights || { hot100: 1, warm500: 0.6, gapPressure: 0.9 },
    };
  }

  const testStart = Math.max(20, Math.floor(draws.length * 0.7));
  const predicted = [];
  const actual = [];
  for (let i = testStart; i < draws.length; i += 1) {
    const history = draws.slice(0, i);
    const pred = predictCandidateFromHistory(history, gameType, existingWeights);
    if (!pred) continue;
    predicted.push(pred);
    actual.push(draws[i]);
  }
  const accuracy = computeAccuracy(predicted, actual, cfg.mainCount);
  const summary = {
    method: 'rolling_frequency_gap_v1',
    drawsEvaluated: predicted.length,
    accuracy,
    weightsUsed: existingWeights || { hot100: 1, warm500: 0.6, gapPressure: 0.9 },
  };
  return { ...summary, tunedWeights: tuneWeights(summary) };
}

async function loadGameDraws(db, gameType, limit = 1200) {
  const prefix = gameType + '_';
  const historySnap = await db.collection('lottery_history').get();
  const targetHistoryDocs = historySnap.docs
    .map((doc) => doc.id)
    .filter((id) => id.startsWith(prefix))
    .sort();

  const draws = [];
  for (const historyId of targetHistoryDocs) {
    const drawsSnap = await db.collection('lottery_history/' + historyId + '/draws')
      .orderBy('drawDate', 'asc')
      .limit(limit)
      .get();
    drawsSnap.forEach((doc) => {
      const normalized = normalizeDraw({
        drawId: doc.id,
        drawDate: doc.data().drawDate,
        mainNumbers: doc.data().mainNumbers,
        bonusNumber: doc.data().bonusNumber,
        source: doc.data().source || 'firestore',
      }, gameType);
      if (normalized) draws.push({ ...normalized, drawPath: doc.ref.path });
    });
  }
  draws.sort((a, b) => new Date(a.drawDateIso).getTime() - new Date(b.drawDateIso).getTime());
  return draws.slice(-limit);
}

async function trainModelForGame(db, gameType) {
  const cfg = LOTTERY_GAMES[gameType];
  if (!cfg) throw new Error('unsupported_game_' + gameType);
  const draws = await loadGameDraws(db, gameType);
  if (!draws.length) {
    return { ok: false, reason: 'no_draws' };
  }

  const windowStats = {};
  LOTTERY_WINDOWS.forEach((w) => {
    if (draws.length >= w) {
      windowStats[String(w)] = computeWindowFrequency(getRecentDraws(draws, w), cfg.mainPool);
    } else if (draws.length > 0) {
      windowStats[String(w)] = computeWindowFrequency(draws, cfg.mainPool);
    }
  });
  const gaps = computeGapAverages(draws, cfg.mainPool);
  const trends = computeTrendStats(draws);

  const modelRef = db.doc('prediction_models/' + gameType);
  const modelSnap = await modelRef.get();
  const existingWeights = modelSnap.exists && modelSnap.data().weights ? modelSnap.data().weights : null;
  const backtesting = await runBacktesting(draws, gameType, existingWeights);
  const recommendation = predictCandidateFromHistory(draws, gameType, backtesting.tunedWeights);

  await modelRef.set({
    gameType,
    totalDraws: draws.length,
    windows: windowStats,
    gaps,
    trends,
    backtesting,
    weights: backtesting.tunedWeights,
    latestRecommendation: recommendation,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.doc('agent_intelligence/' + gameType).set({
    gameType,
    snapshotAt: FieldValue.serverTimestamp(),
    totalDraws: draws.length,
    backtesting: {
      method: backtesting.method,
      drawsEvaluated: backtesting.drawsEvaluated,
      accuracy: backtesting.accuracy,
    },
    trends,
    recommendation,
  }, { merge: true });

  return {
    ok: true,
    totalDraws: draws.length,
    backtestingAccuracy: backtesting.accuracy,
    recommendation,
  };
}

exports.trainLotteryAgent = onDocumentCreated(
  { document: 'lottery_history/{historyId}/draws/{drawId}', region: 'us-central1', timeoutSeconds: 180 },
  async (event) => {
    const historyId = event.params && event.params.historyId ? String(event.params.historyId) : '';
    const gameType = parseGameTypeFromHistoryDoc(historyId);
    if (!gameType) {
      console.warn('[trainLotteryAgent] unsupported history id: ' + historyId);
      return null;
    }
    const db = getFirestore();
    const result = await trainModelForGame(db, gameType);
    console.log('[trainLotteryAgent] trained', JSON.stringify({ gameType, historyId, result }));
    return null;
  }
);

exports.ingestOfficialLotteryResults = onSchedule(
  { schedule: 'every 6 hours', region: 'us-central1', timeoutSeconds: 180 },
  async () => {
    const db = getFirestore();
    const now = new Date();
    const report = [];

    for (const gameType of Object.keys(LOTTERY_GAMES)) {
      const fetched = await fetchOfficialDrawsForGame(gameType);
      if (!fetched.length) {
        report.push({ gameType, inserted: 0, source: 'none' });
        continue;
      }

      let inserted = 0;
      for (const draw of fetched) {
        const year = parseYearFromHistoryDoc('', new Date(draw.drawDateIso));
        const historyId = gameType + '_' + year;
        const drawId = draw.drawId || draw.drawDateIso.slice(0, 10);
        const drawRef = db.doc('lottery_history/' + historyId + '/draws/' + drawId);
        const exists = await drawRef.get();
        if (exists.exists) continue;
        await drawRef.set({
          gameType,
          drawDate: draw.drawDateIso,
          mainNumbers: draw.mainNumbers,
          bonusNumber: draw.bonusNumber,
          source: draw.source,
          ingestedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        inserted += 1;
      }

      // TODO: Evaluar deduplicación cross-year avanzada si un proveedor publica fechas con timezone ambiguo.
      report.push({
        gameType,
        inserted,
        source: fetched[0].source || 'unknown',
        attemptedAt: now.toISOString(),
      });
    }

    console.log('[ingestOfficialLotteryResults] report', JSON.stringify(report));
    return null;
  }
);

exports.getLotteryAgentInsight = onCall(
  { region: 'us-central1', cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes estar autenticado para obtener insights.');
    }
    const gameType = normalizeGameType(request.data && request.data.gameType);
    if (!gameType) {
      throw new HttpsError('invalid-argument', 'gameType inválido. Usa powerball o megaMillions.');
    }
    const db = getFirestore();
    let modelSnap = await db.doc('prediction_models/' + gameType).get();
    if (!modelSnap.exists) {
      await trainModelForGame(db, gameType);
      modelSnap = await db.doc('prediction_models/' + gameType).get();
    }
    if (!modelSnap.exists) {
      throw new HttpsError('failed-precondition', 'No hay suficiente data para generar insight.');
    }
    const model = modelSnap.data();
    const recommendation = model.latestRecommendation || null;
    const trends = model.trends || {};
    const accuracy = model.backtesting && Number(model.backtesting.accuracy || 0);

    const wisdom = [
      'El agente prioriza frecuencia reciente + presión de gap.',
      'Par/impar promedio: ' + String(trends.avgEven || 0) + '/' + String(trends.avgOdd || 0) + '.',
      'Suma histórica típica: ' + String(trends.avgSum || 0) + '.',
      'Backtesting (simple) accuracy: ' + String(accuracy || 0) + '.',
    ].join(' ');

    return {
      gameType,
      smartPlay: recommendation,
      wisdom,
      modelMeta: {
        totalDraws: model.totalDraws || 0,
        accuracy: accuracy || 0,
        updatedAt: model.updatedAt ? model.updatedAt.toDate().toISOString() : null,
        method: model.backtesting ? model.backtesting.method : null,
      },
    };
  }
);
