// scripts/archivar-sorteos-navegador.js de extremo a extremo en el emulador (proyecto demo-, nunca el real).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';

const PROJECT = 'demo-gamelottery-rules';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../../scripts/archivar-sorteos-navegador.js', import.meta.url));
const BASE = 'artifacts/EstimatedGamelottery-app/public/data';
const requireFn = createRequire(new URL('../../functions/package.json', import.meta.url));

process.env.GCLOUD_PROJECT = PROJECT;
const { initializeApp, deleteApp } = requireFn('firebase-admin/app');
const { getFirestore, Timestamp } = requireFn('firebase-admin/firestore');

// Fuente oficial simulada (sin red): solo 2026-10-07 de Powerball.
const FUENTE = path.join(os.tmpdir(), 'gl-fuente-local-' + process.pid + '.json');
fs.writeFileSync(FUENTE, JSON.stringify({ 'powerball|2026-10-07': { main: [10, 20, 30, 40, 50], special: 7 } }));

const COINCIDE = { mainNumbers: '[50,40,30,20,10]', special: 7, date: '2026-10-07', userId: 'anon-1', createdAt: Timestamp.fromMillis(1791370800123) };
const DISTINTO = { mainNumbers: [1, 2, 3, 4, 5], special: 7, date: '2026-10-07', userId: 'anon-2', extra: { a: [1, { b: 'c' }] } };
const VACIO = {};
const M4L = { mainNumbers: '[1,2,3,4,5]', special: 1, date: '2026-03-01', userId: 'anon-3' };

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
const ids = async (p) => (await admin.collection(p).get()).docs.map((d) => d.id).sort();

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'solo se ejecuta contra el emulador');
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync(fileURLToPath(new URL('../../firestore.rules', import.meta.url)), 'utf8') },
  });
  await env.clearFirestore();
  adminApp = initializeApp({ projectId: PROJECT }, 'archivo-test');
  admin = getFirestore(adminApp);
  await admin.doc(`${BASE}/powerball_drawings/2026-10-10`).set({ date: '2026-10-10', mainNumbers: [11, 21, 31, 41, 51], special: 8, gameType: 'powerball', source: 'ny_open_data' });
  await admin.doc(`${BASE}/powerball_drawings/Aaaaaaaaaaaaaaaaaaa1`).set(COINCIDE);
  await admin.doc(`${BASE}/powerball_drawings/Bbbbbbbbbbbbbbbbbbb2`).set(DISTINTO);
  await admin.doc(`${BASE}/powerball_drawings/Ccccccccccccccccccc3`).set(VACIO);
  // Millionaire For Life sin ningún documento oficial: no se puede quedar vacío.
  await admin.doc(`${BASE}/millionaireforlife_drawings/Ddddddddddddddddddd4`).set(M4L);
});

after(async () => {
  if (adminApp) await deleteApp(adminApp);
  if (env) await env.cleanup();
  fs.rmSync(FUENTE, { force: true });
});

test('la simulación lista y clasifica sin escribir, y nunca incluye el documento oficial', async () => {
  const r = run('--dry-run');
  assert.equal(r.code, 0, r.out);
  const res = lastJson(r.out, 'candidatos');
  assert.equal(res.candidatos, 4);
  assert.deepEqual(res.resumen.powerball, { coincide: 1, 'no coincide': 1, 'fecha sin sorteo': 0, 'vacío': 1 });
  assert.deepEqual(res.resumen.millionaireforlife, { coincide: 0, 'no coincide': 0, 'fecha sin sorteo': 1, 'vacío': 0 });
  assert.deepEqual(res.juegosProtegidos, ['millionaireforlife']);
  assert.ok(!r.out.includes('2026-10-10\t'), 'el oficial no es candidato');
  assert.equal((await ids(`${BASE}/powerball_drawings`)).length, 4);
  assert.deepEqual(await ids('archived_browser_drawings'), []);
});

test('--expect distinto del inventario aborta sin escribir', async () => {
  const r = run('--write', '--expect', '3');
  assert.equal(r.code, 1);
  assert.match(r.out, /Se esperaban 3 candidatos y hay 4/);
  assert.deepEqual(await ids('archived_browser_drawings'), []);
});

test('--write copia idéntico + 3 campos, quita el original y no vacía un juego sin oficiales', async () => {
  const r = run('--write', '--expect', '4');
  assert.equal(r.code, 0, r.out);
  const res = lastJson(r.out, 'resultado').resultado;
  assert.deepEqual(res, { archivados: 3, yaArchivados: 0, saltadosJuegoProtegido: 1, errores: [] });
  assert.deepEqual(await ids(`${BASE}/powerball_drawings`), ['2026-10-10']);
  assert.deepEqual(await ids(`${BASE}/millionaireforlife_drawings`), ['Ddddddddddddddddddd4']);
  assert.deepEqual(await ids('archived_browser_drawings'), ['powerball__Aaaaaaaaaaaaaaaaaaa1', 'powerball__Bbbbbbbbbbbbbbbbbbb2', 'powerball__Ccccccccccccccccccc3']);

  const a = (await admin.doc('archived_browser_drawings/powerball__Aaaaaaaaaaaaaaaaaaa1').get()).data();
  assert.equal(a.mainNumbers, COINCIDE.mainNumbers);
  assert.equal(a.userId, 'anon-1');
  assert.ok(a.createdAt.isEqual(COINCIDE.createdAt));
  assert.equal(a.originalPath, `${BASE}/powerball_drawings/Aaaaaaaaaaaaaaaaaaa1`);
  assert.equal(a.archivedReason, 'creado por navegador antes de la ingesta oficial; coincide');
  assert.ok(a.archivedAt);
  const b = (await admin.doc('archived_browser_drawings/powerball__Bbbbbbbbbbbbbbbbbbb2').get()).data();
  assert.deepEqual(b.extra, DISTINTO.extra);
  assert.equal(b.archivedReason, 'creado por navegador antes de la ingesta oficial; no coincide');
  const c = (await admin.doc('archived_browser_drawings/powerball__Ccccccccccccccccccc3').get()).data();
  assert.deepEqual(Object.keys(c).sort(), ['archivedAt', 'archivedReason', 'originalPath']);
  assert.equal(c.archivedReason, 'creado por navegador antes de la ingesta oficial; vacío');
});

test('repetir --write es idempotente', async () => {
  const r = run('--write');
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(lastJson(r.out, 'resultado').resultado, { archivados: 0, yaArchivados: 0, saltadosJuegoProtegido: 1, errores: [] });
  assert.equal((await ids('archived_browser_drawings')).length, 3);
});

test('si la copia ya existe y es distinta, el original no se quita', async () => {
  await admin.doc(`${BASE}/powerball_drawings/Eeeeeeeeeeeeeeeeeee5`).set({ date: '2026-10-07', mainNumbers: [1], userId: 'x' });
  await admin.doc('archived_browser_drawings/powerball__Eeeeeeeeeeeeeeeeeee5').set({ date: 'otra cosa', originalPath: `${BASE}/powerball_drawings/Eeeeeeeeeeeeeeeeeee5`, archivedAt: new Date(), archivedReason: 'x' });
  const r = run('--write', '--game', 'powerball');
  assert.equal(r.code, 1);
  assert.match(r.out, /no es idéntica/);
  assert.ok((await admin.doc(`${BASE}/powerball_drawings/Eeeeeeeeeeeeeeeeeee5`).get()).exists);
  await admin.doc(`${BASE}/powerball_drawings/Eeeeeeeeeeeeeeeeeee5`).delete();
  await admin.doc('archived_browser_drawings/powerball__Eeeeeeeeeeeeeeeeeee5').delete();
});

test('un id con forma de fecha que no es oficial detiene todo', async () => {
  await admin.doc(`${BASE}/powerball_drawings/2026-10-09`).set({ date: '2026-10-09', mainNumbers: [1, 2, 3, 4, 5], special: 1 });
  const r = run('--dry-run');
  assert.equal(r.code, 1);
  assert.match(r.out, /Documento ambiguo/);
  await admin.doc(`${BASE}/powerball_drawings/2026-10-09`).delete();
});

test('la web sigue leyendo el historial y nadie lee el archivo desde el cliente', async () => {
  const anon = env.unauthenticatedContext().firestore();
  const snap = await getDocs(query(collection(anon, `${BASE}/powerball_drawings`), orderBy('date', 'desc')));
  assert.deepEqual(snap.docs.map((d) => d.id), ['2026-10-10']);
  await assertFails(getDoc(doc(anon, 'archived_browser_drawings/powerball__Aaaaaaaaaaaaaaaaaaa1')));
  await assertFails(getDoc(doc(env.authenticatedContext('ana').firestore(), 'archived_browser_drawings/powerball__Aaaaaaaaaaaaaaaaaaa1')));
});
