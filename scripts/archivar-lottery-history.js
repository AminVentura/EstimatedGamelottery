'use strict';
// Archiva (no borra) los sorteos de lottery_history/<juego>_<año>/draws que no coinciden con
// la fuente oficial (decisión de Amin, 2026-10-14). Mismo patrón que
// scripts/archivar-sorteos-navegador.js.
//
// Para cada documento de lottery_history/*/draws:
//   1. Lo clasifica contra la fuente oficial (NY Open Data) de su fecha:
//        coincide                    -> se queda (no se toca)
//        mock_fallback               -> datos generados, no son un sorteo
//        cash4life como MFL          -> sorteo de Cash4Life guardado como Millionaire For Life
//        no coincide                 -> la fuente oficial tiene otros números ese día
//        fecha sin sorteo oficial    -> la fuente oficial no tiene sorteo ese día
//        sin datos                   -> sin fecha o sin números
//        juego no soportado          -> el documento padre no es de un juego conocido
//   2. Con --write: copia íntegra con archivedAt, archivedReason y originalPath en
//      archived_lottery_history/<historyId>__<drawId> (create(): nunca pisa).
//   3. Relee la copia y comprueba que es idéntica al original (sin los 3 campos nuevos).
//   4. Solo entonces borra el original, con precondición de que no cambió desde la lectura.
//
// Seguridad:
//   - Simula por defecto. --expect N aborta antes de escribir si los candidatos no son N.
//   - Idempotente: si la copia ya existe e es idéntica, solo falta quitar el original;
//     si existe y es distinta, se detiene en ese documento.
//   - Ninguna function ni la web leen estos documentos (comprobado el 2026-10-14): los
//     modelos y la web usan el historial público oficial (*_drawings).
//
// Uso:
//   node scripts/archivar-lottery-history.js --project game-lottery-b0e90 --dry-run [--json salida.json]
//   node scripts/archivar-lottery-history.js --project game-lottery-b0e90 --write --expect N
// Opcional: --game <juego> · --fuente-local <json> (solo tests)
// Credenciales: ver scripts/lib/firestore-cli.js

const fs = require('node:fs');
const { openFirestore } = require('./lib/firestore-cli.js');
const { GAMES, OFFICIAL_SOURCE } = require('./lib/juegos.js');
const { sameData, withoutAdded } = require('./archivar-sorteos-navegador.js');

const ARCHIVE = 'archived_lottery_history';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ADDED_FIELDS = ['archivedAt', 'archivedReason', 'originalPath'];
const KEEP = 'coincide';
const REASONS = {
  mock_fallback: 'lottery_history: datos generados (source mock_fallback), no es un sorteo',
  cash4life: 'lottery_history: sorteo de Cash4Life guardado como Millionaire For Life',
  'no coincide': 'lottery_history: los números no coinciden con la fuente oficial de esa fecha',
  'fecha sin sorteo oficial': 'lottery_history: la fuente oficial no tiene sorteo en esa fecha',
  'sin datos': 'lottery_history: sin fecha o sin números',
  'juego no soportado': 'lottery_history: juego no reconocido',
};
const CLASSES = [KEEP, ...Object.keys(REASONS)];
// Cash4Life (NY Open Data kwxv-fwze): solo para reconocer lo guardado por error como MFL.
const CASH4LIFE = { url: 'https://data.ny.gov/resource/kwxv-fwze.json', main: (r) => String(r.winning_numbers || '').trim().split(/\s+/).filter(Boolean).map(Number), special: (r) => (r.cash_ball == null ? null : Number(r.cash_ball)) };
const TIMEOUT_MS = 15 * 60 * 1000;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};

function gameFromHistoryId(historyId, data) {
  const m = /^(.+)_(\d{4})$/.exec(historyId);
  const g = m ? m[1] : String((data && data.gameType) || '');
  return GAMES.includes(g) ? g : null;
}

function drawDateOf(id, data) {
  const raw = data && data.drawDate;
  if (typeof raw === 'string' && DATE_RE.test(raw.slice(0, 10))) return raw.slice(0, 10);
  if (raw && typeof raw.toDate === 'function') return raw.toDate().toISOString().slice(0, 10);
  return DATE_RE.test(id) ? id : null;
}

function nums(v) {
  if (!Array.isArray(v)) return [];
  return v.map(Number).filter(Number.isFinite);
}
function bonusOf(data) {
  const v = data && data.bonusNumber;
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── Fuente oficial: un conjunto entero por juego entre la primera y la última fecha ──
// --fuente-local <json>: { "<juego>|<fecha>": { "main": [...], "special": n|null },
//                          "cash4life|<fecha>": {...} } para los tests en el emulador.
let localSource = null;
const datasetCache = new Map();
async function loadDataset(key, spec, from, to) {
  const cacheKey = key + '|' + from + '|' + to;
  if (datasetCache.has(cacheKey)) return datasetCache.get(cacheKey);
  const where = "draw_date >= '" + from + "T00:00:00.000' AND draw_date <= '" + to + "T00:00:00.000'";
  const url = spec.url + '?$where=' + encodeURIComponent(where) + '&$order=draw_date&$limit=50000';
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error('NY Open Data ' + res.status + ' para ' + key);
  const rows = await res.json();
  const byDate = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = String(row.draw_date || '').slice(0, 10);
    const main = spec.main(row);
    if (DATE_RE.test(date) && main.length && !byDate.has(date)) byDate.set(date, { main, special: spec.special(row) });
  }
  datasetCache.set(cacheKey, byDate);
  return byDate;
}
async function officialRow(key, spec, date, range) {
  if (localSource) return localSource[key + '|' + date] || null;
  const ds = await loadDataset(key, spec, range.from, range.to);
  return ds.get(date) || null;
}

function sameDraw(gameType, docMain, docBonus, off, positional) {
  const a = positional ? docMain : [...docMain].sort((x, y) => x - y);
  const b = positional ? off.main : [...off.main].sort((x, y) => x - y);
  const sameMain = a.length === b.length && a.every((n, i) => n === b[i]);
  const sameSpecial = off.special === null || off.special === undefined || docBonus === off.special;
  return sameMain && sameSpecial;
}

async function classify(c, range) {
  const { gameType, data, date } = c;
  if (!gameType) return 'juego no soportado';
  if (String((data && data.source) || '') === 'mock_fallback') return 'mock_fallback';
  const main = nums(data && data.mainNumbers);
  if (!date || !main.length) return 'sin datos';
  const spec = OFFICIAL_SOURCE[gameType];
  const off = await officialRow(gameType, spec, date, range);
  if (off && sameDraw(gameType, main, bonusOf(data), off, spec.positional === true)) return KEEP;
  if (gameType === 'millionaireforlife') {
    const c4l = await officialRow('cash4life', CASH4LIFE, date, range);
    if (c4l && sameDraw('cash4life', main, bonusOf(data), c4l, false)) return 'cash4life';
  }
  return off ? 'no coincide' : 'fecha sin sorteo oficial';
}

async function main() {
  const project = value('--project');
  const write = flag('--write');
  if (write && flag('--dry-run')) throw new Error('Usa --dry-run o --write, no los dos.');
  if (!project) throw new Error('Falta --project <id>. No se asume ningún proyecto.');
  if (project.startsWith('demo-') && !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Un proyecto demo- solo vale con FIRESTORE_EMULATOR_HOST.');
  }
  const expect = value('--expect') == null ? null : Number(value('--expect'));
  const onlyGame = value('--game');
  const jsonOut = value('--json');
  if (value('--fuente-local')) localSource = JSON.parse(fs.readFileSync(value('--fuente-local'), 'utf8'));
  process.env.GCLOUD_PROJECT = project;

  const { db, FieldValue, auth } = openFirestore(project);
  console.log(JSON.stringify({ project, auth, modo: write ? 'ESCRITURA' : 'SIMULACION (no escribe)', juego: onlyGame || 'todos' }));

  // 1. Inventario (lectura). Los padres no existen en producción: listDocuments().
  const parents = await db.collection('lottery_history').listDocuments();
  const all = [];
  const otherSubcollections = [];
  for (const parent of parents) {
    const gameType = gameFromHistoryId(parent.id, null);
    if (onlyGame && gameType !== onlyGame) continue;
    const subs = await parent.listCollections();
    subs.filter((s) => s.id !== 'draws').forEach((s) => otherSubcollections.push(s.path));
    const snap = await db.collection('lottery_history/' + parent.id + '/draws').get();
    for (const doc of snap.docs) {
      const data = doc.data();
      all.push({ historyId: parent.id, id: doc.id, path: doc.ref.path, gameType: gameFromHistoryId(parent.id, data), data, date: drawDateOf(doc.id, data), snap: doc });
    }
  }
  if (otherSubcollections.length) console.log(JSON.stringify({ avisoOtrasSubcolecciones: otherSubcollections }));

  // 2. Clasificación contra la fuente oficial.
  const dates = all.map((c) => c.date).filter(Boolean).sort();
  const range = { from: dates[0] || '2000-01-01', to: dates[dates.length - 1] || '2000-01-01' };
  for (const c of all) c.clase = await classify(c, range);

  const resumen = {};
  all.forEach((c) => {
    const g = c.gameType || c.historyId;
    resumen[g] = resumen[g] || Object.fromEntries(CLASSES.map((k) => [k, 0]));
    resumen[g][c.clase] += 1;
  });
  const candidates = all.filter((c) => c.clase !== KEEP);
  const listado = candidates.map((c) => ({ historyId: c.historyId, id: c.id, date: c.date, source: (c.data && c.data.source) || null, clasificacion: c.clase }));
  listado.forEach((c) => console.log([c.historyId, c.id, c.date || '-', c.source || '-', c.clasificacion].join('\t')));
  console.log(JSON.stringify({ documentos: all.length, seQuedan: all.length - candidates.length, candidatos: candidates.length, resumen }));
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ project, generado: new Date().toISOString(), documentos: all.length, candidatos: candidates.length, resumen, listado }, null, 2));

  if (expect !== null && candidates.length !== expect) {
    throw new Error('Se esperaban ' + expect + ' candidatos y hay ' + candidates.length + '. No se escribe nada.');
  }
  if (!write) return;

  // 3. Copia -> verificación -> retirada del original, documento a documento.
  const res = { archivados: 0, yaArchivados: 0, errores: [] };
  for (const c of candidates) {
    const original = c.data;
    const clash = ADDED_FIELDS.find((k) => Object.prototype.hasOwnProperty.call(original, k));
    if (clash) { res.errores.push(c.path + ': ya tiene el campo ' + clash + '; no se toca'); continue; }
    const archRef = db.collection(ARCHIVE).doc(c.historyId + '__' + c.id);
    try {
      let arch = await archRef.get();
      if (!arch.exists) {
        await archRef.create({ ...original, archivedAt: FieldValue.serverTimestamp(), archivedReason: REASONS[c.clase], originalPath: c.path });
        arch = await archRef.get();
      } else {
        res.yaArchivados += 1;
      }
      const a = arch.data();
      if (!arch.exists || a.originalPath !== c.path || !sameData(withoutAdded(a), original) || !a.archivedAt) {
        res.errores.push(c.path + ': la copia no es idéntica; el original NO se quita');
        continue;
      }
      await db.doc(c.path).delete({ lastUpdateTime: c.snap.updateTime });
      res.archivados += 1;
    } catch (err) {
      res.errores.push(c.path + ': ' + (err && err.message ? err.message : String(err)));
    }
  }
  console.log(JSON.stringify({ resultado: res }));
  if (res.errores.length) throw new Error(res.errores.length + ' documento(s) con error; revisa el resultado.');
}

if (require.main === module) {
  const timer = setTimeout(() => { console.error('Tiempo agotado (' + TIMEOUT_MS / 1000 + ' s).'); process.exit(2); }, TIMEOUT_MS);
  main()
    .then(() => { clearTimeout(timer); process.exit(0); })
    .catch((err) => { clearTimeout(timer); console.error('ERROR:', err instanceof Error ? err.message : String(err)); process.exit(1); });
}

module.exports = { ARCHIVE, REASONS, gameFromHistoryId, drawDateOf };
