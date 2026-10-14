'use strict';
// Archiva (no borra) los sorteos que crearon los navegadores en *_drawings antes de la
// ingesta oficial (decisión de Amin, 2026-10-14).
//
// Para cada documento de *_drawings que NO es de la ingesta oficial:
//   1. Lo clasifica contra la fuente oficial (NY Open Data) de su fecha:
//      coincide · no coincide · fecha sin sorteo · vacío
//   2. Con --write: lo copia con TODOS sus campos más archivedAt, archivedReason y
//      originalPath a archived_browser_drawings/<juego>__<id> (create(): nunca pisa).
//   3. Relee la copia y comprueba que es idéntica al original (sin los 3 campos nuevos).
//   4. Solo entonces borra el original, con precondición de que no cambió desde la lectura.
//
// Seguridad:
//   - Un documento de la ingesta (id = fecha, source = ny_open_data) nunca es candidato.
//     Un id con forma de fecha que no sea oficial detiene el script (no se adivina).
//   - Si en un juego no queda ningún documento oficial, ese juego NO se archiva (la web
//     no puede quedarse sin historial).
//   - --expect N: aborta antes de escribir si los candidatos no son exactamente N.
//   - Idempotente: si la copia ya existe e es idéntica, solo falta quitar el original;
//     si existe y es distinta, se detiene en ese documento.
//
// Uso:
//   node scripts/archivar-sorteos-navegador.js --project game-lottery-b0e90 --dry-run [--json salida.json]
//   node scripts/archivar-sorteos-navegador.js --project game-lottery-b0e90 --write --expect 98
// Opcional: --game <juego> · --fuente-local <json> (solo tests)
// Credenciales: ver scripts/lib/firestore-cli.js

const fs = require('node:fs');
const path = require('node:path');
const { openFirestore, functionsDir } = require('./lib/firestore-cli.js');
const { GAMES, OFFICIAL_SOURCE } = require('./lib/juegos.js');

const ARCHIVE = 'archived_browser_drawings';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ADDED_FIELDS = ['archivedAt', 'archivedReason', 'originalPath'];
const REASON_PREFIX = 'creado por navegador antes de la ingesta oficial; ';
const CLASSES = ['coincide', 'no coincide', 'fecha sin sorteo', 'vacío'];
const TIMEOUT_MS = 10 * 60 * 1000;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};

// ── Valores de Firestore a una forma comparable ───────────────────────────────
function canon(v) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map(canon);
  if (typeof v === 'object') {
    if (typeof v.toMillis === 'function' && 'nanoseconds' in v) return { $ts: [v.seconds, v.nanoseconds] };
    if ('latitude' in v && 'longitude' in v && typeof v.isEqual === 'function') return { $geo: [v.latitude, v.longitude] };
    if (typeof v.path === 'string' && v.firestore) return { $ref: v.path };
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { $bytes: Buffer.from(v).toString('base64') };
    const out = {};
    Object.keys(v).sort().forEach((k) => { out[k] = canon(v[k]); });
    return out;
  }
  return v;
}
const sameData = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

function withoutAdded(data) {
  const copy = { ...data };
  ADDED_FIELDS.forEach((k) => delete copy[k]);
  return copy;
}

// ── Lectura de los números de un documento antiguo (array o texto JSON) ──────
function readNumbers(v) {
  if (Array.isArray(v)) return v.map(Number).filter(Number.isFinite);
  if (typeof v === 'string' && v.trim()) {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p.map(Number).filter(Number.isFinite);
    } catch (_) { /* texto suelto */ }
    return v.split(/[^0-9]+/).filter(Boolean).map(Number);
  }
  return [];
}
function readSpecial(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function docDate(data) {
  const raw = data && (data.date || data.drawDate);
  if (typeof raw === 'string' && DATE_RE.test(raw.slice(0, 10))) return raw.slice(0, 10);
  if (raw && typeof raw.toDate === 'function') return raw.toDate().toISOString().slice(0, 10);
  return null;
}

// ── Fuente oficial ────────────────────────────────────────────────────────────
const sourceCache = new Map();
// --fuente-local <json>: { "<juego>|<fecha>": { "main": [...], "special": n|null } } en vez de
// consultar NY Open Data (para los tests en el emulador). Lo que no esté = sin sorteo.
let localSource = null;
async function officialRow(gameType, date) {
  const key = gameType + '|' + date;
  if (localSource) return localSource[key] || null;
  if (sourceCache.has(key)) return sourceCache.get(key);
  const spec = OFFICIAL_SOURCE[gameType];
  const url = spec.url + '?$where=' + encodeURIComponent("draw_date='" + date + "T00:00:00.000'") + '&$limit=5';
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('NY Open Data ' + res.status + ' para ' + gameType + ' ' + date);
  const rows = await res.json();
  let found = null;
  for (const row of Array.isArray(rows) ? rows : []) {
    const main = spec.main(row);
    if (main.length) { found = { main, special: spec.special(row) }; break; }
  }
  sourceCache.set(key, found);
  return found;
}

async function classify(gameType, data) {
  const date = docDate(data);
  const nums = readNumbers(data && data.mainNumbers);
  if (!date && !nums.length) return { clase: 'vacío', date: null };
  if (!date) return { clase: 'fecha sin sorteo', date: null };
  const off = await officialRow(gameType, date);
  if (!off) return { clase: nums.length ? 'fecha sin sorteo' : 'vacío', date };
  if (!nums.length) return { clase: 'vacío', date };
  const positional = OFFICIAL_SOURCE[gameType].positional === true;
  const a = positional ? nums : [...nums].sort((x, y) => x - y);
  const b = positional ? off.main : [...off.main].sort((x, y) => x - y);
  const special = readSpecial(data.special);
  const sameMain = a.length === b.length && a.every((n, i) => n === b[i]);
  const sameSpecial = off.special === null || special === off.special;
  return { clase: sameMain && sameSpecial ? 'coincide' : 'no coincide', date };
}

// ── Principal ─────────────────────────────────────────────────────────────────
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

  const { publicDrawingsPath, isOfficialPublicDoc } = require(path.join(functionsDir, 'public-drawings.js'));
  const { db, FieldValue, auth } = openFirestore(project);
  const games = GAMES.filter((g) => !onlyGame || g === onlyGame);
  if (!games.length) throw new Error('Juego no soportado: ' + onlyGame);

  console.log(JSON.stringify({ project, auth, modo: write ? 'ESCRITURA' : 'SIMULACION (no escribe)', games }));

  // 1. Inventario y clasificación (lectura).
  const candidates = [];
  const protectedGames = [];
  for (const g of games) {
    const colPath = publicDrawingsPath(g);
    const snap = await db.collection(colPath).get();
    let official = 0;
    const mine = [];
    for (const doc of snap.docs) {
      const data = doc.data();
      if (isOfficialPublicDoc(doc.id, data) && data.source === 'ny_open_data') { official += 1; continue; }
      if (DATE_RE.test(doc.id) || (data && data.source === 'ny_open_data')) {
        throw new Error('Documento ambiguo (id con forma de fecha o source oficial sin serlo): ' + colPath + '/' + doc.id + '. No se toca nada.');
      }
      mine.push(doc);
    }
    for (const doc of mine) {
      const c = await classify(g, doc.data());
      candidates.push({ gameType: g, id: doc.id, path: colPath + '/' + doc.id, date: c.date, clase: c.clase, snap: doc });
    }
    if (mine.length && official === 0) protectedGames.push(g);
    console.log(JSON.stringify({ gameType: g, total: snap.size, oficiales: official, candidatos: mine.length, protegidoSinOficiales: mine.length > 0 && official === 0 }));
  }

  const resumen = {};
  candidates.forEach((c) => {
    resumen[c.gameType] = resumen[c.gameType] || Object.fromEntries(CLASSES.map((k) => [k, 0]));
    resumen[c.gameType][c.clase] += 1;
  });
  const listado = candidates.map((c) => ({ gameType: c.gameType, id: c.id, date: c.date, clasificacion: c.clase }));
  listado.forEach((c) => console.log([c.gameType, c.id, c.date || '-', c.clasificacion].join('\t')));
  console.log(JSON.stringify({ candidatos: candidates.length, resumen, juegosProtegidos: protectedGames }));
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ project, generado: new Date().toISOString(), candidatos: candidates.length, resumen, listado }, null, 2));

  if (expect !== null && candidates.length !== expect) {
    throw new Error('Se esperaban ' + expect + ' candidatos y hay ' + candidates.length + '. No se escribe nada.');
  }
  if (!write) return;

  // 2. Copia → verificación → retirada del original, documento a documento.
  const res = { archivados: 0, yaArchivados: 0, saltadosJuegoProtegido: 0, errores: [] };
  for (const c of candidates) {
    if (protectedGames.includes(c.gameType)) { res.saltadosJuegoProtegido += 1; continue; }
    const original = c.snap.data();
    const clash = ADDED_FIELDS.find((k) => Object.prototype.hasOwnProperty.call(original, k));
    if (clash) { res.errores.push(c.path + ': ya tiene el campo ' + clash + '; no se toca'); continue; }
    const archRef = db.collection(ARCHIVE).doc(c.gameType + '__' + c.id);
    try {
      let arch = await archRef.get();
      if (!arch.exists) {
        await archRef.create({
          ...original,
          archivedAt: FieldValue.serverTimestamp(),
          archivedReason: REASON_PREFIX + c.clase,
          originalPath: c.path,
        });
        arch = await archRef.get();
      } else {
        res.yaArchivados += 1;
      }
      const a = arch.data();
      if (!arch.exists || a.originalPath !== c.path || !sameData(withoutAdded(a), original) || !a.archivedAt) {
        res.errores.push(c.path + ': la copia no es idéntica; el original NO se quita');
        continue;
      }
      // Precondición: el original no cambió desde que se leyó.
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

module.exports = { canon, sameData, withoutAdded, readNumbers, docDate, ARCHIVE, REASON_PREFIX };
