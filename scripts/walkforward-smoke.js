'use strict';
// Walk-forward smoke test (synthetic Take 5). No jackpot claim — only ranking sanity.
global.window = global;
require('../sitio/lottery-algorithms.js');
const algo = global.lotteryAlgorithms || global.window.lotteryAlgorithms;

function makeDraw(date, nums) {
  return { data: { date: date, mainNumbers: nums } };
}

const ranges = { mainCount: 5, drawResultCount: 5, main: { min: 1, max: 39 }, hasSpecial: false, special: null };
const history = [];
for (let i = 0; i < 80; i++) {
  const used = new Set();
  const nums = [];
  let seed = (i + 1) * 17;
  while (nums.length < 5) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const n = (seed % 39) + 1;
    if (!used.has(n)) { used.add(n); nums.push(n); }
  }
  nums.sort((a, b) => a - b);
  const d = new Date('2025-01-01');
  d.setDate(d.getDate() + i);
  history.push(makeDraw(d.toISOString().slice(0, 10), nums));
}
history.reverse(); // newest first, like the site

const report = algo.generateNextPlayRecommendation(history, ranges, 'take5day');
if (!report || !report.recommended || !report.backtest) {
  console.error('FAIL: no recommendation');
  process.exit(1);
}
if (report.recommended.mainNumbers.length !== 5) {
  console.error('FAIL: expected 5 numbers', report.recommended.mainNumbers);
  process.exit(1);
}
if (report.backtest.tests < 10) {
  console.error('FAIL: too few tests', report.backtest);
  process.exit(1);
}
const baseline = algo.expectedHitsRandom(ranges);
console.log(JSON.stringify({
  winnerId: report.winnerId,
  recommended: report.recommended.mainNumbers,
  tests: report.backtest.tests,
  baseline: Number(baseline.toFixed(3)),
  ranking: report.backtest.ranking.slice(0, 3),
  beatsRandom: report.beatsRandom
}, null, 2));
console.log('OK walk-forward');
