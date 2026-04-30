'use strict';

const { onCall, HttpsError }       = require('firebase-functions/v2/https');
const { onDocumentCreated }        = require('firebase-functions/v2/firestore');
const { onSchedule }               = require('firebase-functions/v2/scheduler');
const { defineSecret }             = require('firebase-functions/params');
const { initializeApp, getApps }   = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Guard: only initialize once (safe across hot-reloads & multi-file setups)
if (!getApps().length) initializeApp();

// ── Secrets ───────────────────────────────────────────────────────────────────
// Set with: firebase functions:secrets:set ODDS_API_KEY
const ODDS_API_KEY = defineSecret('ODDS_API_KEY');

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

// ════════════════════════════════════════════════════════════════════════════
// getSportsOdds — secure proxy with cache + rate limiting
// ════════════════════════════════════════════════════════════════════════════
exports.getSportsOdds = onCall(
  {
    region: 'us-central1',
    secrets: [ODDS_API_KEY],
    cors: ALLOWED_ORIGINS,
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');

    const sport    = (request.data && request.data.sport) || 'NBA';
    const sportKey = SPORT_MAP[sport];
    if (!sportKey) throw new HttpsError('invalid-argument', 'Deporte no válido: ' + sport);

    const uid = request.auth.uid;
    const db  = getFirestore();
    console.log(`[getSportsOdds] uid=${uid} sport=${sport}`);

    // ── Rate Limit (Firestore transaction) ────────────────────────────────
    const userRef = db.doc('users/' + uid);
    const allowed = await db.runTransaction(async (txn) => {
      const snap   = await txn.get(userRef);
      const data   = snap.exists ? snap.data() : {};
      const isPro  = data.planType === 'pro';
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
  { region: 'us-central1', cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes estar autenticado.');

    try {
      const db   = getFirestore();
      const snap = await db.doc('users/' + request.auth.uid).get();
      if (!snap.exists) return { planType: 'free', remaining: FREE_LIMIT };

      const d     = snap.data();
      const isPro = d.planType === 'pro';
      const limit = isPro ? PRO_LIMIT : FREE_LIMIT;
      const now   = Date.now();
      const winMS = d.hourlyRequests && d.hourlyRequests.windowStart
                    ? d.hourlyRequests.windowStart.toMillis() : 0;
      const inWin = (now - winMS) < WINDOW_MS;
      const used  = inWin ? (d.hourlyRequests && d.hourlyRequests.count || 0) : 0;

      return { planType: d.planType || 'free', remaining: Math.max(0, limit - used) };
    } catch (err) {
      console.error('[getUserPlan] ERROR:', err.message);
      return { planType: 'free', remaining: FREE_LIMIT };
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
