'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated }  = require('firebase-functions/v2/firestore');
const { defineSecret }       = require('firebase-functions/params');
const { initializeApp }      = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();

// API key stored in Secret Manager (never visible to clients).
// Deploy command: firebase functions:secrets:set ODDS_API_KEY
const ODDS_API_KEY = defineSecret('ODDS_API_KEY');

const SPORT_MAP = {
  NBA: 'basketball_nba',
  MLB: 'baseball_mlb',
  NFL: 'americanfootball_nfl',
};

const ALLOWED_ORIGINS = [
  'https://www.prediccionloteria.com',
  'https://prediccionloteria.com',
  'https://game-lottery-b0e90.web.app',
];

// ── getSportsOdds ────────────────────────────────────────────────────────────
// Secure proxy: calls The Odds API server-side so the key never reaches clients.
// Called via Firebase SDK httpsCallable — requires anonymous or real auth.
exports.getSportsOdds = onCall(
  {
    region: 'us-central1',
    secrets: [ODDS_API_KEY],
    cors: ALLOWED_ORIGINS,
    enforceAppCheck: false, // flip to true once App Check is configured
  },
  async (request) => {
    // Require authentication (anonymous sign-in counts)
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes estar autenticado para obtener cuotas.');
    }

    const sport = (request.data && request.data.sport) || 'NBA';
    const sportKey = SPORT_MAP[sport];
    if (!sportKey) {
      throw new HttpsError('invalid-argument', 'Deporte no válido: ' + sport);
    }

    const apiKey = ODDS_API_KEY.value();
    const url =
      'https://api.the-odds-api.com/v4/sports/' + sportKey +
      '/odds/?apiKey=' + apiKey +
      '&regions=us&markets=h2h,spreads&bookmakers=draftkings,fanduel&oddsFormat=american';

    try {
      const res  = await fetch(url);
      if (!res.ok) {
        throw new HttpsError('unavailable', 'The Odds API respondió con error ' + res.status);
      }
      const data = await res.json();
      return { odds: data };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', 'Error de red: ' + err.message);
    }
  }
);

// ── onVoteCreated ────────────────────────────────────────────────────────────
// Firestore trigger: each new vote in sportsVotes/ updates the global counter.
// Runs server-side so users cannot manipulate the aggregate directly.
exports.onVoteCreated = onDocumentCreated(
  { document: 'sportsVotes/{voteId}', region: 'us-central1' },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data) return;

    const db        = getFirestore();
    const globalRef = db.doc('sportsAccuracy/global');
    const field     = data.vote === 'yes' ? 'yes' : 'no';

    await globalRef.set(
      {
        [field]: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
);
