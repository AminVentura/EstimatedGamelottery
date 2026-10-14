// Tests de la mezcla del historial que hace la web (sitio/historial-oficial.js).
// Ejecutar desde la raíz:  node --test tests/web/historial-oficial.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { esOficialDelServidor, mezclarHistorial } from '../../sitio/historial-oficial.js';

const oficial = (date, mainNumbers, special = null) => ({ id: date, data: { date, mainNumbers, special, source: 'ny_open_data' } });
const viejo = (id, date, mainNumbers, special = null) => ({ id, data: { date, mainNumbers: JSON.stringify(mainNumbers), special, userId: 'anon' } });

test('reconoce el documento oficial por id = fecha', () => {
  assert.equal(esOficialDelServidor(oficial('2026-10-10', [1])), true);
  assert.equal(esOficialDelServidor(viejo('Ab3dEf6hIj9kLm2nOp5q', '2026-10-10', [1])), false);
  assert.equal(esOficialDelServidor({ id: 'ny-pb-2026-10-10', data: { date: '2026-10-10' } }), false);
  assert.equal(esOficialDelServidor(null), false);
});

test('una fecha, una fila: gana el oficial, llegue antes o después', () => {
  const a = mezclarHistorial([viejo('Ab3dEf6hIj9kLm2nOp5q', '2026-10-10', [9, 9, 9, 9, 9], 1), oficial('2026-10-10', [7, 8, 9, 10, 11], 12)]);
  const b = mezclarHistorial([oficial('2026-10-10', [7, 8, 9, 10, 11], 12), viejo('Ab3dEf6hIj9kLm2nOp5q', '2026-10-10', [9, 9, 9, 9, 9], 1)]);
  for (const out of [a, b]) {
    assert.equal(out.length, 1);
    assert.equal(out[0].id, '2026-10-10');
    assert.deepEqual(out[0].data.mainNumbers, [7, 8, 9, 10, 11]);
  }
});

test('los documentos antiguos siguen viéndose donde no hay oficial, y el orden es de más nuevo a más viejo', () => {
  const out = mezclarHistorial([
    viejo('Zz3dEf6hIj9kLm2nOp5q', '2026-03-01', [1, 2, 3, 4, 5]),
    oficial('2026-10-10', [7, 8, 9, 10, 11], 12),
    oficial('2026-10-08', [1, 2, 3, 4, 6], 2),
  ]);
  assert.deepEqual(out.map((i) => i.data.date), ['2026-10-10', '2026-10-08', '2026-03-01']);
});

test('conserva semillas y filas de NY Open Data ya cargadas, sin duplicar fechas', () => {
  const enMemoria = [
    { id: 'seed-mm-2026-02-06', data: { date: '2026-02-06', mainNumbers: [13, 21, 25, 52, 62], special: 19 } },
    { id: 'ny-mm-2026-10-09', data: { date: '2026-10-09', mainNumbers: [1, 2, 3, 4, 5], special: 6 } },
    { id: 'ny-mm-2026-10-06', data: { date: '2026-10-06', mainNumbers: [1, 2, 3, 4, 7], special: 6 } },
    // documento de Firestore de una instantánea anterior que ya no viene: no debe quedarse
    { id: 'Qq3dEf6hIj9kLm2nOp5q', data: { date: '2026-01-01', mainNumbers: '[1,2,3,4,5]', special: 1 } },
  ];
  const out = mezclarHistorial([oficial('2026-10-09', [1, 2, 3, 4, 5], 6)], enMemoria);
  assert.deepEqual(out.map((i) => i.id), ['2026-10-09', 'ny-mm-2026-10-06', 'seed-mm-2026-02-06']);
});

test('ignora documentos sin fecha y no falla con entradas vacías', () => {
  assert.deepEqual(mezclarHistorial([{ id: 'x', data: {} }, null], undefined), []);
  assert.deepEqual(mezclarHistorial(undefined, undefined), []);
});

test('la web usa la mezcla y no escribe sorteos', () => {
  const app = fs.readFileSync(fileURLToPath(new URL('../../sitio/app.js', import.meta.url)), 'utf8');
  assert.match(app, /import \{ mezclarHistorial \} from "\.\/historial-oficial\.js";/);
  assert.match(app, /allHistoryData\[key\] = mezclarHistorial\(firebaseItems, allHistoryData\[key\]\);/);
  assert.equal(/addDoc\(collection\(db, paths\[/.test(app), false);
  const sw = fs.readFileSync(fileURLToPath(new URL('../../sitio/sw.js', import.meta.url)), 'utf8');
  assert.match(sw, /'\/historial-oficial\.js'/);
});
