const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildPublicDrawingDoc,
  isOfficialPublicDoc,
  mirrorDrawsToPublic,
  publicDrawingsPath,
} = require('./public-drawings.js');
const { normalizeDrawForTest, loadPreferredHistoryDrawsForTest } = require('./index.js');

// Firestore de mentira: lo justo para getAll, batch.create y collection().orderBy().limit().get().
function fakeDb(initial = {}) {
  const store = new Map(Object.entries(initial));
  const log = { creates: 0, commits: 0 };
  const db = {
    store,
    log,
    doc: (p) => ({ path: p, id: p.split('/').pop() }),
    getAll: async (...refs) => refs.map((ref) => ({ exists: store.has(ref.path), id: ref.id, data: () => store.get(ref.path) })),
    batch: () => {
      const ops = [];
      return {
        create: (ref, data) => ops.push([ref, data]),
        commit: async () => {
          ops.forEach(([ref]) => { if (store.has(ref.path)) throw new Error('ALREADY_EXISTS ' + ref.path); });
          ops.forEach(([ref, data]) => { store.set(ref.path, data); log.creates += 1; });
          log.commits += 1;
        },
      };
    },
    collection: (p) => {
      const docs = () => [...store.entries()]
        .filter(([k]) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/'))
        .map(([k, v]) => ({ id: k.split('/').pop(), data: () => v, ref: { path: k } }));
      const q = (list) => ({
        orderBy: (field, dir) => q(() => list().filter((d) => d.data()[field] !== undefined)
          .sort((a, b) => (dir === 'desc' ? -1 : 1) * String(a.data()[field]).localeCompare(String(b.data()[field])))),
        limit: (n) => q(() => list().slice(0, n)),
        get: async () => { const arr = list(); return { docs: arr, forEach: (fn) => arr.forEach(fn) }; },
      });
      return q(docs);
    },
  };
  return db;
}

const oficial = (date, mainNumbers, bonusNumber = null) => ({
  drawDateIso: date + 'T00:00:00.000Z', drawId: date, mainNumbers, bonusNumber, source: 'ny_open_data',
});

test('el documento público tiene la forma que lee la web e id = fecha', () => {
  const doc = buildPublicDrawingDoc(oficial('2026-10-10', [3, 14, 25, 36, 47], 9), 'powerball');
  assert.deepEqual(doc, {
    id: '2026-10-10',
    data: { date: '2026-10-10', mainNumbers: [3, 14, 25, 36, 47], special: 9, gameType: 'powerball', source: 'ny_open_data' },
  });
  assert.equal(isOfficialPublicDoc(doc.id, doc.data), true);
  assert.equal(isOfficialPublicDoc('Ab3dEf6hIj9kLm2nOp5q', doc.data), false);
});

test('juegos sin bola especial guardan special null y Win 4 conserva el orden y los ceros', () => {
  const win4 = normalizeDrawForTest({ drawDate: '2026-10-09', mainNumbers: [0, 7, 0, 3], source: 'ny_open_data' }, 'win4eve');
  const doc = buildPublicDrawingDoc(win4, 'win4eve');
  assert.deepEqual(doc.data.mainNumbers, [0, 7, 0, 3]);
  assert.equal(doc.data.special, null);
});

test('nunca se publica lo que no viene de la fuente oficial', () => {
  assert.equal(buildPublicDrawingDoc({ ...oficial('2026-10-10', [1, 2, 3, 4, 5], 6), source: 'mock_fallback' }, 'powerball'), null);
  assert.equal(buildPublicDrawingDoc({ ...oficial('2026-10-10', [1, 2, 3, 4, 5], 6), source: 'firestore' }, 'powerball'), null);
  assert.equal(buildPublicDrawingDoc({ ...oficial('2026-10-10', [1, 2, 3, 4, 5], 6), source: undefined }, 'powerball'), null);
  assert.equal(buildPublicDrawingDoc({ ...oficial('2026-10-10', [], 6) }, 'powerball'), null);
  assert.equal(buildPublicDrawingDoc({ ...oficial('no-es-fecha', [1, 2, 3, 4, 5], 6) }, 'powerball'), null);
  assert.equal(buildPublicDrawingDoc(null, 'powerball'), null);
});

test('la copia es idempotente: la segunda pasada no crea ni cambia nada', async () => {
  const db = fakeDb();
  const draws = [oficial('2026-10-08', [1, 2, 3, 4, 5], 6), oficial('2026-10-10', [7, 8, 9, 10, 11], 12)];
  const first = await mirrorDrawsToPublic(db, 'powerball', draws, { serverTimestamp: () => 'TS' });
  assert.equal(first.created, 2);
  const before = JSON.stringify([...db.store.entries()]);
  const second = await mirrorDrawsToPublic(db, 'powerball', draws, { serverTimestamp: () => 'TS2' });
  assert.equal(second.created, 0);
  assert.equal(second.existing, 2);
  assert.equal(JSON.stringify([...db.store.entries()]), before);
  assert.equal(db.store.get(publicDrawingsPath('powerball') + '/2026-10-10').createdAt, 'TS');
});

test('no toca los documentos antiguos de los navegadores ni pisa un oficial existente', async () => {
  const base = publicDrawingsPath('powerball');
  const viejo = { mainNumbers: '[9,9,9,9,9]', special: 1, date: '2026-10-10', userId: 'anon', createdAt: 'antes' };
  const yaOficial = { date: '2026-10-08', mainNumbers: [1, 2, 3, 4, 5], special: 6, source: 'ny_open_data', gameType: 'powerball', createdAt: 'antes' };
  const db = fakeDb({ [base + '/Ab3dEf6hIj9kLm2nOp5q']: viejo, [base + '/2026-10-08']: yaOficial });
  const result = await mirrorDrawsToPublic(db, 'powerball', [
    oficial('2026-10-08', [50, 51, 52, 53, 54], 20), // distinto a lo guardado: NO debe pisarlo
    oficial('2026-10-10', [7, 8, 9, 10, 11], 12),
  ], { serverTimestamp: () => 'TS' });
  assert.equal(result.created, 1);
  assert.equal(result.existing, 1);
  assert.deepEqual(db.store.get(base + '/Ab3dEf6hIj9kLm2nOp5q'), viejo);
  assert.deepEqual(db.store.get(base + '/2026-10-08'), yaOficial);
  assert.deepEqual(db.store.get(base + '/2026-10-10').mainNumbers, [7, 8, 9, 10, 11]);
  assert.equal(db.store.size, 3);
});

test('la simulación no escribe y dice qué crearía', async () => {
  const db = fakeDb();
  const result = await mirrorDrawsToPublic(db, 'take5day', [oficial('2026-10-10', [1, 2, 3, 4, 5]), { ...oficial('2026-10-11', [1, 2, 3, 4, 6]), source: 'mock_fallback' }], { dryRun: true });
  assert.deepEqual(result.wouldCreate, ['2026-10-10']);
  assert.equal(result.skipped, 1);
  assert.equal(result.created, 0);
  assert.equal(db.store.size, 0);
  assert.equal(db.log.commits, 0);
});

test('más de un lote: 650 sorteos se crean sin duplicar fechas repetidas', async () => {
  const db = fakeDb();
  const draws = [];
  const start = Date.UTC(2024, 0, 1);
  for (let i = 0; i < 650; i += 1) {
    draws.push(oficial(new Date(start + i * 86400000).toISOString().slice(0, 10), [1, 2, 3, 4, 5], 6));
  }
  draws.push(draws[0]); // fecha repetida en la fuente
  const result = await mirrorDrawsToPublic(db, 'powerball', draws, {});
  assert.equal(result.candidates, 650);
  assert.equal(result.created, 650);
  assert.equal(db.store.size, 650);
  assert.ok(db.log.commits >= 3);
});

test('el margen histórico usa el sorteo oficial cuando un documento antiguo lo contradice', async () => {
  const base = publicDrawingsPath('powerball');
  const db = fakeDb({
    [base + '/2026-10-10']: { date: '2026-10-10', mainNumbers: [7, 8, 9, 10, 11], special: 12, source: 'ny_open_data' },
    [base + '/Ab3dEf6hIj9kLm2nOp5q']: { date: '2026-10-10', mainNumbers: '[60,61,62,63,64]', special: 1, userId: 'anon' },
    [base + '/Zz3dEf6hIj9kLm2nOp5q']: { date: '2026-10-07', mainNumbers: '[20,21,22,23,24]', special: 2, userId: 'anon' },
    [base + '/Yy3dEf6hIj9kLm2nOp5q']: { date: '2026-10-05', mainNumbers: '[30,31,32,33,34]', special: 3, userId: 'anon' },
  });
  const history = await loadPreferredHistoryDrawsForTest(db, 'powerball');
  assert.equal(history.length, 3);
  assert.deepEqual(history[0].mainNumbers, [7, 8, 9, 10, 11]);
  assert.equal(history.some((d) => d.mainNumbers.includes(60)), false);
  // Donde no hay oficial, el documento antiguo se sigue usando (no se borra ni se oculta).
  assert.deepEqual(history[1].mainNumbers, [20, 21, 22, 23, 24]);
});
