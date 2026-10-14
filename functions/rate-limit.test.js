// Límite de uso de estimatePreferredNumbers (functions/rate-limit.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { nextWindow, safeKey, consumeQuotas } = require('./rate-limit.js');

const H = 60 * 60 * 1000;

test('la ventana cuenta hasta el límite y luego bloquea con tiempo de espera', () => {
  let state;
  for (let i = 1; i <= 3; i += 1) {
    const r = nextWindow(state, 1000 + i, 3, H);
    assert.equal(r.ok, true);
    assert.equal(r.count, i);
    state = r.next;
  }
  const blocked = nextWindow(state, 2000, 3, H);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec > 3500 && blocked.retryAfterSec <= 3600);
});

test('pasada la hora la ventana se reinicia', () => {
  const r = nextWindow({ count: 99, windowStartMs: 0 }, H + 1, 3, H);
  assert.equal(r.ok, true);
  assert.equal(r.count, 1);
  assert.equal(r.next.windowStartMs, H + 1);
});

test('las claves no pueden formar rutas', () => {
  assert.equal(safeKey('estimate_id_../../users/x'), 'estimate_id_.._.._users_x');
  assert.equal(safeKey(''), 'unknown');
  assert.equal(safeKey('a'.repeat(300)).length, 120);
});

// Firestore mínimo con transacciones.
function fakeDb() {
  const store = new Map();
  return {
    store,
    doc: (p) => ({ path: p }),
    runTransaction: async (fn) => {
      const writes = [];
      const txn = {
        get: async (ref) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
        set: (ref, data) => writes.push([ref.path, data]),
      };
      const out = await fn(txn);
      writes.forEach(([p, d]) => store.set(p, d));
      return out;
    },
  };
}

test('si una cuota está agotada no se consume ninguna', async () => {
  const db = fakeDb();
  const quotas = [{ key: 'estimate_id_u1', limit: 2 }, { key: 'estimate_ip_1.2.3.4', limit: 3 }];
  assert.equal((await consumeQuotas(db, quotas, H, 10)).ok, true);
  assert.equal((await consumeQuotas(db, quotas, H, 11)).ok, true);
  const third = await consumeQuotas(db, quotas, H, 12);
  assert.equal(third.ok, false);
  assert.equal(db.store.get('rate_limits/estimate_ip_1.2.3.4').count, 2);
  // otro usuario desde la misma IP: le queda 1 de la IP
  assert.equal((await consumeQuotas(db, [{ key: 'estimate_id_u2', limit: 2 }, { key: 'estimate_ip_1.2.3.4', limit: 3 }], H, 13)).ok, true);
  assert.equal((await consumeQuotas(db, [{ key: 'estimate_id_u3', limit: 2 }, { key: 'estimate_ip_1.2.3.4', limit: 3 }], H, 14)).ok, false);
  assert.equal(db.store.has('rate_limits/estimate_id_u3'), false);
});
