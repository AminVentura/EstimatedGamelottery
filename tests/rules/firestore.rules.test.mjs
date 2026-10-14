// Tests de firestore.rules contra el emulador (proyecto demo-, nunca el real).
// Ejecutar desde tests/rules:  npm test
import test, { after, before, beforeEach } from 'node:test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const RULES = fileURLToPath(new URL('../../firestore.rules', import.meta.url));
const BASE = 'artifacts/EstimatedGamelottery-app/public/data';
const DRAWINGS = [
  'powerball_drawings',
  'millionaireforlife_drawings',
  'megamillions_drawings',
  'pick10_drawings',
  'take5day_drawings',
  'take5eve_drawings',
  'win4day_drawings',
  'win4eve_drawings',
];

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gamelottery-rules',
    firestore: { rules: fs.readFileSync(RULES, 'utf8') },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const name of DRAWINGS) {
      await setDoc(doc(db, `${BASE}/${name}/oficial-1`), {
        mainNumbers: '[1,2,3,4,5]',
        special: 7,
        date: '2026-10-08',
        userId: 'ana',
        createdAt: new Date(),
      });
    }
    await setDoc(doc(db, 'users/ana'), { plan: 'free' });
    await setDoc(doc(db, 'sportsVotes/ana_pred-0'), { uid: 'ana', predId: 'pred-0', sport: 'mlb', vote: 'yes', date: '2026-10-08' });
    await setDoc(doc(db, 'prediction_models/powerball'), { v: 1 });
  });
});

after(async () => {
  await env.cleanup();
});

// Lo que el cliente enviaba antes del cierre (misma forma que sitio/app.js).
function sorteo(uid) {
  return { mainNumbers: '[1,2,3,4,5]', special: 7, date: '2026-10-09', createdAt: new Date(), userId: uid };
}

function voto(uid, extra = {}) {
  return { uid, predId: 'pred-1', sport: 'mlb', vote: 'yes', createdAt: serverTimestamp(), date: '2026-10-10', ...extra };
}

test('los sorteos se leen sin sesión', async () => {
  const db = env.unauthenticatedContext().firestore();
  for (const name of DRAWINGS) {
    await assertSucceeds(getDocs(collection(db, `${BASE}/${name}`)));
  }
});

test('nadie crea sorteos desde el cliente: ni anónimo, ni con sesión, ni con la forma válida de antes', async () => {
  const anon = env.unauthenticatedContext().firestore();
  const user = env.authenticatedContext('mallory').firestore();
  for (const name of DRAWINGS) {
    await assertFails(addDoc(collection(anon, `${BASE}/${name}`), sorteo('mallory')));
    await assertFails(addDoc(collection(user, `${BASE}/${name}`), sorteo('mallory')));
    await assertFails(setDoc(doc(user, `${BASE}/${name}/falso`), sorteo('mallory')));
  }
});

test('nadie cambia ni borra sorteos, tampoco quien figura como autor', async () => {
  const owner = env.authenticatedContext('ana').firestore();
  const other = env.authenticatedContext('mallory').firestore();
  for (const name of DRAWINGS) {
    const path = `${BASE}/${name}/oficial-1`;
    await assertFails(updateDoc(doc(owner, path), { special: 9 }));
    await assertFails(deleteDoc(doc(owner, path)));
    await assertFails(updateDoc(doc(other, path), { mainNumbers: '[9,9,9,9,9]' }));
    await assertFails(deleteDoc(doc(other, path)));
  }
});

test('una colección inventada junto a los sorteos queda cerrada', async () => {
  const user = env.authenticatedContext('mallory').firestore();
  await assertFails(setDoc(doc(user, `${BASE}/otra_drawings/x`), sorteo('mallory')));
  await assertFails(getDoc(doc(user, `${BASE}/otra_drawings/x`)));
});

test('votos: el usuario crea el suyo con la forma exacta', async () => {
  const ana = env.authenticatedContext('ana').firestore();
  await assertSucceeds(setDoc(doc(ana, 'sportsVotes/ana_pred-1'), voto('ana')));
  await assertSucceeds(getDoc(doc(ana, 'sportsVotes/ana_pred-1')));
});

test('votos: se rechaza todo lo que se sale de la forma', async () => {
  const ana = env.authenticatedContext('ana').firestore();
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(anon, 'sportsVotes/ana_pred-1'), voto('ana')));
  // en nombre de otro
  await assertFails(setDoc(doc(ana, 'sportsVotes/bob_pred-1'), voto('bob')));
  // id que no es uid_predId (segundo voto a la misma predicción)
  await assertFails(setDoc(doc(ana, 'sportsVotes/ana_otro'), voto('ana')));
  // valor de voto fuera del enumerado
  await assertFails(setDoc(doc(ana, 'sportsVotes/ana_pred-1'), voto('ana', { vote: 'maybe' })));
  // campo extra
  await assertFails(setDoc(doc(ana, 'sportsVotes/ana_pred-1'), voto('ana', { peso: 1000 })));
  // falta un campo
  const { sport: _sport, ...sinDeporte } = voto('ana');
  await assertFails(setDoc(doc(ana, 'sportsVotes/ana_pred-1'), sinDeporte));
  // fecha del cliente en vez de la del servidor
  await assertFails(setDoc(doc(ana, 'sportsVotes/ana_pred-1'), voto('ana', { createdAt: new Date('2020-01-01') })));
  // fecha con formato raro
  await assertFails(setDoc(doc(ana, 'sportsVotes/ana_pred-1'), voto('ana', { date: '10/10/2026' })));
  // predId enorme
  const largo = 'p'.repeat(65);
  await assertFails(setDoc(doc(ana, `sportsVotes/ana_${largo}`), voto('ana', { predId: largo })));
});

test('votos: no se cambian, no se borran y no se leen los de otro', async () => {
  const ana = env.authenticatedContext('ana').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  await assertFails(updateDoc(doc(ana, 'sportsVotes/ana_pred-0'), { vote: 'no' }));
  await assertFails(deleteDoc(doc(ana, 'sportsVotes/ana_pred-0')));
  await assertFails(getDoc(doc(bob, 'sportsVotes/ana_pred-0')));
});

test('el plan del usuario y los modelos no se escriben desde el cliente', async () => {
  const ana = env.authenticatedContext('ana').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  await assertSucceeds(getDoc(doc(ana, 'users/ana')));
  await assertFails(getDoc(doc(bob, 'users/ana')));
  await assertFails(setDoc(doc(ana, 'users/ana'), { plan: 'pro' }));
  await assertFails(updateDoc(doc(ana, 'users/ana'), { plan: 'pro' }));
  await assertFails(setDoc(doc(ana, 'prediction_models/powerball'), { v: 2 }));
  await assertFails(setDoc(doc(ana, 'standings/mlb'), { x: 1 }));
  await assertFails(setDoc(doc(ana, 'sportsAccuracy/global'), { yes: 1 }));
  await assertFails(getDoc(doc(ana, 'cache_odds/mlb')));
});

test('user_stats: solo el dueño', async () => {
  const ana = env.authenticatedContext('ana').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  await assertSucceeds(setDoc(doc(ana, `${BASE}/user_stats/ana`), { aciertos: 1 }));
  await assertSucceeds(getDoc(doc(ana, `${BASE}/user_stats/ana`)));
  await assertFails(getDoc(doc(bob, `${BASE}/user_stats/ana`)));
  await assertFails(setDoc(doc(bob, `${BASE}/user_stats/ana`), { aciertos: 99 }));
});

test('el archivo de sorteos de navegadores no se lee ni se escribe desde el cliente', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'archived_browser_drawings/powerball__Ab3dEf6hIj9kLm2nOp5q'), { date: '2026-10-07', originalPath: 'x' });
  });
  const anon = env.unauthenticatedContext().firestore();
  const ana = env.authenticatedContext('ana').firestore();
  for (const db of [anon, ana]) {
    await assertFails(getDoc(doc(db, 'archived_browser_drawings/powerball__Ab3dEf6hIj9kLm2nOp5q')));
    await assertFails(getDocs(collection(db, 'archived_browser_drawings')));
    await assertFails(setDoc(doc(db, 'archived_browser_drawings/nuevo'), { a: 1 }));
    await assertFails(addDoc(collection(db, 'archived_browser_drawings'), { a: 1 }));
    await assertFails(deleteDoc(doc(db, 'archived_browser_drawings/powerball__Ab3dEf6hIj9kLm2nOp5q')));
  }
});

test('los contadores de límite de uso no se leen ni se tocan desde el cliente', async () => {
  const ana = env.authenticatedContext('ana').firestore();
  const anon = env.unauthenticatedContext().firestore();
  for (const db of [ana, anon]) {
    await assertFails(getDoc(doc(db, 'rate_limits/estimate_id_ana')));
    await assertFails(setDoc(doc(db, 'rate_limits/estimate_id_ana'), { count: 0, windowStartMs: 0 }));
    await assertFails(deleteDoc(doc(db, 'rate_limits/estimate_id_ana')));
  }
});

test('cualquier otra ruta está denegada por defecto', async () => {
  const ana = env.authenticatedContext('ana').firestore();
  await assertFails(setDoc(doc(ana, 'cualquier/cosa'), { a: 1 }));
  await assertFails(getDoc(doc(ana, 'lottery_history/powerball_2026')));
});
