// Fuente oficial de la ingesta (NY Open Data) y lectura de lottery_history para el relleno.
const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchOfficialDrawsForOps, loadGameDrawsForOps } = require('./index.js');
const { buildPublicDrawingDoc } = require('./public-drawings.js');

function withFetch(rows, fn) {
  const original = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    return { ok: true, status: 200, json: async () => rows };
  };
  return Promise.resolve(fn(calls)).finally(() => { global.fetch = original; });
}

test('Millionaire For Life se lee del conjunto oficial a4w9-a3tp con la bola mill_ball', async () => {
  const rows = [
    { draw_date: '2026-10-13T00:00:00.000', winning_numbers: '03 07 35 45 53', mill_ball: '4' },
    { draw_date: '2026-02-22T00:00:00.000', winning_numbers: '01 02 03 04 58', mill_ball: '5' },
  ];
  await withFetch(rows, async (calls) => {
    const draws = await fetchOfficialDrawsForOps('millionaireforlife');
    assert.match(calls[0], /data\.ny\.gov\/resource\/a4w9-a3tp\.json/);
    assert.match(calls[0], /\$limit=200&/);
    assert.equal(draws.length, 2);
    assert.deepEqual(draws[0].mainNumbers, [3, 7, 35, 45, 53]);
    assert.equal(draws[0].bonusNumber, 4);
    assert.equal(draws[0].source, 'ny_open_data');
    const doc = buildPublicDrawingDoc(draws[0], 'millionaireforlife');
    assert.equal(doc.id, '2026-10-13');
    assert.deepEqual(doc.data, { date: '2026-10-13', mainNumbers: [3, 7, 35, 45, 53], special: 4, gameType: 'millionaireforlife', source: 'ny_open_data' });
  });
});

test('Millionaire For Life descarta filas de Cash4Life (antes del 2026-02-22 o fuera de rango)', async () => {
  const rows = [
    { draw_date: '2026-02-21T00:00:00.000', winning_numbers: '20 25 30 52 55', cash_ball: '04' },
    { draw_date: '2026-03-01T00:00:00.000', winning_numbers: '01 02 03 04 60', mill_ball: '2' },
    { draw_date: '2026-03-02T00:00:00.000', winning_numbers: '01 02 03 04 05', mill_ball: '6' },
  ];
  await withFetch(rows, async () => {
    const draws = await fetchOfficialDrawsForOps('millionaireforlife');
    assert.equal(draws.length, 0);
  });
});

test('el relleno puede pedir más filas a la fuente (tope 5000)', async () => {
  await withFetch([], async (calls) => {
    await fetchOfficialDrawsForOps('powerball', { limit: 5000 });
    await fetchOfficialDrawsForOps('powerball', { limit: 99999 });
    assert.match(calls[0], /\$limit=5000&/);
    assert.match(calls[1], /\$limit=5000&/);
  });
});

// Firestore mínimo: lottery_history sin documentos padre (como en producción) y una subcolección draws.
function fakeDb(drawsByParent) {
  const draws = (parent) => {
    const docs = (drawsByParent[parent] || []).map((d) => ({ id: d.id, data: () => d, ref: { path: 'lottery_history/' + parent + '/draws/' + d.id } }));
    const q = { orderBy: () => q, limit: () => q, get: async () => ({ forEach: (f) => docs.forEach(f), docs }) };
    return q;
  };
  return {
    collection(p) {
      if (p === 'lottery_history') {
        return {
          get: async () => ({ docs: [] }), // los padres no existen
          listDocuments: async () => Object.keys(drawsByParent).map((id) => ({ id })),
        };
      }
      const m = /^lottery_history\/([^/]+)\/draws$/.exec(p);
      if (m) return draws(m[1]);
      throw new Error('colección inesperada ' + p);
    },
  };
}

test('lottery_history sin documentos padre: loadGameDraws encuentra los sorteos y descarta mock_fallback', async () => {
  const db = fakeDb({
    powerball_2026: [
      { id: '2026-10-12', drawDate: '2026-10-12T00:00:00.000Z', mainNumbers: [1, 2, 3, 4, 5], bonusNumber: 9, source: 'ny_open_data' },
      { id: '2026-10-13', drawDate: '2026-10-13T00:00:00.000Z', mainNumbers: [6, 7, 8, 9, 10], bonusNumber: 1, source: 'mock_fallback' },
    ],
    megamillions_2026: [{ id: '2026-10-10', drawDate: '2026-10-10T00:00:00.000Z', mainNumbers: [1, 2, 3, 4, 5], bonusNumber: 9, source: 'ny_open_data' }],
  });
  const found = await loadGameDrawsForOps(db, 'powerball', 100);
  assert.equal(found.length, 1);
  assert.equal(found[0].drawId, '2026-10-12');
  // El script de relleno pide todo y filtra él mismo (cuenta los descartes).
  assert.equal((await loadGameDrawsForOps(db, 'powerball', 100, { includeUnofficial: true })).length, 2);
});
