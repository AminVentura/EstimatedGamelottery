// Entrenamiento de los modelos de lotería en el emulador (proyecto demo-, nunca el real).
// Reproduce el estado de producción del 2026-10-14: lottery_history sin documentos padre y
// con documentos 'mock_fallback'; historial público con sorteos oficiales (id = fecha),
// un documento antiguo de navegador y, en Millionaire For Life, un sorteo previo al juego.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const PROJECT = 'demo-gamelottery-rules';
const BASE = 'artifacts/EstimatedGamelottery-app/public/data';
const requireFn = createRequire(new URL('../../functions/package.json', import.meta.url));

process.env.GCLOUD_PROJECT = PROJECT;
let fns;
let db;

function fechas(desde, n, pasoDias = 1) {
  const out = [];
  const d = new Date(desde + 'T00:00:00Z');
  for (let i = 0; i < n; i += 1) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + pasoDias);
  }
  return out;
}

// Cinco números distintos 1-69 deterministas por índice.
const cinco = (i) => [1, 2, 3, 4, 5].map((k) => ((i * 7 + k * 13) % 69) + 1).sort((a, b) => a - b);

async function oficial(game, date, mainNumbers, special) {
  await db.doc(`${BASE}/${game}_drawings/${date}`).set({ date, mainNumbers, special, gameType: game, source: 'ny_open_data' });
}

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'solo se ejecuta contra el emulador');
  fns = requireFn('./index.js');
  const { getFirestore } = requireFn('firebase-admin/firestore');
  db = getFirestore();
  const all = await db.listCollections();
  for (const c of all) await db.recursiveDelete(c);

  // Powerball: 60 oficiales + 1 documento antiguo de navegador (id automático) en la misma colección.
  const pb = fechas('2026-08-01', 60);
  for (let i = 0; i < pb.length; i += 1) await oficial('powerball', pb[i], cinco(i), (i % 26) + 1);
  await db.doc(`${BASE}/powerball_drawings/Ab3dEf6hIj9kLm2nOp5q`).set({ date: '2026-09-30', mainNumbers: [1, 2, 3, 4, 5], special: 1 });

  // Millionaire For Life: 45 oficiales desde el inicio del juego + 1 previo (Cash4Life, se descarta).
  const mfl = fechas('2026-02-22', 45);
  const cincoMfl = (i) => [1, 2, 3, 4, 5].map((k) => ((i * 7 + k * 11) % 58) + 1).sort((x, y) => x - y);
  for (let i = 0; i < mfl.length; i += 1) await oficial('millionaireforlife', mfl[i], cincoMfl(i), (i % 5) + 1);
  await oficial('millionaireforlife', '2026-02-20', [1, 2, 3, 4, 5], 1);

  // lottery_history como en producción: draws sin documento padre, con un mock_fallback.
  await db.doc('lottery_history/powerball_2026/draws/2026-08-01').set({ gameType: 'powerball', drawDate: '2026-08-01T00:00:00.000Z', mainNumbers: cinco(0), bonusNumber: 1, source: 'ny_open_data' });
  await db.doc('lottery_history/powerball_2026/draws/2026-08-02').set({ gameType: 'powerball', drawDate: '2026-08-02T00:00:00.000Z', mainNumbers: [9, 19, 29, 39, 49], bonusNumber: 9, source: 'mock_fallback' });
});

after(async () => {
  const { getApps, deleteApp } = requireFn('firebase-admin/app');
  for (const app of getApps()) await deleteApp(app);
});

test('los padres de lottery_history no existen y aun así se leen sus sorteos (sin mock_fallback)', async () => {
  const padres = await db.collection('lottery_history').get();
  assert.equal(padres.size, 0, 'como en producción: collection().get() devuelve 0');
  const draws = await fns.loadGameDrawsForOps(db, 'powerball');
  assert.equal(draws.length, 1);
  assert.equal(draws[0].source, 'ny_open_data');
});

test('el entrenamiento lee solo los sorteos oficiales del historial público', async () => {
  const pb = await fns.loadOfficialPublicDrawsForTest(db, 'powerball');
  assert.equal(pb.length, 60, 'el documento de navegador no cuenta');
  const mfl = await fns.loadOfficialPublicDrawsForTest(db, 'millionaireforlife');
  assert.equal(mfl.length, 45, 'el sorteo anterior al 2026-02-22 no cuenta');
  assert.equal(mfl[0].drawDateIso.slice(0, 10), '2026-02-22');
});

test('trainModelForGame escribe el modelo con N>0 sorteos y la fuente', async () => {
  const r = await fns.trainModelForGameForTest(db, 'powerball');
  assert.equal(r.ok, true);
  assert.equal(r.totalDraws, 60);
  assert.equal(r.latestDrawDate, '2026-09-29');
  const model = (await db.doc('prediction_models/powerball').get()).data();
  assert.equal(model.totalDraws, 60);
  assert.equal(model.dataSource, 'public_official');
  assert.equal(model.firstDrawDate, '2026-08-01');
  assert.equal(model.latestDrawDate, '2026-09-29');
  assert.ok(model.backtesting.drawsEvaluated > 0);
  assert.equal(model.latestRecommendation.mainNumbers.length, 5);
  const ai = (await db.doc('agent_intelligence/powerball').get()).data();
  assert.equal(ai.totalDraws, 60);
});

test('trainIfStale no repite si el modelo está al día y reentrena con un sorteo nuevo', async () => {
  const igual = await fns.trainIfStaleForTest(db, 'powerball');
  assert.equal(igual.skipped, true);
  assert.equal(igual.totalDraws, 60);
  await oficial('powerball', '2026-09-30', [2, 4, 6, 8, 10], 3);
  const nuevo = await fns.trainIfStaleForTest(db, 'powerball');
  assert.equal(nuevo.ok, true);
  assert.notEqual(nuevo.skipped, true);
  assert.equal(nuevo.totalDraws, 61);
  assert.equal(nuevo.latestDrawDate, '2026-09-30');
});

test('Millionaire For Life entrena; un juego sin historial devuelve no_draws sin escribir', async () => {
  const mfl = await fns.trainIfStaleForTest(db, 'millionaireforlife');
  assert.equal(mfl.ok, true);
  assert.equal(mfl.totalDraws, 45);
  const vacio = await fns.trainIfStaleForTest(db, 'pick10');
  assert.equal(vacio.ok, false);
  assert.equal(vacio.reason, 'no_draws');
  assert.equal((await db.doc('prediction_models/pick10').get()).exists, false);
});
