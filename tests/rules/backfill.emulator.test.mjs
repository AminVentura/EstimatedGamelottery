// Prueba de extremo a extremo en el emulador (proyecto demo-, nunca el real):
// lottery_history -> scripts/backfill-historial-publico.js -> *_drawings -> lectura pública.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';

const PROJECT = 'demo-gamelottery-rules';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../../scripts/backfill-historial-publico.js', import.meta.url));
const BASE = 'artifacts/EstimatedGamelottery-app/public/data';
const requireFn = createRequire(new URL('../../functions/package.json', import.meta.url));

process.env.GCLOUD_PROJECT = PROJECT;
const { initializeApp, deleteApp } = requireFn('firebase-admin/app');
const { getFirestore } = requireFn('firebase-admin/firestore');

let env;
let adminApp;
let admin;
const VIEJO = { mainNumbers: '[9,9,9,9,9]', special: 1, date: '2026-10-07', userId: 'anon-viejo', createdAt: new Date('2026-10-07T12:00:00Z') };

function runScript(...extra) {
  const out = execFileSync(process.execPath, [SCRIPT, '--project', PROJECT, ...extra], {
    cwd: ROOT, encoding: 'utf8', timeout: 90000, env: { ...process.env, GCLOUD_PROJECT: PROJECT },
  });
  const lines = out.trim().split(/\r?\n/).map((l) => JSON.parse(l));
  return lines[lines.length - 1].total;
}

async function publico(game) {
  const snap = await admin.collection(`${BASE}/${game}_drawings`).get();
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
}

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'solo se ejecuta contra el emulador');
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync(fileURLToPath(new URL('../../firestore.rules', import.meta.url)), 'utf8') },
  });
  await env.clearFirestore();
  adminApp = initializeApp({ projectId: PROJECT }, 'backfill-test');
  admin = getFirestore(adminApp);
  const draw = (gameType, date, mainNumbers, bonusNumber, source = 'ny_open_data') =>
    admin.doc(`lottery_history/${gameType}_${date.slice(0, 4)}/draws/${date}`).set({ gameType, drawDate: `${date}T00:00:00.000Z`, mainNumbers, bonusNumber, source });
  await admin.doc('lottery_history/powerball_2025').set({ y: 2025 });
  await admin.doc('lottery_history/powerball_2026').set({ y: 2026 });
  await admin.doc('lottery_history/win4eve_2026').set({ y: 2026 });
  await draw('powerball', '2025-12-31', [1, 2, 3, 4, 5], 6);
  await draw('powerball', '2026-10-07', [10, 20, 30, 40, 50], 7);
  await draw('powerball', '2026-10-10', [11, 21, 31, 41, 51], 8);
  await draw('powerball', '2026-10-12', [12, 22, 32, 42, 52], 9, 'mock_fallback'); // nunca debe publicarse
  await draw('win4eve', '2026-10-10', [0, 7, 0, 3], null);
  // Documento antiguo de un navegador, con datos distintos al oficial de esa fecha.
  await admin.doc(`${BASE}/powerball_drawings/Ab3dEf6hIj9kLm2nOp5q`).set(VIEJO);
});

after(async () => {
  if (adminApp) await deleteApp(adminApp);
  if (env) await env.cleanup();
});

test('la simulación no escribe nada', async () => {
  const total = runScript('--dry-run');
  assert.equal(total.porCrear, 4);
  assert.equal(total.creados, 0);
  assert.equal(total.descartadosPorFuente, 1);
  assert.deepEqual(Object.keys(await publico('powerball')), ['Ab3dEf6hIj9kLm2nOp5q']);
  assert.deepEqual(Object.keys(await publico('win4eve')), []);
});

test('sin --write tampoco escribe (la simulación es el modo por defecto)', async () => {
  const total = runScript();
  assert.equal(total.creados, 0);
  assert.equal(Object.keys(await publico('powerball')).length, 1);
});

test('con --write copia solo lo oficial, con id = fecha, y deja intacto el documento antiguo', async () => {
  const total = runScript('--write');
  assert.equal(total.creados, 4);
  const pb = await publico('powerball');
  assert.deepEqual(Object.keys(pb).sort(), ['2025-12-31', '2026-10-07', '2026-10-10', 'Ab3dEf6hIj9kLm2nOp5q']);
  assert.deepEqual(pb['2026-10-10'].mainNumbers, [11, 21, 31, 41, 51]);
  assert.equal(pb['2026-10-10'].special, 8);
  assert.equal(pb['2026-10-10'].date, '2026-10-10');
  assert.equal(pb['2026-10-10'].source, 'ny_open_data');
  assert.ok(pb['2026-10-10'].createdAt);
  assert.equal(pb.Ab3dEf6hIj9kLm2nOp5q.mainNumbers, VIEJO.mainNumbers);
  assert.equal(pb.Ab3dEf6hIj9kLm2nOp5q.userId, 'anon-viejo');
  const w4 = await publico('win4eve');
  assert.deepEqual(w4['2026-10-10'].mainNumbers, [0, 7, 0, 3]);
  assert.equal(w4['2026-10-10'].special, null);
});

test('repetir --write no crea ni cambia nada', async () => {
  const antes = JSON.stringify(await publico('powerball'));
  const total = runScript('--write');
  assert.equal(total.creados, 0);
  assert.equal(total.yaExistian, 4);
  assert.equal(JSON.stringify(await publico('powerball')), antes);
});

test('un visitante sin sesión lee el historial con la consulta de la web y no puede escribir en él', async () => {
  const anon = env.unauthenticatedContext().firestore();
  const snap = await getDocs(query(collection(anon, `${BASE}/powerball_drawings`), orderBy('date', 'desc')));
  assert.deepEqual(snap.docs.map((d) => d.data().date), ['2026-10-10', '2026-10-07', '2026-10-07', '2025-12-31']);
  const user = env.authenticatedContext('mallory').firestore();
  // ni crear un «oficial» con id = fecha, ni pisar uno existente
  await assertFails(setDoc(doc(user, `${BASE}/powerball_drawings/2026-10-11`), { date: '2026-10-11', mainNumbers: [1, 2, 3, 4, 5], special: 1, source: 'ny_open_data' }));
  await assertFails(setDoc(doc(anon, `${BASE}/powerball_drawings/2026-10-10`), { date: '2026-10-10', mainNumbers: [1, 2, 3, 4, 5], special: 1, source: 'ny_open_data' }));
});
