// scripts/contenido-estatico.mjs — prediccionloteria.com
// Genera el contenido rastreable (HTML estático, sin JS en el navegador) de:
//   1) probabilidades por juego, calculadas con combinatoria exacta (BigInt), y
//   2) historial reciente + prueba de azar (chi-cuadrado) con datos oficiales de NY Open Data.
// Escribe dentro de marcadores <!-- AUTO:<id>:START --> … <!-- AUTO:<id>:END --> de sitio/*.html.
// Uso: node scripts/contenido-estatico.mjs        (requiere red para NY Open Data)
//      node scripts/contenido-estatico.mjs --sin-red  (solo probabilidades)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITIO = path.join(__dirname, '..', 'sitio');
const HOY = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD en hora local
const SIN_RED = process.argv.includes('--sin-red');

// ───────────────────────── utilidades ─────────────────────────
const nf0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pct = (x) => new Intl.NumberFormat('es-MX', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(x);

function C(n, k) {
  n = BigInt(n); k = BigInt(k);
  if (k < 0n || k > n) return 0n;
  if (k > n - k) k = n - k;
  let r = 1n;
  for (let i = 1n; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}
const unoEn = (fav, tot) => Number(tot) / Number(fav); // 1 en X

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function reemplazarRegion(rel, id, html, anclaAntesDe = '</main>') {
  const file = path.join(SITIO, rel);
  let s = fs.readFileSync(file, 'utf8');
  const ini = `<!-- AUTO:${id}:START -->`;
  const fin = `<!-- AUTO:${id}:END -->`;
  const bloque = `${ini}\n${html}\n${fin}`;
  if (s.includes(ini) && s.includes(fin)) {
    s = s.slice(0, s.indexOf(ini)) + bloque + s.slice(s.indexOf(fin) + fin.length);
  } else {
    const i = s.lastIndexOf(anclaAntesDe);
    if (i < 0) throw new Error(`No encuentro "${anclaAntesDe}" en ${rel}`);
    s = s.slice(0, i) + bloque + '\n' + s.slice(i);
  }
  fs.writeFileSync(file, s, 'utf8');
}

// Función gamma incompleta regularizada superior Q(a,x) (Numerical Recipes, gser/gcf)
function lnGamma(z) {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const c of g) ser += c / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function gammaQ(a, x) {
  if (x <= 0) return 1;
  if (x < a + 1) {
    let sum = 1 / a, del = sum, ap = a;
    for (let n = 0; n < 1000; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a); b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

// ───────────────────────── 1) probabilidades ─────────────────────────
const TH = 'px-3 py-2 text-left font-semibold text-gray-200';
const TD = 'px-3 py-2 text-gray-300 align-top';
const TABLA = (cab, filas, caption) => `<div class="overflow-x-auto mb-4"><table class="w-full text-sm border border-gray-700 rounded-lg">
<caption class="text-left text-xs text-gray-400 mb-2">${caption}</caption>
<thead class="bg-gray-800"><tr>${cab.map((h) => `<th scope="col" class="${TH}">${h}</th>`).join('')}</tr></thead>
<tbody>${filas.map((f) => `<tr class="border-t border-gray-800">${f.map((c) => `<td class="${TD}">${c}</td>`).join('')}</tr>`).join('\n')}</tbody></table></div>`;

const LOTTO = {
  powerball: {
    nombre: 'Powerball', N: 69, k: 5, B: 26, bola: 'Powerball',
    premios: ['5+1', '5+0', '4+1', '4+0', '3+1', '3+0', '2+1', '1+1', '0+1'],
    oficial: { '5+1': '292,201,338.00', '5+0': '11,688,053.52', '4+1': '913,129.18', '4+0': '36,525.17', '3+1': '14,494.11', '3+0': '579.76', '2+1': '701.33', '1+1': '91.98', '0+1': '38.32' },
    oficialGlobal: '24.87',
    fuente: '<a class="text-cyan-300 hover:underline" href="https://www.powerball.com/powerball-prize-chart" rel="noopener noreferrer" target="_blank">powerball.com — Prize chart</a>',
  },
  megamillions: {
    nombre: 'Mega Millions', N: 70, k: 5, B: 24, bola: 'Mega Ball',
    premios: ['5+1', '5+0', '4+1', '4+0', '3+1', '3+0', '2+1', '1+1', '0+1'],
    oficial: { '5+1': '290,472,336', '5+0': '12,629,232', '4+1': '893,761', '4+0': '38,859', '3+1': '13,965', '3+0': '607', '2+1': '665', '1+1': '86', '0+1': '35' },
    fuente: '<a class="text-cyan-300 hover:underline" href="https://www.megamillions.com/How-to-Play.aspx" rel="noopener noreferrer" target="_blank">megamillions.com — How to Play</a>',
  },
  millionaireforlife: {
    nombre: 'Millionaire For Life', N: 58, k: 5, B: 5, bola: 'Millionaire Ball',
    premios: null, // solo cotejamos las cifras oficiales que tenemos verificadas
    oficial: { '5+1': '22,910,580.00', '5+0': '5,727,645.00', '4+1': '86,455.02', '4+0': '21,613.75' },
    fuente: '<a class="text-cyan-300 hover:underline" href="https://nclottery.com/Millionaire-For-Life-how-to-play" rel="noopener noreferrer" target="_blank">nclottery.com — Millionaire For Life, How to play</a>',
  },
};

function tablaLotto(g) {
  const { N, k, B } = g;
  const tot = C(N, k) * BigInt(B);
  const filas = [];
  let pPremio = 0;
  for (let m = k; m >= 0; m--) {
    for (const s of [1, 0]) {
      const fav = C(k, m) * C(N - k, k - m) * BigInt(s ? 1 : B - 1);
      const clave = `${m}+${s}`;
      const p = Number(fav) / Number(tot);
      const paga = g.premios ? g.premios.includes(clave) : null;
      if (paga) pPremio += p;
      filas.push([
        `${m} ${m === 1 ? 'número' : 'números'}${s ? ` + ${g.bola}` : ''}`,
        `C(${k},${m})·C(${N - k},${k - m})·${s ? 1 : B - 1} = ${nf0.format(fav)}`,
        `1 en ${nf2.format(unoEn(fav, tot))}`,
        g.oficial[clave] ? `1 en ${g.oficial[clave]}` : (paga === false ? 'sin premio' : '—'),
      ]);
    }
  }
  const resumen = g.premios
    ? `<p class="text-gray-300 text-sm mb-2">Sumando las ${g.premios.length} combinaciones con premio, la probabilidad de ganar <em>algo</em> con una jugada es 1 en ${nf2.format(1 / pPremio)}${g.oficialGlobal ? ` (cifra oficial publicada: 1 en ${g.oficialGlobal})` : ''}.</p>`
    : '';
  return `<p class="text-gray-300 text-sm mb-2">Espacio total: C(${N},${k}) × ${B} = ${nf0.format(C(N, k))} × ${B} = <strong>${nf0.format(tot)}</strong> jugadas posibles. Casos favorables para acertar exactamente <em>m</em> de los ${k} números: C(${k},m) · C(${N - k},${k}−m); para la bola: 1 forma de acertarla o ${B - 1} de fallarla.</p>
${TABLA(['Resultado', 'Casos favorables', 'Probabilidad (cálculo propio)', 'Cifra oficial publicada'], filas, `${g.nombre}: ${k} de ${N} + ${g.bola} 1–${B}. Fuente de las cifras oficiales: ${g.fuente}.`)}
${resumen}`;
}

function tablaPick10() {
  const tot = C(80, 10);
  const oficial = { 10: '8,911,711', 9: '163,381', 8: '7,384', 7: '621', 6: '87', 0: '22' };
  const filas = [];
  let pPremio = 0;
  for (let m = 10; m >= 0; m--) {
    const fav = C(20, m) * C(60, 10 - m);
    if (oficial[m]) pPremio += Number(fav) / Number(tot);
    filas.push([`${m} de tus 10`, `C(20,${m})·C(60,${10 - m}) = ${nf0.format(fav)}`, `1 en ${nf2.format(unoEn(fav, tot))}`, oficial[m] ? `1 en ${oficial[m]}` : 'sin premio']);
  }
  return `<p class="text-gray-300 text-sm mb-2">Eliges 10 números; la lotería sortea 20 de 80. Es más cómodo contarlo desde tu boleto: de los C(80,10) = <strong>${nf0.format(tot)}</strong> boletos posibles, los que tienen exactamente <em>m</em> números entre los 20 sorteados son C(20,m)·C(60,10−m).</p>
${TABLA(['Aciertos', 'Casos favorables', 'Probabilidad (cálculo propio)', 'Cifra publicada'], filas, 'Pick 10 (NY): 10 elegidos, 20 sorteados de 80. Acertar 0 también tiene premio. Columna derecha: cifras redondeadas de la tabla de premios de la New York Lottery tal como la reproducen guías públicas del juego; la tabla oficial está en nylottery.ny.gov.')}
<p class="text-gray-300 text-sm mb-2">Probabilidad de ganar algún premio (10, 9, 8, 7, 6 o 0 aciertos): 1 en ${nf2.format(1 / pPremio)}.</p>`;
}

function tablaTake5() {
  const tot = C(39, 5);
  const oficial = { 5: '575,757', 4: '3,387', 3: '103', 2: '10' };
  const filas = [];
  for (let m = 5; m >= 0; m--) {
    const fav = C(5, m) * C(34, 5 - m);
    filas.push([`${m} de 5`, `C(5,${m})·C(34,${5 - m}) = ${nf0.format(fav)}`, `1 en ${nf2.format(unoEn(fav, tot))}`, oficial[m] ? `1 en ${oficial[m]}` : 'sin premio']);
  }
  return `<p class="text-gray-300 text-sm mb-2">Take 5: 5 números de 39, dos sorteos al día (mediodía y noche). Total: C(39,5) = <strong>${nf0.format(tot)}</strong> combinaciones.</p>
${TABLA(['Aciertos', 'Casos favorables', 'Probabilidad (cálculo propio)', 'Cifra publicada'], filas, 'Take 5 (NY). Acertar 2 da una jugada gratis (Quick Pick); 3, 4 y 5 aciertos tienen premios parimutuel, que cambian en cada sorteo. Columna derecha: cifras redondeadas de la New York Lottery tal como las reproducen guías públicas del juego; la tabla oficial está en nylottery.ny.gov.')}`;
}

function tablaWin4() {
  // patrones de 4 dígitos 0-9: todos distintos, un par, dos pares, trío, cuádruple
  const pat = { '4 distintos (p. ej. 1234)': 0, 'un par (1123)': 0, 'dos pares (1122)': 0, 'trío (1112)': 0, 'cuádruple (1111)': 0 };
  for (let i = 0; i < 10000; i++) {
    const d = String(i).padStart(4, '0').split('');
    const c = Object.values(d.reduce((a, x) => ((a[x] = (a[x] || 0) + 1), a), {})).sort((a, b) => b - a).join('');
    if (c === '1111') pat['4 distintos (p. ej. 1234)']++;
    else if (c === '211') pat['un par (1123)']++;
    else if (c === '22') pat['dos pares (1122)']++;
    else if (c === '31') pat['trío (1112)']++;
    else pat['cuádruple (1111)']++;
  }
  const orden = { '4 distintos (p. ej. 1234)': 24, 'un par (1123)': 12, 'dos pares (1122)': 6, 'trío (1112)': 4, 'cuádruple (1111)': 1 };
  const filas = Object.entries(pat).map(([k, v]) => [k, `${nf0.format(v)} de 10 000 (${pct(v / 10000)})`, orden[k] === 1 ? '— (solo Straight)' : `${orden[k]} órdenes → Box: 1 en ${nf2.format(10000 / orden[k])}`]);
  return { pat, html: `<p class="text-gray-300 text-sm mb-2">Win 4 sortea cuatro dígitos del 0 al 9 (0000–9999): 10<sup>4</sup> = 10 000 resultados igual de probables. Una jugada <strong>Straight</strong> (orden exacto) acierta con probabilidad 1 en 10 000. En <strong>Box</strong> (cualquier orden) la probabilidad depende de cuántos órdenes distintos tiene tu número: 4!/(repeticiones) órdenes.</p>
${TABLA(['Tipo de número', 'Cuántos hay', 'Órdenes posibles y probabilidad Box'], filas, 'Win 4: conteo exhaustivo de los 10 000 números posibles (cálculo propio). Premios y tipos de jugada: New York Lottery (nylottery.ny.gov).')}` };
}

// ───────────────────────── 2) datos oficiales ─────────────────────────
async function ny(id, query) {
  const url = `https://data.ny.gov/resource/${id}.json?${query}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${id}: HTTP ${r.status}`);
  return r.json();
}
const fecha = (s) => s.slice(0, 10);
const fuenteNY = (id, nombre) => `Fuente: NY Open Data, conjunto «${esc(nombre)}» (<a class="text-cyan-300 hover:underline" href="https://data.ny.gov/d/${id}" rel="noopener noreferrer" target="_blank">data.ny.gov/d/${id}</a>), publicado por la New York State Gaming Commission. Instantánea tomada el ${HOY}; para el último sorteo y para reclamar premios, consulta <a class="text-cyan-300 hover:underline" href="https://nylottery.ny.gov/" rel="noopener noreferrer" target="_blank">nylottery.ny.gov</a>.`;

function chi(counts, n, N, k) {
  // counts: array de N frecuencias; n sorteos; cada sorteo saca k de N sin reemplazo.
  const E = (n * k) / N;
  let x2 = 0;
  for (const o of counts) x2 += ((o - E) ** 2) / E;
  const xc = k > 1 ? (x2 * (N - 1)) / (N - k) : x2;
  const df = N - 1;
  return { E, x2: xc, df, p: gammaQ(df / 2, xc / 2), sd: Math.sqrt(n * (k / N) * (1 - k / N)) };
}

function bloqueChi(titulo, counts, n, N, k, etiqueta = (i) => String(i + 1)) {
  const r = chi(counts, n, N, k);
  const orden = counts.map((c, i) => ({ c, i })).sort((a, b) => b.c - a.c);
  const top = orden.slice(0, 5).map((o) => `${etiqueta(o.i)} (${o.c})`).join(', ');
  const bot = orden.slice(-5).reverse().map((o) => `${etiqueta(o.i)} (${o.c})`).join(', ');
  const zMax = (orden[0].c - r.E) / r.sd, zMin = (orden.at(-1).c - r.E) / r.sd;
  const veredicto = r.p >= 0.05
    ? 'Las diferencias entre números calientes y fríos son del tamaño que produce el azar: no hay evidencia de sesgo.'
    : 'El p-valor es bajo. Con muchas pruebas a la vez es esperable que alguna salga baja por azar (1 de cada 20 con p &lt; 0,05); no lo tomes como señal para jugar.';
  return `<h3 class="text-lg font-semibold text-gray-100 mt-4 mb-2">${titulo}</h3>
<ul class="list-disc pl-5 text-gray-300 text-sm space-y-1 mb-2">
<li>Sorteos analizados: <strong>${nf0.format(n)}</strong>. Frecuencia esperada por número si el sorteo es justo: n·${k}/${N} = <strong>${nf2.format(r.E)}</strong> (desviación típica ≈ ${nf2.format(r.sd)}).</li>
<li>Más frecuentes («calientes»): ${top}. El máximo está a ${nf2.format(zMax)} desviaciones de lo esperado.</li>
<li>Menos frecuentes («fríos»): ${bot}. El mínimo está a ${nf2.format(zMin)} desviaciones.</li>
<li>Prueba chi-cuadrado de uniformidad${k > 1 ? ` (estadístico corregido ×(${N}−1)/(${N}−${k}) porque cada sorteo saca ${k} números sin repetir)` : ''}: χ² = ${nf2.format(r.x2)} con ${r.df} grados de libertad, <strong>p = ${nf3.format(r.p)}</strong>.</li>
</ul>
<p class="text-gray-400 text-sm mb-3">${veredicto} Con ${N} números, que el más y el menos frecuente queden a 2 o 3 desviaciones de la media es lo normal.</p>`;
}

const tablaSorteos = (filas, cab, caption) => TABLA(cab, filas, caption);

async function powerball() {
  const nombre = 'Lottery Powerball Winning Numbers: Beginning 2010';
  const rows = await ny('d6yy-54nr', `$where=draw_date>='2015-10-07T00:00:00'&$order=draw_date DESC&$limit=5000`);
  const draws = rows.map((r) => ({ f: fecha(r.draw_date), n: r.winning_numbers.trim().split(/\s+/).map(Number) }))
    .filter((d) => d.n.length === 6 && d.n.slice(0, 5).every((x) => x >= 1 && x <= 69) && d.n[5] >= 1 && d.n[5] <= 26);
  const blancos = Array(69).fill(0), rojos = Array(26).fill(0);
  for (const d of draws) { d.n.slice(0, 5).forEach((x) => blancos[x - 1]++); rojos[d.n[5] - 1]++; }
  const ult = draws.slice(0, 12).map((d) => [d.f, d.n.slice(0, 5).map((x) => String(x).padStart(2, '0')).join(' '), String(d.n[5]).padStart(2, '0')]);
  return `<section class="mb-8" id="historial-oficial">
<h2 class="text-xl font-semibold text-cyan-400 mb-3">Últimos resultados oficiales y prueba de azar</h2>
${tablaSorteos(ult, ['Fecha', 'Números (1–69)', 'Powerball'], 'Últimos 12 sorteos en el conjunto oficial.')}
<p class="text-gray-400 text-xs mb-4">${fuenteNY('d6yy-54nr', nombre)}</p>
<p class="text-gray-300 text-sm mb-2">Usamos solo los sorteos desde el 7 de octubre de 2015, cuando Powerball pasó a 5 de 69 + 1 de 26. Mezclar sorteos con otras reglas inflaría la frecuencia de números que hoy ni existen o cambiaría la esperada.</p>
${bloqueChi('Números blancos (1–69)', blancos, draws.length, 69, 5)}
${bloqueChi('Powerball (1–26)', rojos, draws.length, 26, 1)}
</section>`;
}

async function pick10() {
  const nombre = 'Lottery Pick 10 Winning Numbers: Beginning 1987';
  const rows = await ny('bycu-cw7c', `$order=draw_date DESC&$limit=1000`);
  const draws = rows.map((r) => ({ f: fecha(r.draw_date), n: r.winning_numbers.trim().split(/\s+/).map(Number) }))
    .filter((d) => d.n.length === 20 && d.n.every((x) => x >= 1 && x <= 80));
  const cnt = Array(80).fill(0);
  draws.forEach((d) => d.n.forEach((x) => cnt[x - 1]++));
  const ult = draws.slice(0, 10).map((d) => [d.f, d.n.map((x) => String(x).padStart(2, '0')).join(' ')]);
  return `<section class="mb-8" id="historial-oficial">
<h2 class="text-xl font-semibold text-cyan-400 mb-3">Últimos resultados oficiales y prueba de azar</h2>
${tablaSorteos(ult, ['Fecha', '20 números sorteados (1–80)'], 'Últimos 10 sorteos en el conjunto oficial.')}
<p class="text-gray-400 text-xs mb-4">${fuenteNY('bycu-cw7c', nombre)}</p>
${bloqueChi(`Frecuencia de los 80 números en los últimos ${draws.length} sorteos`, cnt, draws.length, 80, 20)}
</section>`;
}

async function take5() {
  const nombre = 'Lottery Take 5 Winning Numbers';
  const rows = await ny('dg63-4siq', `$order=draw_date DESC&$limit=1000`);
  const parse = (s) => (s ? s.trim().split(/\s+/).map(Number) : null);
  const ok = (n) => n && n.length === 5 && n.every((x) => x >= 1 && x <= 39);
  const mid = [], eve = [];
  for (const r of rows) {
    const m = parse(r.midday_winning_numbers), e = parse(r.evening_winning_numbers);
    if (ok(m)) mid.push({ f: fecha(r.draw_date), n: m });
    if (ok(e)) eve.push({ f: fecha(r.draw_date), n: e });
  }
  const cuenta = (arr) => { const c = Array(39).fill(0); arr.forEach((d) => d.n.forEach((x) => c[x - 1]++)); return c; };
  const ult = rows.slice(0, 10).map((r) => [fecha(r.draw_date), r.midday_winning_numbers || '—', r.evening_winning_numbers || '—']);
  return `<section class="mb-8" id="historial-oficial">
<h2 class="text-xl font-semibold text-cyan-400 mb-3">Últimos resultados oficiales y prueba de azar</h2>
${tablaSorteos(ult, ['Fecha', 'Mediodía', 'Noche'], 'Últimos 10 días en el conjunto oficial.')}
<p class="text-gray-400 text-xs mb-4">${fuenteNY('dg63-4siq', nombre)}</p>
${bloqueChi(`Sorteo de mediodía (últimos ${mid.length})`, cuenta(mid), mid.length, 39, 5)}
${bloqueChi(`Sorteo de noche (últimos ${eve.length})`, cuenta(eve), eve.length, 39, 5)}
</section>`;
}

async function win4(pat) {
  const nombre = 'Lottery Daily Numbers/Win-4 Winning Numbers: Beginning 1980';
  const rows = await ny('hsys-3def', `$order=draw_date DESC&$limit=1000`);
  const ok = (s) => typeof s === 'string' && /^\d{4}$/.test(s.trim());
  const series = { 'Mediodía': rows.map((r) => r.midday_win_4).filter(ok), 'Noche': rows.map((r) => r.evening_win_4).filter(ok) };
  const tipo = (s) => { const c = Object.values(s.split('').reduce((a, x) => ((a[x] = (a[x] || 0) + 1), a), {})).sort((a, b) => b - a).join(''); return { '1111': 0, '211': 1, '22': 2, '31': 3, '4': 4 }[c]; };
  const nombresPat = Object.keys(pat);
  let bloques = '';
  for (const [nom, arr] of Object.entries(series)) {
    const obs = [0, 0, 0, 0, 0];
    arr.forEach((s) => obs[tipo(s)]++);
    const filas = nombresPat.map((k, i) => [k, `${nf0.format(obs[i])} (${pct(obs[i] / arr.length)})`, pct(pat[k] / 10000)]);
    // chi-cuadrado de bondad de ajuste; trío y cuádruple se agrupan para que ninguna esperada sea < 5
    const pr = nombresPat.map((k) => pat[k] / 10000);
    const o4 = [obs[0], obs[1], obs[2], obs[3] + obs[4]], p4 = [pr[0], pr[1], pr[2], pr[3] + pr[4]];
    const x2p = o4.reduce((a, o, i) => a + ((o - arr.length * p4[i]) ** 2) / (arr.length * p4[i]), 0);
    const pp = gammaQ(3 / 2, x2p / 2);
    bloques += `<h3 class="text-lg font-semibold text-gray-100 mt-4 mb-2">${nom}: ¿coincide la realidad con la combinatoria?</h3>
${TABLA(['Tipo de número', `Observado en ${arr.length} sorteos`, 'Esperado (cálculo)'], filas, 'Comparación entre lo sorteado y el conteo exacto de los 10 000 números posibles.')}
<p class="text-gray-300 text-sm mb-2">Prueba chi-cuadrado de bondad de ajuste (trío y cuádruple agrupados): χ² = ${nf2.format(x2p)}, 3 g.l., p = ${nf3.format(pp)}. ${pp >= 0.05 ? 'La diferencia entre lo observado y lo esperado cabe dentro del azar.' : 'La diferencia es mayor de lo habitual en una muestra de este tamaño. Puede ser casualidad (estamos haciendo varias pruebas) y no indica qué número saldrá; lo volveremos a medir con más sorteos.'}</p>`;
    let pos = '<ul class="list-disc pl-5 text-gray-300 text-sm space-y-1 mb-3">';
    for (let p = 0; p < 4; p++) {
      const c = Array(10).fill(0); arr.forEach((s) => c[Number(s[p])]++);
      const r = chi(c, arr.length, 10, 1);
      pos += `<li>Posición ${p + 1}: dígitos 0–9 = ${c.join(' · ')} (esperado ${nf2.format(r.E)} cada uno); χ² = ${nf2.format(r.x2)}, 9 g.l., p = ${nf3.format(r.p)}.</li>`;
    }
    bloques += `<p class="text-gray-300 text-sm mb-1">Frecuencia de cada dígito por posición:</p>${pos}</ul>`;
  }
  const ult = rows.slice(0, 10).map((r) => [fecha(r.draw_date), r.midday_win_4 || '—', r.evening_win_4 || '—']);
  return `<section class="mb-8" id="historial-oficial">
<h2 class="text-xl font-semibold text-cyan-400 mb-3">Últimos resultados oficiales y prueba de azar</h2>
${tablaSorteos(ult, ['Fecha', 'Win 4 mediodía', 'Win 4 noche'], 'Últimos 10 días en el conjunto oficial.')}
<p class="text-gray-400 text-xs mb-4">${fuenteNY('hsys-3def', nombre)}</p>
${bloques}
<p class="text-gray-400 text-sm mb-3">Diez pruebas a la vez (4 posiciones y el tipo de número, en los 2 sorteos): que alguna dé p &lt; 0,05 ocurre con frecuencia por puro azar. Un dígito «caliente» en una posición no cambia la probabilidad del próximo sorteo, que sigue siendo 1 en 10.</p>
</section>`;
}

async function megaMillionsCompletitud() {
  // Desde el 8-abr-2025 Mega Millions es 5/70 + 1/24 y sortea martes y viernes.
  const rows = await ny('5xaw-6ayf', `$where=draw_date>='2025-04-08T00:00:00'&$order=draw_date DESC&$limit=500`);
  let esperados = 0;
  for (let d = new Date('2025-04-08T12:00:00Z'); d <= new Date(rows[0]?.draw_date ? rows[0].draw_date.slice(0, 10) + 'T12:00:00Z' : HOY); d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === 2 || d.getUTCDay() === 5) esperados++;
  }
  return `<section class="mb-8" id="historial-oficial">
<h2 class="text-xl font-semibold text-cyan-400 mb-3">Sobre el historial oficial disponible</h2>
<p class="text-gray-300 text-sm mb-2">Revisamos el conjunto público de NY Open Data (<a class="text-cyan-300 hover:underline" href="https://data.ny.gov/d/5xaw-6ayf" rel="noopener noreferrer" target="_blank">5xaw-6ayf</a>) el ${HOY}: desde el cambio de reglas del 8 de abril de 2025 hasta su último registro (${rows[0] ? fecha(rows[0].draw_date) : 'sin datos'}) contiene <strong>${rows.length}</strong> sorteos, cuando el calendario de martes y viernes implica unos <strong>${esperados}</strong>. Con un historial tan incompleto no publicamos frecuencias ni pruebas de azar para Mega Millions: serían engañosas.</p>
<p class="text-gray-400 text-sm mb-3">Para resultados completos usa <a class="text-cyan-300 hover:underline" href="https://www.megamillions.com/Winning-Numbers/Previous-Drawings.aspx" rel="noopener noreferrer" target="_blank">megamillions.com</a> o <a class="text-cyan-300 hover:underline" href="https://nylottery.ny.gov/" rel="noopener noreferrer" target="_blank">nylottery.ny.gov</a>.</p>
</section>`;
}

// ───────────────────────── escribir ─────────────────────────
const enlaceProb = '<p class="text-gray-400 text-sm mb-6">Fórmulas y el resto de juegos: <a class="text-cyan-300 hover:underline" href="/probabilidades-loteria.html">probabilidades reales de cada lotería</a>.</p>';
const seccionReglas = (cuerpo) => `<section class="mb-8" id="probabilidades">
<h2 class="text-xl font-semibold text-cyan-400 mb-3">Probabilidades reales, calculadas</h2>
${cuerpo}
${enlaceProb}
</section>`;

const w4 = tablaWin4();
const PROB = {
  powerball: tablaLotto(LOTTO.powerball),
  megamillions: tablaLotto(LOTTO.megamillions),
  millionaireforlife: tablaLotto(LOTTO.millionaireforlife),
  pick10: tablaPick10(),
  take5: tablaTake5(),
  win4: w4.html,
};

// Página de probabilidades
for (const [id, html] of Object.entries(PROB)) reemplazarRegion('probabilidades-loteria.html', `prob-${id}`, html);
reemplazarRegion('probabilidades-loteria.html', 'fecha', `<p class="text-gray-500 text-xs mb-6">Tablas generadas por <code>scripts/contenido-estatico.mjs</code> el ${HOY}.</p>`);

// Páginas por juego
const PAG = {
  powerball: 'analisis/powerball.html', megamillions: 'analisis/mega-millions.html', millionaireforlife: 'analisis/millionaire-for-life.html',
  pick10: 'analisis/pick-10.html', take5: 'analisis/take-5.html', win4: 'analisis/win-4.html',
};
for (const [id, rel] of Object.entries(PAG)) reemplazarRegion(rel, 'probabilidades', seccionReglas(PROB[id]));

if (!SIN_RED) {
  const tareas = { powerball, pick10, take5, win4: () => win4(w4.pat), megamillions: megaMillionsCompletitud };
  for (const [id, fn] of Object.entries(tareas)) {
    try {
      reemplazarRegion(PAG[id], 'historial', await fn());
      console.log(`ok historial ${id}`);
    } catch (e) {
      console.error(`ERROR historial ${id}: ${e.message} (se deja la versión anterior)`);
      process.exitCode = 1;
    }
  }
}
console.log('ok probabilidades', Object.keys(PROB).join(', '));
