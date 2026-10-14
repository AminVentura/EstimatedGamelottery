'use strict';
// Límite de uso por ventana fija para callables públicas (2026-10-14).
// Contadores en rate_limits/<clave> (Admin SDK; firestore.rules los deja cerrados a clientes).

const RATE_LIMIT_COLLECTION = 'rate_limits';

// Estado siguiente de una ventana. Puro (sin Firestore) para poder probarlo.
// data: { count, windowStartMs } | undefined
function nextWindow(data, nowMs, limit, windowMs) {
  const start = data && Number.isFinite(data.windowStartMs) ? data.windowStartMs : 0;
  const inWindow = nowMs - start < windowMs;
  const count = inWindow && data && Number.isFinite(data.count) ? data.count : 0;
  if (count >= limit) {
    return { ok: false, count, limit, retryAfterSec: Math.max(1, Math.ceil((start + windowMs - nowMs) / 1000)) };
  }
  return { ok: true, count: count + 1, limit, next: { count: count + 1, windowStartMs: inWindow ? start : nowMs } };
}

// Las claves se limpian para que no puedan formar rutas.
function safeKey(raw) {
  return String(raw || 'unknown').replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 120);
}

// Consume una unidad en TODAS las cuotas o en ninguna. quotas: [{ key, limit }]
async function consumeQuotas(db, quotas, windowMs, nowMs = Date.now()) {
  const refs = quotas.map((q) => db.doc(RATE_LIMIT_COLLECTION + '/' + safeKey(q.key)));
  return db.runTransaction(async (txn) => {
    const snaps = [];
    for (const ref of refs) snaps.push(await txn.get(ref));
    const results = quotas.map((q, i) => nextWindow(snaps[i].exists ? snaps[i].data() : undefined, nowMs, q.limit, windowMs));
    const blocked = results.find((r) => !r.ok);
    if (blocked) return blocked;
    results.forEach((r, i) => txn.set(refs[i], { ...r.next, expiresAt: new Date(nowMs + 2 * windowMs) }));
    return { ok: true };
  });
}

module.exports = { RATE_LIMIT_COLLECTION, nextWindow, safeKey, consumeQuotas };
