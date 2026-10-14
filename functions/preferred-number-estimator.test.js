const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  getRequestIdentityForTest,
  normalizePreferredNumbersForTest,
  estimatePreferredNumbersForTest,
} = require('./index.js');

test('validates main and special preferred numbers for Powerball', () => {
  const ranges = { mainCount: 5, mainMin: 1, mainMax: 69, hasSpecial: true, specialMin: 1, specialMax: 26 };
  const result = normalizePreferredNumbersForTest({
    gameType: 'powerball',
    numbers: [5, 1, 4, 3, 2],
    special: 10,
    ranges,
  });

  assert.deepEqual(result.mainNumbers, [1, 2, 3, 4, 5]);
  assert.equal(result.special, 10);
});

test('allows App Check verified guest identity when auth is still propagating', () => {
  const result = getRequestIdentityForTest({
    app: { appId: 'test-app-check' },
    rawRequest: { ip: '203.0.113.10', headers: {} },
  });

  assert.equal(result.isGuest, true);
  assert.equal(result.uid, 'guest_203.0.113.10');
});

test('rejects duplicate numbers except Win 4 digit games', () => {
  const ranges = { mainCount: 5, mainMin: 1, mainMax: 69, hasSpecial: false };

  assert.throws(() => normalizePreferredNumbersForTest({
    gameType: 'powerball',
    numbers: [1, 1, 3, 4, 5],
    ranges,
  }), /duplicados/);
});

test('allows repeated Win 4 digits and preserves order', () => {
  const ranges = { mainCount: 4, mainMin: 0, mainMax: 9, hasSpecial: false };
  const result = normalizePreferredNumbersForTest({
    gameType: 'win4day',
    numbers: [7, 7, 0, 3],
    ranges,
  });

  assert.deepEqual(result.mainNumbers, [7, 7, 0, 3]);
});

test('returns score, margin, sample size and disclaimer', () => {
  const ranges = { mainCount: 5, mainMin: 1, mainMax: 10, hasSpecial: false };
  const history = [
    { mainNumbers: [1, 2, 3, 4, 5], drawDate: '2026-06-12' },
    { mainNumbers: [1, 2, 6, 7, 8], drawDate: '2026-06-11' },
    { mainNumbers: [1, 9, 10, 4, 5], drawDate: '2026-06-10' },
  ];

  const result = estimatePreferredNumbersForTest({
    gameType: 'take5day',
    numbers: [1, 2, 3, 4, 5],
    ranges,
    history,
  });

  assert.equal(result.sampleSize, 3);
  assert.equal(result.numbers.length, 5);
  assert.ok(result.setScorePct > 0);
  assert.ok(Number.isFinite(result.setMarginVsPoolPct));
  assert.equal(result.confidenceLabel, 'low');
  assert.match(result.comment, /1, 2, 3, 4, 5/);
  assert.match(result.comment, /score historico/i);
  assert.match(result.comment, /margen/i);
  assert.match(result.disclaimer, /no garantiza/i);
});

test('scores special balls separately when present', () => {
  const ranges = { mainCount: 5, mainMin: 1, mainMax: 10, hasSpecial: true, specialMin: 1, specialMax: 3 };
  const history = [
    { mainNumbers: [1, 2, 3, 4, 5], bonusNumber: 2, drawDate: '2026-06-12' },
    { mainNumbers: [1, 2, 6, 7, 8], bonusNumber: 2, drawDate: '2026-06-11' },
    { mainNumbers: [1, 9, 10, 4, 5], bonusNumber: 1, drawDate: '2026-06-10' },
  ];

  const result = estimatePreferredNumbersForTest({
    gameType: 'powerball',
    numbers: [1, 2, 3, 4, 5],
    special: 2,
    ranges,
    history,
  });

  assert.equal(result.special.number, 2);
  assert.ok(result.special.scorePct > 0);
  assert.match(result.comment, /Powerball 2/i);
});

test('frontend protected callables request limited-use App Check tokens and render the comment', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'sitio', 'app.js'), 'utf8');

  assert.match(appSource, /limitedUseAppCheckTokens:\s*true/);
  assert.match(appSource, /preferred-result-comment/);
  assert.match(appSource, /result\.comment/);
});

test('preferred margin flow times out and annotates numbers matching today prediction', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'sitio', 'app.js'), 'utf8');

  assert.match(appSource, /withPreferredCallableTimeout/);
  assert.match(appSource, /enrichPreferredEstimateWithPredictionNote/);
  assert.match(appSource, /Coincide con tu prediccion de hoy/);
});

// 2026-10-14 (decisión de Amin): getLotteryAgentInsight exige App Check de un solo uso y tiene
// límite de uso, como estimatePreferredNumbers; getLotteryAgentsBoard no cambia.
test('getLotteryAgentInsight exige App Check y límite de uso; el tablero sigue igual', () => {
  const functionsSource = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  const insightStart = functionsSource.indexOf('exports.getLotteryAgentInsight = onCall(');
  const boardStart = functionsSource.indexOf('exports.getLotteryAgentsBoard = onCall(');
  const insightBlock = functionsSource.slice(insightStart, boardStart > -1 ? boardStart : undefined);
  const boardBlock = boardStart > -1 ? functionsSource.slice(boardStart) : '';

  assert.ok(insightStart > -1);
  assert.ok(boardStart > -1);
  assert.match(insightBlock, /enforceAppCheck:\s*true/);
  assert.match(insightBlock, /consumeAppCheckToken:\s*true/);
  assert.match(insightBlock, /alreadyConsumed/);
  assert.match(insightBlock, /consumeQuotas\(/);
  assert.doesNotMatch(insightBlock, /ingestOfficialDrawsIfEmpty/);
  assert.doesNotMatch(boardBlock, /enforceAppCheck:\s*true/);
  assert.match(insightBlock, /getRequestIdentity\(request\)/);
  assert.match(boardBlock, /getRequestIdentity\(request\)/);
  assert.match(insightBlock, /formatLotteryAgentPayload/);
  assert.match(boardBlock, /games/);
});

test('service worker fetches app shell from network before cached fallback', () => {
  const swSource = fs.readFileSync(path.join(__dirname, '..', 'sitio', 'sw.js'), 'utf8');

  assert.match(swSource, /plv1-cache-v9/);
  assert.match(swSource, /fetch\(e\.request\)[\s\S]+caches\.match\(e\.request\)/);
});
