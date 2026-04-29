'use strict';

const { onCall, HttpsError }  = require('firebase-functions/v2/https');
const { onDocumentCreated }   = require('firebase-functions/v2/firestore');
const { onSchedule }          = require('firebase-functions/v2/scheduler');
const { defineSecret }        = require('firebase-functions/params');
const { initializeApp }       = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();

// ── Secrets & Constants ───────────────────────────────────────────────────────
const ODDS_API_KEY = defineSecret('ODDS_API_KEY'); // firebase functions:secrets:set ODDS_API_KEY

const SPORT_MAP = {
  NBA: 'basketball_nba',
  MLB: 'baseball_mlb',
  NFL: 'americanfootball_nfl',
};

// ESPN public API — no key required
const ESPN_STANDINGS = {
  NBA: 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings',
  MLB: 'https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings',
  NFL: 'https://site.api.espn.com/apis/v2/sports/football/nfl/standings',
};

const ALLOWED_ORIGINS = [
  'https://www.prediccionloteria.com',
  'https://prediccionloteria.com',
  'https://game-lottery-b0e90.web.app',
];

const CACHE_TTL_MS  = 10 * 60 * 1000; // 10 minutes odds cache
const FREE_LIMIT    = 5;               // requests per hour (free plan)
const PRO_LIMIT     = 200;             // safety cap for pro plan
const WINDOW_MS     = 60 * 60 * 1000; // 1-hour sliding window

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns an American-odds-formatted string, e.g. "+150" or "-110" */
function fmtOdds(v) {
  if (v == null) return '?';
  return (v > 0 ? '+' : '') + v;
}

/** Parses ESPN standings response into a flat array of team objects */
function parseEspnStandings(json) {
  const teams = [];
  const children = json.children || [];
  for (const conf of children) {
    const confName = (conf.abbreviation || conf.name || '').slice(0, 6);
    const entries  = (conf.standings && conf.standings.entries) || [];
    for (const entry of entries) {
      const t   = entry.team || {};
      const stats = entry.stats || [];
      const stat  = (name) => {
        const s = stats.find(x => x.name === name);
        return s ? s.value : null;
      };
      const w   = stat('wins')        || stat('wins')   || 0;
      const l   = stat('losses')      || 0;
      const tot = w + l || 1;
      const pct = (w / tot).toFixed(3).replace('0.', '.');
      const gb  = stat('gamesBehind');
      teams.push({
        team: t.displayName || t.name || '?',
        abbr: t.abbreviation || '?',
        w:    Math.round(w),
        l:    Math.round(l),
        pct:  pct,
        gb:   gb != null && gb > 0 ? String(parseFloat(gb.toFixed(1))) : '—',
        conf: confName,
      });
    }
  }
  return teams;
}

// ── getSportsOdds ─────────────────────────────────────────────────────────────
// Secure proxy with Firestore cache (10 min) and per-user rate limiting.
exports.getSportsOdds = onCall(
  {
    region: 'us-central1',
    secrets: [ODDS_API_KEY],
    cors: ALLOWED_ORIGINS,
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes estar autenticado.');
    }

    const sport    = (request.data && request.data.sport) || 'NBA';
    const sportKey = SPORT_MAP[sport];
    if (!sportKey) {
      throw new HttpsError('invalid-argument', 'Deporte no válido: ' + sport);
    }

    const uid = request.auth.uid;
    const db  = getFirestore();

    // ── 1. Rate Limit Check (Firestore transaction) ───────────────────────
    const userRef = db.doc('users/' + uid);
    const allowed = await db.runTransaction(async (txn) => {
      const snap    = await txn.get(userRef);
      const data    = snap.exists ? snap.data() : {};
      const isPro   = data.planType === 'pro';
      const limit   = isPro ? PRO_LIMIT : FREE_LIMIT;
      const now     = Date.now();
      const winMS   = (data.hourlyRequests && data.hourlyRequests.windowStart)
        ? data.hourlyRequests.windowStart.toMillis() : 0;
      const inWindow = (now - winMS) < WINDOW_MS;
      const count    = inWindow ? (data.hourlyRequests && data.hourlyRequests.count || 0) : 0;

      if (count >= limit) return { ok: false, isPro, count, limit };

      txn.set(userRef, {
        hourlyRequests: {
          count:       count + 1,
          windowStart: inWindow && data.hourlyRequests && data.hourlyRequests.windowStart
            ? data.hourlyRequests.windowStart : new Date(now),
        },
        planType: data.planType || 'free',
      }, { merge: true });

      return { ok: true, isPro, count: count + 1, limit };
    });

    if (!allowed.ok) {
      const msg = allowed.isPro
        ? 'Límite de seguridad alcanzado. Inténtalo en unos minutos.'
        : '¡Has usado tus ' + allowed.limit + ' consultas gratis esta hora! Actualiza a Pro para consultas ilimitadas.';
      throw new HttpsError('resource-exhausted', msg);
    }

    // ── 2. Firestore Cache Check (10-min TTL) ─────────────────────────────
    const cacheRef  = db.doc('cache_odds/' + sport);
    const cacheSnap = await cacheRef.get();
    if (cacheSnap.exists) {
      const c = cacheSnap.data();
      const age = Date.now() - (c.cachedAt ? c.cachedAt.toMillis() : 0);
      if (age < CACHE_TTL_MS && Array.isArray(c.data) && c.data.length > 0) {
        return { odds: c.data, cached: true, remaining: allowed.limit - allowed.count };
      }
    }

    // ── 3. Fetch from The Odds API ────────────────────────────────────────
    const apiKey = ODDS_API_KEY.value();
    const url = 'https://api.the-odds-api.com/v4/sports/' + sportKey +
      '/odds/?apiKey=' + apiKey +
      '&regions=us&markets=h2h,spreads&bookmakers=draftkings,fanduel&oddsFormat=american';

    try {
      const res = await fetch(url);
      if (!res.ok) throw new HttpsError('unavailable', 'Odds API error ' + res.status);
      const data = await res.json();

      // Save to cache (fire-and-forget)
      cacheRef.set({ data, cachedAt: FieldValue.serverTimestamp() }).catch(() => {});

      return { odds: data, cached: false, remaining: allowed.limit - allowed.count };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', 'Error de red: ' + err.message);
    }
  }
);

// ── getStandings ──────────────────────────────────────────────────────────────
// Returns cached standings from Firestore (updated by updateStandings scheduler).
exports.getStandings = onCall(
  { region: 'us-central1', cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');

    const sport = ((request.data && request.data.sport) || 'NBA').toUpperCase();
    if (!SPORT_MAP[sport]) throw new HttpsError('invalid-argument', 'Deporte no válido.');

    const db   = getFirestore();
    const snap = await db.doc('standings/' + sport).get();
    if (!snap.exists) return { teams: [], updatedAt: null };
    const d = snap.data();
    return { teams: d.teams || [], updatedAt: d.updatedAt || null };
  }
);

// ── getUserPlan ───────────────────────────────────────────────────────────────
exports.getUserPlan = onCall(
  { region: 'us-central1', cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');

    const db   = getFirestore();
    const snap = await db.doc('users/' + request.auth.uid).get();
    if (!snap.exists) return { planType: 'free', remaining: FREE_LIMIT };

    const d      = snap.data();
    const isPro  = d.planType === 'pro';
    const limit  = isPro ? PRO_LIMIT : FREE_LIMIT;
    const now    = Date.now();
    const winMS  = d.hourlyRequests && d.hourlyRequests.windowStart
      ? d.hourlyRequests.windowStart.toMillis() : 0;
    const inWin  = (now - winMS) < WINDOW_MS;
    const used   = inWin ? (d.hourlyRequests && d.hourlyRequests.count || 0) : 0;
    return { planType: d.planType || 'free', remaining: Math.max(0, limit - used) };
  }
);

// ── onVoteCreated ─────────────────────────────────────────────────────────────
exports.onVoteCreated = onDocumentCreated(
  { document: 'sportsVotes/{voteId}', region: 'us-central1' },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data) return;
    const db    = getFirestore();
    const field = data.vote === 'yes' ? 'yes' : 'no';
    await db.doc('sportsAccuracy/global').set(
      { [field]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
);

// ── updateStandings (Scheduled) ───────────────────────────────────────────────
// Runs every 2 hours. Fetches NBA/MLB/NFL standings from ESPN's free public API
// and writes them to Firestore so the frontend reads from cache, not ESPN directly.
exports.updateStandings = onSchedule(
  { schedule: 'every 2 hours', region: 'us-central1', timeoutSeconds: 60 },
  async () => {
    const db = getFirestore();
    await Promise.all(
      Object.entries(ESPN_STANDINGS).map(async ([sport, url]) => {
        try {
          const res  = await fetch(url);
          if (!res.ok) { console.warn('ESPN', sport, res.status); return; }
          const json  = await res.json();
          const teams = parseEspnStandings(json);
          if (teams.length === 0) return;
          await db.doc('standings/' + sport).set({
            teams,
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log('Standings updated:', sport, teams.length, 'teams');
        } catch (err) {
          console.error('updateStandings', sport, err.message);
        }
      })
    );
  }
);
