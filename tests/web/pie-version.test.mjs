// Pie con versión y fecha automáticas: cada página publicada de sitio/ lleva un único
// <p data-pie-version>, y el sellador escribe versión + fecha de Santo Domingo.
// Ejecutar desde la raíz:  node --test tests/web/pie-version.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fechaBuild, textoPie, sellar, htmlDe } from '../../scripts/pie-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITIO = path.join(root, 'sitio');
const NO_PUBLICADAS = new Set(['appcheck-test.html']); // ignorada en firebase.json

test('cada página publicada tiene un solo pie de versión', () => {
  const faltan = [];
  for (const f of htmlDe(SITIO)) {
    const rel = path.relative(SITIO, f).split(path.sep).join('/');
    if (NO_PUBLICADAS.has(rel)) continue;
    const n = (fs.readFileSync(f, 'utf8').match(/data-pie-version/g) || []).length;
    if (n !== 1) faltan.push(`${rel}: ${n}`);
  }
  assert.deepEqual(faltan, []);
});

test('el predeploy de hosting sella el pie', () => {
  const fb = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  assert.deepEqual(fb.hosting.predeploy, ['node scripts/pie-version.mjs']);
});

test('fecha en hora de Santo Domingo y BUILD_DATE', () => {
  assert.equal(fechaBuild(new Date('2026-11-05T02:00:00Z'), {}), '2026-11-04');
  assert.equal(fechaBuild(new Date(), { BUILD_DATE: '2026-01-02' }), '2026-01-02');
});

test('texto y sellado (idempotente)', () => {
  const t = textoPie('1.0.0', '2026-11-04');
  assert.equal(t, 'v1.0.0 · Sitio actualizado el 4 nov 2026');
  const html = '<p class="x" data-pie-version>v0 viejo</p>';
  const una = sellar(html, t);
  assert.equal(una, `<p class="x" data-pie-version>${t}</p>`);
  assert.equal(sellar(una, t), una);
});
