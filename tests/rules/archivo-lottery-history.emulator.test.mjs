// scripts/archivar-lottery-history.js de extremo a extremo en el emulador (proyecto demo-, nunca el real).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';

const PROJECT = 'demo-gamelottery-rules';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../../scripts/archivar-lottery-history.js', import.meta.url));
const requireFn = createRequire(new URL('../../functions/package.json', import.meta.url));

process.env.GCLOUD_PROJECT = PROJECT;
const { initializeApp, deleteApp } = requireFn('firebase-admin/app');
const { getFirestore, Timestamp } = requireFn('firebase-admin/firestore');

// Fuente oficial simulada (sin red).
const FUENTE = path.join(os.tmpdir(), 'gl-fuente-lh-' + process.pid + '.json');
fs.writeFileSync(FUENTE, JSON.stringify({
  'powerball|2026-10-07': { main: [10, 20, 30, 40, 50], special: 7 },
  'powerball|2026-10-08': { main: [1, 2, 3, 4, 5], special: 1 },
  'win4eve|2026-10-07': { main: [0, 1, 2, 3], special: null },
  'cash4life|2026-01-05': { main: [5, 15, 25, 35, 45], special: 2 },
}));

const H = 'lottery_history';
const DOCS = {
  // Se quedan
  [`${H}/powerball_2026/draws/2026-10-07`]: { gameType: 'powerball', drawDate: '2026-10-07T00:00:00.000Z', mainNumbers: [50, 40, 30, 20, 10], bonusNumber: 7, source: 'ny_open_data', ingestedAt: Timestamp.fromMillis(1791370800123) },
  [`${H}/win4eve_2026/draws/2026-10-07`]: { gameType: 'win4eve', drawDate: '2026-10-07T00:00:00.000Z', mainNumbers: [0, 1, 2, 3], source: 'ny_open_data' },
  // Se archivan
  [`${H}/powerball_2026/draws/2026-07-10`]: { gameType: 'powerball', drawDate: '2026-07-10T00:00:00.000Z', mainNumbers: [9, 19, 29, 39, 49], bonusNumber: 9, source: 'mock_fallback', extra: { a: [1, { b: 'c' }] } },
  [`${H}/powerball_2026/draws/2026-10-08`]: { gameType: 'powerball', drawDate: '2026-10-08T00:00:00.000Z', mainNumbers: [1, 2, 3, 4, 6], bonusNumber: 1, source: 'ny_open_data' },
  [`${H}/powerball_2026/draws/2026-10-09`]: { gameType: 'powerball', drawDate: '2026-10-09T00:00:00.000Z', mainNumbers: [1, 2, 3, 4, 6], bonusNumber: 1, source: 'ny_open_data' },
  [`${H}/win4eve_2026/draws/2026-10-07x`]: { gameType: 'win4eve', drawDate: '2026-10-07T00:00:00.000Z', mainNumbers: [3, 2, 1, 0], source: 'ny_open_data' },
  [`${H}/millionaireforlife_2026/draws/2026-01-05`]: { gameType: 'millionaireforlife', drawDate: '2026-01-05T00:00:00.000Z', mainNumbers: [45, 35, 25, 15, 5], bonusNumber: 2, source: 'ny_open_data' },
};
const KEEP = [`${H}/powerball_2026/draws/2026-10-07`, `${H}/win4eve_2026/draws/2026-10-07`];

let env;
let adminApp;
let admin;

function run(...extra) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, '--project', PROJECT, '--fuente-local', FUENTE, ...extra], {
      cwd: ROOT, encoding: 'utf8', timeout: 90000, env: { ...process.env, GCLOUD_PROJECT: PROJECT }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status, out: String(err.stdout || '') + String(err.stderr || '') };
  }
}
const lastJson = (out, key) => out.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).reverse().find((j) => key in j);

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'solo se ejecuta contra el emulador');
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync(fileURLToPath(new URL('../../firestore.rules', import.meta.url)), 'utf8') },
  });
  await env.clearFirestore();
  adminApp = initializeApp({ projectId: PROJECT }, 'archivo-lh-test');
  admin = getFirestore(adminApp);
  // Como en producción: sin documentos padre lottery_history/<juego>_<año>.
  for (const [p, d] of Object.entries(DOCS)) await admin.doc(p).set(d);
});

after(async () => {
  if (adminApp) await deleteApp(adminApp);
  if (env) await env.cleanup();
  fs.rmSync(FUENTE, { force: true });
});

test('la simulación clasifica sin escribir', async () => {
  const r = run('--dry-run');
  assert.equal(r.code, 0, r.out);
  const res = lastJson(r.out, 'candidatos');
  assert.equal(res.documentos, 7);
  assert.equal(res.candidatos, 5);
  assert.equal(res.resumen.powerball.coincide, 1);
  assert.equal(res.resumen.powerball.mock_fallback, 1);
  assert.equal(res.resumen.powerball['no coincide'], 1);
  assert.equal(res.resumen.powerball['fecha sin sorteo oficial'], 1);
  assert.equal(res.resumen.win4eve.coincide, 1, 'Win 4 se compara por posición');
  assert.equal(res.resumen.win4eve['no coincide'], 1);
  assert.equal(res.resumen.millionaireforlife.cash4life, 1);
  assert.equal((await admin.collection('archived_lottery_history').get()).size, 0);
  for (const p of Object.keys(DOCS)) assert.ok((await admin.doc(p).get()).exists, p);
});

test('--expect distinto aborta sin escribir', async () => {
  const r = run('--write', '--expect', '4');
  assert.notEqual(r.code, 0);
  assert.equal((await admin.collection('archived_lottery_history').get()).size, 0);
});

test('--write copia íntegra, verifica y solo entonces quita el original', async () => {
  const r = run('--write', '--expect', '5');
  assert.equal(r.code, 0, r.out);
  assert.equal(lastJson(r.out, 'resultado').resultado.archivados, 5);
  for (const p of KEEP) assert.ok((await admin.doc(p).get()).exists, 'se queda ' + p);
  for (const [p, original] of Object.entries(DOCS)) {
    if (KEEP.includes(p)) continue;
    assert.ok(!(await admin.doc(p).get()).exists, 'retirado ' + p);
    const parts = p.split('/');
    const arch = await admin.doc('archived_lottery_history/' + parts[1] + '__' + parts[3]).get();
    assert.ok(arch.exists, 'archivado ' + p);
    const a = arch.data();
    assert.equal(a.originalPath, p);
    assert.ok(a.archivedAt && typeof a.archivedAt.toMillis === 'function');
    assert.match(a.archivedReason, /^lottery_history: /);
    const { archivedAt, archivedReason, originalPath, ...rest } = a;
    assert.deepEqual(rest, original);
  }
  const mock = (await admin.doc('archived_lottery_history/powerball_2026__2026-07-10').get()).data();
  assert.match(mock.archivedReason, /mock_fallback/);
  const c4l = (await admin.doc('archived_lottery_history/millionaireforlife_2026__2026-01-05').get()).data();
  assert.match(c4l.archivedReason, /Cash4Life/);
});

test('idempotente: una segunda pasada no encuentra nada', async () => {
  const r = run('--write', '--expect', '0');
  assert.equal(r.code, 0, r.out);
  assert.equal(lastJson(r.out, 'candidatos').candidatos, 0);
  assert.equal((await admin.collection('archived_lottery_history').get()).size, 5);
});

test('reglas: el archivo está cerrado a los clientes', async () => {
  const anon = env.unauthenticatedContext().firestore();
  const ana = env.authenticatedContext('ana').firestore();
  await assertFails(getDoc(doc(anon, 'archived_lottery_history/powerball_2026__2026-07-10')));
  await assertFails(getDoc(doc(ana, 'archived_lottery_history/powerball_2026__2026-07-10')));
  await assertFails(getDocs(collection(ana, 'archived_lottery_history')));
  const { setDoc } = await import('firebase/firestore');
  await assertFails(setDoc(doc(ana, 'archived_lottery_history/x'), { a: 1 }));
  await assertFails(getDoc(doc(ana, 'lottery_history/powerball_2026/draws/2026-10-07')));
});
