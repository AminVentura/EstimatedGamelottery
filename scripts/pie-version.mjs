// scripts/pie-version.mjs — prediccionloteria.com
// Pie con versión y fecha automáticas (estándar Businessskore 2026-10-25).
// Escribe «v<versión de package.json> · Sitio actualizado el 4 nov 2026» (fecha del build,
// hora de Santo Domingo) dentro de cada <p … data-pie-version>…</p> de sitio/.
// Corre solo en el predeploy de hosting (firebase.json): cada publicación lleva su fecha.
// BUILD_DATE=AAAA-MM-DD fija la fecha a mano. Nada se escribe a mano en las páginas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function fechaBuild(ahora = new Date(), env = process.env) {
  if (env.BUILD_DATE && /^\d{4}-\d{2}-\d{2}$/.test(env.BUILD_DATE)) return env.BUILD_DATE;
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(ahora);
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

export function textoPie(version, isoDia) {
  const [a, m, d] = isoDia.split('-').map(Number);
  return `v${version} · Sitio actualizado el ${d} ${MESES[m - 1]} ${a}`;
}

export function sellar(html, texto) {
  return html.replace(/(<p\b[^>]*\bdata-pie-version\b[^>]*>)[^<]*(<\/p>)/g, `$1${texto}$2`);
}

export function htmlDe(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return htmlDe(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { version } = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  const texto = textoPie(version, fechaBuild());
  let n = 0;
  for (const f of htmlDe(path.join(RAIZ, 'sitio'))) {
    const antes = fs.readFileSync(f, 'utf8');
    const despues = sellar(antes, texto);
    if (despues !== antes) { fs.writeFileSync(f, despues); n += 1; }
  }
  console.log(`[pie-version] ${texto} (${n} páginas cambiadas)`);
}
