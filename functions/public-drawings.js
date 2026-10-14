'use strict';
// Historial público de sorteos (colecciones *_drawings que lee la web).
//
// Desde 2026-10-10 ningún navegador escribe en *_drawings (firestore.rules: write false).
// Desde 2026-10-13 lo llena la ingesta oficial: cada sorteo de la fuente oficial se copia
// aquí con id = fecha (AAAA-MM-DD) y `create()`, que nunca pisa un documento existente.
// - Idempotente: repetir la copia no duplica ni cambia nada.
// - No borra ni reescribe documentos antiguos (los que crearon los navegadores tienen id
//   automático de 20 caracteres, así que no chocan con el id = fecha).
// - Solo fuente oficial: lo que no venga de OFFICIAL_SOURCES se descarta.

const PUBLIC_BASE = 'artifacts/EstimatedGamelottery-app/public/data/';
const OFFICIAL_SOURCES = new Set(['ny_open_data']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CHUNK = 300; // por debajo del tope de 500 escrituras por lote

function publicDrawingsPath(gameType) {
  return PUBLIC_BASE + gameType + '_drawings';
}

// Un documento es «oficial del servidor» si su id es su propia fecha.
function isOfficialPublicDoc(id, data) {
  return !!data && typeof data.date === 'string' && DATE_RE.test(data.date) && id === data.date;
}

// De un sorteo normalizado (normalizeDraw) a { id, data } con la forma que lee la web:
// date 'AAAA-MM-DD', mainNumbers array de enteros, special entero o null.
function buildPublicDrawingDoc(draw, gameType) {
  if (!draw || !gameType) return null;
  if (!OFFICIAL_SOURCES.has(String(draw.source || ''))) return null;
  const iso = String(draw.drawDateIso || draw.drawDate || '');
  const date = iso.slice(0, 10);
  if (!DATE_RE.test(date) || Number.isNaN(new Date(date + 'T00:00:00Z').getTime())) return null;
  const mainNumbers = Array.isArray(draw.mainNumbers) ? draw.mainNumbers.map(Number) : [];
  if (!mainNumbers.length || !mainNumbers.every((n) => Number.isInteger(n) && n >= 0)) return null;
  const bonus = draw.bonusNumber == null ? null : Number(draw.bonusNumber);
  if (bonus !== null && !Number.isInteger(bonus)) return null;
  return {
    id: date,
    data: {
      date,
      mainNumbers,
      special: bonus,
      gameType,
      source: String(draw.source),
    },
  };
}

// Copia los sorteos oficiales que falten en *_drawings. Devuelve el recuento.
// `serverTimestamp` es FieldValue.serverTimestamp (se inyecta para poder probar sin Firestore).
async function mirrorDrawsToPublic(db, gameType, draws, options = {}) {
  const dryRun = options.dryRun === true;
  const serverTimestamp = options.serverTimestamp;
  const path = publicDrawingsPath(gameType);
  const byId = new Map();
  let skipped = 0;
  (Array.isArray(draws) ? draws : []).forEach((draw) => {
    const built = buildPublicDrawingDoc(draw, gameType);
    if (!built) { skipped += 1; return; }
    if (!byId.has(built.id)) byId.set(built.id, built.data);
  });

  const ids = [...byId.keys()].sort();
  const result = { gameType, path, candidates: ids.length, skipped, existing: 0, created: 0, wouldCreate: [], dryRun };

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const refs = chunk.map((id) => db.doc(path + '/' + id));
    const snaps = await db.getAll(...refs);
    const missing = [];
    snaps.forEach((snap, idx) => {
      if (snap.exists) result.existing += 1;
      else missing.push(chunk[idx]);
    });
    if (!missing.length) continue;
    if (dryRun) {
      result.wouldCreate.push(...missing);
      continue;
    }
    const batch = db.batch();
    missing.forEach((id) => {
      const data = { ...byId.get(id) };
      if (typeof serverTimestamp === 'function') data.createdAt = serverTimestamp();
      // create() falla si el documento ya existe: nunca se pisa nada.
      batch.create(db.doc(path + '/' + id), data);
    });
    await batch.commit();
    result.created += missing.length;
  }
  return result;
}

module.exports = {
  PUBLIC_BASE,
  OFFICIAL_SOURCES,
  publicDrawingsPath,
  isOfficialPublicDoc,
  buildPublicDrawingDoc,
  mirrorDrawsToPublic,
};
