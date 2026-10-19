#!/usr/bin/env node
// Auditoría de licencias para el CI de Businessskore (sin dependencias).
// Uso: node .github/scripts/licencias.mjs <carpeta-con-node_modules>
// Bloquea GPL / AGPL / SSPL (regla dura de Businessskore: PI registrada en ONAPI).
// Avisa (sin bloquear) de LGPL, MPL, EPL, CC-BY-SA y licencias desconocidas.
// Excepciones aprobadas por Amin: .github/licencias-excepciones.json
//   { "excepciones": [ { "paquete": "nombre", "licencia": "...", "aprobado": "AAAA-MM-DD", "motivo": "..." } ] }
import { readFileSync, readdirSync, existsSync, statSync, appendFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(process.argv[2] || '.');
const aquí = dirname(fileURLToPath(import.meta.url));
const ficheroExc = resolve(aquí, '..', 'licencias-excepciones.json');
const excepciones = existsSync(ficheroExc)
  ? (JSON.parse(readFileSync(ficheroExc, 'utf8')).excepciones || [])
  : [];
const exceptuado = (nombre) => excepciones.some((e) => e.paquete === nombre || (e.paquete.endsWith('*') && nombre.startsWith(e.paquete.slice(0, -1))));

const BLOQUEA = /\b(A?GPL|SSPL)\b/i;          // "LGPL" no casa porque \b exige límite antes de GPL
const AVISA = /\b(LGPL|MPL|EPL|CDDL|CC-BY-SA|OSL)\b/i;

function textoLicencia(pkg) {
  let l = pkg.license ?? pkg.licenses;
  if (Array.isArray(l)) l = l.map((x) => (typeof x === 'string' ? x : x?.type)).filter(Boolean).join(' OR ');
  if (l && typeof l === 'object') l = l.type;
  return (l || '').toString().trim();
}

// Una expresión SPDX con OR es aceptable si alguna alternativa no está bloqueada.
function clasifica(lic) {
  if (!lic || /^(UNKNOWN|UNLICENSED|SEE LICENSE)/i.test(lic)) return 'desconocida';
  const alternativas = lic.replace(/[()]/g, ' ').split(/\s+OR\s+/i);
  if (alternativas.every((a) => BLOQUEA.test(a))) return 'bloqueada';
  if (alternativas.every((a) => AVISA.test(a) || BLOQUEA.test(a))) return 'aviso';
  return 'ok';
}

const vistos = new Map();
function recorre(nm) {
  if (!existsSync(nm)) return;
  for (const ent of readdirSync(nm)) {
    if (ent.startsWith('.')) continue;
    const ruta = join(nm, ent);
    if (ent.startsWith('@')) { recorre(ruta); continue; }
    let pj;
    try { if (!statSync(ruta).isDirectory()) continue; pj = JSON.parse(readFileSync(join(ruta, 'package.json'), 'utf8')); } catch { continue; }
    const clave = `${pj.name}@${pj.version}`;
    if (!vistos.has(clave)) vistos.set(clave, { nombre: pj.name, version: pj.version, lic: textoLicencia(pj), privado: pj.private === true });
    recorre(join(ruta, 'node_modules'));
  }
}
recorre(join(raiz, 'node_modules'));

const bloqueadas = [], avisos = [], desconocidas = [], exceptuadas = [];
for (const p of vistos.values()) {
  if (p.privado) continue; // paquetes del propio monorepo
  const c = clasifica(p.lic);
  if (c === 'ok') continue;
  if (exceptuado(p.nombre)) { exceptuadas.push(p); continue; }
  if (c === 'bloqueada') bloqueadas.push(p);
  else if (c === 'aviso') avisos.push(p);
  else desconocidas.push(p);
}

const fila = (p) => `${p.nombre}@${p.version} — ${p.lic || '(sin campo license)'}`;
console.log(`Paquetes revisados: ${vistos.size}`);
for (const [t, l] of [['EXCEPCIONES APROBADAS', exceptuadas], ['AVISO (revisar)', avisos], ['DESCONOCIDA (revisar a mano)', desconocidas], ['BLOQUEADA (GPL/AGPL/SSPL)', bloqueadas]]) {
  if (!l.length) continue;
  console.log(`\n${t}: ${l.length}`);
  l.forEach((p) => console.log('  ' + fila(p)));
}
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Licencias (${raiz.split(/[\/]/).pop()})\n- Revisados: ${vistos.size}\n- Bloqueadas: ${bloqueadas.length}\n- Avisos: ${avisos.length}\n- Desconocidas: ${desconocidas.length}\n- Excepciones aprobadas: ${exceptuadas.length}\n` +
    [...bloqueadas.map((p) => `- ❌ ${fila(p)}`), ...avisos.map((p) => `- ⚠️ ${fila(p)}`)].join('\n') + '\n');
}
if (bloqueadas.length) {
  console.error(`\n${bloqueadas.length} dependencia(s) con licencia prohibida. Quitar la dependencia o pedir excepción a Amin (.github/licencias-excepciones.json).`);
  process.exit(1);
}
