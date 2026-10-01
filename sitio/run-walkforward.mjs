/**
 * Ejecuta generateNextPlayRecommendation (walk-forward) con NY Open Data.
 * Uso: node run-walkforward.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const algoSrc = readFileSync(join(__dirname, 'lottery-algorithms.js'), 'utf8');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(algoSrc, sandbox);
const LA = sandbox.window.lotteryAlgorithms;

const LOTTERY_CONFIG = {
  powerball: { mainCount: 5, mainMin: 1, mainMax: 69, hasSpecial: true, specialMin: 1, specialMax: 26, label: 'Powerball' },
  millionaireforlife: { mainCount: 5, mainMin: 1, mainMax: 58, hasSpecial: true, specialMin: 1, specialMax: 5, label: 'Millionaire For Life' },
  megamillions: { mainCount: 5, mainMin: 1, mainMax: 70, hasSpecial: true, specialMin: 1, specialMax: 25, label: 'Mega Millions' },
  pick10: { mainCount: 10, mainMin: 1, mainMax: 80, hasSpecial: false, drawResultCount: 20, label: 'Pick 10' },
  take5day: { mainCount: 5, mainMin: 1, mainMax: 39, hasSpecial: false, label: 'Take 5 Day' },
  take5eve: { mainCount: 5, mainMin: 1, mainMax: 39, hasSpecial: false, label: 'Take 5 Eve' },
  win4day: { mainCount: 4, mainMin: 0, mainMax: 9, hasSpecial: false, label: 'Win 4 Day' },
  win4eve: { mainCount: 4, mainMin: 0, mainMax: 9, hasSpecial: false, label: 'Win 4 Eve' }
};

const METHOD_LABELS = {
  'basado-en-frecuencia': 'Basado en Frecuencia',
  'cold-numbers': 'Números Fríos',
  'mixed-balanced': 'Mixta Equilibrada',
  'repeat-pattern': 'Patrones de Repetición',
  'por-decenas': 'Por decenas',
  'random-optimized': 'IA Aleatoria (paridad/suma)',
  'markov-poisson-logistic': 'Markov+Poisson+Logística',
  'consenso-ensemble': 'Consenso Ensemble'
};

function getLotteryRanges(lottery) {
  const c = LOTTERY_CONFIG[lottery];
  const drawCount = c.drawResultCount != null ? c.drawResultCount : c.mainCount;
  return {
    mainCount: c.mainCount,
    drawResultCount: drawCount,
    main: { min: c.mainMin, max: c.mainMax },
    special: c.hasSpecial ? { min: c.specialMin, max: c.specialMax } : null,
    hasSpecial: c.hasSpecial
  };
}

function nyDate(str) { return str ? str.split('T')[0] : null; }
function nyItem(prefix, date, mainNumbers, special = null) {
  const d = { date, mainNumbers };
  if (special !== null) d.special = special;
  return { id: `ny-${prefix}-${date}`, data: d };
}

const NY = {
  powerball: 'https://data.ny.gov/resource/d6yy-54nr.json',
  megamillions: 'https://data.ny.gov/resource/5xaw-6ayf.json',
  take5: 'https://data.ny.gov/resource/dg63-4siq.json',
  win4: 'https://data.ny.gov/resource/hsys-3def.json',
  pick10: 'https://data.ny.gov/resource/bycu-cw7c.json',
  millionaireforlife: 'https://data.ny.gov/resource/kwxv-fwze.json'
};

async function fetchJson(url) {
  const r = await fetch(url + '?$limit=1000&$order=draw_date+DESC');
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

function formatPlay(lottery, main, special) {
  const cfg = LOTTERY_CONFIG[lottery];
  const sorted = [...main];
  if (!['win4day', 'win4eve'].includes(lottery)) sorted.sort((a, b) => a - b);
  const mainStr = sorted.join(' · ');
  if (special != null && cfg.hasSpecial) {
    const ball = lottery === 'powerball' ? 'PB' : lottery === 'megamillions' ? 'Mega Ball' : 'Millionaire Ball';
    return `${mainStr} + ${ball} ${special}`;
  }
  return mainStr;
}

async function loadHistory() {
  const [pb, mm, t5, w4, p10, m4l] = await Promise.all([
    fetchJson(NY.powerball),
    fetchJson(NY.megamillions),
    fetchJson(NY.take5),
    fetchJson(NY.win4),
    fetchJson(NY.pick10),
    fetchJson(NY.millionaireforlife)
  ]);

  const history = {
    powerball: pb.map(row => {
      const date = nyDate(row.draw_date);
      const nums = row.winning_numbers.trim().split(/\s+/).map(Number);
      return nyItem('pb', date, nums.slice(0, 5).sort((a, b) => a - b), nums[5]);
    }),
    megamillions: mm.map(row => {
      const date = nyDate(row.draw_date);
      const main = row.winning_numbers.trim().split(/\s+/).map(Number).sort((a, b) => a - b);
      return nyItem('mm', date, main, Number(row.mega_ball));
    }),
    pick10: p10.map(row => {
      const date = nyDate(row.draw_date);
      const nums = row.winning_numbers.trim().split(/\s+/).map(Number).sort((a, b) => a - b);
      return nyItem('pick10', date, nums);
    }),
    millionaireforlife: m4l.map(row => {
      const date = nyDate(row.draw_date);
      const main = row.winning_numbers.trim().split(/\s+/).map(Number).sort((a, b) => a - b);
      const special = Number(row.cash_ball ?? row.millionaire_ball ?? row.millionaire_ball_number);
      return nyItem('m4l', date, main, special);
    }),
    take5day: [],
    take5eve: [],
    win4day: [],
    win4eve: []
  };

  t5.forEach(row => {
    const date = nyDate(row.draw_date);
    if (!date) return;
    if (row.midday_winning_numbers) {
      const nums = row.midday_winning_numbers.trim().split(/\s+/).map(Number).sort((a, b) => a - b);
      history.take5day.push(nyItem('t5day', date, nums));
    }
    if (row.evening_winning_numbers) {
      const nums = row.evening_winning_numbers.trim().split(/\s+/).map(Number).sort((a, b) => a - b);
      history.take5eve.push(nyItem('t5eve', date, nums));
    }
  });

  w4.forEach(row => {
    const date = nyDate(row.draw_date);
    if (!date) return;
    if (row.midday_win_4 != null) {
      history.win4day.push(nyItem('w4day', date, String(row.midday_win_4).padStart(4, '0').split('').map(Number)));
    }
    if (row.evening_win_4 != null) {
      history.win4eve.push(nyItem('w4eve', date, String(row.evening_win_4).padStart(4, '0').split('').map(Number)));
    }
  });

  for (const key of Object.keys(history)) {
    history[key].sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
  }
  return history;
}

function scoreConfidence(nextPlay) {
  const top = nextPlay.backtest?.ranking?.[0];
  if (!top || !top.tests) return 5;
  let c = 5;
  if (top.vsRandom > 0) c += 2;
  if (top.vsRandom > 0.15) c += 1;
  if (nextPlay.backtest.tests >= 30) c += 1;
  if (nextPlay.beatsRandom) c += 1;
  return Math.max(1, Math.min(10, c));
}

const history = await loadHistory();
const results = [];

for (const [lottery, cfg] of Object.entries(LOTTERY_CONFIG)) {
  const data = history[lottery] || [];
  const ranges = getLotteryRanges(lottery);
  if (data.length < 24) {
    results.push({ lottery, label: cfg.label, error: `Solo ${data.length} sorteos (mínimo 24 para walk-forward)` });
    continue;
  }
  const nextPlay = LA.generateNextPlayRecommendation(data, ranges, lottery);
  const rec = nextPlay.recommended;
  const top = nextPlay.backtest.ranking[0];
  results.push({
    lottery,
    label: cfg.label,
    draws: data.length,
    lastDraw: data[0].data.date,
    winnerId: nextPlay.winnerId,
    winnerLabel: METHOD_LABELS[nextPlay.winnerId] || nextPlay.winnerId,
    play: formatPlay(lottery, rec.mainNumbers, rec.special ?? null),
    mainNumbers: rec.mainNumbers,
    special: rec.special ?? null,
    avgHits: top.avgHits,
    vsRandom: top.vsRandom,
    baseline: nextPlay.backtest.baseline,
    beatsRandom: nextPlay.beatsRandom,
    tests: nextPlay.backtest.tests,
    mixHotPct: nextPlay.mixTune?.hotFraction != null ? Math.round(nextPlay.mixTune.hotFraction * 100) : null,
    top3: nextPlay.backtest.ranking.slice(0, 3).map(r => `${METHOD_LABELS[r.id] || r.id} (${r.avgHits})`),
    confidence: scoreConfidence(nextPlay)
  });
}

results.sort((a, b) => (b.vsRandom ?? -99) - (a.vsRandom ?? -99));
const best = results.find(r => !r.error) || results[0];

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'NY Open Data + lottery-algorithms.js walk-forward',
  jugadaInteligenteDelDia: best ? {
    juego: best.label,
    jugada: best.play,
    metodo: best.winnerLabel,
    confianza: `${best.confidence}/10`,
    walkForward: {
      sorteosPrueba: best.tests,
      aciertosMedios: best.avgHits,
      vsAzar: best.vsRandom,
      azarEsperado: best.baseline,
      superaAzar: best.beatsRandom,
      mixtaCalientePct: best.mixHotPct,
      top3Metodos: best.top3
    },
    ultimoSorteoOficial: best.lastDraw
  } : null,
  todosLosJuegos: results
}, null, 2));
